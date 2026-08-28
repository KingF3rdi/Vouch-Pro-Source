'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '../../components/Header';
import { useCart } from '../../lib/cartContext';
import { api } from '../../lib/api';
import { formatIngamePrice } from '../../lib/formatPrice';
import OutlineIcon from '../../components/OutlineIcon';

export default function CartPage() {
  const { items, removeItem, clearCart, total } = useCart();
  const [user, setUser] = useState(null);
  const [ign, setIgn] = useState('');
  const [discountCode, setDiscountCode] = useState('');
  const [discountResult, setDiscountResult] = useState(null);
  const [checkoutMsg, setCheckoutMsg] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.getMe().then((u) => {
      setUser(u);
      if (u?.ign) setIgn(u.ign);
    }).catch(() => setUser(null));
  }, []);

  async function validateDiscount() {
    const result = await api.validateDiscount(discountCode);
    setDiscountResult(result);
  }

  function getDiscountedTotal() {
    if (!discountResult?.valid) return total;
    return Math.round(total * (1 - discountResult.discount_percent / 100));
  }

  async function handleCheckout() {
    if (!user?.discord_id) {
      setCheckoutMsg('Bitte zuerst Discord verbinden (Profil), um zu kaufen.');
      return;
    }
    if (!ign.trim()) {
      setCheckoutMsg('Bitte Minecraft IGN eingeben.');
      return;
    }
    if (items.length === 0) {
      setCheckoutMsg('Dein Warenkorb ist leer.');
      return;
    }

    setLoading(true);
    setCheckoutMsg('');
    try {
      const result = await api.createCartOrder(
        items.map((i) => i.id),
        ign.trim(),
        discountResult?.valid ? discountCode : null
      );
      clearCart();
      if (result.ticket_url) {
        setCheckoutMsg(
          `Bestellung erstellt (${result.orders.length} Pack(s), ${formatIngamePrice(result.total_amount)}). Discord-Ticket geöffnet.`
        );
        window.open(result.ticket_url, '_blank');
      } else {
        setCheckoutMsg(result.message || 'Bestellung erstellt.');
      }
    } catch (e) {
      setCheckoutMsg(e.message);
    }
    setLoading(false);
  }

  return (
    <>
      <Header />
      <main className="container main-content main-content--offset">
        <div className="page-header glass-panel page-header-panel">
          <h1>Warenkorb</h1>
          <p className="page-subtitle">
            {items.length === 0
              ? 'Noch keine Packs im Warenkorb'
              : `${items.length} Pack(s) · ${formatIngamePrice(total)}`}
          </p>
        </div>

        {items.length === 0 ? (
          <div className="glass-panel cart-empty-panel">
            <p>Dein Warenkorb ist leer.</p>
            <Link href="/search" className="btn" style={{ marginTop: '1rem' }}>
              Packs entdecken
            </Link>
          </div>
        ) : (
          <div className="cart-layout">
            <div className="cart-items glass-panel">
              {items.map((item) => (
                <div key={item.id} className="cart-item">
                  <Link href={`/product/${item.slug}`} className="cart-item-preview">
                    {item.preview_url ? (
                      <img src={item.preview_url} alt={item.name} />
                    ) : (
                      <OutlineIcon char="□" className="preview-placeholder-icon preview-placeholder-icon--sm" />
                    )}
                  </Link>
                  <div className="cart-item-info">
                    <Link href={`/product/${item.slug}`}>
                      <h3>{item.name}</h3>
                    </Link>
                    <div className="price">{formatIngamePrice(item.price)}</div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-outline-glass btn-sm cart-item-remove"
                    onClick={() => removeItem(item.id)}
                    aria-label="Entfernen"
                  >
                    Entfernen
                  </button>
                </div>
              ))}
              <div className="cart-items-footer">
                <button type="button" className="btn btn-outline-glass btn-sm" onClick={clearCart}>
                  Warenkorb leeren
                </button>
              </div>
            </div>

            <div className="cart-summary glass-panel">
              <h2>Zusammenfassung</h2>
              <div className="cart-summary-row">
                <span>Zwischensumme</span>
                <span>{formatIngamePrice(total)}</span>
              </div>
              {discountResult?.valid && (
                <div className="cart-summary-row cart-summary-discount">
                  <span>Rabatt ({discountResult.discount_percent}%)</span>
                  <span>-{formatIngamePrice(total - getDiscountedTotal())}</span>
                </div>
              )}
              <div className="cart-summary-row cart-summary-total">
                <span>Gesamt</span>
                <span className="price-large">{formatIngamePrice(getDiscountedTotal())}</span>
              </div>

              <div style={{ marginTop: '1rem' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Rabattcode</label>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.35rem' }}>
                  <input
                    className="form-input"
                    style={{ marginBottom: 0, flex: 1 }}
                    value={discountCode}
                    onChange={(e) => setDiscountCode(e.target.value)}
                    placeholder="CREATOR10"
                  />
                  <button className="btn btn-outline-glass btn-sm" onClick={validateDiscount}>
                    Prüfen
                  </button>
                </div>
                {discountResult && (
                  <p
                    style={{
                      color: discountResult.valid ? 'var(--accent)' : 'var(--danger)',
                      fontSize: '0.85rem',
                      marginTop: '0.35rem',
                    }}
                  >
                    {discountResult.message}
                  </p>
                )}
              </div>

              <div style={{ marginTop: '1rem' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Minecraft IGN</label>
                <input
                  className="form-input"
                  value={ign}
                  onChange={(e) => setIgn(e.target.value)}
                  placeholder="DeinIngameName"
                />
              </div>

              <button
                className="btn"
                style={{ width: '100%', marginTop: '1rem' }}
                onClick={handleCheckout}
                disabled={loading}
              >
                {loading
                  ? 'Wird erstellt…'
                  : user?.discord_id
                    ? 'Bezahlen (Discord Ticket)'
                    : 'Discord verbinden zum Kaufen'}
              </button>

              {checkoutMsg && (
                <p style={{ marginTop: '1rem', color: 'var(--accent)', fontSize: '0.9rem' }}>
                  {checkoutMsg}
                </p>
              )}

              <p style={{ marginTop: '1rem', fontSize: '0.8rem', color: 'var(--muted)' }}>
                Bezahlung läuft über ein Discord-Ticket. Alle Packs werden in einem Ticket zusammengefasst.
              </p>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
