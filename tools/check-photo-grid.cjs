// Isolates vertex reuse from the shoulder change; no raster or power benchmark.
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),{performance}=require('perf_hooks'),{createHash}=require('crypto');
const source=fs.readFileSync('src/photoSleeves.js','utf8');
const legacy='function grid(columns,rows,map){const result=[];for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){const a=map(x/columns,y/rows),b=map((x+1)/columns,y/rows),c=map((x+1)/columns,(y+1)/rows),d=map(x/columns,(y+1)/rows);result.push([a,b,c],[a,c,d])}return result}';
const before=source.slice(0,source.indexOf('function grid('))+legacy;
function context(text){const c=vm.createContext({});for(const file of ['src/longPhotoSleeves.js','src/sleeveNormals.js'])vm.runInContext(fs.readFileSync(file,'utf8').replaceAll('export function','function'),c);vm.runInContext(text.replace(/^import .*;\n/gm,'').replaceAll('export function','function'),c);return c;}
const old=context(before),current=context(source),pattern=JSON.parse(fs.readFileSync('artifacts/torso-coverage-replay/result.json')).pattern;
let calls=0;const mapped=current.grid(4,8,(x,y)=>{calls++;return{x,y,u:x,v:y,z:0}});assert.equal(calls,45);assert.equal(mapped.length,64);assert.equal(new Set(mapped.flat()).size,45);
const rows=[];
for(const second of [1,6,12,18]){
 const bytes=fs.readFileSync('artifacts/photo-fit-motion/replay-'+second+'.json'),input=JSON.parse(bytes);
 const build=c=>c.buildPhotoSleeves(input.pose,input.video,input.viewport,{...input.fit,worldPose:input.worldPose,normalHistory:{},photoPattern:pattern});
 const a=build(old),b=build(current);assert.deepEqual(JSON.parse(JSON.stringify(b)),JSON.parse(JSON.stringify(a)),'Vertex reuse changed geometry');
 if(!b){rows.push({second,visible:false});continue;}
 assert.equal(b.missingSleeves,a.missingSleeves);assert.deepEqual(Array.from(b.coverForearms),Array.from(a.coverForearms));
 const uniqueBefore=new Set(a.flat()).size,uniqueAfter=new Set(b.flat()).size;assert(uniqueAfter<uniqueBefore);
 for(let i=0;i<50;i++){build(old);build(current);}
 const times={before:[],after:[]};
 // Alternate order to reduce a consistent first/second bias on this shared host.
 for(let round=0;round<12;round++)for(const key of (round%2?['after','before']:['before','after'])){
  const c=key==='before'?old:current,start=performance.now();for(let i=0;i<100;i++)build(c);times[key].push((performance.now()-start)/100);
 }
 const stats=a=>{a.sort((x,y)=>x-y);return{medianMs:a[Math.floor(a.length/2)],minMs:a[0],maxMs:a.at(-1),batchMeansMs:a}};
 rows.push({second,visible:true,triangles:b.length,uniqueBefore,uniqueAfter,before:stats(times.before),after:stats(times.after)});
}
const report={passed:true,sourceSha256:createHash('sha256').update(source).digest('hex'),scope:'Node VM geometry-only construction on shared DGX Spark. Current shoulder geometry versus the same source with the old grid mapper; real saved garment pattern and frozen pose/world inputs. Exact serialized vertices/triangles and limb ownership match. Timings exclude canvas raster, tracking, screen rendering and power; they are not Windows or FPS qualification.',grid:{mapCalls:45,triangles:64},cases:rows};
fs.mkdirSync('artifacts/photo-grid',{recursive:true});fs.writeFileSync('artifacts/photo-grid/result.json',JSON.stringify(report,null,2));console.log(JSON.stringify({passed:true,cases:rows.map(({second,uniqueBefore,uniqueAfter,before,after})=>({second,uniqueBefore,uniqueAfter,beforeMs:before?.medianMs,afterMs:after?.medianMs}))}));
