'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Header from '../../components/Header';
import ProductCard from '../../components/ProductCard';
import CategoryBadge from '../../components/CategoryBadge';
import { api } from '../../lib/api';

function SearchContent() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.getCategories().then(setCategories).catch(console.error);
  }, []);

  useEffect(() => {
    const q = searchParams.get('q') || '';
    const cat = searchParams.get('category') || '';
    setQuery(q);
    setCategory(cat);
    runSearch(q, cat);
  }, [searchParams]);

  async function runSearch(q, cat) {
    setLoading(true);
    try {
      const results = await api.searchProducts(q, cat || undefined);
      setProducts(results);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  function handleSubmit(e) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (category) params.set('category', category);
    window.location.href = params.toString() ? `/search?${params.toString()}` : '/search';
  }

  const activeCategory = categories.find((c) => c.slug === category);

  return (
      <main className="container main-content main-content--offset">
        <div className="page-header glass-panel page-header-panel category-glass-panel">
        <h1>Suche</h1>
        <p className="page-subtitle">
          {activeCategory ? (
            <>
              Kategorie: <CategoryBadge>{activeCategory.name}</CategoryBadge>
            </>
          ) : (
            'Finde Texture Packs und mehr'
          )}
        </p>
      </div>

      <form className="search-box glass-panel search-panel" onSubmit={handleSubmit}>
        <input
          placeholder="Name, Tag oder Beschreibung…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="category-filter-select"
        >
          <option value="">Alle Kategorien</option>
          {categories.map((c) => (
            <option key={c.id} value={c.slug}>{c.name}</option>
          ))}
        </select>
        <button type="submit" className="btn">Suchen</button>
      </form>

      <div className="search-results">
        {loading ? (
          <p className="search-empty">Lade Ergebnisse…</p>
        ) : products.length > 0 ? (
          <>
            <p className="search-result-count">{products.length} Ergebnis{products.length !== 1 ? 'se' : ''}</p>
            <div className="product-grid">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </>
        ) : (
          <div className="glass-panel search-empty-panel">
            <p>Keine Produkte gefunden.</p>
            <p className="search-empty-hint">Probiere eine andere Kategorie oder einen anderen Suchbegriff.</p>
          </div>
        )}
      </div>
    </main>
  );
}

export default function SearchPage() {
  return (
    <>
      <Header />
      <Suspense fallback={<div className="container main-content"><p>Lade…</p></div>}>
        <SearchContent />
      </Suspense>
    </>
  );
}
