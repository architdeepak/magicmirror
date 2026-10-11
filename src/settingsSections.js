// Collapsible, searchable settings. The markup is plain <details> sections so
// it works without this module; this adds remembered open/closed state and a
// filter box. The matching logic is pure so it can be tested without a DOM.

const STORAGE_KEY = 'mirror.settings-sections';

export function normalizeQuery(query) {
  return String(query || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

// Every word of the query must appear somewhere in the row's text.
export function matchesQuery(text, query) {
  const words = normalizeQuery(query).split(' ').filter(Boolean);
  if (!words.length) return true;
  const haystack = String(text || '').toLowerCase();
  return words.every(word => haystack.includes(word));
}

// rows: [[rowText, ...] per section]. Returns, per section, which rows match
// and whether the section has any match (so it can be shown and opened).
export function filterSections(sections, query, headings = []) {
  return sections.map((rows,index) => {
    const matches = rows.map(text => matchesQuery(`${headings[index] || ''} ${text}`, query));
    return { matches, any: matches.some(Boolean) };
  });
}

function loadState(storage) {
  try { const value = JSON.parse(storage.getItem(STORAGE_KEY) || '{}'); return value && typeof value === 'object' ? value : {}; }
  catch { return {}; }
}

export function initSettingsSections(root, { storage = globalThis.localStorage } = {}) {
  if (!root) return null;
  const sections = [...root.querySelectorAll('details.settings-section')];
  const search = root.querySelector('#settings-search');
  const saved = loadState(storage);
  const rowsOf = section => [...section.querySelectorAll(':scope > .settings-section-body > *')];
  let searching = false;

  // Restore the remembered state; the first section stays open on first run.
  sections.forEach((section, index) => {
    const key = section.dataset.section;
    if (key in saved) section.open = Boolean(saved[key]);
    else section.open = index === 0;
    section.addEventListener('toggle', () => {
      if (searching) return;            // a search opens sections temporarily
      const state = loadState(storage);
      state[key] = section.open;
      try { storage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* storage may be blocked */ }
    });
  });

  const apply = () => {
    Object.assign(saved, loadState(storage));          // pick up changes made by toggling
    const query = normalizeQuery(search?.value);
    searching = Boolean(query);
    const rows = sections.map(rowsOf);
    const headings = sections.map(section => section.querySelector(':scope > summary')?.textContent || '');
    const results = filterSections(rows.map(group => group.map(row => row.textContent)), query, headings);
    sections.forEach((section, index) => {
      const { matches, any } = results[index];
      // A class, not [hidden]: several rows are shown/hidden by the app itself.
      rows[index].forEach((row, rowIndex) => row.classList.toggle('settings-filtered', Boolean(query) && !matches[rowIndex]));
      section.hidden = Boolean(query) && !any;
      if (query) section.open = any;
      else section.open = saved[section.dataset.section] ?? index === 0;
    });
    if (!query) searching = false;
  };
  search?.addEventListener('input', event => { if(!event.isComposing)apply(); });
  search?.addEventListener('compositionend', apply);
  search?.addEventListener('keydown', event => { if (event.key === 'Escape' && !event.isComposing && event.keyCode !== 229 && search.value) { search.value = ''; apply(); event.stopPropagation(); } });
  return { apply, sections };
}
