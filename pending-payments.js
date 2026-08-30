/**
 * Synchronisiert offene Zahlungscodes von der Website-API.
 * Bot erkennt Zahlungen zuverlässiger per Code + IGN + Betrag.
 */

const pendingByCode = new Map();
const pendingByPlayer = new Map();

function cacheKey(ign, amount) {
  return `${(ign || '').toLowerCase()}:${parseFloat(amount)}`;
}

function storePending(rows) {
  pendingByCode.clear();
  pendingByPlayer.clear();
  for (const row of rows) {
    const entry = {
      payment_code: row.payment_code,
      ign: row.ign,
      amount: parseFloat(row.amount),
      order_id: row.order_id,
    };
    pendingByCode.set(row.payment_code, entry);
    pendingByCode.set(row.payment_code.toUpperCase(), entry);
    pendingByPlayer.set(cacheKey(row.ign, row.amount), entry);
    pendingByPlayer.set(row.ign.toLowerCase(), entry);
  }
}

async function fetchPending(config) {
  try {
    const res = await fetch(`${config.apiUrl}/api/bot/payments/pending`, {
      headers: { 'X-Bot-Api-Key': config.apiKey },
    });
    if (!res.ok) {
      console.warn('[Pending] API Fehler:', res.status);
      return;
    }
    const rows = await res.json();
    storePending(Array.isArray(rows) ? rows : []);
    if (rows.length) {
      console.log(`[Pending] ${rows.length} offene Zahlung(en) von Website`);
    }
  } catch (err) {
    console.warn('[Pending] Sync fehlgeschlagen:', err.message);
  }
}

function registerPendingSync(bot, config) {
  fetchPending(config);
  setInterval(() => fetchPending(config), 20000);
}

function registerPlayerCode(ign, paymentCode) {
  const code = paymentCode.toUpperCase();
  const entry = pendingByCode.get(code);
  if (entry) {
    pendingByPlayer.set(ign.toLowerCase(), entry);
    pendingByPlayer.set(cacheKey(ign, entry.amount), entry);
    return entry;
  }
  const manual = { payment_code: code, ign, amount: null };
  pendingByPlayer.set(ign.toLowerCase(), manual);
  return manual;
}

function resolvePaymentCode(ign, amount) {
  const byAmount = pendingByPlayer.get(cacheKey(ign, amount));
  if (byAmount?.payment_code) return byAmount.payment_code;

  const byIgn = pendingByPlayer.get(ign.toLowerCase());
  if (byIgn?.payment_code) {
    if (byIgn.amount == null || Math.abs(byIgn.amount - amount) < 0.01) {
      return byIgn.payment_code;
    }
  }
  return null;
}

module.exports = {
  registerPendingSync,
  registerPlayerCode,
  resolvePaymentCode,
  fetchPending,
};
