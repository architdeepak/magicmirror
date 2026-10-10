const assert = require('assert/strict');
const { groundedSearch, cleanSources } = require('../src/groundedSearch.cjs');
(async () => {
  let seen;
  const ok = body => async (url, init) => { seen = { url, init }; return { ok: true, json: async () => body }; };
  const body = { candidates: [{ content: { parts: [{ text: 'It is 70 degrees and clear.' }, { text: ' Enjoy the sun.' }] }, groundingMetadata: { groundingChunks: [
    { web: { uri: 'https://www.example.com/a', title: 'Example' } }, { web: { uri: 'https://www.example.com/a', title: 'Dup' } },
    { web: { uri: 'http://insecure.test/x', title: 'Insecure' } }, { web: { uri: 'https://user:pw@evil.test/', title: 'Creds' } }, { web: { uri: 'javascript:alert(1)' } }, {}] } }] };
  const result = await groundedSearch({ apiKey: 'k', query: '  weather   in   Mountain View ', fetchImpl: ok(body) });
  assert.equal(result.answer, 'It is 70 degrees and clear. Enjoy the sun.');
  assert.deepEqual(result.sources.map(s => s.url), ['https://www.example.com/a']);
  assert.equal(result.query, 'weather in Mountain View');
  assert.match(seen.url, /gemini-2\.5-flash:generateContent$/);
  assert.equal(JSON.parse(seen.init.body).tools[0].google_search !== undefined, true);
  assert.equal(seen.init.headers['x-goog-api-key'], 'k');
  assert.equal(cleanSources(Array.from({ length: 12 }, (_, i) => ({ web: { uri: `https://s${i}.test/` } }))).length, 5);
  await assert.rejects(groundedSearch({ apiKey: '', query: 'x' }), /Gemini key/);
  await assert.rejects(groundedSearch({ apiKey: 'k', query: '   ' }), /something to search/);
  await assert.rejects(groundedSearch({ apiKey: 'k', query: 'x', fetchImpl: async () => ({ ok: false, status: 429 }) }), /429/);
  await assert.rejects(groundedSearch({ apiKey: 'k', query: 'x', fetchImpl: ok({ candidates: [] }) }), /nothing to say/);
  // Timeout aborts a hung request.
  await assert.rejects(groundedSearch({ apiKey: 'k', query: 'x', timeoutMs: 30, fetchImpl: (_u, init) => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted')))) }), /aborted/);
  console.log('Grounded search: source sanitising, https-only, dedupe/limit, key header, errors and timeout passed.');
})().catch(error => { console.error(error); process.exit(1); });
