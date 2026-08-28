'use client';

import Link from 'next/link';

export default function Header() {
  return (
    <header className="header">
      <div className="container header-inner">
        <Link href="/" className="logo">
          TxTEmpire
        </Link>
        <nav className="nav">
          <Link href="/">Shop</Link>
          <Link href="/search">Suche</Link>
          <Link href="/wishlist">Wunschliste</Link>
          <Link href="/account">Account</Link>
        </nav>
      </div>
    </header>
  );
}
