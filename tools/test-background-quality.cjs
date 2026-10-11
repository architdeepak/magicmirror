const fs = require('fs'), vm = require('vm'), assert = require('assert/strict');
const source = fs.readFileSync('src/renderer.js','utf8');
let resizes = 0, dirty = 0;
const scope = vm.createContext({ mode:'mirror', depthEnabled:false, softwareGraphics:false,
  elements:{awakening:{classList:{contains:()=>false}}}, renderBudget:{targetFps:60},
  renderQuality:{frames:0,elapsed:0,fps:60,pixelRatio:1.5,maxPixelRatio:2},
  renderer:{setPixelRatio(){},setSize(){resizes++}},sceneBudget:{invalidate(){dirty++}} });
vm.runInContext(source.slice(source.indexOf('function updateRenderQuality(')),scope);
const sample = (dt, count) => { for(let frame=0;frame<count;frame++)scope.updateRenderQuality(dt,{width:540,height:960}); };
sample(.1,24);assert.equal(resizes,0,'Standby degraded background');
scope.mode='portal';sample(1/30,64);assert.equal(resizes,0,'Flat portrait resized a cached scene');
scope.depthEnabled=true;sample(1/30,64);assert.equal(resizes,1,'Active depth scene did not adapt');assert.equal(dirty,1);
console.log('Background quality: idle heartbeat and flat portrait preserve cached scene; active depth still adapts.');
