import SkeletonBlock from './SkeletonBlock';

export default function CategoryDividerSkeleton() {
  return (
    <div className="category-divider skeleton-divider" aria-hidden="true">
      <SkeletonBlock className="skeleton-divider__line" />
      <SkeletonBlock className="skeleton-badge" />
      <SkeletonBlock className="skeleton-divider__line" />
    </div>
  );
}
