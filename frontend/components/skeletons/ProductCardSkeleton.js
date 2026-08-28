import SkeletonBlock from './SkeletonBlock';

export default function ProductCardSkeleton() {
  return (
    <div className="product-card glass-card product-card-wrap product-card-skeleton" aria-hidden="true">
      <div className="product-card-link">
        <SkeletonBlock className="skeleton-product-image" />
        <div className="product-card-body">
          <SkeletonBlock className="skeleton-line skeleton-line--title" />
          <SkeletonBlock className="skeleton-line skeleton-line--price" />
          <SkeletonBlock className="skeleton-line skeleton-line--meta" />
          <div className="skeleton-tags">
            <SkeletonBlock className="skeleton-tag" />
            <SkeletonBlock className="skeleton-tag" />
          </div>
        </div>
      </div>
    </div>
  );
}
