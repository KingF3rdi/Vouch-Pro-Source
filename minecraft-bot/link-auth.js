/**
 * Ingame-Anmeldung / IGN-Verknüpfung per Code.
 *
 * Der Bot ist ein normaler Minecraft-Spieleraccount (mineflayer).
 * Spieler schreiben ihm per Whisper oder öffentlichem Chat:
 *   /msg BotName link ABCD12
 *   !shop link ABCD12
 */

const { sendPrivateMessage } = require('./player-messages');

const LINK_PATTERNS = [
  /^(?:!shop\s+)?link\s+([A-Z0-9]{4,12})$/i,
  /^verknüpf(?:en)?\s+([A-Z0-9]{4,12})$/i,
  /^anmelden\s+([A-Z0-9]{4,12})$/i,
];

function stripColors(text) {
  return text.replace(/\u00a7./g, '').trim();
}

function parseLinkCommand(message) {
  const clean = stripColors(message);
  for (const pattern of LINK_PATTERNS) {
    const match = clean.match(pattern);
    if (match) {
      return match[1].toUpperCase();
    }
  }
  return null;
}

async function redeemLinkCode(config, ign, code) {
  try {
    const res = await fetch(`${config.apiUrl}/api/bot/link/redeem`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Bot-Api-Key': config.apiKey,
      },
      body: JSON.stringify({ code, ign }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, message: data.detail || 'Code konnte nicht eingelöst werden.' };
    }
    return data;
  } catch (err) {
    console.error('[LinkAuth] API-Fehler:', err.message);
    return { success: false, message: 'Shop-API nicht erreichbar.' };
  }
}

function registerLinkAuth(bot, config) {
  const botName = config.username || bot.username;

  async function handleLink(username, code) {
    if (!username || username === botName) return;

    console.log(`[LinkAuth] ${username} löst Code ${code} ein`);
    const result = await redeemLinkCode(config, username, code);

    if (result.success) {
      const label = result.connection_type === 'both' ? 'Discord + Minecraft' : 'Minecraft';
      sendPrivateMessage(
        bot,
        username,
        `Verknüpfung erfolgreich! ${label} (${result.ign}) ist jetzt mit dem Shop verbunden.`,
        config
      );
      console.log(`[LinkAuth] OK: ${username} -> ${result.display_name || result.ign}`);
      return;
    }

    const msg = typeof result.message === 'string' ? result.message : 'Ungültiger oder abgelaufener Code.';
    sendPrivateMessage(bot, username, msg, config);
    console.log(`[LinkAuth] Fehler für ${username}: ${msg}`);
  }

  // Öffentlicher Chat: <Spieler> !shop link CODE
  bot.on('chat', (username, message) => {
    const code = parseLinkCommand(message);
    if (code) handleLink(username, code);
  });

  // Whisper an den Bot-Account: /msg BotName link CODE
  bot.on('whisper', (username, message) => {
    const code = parseLinkCommand(message);
    if (code) handleLink(username, code);
  });

  console.log(
    `[LinkAuth] Bereit (${botName}) — Whisper: /msg ${botName} link CODE | Chat: !shop link CODE`
  );
}

module.exports = { registerLinkAuth, parseLinkCommand, redeemLinkCode };
