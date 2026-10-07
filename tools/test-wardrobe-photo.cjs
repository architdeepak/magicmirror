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
 Object.assign(subject,{generation:0,dialog:{open:true},video:{},button:name=>buttons[name],status:message=>notices.push(message),ensureCamera:()=>new Promise(resolve=>pending.push(resolve)),setSource:()=>{throw new Error('Old capture replaced a new photo')}});
 const first=subject.capture();assert(subject.capturePending);
 subject.generation++;subject.dialog.open=false;subject.generation++;subject.dialog.open=true;subject.output='new photo';
 assert(!subject.capturePending,'A closed editor kept a new photo blocked by an old camera request');
 const next=subject.capture();assert(subject.capturePending);pending[0](false);await first;
 assert(subject.capturePending,'Old camera completion cleared a newer capture');
 pending[1](false);await next;assert(!subject.capturePending);assert.equal(subject.output,'new photo');
 assert.equal(notices.filter(n=>n.includes('unavailable')).length,1,'Stale capture changed the new editor notice');
 console.log('Wardrobe capture ownership: closed/uploaded/reopened photo scopes ignore stale camera completion and preserve the current capture.');
})().catch(error=>{console.error(error);process.exitCode=1});
