// Move the upper lash edge's texture coordinates toward adjacent lid skin as
// the lid closes. Geometry still owns closure; no new surface or texture is drawn.
const LIDS=[
 {side:'Left',edge:[246,161,160,159,158,157,173],skin:[247,30,29,27,28,56,190]},
 {side:'Right',edge:[466,388,387,386,385,384,398],skin:[467,260,259,257,258,286,414]}
];
const clamp=value=>Math.min(1,Math.max(0,Number(value)||0));
export function createLidTextureMapping(geometry){
 const uv=geometry.attributes.uv;if(!uv)return null;
 const original=uv.clone(),previous=[0,0];
 return {update(blend={}){
  let changed=false;
  for(let k=0;k<LIDS.length;k++){
   const {side,edge,skin}=LIDS[k];
   const requested=clamp((Number(blend['eyeBlink'+side])||0)+.45*(Number(blend['eyeSquint'+side])||0)-.35*(Number(blend['eyeWide'+side])||0));
   // The expression smoother approaches zero asymptotically. Snap a visually
   // neutral lid to its exact original coordinates instead of retaining drift.
   const closure=requested<.001?0:requested;
   // Retain area in the UV triangles; moving fully onto the outer skin ring
   // collapses the sample into a line and produces vertical color streaks.
   const amount=.75*closure*closure*(3-2*closure);
   if(previous[k]===amount||(amount!==0&&Math.abs(previous[k]-amount)<1e-5))continue;
   previous[k]=amount;changed=true;
   for(let j=0;j<edge.length;j++){
    const i=edge[j],s=skin[j],u=original.getX(i),v=original.getY(i);
    const du=(original.getX(s)-u)*amount,dv=(original.getY(s)-v)*amount;
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
