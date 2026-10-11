const assert = require('assert/strict');
const fs = require('fs');
const vm = require('vm');
const source = fs.readFileSync('src/renderer.js', 'utf8').replace(/\r\n/g, '\n');
const start = source.indexOf("window.addEventListener('keydown', (event) => {\n  resetIdle();");
const end = source.indexOf('\nresetIdle();', start);
assert(start >= 0 && end > start, 'Mirror shortcut handler missing');
const actions = [];
let shortcut, idleResets = 0;
vm.runInNewContext(source.slice(start, end), {
  resetIdle: () => { idleResets++; }, requestUserMode: mode => actions.push(mode),
  window: { addEventListener: (_event, callback) => { shortcut = callback; }, mirrorBridge: { toggleFullscreen: () => actions.push('fullscreen') } },
  elements: { cameraToggle: { click: () => actions.push('camera') }, diagnostics: { classList: { toggle: () => actions.push('diagnostics') } } }
});
const press = (key, extra = {}) => shortcut({ key, target: { tagName: 'BODY' }, ...extra });
for (const [key, expected] of [['1','portal'],['2','mirror'],['3','ar'],['4','watch'],['c','camera'],['F','fullscreen'],['d','diagnostics']]) {
  const before = actions.length; press(key); assert.equal(actions[before], expected);
  for (const extra of [{ctrlKey:true},{altKey:true},{metaKey:true},{repeat:true},{defaultPrevented:true},{isComposing:true},{keyCode:229},
    {target:{tagName:'INPUT'}},{target:{tagName:'SELECT'}},{target:{tagName:'TEXTAREA'}},{target:{tagName:'DIV',isContentEditable:true}}]) {
    const count = actions.length; press(key,extra);assert.equal(actions.length,count, `${key} activated during ${JSON.stringify(extra)}`);
  }
}
assert(idleResets > actions.length, 'Typing no longer resets idle sleep');
let watchKey,loads=0;
vm.runInNewContext(source.split('\n').find(line=>line.startsWith("elements.watchUrl.addEventListener('keydown'")),{elements:{watchUrl:{addEventListener:(_event,fn)=>watchKey=fn}},loadWatchVideo:()=>loads++});
for(const extra of [{isComposing:true},{keyCode:229},{repeat:true},{defaultPrevented:true}])watchKey({key:'Enter',...extra});
assert.equal(loads,0);watchKey({key:'Enter'});assert.equal(loads,1);
let searchKey,dismissed=0;
vm.runInNewContext(source.split('\n').find(line=>line.startsWith("window.addEventListener('keydown', event => { if (event.key === 'Escape'")),{window:{addEventListener:(_event,fn)=>searchKey=fn},hideSearchResult:()=>dismissed++});
searchKey({key:'Escape',isComposing:true});searchKey({key:'Escape',keyCode:229});searchKey({key:'Escape',defaultPrevented:true});assert.equal(dismissed,0);searchKey({key:'Escape'});assert.equal(dismissed,1);
console.log('Mirror shortcuts: mode/camera/fullscreen/diagnostics, text focus, consumed events, held keys and OS modifiers passed.');
