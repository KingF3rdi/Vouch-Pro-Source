import SkeletonBlock from './SkeletonBlock';

export default function HeroStatsSkeleton() {
  return (
    <div className="hero-banner__stats glass-panel hero-stats-skeleton" aria-hidden="true">
      <div className="hero-stat">
        <SkeletonBlock className="skeleton-line skeleton-line--stat-label" />
        <SkeletonBlock className="skeleton-line skeleton-line--stat-value" />
        <SkeletonBlock className="skeleton-line skeleton-line--stat-unit" />
      </div>
      <div className="hero-stat-divider hero-stat-divider--skeleton" />
      <div className="hero-stat">
        <SkeletonBlock className="skeleton-line skeleton-line--stat-label" />
        <SkeletonBlock className="skeleton-line skeleton-line--stat-value" />
        <SkeletonBlock className="skeleton-line skeleton-line--stat-unit" />
      </div>
      <div className="hero-stat-divider hero-stat-divider--skeleton" />
      <div className="hero-stat">
        <SkeletonBlock className="skeleton-line skeleton-line--stat-label" />
        <SkeletonBlock className="skeleton-line skeleton-line--stat-value" />
        <SkeletonBlock className="skeleton-line skeleton-line--stat-unit" />
      </div>
    </div>
  );
}
