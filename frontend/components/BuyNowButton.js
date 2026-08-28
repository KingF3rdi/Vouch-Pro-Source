'use client';

import { useRouter } from 'next/navigation';
import { useCart } from '../lib/cartContext';

export default function BuyNowButton({
  product,
  className = 'btn btn-glass',
  label = 'Jetzt kaufen',
}) {
  const { addItem } = useCart();
  const router = useRouter();

  function handleClick() {
    addItem(product);
    router.push('/cart');
  }

  return (
    <button type="button" className={className} onClick={handleClick}>
      {label}
    </button>
  );
}
