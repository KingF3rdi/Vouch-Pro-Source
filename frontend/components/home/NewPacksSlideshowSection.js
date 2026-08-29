import NewPacksSlideshow from './NewPacksSlideshow';
import SectionHeaderSkeleton from '../skeletons/SectionHeaderSkeleton';
import SkeletonBlock from '../skeletons/SkeletonBlock';

async function fetchNewProducts() {
  const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const res = await fetch(`${base}/api/products/new`, { cache: 'no-store' });
  if (!res.ok) return [];
  return res.json();
}

export default async function NewPacksSlideshowSection() {
  const products = await fetchNewProducts();
  if (!products.length) return null;

  return <NewPacksSlideshow products={products} />;
}

export function NewPacksSlideshowSkeleton() {
  return (
    <section className="section new-packs-slideshow">
      <div className="container">
        <SectionHeaderSkeleton />
        <div className="new-packs-slideshow__frame glass-panel">
          <SkeletonBlock className="skeleton-slideshow-main" />
        </div>
      </div>
    </section>
  );
}
