import Link from 'next/link';
import { formatIngamePrice } from '../lib/formatPrice';

export default function ProductCard({ product }) {
  const tags = product.tags
    ? product.tags.split(',').map((t) => t.trim()).filter(Boolean)
    : [];

  return (
    <Link href={`/product/${product.slug}`} className="product-card glass-card">
      <div className="product-card-image">
        {product.preview_url ? (
          <img src={product.preview_url} alt={product.name} />
        ) : (
          <span className="product-card-placeholder">📦</span>
        )}
        {product.category && (
          <span className="product-card-category">{product.category.name}</span>
        )}
      </div>
      <div className="product-card-body">
        <div className="product-card-top">
          <h3>{product.name}</h3>
          {product.is_new && <span className="badge-new">Neu</span>}
        </div>
        <div className="price">{formatIngamePrice(product.price)}</div>
        <div className="product-card-meta">{product.sales_count} Verkäufe</div>
        {tags.length > 0 && (
          <div className="tags">
            {tags.slice(0, 3).map((tag) => (
              <span key={tag} className="tag">{tag}</span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
