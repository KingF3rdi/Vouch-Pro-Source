import Link from 'next/link';
import SectionHeaderSkeleton from '../skeletons/SectionHeaderSkeleton';
import SkeletonBlock from '../skeletons/SkeletonBlock';

const CATEGORY_ICONS = {
  'texture-packs': '🎨',
  textures: '🎨',
  packs: '🎨',
  schematics: '🗺️',
  mods: '⚙️',
  maps: '🗺️',
  plugins: '🔌',
  tools: '🛠️',
};

function categoryIcon(slug, name) {
  const key = (slug || '').toLowerCase();
  if (CATEGORY_ICONS[key]) return CATEGORY_ICONS[key];
  for (const [k, icon] of Object.entries(CATEGORY_ICONS)) {
    if (key.includes(k) || (name || '').toLowerCase().includes(k)) return icon;
  }
  return '📦';
}

/** Placeholder-Bilder ohne eingebetteten Text — Kategoriename steht im Footer. */
function categoryPreviewSrc(url) {
  if (!url) return url;
  try {
    const parsed = new URL(url);
    if (parsed.hostname.replace(/^www\./, '') === 'placehold.co') {
      parsed.searchParams.delete('text');
      return parsed.toString();
    }
  } catch {
    /* relative URLs o.ä. */
  }
  return url.replace(/([?&])text=[^&]*&?/g, '$1').replace(/[?&]$/, '');
}

async function fetchCategories() {
  const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const res = await fetch(`${base}/api/categories`, { cache: 'no-store' });
  if (!res.ok) return [];
  return res.json();
}

export default async function CategoriesSection() {
  const categories = await fetchCategories();
  if (!categories.length) return null;

  return (
    <section className="section categories-section">
      <div className="container">
        <div className="section-header category-glass-panel section-header-panel">
          <h2>Wähle deinen Bereich</h2>
          <p className="section-subtitle">Kategorien unter den Vorschauen</p>
        </div>

        <div className="category-card-list">
          {categories.map((cat) => {
            const icon = categoryIcon(cat.slug, cat.name);
            const count = cat.product_count ?? 0;
            return (
              <Link
                key={cat.id}
                href={`/search?category=${encodeURIComponent(cat.slug)}`}
                className="category-pick-card"
              >
                <div className="category-pick-card__preview">
                  {cat.preview_url ? (
                    <img
                      src={categoryPreviewSrc(cat.preview_url)}
                      alt=""
                      className="category-pick-card__bg"
                    />
                  ) : (
                    <div className="category-pick-card__bg category-pick-card__bg--fallback" />
                  )}
                  <div className="category-pick-card__overlay" />
                  <span className="category-pick-card__badge" aria-hidden="true">
                    {icon}
                  </span>
                </div>

                <div className="category-pick-card__box">
                  <span className="category-pick-card__count">
                    {count} {count === 1 ? 'PRODUKT' : 'PRODUKTE'}
                  </span>
                  <span className="category-pick-card__name">
                    <span className="category-pick-card__name-icon" aria-hidden="true">
                      {icon}
                    </span>
                    {cat.name}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function CategoriesSectionSkeleton() {
  return (
    <section className="section categories-section" aria-busy="true" aria-label="Kategorien werden geladen">
      <div className="container">
        <SectionHeaderSkeleton />
        <div className="category-card-list">
          {[0, 1].map((i) => (
            <div key={i} className="category-pick-card category-pick-card--skeleton">
              <SkeletonBlock className="category-pick-card__preview" />
              <SkeletonBlock className="category-pick-card__box" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
