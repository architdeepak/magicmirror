const assert=require('assert/strict'),fs=require('fs'),vm=require('vm');
const ctx=vm.createContext({});vm.runInContext(fs.readFileSync('src/sleeveNormals.js','utf8').replaceAll('export function','function'),ctx);vm.runInContext(fs.readFileSync('src/starterSleeves.js','utf8').replace(/^import .*;\n/gm,'').replace('export function','function'),ctx);
const pose=Array.from({length:33},()=>({x:.5,y:.5,z:0,visibility:0}));
for(const [i,x,y]of [[11,.7,.3],[12,.3,.3],[23,.64,.62],[24,.36,.62],[13,.86,.47],[14,.14,.47],[15,.9,.66],[16,.1,.66]])Object.assign(pose[i],{x,y,visibility:1});
const video={width:540,height:960},viewport={width:540,height:960},bounds={left:0,top:0,width:512,height:512,scale:1};
for(const sleeveStyle of ['long sleeve','t-shirt','blouse']){
 const fit={sleeveStyle,textureBounds:bounds};const triangles=ctx.buildStarterSleeves(pose,video,viewport,fit);assert(triangles.length>128);
 for(const triangle of triangles)for(const p of triangle)assert([p.x,p.y,p.z,p.u,p.v].every(Number.isFinite));
 const bodyDepth=triangles.map(t=>t.reduce((n,p)=>n+p.z,0)/3);assert(bodyDepth.every((n,i)=>!i||n<=bodyDepth[i-1]));
 // Corresponding UVs at each root must share their exact sewn body endpoint.
 const verts=triangles.flat();for(const [u,v]of [[145/512,62/512],[367/512,62/512]]){const root=verts.filter(p=>Math.abs(p.u-u)<1e-9&&Math.abs(p.v-v)<1e-9);assert(root.length>=2);assert(root.every(p=>Math.hypot(p.x-root[0].x,p.y-root[0].y)<1e-7),'Sleeve separated from body at seam');}
}
for(const style of ['long sleeve','t-shirt','blouse']){
 const history={};
 for(const arms of [[[.86,.2,.9,.08],[.14,.2,.1,.08]],[[.3,.45,.42,.5],[.7,.45,.58,.5]],[[.86,.47,.75,.35],[.14,.47,.25,.35]]]){
  for(const [side,[ex,ey,wx,wy]]of arms.entries()){Object.assign(pose[13+side],{x:ex,y:ey,z:-.1});Object.assign(pose[15+side],{x:wx,y:wy,z:-.2});}
  const mesh=ctx.buildStarterSleeves(pose,video,viewport,{sleeveStyle:style,textureBounds:bounds,normalHistory:history});assert(mesh?.length>128);for(const p of mesh.flat())assert([p.x,p.y,p.z,p.u,p.v].every(Number.isFinite));
  for(const u of [145/512,367/512]){const root=mesh.flat().filter(p=>Math.abs(p.u-u)<1e-9&&Math.abs(p.v-62/512)<1e-9);assert(root.every(p=>Math.hypot(p.x-root[0].x,p.y-root[0].y)<1e-7));}
 }
 assert(Object.keys(history).length<=6);
}
console.log('Starter raised/crossed/folded pose matrix: finite geometry, attached seams and bounded tracked angle history passed.');
const fit={sleeveStyle:'long sleeve',textureBounds:bounds};pose[15].visibility=0;assert.equal(ctx.buildStarterSleeves(pose,video,viewport,fit),null);pose[15].visibility=1;pose[15].x=pose[13].x;pose[15].y=pose[13].y;assert.equal(ctx.buildStarterSleeves(pose,video,viewport,fit),null);
assert.equal(ctx.buildStarterSleeves(pose,video,viewport,{sleeveStyle:'unknown',textureBounds:bounds}),null);
console.log('Starter sleeve geometry: known patterns, shared root seams, finite vertices, depth ordering, missing/degenerate arm fallback.');
