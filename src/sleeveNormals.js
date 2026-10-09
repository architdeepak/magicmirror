// A linear blend of opposing directions becomes zero and pinches the sleeve.
// Unwrap consecutive angles to keep a tracked limb crossing +/-pi continuous.
export function sleeveNormalRotation(a,b,history,key){
 let first=Math.atan2(a.y,a.x),last=Math.atan2(b.y,b.x);
 const unwrap=(angle,previous)=>previous+Math.atan2(Math.sin(angle-previous),Math.cos(angle-previous));
 const previous=history?.[key];
 if(previous){first=unwrap(first,previous.first);last=unwrap(last,previous.last);}
 else last=unwrap(last,first);
 if(history)history[key]={first,last};
 return t=>{const angle=first+(last-first)*Math.max(0,Math.min(1,t));return{x:Math.cos(angle),y:Math.sin(angle)};};
}
export function interpolateSleeveNormal(a,b,t){return sleeveNormalRotation(a,b)(t);}
