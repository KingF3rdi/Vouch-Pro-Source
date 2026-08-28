'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '../lib/api';
import DiscordJoinButton from './DiscordJoinButton';

export default function HeroBanner() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.getStats().then(setStats).catch(console.error);
  }, []);

  return (
    <section className="hero-banner">
      <div className="hero-banner__bg" />
      <div className="hero-banner__overlay" />
      <div className="hero-banner__content container">
        <div className="hero-banner__stats glass-panel">
          {stats ? (
            <>
              <div className="hero-stat">
                <span className="hero-stat__label">Verkauft</span>
                <span className="hero-stat__value">{stats.total_sales}</span>
                <span className="hero-stat__unit">Packs</span>
              </div>
              <div className="hero-stat-divider" />
              <div className="hero-stat">
                <span className="hero-stat__label">Umsatz</span>
                <span className="hero-stat__value">{stats.total_revenue.toFixed(0)}</span>
                <span className="hero-stat__unit">€</span>
              </div>
              <div className="hero-stat-divider" />
              <div className="hero-stat">
                <span className="hero-stat__label">Vouches</span>
                <span className="hero-stat__value">{stats.total_vouches}</span>
                <span className="hero-stat__unit">Community</span>
              </div>
            </>
          ) : (
            <p className="hero-stat__label">TxTEmpire Shop</p>
          )}
        </div>

        <div className="hero-banner__actions">
          <Link href="/search" className="btn btn-glass">
            Packs entdecken
          </Link>
          <Link href="/account" className="btn btn-outline-glass">
            Profil verbinden
          </Link>
          <DiscordJoinButton />
        </div>
      </div>
    </section>
  );
}
