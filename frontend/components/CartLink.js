'use client';

import Link from 'next/link';
import { useCart } from '../lib/cartContext';
import OutlineIcon from './OutlineIcon';

export default function CartLink({ className = 'nav-link', iconOnly = false }) {
  const { count, ready } = useCart();

  if (iconOnly) {
    return (
      <Link href="/cart" className="nav-icon-link nav-icon-link--hide-desktop" aria-label="Warenkorb">
        <OutlineIcon char="+" round />
        {ready && count > 0 && <span className="cart-badge cart-badge--outline">{count}</span>}
      </Link>
    );
  }

  return (
    <Link href="/cart" className={`${className} cart-nav-link`}>
      <OutlineIcon char="+" className="icon-outline--inline" />
      Warenkorb
      {ready && count > 0 && <span className="cart-badge cart-badge--inline cart-badge--outline">{count}</span>}
    </Link>
  );
}
