'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '../lib/api';

export default function Header() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    api.getMe().then(setUser).catch(() => setUser(null));
  }, []);

  return (
    <header className="header">
      <div className="container header-inner">
        <Link href="/" className="logo">
          TxTEmpire
        </Link>
        <nav className="nav">
          <Link href="/">Shop</Link>
          <Link href="/search">Suche</Link>
          <Link href="/wishlist">Wunschliste</Link>
          <Link href="/account">Profil</Link>
          {user ? (
            <span className="user-badge">
              {user.connection_type === 'discord' || user.connection_type === 'both' ? (
                <span className="user-badge-icon">💬</span>
              ) : (
                <span className="user-badge-icon">⛏️</span>
              )}
              <span className="user-badge-name">{user.display_name}</span>
              {user.connection_type === 'both' && user.ign && (
                <span className="user-badge-sub">· {user.ign}</span>
              )}
            </span>
          ) : (
            <Link href="/account" className="btn btn-sm btn-outline">Anmelden</Link>
          )}
        </nav>
      </div>
    </header>
  );
}
