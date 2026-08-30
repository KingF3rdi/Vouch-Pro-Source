/**
 * Spieler sendet Website-Zahlungscode an den Bot:
 *   /msg BotName zahlung AB12CD
 *   !shop zahlung AB12CD
 */

const { sendPrivateMessage } = require('./player-messages');
const { registerPlayerCode } = require('./pending-payments');

const PAY_CODE_PATTERNS = [
  /^(?:!shop\s+)?zahlung\s+([A-Z0-9]{4,12})$/i,
  /^(?:!shop\s+)?pay\s+([A-Z0-9]{4,12})$/i,
  /^code\s+([A-Z0-9]{4,12})$/i,
];

function stripColors(text) {
  return text.replace(/\u00a7./g, '').trim();
}

function parsePaymentCodeCommand(message) {
  const clean = stripColors(message);
  for (const pattern of PAY_CODE_PATTERNS) {
    const match = clean.match(pattern);
    if (match) return match[1].toUpperCase();
  }
  return null;
}

function registerPaymentCodeHandler(bot, config) {
  const botName = config.username || bot.username;
  const recipient = config.paymentRecipient || botName;

  async function handleCode(username, code) {
    if (!username || username === botName) return;

    const entry = registerPlayerCode(username, code);
    const amountHint =
      entry.amount != null ? ` ${entry.amount}` : '';
    sendPrivateMessage(
      bot,
      username,
      `Zahlungscode ${code} registriert.${amountHint ? ` Zahle jetzt: /pay ${recipient}${amountHint}` : ` Danach /pay ${recipient} <betrag>.`}`,
      config
    );
    console.log(`[PaymentCode] ${username} -> ${code}`);
  }

  bot.on('chat', (username, message) => {
    const code = parsePaymentCodeCommand(message);
    if (code) handleCode(username, code);
  });

  bot.on('whisper', (username, message) => {
    const code = parsePaymentCodeCommand(message);
    if (code) handleCode(username, code);
  });

  console.log(
    `[PaymentCode] Bereit — /msg ${botName} zahlung <CODE> nach Website-Checkout`
  );
}

module.exports = { registerPaymentCodeHandler, parsePaymentCodeCommand };
