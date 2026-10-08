const assert = require('assert/strict'), fs = require('fs'), vm = require('vm');
const source = fs.readFileSync('src/wardrobePhoto.js','utf8');
const context = vm.createContext({ Uint8ClampedArray, Uint32Array, Uint8Array });
vm.runInContext(source.slice(0,source.indexOf('export class')).replace('export function','function'), context);
function picture(bg,fg) {
 const data = new Uint8ClampedArray(20*20*4);
 for(let y=0;y<20;y++)for(let x=0;x<20;x++){const color=x>4&&x<15&&y>3&&y<17?fg:bg;data.set([...color,255],(y*20+x)*4)}
 return {width:20,height:20,data};
}
for(const background of [[250,250,250],[20,35,60],[160,75,30]]) {
 const input=picture(background,[35,150,65]), result=context.cutoutPhoto(input);
 assert.equal(result.data[3],0);assert.equal(result.data[(10*20+10)*4+3],255);
 assert.equal(input.data[3],255,'Changed source instead of reversible preview');
 assert.equal(result.bounds.width,10);assert.equal(result.bounds.height,13);
}
assert.throws(()=>context.cutoutPhoto(picture([250,250,250],[245,245,245])),/disappeared/);
assert.equal(context.cutoutPhoto(picture([250,250,250],[245,245,245]),{removeBackground:false}).data[3],255);
const noisy=picture([250,250,250],[30,30,30]);noisy.data.set([0,0,0,255],0);assert.throws(()=>context.cutoutPhoto(noisy),/plain background/);
assert.throws(()=>context.cutoutPhoto({width:4096,height:4096,data:new Uint8ClampedArray(0)}),/smaller/);
console.log('Wardrobe photo: reversible cutout on light/dark/colored backgrounds, crops, contrast warning, complex background rejection, bounded work.');
const cropped=context.cutoutPhoto(picture([250,250,250],[35,150,65]),{topPercent:30,bottomPercent:65});
assert.equal(cropped.bounds.top,6);assert.equal(cropped.bounds.height,7);
assert.throws(()=>context.cutoutPhoto(picture([250,250,250],[35,150,65]),{topPercent:90,bottomPercent:91}),/at least 5%/);
const maskScope=vm.createContext({Uint8ClampedArray});
vm.runInContext(fs.readFileSync('src/photoClothing.js','utf8').split('export function extractPhotoClothing')[0].replace('export function','function'),maskScope);
const original=picture([250,250,250],[35,150,65]),classes=new Uint8Array(400);classes.fill(4);classes.fill(2,0,100);
const masked=maskScope.applyClothingMask(original,{width:20,height:20,classes});
assert.equal(masked.data[3],0);assert.equal(original.data[3],255);
for(let p=0;p<original.data.length;p+=4)for(let c=0;c<3;c++)assert.equal(masked.data[p+c],original.data[p+c]);
assert.throws(()=>maskScope.applyClothingMask(original,{width:20,height:20,classes:new Uint8Array(400)}),/Not enough clothing/);
assert.throws(()=>maskScope.applyClothingMask(original,{width:20,height:20,classes:[]}),/Invalid/);
console.log('Worn photo: clothing-only alpha, unchanged RGB/source, empty/invalid masks rejected; reversible crop bounds.');

const {wardrobePhotoBytes}=require('../src/wardrobePhotoValidation.cjs');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jGZkAAAAASUVORK5CYII=','base64');
const url=b=>'data:image/png;base64,'+b.toString('base64');
assert.equal(wardrobePhotoBytes(url(png)).length,png.length);
const giant=Buffer.from(png);giant.writeUInt32BE(65535,16);assert.throws(()=>wardrobePhotoBytes(url(giant)),/1024/);
assert.throws(()=>wardrobePhotoBytes('data:image/png;base64,aaaa'),/valid PNG/);
assert.throws(()=>wardrobePhotoBytes(url(Buffer.alloc(40))),/valid PNG/);
console.log('Wardrobe PNG boundary: valid image bytes, oversized declared dimensions and invalid headers checked before decoding.');

(async()=>{
 const scope=vm.createContext({Uint8ClampedArray,Uint32Array,Uint8Array});
 vm.runInContext(source.replaceAll('export function','function').replace('export class','class')+';globalThis.Subject=WardrobePhoto;',scope);
 const subject=Object.create(scope.Subject.prototype),buttons={capture:{},save:{}},pending=[],notices=[];
 Object.assign(subject,{generation:0,dialog:{open:true},video:{},button:name=>buttons[name],status:message=>notices.push(message),syncViews:()=>{},ensureCamera:()=>new Promise(resolve=>pending.push(resolve)),setSource:()=>{throw new Error('Old capture replaced a new photo')}});
 const first=subject.capture();assert(subject.capturePending);
 subject.generation++;subject.dialog.open=false;subject.generation++;subject.dialog.open=true;subject.output='new photo';
 assert(!subject.capturePending,'A closed editor kept a new photo blocked by an old camera request');
 const next=subject.capture();assert(subject.capturePending);pending[0](false);await first;
 assert(subject.capturePending,'Old camera completion cleared a newer capture');
 pending[1](false);await next;assert(!subject.capturePending);assert.equal(subject.output,'new photo');
 assert.equal(notices.filter(n=>n.includes('unavailable')).length,1,'Stale capture changed the new editor notice');
 console.log('Wardrobe capture ownership: closed/uploaded/reopened photo scopes ignore stale camera completion and preserve the current capture.');
 scope.window={};
 const view=Object.create(scope.Subject.prototype),fields=Object.fromEntries(['file','phone','remove','tolerance','crop-top','crop-bottom'].map(key=>[key,{}])),controls=Object.fromEntries(['front','back','remove-back','capture','extract','restore','save'].map(key=>[key,{setAttribute(){}}]));
 let finishCamera;
 const front={width:1,height:1,data:new Uint8ClampedArray(4)};
 Object.assign(view,{generation:10,activeView:'front',views:{},dialog:{open:true},source:front,output:'front-png',original:'front-original',video:{},field:key=>fields[key],button:key=>controls[key],canvas:{width:480,height:540,getContext:()=>({clearRect(){}})},status(){},ensureCamera:()=>new Promise(resolve=>finishCamera=resolve),preview(){this.syncViews()}});
 const camera=view.capture();view.switchView('back');assert(view.readyToSave,'Optional empty back blocked the reviewed front');assert.equal(view.views.front.source,front);
 finishCamera(false);await camera;assert.equal(controls.save.disabled,false,'Old front capture changed the back editor readiness');assert.equal(view.source,null,'Old front capture populated the back view');
 view.switchView('front');assert.equal(view.source,front);assert.equal(view.original,'front-original');assert(view.readyToSave);
 console.log('Paired photo ownership: view changes preserve drafts, ignore old camera completion and allow a reviewed front with an optional empty back.');
})().catch(error=>{console.error(error);process.exitCode=1});
