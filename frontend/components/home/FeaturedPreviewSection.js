import FeaturedPreviewSlideshow from './FeaturedPreviewSlideshow';
import SkeletonBlock from '../skeletons/SkeletonBlock';

async function fetchFeaturedProducts() {
  const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const [bestRes, newRes] = await Promise.all([
    fetch(`${base}/api/products/bestsellers`, { cache: 'no-store' }),
    fetch(`${base}/api/products/new`, { cache: 'no-store' }),
  ]);

  const bestsellers = bestRes.ok ? await bestRes.json() : [];
  const newest = newRes.ok ? await newRes.json() : [];

  const seen = new Set();
  const merged = [];
  for (const product of [...bestsellers, ...newest]) {
    if (seen.has(product.id)) continue;
    seen.add(product.id);
    merged.push(product);
    if (merged.length >= 6) break;
  }
  return merged;
}

export default async function FeaturedPreviewSection() {
  const products = await fetchFeaturedProducts();
  if (!products.length) return null;

  return <FeaturedPreviewSlideshow products={products} />;
}

export function FeaturedPreviewSectionSkeleton() {
  return (
    <section className="featured-preview featured-preview--skeleton" aria-hidden="true">
      <div className="container">
        <SkeletonBlock className="featured-preview__card featured-preview__skeleton-card" />
        <div className="featured-preview__dots">
          <SkeletonBlock className="featured-preview__dot featured-preview__dot--skeleton" />
          <SkeletonBlock className="featured-preview__dot featured-preview__dot--skeleton" />
          <SkeletonBlock className="featured-preview__dot featured-preview__dot--skeleton" />
        </div>
      </div>
    </section>
  );
}
