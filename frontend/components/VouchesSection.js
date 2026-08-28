'use client';

import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export default function VouchesSection() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.getVouches().then(setData).catch(console.error);
  }, []);

  if (!data) return null;

  return (
    <section className="section">
      <div className="container">
        <div className="vouches-section glass-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>Vouches</h2>
            <div className="vouch-count">{data.total}</div>
          </div>
          <p style={{ color: 'var(--muted)', marginTop: '0.5rem', fontSize: '0.9rem' }}>
            Vertrauen unserer Community — synchronisiert vom Discord Bot
          </p>
          <div>
            {data.examples.map((v) => (
              <div key={v.id} className="vouch-item">
                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--muted)' }}>
                  {v.giver_name}
                </div>
                <div>{v.message}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
