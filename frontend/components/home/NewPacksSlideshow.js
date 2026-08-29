'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatIngamePrice } from '../../lib/formatPrice';

const AUTO_INTERVAL_MS = 5000;

export default function NewPacksSlideshow({ products }) {
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

  function goTo(index) {
    if (index === activeIndex) return;
    setSlideDirection(index > activeIndex ? 1 : -1);
    setActiveIndex(index);
  }

  function goPrev() {
    const next = activeIndex === 0 ? products.length - 1 : activeIndex - 1;
    setSlideDirection(-1);
    setActiveIndex(next);
  }

  function goNext() {
    const next = (activeIndex + 1) % products.length;
    setSlideDirection(1);
    setActiveIndex(next);
  }

  if (!products.length) return null;

  const active = products[activeIndex];

  return (
    <section className="section new-packs-slideshow">
      <div className="container">
        <div className="section-header category-glass-panel section-header-panel">
          <h2>🆕 Neueste Packs</h2>
          <p className="section-subtitle">Automatische Vorschau der letzten Releases</p>
        </div>

        <div className="new-packs-slideshow__frame glass-panel">
          <Link
            href={`/product/${active.slug}`}
            className="new-packs-slideshow__viewport pack-preview"
            aria-label={`${active.name} ansehen`}
          >
            <div
              className={`new-packs-slideshow__slide new-packs-slideshow__slide--from-${slideDirection > 0 ? 'right' : 'left'}`}
              key={`${activeIndex}-${active.slug}`}
            >
              {active.preview_url ? (
                <img src={active.preview_url} alt={active.name} />
              ) : (
                <div className="new-packs-slideshow__placeholder">📦</div>
              )}
              <div className="new-packs-slideshow__overlay">
                <div className="new-packs-slideshow__meta">
                  {active.category && (
                    <span className="new-packs-slideshow__category">{active.category.name}</span>
                  )}
                  {active.is_new && <span className="badge-new">Neu</span>}
                </div>
                <h3 className="new-packs-slideshow__title">{active.name}</h3>
                <p className="new-packs-slideshow__price">{formatIngamePrice(active.price)}</p>
              </div>
            </div>
          </Link>

          {products.length > 1 && (
            <>
              <button
                type="button"
                className="new-packs-slideshow__nav new-packs-slideshow__nav--prev"
                onClick={goPrev}
                aria-label="Vorheriges Pack"
              >
                ‹
              </button>
              <button
                type="button"
                className="new-packs-slideshow__nav new-packs-slideshow__nav--next"
                onClick={goNext}
                aria-label="Nächstes Pack"
              >
                ›
              </button>

              <div className="new-packs-slideshow__dots" role="tablist" aria-label="Pack Vorschau">
                {products.map((product, index) => (
                  <button
                    key={product.id}
                    type="button"
                    role="tab"
                    aria-selected={index === activeIndex}
                    aria-label={product.name}
                    className={`new-packs-slideshow__dot ${index === activeIndex ? 'active' : ''}`}
                    onClick={() => goTo(index)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
