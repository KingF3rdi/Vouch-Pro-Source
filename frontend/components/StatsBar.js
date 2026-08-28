'use client';

import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export default function StatsBar() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.getStats().then(setStats).catch(console.error);
  }, []);

  if (!stats) return null;

  return (
    <div className="stats-bar">
      <div className="container">
        Insgesamt verkauft: <strong>{stats.total_sales}</strong> Packs · Umsatz:{' '}
        <strong>{stats.total_revenue.toFixed(2)} €</strong>
      </div>
    </div>
  );
}
