/**
 * Formatiert Ingame-Währung im Minecraft-Stil: k, m, b
 * @param {number} value - Roher Betrag (z.B. 15000 → "15k")
 */
export function formatIngamePrice(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0';

  const trim = (num) => {
    const fixed = num.toFixed(2);
    return fixed.replace(/\.?0+$/, '');
  };

  if (n >= 1e9) return `${trim(n / 1e9)}b`;
  if (n >= 1e6) return `${trim(n / 1e6)}m`;
  if (n >= 1e3) return `${trim(n / 1e3)}k`;
  if (Number.isInteger(n)) return String(n);
  return trim(n);
}
