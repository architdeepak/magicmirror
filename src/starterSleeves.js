// Bind known starter sewing regions to body/arm chains. This is an articulated
// photographic surface; no claim of cloth physics or automatic garment fitting.
const patterns = {
  'long sleeve': { underarm: [159,188], cuff: [[71,413],[133,427]], hem: 145, long: true },
  't-shirt': { underarm: [151,177], cuff: [[60,161],[128,207]], hem: 145, reach: .65 },
  blouse: { underarm: [159,167], cuff: [[65,277],[133,297]], hem: 143, reach: .9 }
};
export function buildStarterSleeves(pose, video, viewport, fit) {
  const pattern = patterns[fit.sleeveStyle], bounds = fit.textureBounds;
  if (!pattern || !bounds) return null;
  const valid = id => pose?.[id] && (pose[id].visibility ?? 1) >= .55 && Number.isFinite(pose[id].x) && Number.isFinite(pose[id].y);
  const ids = [11,12,13,14,23,24,...(pattern.long ? [15,16] : [])];
  if (!ids.every(valid)) return null;
  const cameraScale = Math.max(viewport.width / video.width, viewport.height / video.height);
  const project = id => ({ x: viewport.width - ((viewport.width-video.width*cameraScale)/2+pose[id].x*video.width*cameraScale), y: (viewport.height-video.height*cameraScale)/2+pose[id].y*video.height*cameraScale, z: pose[id].z || 0 });
  const sides = [{s:project(11),h:project(23),e:project(13),w:pattern.long?project(15):null},{s:project(12),h:project(24),e:project(14),w:pattern.long?project(16):null}].sort((a,b)=>a.s.x-b.s.x);
  const shoulderWidth = dist(sides[0].s,sides[1].s),top=lerp(sides[0].s,sides[1].s,.5),bottom=lerp(sides[0].h,sides[1].h,.5);
  if (shoulderWidth < 20 || dist(top,bottom) < 25 || sides.some(s=>dist(s.s,s.e)<8 || (s.w&&dist(s.e,s.w)<8))) return null;
  const width = fit.width ?? 1, length=fit.length ?? 1,offset=fit.offset??0;
  const uv = (x,y) => ({u:(x*bounds.scale-bounds.left)/bounds.width,v:(y*bounds.scale-bounds.top)/bounds.height});
  const leftAt = y => y<=pattern.underarm[1] ? 145+(pattern.underarm[0]-145)*(y-62)/(pattern.underarm[1]-62) : pattern.underarm[0]+(pattern.hem-pattern.underarm[0])*(y-pattern.underarm[1])/(455-pattern.underarm[1]);
  const bodyPoint = (q,y) => {
    const t=(y-62)/(455-62)*length, center=lerp(top,bottom,t+offset),a=lerp(sides[0].s,sides[0].h,Math.max(0,Math.min(1,t))),b=lerp(sides[1].s,sides[1].h,Math.max(0,Math.min(1,t)));
    const left=leftAt(y),sourceX=left+(512-2*left)*q;
    return {...center,x:center.x+(b.x-a.x)*(q-.5)*width,y:center.y+(b.y-a.y)*(q-.5)*width,...uv(sourceX,y)};
  };
  const bodyRows=[35,62,pattern.underarm[1],250,320,390,455,470];
  const triangles=grid(8,bodyRows.length-1,(q,t)=>bodyPoint(q,bodyRows[Math.round(t*(bodyRows.length-1))]));
  sides.forEach((side,index)=>{
    const mirror = x => index === 0 ? x : 512-x;
    const rootOuter=bodyPoint(index,62),rootInner=bodyPoint(index,pattern.underarm[1]),rootCenter=lerp(rootOuter,rootInner,.5);
    const rootNormal=normal(rootInner,rootOuter),rootRadius=dist(rootOuter,rootInner)/2;
    const cuff=pattern.long?side.w:lerp(side.s,side.e,pattern.reach);
    const upper=perpendicular(side.s,side.e,index),lower=pattern.long?perpendicular(side.e,cuff,index):upper;
    const middle=unit({x:upper.x+lower.x,y:upper.y+lower.y});
    const outerSrc=[145,62],innerSrc=pattern.underarm;
    triangles.push(...grid(4,8,(q,t)=>{
      const along=t*length;
      let center,n;
      if(pattern.long){const first=along<=.5,fraction=first?along*2:(along-.5)*2;center=lerp(first?rootCenter:side.e,first?side.e:cuff,fraction);n=unit(lerp(first?rootNormal:middle,first?middle:lower,Math.max(0,Math.min(1,fraction))));}
      else {center=lerp(rootCenter,cuff,along);n=unit(lerp(rootNormal,upper,Math.max(0,Math.min(1,along))));}
      const radius=rootRadius*(1-Math.max(0,Math.min(1,along)))+shoulderWidth*width*.095*Math.max(0,Math.min(1,along));
      const rootSource=lerp({x:outerSrc[0],y:outerSrc[1]},{x:innerSrc[0],y:innerSrc[1]},q);
      const cuffSource=lerp({x:pattern.cuff[0][0],y:pattern.cuff[0][1]},{x:pattern.cuff[1][0],y:pattern.cuff[1][1]},q);
      const source=lerp(rootSource,cuffSource,t);
      return {...center,x:center.x+n.x*radius*(1-2*q),y:center.y+n.y*radius*(1-2*q)+offset*dist(top,bottom)*Math.min(1,t*2),...uv(mirror(source.x),source.y)};
    }));
  });
  triangles.sort((a,b)=>averageZ(b)-averageZ(a));
  triangles.sleeveStyle = fit.sleeveStyle;
  return triangles;
}
function grid(columns,rows,map){const triangles=[];for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){const a=map(x/columns,y/rows),b=map((x+1)/columns,y/rows),c=map((x+1)/columns,(y+1)/rows),d=map(x/columns,(y+1)/rows);triangles.push([a,b,c],[a,c,d])}return triangles}
function lerp(a,b,t){return{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:(a.z||0)+((b.z||0)-(a.z||0))*t}}
function dist(a,b){return Math.hypot(b.x-a.x,b.y-a.y)}
function unit(v){const n=Math.hypot(v.x,v.y)||1;return{x:v.x/n,y:v.y/n}}
function normal(a,b){return unit({x:b.x-a.x,y:b.y-a.y})}
function perpendicular(a,b,index){const sign=index===0?1:-1;return unit({x:-(b.y-a.y)*sign,y:(b.x-a.x)*sign})}
function averageZ(t){return t.reduce((sum,p)=>sum+p.z,0)/3}
