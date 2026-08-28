'use client';

import { CartProvider } from '../lib/cartContext';

export default function Providers({ children }) {
  return <CartProvider>{children}</CartProvider>;
}
