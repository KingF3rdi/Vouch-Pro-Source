'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '../../components/Header';
import { api } from '../../lib/api';

export default function WishlistPage() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .getWishlist()
      .then(setItems)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <>
      <Header />
      <main className="container main-content">
        <div className="page-header">
          <h1>Wunschliste</h1>
        </div>

        {error && (
          <div className="account-card glass-panel">
            <p>{error}</p>
            <Link href="/account" className="btn" style={{ marginTop: '1rem' }}>
              Account verknüpfen
            </Link>
          </div>
        )}

        {!error && items.length === 0 && (
          <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '2rem' }}>
            Deine Wunschliste ist leer.
          </p>
        )}

        {!error && items.length > 0 && (
          <div className="product-grid">
            {items.map((item) => (
              <Link key={item.id} href={`/product/${item.product.slug}`} className="product-card glass-card">
                <div className="product-card-image">
                  {item.product.preview_url ? (
                    <img src={item.product.preview_url} alt={item.product.name} />
                  ) : (
                    <span>📦</span>
                  )}
                </div>
                <div className="product-card-body">
                  <h3>{item.product.name}</h3>
                  <div className="price">{item.product.price.toFixed(2)} €</div>
                  {item.price_changed && (
                    <p style={{ color: 'var(--gold)', fontSize: '0.85rem' }}>
                      Preis geändert! (war {item.price_at_add.toFixed(2)} €)
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
