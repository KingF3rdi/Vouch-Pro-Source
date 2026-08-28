import Link from 'next/link';

export default function ProductCard({ product }) {
  const tags = product.tags
    ? product.tags.split(',').map((t) => t.trim()).filter(Boolean)
    : [];

  return (
    <Link href={`/product/${product.slug}`} className="product-card">
      <div className="product-card-image">
        {product.preview_url ? (
          <img src={product.preview_url} alt={product.name} />
        ) : (
          <span>📦</span>
        )}
      </div>
      <div className="product-card-body">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
          <h3>{product.name}</h3>
          {product.is_new && <span className="badge-new">Neu</span>}
        </div>
        <div className="price">{product.price.toFixed(2)} €</div>
        <div style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>
          {product.sales_count} Verkäufe
        </div>
        {tags.length > 0 && (
          <div className="tags">
            {tags.slice(0, 3).map((tag) => (
              <span key={tag} className="tag">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
