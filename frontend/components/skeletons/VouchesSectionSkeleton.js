import CategoryDividerSkeleton from './CategoryDividerSkeleton';
import SkeletonBlock from './SkeletonBlock';

export default function VouchesSectionSkeleton() {
  return (
    <section className="section" aria-busy="true" aria-label="Vouches werden geladen">
      <div className="container">
        <CategoryDividerSkeleton />
        <div className="vouches-section category-glass-panel">
          <div className="vouches-skeleton-header">
            <SkeletonBlock className="skeleton-title skeleton-title--sm" />
            <SkeletonBlock className="skeleton-vouch-count" />
          </div>
          <SkeletonBlock className="skeleton-line skeleton-line--subtitle" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="vouch-item vouch-item-skeleton">
              <SkeletonBlock className="skeleton-line skeleton-line--meta" />
              <SkeletonBlock className="skeleton-line skeleton-line--body" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
