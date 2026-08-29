/**
 * Ingame-Anmeldung / IGN-Verknüpfung per Code.
 *
 * Spieler-Befehle (öffentlicher Chat oder Whisper an den Bot):
 *   !shop link ABCD12
 *   !link ABCD12
 *   link ABCD12
 */

const LINK_PATTERNS = [
  /^(?:!shop\s+)?link\s+([A-Z0-9]{4,12})$/i,
  /^verknüpf(?:en)?\s+([A-Z0-9]{4,12})$/i,
  /^anmelden\s+([A-Z0-9]{4,12})$/i,
];

const WHISPER_SENDER_PATTERNS = [
  /^(\w+)\s+whispers(?:\s+to you)?:\s*(.+)$/i,
  /^(\w+)\s*->\s*you:\s*(.+)$/i,
  /^(\w+)\s+flüstert(?:\s+dir)?:\s*(.+)$/i,
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

function parseWhisper(message) {
  const clean = stripColors(message);
  for (const pattern of WHISPER_SENDER_PATTERNS) {
    const match = clean.match(pattern);
    if (match) {
      return { username: match[1], text: match[2].trim() };
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
      bot.chat(
        `/tell ${username} Verknüpfung erfolgreich! ${label} (${result.ign}) ist jetzt mit dem Shop verbunden.`
      );
      console.log(`[LinkAuth] OK: ${username} -> ${result.display_name || result.ign}`);
      return;
    }

    const msg = typeof result.message === 'string' ? result.message : 'Ungültiger oder abgelaufener Code.';
    bot.chat(`/tell ${username} ${msg}`);
    console.log(`[LinkAuth] Fehler für ${username}: ${msg}`);
  }

  bot.on('chat', (username, message) => {
    const code = parseLinkCommand(message);
    if (code) handleLink(username, code);
  });

  bot.on('messagestr', (message) => {
    const whisper = parseWhisper(message);
    if (!whisper) return;
    const code = parseLinkCommand(whisper.text);
    if (code) handleLink(whisper.username, code);
  });

  console.log('[LinkAuth] Bereit — Chat: !shop link CODE | Whisper: /msg ' + botName + ' link CODE');
}

module.exports = { registerLinkAuth, parseLinkCommand, redeemLinkCode };
