import './globals.css';
import Header from '../components/Header';
import HeroBanner from '../components/HeroBanner';
import VouchesSection from '../components/VouchesSection';
import RecentPurchases from '../components/RecentPurchases';
import ProductCard from '../components/ProductCard';

async function getData() {
  const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const [bestsellers, newProducts] = await Promise.all([
    fetch(`${base}/api/products/bestsellers`, { cache: 'no-store' }).then((r) => r.json()),
    fetch(`${base}/api/products/new`, { cache: 'no-store' }).then((r) => r.json()),
  ]);
  return { bestsellers, newProducts };
}

export default async function HomePage() {
  let bestsellers = [];
  let newProducts = [];
  try {
    const data = await getData();
    bestsellers = data.bestsellers;
    newProducts = data.newProducts;
  } catch {
    // Backend nicht erreichbar
  }

  return (
    <>
      <div className="home-hero-wrap">
        <Header onHero />
        <HeroBanner />
      </div>

      <main className="main-content">
        <section className="section">
          <div className="container">
            <div className="section-header">
              <h2>🔥 Bestseller</h2>
            </div>
            <div className="product-grid">
              {bestsellers.length > 0 ? (
                bestsellers.map((p) => <ProductCard key={p.id} product={p} />)
              ) : (
                <p className="glass-card" style={{ padding: '1.5rem', color: 'var(--muted)', gridColumn: '1 / -1' }}>
                  Noch keine Bestseller — Produkte werden vom Discord Bot synchronisiert.
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="section">
          <div className="container">
            <div className="section-header">
              <h2>✨ Neue Produkte</h2>
            </div>
            <div className="product-grid">
              {newProducts.length > 0 ? (
                newProducts.map((p) => <ProductCard key={p.id} product={p} />)
              ) : (
                <p className="glass-card" style={{ padding: '1.5rem', color: 'var(--muted)', gridColumn: '1 / -1' }}>
                  Keine neuen Produkte verfügbar.
                </p>
              )}
            </div>
          </div>
        </section>

        <VouchesSection />
        <RecentPurchases />
      </main>

      <footer className="footer">
        <div className="container">TxTEmpire — Discord & IGN Verknüpfung · Automatische Zahlungen</div>
      </footer>
    </>
  );
}
