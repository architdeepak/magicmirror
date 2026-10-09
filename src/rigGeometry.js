import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const LEFT_UPPER=[33,246,161,160,159,158,157,173,133], LEFT_LOWER=[33,7,163,144,145,153,154,155,133];
const RIGHT_UPPER=[263,466,388,387,386,385,384,398,362], RIGHT_LOWER=[263,249,390,373,374,380,381,382,362];
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
   if(name.startsWith('mouthPress')||name==='mouthClose')dy=(-.51-y)*mouth*.35;
   if(name==='cheekPuff')dz=.065*(gaussian(x,y,-.62,-.16,.25,.30)+gaussian(x,y,.62,-.16,.25,.30));
   if(name.startsWith('cheekSquint'))dy=.04*gaussian(x,y,side*.55,.08,.24,.16);
   if(name.startsWith('noseSneer'))dy=.035*gaussian(x,y,side*.18,-.16,.13,.18);
   delta.set([dx,dy,dz],i*3);
  }
  for(const[upper,lower,side]of eyelids){
   if(name===`eyeBlink${side}`||name===`eyeSquint${side}`||name===`eyeWide${side}`){
    const amount=name.startsWith('eyeSquint')?.45:name.startsWith('eyeWide')?-.35:1;
    for(let j=1;j<upper.length-1;j++){
     const a=upper[j],b=lower[j],gap=p.getY(a)-p.getY(b);
     delta[a*3+1]=-gap*.82*amount;delta[b*3+1]=gap*.18*amount;
     delta[a*3+2]=.07*amount;delta[b*3+2]=.07*amount;
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
 const skin=new THREE.MeshStandardMaterial({color:0xe9b6a0,roughness:.72});
 const hair=new THREE.MeshStandardMaterial({color:persona==='solenne'?0x24160e:0x100d16,roughness:.48,metalness:0});
 const ball=(radius,mat,position,scale)=>{const m=new THREE.Mesh(new THREE.SphereGeometry(radius,32,24),mat);m.position.set(...position);if(scale)m.scale.set(...scale);group.add(m);return m;};
 // Posterior skull closes side views; no image plane or torso participates.
 const headVolume=buildHeadVolume(face,skin);group.add(headVolume);
 ball(1,hair,[0,.25,-.70],[1.01,1.22,.79]);
 for(const side of[-1,1])ball(1,hair,[side*.28,1.05,.25],[.42,.17,.18]);
 const eyes=[];
 for(const [a,b,upper,lower,side]of[[33,133,159,145,'Left'],[263,362,386,374,'Right']]){
  const center=new THREE.Vector3((p.getX(a)+p.getX(b))/2,(p.getY(upper)+p.getY(lower))/2,.015);
  const radius=Math.abs(p.getX(a)-p.getX(b))*.55;
  const eye=new THREE.Group();eye.name='Eye'+side;eye.position.copy(center);group.add(eye);
  const sclera=new THREE.Mesh(new THREE.SphereGeometry(radius,32,24),new THREE.MeshStandardMaterial({color:0xeee5d8,roughness:.32}));sclera.scale.z=.55;eye.add(sclera);
  const irisMaterial=new THREE.MeshStandardMaterial({color:persona==='solenne'?0x477178:0x6b482b,roughness:.4});
  const iris=new THREE.Mesh(new THREE.SphereGeometry(radius*.51,32,20),irisMaterial);iris.scale.z=.24;iris.position.z=radius*.55;eye.add(iris);
  const pupil=new THREE.Mesh(new THREE.SphereGeometry(radius*.25,24,16),new THREE.MeshStandardMaterial({color:0x08070b,roughness:.2}));pupil.scale.z=.25;pupil.position.z=radius*.68;eye.add(pupil);
  const glint=new THREE.Mesh(new THREE.SphereGeometry(radius*.075,12,8),new THREE.MeshBasicMaterial({color:0xfff8eb}));glint.position.set(-radius*.12,radius*.16,radius*.73);eye.add(glint);
  eyes.push({group:eye,side,center});
 }
 // Solid hair locks with depth, taper and a coherent parting; no billboards.
 for(const side of[-1,1])for(let i=0;i<9;i++){
  const t=i/8,z=.16-t*.60,x=side*(.08+t*.43);
  const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(x,1.10,z+.22),new THREE.Vector3(side*(.52+t*.25),1.10-t*.18,z+.17),new THREE.Vector3(side*(.91+t*.12),.32-t*.20,z),new THREE.Vector3(side*(1.04-t*.04),-.43-t*.23,z-.02),new THREE.Vector3(side*(.80+t*.12),-1.03-t*.10,z+.02),new THREE.Vector3(side*(.69+t*.14),-.88-t*.17,z+.04)]);
  const geometry=new THREE.TubeGeometry(curve,36,.115+t*.035,10,false);
  const positions=geometry.attributes.position;
  for(let segment=0;segment<=36;segment++){
   const center=curve.getPointAt(segment/36),taper=segment<27?1:Math.max(.12,(36-segment)/9);
   for(let radial=0;radial<=10;radial++){const index=segment*11+radial,v=new THREE.Vector3().fromBufferAttribute(positions,index).sub(center).multiplyScalar(taper).add(center);positions.setXYZ(index,v.x,v.y,v.z);}
  }
  geometry.computeVertexNormals();const lock=new THREE.Mesh(geometry,hair);group.add(lock);
 }
 if(persona==='velora'){
  const gold=new THREE.MeshStandardMaterial({color:0xc78e31,metalness:.85,roughness:.25});
  const crown=new THREE.Group();crown.name='QueenCrown';group.add(crown);
  const band=new THREE.Mesh(new THREE.TorusGeometry(.58,.035,10,64),gold);band.rotation.x=Math.PI/2;band.position.set(0,1.13,-.23);crown.add(band);
  const shape=new THREE.Shape();shape.moveTo(-.64,1.10);shape.lineTo(-.62,1.48);shape.lineTo(-.31,1.25);shape.lineTo(0,1.78);shape.lineTo(.31,1.25);shape.lineTo(.62,1.48);shape.lineTo(.64,1.10);shape.closePath();
  const front=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:.06,bevelEnabled:true,bevelSize:.025,bevelThickness:.025,bevelSegments:3,steps:1}),gold);const crownPositions=front.geometry.attributes.position;for(let i=0;i<crownPositions.count;i++){const x=crownPositions.getX(i);crownPositions.setZ(i,crownPositions.getZ(i)-.22*(x/.64)**2);}front.geometry.computeVertexNormals();front.position.z=.28;crown.add(front);
  const gem=new THREE.Mesh(new THREE.OctahedronGeometry(.115,1),new THREE.MeshStandardMaterial({color:0x890d29,metalness:.25,roughness:.2}));gem.position.set(0,1.40,.39);gem.scale.set(.7,1.5,.5);crown.add(gem);
 }
 const cavity=ball(1,new THREE.MeshStandardMaterial({color:0x240d16,roughness:1}),[0,-.56,.02],[.27,.10,.075]);
 const teeth=new THREE.Mesh(new THREE.BoxGeometry(.36,.045,.045),new THREE.MeshStandardMaterial({color:0xf1dfc8,roughness:.5}));teeth.position.set(0,-.535,.105);group.add(teeth);
 mergeStaticMaterial(group,hair);
 return {group,eyes,cavity,teeth,headVolume};
}
