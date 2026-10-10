import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createIrisTexture, irisGeometry } from './rigIris.js';
import { buildHairCap } from './rigHairCap.js';

const LEFT_UPPER=[33,246,161,160,159,158,157,173,133], LEFT_LOWER=[33,7,163,144,145,153,154,155,133];
const RIGHT_UPPER=[263,466,388,387,386,385,384,398,362], RIGHT_LOWER=[263,249,390,373,374,380,381,382,362];
const LID_SKIN={Left:[[247,30,29,27,28,56,190],[25,110,24,23,22,26,112]],Right:[[467,260,259,257,258,286,414],[255,339,254,253,252,256,341]]};
const LIP_UPPER=[78,191,80,81,82,13,312,311,310,415,308];
const LIP_LOWER=[78,95,88,178,87,14,317,402,318,324,308];
const INNER_LIPS=new Set([...LIP_UPPER,...LIP_LOWER]);
const gaussian=(x,y,cx,cy,sx,sy)=>Math.exp(-(((x-cx)/sx)**2+((y-cy)/sy)**2));

// The original lab export named 52 targets but only changed three. Rebuild
// useful local channels from the neutral topology; unsupported names stay zero.
export function authorFaceMorphs(mesh) {
 const g=mesh.geometry,p=g.attributes.position,names=Object.keys(mesh.morphTargetDictionary),targets=[];
 const eyelids=[[LEFT_UPPER,LEFT_LOWER,'Left'],[RIGHT_UPPER,RIGHT_LOWER,'Right']];
 for(const name of names){
  const delta=new Float32Array(p.count*3);
  for(let i=0;i<p.count;i++){
   const x=p.getX(i),y=p.getY(i),z=p.getZ(i),side=name.endsWith('Left')?-1:1;
   const mouth=gaussian(x,y,0,-.52,.43,.20),brow=gaussian(x,y,side*.46,.60,.28,.18);
   let dx=0,dy=0,dz=0;
   if(name==='jawOpen'){const lower=Math.max(0,Math.min(1,(-y-.50)/.37));dy=-.24*lower;dz=-.035*lower;if([14,87,178,88,95,17,84,181,91,146,317,402,318,324,314,405,321,375].includes(i)){dy=-.20;dz=-.025;}}
   if(name==='jawLeft'||name==='jawRight')dx=(name==='jawLeft'?-.08:.08)*Math.max(0,Math.min(1,(-y-.4)/.5));
   if(name==='jawForward')dz=.08*Math.max(0,Math.min(1,(-y-.4)/.5));
   if(name.startsWith('browDown'))dy=-.075*brow;
   if(name.startsWith('browOuterUp'))dy=.12*brow;
   if(name==='browInnerUp')dy=.1*gaussian(x,y,0,.56,.29,.18);
   if(name.startsWith('mouthSmile')){const w=gaussian(x,y,side*.29,-.51,.15,.14);dy=.10*w;dx=side*.045*w;}
   if(name.startsWith('mouthFrown'))dy=-.075*gaussian(x,y,side*.29,-.51,.15,.14);
   if(name.startsWith('mouthStretch'))dx=side*.07*gaussian(x,y,side*.24,-.51,.19,.14);
   if(name==='mouthPucker'||name==='mouthFunnel'){dx=-x*mouth*.20;dz=.075*mouth;}
   if(name==='mouthLeft'||name==='mouthRight')dx=(name==='mouthLeft'?-.065:.065)*mouth;
   if(name.startsWith('mouthUpperUp'))dy=.06*gaussian(x,y,side*.13,-.45,.19,.08);
   if(name.startsWith('mouthLowerDown'))dy=-.065*gaussian(x,y,side*.13,-.58,.19,.08);
   if(name==='mouthRollLower'){const w=gaussian(x,y,0,-.59,.30,.10);dy=.022*w;dz=-.050*w;}
   if(name==='mouthClose')dy=(-.51-y)*mouth*.35;
   if(name.startsWith('mouthPress')&&!INNER_LIPS.has(i))dy=(-.51-y)*gaussian(x,y,side*.18,-.51,.23,.12)*.35;
   if(name==='cheekPuff')dz=.065*(gaussian(x,y,-.62,-.16,.25,.30)+gaussian(x,y,.62,-.16,.25,.30));
   if(name.startsWith('cheekSquint'))dy=.04*gaussian(x,y,side*.55,.08,.24,.16);
   if(name.startsWith('noseSneer'))dy=.035*gaussian(x,y,side*.18,-.16,.13,.18);
   delta.set([dx,dy,dz],i*3);
  }
  // A smile/frown moves the lip line; jaw opening owns the aperture.
  // Move each inner pair together so emotion can coexist with sealed lips.
  if(name.startsWith('mouthSmile')||name.startsWith('mouthFrown'))for(let j=1;j<LIP_UPPER.length-1;j++){
   const a=LIP_UPPER[j],b=LIP_LOWER[j];
   for(let axis=0;axis<3;axis++){const shared=(delta[a*3+axis]+delta[b*3+axis])*.5;delta[a*3+axis]=shared;delta[b*3+axis]=shared;}
  }
  if(name==='mouthClose')for(let j=1;j<LIP_UPPER.length-1;j++){
   const a=LIP_UPPER[j],b=LIP_LOWER[j];
   // A fixed-height pinch leaves depth/side gaps. Meet on one shared line,
   // preserving lip corners and keeping press accents off the sealed edge.
   for(let axis=0;axis<3;axis++){
    const gap=p.getComponent(b,axis)-p.getComponent(a,axis);
    delta[a*3+axis]=gap*.5;delta[b*3+axis]=-gap*.5;
   }
  }
  for(const[upper,lower,side]of eyelids){
   if(name===`eyeBlink${side}`||name===`eyeSquint${side}`||name===`eyeWide${side}`){
    const amount=name.startsWith('eyeSquint')?.45:name.startsWith('eyeWide')?-.35:1;
    for(let j=1;j<upper.length-1;j++){
     const a=upper[j],b=lower[j];
     // The eyelid edges differ in all three axes. Closing only height leaves
     // skewed depth/side gaps visible as a dark slit, especially during turns.
     // Both edges converge on the same curved lash line, ahead of the iris.
     for(let axis=0;axis<3;axis++){
      const gap=p.getComponent(a,axis)-p.getComponent(b,axis);
      const lift=axis===2?.07:0;
      delta[a*3+axis]=(-gap*.82+lift)*amount;
      delta[b*3+axis]=(gap*.18+lift)*amount;
     }
     // Carry the skin beside the lash line into the fold. An unmoving skin
     // ring next to a lifted edge makes a flat ledge during full closure.
     const [upperSkin,lowerSkin]=LID_SKIN[side];
     for(let axis=0;axis<3;axis++){
      delta[upperSkin[j-1]*3+axis]=delta[a*3+axis]*.6;
      delta[lowerSkin[j-1]*3+axis]=delta[b*3+axis]*.6;
     }
    }
   }
  }
  targets.push(new THREE.BufferAttribute(delta,3));
 }
 g.morphAttributes.position=targets;
 // Lighting follows each deformation too; no empty normal target arrays.
 const normals=g.attributes.normal,normalTargets=[];
 if(normals&&g.index){
  const scratch=new THREE.BufferGeometry();scratch.setIndex(g.index.clone());
  for(const delta of targets){
   const deformed=new Float32Array(p.array.length);for(let i=0;i<deformed.length;i++)deformed[i]=p.array[i]+delta.array[i];
   scratch.setAttribute('position',new THREE.BufferAttribute(deformed,3));scratch.computeVertexNormals();
   const n=scratch.attributes.normal,out=new Float32Array(normals.array.length);for(let i=0;i<out.length;i++)out[i]=n.array[i]-normals.array[i];normalTargets.push(new THREE.BufferAttribute(out,3));
  }
  scratch.dispose();g.morphAttributes.normal=normalTargets;
 }else delete g.morphAttributes.normal;
 g.morphTargetsRelative=true;mesh.updateMorphTargets();
 mesh.morphTargetDictionary=Object.fromEntries(names.map((n,i)=>[n,i]));
 return names.filter((_,i)=>targets[i].array.some(v=>v!==0));
}

export function mergeStaticMaterial(root,material) {
 root.updateWorldMatrix(true,true);
 const meshes=[];root.traverse(node=>{if(node.isMesh&&node.material===material)meshes.push(node);});
 if(meshes.length<2)return null;
 const inverse=new THREE.Matrix4().copy(root.matrixWorld).invert();
 const copies=meshes.map(mesh=>mesh.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld)));
 const geometry=mergeGeometries(copies,false);copies.forEach(g=>g.dispose());
 if(!geometry)throw new Error('Static rig geometry could not be merged');
 for(const mesh of meshes){mesh.removeFromParent();mesh.geometry.dispose();}
 const merged=new THREE.Mesh(geometry,material);merged.name='sculpted-hair';root.add(merged);return merged;
}

const CROWN_PROFILE=[[-Math.PI,.12],[-2.55,.27],[-1.95,.16],[-1.4,.24],[-1.05,.38],[-.52,.16],[0,.65],[.52,.16],[1.05,.38],[1.4,.24],[1.95,.16],[2.55,.27],[Math.PI,.12]];
const crownHeight=angle=>{
 for(let i=1;i<CROWN_PROFILE.length;i++)if(angle<=CROWN_PROFILE[i][0]){
  const [a,h]=CROWN_PROFILE[i-1],[b,k]=CROWN_PROFILE[i];return 1.10+h+(k-h)*(angle-a)/(b-a);
 }
 return 1.22;
};
export function buildCrownShell(segments=96){
 const positions=[],uv=[],indices=[];
 // Independent strips keep the rim's normals separate from the curved wall.
 for(let strip=0;strip<4;strip++){
  const start=positions.length/3;
  for(let i=0;i<=segments;i++){
   const angle=-Math.PI+Math.PI*2*i/segments,top=crownHeight(angle);
   for(let j=0;j<2;j++){
    const inside=strip===1||(strip>=2&&j===1),offset=inside?-.025:.025;
    const y=strip<2?(j?top:1.10):(strip===2?top:1.10);
    positions.push(Math.sin(angle)*(.67+offset),y,-.23+Math.cos(angle)*(.56+offset));uv.push(i/segments,j);
   }
  }
  for(let i=0;i<segments;i++){
   const a=start+i*2,quad=[a,a+2,a+3,a,a+3,a+1];
   if(strip===1||strip===3)for(let k=0;k<quad.length;k+=3)indices.push(quad[k],quad[k+2],quad[k+1]);else indices.push(...quad);
  }
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();
 // The duplicate back seam has identical surface positions and normals.
 const normal=geometry.attributes.normal;
 for(let strip=0;strip<4;strip++)for(let j=0;j<2;j++){
  const a=strip*(segments+1)*2+j,b=a+segments*2,n=new THREE.Vector3().fromBufferAttribute(normal,a).add(new THREE.Vector3().fromBufferAttribute(normal,b)).normalize();normal.setXYZ(a,n.x,n.y,n.z);normal.setXYZ(b,n.x,n.y,n.z);
 }
 return geometry;
}

// A posterior volume starts at the actual face oval, not an overlapping sphere.
// Every seam vertex receives the face's exact local deformation and normal.
export const FACE_OVAL=[10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109];
export function buildHeadVolume(face,material){
 const source=face.geometry,p=source.attributes.position,rings=8,count=FACE_OVAL.length,positions=[],indices=[],factors=[];
 for(let ring=0;ring<rings;ring++){
  const angle=(ring/rings)*Math.PI/2,factor=Math.cos(angle),depth=Math.sin(angle);
  for(const i of FACE_OVAL){positions.push(p.getX(i)*factor,.05+(p.getY(i)-.05)*factor,p.getZ(i)*(1-depth)-.96*depth);factors.push(factor);}
 }
 const center=positions.length/3;positions.push(0,.05,-.96);
 for(let ring=0;ring<rings-1;ring++)for(let i=0;i<count;i++){const j=(i+1)%count,a=ring*count+i,b=ring*count+j,c=(ring+1)*count+i,d=(ring+1)*count+j;indices.push(a,b,d,a,d,c);}
 for(let i=0;i<count;i++)indices.push((rings-1)*count+i,(rings-1)*count+(i+1)%count,center);
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();
 // Extend the authored boundary's appearance over the posterior volume.
 // A flat skin material creates a visible cheek stripe even with exact normals.
 // Keep UVs/colors identical at the shared edge; behind it the boundary samples
 // continue toward the hair-covered rear rather than sampling unrelated features.
 for(const name of ['uv','uv1','color']){
  const attribute=source.attributes[name];if(!attribute)continue;
  const values=new Float32Array((center+1)*attribute.itemSize);
  for(let v=0;v<center;v++)for(let axis=0;axis<attribute.itemSize;axis++)values[v*attribute.itemSize+axis]=attribute.getComponent(FACE_OVAL[v%count],axis);
  for(let axis=0;axis<attribute.itemSize;axis++)values[center*attribute.itemSize+axis]=FACE_OVAL.reduce((sum,i)=>sum+attribute.getComponent(i,axis),0)/count;
  geometry.setAttribute(name,new THREE.BufferAttribute(values,attribute.itemSize));
 }
 const baseNormals=geometry.attributes.normal;
 for(let i=0;i<count;i++){const index=FACE_OVAL[i];baseNormals.setXYZ(i,source.attributes.normal.getX(index),source.attributes.normal.getY(index),source.attributes.normal.getZ(index));}
 const targets=source.morphAttributes.position.map(delta=>{
  const out=new Float32Array(positions.length);for(let v=0;v<center;v++){const i=FACE_OVAL[v%count],f=factors[v];out[v*3]=delta.getX(i)*f;out[v*3+1]=delta.getY(i)*f;out[v*3+2]=delta.getZ(i)*f;}return new THREE.BufferAttribute(out,3);
 });
 const normalTargets=[],scratch=new THREE.BufferGeometry();scratch.setIndex(indices);
 for(let t=0;t<targets.length;t++){
  const values=new Float32Array(positions.length);for(let i=0;i<values.length;i++)values[i]=positions[i]+targets[t].array[i];scratch.setAttribute('position',new THREE.BufferAttribute(values,3));scratch.computeVertexNormals();
  const out=new Float32Array(positions.length);for(let i=0;i<out.length;i++)out[i]=scratch.attributes.normal.array[i]-baseNormals.array[i];
  for(let i=0;i<count;i++){const index=FACE_OVAL[i],n=source.morphAttributes.normal?.[t];if(n){out[i*3]=n.getX(index);out[i*3+1]=n.getY(index);out[i*3+2]=n.getZ(index);}}
  normalTargets.push(new THREE.BufferAttribute(out,3));
 }
 scratch.dispose();geometry.morphTargetsRelative=true;geometry.morphAttributes.position=targets;geometry.morphAttributes.normal=normalTargets;
 const mesh=new THREE.Mesh(geometry,material);mesh.name='continuous-head-volume';mesh.morphTargetDictionary={...face.morphTargetDictionary};mesh.morphTargetInfluences=Array(targets.length).fill(0);return mesh;
}

export function buildRigAccessories(face,persona){
 const p=face.geometry.attributes.position, group=new THREE.Group();group.name='articulated-accessories';face.add(group);
 const hair=new THREE.MeshStandardMaterial({color:persona==='solenne'?0x24160e:0x100d16,roughness:.68,metalness:0});
 const ball=(radius,mat,position,scale)=>{const m=new THREE.Mesh(new THREE.SphereGeometry(radius,32,24),mat);m.position.set(...position);if(scale)m.scale.set(...scale);group.add(m);return m;};
 // Posterior skull closes side views; no image plane or torso participates.
 const headVolume=buildHeadVolume(face,face.material);group.add(headVolume);
 ball(1,hair,[0,.25,-.70],[1.01,1.22,.79]);
 const roots=new THREE.Mesh(buildHairCap(persona),hair);roots.name='curved-hair-roots';group.add(roots);
 const eyes=[];
 const irisMaterial=new THREE.MeshStandardMaterial({color:0xffffff,map:createIrisTexture(persona),roughness:.4});
 for(const [a,b,upper,lower,side]of[[33,133,159,145,'Left'],[263,362,386,374,'Right']]){
  const center=new THREE.Vector3((p.getX(a)+p.getX(b))/2,(p.getY(upper)+p.getY(lower))/2,.015);
  const radius=Math.abs(p.getX(a)-p.getX(b))*.55;
  const eye=new THREE.Group();eye.name='Eye'+side;eye.position.copy(center);group.add(eye);
  const sclera=new THREE.Mesh(new THREE.SphereGeometry(radius,32,24),new THREE.MeshStandardMaterial({color:0xeee5d8,roughness:.32}));sclera.scale.z=.55;eye.add(sclera);
  const iris=new THREE.Mesh(irisGeometry(radius*.51),irisMaterial);iris.name='Iris'+side;iris.scale.z=.24;iris.position.z=radius*.55;eye.add(iris);
  const pupil=new THREE.Mesh(new THREE.SphereGeometry(radius*.25,24,16),new THREE.MeshStandardMaterial({color:0x08070b,roughness:.2}));pupil.scale.z=.25;pupil.position.z=radius*.68;eye.add(pupil);
  const glint=new THREE.Mesh(new THREE.SphereGeometry(radius*.075,12,8),new THREE.MeshBasicMaterial({color:0xfff8eb}));glint.position.set(-radius*.12,radius*.16,radius*.73);eye.add(glint);
  eyes.push({group:eye,side,center});
 }
 // Broad, flattened locks sweep out from the part and end at staggered
 // lengths. Six overlapping layers per side retain volume without a row of cords.
 for(const side of[-1,1])for(let i=0;i<6;i++){
  const t=i/5,z=.25-t*.64,x=side*(.055+t*.45),wave=Math.sin(i*1.7)*.035;
  const tip=persona==='solenne'?-.99-.10*Math.sin(i*.9): -1.10-.16*Math.sin(i*.9);
  const curve=new THREE.CatmullRomCurve3([
   new THREE.Vector3(x,1.12+.025*Math.sin(i),z-.06),
   new THREE.Vector3(side*(.42+t*.29),1.17-t*.20,z+.10),
   new THREE.Vector3(side*(.88+t*.15),.40-t*.17,z+.02),
   new THREE.Vector3(side*(.99+wave),-.25-t*.24,z-.03),
   new THREE.Vector3(side*(.95+wave),tip+.14,z+.015),
   new THREE.Vector3(side*(.82+t*.07),tip,z+.06)
  ]);
  const geometry=new THREE.TubeGeometry(curve,36,.16,8,false),positions=geometry.attributes.position;
  for(let segment=0;segment<=36;segment++){
   const u=segment/36,center=curve.getPointAt(u),taper=Math.min(1,.20+u/.12)*(u<.72?1:Math.max(.10,(1-u)/.28));
   for(let radial=0;radial<=8;radial++){
    const index=segment*9+radial,v=new THREE.Vector3().fromBufferAttribute(positions,index).sub(center);
    v.x*=taper*(1+.10*Math.sin(u*Math.PI*2+i));v.y*=taper;v.z*=.65*taper;
    v.add(center);positions.setXYZ(index,v.x,v.y,v.z);
   }
  }
  // Close both ends, including the fine exposed tip. No hollow cut ends.
  const values=Array.from(positions.array),uvs=Array.from(geometry.attributes.uv.array),indices=Array.from(geometry.index.array);
  for(const end of [0,36]){
   const center=curve.getPointAt(end/36),cap=values.length/3,ring=end*9;
   values.push(center.x,center.y,center.z);uvs.push(.5,end/36);
   const a=new THREE.Vector3().fromBufferAttribute(positions,ring).sub(center),b=new THREE.Vector3().fromBufferAttribute(positions,ring+1).sub(center);
   const forward=new THREE.Vector3().crossVectors(a,b).dot(curve.getTangentAt(end/36))>0,reverse=forward===(end===0);
   for(let radial=0;radial<8;radial++)indices.push(cap,ring+radial+(reverse?1:0),ring+radial+(reverse?0:1));
  }
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(values,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.deleteAttribute('normal');geometry.computeVertexNormals();
  const normals=geometry.attributes.normal;
  for(let segment=0;segment<=36;segment++){
   const a=segment*9,b=a+8,n=new THREE.Vector3().fromBufferAttribute(normals,a).add(new THREE.Vector3().fromBufferAttribute(normals,b)).normalize();normals.setXYZ(a,n.x,n.y,n.z);normals.setXYZ(b,n.x,n.y,n.z);
  }
  const lock=new THREE.Mesh(geometry,hair);group.add(lock);
 }
 if(persona==='velora'){
  const gold=new THREE.MeshStandardMaterial({color:0xc78e31,metalness:.85,roughness:.25});
  const crown=new THREE.Group();crown.name='QueenCrown';group.add(crown);
  const shell=new THREE.Mesh(buildCrownShell(),gold);shell.name='wrapped-crown-shell';crown.add(shell);
  class CrownRim extends THREE.Curve{constructor(top){super();this.top=top;}getPoint(t,target=new THREE.Vector3()){const angle=-Math.PI+t*Math.PI*2;return target.set(Math.sin(angle)*.695,this.top?crownHeight(angle):1.12,-.23+Math.cos(angle)*.585);}}
  for(const top of [false,true])crown.add(new THREE.Mesh(new THREE.TubeGeometry(new CrownRim(top),96,top?.012:.023,6,true),gold));
  const bezel=new THREE.Mesh(new THREE.TorusGeometry(.106,.012,8,32),gold);bezel.position.set(0,1.40,.376);bezel.scale.set(.76,1.42,1);crown.add(bezel);
  const gem=new THREE.Mesh(new THREE.OctahedronGeometry(.115,1),new THREE.MeshStandardMaterial({color:0x890d29,metalness:.08,roughness:.18}));gem.position.set(0,1.40,.393);gem.scale.set(.7,1.5,.5);gem.name='crown-ruby';crown.add(gem);
  const metal=mergeStaticMaterial(crown,gold);metal.name='sculpted-crown';
 }
 const cavity=ball(1,new THREE.MeshStandardMaterial({color:0x240d16,roughness:1}),[0,-.56,.02],[.27,.10,.075]);
 // Curved, separately shaped enamel; batch each static arch into one draw.
 const enamel=new THREE.MeshStandardMaterial({color:0xe9e1d1,roughness:.38});
 const upperTeeth=new THREE.Group();upperTeeth.name='upper-dental-arch';group.add(upperTeeth);
 const lowerTeeth=new THREE.Group();lowerTeeth.name='lower-dental-arch';group.add(lowerTeeth);
 const tooth=(root,x,width,height)=>{
  const shape=new THREE.Shape();const w=width/2,h=height/2,r=.007;
  shape.moveTo(-w,h);shape.lineTo(w,h);shape.lineTo(w,-h+r);shape.quadraticCurveTo(w,-h,w-r,-h);shape.lineTo(-w+r,-h);shape.quadraticCurveTo(-w,-h,-w,-h+r);shape.closePath();
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:.030,bevelEnabled:true,bevelSize:.004,bevelThickness:.004,bevelSegments:1,curveSegments:3,steps:1});
  const mesh=new THREE.Mesh(geometry,enamel);mesh.position.set(x,0,-.035*(x/.19)**2);mesh.rotation.y=-x*1.2;root.add(mesh);
 };
 for(const x of[-.168,-.128,-.080,-.027,.027,.080,.128,.168])tooth(upperTeeth,x,Math.abs(x)<.1?.046:.036,Math.abs(x)<.1?.051:.045);
 for(const x of[-.123,-.075,-.025,.025,.075,.123])tooth(lowerTeeth,x,.039,.035);
 mergeStaticMaterial(upperTeeth,enamel).name='upper-enamel';mergeStaticMaterial(lowerTeeth,enamel).name='lower-enamel';
 upperTeeth.position.set(0,-.535,.095);lowerTeeth.position.set(0,-.53,.075);
 const tongue=new THREE.Mesh(new THREE.SphereGeometry(1,16,10),new THREE.MeshStandardMaterial({color:0x773544,roughness:.85}));tongue.position.set(0,-.56,.010);tongue.scale.set(.16,.020,.060);tongue.name='inner-tongue';group.add(tongue);
 mergeStaticMaterial(group,hair);
 return {group,eyes,cavity,teeth:upperTeeth,upperTeeth,lowerTeeth,tongue,headVolume};
}
