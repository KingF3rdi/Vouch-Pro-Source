'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '../../components/Header';
import DiscordJoinButton from '../../components/DiscordJoinButton';
import { api } from '../../lib/api';

export default function AccountPage() {
  const [profile, setProfile] = useState(null);
  const [linkCode, setLinkCode] = useState(null);
  const [redeemCode, setRedeemCode] = useState('');
  const [redeemIgn, setRedeemIgn] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    api.getProfile().then(setProfile).catch(() => setProfile(null));
  }, []);

  async function generateIgnCode() {
    const code = await api.generateLinkCode('ign');
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
      <main className="container">
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

          {user?.unlocked_products?.length > 0 && (
            <div className="profile-section">
              <h3>Freigeschaltete Produkte — Kaufbestätigungen ({user.unlocked_products.length})</h3>
              <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                Nach jedem Kauf erscheint eine Bestätigung hier und in Discord.
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
              Noch keine freigeschalteten Produkte. Kaufe ein Pack über Discord-Ticket!
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
          <button className="btn btn-outline-glass" onClick={generateIgnCode} style={{ width: '100%', marginTop: '0.5rem' }}>
            IGN-Verknüpfungscode generieren
          </button>

          {linkCode && (
            <div>
              <div className="link-code">{linkCode.code}</div>
              <p style={{ color: 'var(--muted)', fontSize: '0.85rem', textAlign: 'center' }}>
                Gültig bis {new Date(linkCode.expires_at).toLocaleTimeString('de-DE')}
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
