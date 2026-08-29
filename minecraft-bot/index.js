require('dotenv').config();
const mineflayer = require('mineflayer');
const { registerLinkAuth } = require('./link-auth');
const { registerPaymentHandler } = require('./payment-handler');

const botUsername = process.env.MC_BOT_USERNAME || 'ShopBot';

const CONFIG = {
  host: process.env.MC_HOST || 'localhost',
  port: parseInt(process.env.MC_PORT || '25565', 10),
  username: botUsername,
  auth: process.env.MC_AUTH || 'microsoft',
  apiUrl: process.env.SHOP_API_URL || 'http://localhost:8000',
  apiKey: process.env.BOT_API_KEY || 'change-bot-api-key',
  msgCmd: process.env.MC_MSG_CMD || 'msg',
  // Bot-Account = Zahlungsempfänger (optional SHOP_OWNER_IGN zum Überschreiben)
  paymentRecipient: process.env.SHOP_OWNER_IGN || botUsername,
};

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
  console.log('[Bot] Gespawnt — Link-Codes & Zahlungen aktiv');
  registerLinkAuth(bot, CONFIG);
  registerPaymentHandler(bot, CONFIG);
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
