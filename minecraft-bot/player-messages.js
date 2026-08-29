/**
 * Hilfsfunktionen für einen Bot, der als normaler Minecraft-Spieleraccount läuft.
 * Antworten gehen per /msg (oder konfigurierbarem Whisper-Befehl) an den Spieler.
 */

function sendPrivateMessage(bot, username, text, config = {}) {
  const cmd = config.msgCmd || process.env.MC_MSG_CMD || 'msg';
  const safeText = text.replace(/\n/g, ' ').trim();
  bot.chat(`/${cmd} ${username} ${safeText}`);
}

module.exports = { sendPrivateMessage };
