import ProductCard from '../ProductCard';
import CategoryDivider from '../CategoryDivider';
import ProductGridSkeleton from '../skeletons/ProductGridSkeleton';
import SectionHeaderSkeleton from '../skeletons/SectionHeaderSkeleton';
import CategoryDividerSkeleton from '../skeletons/CategoryDividerSkeleton';

async function fetchNewProducts() {
  const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const res = await fetch(`${base}/api/products/new`, { cache: 'no-store' });
  if (!res.ok) return [];
  return res.json();
}

export default async function NewProductsSection() {
  const newProducts = await fetchNewProducts();

  return (
    <section className="section section--category-divided">
      <div className="container">
        <CategoryDivider label="Texture Packs" />
        <div className="section-header category-glass-panel section-header-panel">
          <h2>✨ Neue Produkte</h2>
        </div>
        <div className="section-surface section-grid-surface">
          <div className="product-grid">
            {newProducts.length > 0 ? (
              newProducts.map((p) => <ProductCard key={p.id} product={p} />)
            ) : (
              <p className="glass-card empty-grid-message">
                Keine neuen Produkte verfügbar.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export function NewProductsSectionSkeleton() {
  return (
    <section className="section section--category-divided">
      <div className="container">
        <CategoryDividerSkeleton />
        <SectionHeaderSkeleton />
        <ProductGridSkeleton count={4} />
      </div>
    </section>
  );
}
