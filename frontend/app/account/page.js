'use client';

import { useEffect, useState } from 'react';
import Header from '../../components/Header';
import { api } from '../../lib/api';

export default function AccountPage() {
  const [user, setUser] = useState(null);
  const [linkCode, setLinkCode] = useState(null);
  const [redeemCode, setRedeemCode] = useState('');
  const [redeemIgn, setRedeemIgn] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    api.getMe().then(setUser).catch(() => setUser(null));
  }, []);

  async function generateIgnCode() {
    const code = await api.generateLinkCode('ign');
    setLinkCode(code);
  }

  async function redeemCodeHandler() {
    try {
      const u = await api.redeemLinkCode(redeemCode, redeemIgn, user?.discord_id);
      setUser(u);
      setMessage('Account erfolgreich verknüpft!');
    } catch (e) {
      setMessage(e.message);
    }
  }

  return (
    <>
      <Header />
      <main className="container">
        <div className="account-card">
          <h2>Account verknüpfen</h2>

          {user?.discord_id && (
            <p style={{ color: 'var(--accent)', marginBottom: '1rem' }}>
              ✓ Discord verbunden {user.ign && `· IGN: ${user.ign}`}
            </p>
          )}

          <h3 style={{ marginTop: '1.5rem', marginBottom: '0.5rem' }}>Discord verbinden</h3>
          <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
            Verbinde Discord, um deinen IGN automatisch auf der Website zu haben und Wunschlisten-Benachrichtigungen per DM zu erhalten.
          </p>
          <a href="/api/auth/discord/login" className="btn" style={{ width: '100%' }}>
            Mit Discord verbinden
          </a>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '1.5rem 0' }} />

          <h3 style={{ marginBottom: '0.5rem' }}>IGN per Code verknüpfen</h3>
          <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
            Wie beim Discord Bot: Code generieren und ingame oder auf der Website einlösen.
          </p>

          <button className="btn btn-outline" onClick={generateIgnCode} style={{ width: '100%' }}>
            IGN-Verknüpfungscode generieren
          </button>

          {linkCode && (
            <div>
              <div className="link-code">{linkCode.code}</div>
              <p style={{ color: 'var(--muted)', fontSize: '0.85rem', textAlign: 'center' }}>
                Gültig bis {new Date(linkCode.expires_at).toLocaleTimeString('de-DE')}
              </p>
              <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                Gib diesen Code auf der Website ein oder nutze ihn im Discord Bot: <code>+linkign [code] [ign]</code>
              </p>
            </div>
          )}

          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '1.5rem 0' }} />

          <h3 style={{ marginBottom: '0.5rem' }}>Code einlösen</h3>
          <div style={{ marginBottom: '0.75rem' }}>
            <input
              style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '12px', padding: '0.75rem', color: 'var(--text)' }}
              placeholder="Verknüpfungscode"
              value={redeemCode}
              onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
            />
          </div>
          <div style={{ marginBottom: '0.75rem' }}>
            <input
              style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '12px', padding: '0.75rem', color: 'var(--text)' }}
              placeholder="Dein Minecraft IGN"
              value={redeemIgn}
              onChange={(e) => setRedeemIgn(e.target.value)}
            />
          </div>
          <button className="btn" onClick={redeemCodeHandler} style={{ width: '100%' }}>
            Code einlösen
          </button>

          {message && (
            <p style={{ marginTop: '1rem', color: 'var(--accent)' }}>{message}</p>
          )}
        </div>
      </main>
    </>
  );
}
