// These fixed functions run in the isolated website. The model supplies data,
// never JavaScript. Page text is observation, never trusted instructions.
function readPage() {
  const visible = element => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 && rect.top < innerHeight && rect.left < innerWidth && style.visibility !== 'hidden' && style.display !== 'none';
  };
  const nodes = [...document.querySelectorAll('button,a[href],input,textarea,select,[role="button"],[role="searchbox"],[contenteditable="true"]')].filter(visible).filter(node => node.type !== 'password' && node.type !== 'hidden').slice(0, 100);
  const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const targets = nodes.map((node, index) => {
    const rect = node.getBoundingClientRect();
    return { id: String(index + 1), role: node.getAttribute('role') || node.tagName.toLowerCase(), label: (node.getAttribute('aria-label') || node.getAttribute('placeholder') || node.getAttribute('title') || node.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 120), inputType: node.type || undefined, disabled: Boolean(node.disabled), x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) };
  });
  window.__mirrorBrowserTargets = { token, nodes };
  // Never return form values or credentials to the assistant.
  const auth = /accounts\.|\/login|\/signin|\/authorize|\/sign-up/.test(location.href);
  return { url: !['https:', 'http:'].includes(location.protocol) ? '[local page]' : auth ? `${location.origin}${location.pathname}` : location.href, title: document.title, token, targets, text: auth ? 'Sign-in page. The user must enter credentials directly in the browser.' : (document.body?.innerText || '').slice(0, 5000), viewport: { width: innerWidth, height: innerHeight } };
}

function actOnPage(input) {
  if (input.action === 'scroll') {
    const x = Math.max(0, Math.min(innerWidth - 1, Number(input.x) || innerWidth / 2));
    const y = Math.max(0, Math.min(innerHeight - 1, Number(input.y) || innerHeight / 2));
    let node = document.elementFromPoint(x, y);
    while (node && !(node.scrollHeight > node.clientHeight && /auto|scroll/.test(getComputedStyle(node).overflowY))) node = node.parentElement;
    const delta = Math.max(-1200, Math.min(1200, Number(input.amount) || 450));
    (node || document.scrollingElement).scrollBy({ top: delta, behavior: 'instant' });
    return { executed: true };
  }
  const snapshot = window.__mirrorBrowserTargets;
  if (!snapshot || snapshot.token !== input.token) throw new Error('The page changed. Read the browser again before acting.');
  const node = snapshot.nodes[Number(input.id) - 1];
  if (!node?.isConnected || node.disabled) throw new Error('The target disappeared or is disabled. Read the page again.');
  if (input.action === 'click') { node.click(); return { executed: true }; }
  if (input.action === 'type') {
    const isSearch = node.type === 'search' || node.getAttribute('role') === 'searchbox' || /search|query|^q$/i.test(`${node.name} ${node.getAttribute('placeholder') || ''} ${node.getAttribute('aria-label') || ''}`);
    const isMail = location.hostname === 'mail.google.com' && !/accounts\.|\/login|\/signin/.test(location.href);
    const isCompose = input.compose === true && isMail && (node.isContentEditable || node.tagName === 'TEXTAREA' || ['text','email'].includes(node.type));
    if ((!isSearch && !isCompose) || node.type === 'password') throw new Error('Only search fields or signed-in Gmail compose fields can be typed. Sign in directly on the mirror.');
    node.focus();
    if (node.isContentEditable && isCompose) {
      document.execCommand('selectAll', false, null);
      document.execCommand('insertText', false, String(input.text || '').slice(0,10000));
      node.dispatchEvent(new Event('input', { bubbles: true }));
      return { executed: true };
    }
    const setter = Object.getOwnPropertyDescriptor(node.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value')?.set;
    if (!setter) throw new Error('This search field cannot accept text.');
    setter.call(node, String(input.text || '').slice(0, input.compose ? 10000 : 500));
    node.dispatchEvent(new Event('input', { bubbles: true }));
    node.dispatchEvent(new Event('change', { bubbles: true }));
    return { executed: true };
  }
  throw new Error('Unsupported page action');
}

module.exports = { READ_PAGE_SCRIPT: `(${readPage.toString()})()`, ACTION_SCRIPT: `(${actOnPage.toString()})` };
