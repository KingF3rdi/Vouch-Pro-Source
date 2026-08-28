'use client';

import { useState } from 'react';
import { useCart } from '../lib/cartContext';

export default function AddToCartButton({
  product,
  className = 'btn btn-outline-glass btn-sm',
  label = 'In den Warenkorb',
}) {
  const { addItem } = useCart();
  const [feedback, setFeedback] = useState('');

  function handleClick(e) {
    e.preventDefault();
    e.stopPropagation();
    const result = addItem(product);
    if (result.added) {
      setFeedback('Im Warenkorb');
      setTimeout(() => setFeedback(''), 2000);
    } else if (result.reason === 'duplicate') {
      setFeedback('Bereits drin');
      setTimeout(() => setFeedback(''), 2000);
    }
  }

  return (
    <button type="button" className={className} onClick={handleClick}>
      {feedback || label}
    </button>
  );
}
