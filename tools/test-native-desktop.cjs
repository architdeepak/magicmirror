// Real Win32 input smoke test. Input is sent only while this test's own window
// is foreground; leaving the window causes the bridge to reject the action.
const { app, BrowserWindow, screen } = require('electron');
const assert = require('assert/strict');
const { createNativeDesktop, nativeAction } = require('../src/nativeDesktop.cjs');

if (process.platform !== 'win32') { console.log('Native desktop smoke test requires Windows.'); app.exit(0); }
else app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 620, height: 420, title: 'Mirror native input test', webPreferences: { partition: `native-input-test-${process.pid}`, contextIsolation: true, nodeIntegration: false } });
  const native = createNativeDesktop();
  try {
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent('<!doctype html><title>Mirror native input test</title><style>body{padding:24px;font:16px system-ui}textarea{width:95%;height:120px}button{padding:16px}output{display:block;margin-top:20px}</style><h1>Mirror native input test</h1><textarea id="entry" autofocus></textarea><button id="click">Click test</button><button id="double" ondblclick="window.doubles=(window.doubles||0)+1">Double-click test</button><output id="count">0</output><script>document.querySelector("button").onclick=()=>document.querySelector("output").textContent=Number(document.querySelector("output").textContent)+1</script>'));
    win.show(); win.focus();
    const perform = async (input) => {
      const foreground = await native.inspect();
      assert.equal(foreground.title, 'Mirror native input test', 'Test window must remain foreground');
      assert.equal(foreground.processId, process.pid, 'Native input must target this test process only');
      const display = screen.getDisplayMatching(win.getBounds());
      return native.perform(nativeAction(input, { foreground, displayBounds: display.bounds, width: display.bounds.width, height: display.bounds.height }, (point) => screen.dipToScreenPoint(point)));
    };
    await win.webContents.executeJavaScript('document.querySelector("textarea").focus()');
    const text = "Your evil highness 👑 Ω ' `$()";
    await perform({ action: 'type_text', text });
    await new Promise((resolve) => setTimeout(resolve, 150));
    assert.equal(await win.webContents.executeJavaScript('document.querySelector("textarea").value'), text);
    await perform({ action: 'press_key', key: 'ctrl+a' });
    await perform({ action: 'type_text', text: 'Selected and replaced' });
    await new Promise((resolve) => setTimeout(resolve, 150));
    assert.equal(await win.webContents.executeJavaScript('document.querySelector("textarea").value'), 'Selected and replaced');
    const button = await win.webContents.executeJavaScript('(()=>{const r=document.querySelector("button").getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()');
    const content = win.getContentBounds(); const display = screen.getDisplayMatching(win.getBounds());
    await perform({ action: 'click', x: content.x + button.x - display.bounds.x, y: content.y + button.y - display.bounds.y });
    await new Promise((resolve) => setTimeout(resolve, 150));
    assert.equal(await win.webContents.executeJavaScript('document.querySelector("output").textContent'), '1');
    const doubleButton=await win.webContents.executeJavaScript('(()=>{const r=document.querySelector("#double").getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()');
    await perform({ action: 'double_click', x: content.x + doubleButton.x - display.bounds.x, y: content.y + doubleButton.y - display.bounds.y });
    await new Promise(resolve=>setTimeout(resolve,150));
    assert.equal(await win.webContents.executeJavaScript('window.doubles'),1);
    console.log('Real Windows native input passed: Unicode typing, modifier keys, and DPI-aware click.');
  } finally { win.destroy(); app.quit(); }
}).catch((error) => { console.error(error); app.exit(1); });
