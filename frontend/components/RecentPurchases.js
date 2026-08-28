'use client';

import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { formatIngamePrice } from '../lib/formatPrice';

export default function RecentPurchases() {
  const [purchases, setPurchases] = useState([]);

  useEffect(() => {
    api.getRecentPurchases().then(setPurchases).catch(console.error);
  }, []);

  if (!purchases.length) return null;

  return (
    <section className="section">
      <div className="container">
        <div className="glass-panel recent-purchases">
          <div className="section-header" style={{ marginBottom: '1rem' }}>
            <h2>✅ Letzte Käufe</h2>
            <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>Live Kaufbestätigungen</span>
          </div>
          <div className="purchase-feed">
            {purchases.map((p) => (
              <div key={p.order_id} className="purchase-feed-item glass-card">
                <div className="purchase-feed-check">✓</div>
                <div>
                  <div className="purchase-feed-product">{p.product_name}</div>
                  <div className="purchase-feed-buyer">
                    {p.buyer_display} · {formatIngamePrice(p.amount)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
