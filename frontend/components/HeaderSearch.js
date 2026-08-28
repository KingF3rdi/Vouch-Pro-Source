'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../lib/api';
import OutlineIcon from './OutlineIcon';

export default function HeaderSearch() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState([]);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    api.getCategories().then(setCategories).catch(console.error);
  }, []);

  function handleSubmit(e) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (category) params.set('category', category);
    const qs = params.toString();
    router.push(qs ? `/search?${qs}` : '/search');
    setFocused(false);
  }

  return (
    <form
      className={`header-search${focused ? ' header-search--focused' : ''}`}
      onSubmit={handleSubmit}
    >
      <OutlineIcon char="O" className="header-search-icon-mark" round />
      <input
        type="search"
        className="header-search-input"
        placeholder="Texture Packs suchen…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        aria-label="Suche"
      />
      <select
        className="header-search-select category-filter-select"
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        aria-label="Kategorie"
      >
        <option value="">Alle Kategorien</option>
        {categories.map((c) => (
          <option key={c.id} value={c.slug}>{c.name}</option>
        ))}
      </select>
      <button type="submit" className="header-search-btn" aria-label="Suchen">
        <OutlineIcon char=">" round />
      </button>
    </form>
  );
}
