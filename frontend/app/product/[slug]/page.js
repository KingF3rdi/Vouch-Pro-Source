'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Header from '../../../components/Header';
import ProductCard from '../../../components/ProductCard';
import CategoryBadge from '../../../components/CategoryBadge';
import CategoryDivider from '../../../components/CategoryDivider';
import { api } from '../../../lib/api';
import AddToCartButton from '../../../components/AddToCartButton';
import { formatIngamePrice } from '../../../lib/formatPrice';

export default function ProductPage() {
  const params = useParams();
  const slug = params.slug;
  const [product, setProduct] = useState(null);
  const [similar, setSimilar] = useState([]);
  const [activeMedia, setActiveMedia] = useState(0);
  const [discountCode, setDiscountCode] = useState('');
  const [discountResult, setDiscountResult] = useState(null);
  const [ign, setIgn] = useState('');
  const [user, setUser] = useState(null);
  const [orderMsg, setOrderMsg] = useState('');

  useEffect(() => {
    api.getProduct(slug).then(setProduct).catch(console.error);
    api.getSimilar(slug).then(setSimilar).catch(console.error);
    api.getMe().then((u) => {
      setUser(u);
      if (u?.ign) setIgn(u.ign);
    }).catch(() => {});
  }, [slug]);

  const allMedia = product
    ? [
        ...(product.preview_url ? [{ url: product.preview_url, media_type: 'image' }] : []),
        ...product.media,
      ].slice(0, 5)
    : [];

  async function validateDiscount() {
    const result = await api.validateDiscount(discountCode);
    setDiscountResult(result);
  }

  function getFinalPrice() {
    if (!product) return 0;
    if (discountResult?.valid) {
      return product.price * (1 - discountResult.discount_percent / 100);
    }
    return product.price;
  }

  async function handleOrder() {
    if (!user?.discord_id) {
      setOrderMsg('Bitte zuerst Discord verbinden (Profil), um zu kaufen. Der Bezahlvorgang läuft über ein Discord-Ticket.');
      return;
    }
    if (!ign) {
      setOrderMsg('Bitte IGN eingeben oder im Profil verknüpfen.');
      return;
    }
    try {
      const order = await api.createOrder(product.id, ign, discountResult?.valid ? discountCode : null);
      if (order.ticket_url) {
        setOrderMsg(
          `Ticket geöffnet! Bestellung #${order.id} — ${formatIngamePrice(getFinalPrice())}. Öffne dein Discord-Ticket zur Zahlung.`
        );
        window.open(order.ticket_url, '_blank');
      } else {
        setOrderMsg(order.message || `Bestellung #${order.id} erstellt.`);
      }
    } catch (e) {
      setOrderMsg(e.message);
    }
  }

  async function toggleWishlist() {
    if (!user) {
      setOrderMsg('Bitte zuerst Discord/IGN verknüpfen.');
      return;
    }
    await api.toggleWishlist(product.id);
    setOrderMsg('Wunschliste aktualisiert!');
  }

  if (!product) {
    return (
      <>
        <Header />
        <div className="container" style={{ padding: '3rem', textAlign: 'center' }}>
          Lade Produkt...
        </div>
      </>
    );
  }

  const tags = product.tags.split(',').map((t) => t.trim()).filter(Boolean);

  return (
    <>
      <Header />
      <main className="container main-content main-content--offset">
        <div className="product-detail">
          <div className="glass-panel product-gallery-panel">
            <div className="gallery-main">
              {allMedia.length > 0 ? (
                allMedia[activeMedia]?.media_type === 'video' ? (
                  <video src={allMedia[activeMedia].url} controls autoPlay muted loop />
                ) : (
                  <img src={allMedia[activeMedia]?.url} alt={product.name} />
                )
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: '4rem' }}>📦</div>
              )}
            </div>
            {allMedia.length > 1 && (
              <div className="gallery-thumbs">
                {allMedia.map((m, i) => (
                  <div
                    key={i}
                    className={`gallery-thumb ${i === activeMedia ? 'active' : ''}`}
                    onClick={() => setActiveMedia(i)}
                  >
                    {m.media_type === 'video' ? (
                      <div style={{ background: '#333', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>▶</div>
                    ) : (
                      <img src={m.url} alt="" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="product-info glass-panel product-info-panel">
            <h1>{product.name}</h1>
            {product.category && (
              <CategoryBadge className="tag--category">{product.category.name}</CategoryBadge>
            )}
            <div className="price-large">
              {formatIngamePrice(getFinalPrice())}
              {discountResult?.valid && (
                <span className="price-strikethrough">
                  {formatIngamePrice(product.price)}
                </span>
              )}
            </div>
            <p style={{ color: 'var(--muted)' }}>{product.description}</p>

            {tags.length > 0 && (
              <div className="tags" style={{ marginBottom: '1rem' }}>
                {tags.map((t) => (
                  <span key={t} className="tag">{t}</span>
                ))}
              </div>
            )}

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Creator / Rabatt Code (10%)</label>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.35rem' }}>
                <input
                  className="form-input"
                  style={{ flex: 1, marginBottom: 0 }}
                  value={discountCode}
                  onChange={(e) => setDiscountCode(e.target.value)}
                  placeholder="CREATOR10"
                />
                <button className="btn btn-outline-glass" onClick={validateDiscount}>Prüfen</button>
              </div>
              {discountResult && (
                <p style={{ color: discountResult.valid ? 'var(--accent)' : 'var(--danger)', fontSize: '0.85rem', marginTop: '0.35rem' }}>
                  {discountResult.message}
                </p>
              )}
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Minecraft IGN</label>
              <input
                className="form-input"
                value={ign}
                onChange={(e) => setIgn(e.target.value)}
                placeholder="DeinIngameName"
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button className="btn" onClick={handleOrder}>
                {user?.discord_id ? 'Bezahlen (Discord Ticket)' : 'Discord verbinden zum Kaufen'}
              </button>
              <AddToCartButton product={product} />
              <button className="btn btn-outline-glass" onClick={toggleWishlist}>♥ Wunschliste</button>
            </div>

            {orderMsg && (
              <p style={{ marginTop: '1rem', color: 'var(--accent)', fontSize: '0.9rem' }}>{orderMsg}</p>
            )}

            <p style={{ marginTop: '1rem', fontSize: '0.85rem', color: 'var(--muted)' }}>
              {product.sales_count} Verkäufe · Discord Rolle wird nach Kauf vergeben
            </p>
          </div>
        </div>

        {similar.length > 0 && (
          <section className="section category-suggestions section--category-divided">
            <CategoryDivider label={product.category?.name || 'Kategorie'} />
            <div className="section-header category-glass-panel section-header-panel">
              <div>
                <h2>Ähnliche Produkte</h2>
                {product.category && (
                  <p className="section-subtitle">
                    {product.category.name}
                    {product.tags ? ' · auch passende Tags' : ''}
                  </p>
                )}
              </div>
            </div>
            <div className="product-grid">
              {similar.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        )}
      </main>
    </>
  );
}
