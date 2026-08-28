'use client';

import { useEffect, useState } from 'react';
import Header from '../../components/Header';
import ProductCard from '../../components/ProductCard';
import { api } from '../../lib/api';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [tag, setTag] = useState('');
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.getCategories().then(setCategories).catch(console.error);
    search('', '', '');
  }, []);

  async function search(q, cat, t) {
    setLoading(true);
    try {
      const results = await api.searchProducts(q, cat || undefined, t || undefined);
      setProducts(results);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  function handleSubmit(e) {
    e.preventDefault();
    search(query, category, tag);
  }

  return (
    <>
      <Header />
      <main className="container main-content">
        <div className="page-header">
          <h1>Produktsuche</h1>
        </div>
        <form className="search-box" onSubmit={handleSubmit}>
          <input
            placeholder="Suche nach Name, Tag..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Alle Kategorien</option>
            {categories.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
          <input placeholder="Tag filtern" value={tag} onChange={(e) => setTag(e.target.value)} />
          <button type="submit" className="btn">
            Suchen
          </button>
        </form>

        <div style={{ marginTop: '2rem' }}>
          {loading ? (
            <p style={{ color: 'var(--muted)' }}>Lade...</p>
          ) : products.length > 0 ? (
            <div className="product-grid">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '2rem' }}>
              Keine Produkte gefunden.
            </p>
          )}
        </div>
      </main>
    </>
  );
}
