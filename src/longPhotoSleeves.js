// Recognize separated, downward sleeves on a flat/hanging garment. The alpha
// contours supply existing fabric pixels; no hidden fabric or size inference.
export function inferLongPhotoSleeves({width,height,data}){
 if(width<40||height<40||width*height>1024*1024||data.length!==width*height*4)return null;
 const rows=[],middle=Math.floor(width/2),minRun=Math.max(3,Math.round(width*.008));
 for(let y=0;y<height;y++){
  const runs=[];let start=-1;
  for(let x=0;x<=width;x++){const opaque=x<width&&data[(y*width+x)*4+3]>32;if(opaque&&start<0)start=x;if(!opaque&&start>=0){if(x-start>=minRun)runs.push({left:start,right:x-1});start=-1;}}
  const body=runs.find(r=>r.left<=middle&&r.right>=middle);
  rows.push({body,left:body?runs.filter(r=>r.right<body.left-width*.015).at(-1):null,right:body?runs.find(r=>r.left>body.right+width*.015):null});
 }
 const lower=rows.slice(Math.round(height*.7),Math.round(height*.9)).map(r=>r.body).filter(Boolean);
 if(lower.length<height*.1)return null;
 const median=values=>values.sort((a,b)=>a-b)[Math.floor(values.length/2)],bodyLeft=median(lower.map(r=>r.left)),bodyRight=median(lower.map(r=>r.right)),bodyWidth=bodyRight-bodyLeft;
 if(bodyWidth<width*.3||bodyWidth>width*.85)return null;
 const span=Math.max(3,Math.ceil(height*.04));let underarm=-1;
 for(let y=Math.round(height*.18);y<height*.6;y++)if(rows.slice(y,y+span).every(r=>r.body&&r.left&&r.right)){underarm=y;break;}
 if(underarm<0)return null;
 const sides=[];
 for(const [key,bodyX,sign]of [['left',bodyLeft,1],['right',bodyRight,-1]]){
  const shoulderX=Math.round(bodyX+sign*bodyWidth*.12),shoulderY=rows.findIndex((_,y)=>y<underarm&&data[(y*width+shoulderX)*4+3]>32);
  if(shoulderY<0||underarm-shoulderY<height*.08)return null;
  const centerRootY=(shoulderY+underarm)/2,available=[];
  for(let y=underarm;y<height;y++)if(rows[y][key])available.push(y);
  if(available.length<height*.2)return null;
  const last=available.at(-1),cuffY=last-Math.max(2,Math.round(height*.018));
  const cuff=rows[cuffY]?.[key];if(!cuff||cuffY-underarm<height*.22||cuff.right-cuff.left>bodyWidth*.5)return null;
  const root={outer:{u:shoulderX/width,v:shoulderY/height},inner:{u:bodyX/width,v:underarm/height}};
  const samples=[{t:0,...root}],step=Math.max(2,Math.round(height*.035));
  const add=y=>{const run=rows[y]?.[key];if(!run)return false;const outer=sign===1?run.left:run.right,inner=sign===1?run.right:run.left;
   samples.push({t:(y-centerRootY)/(cuffY-centerRootY),outer:{u:outer/width,v:y/height},inner:{u:inner/width,v:y/height}});return true;};
  for(let y=underarm;y<cuffY;y+=step)if(!add(y))return null;add(cuffY);
  sides.push({...root,cuffOuter:samples.at(-1).outer,cuffInner:samples.at(-1).inner,samples});
 }
 return {kind:'photo-long-sleeve',long:true,sides,underarm:underarm/height,hem:.99};
}
export function samplePhotoSleeve(side,q,t){
 const samples=side.samples;
 if(!samples)return blendSleeveUv(blendSleeveUv(side.outer,side.inner,q),blendSleeveUv(side.cuffOuter,side.cuffInner,q),t);
 const next=samples.findIndex(p=>p.t>=t),end=next<0?samples.length-1:Math.max(1,next),a=samples[end-1],b=samples[end];
 return blendSleeveUv(blendSleeveUv(a.outer,a.inner,q),blendSleeveUv(b.outer,b.inner,q),Math.max(0,Math.min(1,(t-a.t)/(b.t-a.t))));
}
function blendSleeveUv(a,b,t){return{u:a.u+(b.u-a.u)*t,v:a.v+(b.v-a.v)*t};}
