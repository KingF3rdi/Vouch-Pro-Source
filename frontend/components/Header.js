'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import DiscordJoinButton from './DiscordJoinButton';
import HeaderSearch from './HeaderSearch';
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

        <HeaderSearch />

        <nav className="nav nav--compact">
          <Link href="/wishlist" className="nav-link">Wunschliste</Link>
          <Link href="/account" className="nav-link">Profil</Link>
          <Link href="/wishlist" className="nav-icon-link nav-icon-link--hide-desktop" aria-label="Wunschliste">
            ♡
          </Link>
          <Link href="/account" className="nav-icon-link nav-icon-link--hide-desktop" aria-label="Profil">
            👤
          </Link>
          <DiscordJoinButton className="btn btn-sm btn-outline-glass nav-discord" />
          {user ? (
            <span className="user-badge">
              {user.connection_type === 'discord' || user.connection_type === 'both' ? (
                <span>💬</span>
              ) : (
                <span>⛏️</span>
              )}
              <span className="user-badge-name">{user.display_name}</span>
            </span>
          ) : (
            <Link href="/account" className="btn btn-sm btn-outline-glass">Anmelden</Link>
          )}
        </nav>
      </div>
    </header>
  );
}
