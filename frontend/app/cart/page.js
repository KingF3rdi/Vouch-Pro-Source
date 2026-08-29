'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '../../components/Header';
import { useCart } from '../../lib/cartContext';
import { api } from '../../lib/api';
import { formatIngamePrice } from '../../lib/formatPrice';

export default function CartPage() {
  const { items, removeItem, clearCart, total } = useCart();
  const [user, setUser] = useState(null);
  const [ign, setIgn] = useState('');
  const [discountCode, setDiscountCode] = useState('');
  const [discountResult, setDiscountResult] = useState(null);
  const [checkoutMode, setCheckoutMode] = useState('ingame');
  const [paymentConfig, setPaymentConfig] = useState(null);
  const [checkoutMsg, setCheckoutMsg] = useState('');
  const [paymentInfo, setPaymentInfo] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.getMe().then(setUser).catch(() => setUser(null));
    api.getPaymentConfig().then(setPaymentConfig).catch(() => null);
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
    if (!ign.trim()) {
      setCheckoutMsg('Bitte Minecraft IGN eingeben.');
      return;
    }
    if (items.length === 0) {
      setCheckoutMsg('Dein Warenkorb ist leer.');
      return;
    }
    if (checkoutMode === 'verified' && !user?.discord_id) {
      setCheckoutMsg('Für verifizierte Zahlung bitte zuerst Discord verbinden (Profil).');
      return;
    }

    setLoading(true);
    setCheckoutMsg('');
    setPaymentInfo(null);
    try {
      const result = await api.createCartOrder(
        items.map((i) => i.id),
        ign.trim(),
        discountResult?.valid ? discountCode : null,
        checkoutMode
      );
      clearCart();

      if (result.checkout_mode === 'ingame' && result.payment_instructions) {
        setPaymentInfo(result.payment_instructions);
        setCheckoutMsg(result.message);
        const me = await api.getMe();
        setUser(me);
      } else if (result.ticket_url) {
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

  const shopOwner = paymentConfig?.shop_owner_ign || paymentConfig?.shop_bot_ign || 'ShopBot';
  const payTotal = formatIngamePrice(getDiscountedTotal());

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
                      <span className="preview-placeholder">📦</span>
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
                <span className="price-large">{payTotal}</span>
              </div>

              <div className="checkout-mode">
                <p className="checkout-field-label">Zahlungsart</p>
                <div className="checkout-mode-options">
                  <button
                    type="button"
                    className={`checkout-mode-btn${checkoutMode === 'ingame' ? ' checkout-mode-btn--active' : ''}`}
                    onClick={() => setCheckoutMode('ingame')}
                  >
                    Ingame zahlen (IGN)
                  </button>
                  <button
                    type="button"
                    className={`checkout-mode-btn${checkoutMode === 'verified' ? ' checkout-mode-btn--active' : ''}`}
                    onClick={() => setCheckoutMode('verified')}
                  >
                    Mit Discord verifizieren
                  </button>
                </div>
                <p className="checkout-field-hint">
                  {checkoutMode === 'ingame'
                    ? 'Nur Minecraft-Name nötig. Zahlung an den Shop-Bot — Download wird automatisch freigeschaltet.'
                    : 'Discord-Ticket mit verifizierter Zahlung über deinen Discord-Account.'}
                </p>
              </div>

              <div className="checkout-field">
                <label className="checkout-field-label">Minecraft IGN</label>
                <input
                  className="form-input checkout-field-input"
                  value={ign}
                  onChange={(e) => setIgn(e.target.value)}
                  placeholder="DeinIngameName"
                  autoComplete="off"
                />
              </div>

              <div className="checkout-field">
                <label className="checkout-field-label">Creator / Rabattcode</label>
                <div className="checkout-field-row">
                  <input
                    className="form-input checkout-field-input"
                    value={discountCode}
                    onChange={(e) => setDiscountCode(e.target.value)}
                    placeholder="CREATOR10"
                    autoComplete="off"
                  />
                  <button type="button" className="btn btn-outline-glass btn-sm" onClick={validateDiscount}>
                    Prüfen
                  </button>
                </div>
                {discountResult && (
                  <p
                    className="checkout-field-feedback"
                    style={{ color: discountResult.valid ? 'var(--accent)' : 'var(--danger)' }}
                  >
                    {discountResult.message}
                  </p>
                )}
              </div>

              <button
                className="btn"
                style={{ width: '100%', marginTop: '1rem' }}
                onClick={handleCheckout}
                disabled={loading}
              >
                {loading
                  ? 'Wird erstellt…'
                  : checkoutMode === 'verified'
                    ? user?.discord_id
                      ? 'Bezahlen & verifizieren (Discord Ticket)'
                      : 'Discord verbinden zum Verifizieren'
                    : 'Bestellung erstellen & ingame zahlen'}
              </button>

              {checkoutMsg && (
                <p style={{ marginTop: '1rem', color: 'var(--accent)', fontSize: '0.9rem' }}>
                  {checkoutMsg}
                </p>
              )}

              {paymentInfo && (
                <div className="payment-instructions glass-card">
                  <h3>Ingame-Zahlung</h3>
                  <p>
                    Zahle <strong>{formatIngamePrice(paymentInfo.total_amount)}</strong> an{' '}
                    <strong>{paymentInfo.shop_owner_ign}</strong>
                  </p>
                  <p className="payment-cmd-hint">
                    Beispiel: <code>/pay {paymentInfo.shop_owner_ign} {paymentInfo.total_amount}</code>
                  </p>
                  <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
                    IGN: <strong>{paymentInfo.ign}</strong> — muss exakt mit deiner Zahlung übereinstimmen.
                  </p>
                  <Link href="/account" className="btn btn-outline-glass" style={{ marginTop: '0.75rem', width: '100%' }}>
                    Zum Profil (Download nach Zahlung)
                  </Link>
                </div>
              )}

              {checkoutMode === 'verified' && !user?.discord_id && (
                <a href="/api/auth/discord/login" className="btn btn-outline-glass" style={{ width: '100%', marginTop: '0.75rem' }}>
                  Discord verbinden
                </a>
              )}
            </div>
          </div>
        )}
      </main>
    </>
  );
}
