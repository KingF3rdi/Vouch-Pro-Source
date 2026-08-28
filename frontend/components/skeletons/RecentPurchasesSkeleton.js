import CategoryDividerSkeleton from './CategoryDividerSkeleton';
import SkeletonBlock from './SkeletonBlock';

export default function RecentPurchasesSkeleton() {
  return (
    <section className="section section--category-divided" aria-busy="true" aria-label="Käufe werden geladen">
      <div className="container">
        <CategoryDividerSkeleton />
        <div className="glass-panel recent-purchases">
          <div className="section-header recent-purchases-skeleton-header">
            <SkeletonBlock className="skeleton-title skeleton-title--sm" />
            <SkeletonBlock className="skeleton-line skeleton-line--meta" />
          </div>
          <div className="purchase-feed">
            {[0, 1, 2].map((i) => (
              <div key={i} className="purchase-feed-item glass-card purchase-feed-skeleton">
                <SkeletonBlock className="skeleton-check" />
                <div className="purchase-feed-skeleton-body">
                  <SkeletonBlock className="skeleton-line skeleton-line--title" />
                  <SkeletonBlock className="skeleton-line skeleton-line--meta" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
