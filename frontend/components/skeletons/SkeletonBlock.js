export default function SkeletonBlock({ className = '', style }) {
  return <span className={`skeleton-block ${className}`.trim()} style={style} aria-hidden="true" />;
}
