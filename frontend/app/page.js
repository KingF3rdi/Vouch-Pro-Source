import './globals.css';
import { Suspense } from 'react';
import Header from '../components/Header';
import HeroBanner from '../components/HeroBanner';
import VouchesSection from '../components/VouchesSection';
import RecentPurchases from '../components/RecentPurchases';
import BestsellersSection, { BestsellersSectionSkeleton } from '../components/home/BestsellersSection';
import FeaturedPreviewSection, { FeaturedPreviewSectionSkeleton } from '../components/home/FeaturedPreviewSection';
import CategoriesSection, { CategoriesSectionSkeleton } from '../components/home/CategoriesSection';
import NewProductsSection, { NewProductsSectionSkeleton } from '../components/home/NewProductsSection';

export default function HomePage() {
  return (
    <>
      <div className="home-hero-wrap">
        <Header onHero />
        <HeroBanner />
        <Suspense fallback={<FeaturedPreviewSectionSkeleton />}>
          <FeaturedPreviewSection />
        </Suspense>
      </div>

      <main className="main-content">
        <Suspense fallback={<BestsellersSectionSkeleton />}>
          <BestsellersSection />
        </Suspense>

        <Suspense fallback={<CategoriesSectionSkeleton />}>
          <CategoriesSection />
        </Suspense>

        <Suspense fallback={<NewProductsSectionSkeleton />}>
          <NewProductsSection />
        </Suspense>

        <VouchesSection />
        <RecentPurchases />
      </main>

      <footer className="footer">
        <div className="container">TxTEmpire — Discord & IGN Verknüpfung · Automatische Zahlungen</div>
      </footer>
    </>
  );
}
