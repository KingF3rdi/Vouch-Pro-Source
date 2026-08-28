const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

async function fetchApi(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'API Fehler');
  }
  return res.json();
}

export const api = {
  getStats: () => fetchApi('/api/stats'),
  getVouches: () => fetchApi('/api/vouches'),
  getBestsellers: () => fetchApi('/api/products/bestsellers'),
  getNewProducts: () => fetchApi('/api/products/new'),
  getCategories: () => fetchApi('/api/categories'),
  searchProducts: (q, category, tag) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (category) params.set('category', category);
    if (tag) params.set('tag', tag);
    return fetchApi(`/api/products/search?${params}`);
  },
  getProduct: (slug) => fetchApi(`/api/products/${slug}`),
  getSimilar: (slug) => fetchApi(`/api/products/${slug}/similar`),
  getMe: () => fetchApi('/api/user/me'),
  generateLinkCode: (codeType) =>
    fetchApi('/api/link/generate', {
      method: 'POST',
      body: JSON.stringify({ code_type: codeType }),
    }),
  redeemLinkCode: (code, ign, discordId) =>
    fetchApi('/api/link/redeem', {
      method: 'POST',
      body: JSON.stringify({ code, ign, discord_id: discordId }),
    }),
  validateDiscount: (code) =>
    fetchApi('/api/discount/validate', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),
  createOrder: (productId, ign, discountCode) =>
    fetchApi('/api/orders', {
      method: 'POST',
      body: JSON.stringify({ product_id: productId, ign, discount_code: discountCode }),
    }),
  toggleWishlist: (productId) =>
    fetchApi(`/api/user/wishlist/${productId}`, { method: 'POST' }),
  getWishlist: () => fetchApi('/api/user/wishlist'),
};
