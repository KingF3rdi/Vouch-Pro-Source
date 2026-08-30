import SkeletonBlock from './SkeletonBlock';

export default function ProductDetailSkeleton() {
  return (
    <main className="container main-content main-content--offset" aria-busy="true" aria-label="Produkt wird geladen">
      <div className="product-detail">
        <div className="glass-panel product-gallery-panel product-gallery-skeleton">
          <SkeletonBlock className="skeleton-gallery-main" />
          <div className="gallery-thumbs gallery-thumbs-skeleton">
            {[0, 1, 2].map((i) => (
              <SkeletonBlock key={i} className="skeleton-gallery-thumb" />
            ))}
          </div>
        </div>

        <div className="product-info glass-panel product-info-panel product-info-skeleton">
          <SkeletonBlock className="skeleton-title skeleton-title--lg" />
          <SkeletonBlock className="skeleton-badge-wide" />
          <SkeletonBlock className="skeleton-line skeleton-line--price-lg" />
          <SkeletonBlock className="skeleton-line skeleton-line--body" />
          <SkeletonBlock className="skeleton-line skeleton-line--body" />
          <div className="skeleton-tags">
            <SkeletonBlock className="skeleton-tag" />
            <SkeletonBlock className="skeleton-tag" />
            <SkeletonBlock className="skeleton-tag" />
          </div>
          <SkeletonBlock className="skeleton-line skeleton-line--hint" />
          <div className="product-actions-skeleton">
            <SkeletonBlock className="skeleton-btn" />
            <SkeletonBlock className="skeleton-btn skeleton-btn--outline" />
            <SkeletonBlock className="skeleton-btn skeleton-btn--outline" />
          </div>
        </div>
      </div>
    </main>
  );
}
