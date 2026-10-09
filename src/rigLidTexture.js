// Move the lash edges' texture coordinates toward adjacent lid skin as
// the lid closes. Geometry still owns closure; no new surface or texture is drawn.
const LIDS=[
 {side:'Left',rows:[
  {edge:[246,161,160,159,158,157,173],skin:[247,30,29,27,28,56,190]},
  {edge:[7,163,144,145,153,154,155],skin:[25,110,24,23,22,26,112],opposite:[246,161,160,159,158,157,173]}
 ]},
 {side:'Right',rows:[
  {edge:[466,388,387,386,385,384,398],skin:[467,260,259,257,258,286,414]},
  {edge:[249,390,373,374,380,381,382],skin:[255,339,254,253,252,256,341],opposite:[466,388,387,386,385,384,398]}
 ]}
];
const clamp=value=>Math.min(1,Math.max(0,Number(value)||0));
export function createLidTextureMapping(geometry){
 const uv=geometry.attributes.uv;if(!uv)return null;
 const original=uv.clone(),previous=[0,0];
 return {update(blend={}){
  let changed=false;
  for(let k=0;k<LIDS.length;k++){
   const {side,rows}=LIDS[k];
   const requested=clamp((Number(blend['eyeBlink'+side])||0)+.45*(Number(blend['eyeSquint'+side])||0)-.35*(Number(blend['eyeWide'+side])||0));
   // The expression smoother approaches zero asymptotically. Snap a visually
   // neutral lid to its exact original coordinates instead of retaining drift.
   const closure=requested<.001?0:requested;
   // Retain area in the UV triangles; moving fully onto the outer skin ring
   // collapses the sample into a line and produces vertical color streaks.
   const amount=.75*closure*closure*(3-2*closure);
   if(previous[k]===amount||(amount!==0&&Math.abs(previous[k]-amount)<1e-5))continue;
   previous[k]=amount;changed=true;
   for(const {edge,skin,opposite}of rows)for(let j=0;j<edge.length;j++){
    const i=edge[j],s=skin[j],u=original.getX(i),v=original.getY(i);
    // Stylized large eyes can extend beyond the first detected lower skin row.
    // Use eye height to clear that portrait region, with bounded extrapolation.
    const reach=opposite?Math.min(4,Math.max(1,Math.abs(original.getY(opposite[j])-v)*.5/Math.max(1e-6,Math.abs(original.getY(s)-v)))):1;
    const du=(original.getX(s)-u)*amount*reach,dv=(original.getY(s)-v)*amount*reach;
    uv.setXY(i,u+du,v+dv);
    // Carry the adjacent skin row with it so the lid retains a two-dimensional
    // patch of makeup/skin instead of stretching one sampled line vertically.
    uv.setXY(s,original.getX(s)+du*.8,original.getY(s)+dv*.8);
   }
  }
  if(changed)uv.needsUpdate=true;
  return changed;
 }};
}
