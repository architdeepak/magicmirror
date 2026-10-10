// Actual Chromium default keyboard actions, using the production event builder.
const { app, BrowserWindow } = require('electron');
const assert = require('assert/strict');
const { managedKeyEvents } = require('../src/managedBrowserKeys.cjs');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
app.whenReady().then(async()=>{
  const win=new BrowserWindow({width:700,height:700,webPreferences:{nodeIntegration:false,contextIsolation:true}});
  try {
    await win.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(`<form onsubmit="event.preventDefault();window.saves=(window.saves||0)+1"><input id="note" value="old"></form><textarea id="lines"></textarea><button id="button" onclick="window.activations=(window.activations||0)+1">Activate</button>`));
    win.focus();await delay(150);
    const run=source=>win.webContents.executeJavaScript(source);
    const press=async key=>{for(const event of managedKeyEvents(key))win.webContents.sendInputEvent(event);await delay(60);};
    await run("document.querySelector('#note').focus()");await press('ctrl+a');await win.webContents.insertText("Velora's café");await press('enter');
    assert.equal(await run('window.saves'),1,'Enter did not submit exactly once');
    assert.equal(await run("document.querySelector('#note').value"),"Velora's café");
    await run("document.querySelector('#lines').focus()");await win.webContents.insertText('one');await press('enter');await win.webContents.insertText('two');await press('space');await win.webContents.insertText('three');
    assert.equal(await run("document.querySelector('#lines').value"),'one\ntwo three','Enter/Space did not produce text default actions');
    await run("document.querySelector('#button').focus()");await press('space');assert.equal(await run('window.activations'),1,'Space did not activate once');
    await press('enter');assert.equal(await run('window.activations'),2,'Enter did not activate once');
    console.log('Managed Chromium keyboard passed: Unicode replacement, Enter form submit/newline, Space text, Space/Enter button activation exactly once.');
  }finally{win.destroy();app.quit();}
}).catch(error=>{console.error(error);app.exit(1);});
