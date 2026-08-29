require('dotenv').config();
const mineflayer = require('mineflayer');
const { registerLinkAuth } = require('./link-auth');

const CONFIG = {
  host: process.env.MC_HOST || 'localhost',
  port: parseInt(process.env.MC_PORT || '25565', 10),
  username: process.env.MC_BOT_USERNAME || 'ShopBot',
  auth: process.env.MC_AUTH || 'offline',
  apiUrl: process.env.SHOP_API_URL || 'http://localhost:8000',
  apiKey: process.env.BOT_API_KEY || 'change-bot-api-key',
  paymentPrefix: process.env.PAYMENT_PREFIX || 'pay',
  shopOwnerIgn: process.env.SHOP_OWNER_IGN || 'ShopOwner',
};

/**
 * Erkennt Zahlungen aus Chat-Nachrichten.
 * Unterstützte Formate:
 * - "SpielerName pay 10.00" (Spieler zahlt an Bot/Shop)
 * - Plugin-Nachrichten: "SpielerName paid ShopOwner 10.00"
 * - EssentialsX: "SpielerName paid you $10.00"
 */
const PAYMENT_PATTERNS = [
  // Direkter Pay-Befehl im Chat: "Spieler pay 10.50"
  /^(\w+)\s+pay\s+(\d+(?:\.\d{1,2})?)$/i,
  // "Spieler paid ShopOwner 10.50"
  /^(\w+)\s+paid\s+\w+\s+(\d+(?:\.\d{1,2})?)$/i,
  // EssentialsX: "Spieler paid you $10.00"
  /^(\w+)\s+paid\s+you\s+\$?(\d+(?:\.\d{1,2})?)$/i,
  // Vault/Plugin: "Spieler -> ShopOwner: 10.00"
  /^(\w+)\s*->\s*\w+:\s*\$?(\d+(?:\.\d{1,2})?)$/i,
  // Custom: "[Payment] Spieler 10.00"
  /^\[Payment\]\s+(\w+)\s+\$?(\d+(?:\.\d{1,2})?)$/i,
];

async function confirmPayment(ign, amount, reference) {
  try {
    const res = await fetch(`${CONFIG.apiUrl}/api/bot/payments/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Bot-Api-Key': CONFIG.apiKey,
      },
      body: JSON.stringify({
        ign,
        amount: parseFloat(amount),
        payment_reference: reference,
      }),
    });
    const data = await res.json();
    return data;
  } catch (err) {
    console.error('[API] Fehler bei Zahlungsbestätigung:', err.message);
    return { success: false };
  }
}

function parsePayment(message) {
  const clean = message.replace(/\§./g, '').trim();

  for (const pattern of PAYMENT_PATTERNS) {
    const match = clean.match(pattern);
    if (match) {
      return { ign: match[1], amount: parseFloat(match[2]) };
    }
  }

  // Pay-Befehl vom Spieler selbst (whisper/private)
  const payCmd = clean.match(/^pay\s+(\w+)\s+(\d+(?:\.\d{1,2})?)$/i);
  if (payCmd) {
    return { ign: CONFIG.lastCommandSender || 'unknown', amount: parseFloat(payCmd[2]), target: payCmd[1] };
  }

  return null;
}

const bot = mineflayer.createBot({
  host: CONFIG.host,
  port: CONFIG.port,
  username: CONFIG.username,
  auth: CONFIG.auth,
});

bot.on('login', () => {
  console.log(`[Bot] Eingeloggt als ${bot.username} auf ${CONFIG.host}:${CONFIG.port}`);
});

bot.on('spawn', () => {
  console.log('[Bot] Gespawnt — warte auf Zahlungen & Link-Codes...');
  registerLinkAuth(bot, CONFIG);
});

bot.on('chat', async (username, message) => {
  if (username === bot.username) return;

  const payment = parsePayment(message);
  if (!payment) return;

  console.log(`[Payment] Erkannt: ${payment.ign} -> ${payment.amount}`);

  const result = await confirmPayment(payment.ign, payment.amount, message);

  if (result.success) {
    bot.chat(`/tell ${payment.ign} Zahlung bestätigt! Bestellung #${result.order_id} — Danke für deinen Kauf!`);
    console.log(`[Payment] Bestätigt: Order #${result.order_id}`);
  } else {
    console.log(`[Payment] Keine passende Bestellung für ${payment.ign} (${payment.amount})`);
  }
});

// Whisper-Nachrichten (manche Pay-Plugins nutzen /msg)
bot.on('messagestr', async (message) => {
  const payment = parsePayment(message);
  if (!payment) return;

  console.log(`[Payment/System] Erkannt: ${payment.ign} -> ${payment.amount}`);
  const result = await confirmPayment(payment.ign, payment.amount, message);

  if (result.success) {
    console.log(`[Payment] Bestätigt: Order #${result.order_id}`);
  }
});

bot.on('error', (err) => {
  console.error('[Bot] Fehler:', err.message);
});

bot.on('kicked', (reason) => {
  console.log('[Bot] Gekickt:', reason);
});

bot.on('end', () => {
  console.log('[Bot] Verbindung beendet — Reconnect in 10s...');
  setTimeout(() => {
    require('child_process').spawn(process.argv[0], process.argv.slice(1), { stdio: 'inherit' });
    process.exit();
  }, 10000);
});
