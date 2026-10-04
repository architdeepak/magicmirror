export const STARTER_GARMENTS = [
  { id: 'starter-t-shirt', name: 'T-shirt', category: 'top', aliases: ['t shirt', 'tshirt', 'tee', 'shirt'] },
  { id: 'starter-coat', name: 'Coat', category: 'outerwear', aliases: ['coat', 'jacket'] },
  { id: 'starter-jeans', name: 'Jeans', category: 'bottoms', aliases: ['jeans', 'pants', 'trousers'] },
  { id: 'starter-dress', name: 'Dress', category: 'dress', aliases: ['dress'] }
].map(item => ({ ...item, starter: true, imageUrl: new URL(`./assets/garments/${item.id.replace('starter-', '')}.svg`, import.meta.url).href }));

export function findGarment(items, query) {
  const normalize = value => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const needle = normalize(query).replace(/^(?:the|a|an|my)\s+/, '');
  if (!needle) return null;
  return items.find(item => normalize(item.id) === needle || normalize(item.name) === needle)
    || items.find(item => (item.aliases || []).some(alias => normalize(alias) === needle)) || null;
}

export function garmentSlot(item) { return item.category === 'bottoms' ? 'lower' : item.category === 'dress' ? 'body' : 'upper'; }
