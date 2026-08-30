'use client';

import { useEffect, useId, useRef, useState } from 'react';

export default function CategoryFilterDropdown({
  value,
  onChange,
  categories = [],
  variant = 'default',
  ariaLabel = 'Kategorie',
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const listId = useId();

  const selected = categories.find((c) => c.slug === value);
  const triggerLabel =
    variant === 'header' && !selected ? 'Alle' : selected?.name || 'Alle Kategorien';

  useEffect(() => {
    if (!open) return undefined;

    function handlePointerDown(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    }

    function handleKeyDown(e) {
      if (e.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  function pick(slug) {
    onChange(slug);
    setOpen(false);
  }

  return (
    <div
      ref={rootRef}
      className={`category-dropdown category-dropdown--${variant}${open ? ' category-dropdown--open' : ''}`}
    >
      <button
        type="button"
        className="category-dropdown-trigger"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
      >
        <span className="category-dropdown-label">{triggerLabel}</span>
        <svg
          className="category-dropdown-chevron"
          width="12"
          height="12"
          viewBox="0 0 12 12"
          aria-hidden="true"
        >
          <path
            d="M2.5 4.5L6 8l3.5-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <ul
        id={listId}
        className="category-dropdown-menu"
        role="listbox"
        aria-label={ariaLabel}
      >
        <li role="presentation">
          <button
            type="button"
            role="option"
            aria-selected={!value}
            className={`category-dropdown-option${!value ? ' is-active' : ''}`}
            onClick={() => pick('')}
          >
            <span>Alle Kategorien</span>
          </button>
        </li>
        {categories.length > 0 && (
          <li className="category-dropdown-divider" role="presentation" aria-hidden="true" />
        )}
        {categories.map((c) => (
          <li key={c.id} role="presentation">
            <button
              type="button"
              role="option"
              aria-selected={value === c.slug}
              className={`category-dropdown-option${value === c.slug ? ' is-active' : ''}`}
              onClick={() => pick(c.slug)}
            >
              <span className="category-dropdown-option-name">{c.name}</span>
              {c.product_count != null && (
                <span className="category-dropdown-count">{c.product_count}</span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
