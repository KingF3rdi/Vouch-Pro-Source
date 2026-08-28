import ProductCardSkeleton from './ProductCardSkeleton';

export default function ProductGridSkeleton({ count = 4 }) {
  return (
    <div className="section-surface section-grid-surface" aria-busy="true" aria-label="Produkte werden geladen">
      <div className="product-grid">
        {Array.from({ length: count }).map((_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
