'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '../../components/Header';
import { api } from '../../lib/api';
import { formatIngamePrice } from '../../lib/formatPrice';

const TABS = [
  { id: 'packs', label: 'Packs' },
  { id: 'codes', label: 'Creator Codes' },
  { id: 'categories', label: 'Kategorien' },
];

export default function AdminPage() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState('packs');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [codes, setCodes] = useState([]);

  const [packForm, setPackForm] = useState({
    name: '',
    description: '',
    price: '',
    preview_url: '',
    discord_role_id: '',
    category_slug: '',
    tags: '',
    is_new: true,
    media_urls: '',
  });

  const [codeForm, setCodeForm] = useState({
    code: '',
    discount_percent: '10',
    creator_name: '',
    creator_discord_id: '',
  });

  const [categoryForm, setCategoryForm] = useState({ name: '', slug: '' });

  useEffect(() => {
    api.getMe().then(setUser).catch(() => setUser(null));
  }, []);

  useEffect(() => {
    if (!user?.is_admin) return;
    loadData();
  }, [user, tab]);

  async function loadData() {
    setError('');
    try {
      if (tab === 'packs') {
        const [prods, cats] = await Promise.all([
          api.adminListProducts(),
          api.adminListCategories(),
        ]);
        setProducts(prods);
        setCategories(cats);
      } else if (tab === 'codes') {
        setCodes(await api.adminListDiscountCodes());
      } else if (tab === 'categories') {
        setCategories(await api.adminListCategories());
      }
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleCreatePack(e) {
    e.preventDefault();
    setMessage('');
    setError('');
    try {
      const media_urls = packForm.media_urls
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 5);

      await api.adminCreateProduct({
        name: packForm.name.trim(),
        description: packForm.description.trim(),
        price: Number(packForm.price),
        preview_url: packForm.preview_url.trim() || null,
        discord_role_id: packForm.discord_role_id.trim() || null,
        category_slug: packForm.category_slug || null,
        tags: packForm.tags.trim(),
        is_new: packForm.is_new,
        media_urls,
      });
      setMessage('Pack erfolgreich hinzugefügt!');
      setPackForm({
        name: '',
        description: '',
        price: '',
        preview_url: '',
        discord_role_id: '',
        category_slug: '',
        tags: '',
        is_new: true,
        media_urls: '',
      });
      loadData();
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleDeactivatePack(id) {
    if (!confirm('Pack wirklich deaktivieren?')) return;
    try {
      await api.adminDeactivateProduct(id);
      setMessage('Pack deaktiviert.');
      loadData();
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleCreateCode(e) {
    e.preventDefault();
    setMessage('');
    setError('');
    try {
      await api.adminCreateDiscountCode({
        code: codeForm.code.trim(),
        discount_percent: Number(codeForm.discount_percent),
        creator_name: codeForm.creator_name.trim() || null,
        creator_discord_id: codeForm.creator_discord_id.trim() || null,
      });
      setMessage('Creator Code erstellt!');
      setCodeForm({ code: '', discount_percent: '10', creator_name: '', creator_discord_id: '' });
      loadData();
    } catch (e) {
      setError(e.message);
    }
  }

  async function toggleCode(code) {
    try {
      await api.adminUpdateDiscountCode(code.id, { is_active: !code.is_active });
      loadData();
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleCreateCategory(e) {
    e.preventDefault();
    setMessage('');
    setError('');
    try {
      await api.adminCreateCategory({
        name: categoryForm.name.trim(),
        slug: categoryForm.slug.trim() || null,
      });
      setMessage('Kategorie erstellt!');
      setCategoryForm({ name: '', slug: '' });
      loadData();
    } catch (e) {
      setError(e.message);
    }
  }

  if (!user) {
    return (
      <>
        <Header />
        <main className="container main-content main-content--offset">
          <div className="account-card glass-panel">
            <h2>Admin Panel</h2>
            <p style={{ color: 'var(--muted)', marginTop: '0.5rem' }}>
              Bitte mit Discord anmelden.
            </p>
            <Link href="/account" className="btn" style={{ marginTop: '1rem' }}>
              Zum Profil
            </Link>
          </div>
        </main>
      </>
    );
  }

  if (!user.is_admin) {
    return (
      <>
        <Header />
        <main className="container main-content main-content--offset">
          <div className="account-card glass-panel">
            <h2>Admin Panel</h2>
            <p style={{ color: 'var(--danger)', marginTop: '0.5rem' }}>
              Keine Berechtigung. Deine Discord-ID muss in ADMIN_DISCORD_IDS eingetragen sein.
            </p>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="container main-content main-content--offset">
        <div className="page-header category-glass-panel page-header-panel">
          <h1>Admin Panel</h1>
          <p className="page-subtitle">Packs, Creator Codes und Kategorien verwalten</p>
        </div>

        <div className="admin-tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`admin-tab${tab === t.id ? ' admin-tab--active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {message && <p className="admin-message admin-message--ok">{message}</p>}
        {error && <p className="admin-message admin-message--err">{error}</p>}

        {tab === 'packs' && (
          <div className="admin-grid">
            <form className="glass-panel admin-form" onSubmit={handleCreatePack}>
              <h2>Neues Pack</h2>
              <input className="form-input" placeholder="Name" value={packForm.name} onChange={(e) => setPackForm({ ...packForm, name: e.target.value })} required />
              <textarea className="form-input admin-textarea" placeholder="Beschreibung" value={packForm.description} onChange={(e) => setPackForm({ ...packForm, description: e.target.value })} rows={3} />
              <input className="form-input" type="number" placeholder="Preis (z.B. 10000)" value={packForm.price} onChange={(e) => setPackForm({ ...packForm, price: e.target.value })} required />
              <input className="form-input" placeholder="Preview URL" value={packForm.preview_url} onChange={(e) => setPackForm({ ...packForm, preview_url: e.target.value })} />
              <input className="form-input" placeholder="Discord Rollen-ID" value={packForm.discord_role_id} onChange={(e) => setPackForm({ ...packForm, discord_role_id: e.target.value })} />
              <select className="form-input" value={packForm.category_slug} onChange={(e) => setPackForm({ ...packForm, category_slug: e.target.value })}>
                <option value="">Keine Kategorie</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.slug}>{c.name}</option>
                ))}
              </select>
              <input className="form-input" placeholder="Tags (comma-separated)" value={packForm.tags} onChange={(e) => setPackForm({ ...packForm, tags: e.target.value })} />
              <textarea className="form-input admin-textarea" placeholder="Media URLs (eine pro Zeile)" value={packForm.media_urls} onChange={(e) => setPackForm({ ...packForm, media_urls: e.target.value })} rows={2} />
              <label className="admin-checkbox">
                <input type="checkbox" checked={packForm.is_new} onChange={(e) => setPackForm({ ...packForm, is_new: e.target.checked })} />
                Als neu markieren
              </label>
              <button type="submit" className="btn">Pack hinzufügen</button>
            </form>

            <div className="glass-panel admin-list">
              <h2>Alle Packs ({products.length})</h2>
              <div className="admin-list-items">
                {products.map((p) => (
                  <div key={p.id} className="admin-list-item">
                    <div>
                      <strong>{p.name}</strong>
                      <div className="admin-list-meta">
                        {formatIngamePrice(p.price)} · {p.is_active ? 'Aktiv' : 'Deaktiviert'}
                        {p.category && ` · ${p.category.name}`}
                      </div>
                    </div>
                    {p.is_active && (
                      <button type="button" className="btn btn-outline-glass btn-sm" onClick={() => handleDeactivatePack(p.id)}>
                        Deaktivieren
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'codes' && (
          <div className="admin-grid">
            <form className="glass-panel admin-form" onSubmit={handleCreateCode}>
              <h2>Neuer Creator Code</h2>
              <input className="form-input" placeholder="Code (z.B. CREATOR10)" value={codeForm.code} onChange={(e) => setCodeForm({ ...codeForm, code: e.target.value })} required />
              <input className="form-input" type="number" min="1" max="100" placeholder="Rabatt %" value={codeForm.discount_percent} onChange={(e) => setCodeForm({ ...codeForm, discount_percent: e.target.value })} required />
              <input className="form-input" placeholder="Creator Name" value={codeForm.creator_name} onChange={(e) => setCodeForm({ ...codeForm, creator_name: e.target.value })} />
              <input className="form-input" placeholder="Creator Discord ID" value={codeForm.creator_discord_id} onChange={(e) => setCodeForm({ ...codeForm, creator_discord_id: e.target.value })} />
              <button type="submit" className="btn">Code erstellen</button>
            </form>

            <div className="glass-panel admin-list">
              <h2>Codes ({codes.length})</h2>
              <div className="admin-list-items">
                {codes.map((c) => (
                  <div key={c.id} className="admin-list-item">
                    <div>
                      <strong>{c.code}</strong>
                      <div className="admin-list-meta">
                        -{c.discount_percent}% · {c.uses} Nutzungen
                        {c.creator_name && ` · ${c.creator_name}`}
                        · {c.is_active ? 'Aktiv' : 'Deaktiviert'}
                      </div>
                    </div>
                    <button type="button" className="btn btn-outline-glass btn-sm" onClick={() => toggleCode(c)}>
                      {c.is_active ? 'Deaktivieren' : 'Aktivieren'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'categories' && (
          <div className="admin-grid">
            <form className="glass-panel admin-form" onSubmit={handleCreateCategory}>
              <h2>Neue Kategorie</h2>
              <input className="form-input" placeholder="Name" value={categoryForm.name} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })} required />
              <input className="form-input" placeholder="Slug (optional)" value={categoryForm.slug} onChange={(e) => setCategoryForm({ ...categoryForm, slug: e.target.value })} />
              <button type="submit" className="btn">Kategorie erstellen</button>
            </form>

            <div className="glass-panel admin-list">
              <h2>Kategorien ({categories.length})</h2>
              <div className="admin-list-items">
                {categories.map((c) => (
                  <div key={c.id} className="admin-list-item">
                    <div>
                      <strong>{c.name}</strong>
                      <div className="admin-list-meta">{c.slug}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
