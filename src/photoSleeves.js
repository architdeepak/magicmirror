import { inferLongPhotoSleeves, samplePhotoSleeve } from './longPhotoSleeves.js';
import { sleeveNormalRotation } from './sleeveNormals.js';
// Infer separated long sleeves or a short-sleeved front once at image load.
// Ambiguous outlines keep a bounded torso preview. This does
// not reconstruct hidden fabric or infer physical size.
export function inferPhotoSleeves({ width, height, data }, onReject = () => {}) {
  const long=inferLongPhotoSleeves({width,height,data});if(long)return long;
  const reject = reason => { onReject(reason); return null; };
  if (width < 40 || height < 40 || width * height > 1024 * 1024 || data.length !== width * height * 4) return reject('small image');
  const rows = [];
  for (let y = 0; y < height; y++) {
    let left = width, right = -1;
    for (let x = 0; x < width; x++) if (data[(y * width + x) * 4 + 3] > 32) { left = Math.min(left, x); right = x; }
    rows.push({ left, right });
  }
  const lower = rows.slice(Math.round(height * .7), Math.round(height * .9)).filter(r => r.right > r.left);
  if (lower.length < height * .1) return reject('missing lower body');
  const median = values => values.sort((a,b) => a-b)[Math.floor(values.length/2)];
  const bodyLeft = median(lower.map(r => r.left)), bodyRight = median(lower.map(r => r.right));
  const bodyWidth = bodyRight - bodyLeft;
  if (bodyWidth < width * .3 || bodyWidth > width * .9) return reject('ambiguous body width');
  let widest = 0;
  for (let y = 0; y < height * .6; y++) if (rows[y].right - rows[y].left > rows[widest].right - rows[widest].left) widest = y;
  const extreme = rows[widest];
  if (bodyLeft - extreme.left < width * .075 || extreme.right - bodyRight < width * .075) return reject('missing sleeve extension');
  let underarm = -1;
  for (let y = widest + 1; y < height * .65; y++) {
    const span = rows.slice(y, y + Math.ceil(height * .05));
    if (span.every(r => r.right > r.left && r.left >= bodyLeft - width * .035 && r.right <= bodyRight + width * .035)) { underarm = y; break; }
  }
  if (underarm < height * .18 || underarm < 0) return reject('ambiguous underarm');
  const sides = [];
  for (const [bodyX, extremeX, sign] of [[bodyLeft, extreme.left, 1], [bodyRight, extreme.right, -1]]) {
    const shoulderX = Math.round(bodyX + sign * bodyWidth * .12);
    const shoulderY = rows.findIndex((r,y) => y < underarm && data[(y * width + shoulderX) * 4 + 3] > 32);
    if (shoulderY < 0 || underarm - shoulderY < height * .08) return reject('missing shoulder');
    // The cuff lies on the outer contour; use its top and lower inside corner.
    const cuffX = Math.round(extremeX + sign * width * .02);
    const cuffYs = [];
    for (let y = shoulderY; y <= underarm; y++) if (data[(y * width + cuffX) * 4 + 3] > 32) cuffYs.push(y);
    if (!cuffYs.length) return reject('missing cuff');
    const cuffTop = cuffYs[0], cuffBottom = cuffYs[cuffYs.length-1];
    if (cuffTop < shoulderY || cuffTop > underarm) return reject('ambiguous cuff height');
    const innerY = Math.min(underarm - 1, Math.max(cuffBottom, underarm - height * .07));
    const innerX = sign === 1 ? rows[Math.round(innerY)].left : rows[Math.round(innerY)].right;
    if (sign * (bodyX - innerX) < width * .03) return reject('missing cuff inner corner');
    sides.push({ outer: { u: shoulderX / width, v: shoulderY / height }, inner: { u: bodyX / width, v: underarm / height },
      cuffOuter: { u: cuffX / width, v: cuffTop / height }, cuffInner: { u: innerX / width, v: innerY / height } });
  }
  return { kind: 'photo-short-sleeve', sides, underarm: underarm / height, hem: .99 };
}

export function buildPhotoSleeves(pose, video, viewport, fit) {
  const pattern = fit.photoPattern;
  if (!pattern || ![11,12,23,24].every(i => pose?.[i] && (pose[i].visibility ?? 1) >= .55 && Number.isFinite(pose[i].x) && Number.isFinite(pose[i].y))) return null;
  const scale = Math.max(viewport.width/video.width, viewport.height/video.height);
  const project = i => ({ x: viewport.width-((viewport.width-video.width*scale)/2+pose[i].x*video.width*scale), y: (viewport.height-video.height*scale)/2+pose[i].y*video.height*scale, z: Number.isFinite(pose[i].z)?pose[i].z:0 });
  const valid=i=>pose?.[i]&&(pose[i].visibility??1)>=.55&&Number.isFinite(pose[i].x)&&Number.isFinite(pose[i].y);
  const sides = [[11,13,15,23],[12,14,16,24]].map(([s,e,w,h])=>({sIndex:s,hIndex:h,wIndex:w,s:project(s),e:valid(e)?project(e):null,w:valid(w)?project(w):null,h:project(h)})).sort((a,b)=>a.s.x-b.s.x);
  const width = fit.width ?? 1, length = fit.length ?? 1, offset = fit.offset ?? 0;
  const top = mix(sides[0].s,sides[1].s,.5), bottom = mix(sides[0].h,sides[1].h,.5), shoulderWidth = distance(sides[0].s,sides[1].s);
  if (shoulderWidth < 20 || distance(top,bottom) < 25) return null;
  const surface = createTorsoCurve(sides, fit.worldPose, video.width*scale, width);
  const shoulderV = (pattern.sides[0].outer.v + pattern.sides[1].outer.v)/2;
  const body = (q,v) => {
    const t = (v <= pattern.underarm ? (v-shoulderV)/(pattern.underarm-shoulderV)*.32 : .32+(v-pattern.underarm)/(pattern.hem-pattern.underarm)*.68)*length;
    const center = mix(top,bottom,t+offset), a=mix(sides[0].s,sides[0].h,Math.max(0,Math.min(1,t))), b=mix(sides[1].s,sides[1].h,Math.max(0,Math.min(1,t)));
    const across = Math.max(0, Math.min(1, (v-shoulderV)/(pattern.underarm-shoulderV)));
    const left = pattern.sides[0].outer.u+(pattern.sides[0].inner.u-pattern.sides[0].outer.u)*across;
    const right = pattern.sides[1].outer.u+(pattern.sides[1].inner.u-pattern.sides[1].outer.u)*across;
    // Pose joints lie inside the body. Estimate a modest garment allowance
    // along the shoulder/hip axis, so leaning and profile views stay coherent.
    // This is visual coverage, not a measurement of the wearer's size.
    const boundedT=Math.max(0,Math.min(1,t)), allowance=1.2+.16*boundedT;
    const lift=.035*(1-boundedT);
    return surface.curve({...center,x:center.x+(b.x-a.x)*(q-.5)*width*allowance-(bottom.x-top.x)*lift,y:center.y+(b.y-a.y)*(q-.5)*width*allowance-(bottom.y-top.y)*lift,z:center.z+(b.z-a.z)*(q-.5)*width*allowance,u:left+(right-left)*q,v}, q, boundedT);
  };
  const rows = [...new Set([0,shoulderV,pattern.underarm,.5,.65,.8,.99,1])].sort((a,b)=>a-b);
  const triangles = grid(8,rows.length-1,(q,t)=>body(q,rows[Math.round(t*(rows.length-1))]));
  const coveredForearms=[];let missingSleeves=0;
  sides.forEach((side,i)=>{
    if(!side.e||distance(side.s,side.e)<8||(pattern.long&&(!side.w||distance(side.e,side.w)<8))){missingSleeves++;if(fit.normalHistory)for(const key of [`photo-${i}`,`photo-${i}-joint`,`photo-${i}-end`])delete fit.normalHistory[key];return;}
    if(pattern.long)coveredForearms.push(side.wIndex);
    let source = pattern.sides[i];const rootOuter=body(i,shoulderV),rootInner=body(i,pattern.underarm),root=mix(rootOuter,rootInner,.5),cuff=mix(side.s,side.e,.65*length);
    if(pattern.long)source={...source,samples:[{t:0,outer:{u:rootOuter.u,v:rootOuter.v},inner:{u:rootInner.u,v:rootInner.v}},...source.samples.slice(1)]};
    const rootNormal=unit({x:rootOuter.x-rootInner.x,y:rootOuter.y-rootInner.y});
    const armNormal=unit({x:-(side.e.y-side.s.y)*(i===0?1:-1),y:(side.e.x-side.s.x)*(i===0?1:-1)});
    const radius=distance(rootOuter,rootInner)/2;
    const lowerNormal=pattern.long?unit({x:-(side.w.y-side.e.y)*(i===0?1:-1),y:(side.w.x-side.e.x)*(i===0?1:-1)}):armNormal;
    const middleNormal=pattern.long?sleeveNormalRotation(armNormal,lowerNormal,fit.normalHistory,`photo-${i}-joint`)(.5):armNormal;
    const rotation=sleeveNormalRotation(rootNormal,middleNormal,fit.normalHistory,`photo-${i}`),lowerRotation=sleeveNormalRotation(middleNormal,lowerNormal,fit.normalHistory,`photo-${i}-end`);
    const sleeveRows=[...new Set([0,.125,.25,.375,.5,.625,.75,.875,1,...(pattern.long?[.5/length]:[]),...(source.samples?.map(p=>p.t)||[])])].filter(t=>t>=0&&t<=1).sort((a,b)=>a-b);
    triangles.push(...grid(4,sleeveRows.length-1,(q,row)=>{
      const t=sleeveRows[Math.round(row*(sleeveRows.length-1))],along=t*length;
      const first=along<=.5;
      const center=pattern.long?mix(first?root:side.e,first?side.e:side.w,first?along*2:(along-.5)*2):mix(root,cuff,t);
      const normal=pattern.long?(first?rotation:lowerRotation)(first?along*2:(along-.5)*2):rotation(t),r=radius*(1-t)+shoulderWidth*width*(pattern.long?.065:.085)*t;
      const uv=pattern.long?samplePhotoSleeve(source,q,t):mixUV(mixUV(rootOuter,rootInner,q),mixUV(source.cuffOuter,source.cuffInner,q),t);
      return {...center,x:center.x+normal.x*r*(1-2*q),y:center.y+normal.y*r*(1-2*q)+offset*distance(top,bottom)*Math.min(1,t*2),z:center.z+(rootOuter.z-rootInner.z)*(1-2*q)*.5*(1-t),...uv};
    }));
  });
  triangles.sort((a,b)=>b.reduce((n,p)=>n+p.z,0)-a.reduce((n,p)=>n+p.z,0));
  triangles.sleeveStyle=pattern.kind;triangles.coverForearms=coveredForearms;triangles.missingSleeves=missingSleeves;
  triangles.curvedTorso=surface.enabled;
  return triangles;
}

// An elliptical front panel, estimated from world-pose yaw and torso length.
// Frontal photo projection stays linear; only depth and yaw displacement change.
// It describes a curved front surface, not measured body shape or cloth physics.
export function createTorsoCurve(sides, world, depthPixels, fitWidth = 1) {
  const flat = { enabled: false, curve: point => point };
  if (!world || !Array.isArray(sides) || sides.length !== 2 || !Number.isFinite(fitWidth) || fitWidth <= 0 || !sides.every(s => s && s.s && s.h && [s.s.x,s.s.y,s.h.x,s.h.y].every(Number.isFinite)) || !sides.every(s => [s.sIndex,s.hIndex].every(i => world[i] && [world[i].x,world[i].y,world[i].z].every(Number.isFinite)))) return flat;
  const worldTop=mix(world[sides[0].sIndex],world[sides[1].sIndex],.5),worldBottom=mix(world[sides[0].hIndex],world[sides[1].hIndex],.5);
  const worldLength=Math.hypot(worldBottom.x-worldTop.x,worldBottom.y-worldTop.y,worldBottom.z-worldTop.z);
  const screenLength=distance(mix(sides[0].s,sides[1].s,.5),mix(sides[0].h,sides[1].h,.5));
  if (!Number.isFinite(screenLength) || worldLength < .1 || worldLength > 1 || screenLength < 25 || !Number.isFinite(depthPixels) || depthPixels <= 0) return flat;
  const pixelsPerMeter=screenLength/worldLength;
  const layers=['s','h'].map(key=>{
    const id=key==='s'?'sIndex':'hIndex';
    const x=sides[1][key].x-sides[0][key].x,z=(world[sides[1][id]].z-world[sides[0][id]].z)*pixelsPerMeter;
    const across=Math.hypot(x,z);
    if (across < 12 || Math.abs(z)>screenLength*1.1) return null;
    return { nx:z/across,nz:-x/across,depth:Math.min(across*.22,screenLength*.25)*fitWidth };
  });
  if (layers.some(p=>!p)) return flat;
  return { enabled:true,curve(point,q,t) {
    const shape=Math.sqrt(Math.max(0,1-(2*q-1)**2));
    const depth=layers[0].depth+(layers[1].depth-layers[0].depth)*t;
    const nx=layers[0].nx+(layers[1].nx-layers[0].nx)*t,nz=layers[0].nz+(layers[1].nz-layers[0].nz)*t;
    return {...point,x:point.x+nx*depth*shape,z:point.z+nz*depth*shape/depthPixels};
  } };
}
function mix(a,b,t){return{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:(a.z||0)+((b.z||0)-(a.z||0))*t}}
function mixUV(a,b,t){return{u:a.u+(b.u-a.u)*t,v:a.v+(b.v-a.v)*t}}
function distance(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
function unit(p){const d=Math.hypot(p.x,p.y)||1;return{x:p.x/d,y:p.y/d}}
function grid(columns,rows,map){const result=[];for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){const a=map(x/columns,y/rows),b=map((x+1)/columns,y/rows),c=map((x+1)/columns,(y+1)/rows),d=map(x/columns,(y+1)/rows);result.push([a,b,c],[a,c,d])}return result}
