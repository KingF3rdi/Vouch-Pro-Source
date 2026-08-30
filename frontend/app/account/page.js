'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '../../components/Header';
import DiscordJoinButton from '../../components/DiscordJoinButton';
import { api } from '../../lib/api';

export default function AccountPage() {
  const [profile, setProfile] = useState(null);
  const [orders, setOrders] = useState([]);
  const [linkCode, setLinkCode] = useState(null);
  const [botIgn, setBotIgn] = useState('ShopBot');
  const [redeemCode, setRedeemCode] = useState('');
  const [redeemIgn, setRedeemIgn] = useState('');
  const [message, setMessage] = useState('');
  const [pendingVouches, setPendingVouches] = useState([]);
  const [vouchForms, setVouchForms] = useState({});
  const [vouchLoading, setVouchLoading] = useState(null);

  useEffect(() => {
    loadProfile();
    api.getPaymentConfig().then((cfg) => {
      if (cfg?.shop_bot_ign) setBotIgn(cfg.shop_bot_ign);
    }).catch(() => {});
  }, []);

  async function loadProfile() {
    try {
      const p = await api.getProfile();
      setProfile(p);
      const o = await api.getOrders();
      setOrders(o);
      if (p) {
        const pending = await api.getPendingVouches().catch(() => []);
        setPendingVouches(pending);
      } else {
        setPendingVouches([]);
      }
    } catch {
      setProfile(null);
      setOrders([]);
      setPendingVouches([]);
    }
  }

  async function submitVouch(orderId) {
    const form = vouchForms[orderId] || { rating: 5, message: '' };
    if (!form.message.trim()) {
      setMessage('Bitte einen Vouch-Text eingeben.');
      return;
    }
    setVouchLoading(orderId);
    setMessage('');
    try {
      await api.submitVouch(orderId, form.rating, form.message.trim());
      setMessage('Vouch gesendet — danke!');
      await loadProfile();
    } catch (e) {
      setMessage(e.message);
    } finally {
      setVouchLoading(null);
    }
  }

  function updateVouchForm(orderId, field, value) {
    setVouchForms((prev) => ({
      ...prev,
      [orderId]: { rating: 5, message: '', ...prev[orderId], [field]: value },
    }));
  }

  async function generateIgnCode() {
    const codeType = profile?.discord_id ? 'discord' : 'ign';
    const code = await api.generateLinkCode(codeType);
    setLinkCode(code);
  }

  async function redeemCodeHandler() {
    try {
      await api.redeemLinkCode(redeemCode, redeemIgn, profile?.discord_id);
      const p = await api.getProfile();
      setProfile(p);
      setMessage('Account erfolgreich verknüpft!');
    } catch (e) {
      setMessage(e.message);
    }
  }

  const user = profile;

  return (
    <>
      <Header />
      <main className="container main-content--offset">
        <div className="account-card glass-panel">
          <h2>TxTEmpire Profil</h2>

          {user ? (
            <div className="profile-card-inner glass-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '2rem' }}>
                  {user.connection_type === 'minecraft' ? '⛏️' : '💬'}
                </span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--accent)' }}>
                    {user.display_name}
                  </div>
                  <div style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
                    {user.connection_type === 'both' && `Discord + Minecraft (${user.ign})`}
                    {user.connection_type === 'discord' && 'Verbunden mit Discord'}
                    {user.connection_type === 'minecraft' && `Minecraft: ${user.ign}`}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p style={{ color: 'var(--muted)', marginBottom: '1rem' }}>Nicht angemeldet</p>
          )}

          {orders.some((o) => o.status === 'pending' || o.status === 'ticket_open') && (
            <div className="glass-card profile-orders-panel" style={{ marginTop: '1rem', padding: '1rem' }}>
              <h3>Offene Bestellungen</h3>
              <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                Nach ingame-Zahlung wird der Status automatisch aktualisiert.
              </p>
              {orders
                .filter((o) => o.status === 'pending' || o.status === 'ticket_open')
                .map((o) => (
                  <div key={o.id} className="profile-order-row">
                    <span>{o.product_name}</span>
                    <span style={{ color: 'var(--muted)' }}>{o.status}</span>
                  </div>
                ))}
              <button type="button" className="btn btn-outline-glass btn-sm" style={{ marginTop: '0.75rem' }} onClick={loadProfile}>
                Zahlung prüfen / Profil aktualisieren
              </button>
            </div>
          )}

          {pendingVouches.length > 0 && (
            <div className="glass-card profile-orders-panel vouch-request-panel" style={{ marginTop: '1rem', padding: '1rem' }}>
              <h3>Vouch abgeben</h3>
              <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                Einmalig pro Kauf — alternativ per Discord-DM mit <code>/vouch</code>.
              </p>
              {pendingVouches.map((v) => {
                const form = vouchForms[v.order_id] || { rating: 5, message: '' };
                return (
                  <div key={v.order_id} className="vouch-form-card">
                    <div className="vouch-form-header">
                      <strong>{v.product_name || 'Bestellung'}</strong>
                      <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
                        #{v.order_id} · {v.amount} Coins
                      </span>
                    </div>
                    <div className="vouch-stars">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          className={`vouch-star${form.rating >= star ? ' active' : ''}`}
                          onClick={() => updateVouchForm(v.order_id, 'rating', star)}
                          aria-label={`${star} Sterne`}
                        >
                          ★
                        </button>
                      ))}
                    </div>
                    <textarea
                      className="form-input vouch-message"
                      placeholder="Dein Vouch-Text …"
                      rows={3}
                      value={form.message}
                      onChange={(e) => updateVouchForm(v.order_id, 'message', e.target.value)}
                    />
                    <button
                      type="button"
                      className="btn btn-sm"
                      style={{ width: '100%', marginTop: '0.5rem' }}
                      disabled={vouchLoading === v.order_id}
                      onClick={() => submitVouch(v.order_id)}
                    >
                      {vouchLoading === v.order_id ? 'Wird gesendet …' : 'Vouch absenden'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {user?.unlocked_products?.length > 0 && (
            <div className="profile-section">
              <h3>Freigeschaltete Produkte — Kaufbestätigungen ({user.unlocked_products.length})</h3>
              <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                Downloads sind freigeschaltet — klicke auf ein Pack für Details.
              </p>
              <div className="unlocked-grid">
                {user.unlocked_products.map((item) => (
                  <Link key={item.id} href={`/product/${item.product.slug}`} className="unlocked-item glass-card">
                    <div className="check">✓</div>
                    <div style={{ fontWeight: 600 }}>{item.product.name}</div>
                    <div style={{ color: 'var(--muted)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                      Freigeschaltet
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {user && user.unlocked_products?.length === 0 && (
            <p style={{ color: 'var(--muted)', marginTop: '1rem' }}>
              Noch keine freigeschalteten Downloads. Kaufe ein Pack und zahle ingame — Freischaltung läuft automatisch.
            </p>
          )}

          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '1.5rem 0' }} />

          <h3>Discord verbinden</h3>
          <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
            Für Käufe per Discord-Ticket und Wunschlisten-Benachrichtigungen.
          </p>
          <a href="/api/auth/discord/login" className="btn" style={{ width: '100%', marginBottom: '0.75rem' }}>
            Mit Discord verbinden
          </a>
          <DiscordJoinButton className="btn btn-outline-glass" style={{ width: '100%', display: 'flex' }} />

          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '1.5rem 0' }} />

          <h3>IGN per Code verknüpfen</h3>
          <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
            {profile?.discord_id
              ? `Code generieren und dem Bot-Account schreiben: /msg ${botIgn} link CODE`
              : `Ohne Discord: Code generieren und ingame /msg ${botIgn} link CODE senden.`}
          </p>
          <button className="btn btn-outline-glass" onClick={generateIgnCode} style={{ width: '100%', marginTop: '0.5rem' }}>
            {profile?.discord_id ? 'IGN-Verknüpfungscode generieren' : 'Ingame-Anmeldecode generieren'}
          </button>

          {linkCode && (
            <div>
              <div className="link-code">{linkCode.code}</div>
              <p style={{ color: 'var(--muted)', fontSize: '0.85rem', textAlign: 'center' }}>
                Gültig bis {new Date(linkCode.expires_at).toLocaleTimeString('de-DE')}
              </p>
              <p style={{ color: 'var(--muted)', fontSize: '0.85rem', textAlign: 'center', marginTop: '0.5rem' }}>
                Ingame: <code>/msg {botIgn} link {linkCode.code}</code>
              </p>
            </div>
          )}

          <div style={{ marginTop: '1rem' }}>
            <input className="form-input" placeholder="Verknüpfungscode" value={redeemCode} onChange={(e) => setRedeemCode(e.target.value.toUpperCase())} />
            <input className="form-input" placeholder="Minecraft IGN" value={redeemIgn} onChange={(e) => setRedeemIgn(e.target.value)} />
            <button className="btn" onClick={redeemCodeHandler} style={{ width: '100%' }}>
              Code einlösen
            </button>
          </div>

          {message && (
            <p style={{ marginTop: '1rem', color: 'var(--accent)' }}>{message}</p>
          )}
        </div>
      </main>
    </>
  );
}
