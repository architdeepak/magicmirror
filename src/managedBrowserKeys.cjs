const KEYS = Object.freeze({
  enter: 'Enter', tab: 'Tab', escape: 'Escape', backspace: 'Backspace',
  space: 'Space', up: 'Up', down: 'Down', left: 'Left', right: 'Right',
  home: 'Home', end: 'End', pageup: 'PageUp', pagedown: 'PageDown',
  'ctrl+a': 'A'
});
const MANAGED_KEYS = Object.freeze(Object.keys(KEYS));

function managedKeyEvents(value) {
  const key = String(value || '').toLowerCase();
  const keyCode = KEYS[key];
  if (!keyCode) throw new Error(`Supported managed-browser keys: ${MANAGED_KEYS.join(', ')}. Use open_webpage to navigate to a URL.`);
  const modifiers = key.startsWith('ctrl+') ? ['control'] : [];
  const events = [{ type: 'keyDown', keyCode, modifiers }];
  // Chromium needs the character event for Enter's form submission/default
  // action and Space's text/button activation, in addition to key transitions.
  if (key === 'enter' || key === 'space') events.push({ type: 'char', keyCode: key === 'enter' ? '\r' : ' ', modifiers });
  events.push({ type: 'keyUp', keyCode, modifiers });
  return events;
}

module.exports = { managedKeyEvents, MANAGED_KEYS };
