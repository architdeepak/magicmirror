// Speech is parsed into plain actions. UI and AI tools execute the same actions.
export function parseMirrorAction(value) {
  const text = String(value || '').toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
  if (/\b(?:play|start|open|show)\b.*\bliked songs\b/.test(text)) return { type: 'media', service: 'spotify', target: 'liked', play: true };
  if (/\b(?:open|show|start|play)\s+(?:my )?(spotify|music|youtube|netflix)\b/.test(text) || /\bspotify\s+(?:start|play|open)\b/.test(text)) {
    const service = /youtube/.test(text) ? 'youtube' : /netflix/.test(text) ? 'netflix' : 'spotify';
    return { type: 'media', service, play: /\bplay|start\b/.test(text) };
  }
  const effect = text.match(/\b(?:apply|wear|try on|put on|show me|remove|take off)\s+(?:the |a |an |my )?(?:(?:astral|astra|arcane|masquerade|celestial|magic) )?(crown|glasses|mask|halo|aura|runes|cat|emoji|scan|enchanted|effects?|filter)\b/);
  if (effect) return { type: 'effect', effect: /^(remove|take off)/.test(effect[0]) ? 'none' : /^(effect|filter)/.test(effect[1]) ? 'enchanted' : effect[1] };
  if (/\b(?:let s |lets |want to |can we |start |open |switch to |go to )?try\s*on(?: mode)?\b/.test(text)) return { type: 'mode', mode: 'ar' };
  const match = text.match(/\b(?:show|open|go to|switch to|take me to)\s+(?:the )?(ambient|home|mirror|converse|conversation|assistant|studio|watch|video)\b/);
  if (match) return { type: 'mode', mode: /ambient|home|mirror/.test(match[1]) ? 'mirror' : /studio/.test(match[1]) ? 'ar' : /watch|video/.test(match[1]) ? 'watch' : 'portal' };
  return null;
}

export function createMirrorActionDispatcher({ setMode, setEffect, openMedia, getState }) {
  return (action) => {
    if (!action) return { handled: false };
    if (action.type === 'mode') setMode(action.mode);
    else if (action.type === 'effect') { setMode('ar'); setEffect(action.effect); }
    else if (action.type === 'media') { setMode('watch'); return openMedia(action); }
    else return { handled: false };
    return { handled: true, ...getState() };
  };
}
