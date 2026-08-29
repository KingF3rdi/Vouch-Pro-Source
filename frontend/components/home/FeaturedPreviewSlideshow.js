'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatIngamePrice } from '../../lib/formatPrice';

const AUTO_INTERVAL_MS = 5000;

export default function FeaturedPreviewSlideshow({ products = [] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [slideDirection, setSlideDirection] = useState(1);

  useEffect(() => {
    setActiveIndex(0);
  }, [products]);

  useEffect(() => {
    if (products.length <= 1) return undefined;

    const timer = setInterval(() => {
      setSlideDirection(1);
      setActiveIndex((current) => (current + 1) % products.length);
    }, AUTO_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [products.length]);

  if (!products.length) return null;

  function goTo(index) {
    if (index === activeIndex) return;
    setSlideDirection(index > activeIndex ? 1 : -1);
    setActiveIndex(index);
  }

  const product = products[activeIndex];
  const categoryName = product.category?.name || 'Pack';

  return (
    <section className="featured-preview" aria-label="Produkt-Vorschau">
      <div className="container">
        <Link href={`/product/${product.slug}`} className="featured-preview__card">
          <div className="featured-preview__frame">
            <div
              className={`featured-preview__slide featured-preview__slide--from-${
                slideDirection > 0 ? 'right' : 'left'
              }`}
              key={`${product.id}-${activeIndex}`}
            >
              {product.preview_url ? (
                <img
                  src={product.preview_url}
                  alt={product.name}
                  className="featured-preview__image"
                />
              ) : (
                <div className="featured-preview__image featured-preview__image--fallback">
                  <span aria-hidden="true">📦</span>
                </div>
              )}
              <div className="featured-preview__shade" />
              <div className="featured-preview__meta">
                <h2 className="featured-preview__name">{product.name}</h2>
                <p className="featured-preview__category">{categoryName}</p>
                <p className="featured-preview__price">{formatIngamePrice(product.price)}</p>
              </div>
            </div>
          </div>
        </Link>

        {products.length > 1 && (
          <div className="featured-preview__dots" role="tablist" aria-label="Vorschau wechseln">
            {products.map((p, i) => (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={i === activeIndex}
                aria-label={`${p.name} anzeigen`}
                className={`featured-preview__dot${i === activeIndex ? ' featured-preview__dot--active' : ''}`}
                onClick={() => goTo(i)}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
