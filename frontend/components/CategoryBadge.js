export default function CategoryBadge({ children, className = '' }) {
  return <span className={`category-badge ${className}`.trim()}>{children}</span>;
}
