const assert=require('assert/strict');const fs=require('fs');const path=require('path');
(async()=>{
  const normals='data:text/javascript;base64,'+Buffer.from(fs.readFileSync(path.join(__dirname,'../src/sleeveNormals.js'),'utf8')).toString('base64');
  const dependency='data:text/javascript;base64,'+Buffer.from(fs.readFileSync(path.join(__dirname,'../src/starterSleeves.js'),'utf8').replace("'./sleeveNormals.js'",JSON.stringify(normals))).toString('base64');
  const source=fs.readFileSync(path.join(__dirname,'../src/garmentGeometry.js'),'utf8').replace('"./starterSleeves.js"',JSON.stringify(dependency)).replace("'./photoSleeves.js'",JSON.stringify('data:text/javascript;base64,'+Buffer.from(fs.readFileSync(path.join(__dirname,'../src/photoSleeves.js'),'utf8').replace("'./sleeveNormals.js'",JSON.stringify(normals))).toString('base64')));const {buildGarmentMesh,projectCameraPoint}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
  const video={width:540,height:960},viewport={width:540,height:960};
  const pose=Array.from({length:33},()=>({x:.5,y:.5,z:0,visibility:0}));
  for(const [i,x,y]of [[11,.7,.25],[12,.3,.25],[23,.4,.55],[24,.6,.55],[25,.65,.72],[26,.35,.72],[27,.4,.9],[28,.6,.9]])Object.assign(pose[i],{x,y,visibility:1});
  const top=buildGarmentMesh(pose,video,viewport,'top');
  // The hip belonging to the left-screen shoulder is right-screen in this
  // deliberately twisted pose. Sorting the hips separately would swap them.
  const expectedHip=projectCameraPoint(pose[23],video,viewport);
  const torsoRow=top.flat().filter(point=>point.u===.25&&point.v===1);
  assert(torsoRow.length);assert(torsoRow[0].x>viewport.width/2,'Torso mesh exchanged anatomical hip sides');
  assert(expectedHip.x>viewport.width/2);
  const legs=buildGarmentMesh(pose,video,viewport,'bottoms');const kneeVertices=legs.flat().filter(point=>Math.abs(point.v-.51)<1e-8);
  assert(kneeVertices.length,'Mesh skipped the actual knee anchor');
  const unique=new Map();for(const point of legs.flat()){
    assert(Number.isFinite(point.x)&&Number.isFinite(point.y),'Bent knee generated non-finite geometry');
    const key=point.u+':'+point.v;if(unique.has(key)){
      // The two leg meshes share u=.5, but each has its own inner edge.
      if(point.u!==.5)assert.deepEqual({x:point.x,y:point.y},unique.get(key),'Shared triangle edge split');
    }else unique.set(key,{x:point.x,y:point.y});
  }
  const kneeCenter=kneeVertices.find(point=>point.u===.25);const leftHip=pose[23].x>pose[24].x?23:24;const expectedKnee=projectCameraPoint(pose[leftHip===23?25:26],video,viewport);
  assert(Math.abs(kneeCenter.x-expectedKnee.x)<1e-6&&Math.abs(kneeCenter.y-expectedKnee.y)<1e-6,'Leg center missed its knee');
  for(const length of [.7,1,1.5]) {
    const mesh=buildGarmentMesh(pose,video,viewport,'bottoms',{length});
    const anchor=mesh.flat().find(point=>point.u===.25&&Math.abs(point.v-(.06+.45/length))<1e-8);
    assert(anchor&&Math.abs(anchor.x-expectedKnee.x)<1e-6&&Math.abs(anchor.y-expectedKnee.y)<1e-6,'Length adjustment skipped the knee anchor');
  }
  const crossed=structuredClone(pose);crossed[27].x=.9;crossed[28].x=.1;
  const crossedMesh=buildGarmentMesh(crossed,video,viewport,'bottoms');
  const cuff=crossedMesh.flat().find(point=>point.u===.25&&Math.abs(point.v-.96)<1e-8);
  const ankle=projectCameraPoint(crossed[leftHip===23?27:28],video,viewport);
  assert(Math.abs(cuff.x-ankle.x)<1e-6,'Crossed legs exchanged cuff textures');
  for(const index of [23,25,27])crossed[index].z=-.4;
  const sorted=buildGarmentMesh(crossed,video,viewport,'bottoms');
  const depths=sorted.map(triangle=>triangle.reduce((sum,point)=>sum+point.z,0)/3);
  assert(depths.every((depth,index)=>index===0||depth<=depths[index-1]+1e-8),'Nearer trouser triangles were painted behind a farther leg');
  const degenerate=structuredClone(pose);degenerate[25]={...degenerate[23]};degenerate[27]={...degenerate[23]};
  assert(buildGarmentMesh(degenerate,video,viewport,'bottoms').flat().every(point=>Number.isFinite(point.x)&&Number.isFinite(point.y)));
  pose[26].visibility=.1;assert.equal(buildGarmentMesh(pose,video,viewport,'bottoms'),null);
  console.log('Garment geometry passed: anatomical torso pairing, exact knee/cuff anchors, continuous shared edges, crossed-leg identity and depth order, degenerate limbs, and visibility gating.');
})().catch(error=>{console.error(error);process.exitCode=1});
