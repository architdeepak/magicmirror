// Fixed inspection in an isolated world. Return only a boolean, never values.
function credentialPromptVisible() {
  const visible = node => {
    const rect = node.getBoundingClientRect(), style = getComputedStyle(node);
    return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 && rect.top < innerHeight && rect.left < innerWidth && style.display !== 'none' && style.visibility !== 'hidden';
  };
  if ([...document.querySelectorAll('input[type="password"],input[autocomplete="one-time-code"],input[autocomplete="current-password"],input[autocomplete="new-password"]')].some(visible)) return true;
  if ([...document.querySelectorAll('iframe[src]')].some(node => {
    if (!visible(node)) return false;
    try { const url = new URL(node.src); return /(^|\.)(idmsa\.apple\.com|account\.apple\.com|accounts\.google\.com|login\.microsoftonline\.com)$/.test(url.hostname) || /\/(?:login|signin|sign-in|authorize)(?:\/|$)/i.test(url.pathname); } catch { return false; }
  })) return true;
  const authPath = /\/(?:login|signin|sign-in|sign_in|authorize|oauth)(?:\/|$)/i.test(location.pathname);
  const authHost = /(^|\.)(idmsa\.apple\.com|account\.apple\.com|appleid\.apple\.com|accounts\.google\.com|login\.microsoftonline\.com)$/.test(location.hostname);
  if (authPath || authHost) return true;
  return [...document.querySelectorAll('form')].some(form => visible(form) && /sign\s*in|log\s*in|apple\s*(?:id|account)|verification\s*code/i.test(form.innerText || '') && form.querySelector('input:not([type="hidden"])'));
}
const CREDENTIAL_PROMPT_SCRIPT = `(${credentialPromptVisible.toString()})()`;
async function assertBrowserAccountReady(browser) {
  if (!browser || browser.isDestroyed() || !browser.isVisible()) return;
  const contents = browser.webContents;
  if (contents.isLoadingMainFrame?.()) throw new Error('The browser is loading. Wait, then observe again.');
  let credentialsVisible;
  try { credentialsVisible = await contents.executeJavaScriptInIsolatedWorld(987, [{ code: CREDENTIAL_PROMPT_SCRIPT }]); }
  catch { throw new Error('The browser account state could not be inspected. Wait, then observe again.'); }
  if (credentialsVisible) throw new Error('Sign in directly in the browser, including verification codes. The assistant pauses screen capture and computer input while sign-in is visible. Ask it to continue when the map or service opens.');
}
module.exports = { assertBrowserAccountReady, CREDENTIAL_PROMPT_SCRIPT };
