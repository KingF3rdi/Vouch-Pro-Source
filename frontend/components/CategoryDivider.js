export default function CategoryDivider({ label }) {
  return (
    <div className="category-divider" role="separator">
      <span className="category-divider__line" />
      {label ? <span className="category-badge category-badge--divider">{label}</span> : null}
      <span className="category-divider__line" />
    </div>
  );
}
