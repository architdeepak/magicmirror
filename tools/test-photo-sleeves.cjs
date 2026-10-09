const assert=require('assert/strict'),fs=require('fs'),vm=require('vm');
const scope=vm.createContext({});vm.runInContext(fs.readFileSync('src/longPhotoSleeves.js','utf8').replaceAll('export function','function'),scope);vm.runInContext(fs.readFileSync('src/sleeveNormals.js','utf8').replaceAll('export function','function'),scope);vm.runInContext(fs.readFileSync('src/photoSleeves.js','utf8').replace(/^import .*;\n/gm,'').replaceAll('export function','function'),scope);
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
pose[13].visibility=.1;const partial=scope.buildPhotoSleeves(pose,video,view,{photoPattern:pattern});assert.equal(partial.missingSleeves,1);assert(partial.length>128);
pose[13]={...pose[11]};assert.equal(scope.buildPhotoSleeves(pose,video,view,{photoPattern:pattern}).missingSleeves,1);
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

const longWidth=200,longHeight=220,longData=new Uint8ClampedArray(longWidth*longHeight*4);
for(let y=12;y<215;y++)for(let x=65;x<=135;x++)longData[(y*longWidth+x)*4+3]=255;
for(let y=20;y<=195;y++){const center=65-(y-20)*.3,radius=20-(y-20)*.055;for(let x=Math.max(0,Math.ceil(center-radius));x<=Math.floor(center+radius);x++){longData[(y*longWidth+x)*4+3]=255;longData[(y*longWidth+(longWidth-1-x))*4+3]=255;}}
const longPattern=scope.inferPhotoSleeves({width:longWidth,height:longHeight,data:longData});assert.equal(longPattern?.kind,'photo-long-sleeve');
assert(longPattern.bodySamples.length<=5);
assert.equal(longPattern.bodySamples[0].v,longPattern.underarm);
for(const row of longPattern.bodySamples)assert(row.left<row.right&&[row.v,row.left,row.right].every(Number.isFinite));
const flaredData=new Uint8ClampedArray(longData);
for(let y=145;y<215;y++)for(let x=60;x<=145;x++)flaredData[(y*longWidth+x)*4+3]=255;
const flared=scope.inferPhotoSleeves({width:longWidth,height:longHeight,data:flaredData});
assert.equal(flared?.kind,'photo-long-sleeve');
assert.equal(flared.sides[0].inner.u,65/longWidth,'Left root used the wider lower body edge');
assert.equal(flared.sides[1].inner.u,135/longWidth,'Right root used the wider lower body edge');
assert(flared.bodySamples.at(-1).right>flared.sides[1].inner.u,'Lower source body width was discarded');
console.log('Long-photo underarms: bounded contour rows and exact central-body seam despite wider asymmetric lower fabric passed.');
for(const side of longPattern.sides){assert(side.samples.length<32);assert.equal(side.samples[0].t,0);assert.equal(side.samples.at(-1).t,1);assert(side.samples.every((p,i)=>!i||p.t>side.samples[i-1].t));}
for(const [i,x,y]of [[11,.7,.3],[12,.3,.3],[13,.85,.45],[14,.15,.45],[15,.9,.7],[16,.1,.7],[23,.64,.62],[24,.36,.62]])Object.assign(pose[i],{x,y,z:0,visibility:1});
for(const length of [.7,1,1.5]){
 const mesh=scope.buildPhotoSleeves(pose,video,view,{photoPattern:longPattern,length});assert.equal(mesh.sleeveStyle,'photo-long-sleeve');assert.equal(mesh.coverForearms.length,2);for(const p of mesh.flat())assert([p.x,p.y,p.z,p.u,p.v].every(Number.isFinite));
 const uvMap=new Map();for(const p of mesh.flat()){const key=p.u.toFixed(8)+':'+p.v.toFixed(8),old=uvMap.get(key);if(old)assert(Math.hypot(old.x-p.x,old.y-p.y,old.z-p.z)<1e-6,'Long photo sleeve/body seam split');else uvMap.set(key,p);}
 if(length===1){for(const [i,side]of longPattern.sides.entries()){const ends=[side.cuffOuter,side.cuffInner].map(uv=>mesh.flat().find(p=>Math.abs(p.u-uv.u)<1e-8&&Math.abs(p.v-uv.v)<1e-8));assert(ends.every(Boolean));const wrist=pose[i===0?15:16];assert(Math.abs((ends[0].x+ends[1].x)/2-(view.width-wrist.x*video.width))<1e-6);assert(Math.abs((ends[0].y+ends[1].y)/2-wrist.y*video.height)<1e-6);}}
}
const partialHistory={};scope.buildPhotoSleeves(pose,video,view,{photoPattern:longPattern,normalHistory:partialHistory});assert.equal(Object.keys(partialHistory).length,6);
pose[15].visibility=.1;const oneSleeve=scope.buildPhotoSleeves(pose,video,view,{photoPattern:longPattern,normalHistory:partialHistory});assert.equal(Object.keys(partialHistory).length,3,'Hidden sleeve kept stale angle history');assert.equal(oneSleeve.missingSleeves,1);assert.equal(oneSleeve.coverForearms.length,1);assert(!oneSleeve.coverForearms.includes(15));pose[16].visibility=.1;const torsoOnly=scope.buildPhotoSleeves(pose,video,view,{photoPattern:longPattern});assert.equal(torsoOnly.missingSleeves,2);assert.equal(torsoOnly.coverForearms.length,0);assert(torsoOnly.length>0);pose[11].visibility=0;assert.equal(scope.buildPhotoSleeves(pose,video,view,{photoPattern:longPattern}),null);
console.log('Long photo sleeves: separated contours, bounded source samples, finite fitted lengths, sewn roots, exact wrist cuffs and honest one/both missing-arm torso coverage passed.');

// Allowance expands transverse coverage; it must rotate with the wearer.
for(const angle of [0,.4,-.4]){
 const coveragePose=Array.from({length:33},()=>({x:.5,y:.5,z:0,visibility:0}));
 const c=Math.cos(angle),sn=Math.sin(angle),cx=270,cy=480;
 for(const [i,x,y]of [[11,162,288],[12,378,288],[23,194.4,595.2],[24,345.6,595.2]]){
  const dx=x-cx,dy=y-cy;coveragePose[i]={x:(540-(cx+c*dx-sn*dy))/540,y:(cy+sn*dx+c*dy)/960,z:0,visibility:1};
 }
 const mesh=scope.buildPhotoSleeves(coveragePose,video,view,{photoPattern:longPattern});
 const hem=mesh.flat().filter(p=>Math.abs(p.v-longPattern.hem)<1e-8),a=hem.reduce((best,p)=>p.u<best.u?p:best),b=hem.reduce((best,p)=>p.u>best.u?p:best);
 assert(Math.abs(Math.hypot(b.x-a.x,b.y-a.y)-151.2*1.36)<1e-6,'Hem allowance changed under torso lean');
 assert(Math.abs((b.x-a.x)*sn-(b.y-a.y)*c)<1e-6,'Allowance stopped following torso axis');
 assert.equal(mesh.missingSleeves,2);assert.equal(mesh.coverForearms.length,0);
 const projected=i=>({x:540-coveragePose[i].x*540,y:coveragePose[i].y*960});
 const s0=projected(11),s1=projected(12),h0=projected(23),h1=projected(24);
 const top={x:(s0.x+s1.x)/2,y:(s0.y+s1.y)/2},bottom={x:(h0.x+h1.x)/2,y:(h0.y+h1.y)/2};
 const shoulderV=(longPattern.sides[0].outer.v+longPattern.sides[1].outer.v)/2;
 for(const q of [0,.5,1]){
  const u=longPattern.sides[0].outer.u+(longPattern.sides[1].outer.u-longPattern.sides[0].outer.u)*q;
  const vertex=mesh.flat().find(p=>Math.abs(p.u-u)<1e-8&&Math.abs(p.v-shoulderV)<1e-8);
  assert(vertex,'Missing shoulder row');
  const lift=q===.5?.035:.06;
  assert(Math.hypot(vertex.x-(top.x+(s1.x-s0.x)*(q-.5)*1.2-(bottom.x-top.x)*lift),vertex.y-(top.y+(s1.y-s0.y)*(q-.5)*1.2-(bottom.y-top.y)*lift))<1e-6,'Shoulder lift moved the neckline or stopped following lean');
 }
}
console.log('Torso allowance: bounded transverse hem width across frontal/leaning poses and torso-only recovery passed.');
console.log('Shoulder caps: fixed center neckline, bounded edge lift along the torso axis, unchanged hem across frontal and opposite lean passed.');
let gridCalls=0;
const sharedGrid=scope.grid(4,8,(x,y)=>{gridCalls++;return{x,y,z:0,u:x,v:y}});
assert.equal(gridCalls,45,'Shared grid points were recalculated');
assert.equal(sharedGrid.length,64);
assert.equal(new Set(sharedGrid.flat()).size,45,'Neighboring triangles did not share grid vertices');
const reference=[];
for(let y=0;y<8;y++)for(let x=0;x<4;x++){
 const point=(u,v)=>({x:u,y:v,z:0,u,v});
 const a=point(x/4,y/8),b=point((x+1)/4,y/8),c=point((x+1)/4,(y+1)/8),d=point(x/4,(y+1)/8);
 reference.push([a,b,c],[a,c,d]);
}
assert.deepEqual(JSON.parse(JSON.stringify(sharedGrid)),reference,'Vertex reuse changed triangle order or coordinates');
console.log('Photo grid reuse: exact coordinates/triangle order, 45 mappings for 64 triangles and shared neighboring vertices passed.');
