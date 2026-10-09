const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const renderer = fs.readFileSync('src/renderer.js', 'utf8');
const source = renderer.slice(renderer.indexOf('async function loadWatchVideo()'), renderer.indexOf('function runVoiceNavigation('));
function setup() {
  const events = [], pending = [];
  const classes = () => ({ add: value => events.push('add:' + value), remove: value => events.push('remove:' + value) });
  const c = vm.createContext({ URL, watchLoadGeneration: 7, elements: {
    watchUrl: { value: '' }, watchVideo: { pause: () => events.push('pause'), removeAttribute: () => events.push('remove-video'), classList: classes(), play: async () => events.push('play') },
    watchFrame: { src: 'existing', removeAttribute: () => events.push('remove-frame'), classList: classes() }, watchPlaceholder: { classList: classes() }
  }, castPlayer: { detach: () => events.push('detach-cast') }, youtubePlayer: { detach: () => events.push('detach-youtube'), load: () => new Promise((resolve, reject) => pending.push({ resolve, reject })) },
  watchPlayback: { snapshot: () => ({ source: 'youtube' }) }, showOracle: text => events.push('notice:' + text) });
  vm.runInContext(source, c);
  return { c, events, pending };
}
(async () => {
  for (const url of ['garbage', 'file:///tmp/video', 'https://youtu.be/short', '']) {
    const { c, events } = setup(); c.elements.watchUrl.value = url;
    const result = await c.loadWatchVideo(); if (url) assert(result.error);
    assert.equal(c.watchLoadGeneration, 7); assert(!events.some(e => /detach|pause|remove/.test(e)), url);
  }
  const { c, events, pending } = setup();
  c.elements.watchUrl.value = 'https://youtu.be/M7lc1UVf-VE'; const valid = c.loadWatchVideo();
  assert.equal(c.watchLoadGeneration, 8); c.elements.watchUrl.value = 'bad'; assert((await c.loadWatchVideo()).error);
  assert.equal(c.watchLoadGeneration, 8, 'Invalid URL cancelled a pending valid source');
  pending[0].resolve(); assert.equal((await valid).source, 'youtube');
  assert.equal(events.filter(e => e === 'detach-youtube').length, 1);
  c.elements.watchUrl.value = 'https://youtu.be/M7lc1UVf-VE'; const stale = c.loadWatchVideo();
  c.elements.watchUrl.value = 'https://example.org/current.webm'; await c.loadWatchVideo();
  const detached = events.filter(e => e === 'detach-youtube').length;
  pending[1].reject(new Error('old endpoint failed')); assert.equal(await stale, undefined);
  assert.equal(events.filter(e => e === 'detach-youtube').length, detached, 'Stale error detached newer source');
  c.elements.watchUrl.value = 'https://youtu.be/M7lc1UVf-VE'; const failed = c.loadWatchVideo();
  pending[2].reject(new Error('current endpoint failed')); assert.equal((await failed).error, 'current endpoint failed');
  console.log('Watch load ownership: invalid/blank URLs preserve current and pending media; valid replacements own generation; stale errors cannot detach newer source; current errors remain visible.');
})().catch(error => { console.error(error); process.exitCode = 1; });
