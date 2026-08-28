'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import DiscordJoinButton from './DiscordJoinButton';
import HeaderSearch from './HeaderSearch';
import CartLink from './CartLink';
import { api } from '../lib/api';
import { useScrollHeader } from '../hooks/useScrollHeader';

export default function Header({ onHero = false }) {
  const [user, setUser] = useState(null);
  const { visible, atTop } = useScrollHeader();

  useEffect(() => {
    api.getMe().then(setUser).catch(() => setUser(null));
  }, []);

  const heroOverlay = onHero && atTop;
  const classes = [
    'header',
    'header--fixed',
    heroOverlay ? 'header--hero' : '',
    visible ? 'header--visible' : 'header--hidden',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <header className={classes}>
      <div className="container header-inner">
        <Link href="/" className="logo">
          TxTEmpire
        </Link>

        <HeaderSearch />

        <nav className="nav nav--compact">
          <CartLink />
          <Link href="/wishlist" className="nav-link">Wunschliste</Link>
          {user?.is_admin && (
            <Link href="/admin" className="nav-link">Admin</Link>
          )}
          <Link href="/account" className="nav-link">Profil</Link>
          <CartLink iconOnly />
          <Link href="/wishlist" className="nav-icon-link nav-icon-link--hide-desktop" aria-label="Wunschliste">
            <span className="nav-icon-label">Liste</span>
          </Link>
          <Link href="/account" className="nav-icon-link nav-icon-link--hide-desktop" aria-label="Profil">
            <span className="nav-icon-label">Profil</span>
          </Link>
          <DiscordJoinButton className="btn btn-sm btn-outline-glass nav-discord" />
          {user ? (
            <span className="user-badge">
              <span className="user-badge-type">
                {user.connection_type === 'discord' || user.connection_type === 'both' ? 'DC' : 'MC'}
              </span>
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
