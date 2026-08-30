import SkeletonBlock from './SkeletonBlock';

export default function SectionHeaderSkeleton({ panel = true }) {
  return (
    <div
      className={`section-header section-header-panel${panel ? ' category-glass-panel' : ''}`}
      aria-hidden="true"
    >
      <SkeletonBlock className="skeleton-title" />
    </div>
  );
}
