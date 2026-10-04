const { app, BrowserWindow }=require('electron');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const os=require('node:os');
const { MirrorMedia }=require('../src/mirrorMedia.js');
app.setPath('userData',fs.mkdtempSync(path.join(os.tmpdir(),'mirror-browser-test-')));
app.whenReady().then(async()=>{
  const win=new BrowserWindow({show:false,width:1080,height:1920,webPreferences:{contextIsolation:true,sandbox:true}});
  const browser=new MirrorMedia(win);
  browser.service='browser';browser.visible=true;
  const view=browser._ensureView();view.setVisible(true);browser.resize({x:100,y:500,width:800,height:1000});
  try {
    await view.webContents.loadURL('data:text/html,'+encodeURIComponent(`<html><head><title>Browser test</title></head><body><input type="search" aria-label="Search music"><input type="password" value="never-share-this"><button aria-label="Play liked songs" onclick="document.querySelector('h1').textContent='Playing liked songs'">Play</button><button aria-label="Next song" onclick="document.querySelector('h1').textContent='Next song'">Next</button><button aria-label="Previous song" onclick="document.querySelector('h1').textContent='Previous song'">Previous</button><h1>Ready</h1><div style="height:2000px">Songs</div></body></html>`));
    let result=await browser.browserAction({action:'read'});
    assert.equal(result.ok,true);
    assert.ok(!JSON.stringify(result).includes('never-share-this'));
    const input=result.page.targets.find(target=>target.label==='Search music');
    result=await browser.browserAction({action:'type',id:input.id,token:result.page.token,text:'favorite songs'});
    assert.equal(result.ok,true);
    assert.equal(await view.webContents.executeJavaScript('document.querySelector("input[type=search]").value'),'favorite songs');
    const button=result.page.targets.find(target=>target.label==='Play liked songs');
    result=await browser.browserAction({action:'click',id:button.id,token:result.page.token});
    assert.ok(result.page.text.includes('Playing liked songs'));
    assert.equal((await browser.control({action:'next'})).executed,true);
    assert.equal(await view.webContents.executeJavaScript('document.querySelector("h1").textContent'),'Next song');
    assert.equal((await browser.control({action:'previous'})).executed,true);
    assert.equal(await view.webContents.executeJavaScript('document.querySelector("h1").textContent'),'Previous song');
    if (process.env.MIRROR_TEST_CODEX === '1') {
      const { CodexMirrorAgent } = require('../src/codexMirrorAgent');
      let calls = 0;
      const agent = new CodexMirrorAgent({ cwd: app.getPath('userData'), executeTool: async (tool, args) => {
        assert.equal(tool, 'browser_action'); calls++; return browser.browserAction(args);
      } });
      const outcome = await agent.run('Use browser_action read to inspect the current page, click its Play liked songs button using the returned id and token, and verify the resulting page. Do not open another site.');
      assert.equal(outcome.completed, true, JSON.stringify(outcome));
      assert.ok(calls >= 2, 'Codex must inspect and execute a browser action');
      assert.equal(await view.webContents.executeJavaScript('document.querySelector("h1").textContent'),'Playing liked songs');
      console.log('Live subscription-backed Codex passed: actual browser inspection, click and result verification.');
    }
    const stale=await browser.browserAction({action:'click',id:button.id,token:'old-token'});
    assert.equal(stale.ok,false);
    result=await browser.browserAction({action:'scroll',amount:500});
    assert.equal(result.ok,true);
    assert.ok(await view.webContents.executeJavaScript('scrollY>0'));
    await view.webContents.session.protocol.handle('https', () => new Response('<html><body><input aria-label="Subject" type="text"><div role="textbox" contenteditable="true" aria-label="Message body"></div><input type="password" value="secret"></body></html>', { headers: { 'content-type': 'text/html' } }));
    await view.webContents.loadURL('https://mail.google.com/mail/u/0/');
    result = await browser.browserAction({action:'read'});
    const subject = result.page.targets.find(target => target.label === 'Subject');
    result = await browser.browserAction({action:'type',id:subject.id,token:result.page.token,text:'Meeting tomorrow',compose:true});
    assert.equal(result.ok,true);
    assert.equal(await view.webContents.executeJavaScript('document.querySelector("input").value'),'Meeting tomorrow');
    const body = result.page.targets.find(target => target.label === 'Message body');
    result = await browser.browserAction({action:'type',id:body.id,token:result.page.token,text:'Hello Alex, can we meet tomorrow?',compose:true});
    assert.equal(result.ok,true);
    assert.equal(await view.webContents.executeJavaScript('document.querySelector("[contenteditable]").textContent'),'Hello Alex, can we meet tomorrow?');
    await view.webContents.session.protocol.unhandle('https');
    browser.hide();
    assert.equal((await browser.browserAction({action:'read'})).ok,false);
    console.log('Real browser passed: inspect, search typing, click, scroll, stale-target rejection and hidden-browser cancellation.');
    browser.dispose();win.destroy();app.exit(0);
  } catch(error) { console.error(error);browser.dispose();win.destroy();app.exit(1); }
}).catch(error=>{console.error(error);app.exit(1);});
