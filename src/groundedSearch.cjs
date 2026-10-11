// Web search that answers inside the mirror: a Google-Search-grounded Gemini
// call returns a short spoken-style answer plus the sources it used. The key
// stays in the main process; only text and https links reach the renderer.
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
// An alias that tracks the current Flash model: pinned names get retired for new users.
const DEFAULT_MODEL = 'gemini-flash-latest';

// Questions whose answer changes with time must come from grounded search.
const TIME_SENSITIVE = /\b(?:news|headlines?|today|tonight|now|latest|current(?:ly)?|right now|this (?:week|month|year|morning|evening)|score|scores|price|prices|stock|weather|forecast|traffic|open|trending|live)\b/i;
function isTimeSensitive(query) { return TIME_SENSITIVE.test(String(query || '')); }

function cleanSources(chunks) {
  const seen = new Set(), sources = [];
  for (const chunk of Array.isArray(chunks) ? chunks : []) {
    const web = chunk?.web;
    if (!web?.uri) continue;
    let url;
    try { url = new URL(web.uri); } catch { continue; }
    if (url.protocol !== 'https:' || url.username || url.password) continue;
    if (seen.has(url.href)) continue;
    seen.add(url.href);
    sources.push({ title: String(web.title || url.hostname).slice(0, 80), url: url.href, host: url.hostname.replace(/^www\./, '') });
    if (sources.length >= 5) break;
  }
  return sources;
}

async function groundedSearch({ apiKey, query, model = DEFAULT_MODEL, fetchImpl = fetch, signal, timeoutMs = 20000, grounding = true }) {
  const terms = String(query || '').replace(/\s+/g, ' ').trim().slice(0, 240);
  if (!terms) throw new Error('Give me something to search for.');
  if (!apiKey) throw new Error('Add a Gemini key in Settings to search inside the mirror.');
  signal?.throwIfAborted();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort(signal.reason);
  signal?.addEventListener('abort', onAbort, { once: true });
  try {
    const send = withoutThinking => { controller.signal.throwIfAborted();return fetchImpl(`${ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: 'You are the voice of a magic mirror. Answer the question directly and accurately in at most four short sentences suited to being spoken aloud. Lead with the answer, then the one or two most useful details. Resolve ambiguity sensibly instead of asking back, and say plainly when sources disagree or you are unsure. State concrete facts and figures as digits. No markdown, no lists, no preamble.' }] },
        contents: [{ role: 'user', parts: [{ text: terms }] }],
        ...(grounding ? { tools: [{ google_search: {} }] } : {}),
        // Reasoning tokens count against the output limit and truncate answers;
        // a quick factual reply does not need them.
        generationConfig: { temperature: 0.3, maxOutputTokens: 1000, ...(withoutThinking ? { thinkingConfig: { thinkingBudget: 192 } } : {}) }
      })
    }); };
    let response = await send(true);
    if (response.status === 400) response = await send(false);   // some models reject a zero budget
    if (!response.ok) throw new Error(`Search failed (${response.status}).`);
    const data = await response.json();
    controller.signal.throwIfAborted();
    const candidate = data?.candidates?.[0];
    const answer = (candidate?.content?.parts || []).map(part => part?.text || '').join(' ').replace(/\s+/g, ' ').trim().slice(0, 700);
    if (!answer) throw new Error('The mirror found nothing to say about that.');
    return { query: terms, answer, sources: grounding ? cleanSources(candidate?.groundingMetadata?.groundingChunks) : [] };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

module.exports = { groundedSearch, cleanSources, isTimeSensitive };
