const assert = require('assert/strict');
const { groundedSearch, cleanSources, isTimeSensitive } = require('../src/groundedSearch.cjs');
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
  assert.match(seen.url, /gemini-flash-latest:generateContent$/);
  assert.equal(JSON.parse(seen.init.body).tools[0].google_search !== undefined, true);
  assert.equal(seen.init.headers['x-goog-api-key'], 'k');
  assert.equal(cleanSources(Array.from({ length: 12 }, (_, i) => ({ web: { uri: `https://s${i}.test/` } }))).length, 5);
  await assert.rejects(groundedSearch({ apiKey: '', query: 'x' }), /Gemini key/);
  await assert.rejects(groundedSearch({ apiKey: 'k', query: '   ' }), /something to search/);
  await assert.rejects(groundedSearch({ apiKey: 'k', query: 'x', fetchImpl: async () => ({ ok: false, status: 429 }) }), /429/);
  await assert.rejects(groundedSearch({ apiKey: 'k', query: 'x', fetchImpl: ok({ candidates: [] }) }), /nothing to say/);
  // Timeout aborts a hung request.
  await assert.rejects(groundedSearch({ apiKey: 'k', query: 'x', timeoutMs: 30, fetchImpl: (_u, init) => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted')))) }), /aborted/);
  // Ungrounded mode sends no search tool and reports no sources.
  const retired=new AbortController();retired.abort(Error('Retired search'));let retiredCalls=0;
  await assert.rejects(groundedSearch({apiKey:'k',query:'x',signal:retired.signal,fetchImpl:async()=>{retiredCalls++}}),/Retired search/);
  assert.equal(retiredCalls,0);
  const reading=new AbortController();
  await assert.rejects(groundedSearch({apiKey:'k',query:'x',signal:reading.signal,fetchImpl:async()=>({ok:true,json:async()=>{reading.abort(Error('Retired response'));return body}})}),/Retired response/);
  const plain = await groundedSearch({ apiKey: 'k', query: 'height of everest', grounding: false, fetchImpl: ok(body) });
  assert.equal(JSON.parse(seen.init.body).tools, undefined);
  assert.deepEqual(plain.sources, []);
  for (const yes of ['latest news', 'weather in paris', 'who won the game tonight', 'bitcoin price']) assert(isTimeSensitive(yes), yes);
  for (const no of ['how tall is mount everest', 'capital of france', 'who wrote hamlet']) assert(!isTimeSensitive(no), no);
  console.log('Grounded search: source sanitising, https-only, dedupe/limit, key header, errors and timeout passed.');
})().catch(error => { console.error(error); process.exit(1); });
