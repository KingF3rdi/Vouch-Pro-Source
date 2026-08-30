'use client';

import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { formatIngamePrice } from '../lib/formatPrice';

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
        <strong>{formatIngamePrice(stats.total_revenue)}</strong>
      </div>
    </div>
  );
}
