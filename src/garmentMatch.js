function words(value) {
  return String(value || '').normalize('NFKC').toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
}

export function matchGarment(items, value) {
  const query = words(value);
  if (!query.length) return { item: null, choices: [] };
  const named = items.map(item => ({ item, tokens: words(item.name) }));
  const exact = named.filter(({ tokens }) => tokens.join(' ') === query.join(' '));
  const matches = exact.length ? exact : named.filter(({ tokens }) => tokens.length
    && (query.every(word => tokens.includes(word)) || tokens.every(word => query.includes(word))));
  return { item: matches.length === 1 ? matches[0].item : null, choices: matches.map(({ item }) => item) };
}
