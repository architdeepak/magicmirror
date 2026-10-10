// MediaPipe z decreases toward the camera. Clip each visible limb against the
// estimated torso plane instead of deciding the whole arm from wrist depth.
export function foregroundLimbSegments(pose,{coverForearms=false}={}){
 const valid=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.z)&&(p.visibility??1)>=.55;
 const torso=[11,12,23,24].map(i=>pose?.[i]).filter(valid);
 if(torso.length<2)return [];
 const depth=torso.reduce((sum,p)=>sum+p.z,0)/torso.length-.035,segments=[];
 const clip=(a,b,part)=>{
  if(!valid(a)||!valid(b))return;
  const frontA=a.z<depth,frontB=b.z<depth;if(!frontA&&!frontB)return;
  const at=frontA&&frontB?null:(depth-a.z)/(b.z-a.z);
  const crossing=at===null?null:{x:a.x+(b.x-a.x)*at,y:a.y+(b.y-a.y)*at,z:depth,visibility:1};
  segments.push({from:frontA?a:crossing,to:frontB?b:crossing,part});
 };
 for(const [elbow,wrist,finger]of [[13,15,19],[14,16,20]]){
  if(!(coverForearms===true||(Array.isArray(coverForearms)&&coverForearms.includes(wrist))))clip(pose?.[elbow],pose?.[wrist],'forearm');
  // A visible hand does not require a visible elbow.
  clip(pose?.[wrist],pose?.[finger],'hand');
 }
 return segments;
}
export function occlusionBodyWidth(pose,project){
 const valid=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&(p.visibility??1)>=.55;
 for(const [left,right,scale]of [[11,12,1],[23,24,1.5]]){
  if(!valid(pose?.[left])||!valid(pose?.[right]))continue;const a=project(left),b=project(right);
  const width=Math.hypot(a.x-b.x,a.y-b.y)*scale;if(Number.isFinite(width)&&width>1)return width;
 }return 0;
}
