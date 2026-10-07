const assert = require('assert/strict');
const fs = require('fs/promises');
const path = require('path');
const deferred = () => { let resolve; const promise = new Promise(r => resolve = r); return { promise, resolve }; };
(async () => {
  global.document = { createElement: () => ({}) };
  const source = await fs.readFile(path.join(__dirname, '../src/spotifyDevices.js'), 'utf8');
  const { SpotifyDevices } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
  const element = () => ({ value: '', addEventListener() {}, replaceChildren(...options) { this.options = options; } });
  const select = element(), use = element(), refresh = element(), status = element();
  const pending = deferred(); let request; let refreshed = 0;
  const picker = new SpotifyDevices({ select, use, refresh, status, bridge: { spotifyDevices: () => pending.promise,
    spotifyControl: async action => { request = action; return { confirmed: false }; } }, onTransfer: () => refreshed++ });
  const old = picker.refresh(); picker.clear(); pending.resolve([{ id: 'old', name: 'Old account' }]); await old;
  assert.equal(select.options.length, 0); assert(use.disabled && refresh.disabled);
  picker.bridge.spotifyDevices = async () => [{ id: 'phone', name: 'Phone', active: true }, { id: 'tv', name: 'TV <test>' }, { id: 'locked', name: 'Restricted', restricted: true }];
  await picker.refresh(); assert.equal(select.value, 'phone'); assert.equal(select.options[1].textContent, 'TV <test>'); assert(select.options[2].disabled);
  select.value = 'tv'; await picker.transfer(); assert.deepEqual(request, { action: 'transfer', deviceId: 'tv' });
  assert.match(status.textContent, /Switch requested/); assert.equal(refreshed, 1);
  const late = deferred(); picker.bridge.spotifyControl = () => late.promise;
  const transferring = picker.transfer(); picker.clear(); late.resolve({ confirmed: true }); await transferring;
  assert.match(status.textContent, /Connect Spotify/); assert.equal(refreshed, 1, 'Old account transfer refreshed the new account');
  console.log('Spotify device UI passed: stale list/transfer isolation, safe option text, restricted devices, target selection, and unconfirmed transfer status. Real playback is unverified.');
})().catch(error => { console.error(error); process.exitCode = 1; });
