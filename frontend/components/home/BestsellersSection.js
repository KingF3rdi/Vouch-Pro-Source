import ProductCard from '../ProductCard';
import ProductGridSkeleton from '../skeletons/ProductGridSkeleton';
import SectionHeaderSkeleton from '../skeletons/SectionHeaderSkeleton';

async function fetchBestsellers() {
  const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const res = await fetch(`${base}/api/products/bestsellers`, { cache: 'no-store' });
  if (!res.ok) return [];
  return res.json();
}

export default async function BestsellersSection() {
  const bestsellers = await fetchBestsellers();

  return (
    <section className="section">
      <div className="container">
        <div className="section-header category-glass-panel section-header-panel">
          <h2>🔥 Bestseller</h2>
        </div>
        <div className="section-surface section-grid-surface">
          <div className="product-grid">
            {bestsellers.length > 0 ? (
              bestsellers.map((p) => <ProductCard key={p.id} product={p} />)
            ) : (
              <p className="glass-card empty-grid-message">
                Noch keine Bestseller — Produkte werden vom Discord Bot synchronisiert.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export function BestsellersSectionSkeleton() {
  return (
    <section className="section">
      <div className="container">
        <SectionHeaderSkeleton />
        <ProductGridSkeleton count={4} />
      </div>
    </section>
  );
}
