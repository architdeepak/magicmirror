const assert=require('assert/strict'),fs=require('fs'),vm=require('vm');
const scope=vm.createContext({});vm.runInContext(fs.readFileSync('src/sleeveNormals.js','utf8').replaceAll('export function','function'),scope);vm.runInContext(fs.readFileSync('src/photoSleeves.js','utf8').replace(/^import .*;\n/gm,'').replaceAll('export function','function'),scope);
const width=100,height=100,data=new Uint8ClampedArray(width*height*4);
for(let y=5;y<99;y++){
 const left=y<20?30-(y-5):y<45?15-(y-20)*.6:y<55?(y-45)*2.5:25;
 for(let x=Math.ceil(left);x<=Math.floor(100-left)&&x<100;x++)data[(y*width+x)*4+3]=255;
}
const pattern=scope.inferPhotoSleeves({width,height,data});assert(pattern,'Recognizable short sleeve outline rejected');
assert.equal(pattern.kind,'photo-short-sleeve');assert(pattern.sides.every(s=>s.outer.v<s.inner.v));
assert.equal(scope.inferPhotoSleeves({width,height,data:new Uint8ClampedArray(data.length)}),null);
assert.equal(scope.inferPhotoSleeves({width,height,data:new Uint8ClampedArray(data.length).fill(255)}),null,'Rectangular photo incorrectly assumed to have sleeves');
const pose=Array.from({length:33},()=>({x:.5,y:.5,z:0,visibility:0}));
for(const [i,x,y]of [[11,.7,.3],[12,.3,.3],[23,.64,.62],[24,.36,.62],[13,.86,.47],[14,.14,.47]])Object.assign(pose[i],{x,y,visibility:1});
const video={width:540,height:960},view={width:540,height:960};
for(const mode of ['down','raised','crossed']){
 if(mode==='raised'){Object.assign(pose[13],{x:.86,y:.2});Object.assign(pose[14],{x:.14,y:.2});}
 if(mode==='crossed'){Object.assign(pose[13],{x:.3,y:.45,z:-.3});Object.assign(pose[14],{x:.7,y:.45,z:-.1});}
 const mesh=scope.buildPhotoSleeves(pose,video,view,{photoPattern:pattern});assert(mesh.length>128);
 for(const p of mesh.flat())assert([p.x,p.y,p.z,p.u,p.v].every(Number.isFinite));
 // The body and sleeve UV roots must also share screen coordinates.
 const byUV=new Map();for(const tri of mesh)for(const p of tri){const key=p.u.toFixed(8)+':'+p.v.toFixed(8);const previous=byUV.get(key);if(previous)assert(Math.hypot(p.x-previous.x,p.y-previous.y)<1e-6,'Photo seam split');else byUV.set(key,p);}
}
pose[13].visibility=.1;assert.equal(scope.buildPhotoSleeves(pose,video,view,{photoPattern:pattern}),null);
pose[13]={...pose[11]};assert.equal(scope.buildPhotoSleeves(pose,video,view,{photoPattern:pattern}),null);
console.log('Photo sleeves: silhouette inference, rectangle/empty rejection, finite down/raised/crossed geometry, shared UV seams and missing/degenerate arm fallback.');

const world=Array.from({length:33},()=>({x:0,y:0,z:0}));
world[11]={x:.2,y:-.45,z:0};world[12]={x:-.2,y:-.45,z:0};world[23]={x:.16,y:0,z:0};world[24]={x:-.16,y:0,z:0};
const sides=[{sIndex:11,hIndex:23,s:{x:100,y:100},h:{x:120,y:400}},{sIndex:12,hIndex:24,s:{x:300,y:100},h:{x:280,y:400}}];
const point={x:200,y:200,z:0,u:.5,v:.4};
const front=scope.createTorsoCurve(sides,world,540);assert(front.enabled);
assert.equal(front.curve(point,.5,.4).x,point.x,'Frontal garment/logo projection changed');
assert(front.curve(point,.5,.4).z<point.z,'Front panel was not closer than its seams');
for(const q of [0,1])assert.deepEqual(JSON.parse(JSON.stringify(front.curve(point,q,.4))),point,'Curved panel moved a sewn root');
world[12].z=.25;world[24].z=.25;const right=scope.createTorsoCurve(sides,world,540);assert(right.curve(point,.5,.4).x>point.x);
world[12].z=-.25;world[24].z=-.25;const left=scope.createTorsoCurve(sides,world,540);assert(left.curve(point,.5,.4).x<point.x);
world[12].z=4;assert.equal(scope.createTorsoCurve(sides,world,540).enabled,false,'Implausible 3D depth distorted the garment');
world[12].z=NaN;assert.equal(scope.createTorsoCurve(sides,world,540).enabled,false);
assert.equal(scope.createTorsoCurve(sides,null,540).enabled,false);
assert.equal(scope.createTorsoCurve([],world,540).enabled,false);
assert.equal(scope.createTorsoCurve([null,null],world,540).enabled,false);
assert.equal(scope.createTorsoCurve(sides,world,540,NaN).enabled,false);
world[12].z=.25;world[24].z=.25;
pose[13]={x:.86,y:.35,z:-.2,visibility:1};pose[11].z=-.15;pose[12].z=.15;
const curved=scope.buildPhotoSleeves(pose,video,view,{photoPattern:pattern,worldPose:world});assert(curved.curvedTorso);
const curvedByUV=new Map();for(const tri of curved)for(const p of tri){const key=p.u.toFixed(8)+':'+p.v.toFixed(8);const before=curvedByUV.get(key);if(before)assert(Math.hypot(p.x-before.x,p.y-before.y,p.z-before.z)<1e-6,'Curved surface split a sewn root');else curvedByUV.set(key,p);}
console.log('Curved torso: unchanged frontal projection and sewn roots, camera-facing depth, opposite yaw shifts, missing/invalid/extreme world-pose fallback.');
