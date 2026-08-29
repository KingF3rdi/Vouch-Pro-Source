'use client';

import { useEffect, useState } from 'react';

export default function ProductGallery({ media, productName }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [slideDirection, setSlideDirection] = useState(1);

  useEffect(() => {
    setActiveIndex(0);
  }, [media]);

  useEffect(() => {
    if (media.length <= 1) return undefined;

    const timer = setInterval(() => {
      setSlideDirection(1);
      setActiveIndex((current) => (current + 1) % media.length);
    }, 4500);

    return () => clearInterval(timer);
  }, [media.length]);

  function selectMedia(index) {
    if (index === activeIndex) return;
    setSlideDirection(index > activeIndex ? 1 : -1);
    setActiveIndex(index);
  }

  if (media.length === 0) {
    return (
      <div className="glass-panel product-gallery-panel">
        <div className="gallery-main">
          <div className="preview-placeholder">📦</div>
        </div>
      </div>
    );
  }

  const active = media[activeIndex];

  return (
    <div className="glass-panel product-gallery-panel">
      <div className="gallery-main gallery-main--carousel">
        <div
          className={`gallery-slide gallery-slide--from-${slideDirection > 0 ? 'right' : 'left'}`}
          key={`${activeIndex}-${active.url}`}
        >
          {active.media_type === 'video' ? (
            <video src={active.url} controls autoPlay muted loop />
          ) : (
            <img src={active.url} alt={productName} />
          )}
        </div>
      </div>

      {media.length > 1 && (
        <div className="gallery-thumbs gallery-thumbs--carousel">
          {media.map((m, i) => (
            <button
              type="button"
              key={`${m.url}-${i}`}
              className={`gallery-thumb ${i === activeIndex ? 'active' : ''}`}
              onClick={() => selectMedia(i)}
              aria-label={`Vorschau ${i + 1}`}
            >
              {m.media_type === 'video' ? (
                <div className="gallery-thumb-video">▶</div>
              ) : (
                <img src={m.url} alt="" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
