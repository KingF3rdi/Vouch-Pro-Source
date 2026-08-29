/**
 * Zahlungserkennung für den Bot-Account (Anmeldung + Zahlungsempfänger).
 * Der Bot-Account empfängt /pay-Zahlungen direkt — z. B. EssentialsX: "Spieler paid you $10".
 */

const { sendPrivateMessage } = require('./player-messages');

function stripColors(text) {
  return text.replace(/\u00a7./g, '').trim();
}

function buildPaymentPatterns(recipientIgn) {
  const recipient = recipientIgn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return [
    // EssentialsX an Bot-Account: "Spieler paid you $10.00"
    { regex: /^(\w+)\s+paid\s+you\s+\$?(\d+(?:\.\d{1,2})?)$/i, toBot: true },
    // "Spieler paid BotName 10.50"
    { regex: new RegExp(`^(\\w+)\\s+paid\\s+${recipient}\\s+\\$?(\\d+(?:\\.\\d{1,2})?)$`, 'i'), toBot: true },
    // Vault: "Spieler -> BotName: 10.00"
    { regex: new RegExp(`^(\\w+)\\s*->\\s*${recipient}:\\s*\\$?(\\d+(?:\\.\\d{1,2})?)$`, 'i'), toBot: true },
    // Custom: "[Payment] Spieler 10.00 an BotName"
    { regex: new RegExp(`^\\[Payment\\]\\s+(\\w+)\\s+\\$?(\\d+(?:\\.\\d{1,2})?)\\s+(?:an\\s+)?${recipient}$`, 'i'), toBot: true },
    // Öffentlicher Chat-Fallback (nur wenn Empfänger im Text)
    { regex: new RegExp(`^(\\w+)\\s+pay\\s+${recipient}\\s+\\$?(\\d+(?:\\.\\d{1,2})?)$`, 'i'), toBot: true },
  ];
}

function parsePayment(message, config, botUsername) {
  const clean = stripColors(message);
  const recipient = (config.paymentRecipient || botUsername || '').toLowerCase();
  const patterns = buildPaymentPatterns(config.paymentRecipient || botUsername || 'ShopBot');

  for (const { regex } of patterns) {
    const match = clean.match(regex);
    if (match) {
      return { ign: match[1], amount: parseFloat(match[2]), recipient };
    }
  }

  // Whisper/System: "pay BotName 10" — Sender wird separat übergeben
  const payCmd = clean.match(/^pay\s+(\w+)\s+\$?(\d+(?:\.\d{1,2})?)$/i);
  if (payCmd && payCmd[1].toLowerCase() === recipient) {
    return {
      ign: null,
      amount: parseFloat(payCmd[2]),
      recipient,
      needsSender: true,
    };
  }

  return null;
}

async function confirmPayment(config, ign, amount, reference) {
  try {
    const res = await fetch(`${config.apiUrl}/api/bot/payments/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Bot-Api-Key': config.apiKey,
      },
      body: JSON.stringify({
        ign,
        amount: parseFloat(amount),
        payment_reference: reference,
      }),
    });
    return await res.json();
  } catch (err) {
    console.error('[Payment] API-Fehler:', err.message);
    return { success: false };
  }
}

function registerPaymentHandler(bot, config) {
  const botName = config.username || bot.username;
  const paymentRecipient = config.paymentRecipient || botName;

  async function handlePayment(payerIgn, amount, reference) {
    if (!payerIgn || payerIgn === botName) return;

    console.log(`[Payment] ${payerIgn} -> ${paymentRecipient}: ${amount}`);
    const result = await confirmPayment(config, payerIgn, amount, reference);

    if (result.success) {
      const count = result.orders_confirmed || 1;
      const orderLabel =
        count > 1
          ? `${count} Bestellungen (#${(result.order_ids || [result.order_id]).join(', #')})`
          : `Bestellung #${result.order_id}`;
      sendPrivateMessage(
        bot,
        payerIgn,
        `Zahlung bestätigt! ${orderLabel} — Danke für deinen Kauf!`,
        config
      );
      console.log(`[Payment] Bestätigt: ${orderLabel}`);
    } else {
      console.log(`[Payment] Keine passende Bestellung für ${payerIgn} (${amount})`);
    }
  }

  function processMessage(message, senderIgn) {
    const payment = parsePayment(message, config, botName);
    if (!payment) return;

    const payer = payment.needsSender ? senderIgn : payment.ign;
    if (!payer) return;

    handlePayment(payer, payment.amount, message);
  }

  // Systemnachrichten: "Spieler paid you $10"
  bot.on('messagestr', (message) => {
    processMessage(message, null);
  });

  // Öffentlicher Chat
  bot.on('chat', (username, message) => {
    if (username === botName) return;
    processMessage(message, username);
  });

  console.log(`[Payment] Bereit — Empfänger: ${paymentRecipient} (/pay ${paymentRecipient} <betrag>)`);
}

module.exports = { registerPaymentHandler, parsePayment, confirmPayment };
