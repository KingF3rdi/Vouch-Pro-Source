'use client';

import { useEffect, useRef, useState } from 'react';

const HIDE_AFTER_PX = 72;
const TOP_REVEAL_PX = 16;

/**
 * Header bleibt beim Runterscrollen kurz am Rand, verschwindet danach.
 * Beim Hochscrollen erscheint er wieder.
 */
export function useScrollHeader() {
  const [visible, setVisible] = useState(true);
  const [atTop, setAtTop] = useState(true);
  const lastY = useRef(0);
  const downAccum = useRef(0);

  useEffect(() => {
    lastY.current = window.scrollY;
    setAtTop(window.scrollY <= TOP_REVEAL_PX);

    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - lastY.current;

      setAtTop(y <= TOP_REVEAL_PX);

      if (y <= TOP_REVEAL_PX) {
        setVisible(true);
        downAccum.current = 0;
      } else if (delta > 0) {
        downAccum.current += delta;
        if (downAccum.current >= HIDE_AFTER_PX) {
          setVisible(false);
        }
      } else if (delta < 0) {
        downAccum.current = 0;
        setVisible(true);
      }

      lastY.current = y;
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return { visible, atTop };
}
