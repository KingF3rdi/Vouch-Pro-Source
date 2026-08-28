'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const CART_KEY = 'txtempire_cart';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CART_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setItems(parsed);
      }
    } catch {
      localStorage.removeItem(CART_KEY);
    }
    setReady(true);
  }, []);

  const persist = useCallback((next) => {
    setItems(next);
    localStorage.setItem(CART_KEY, JSON.stringify(next));
  }, []);

  const addItem = useCallback(
    (product) => {
      if (!product?.id) return { added: false, reason: 'invalid' };
      const exists = items.some((i) => i.id === product.id);
      if (exists) return { added: false, reason: 'duplicate' };
      const entry = {
        id: product.id,
        slug: product.slug,
        name: product.name,
        price: product.price,
        preview_url: product.preview_url || null,
      };
      persist([...items, entry]);
      return { added: true };
    },
    [items, persist]
  );

  const removeItem = useCallback(
    (productId) => {
      persist(items.filter((i) => i.id !== productId));
    },
    [items, persist]
  );

  const clearCart = useCallback(() => {
    persist([]);
  }, [persist]);

  const total = useMemo(() => items.reduce((sum, i) => sum + i.price, 0), [items]);

  const value = useMemo(
    () => ({
      items,
      ready,
      count: items.length,
      total,
      addItem,
      removeItem,
      clearCart,
    }),
    [items, ready, total, addItem, removeItem, clearCart]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error('useCart must be used within CartProvider');
  }
  return ctx;
}
