'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Header from '../../../components/Header';
import ProductCard from '../../../components/ProductCard';
import CategoryBadge from '../../../components/CategoryBadge';
import CategoryDivider from '../../../components/CategoryDivider';
import ProductGallery from '../../../components/ProductGallery';
import { api } from '../../../lib/api';
import AddToCartButton from '../../../components/AddToCartButton';
import BuyNowButton from '../../../components/BuyNowButton';
import ProductDetailSkeleton from '../../../components/skeletons/ProductDetailSkeleton';
import { formatIngamePrice } from '../../../lib/formatPrice';

export default function ProductPage() {
  const params = useParams();
  const slug = params.slug;
  const [product, setProduct] = useState(null);
  const [similar, setSimilar] = useState([]);
  const [user, setUser] = useState(null);
  const [orderMsg, setOrderMsg] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setProduct(null);
    setSimilar([]);

    Promise.all([
      api.getProduct(slug).then(setProduct).catch(console.error),
      api.getSimilar(slug).then(setSimilar).catch(console.error),
      api.getMe().then(setUser).catch(() => setUser(null)),
    ]).finally(() => setLoading(false));
  }, [slug]);

  const allMedia = product
    ? [
        ...(product.preview_url ? [{ url: product.preview_url, media_type: 'image' }] : []),
        ...product.media,
      ].slice(0, 5)
    : [];

  async function toggleWishlist() {
    if (!user) {
      setOrderMsg('Bitte zuerst Discord verknüpfen (Profil).');
      return;
    }
    await api.toggleWishlist(product.id);
    setOrderMsg('Wunschliste aktualisiert!');
  }

  if (loading) {
    return (
      <>
        <Header />
        <ProductDetailSkeleton />
      </>
    );
  }

  if (!product) {
    return (
      <>
        <Header />
        <main className="container main-content main-content--offset">
          <div className="glass-panel cart-empty-panel">
            <p>Produkt nicht gefunden.</p>
          </div>
        </main>
      </>
    );
  }

  const tags = product.tags.split(',').map((t) => t.trim()).filter(Boolean);

  return (
    <>
      <Header />
      <main className="container main-content main-content--offset">
        <div className="product-detail">
          <ProductGallery media={allMedia} productName={product.name} />

          <div className="product-info glass-panel product-info-panel">
            <h1>{product.name}</h1>
            {product.category && (
              <CategoryBadge className="tag--category">{product.category.name}</CategoryBadge>
            )}
            <div className="price-large">{formatIngamePrice(product.price)}</div>
            <p style={{ color: 'var(--muted)' }}>{product.description}</p>

            {tags.length > 0 && (
              <div className="tags" style={{ marginBottom: '1rem' }}>
                {tags.map((t) => (
                  <span key={t} className="tag">{t}</span>
                ))}
              </div>
            )}

            <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '1rem' }}>
              Ingame zahlen mit IGN oder mit Discord verifizieren — beides an der Kasse.
            </p>

            <div className="product-detail-actions">
              <AddToCartButton product={product} className="btn" label="In den Warenkorb" />
              <BuyNowButton product={product} label="Jetzt kaufen" />
              <button type="button" className="btn btn-outline-glass" onClick={toggleWishlist}>
                ♥ Wunschliste
              </button>
            </div>

            {orderMsg && (
              <p style={{ marginTop: '1rem', color: 'var(--accent)', fontSize: '0.9rem' }}>{orderMsg}</p>
            )}

            <p style={{ marginTop: '1rem', fontSize: '0.85rem', color: 'var(--muted)' }}>
              {product.sales_count} Verkäufe · Download im Profil nach Zahlung
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
