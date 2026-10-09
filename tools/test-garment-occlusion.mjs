import assert from 'node:assert/strict';
import {foregroundLimbSegments,occlusionBodyWidth} from '../src/garmentLimbOcclusion.js';
const project=i=>({...pose[i],x:pose[i].x*100,y:pose[i].y*100});
const pose=Array.from({length:33},()=>({x:.5,y:.5,z:0,visibility:0}));
for(const i of [11,12,23,24])pose[i]={x:i%2?.3:.7,y:i<20?.3:.7,z:0,visibility:1};
pose[13]={x:.2,y:.45,z:.1,visibility:1};pose[15]={x:.7,y:.5,z:-.2,visibility:1};pose[19]={x:.75,y:.5,z:-.25,visibility:1};
let s=foregroundLimbSegments(pose);assert.equal(s.length,2);assert.equal(s[0].part,'forearm');assert(Math.abs(s[0].from.x-.425)<1e-8);assert.equal(s[0].to,pose[15]);
pose[13].z=-.2;pose[15].z=.1;s=foregroundLimbSegments(pose);assert.equal(s[0].from,pose[13]);assert(s[0].to.x<.5);assert.equal(s[1].part,'hand');assert(s[1].from.x>pose[15].x);
assert(foregroundLimbSegments(pose,{coverForearms:true}).every(s=>s.part==='hand'));
pose[13].visibility=0;assert.equal(foregroundLimbSegments(pose).length,1,'Hidden elbow hid visible hand');
pose[11]=pose[12]=null;assert.equal(foregroundLimbSegments(pose).length,1);assert.equal(occlusionBodyWidth(pose,project),60);
pose[11]={x:.5,y:.3,z:0,visibility:1};pose[12]={...pose[11]};assert.equal(occlusionBodyWidth(pose,project),60,'Collapsed shoulders failed hip width fallback');pose[11]=pose[12]=null;
pose[23].z=NaN;assert.equal(foregroundLimbSegments(pose).length,0);pose[24]=null;assert.equal(occlusionBodyWidth(pose,project),0);
pose[11]={x:.3,y:.3,z:0,visibility:1};pose[12]={x:.7,y:.3,z:0,visibility:1};pose[15].z=undefined;assert.equal(foregroundLimbSegments(pose).length,0);
console.log('Garment occlusion: front/behind/crossing depth clips, hand without elbow, covered forearms, missing shoulders, hip fallback and invalid depth passed.');

const {interpolateSleeveNormal}=await import('../src/sleeveNormals.js');
for(const angle of [0,.5,Math.PI-1e-8,Math.PI,Math.PI+1e-8])for(const t of [0,.125,.5,.875,1]){const n=interpolateSleeveNormal({x:1,y:0},{x:Math.cos(angle),y:Math.sin(angle)},t);assert(Math.abs(Math.hypot(n.x,n.y)-1)<1e-10);}
console.log('Sleeve cross-sections remain unit length across opposed and nearly opposed directions instead of collapsing at the midpoint.');

const {sleeveNormalRotation}=await import('../src/sleeveNormals.js');const history={};let previous;for(const angle of [Math.PI-.02,Math.PI-.01,Math.PI,Math.PI+.01,Math.PI+.02]){const n=sleeveNormalRotation({x:1,y:0},{x:Math.cos(angle),y:Math.sin(angle)},history,'left')(.5);if(previous)assert(Math.hypot(n.x-previous.x,n.y-previous.y)<.01,'Angle-wrap crossing flipped the sleeve');previous=n;}assert.equal(Object.keys(history).length,1);
console.log('Tracked sleeve angles cross +/-pi continuously with a bounded per-arm history.');
