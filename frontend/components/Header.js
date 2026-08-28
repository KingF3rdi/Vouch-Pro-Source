'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import DiscordJoinButton from './DiscordJoinButton';
import { api } from '../lib/api';

export default function Header({ onHero = false }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    api.getMe().then(setUser).catch(() => setUser(null));
  }, []);

  return (
    <header className={`header${onHero ? ' header--hero' : ''}`}>
      <div className="container header-inner">
        <Link href="/" className="logo">
          TxTEmpire
        </Link>
        <nav className="nav">
          <Link href="/">Shop</Link>
          <Link href="/search">Suche</Link>
          <Link href="/wishlist">Wunschliste</Link>
          <Link href="/account">Profil</Link>
          <DiscordJoinButton className="btn btn-sm btn-outline-glass" />
          {user ? (
            <span className="user-badge">
              {user.connection_type === 'discord' || user.connection_type === 'both' ? (
                <span>💬</span>
              ) : (
                <span>⛏️</span>
              )}
              <span>{user.display_name}</span>
              {user.connection_type === 'both' && user.ign && (
                <span className="user-badge-sub">· {user.ign}</span>
              )}
            </span>
          ) : (
            <Link href="/account" className="btn btn-sm btn-outline-glass">Anmelden</Link>
          )}
        </nav>
      </div>
    </header>
  );
}
