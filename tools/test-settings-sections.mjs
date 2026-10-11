import assert from 'node:assert/strict';
import { normalizeQuery, matchesQuery, filterSections, initSettingsSections } from '../src/settingsSections.js';

// Pure matching: every word must appear, case and spacing do not matter.
assert.equal(normalizeQuery('  Camera   FLIP '), 'camera flip');
assert.equal(matchesQuery('Camera is upside down (flip 180°)', 'flip camera'), true);
assert.equal(matchesQuery('Camera mounting', 'flip'), false);
assert.equal(matchesQuery('anything', '   '), true, 'empty query matches everything');
assert.equal(matchesQuery(undefined, 'x'), false);

const results = filterSections([['Assistant voice', 'Speaking pace'], ['Tracking camera', 'Camera clarity'], ['Clear memory']], 'camera');
assert.deepEqual(results.map(r => r.any), [false, true, false]);
assert.deepEqual(results[1].matches, [true, true]);
assert.equal(filterSections([], 'x').length, 0);
assert.deepEqual(filterSections([['Depth'],['Clear memory']], 'privacy', ['Motion','Privacy']).map(result=>result.any),[false,true]);
assert.deepEqual(filterSections([['Depth','Clarity']], 'motion clarity', ['Motion'])[0].matches,[false,true]);

// DOM glue against a tiny fake: remembered state, first section open on first
// run, search hides rows without touching [hidden], clearing restores state.
function fakeElement(text = '') {
  const classes = new Set();
  return { textContent: text, hidden: false, open: false, dataset: {}, listeners: {},
    classList: { toggle: (name, on) => (on ? classes.add(name) : classes.delete(name)), has: name => classes.has(name) },
    addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); },
    value: '' };
}
function build() {
  const rowsBySection = [['Assistant voice', 'Speaking pace'], ['Tracking camera', 'Camera clarity'], ['Clear memory']];
  const sections = rowsBySection.map((rows, index) => {
    const section = fakeElement(); section.dataset.section = 's' + index;
    section.rows = rows.map(text => fakeElement(text));
    section.querySelectorAll = () => section.rows;
    section.querySelector = () => ({textContent:['Assistant','Devices','Privacy'][index]});
    return section;
  });
  const search = fakeElement();
  const root = { querySelectorAll: () => sections, querySelector: selector => (selector === '#settings-search' ? search : null) };
  return { root, sections, search };
}
const store = new Map();
const storage = { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) };
{
  const { root, sections, search } = build();
  const api = initSettingsSections(root, { storage });
  assert.deepEqual(sections.map(s => s.open), [true, false, false], 'first section open on first run');
  sections[1].open = true; sections[1].listeners.toggle.forEach(fn => fn());
  assert.equal(JSON.parse(store.get('mirror.settings-sections')).s1, true, 'open state persisted');
  search.value = 'camera'; api.apply();
  assert.deepEqual(sections.map(s => s.hidden), [true, false, true], 'non-matching sections hidden');
  assert.equal(sections[1].open, true);
  assert.equal(sections[1].rows[0].classList.has('settings-filtered'), false);
  search.value = 'clarity'; api.apply();
  assert.equal(sections[1].rows[0].classList.has('settings-filtered'), true, 'non-matching row filtered');
  assert.equal(sections[1].rows[1].classList.has('settings-filtered'), false);
  assert.equal(sections[1].rows[0].hidden, false, 'app-managed [hidden] is never touched');
  // Opening during a search must not overwrite the remembered state.
  sections[2].open = true; sections[2].listeners.toggle.forEach(fn => fn());
  assert.equal(JSON.parse(store.get('mirror.settings-sections')).s2, undefined);
  for(const extra of [{isComposing:true},{keyCode:229}]){
    search.listeners.keydown.forEach(fn=>fn({key:'Escape',...extra,stopPropagation(){throw Error('Composition was consumed')}}));
    assert.equal(search.value,'clarity','IME Escape must preserve the search');
  }
  let stopped=false;
  search.listeners.keydown.forEach(fn=>fn({key:'Escape',stopPropagation(){stopped=true}}));
  assert(stopped);assert.equal(search.value,'','Ordinary Escape must clear search');
  search.value = ''; api.apply();
  assert.deepEqual(sections.map(s => s.hidden), [false, false, false]);
  assert.deepEqual(sections.map(s => s.open), [false, true, false].map((v, i) => (i === 0 ? true : v)), 'remembered state restored');
}
// A second launch restores the saved choices.
{
  const {root,sections,search}=build();const api=initSettingsSections(root,{storage});
  search.value='privacy';api.apply();assert.deepEqual(sections.map(section=>section.hidden),[true,true,false]);
  search.value='camera';search.listeners.input.forEach(fn=>fn({isComposing:true}));
  assert.deepEqual(sections.map(section=>section.hidden),[true,true,false],'Composition changed settings filtering');
  search.listeners.compositionend.forEach(fn=>fn());assert.deepEqual(sections.map(section=>section.hidden),[true,false,true]);
}
{
  const { root, sections } = build();
  initSettingsSections(root, { storage });
  assert.equal(sections[1].open, true);
}
console.log('Settings sections: query matching, section filtering, remembered open state, search without touching [hidden] and restore passed.');
