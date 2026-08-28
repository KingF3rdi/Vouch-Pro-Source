'use client';

import Link from 'next/link';
import { useCart } from '../lib/cartContext';

export default function CartLink({ className = 'nav-link', iconOnly = false }) {
  const { count, ready } = useCart();

  if (iconOnly) {
    return (
      <Link href="/cart" className="nav-icon-link nav-icon-link--hide-desktop" aria-label="Warenkorb">
        🛒
        {ready && count > 0 && <span className="cart-badge">{count}</span>}
      </Link>
    );
  }

  return (
    <Link href="/cart" className={`${className} cart-nav-link`}>
      Warenkorb
      {ready && count > 0 && <span className="cart-badge cart-badge--inline">{count}</span>}
    </Link>
  );
}
