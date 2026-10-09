import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {authorFaceMorphs,buildRigAccessories,mergeStaticMaterial,buildCrownShell,FACE_OVAL} from '../src/rigGeometry.js';
import {createLidTextureMapping} from '../src/rigLidTexture.js';
const shell=buildCrownShell(),cp=shell.attributes.position,cn=shell.attributes.normal;
assert.equal(cp.count,4*97*2);assert.equal(shell.index.count,96*4*6);assert(cp.array.every(Number.isFinite)&&cn.array.every(Number.isFinite));
const edges=new Map(),key=i=>[cp.getX(i),cp.getY(i),cp.getZ(i)].map(v=>Math.round(v*1e6)).join(',');
for(let i=0;i<shell.index.count;i+=3){const ids=[0,1,2].map(j=>shell.index.getX(i+j));for(let j=0;j<3;j++){const edge=[key(ids[j]),key(ids[(j+1)%3])].sort().join('|');edges.set(edge,(edges.get(edge)||0)+1)}}
assert([...edges.values()].every(n=>n===2),'Crown shell has an open edge or overlapping seam');
for(let strip=0;strip<4;strip++)for(let j=0;j<2;j++){
 const a=strip*194+j,b=a+192;
 for(let axis=0;axis<3;axis++){
  assert(Math.abs(cp.getComponent(a,axis)-cp.getComponent(b,axis))<1e-7,'Crown back seam positions differ');
  assert.equal(cn.getComponent(a,axis),cn.getComponent(b,axis),'Crown back seam normals differ');
 }
}
assert(cp.array.some((v,i)=>i%3===2&&v<-.78),'Crown has no rear volume');
shell.dispose();
for(const persona of ['velora','solenne']){
 const bytes=fs.readFileSync(new URL(`../src/assets/personas/${persona}-3d-v1.glb`,import.meta.url)),length=bytes.readUInt32LE(12),gltf=JSON.parse(bytes.subarray(20,20+length)),bin=bytes.subarray(28+length),primitive=gltf.meshes[0].primitives[0];
 const accessor=gltf.accessors[primitive.attributes.POSITION],view=gltf.bufferViews[accessor.bufferView],start=(view.byteOffset||0)+(accessor.byteOffset||0),positions=new Float32Array(accessor.count*3);
 for(let i=0;i<positions.length;i++)positions[i]=bin.readFloatLE(start+i*4);
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
 for(const [key,name,size]of [['TEXCOORD_0','uv',2],['COLOR_0','color',3]]){
  const a=gltf.accessors[primitive.attributes[key]],v=gltf.bufferViews[a.bufferView],offset=(v.byteOffset||0)+(a.byteOffset||0),values=new Float32Array(a.count*size);
  assert.equal(a.componentType,5126);for(let i=0;i<values.length;i++)values[i]=bin.readFloatLE(offset+i*4);
  geometry.setAttribute(name,new THREE.BufferAttribute(values,size));
 }
 const indexAccessor=gltf.accessors[primitive.indices],indexView=gltf.bufferViews[indexAccessor.bufferView],indexStart=(indexView.byteOffset||0)+(indexAccessor.byteOffset||0),indices=[];for(let i=0;i<indexAccessor.count;i++)indices.push(indexAccessor.componentType===5125?bin.readUInt32LE(indexStart+i*4):bin.readUInt16LE(indexStart+i*2));geometry.setIndex(indices);geometry.computeVertexNormals();
 const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial());mesh.morphTargetDictionary=Object.fromEntries(gltf.meshes[0].extras.targetNames.map((n,i)=>[n,i]));
 const before=positions.slice(),supported=authorFaceMorphs(mesh);assert(supported.length>=25);assert.deepEqual(positions,before);assert.equal(geometry.morphTargetsRelative,true);assert.equal(geometry.morphAttributes.normal.length,geometry.morphAttributes.position.length);assert(geometry.morphAttributes.normal.every(n=>n.count===positions.length/3&&n.array.every(Number.isFinite)));
 for(const name of ['eyeBlinkLeft','eyeBlinkRight','browInnerUp','jawOpen','mouthSmileLeft','mouthFunnel','mouthRollLower'])assert(supported.includes(name));
 assert(!supported.includes('tongueOut'),'Do not claim unsupported tongue');
 const jaw=geometry.morphAttributes.position[mesh.morphTargetDictionary.jawOpen];assert(jaw.getY(14)<-.15);assert(jaw.getY(10)===0,'Speech cannot shift forehead');
 const lipUpper=[78,191,80,81,82,13,312,311,310,415,308],lipLower=[78,95,88,178,87,14,317,402,318,324,308];
 const closed=geometry.morphAttributes.position[mesh.morphTargetDictionary.mouthClose];
 for(let j=1;j<lipUpper.length-1;j++)for(let axis=0;axis<3;axis++){
  const a=lipUpper[j],b=lipLower[j];
  assert(Math.abs(geometry.attributes.position.getComponent(a,axis)+closed.getComponent(a,axis)-geometry.attributes.position.getComponent(b,axis)-closed.getComponent(b,axis))<1e-7,'Authored mouth closure leaves a 3D lip gap');
  for(const name of ['mouthSmileLeft','mouthSmileRight','mouthFrownLeft','mouthFrownRight']){
   const emotion=geometry.morphAttributes.position[mesh.morphTargetDictionary[name]];
   assert.equal(emotion.getComponent(a,axis),emotion.getComponent(b,axis),'Emotion reopens sealed inner lips');
  }
  for(const name of ['mouthPressLeft','mouthPressRight']){
   const press=geometry.morphAttributes.position[mesh.morphTargetDictionary[name]];
   assert.equal(press.getComponent(a,axis),0,'Lip press moves sealed inner edge');assert.equal(press.getComponent(b,axis),0,'Lip press moves sealed inner edge');
  }
 }
 const blink=geometry.morphAttributes.position[mesh.morphTargetDictionary.eyeBlinkLeft];assert(blink.getY(159)<0);assert(positions[159*3+2]+blink.getZ(159)>.22,'Closed lid must sit in front of iris');assert.equal(blink.getY(10),0);assert.equal(blink.getY(386),0,'Independent eyelids');
 for(const [side,upper,lower]of [['Left',[246,161,160,159,158,157,173],[7,163,144,145,153,154,155]],['Right',[466,388,387,386,385,384,398],[249,390,373,374,380,381,382]]]){
  const delta=geometry.morphAttributes.position[mesh.morphTargetDictionary['eyeBlink'+side]];
  for(let j=0;j<upper.length;j++)for(let axis=0;axis<3;axis++){
   const a=upper[j],b=lower[j],closedA=geometry.attributes.position.getComponent(a,axis)+delta.getComponent(a,axis),closedB=geometry.attributes.position.getComponent(b,axis)+delta.getComponent(b,axis);
   assert(Math.abs(closedA-closedB)<1e-7,'Closed eyelid aperture '+side+' axis '+axis);
  }
 }
 for(const [side,upper,lower,upperSkin,lowerSkin]of [
  ['Left',[246,161,160,159,158,157,173],[7,163,144,145,153,154,155],[247,30,29,27,28,56,190],[25,110,24,23,22,26,112]],
  ['Right',[466,388,387,386,385,384,398],[249,390,373,374,380,381,382],[467,260,259,257,258,286,414],[255,339,254,253,252,256,341]]
 ])for(const channel of ['eyeBlink','eyeSquint','eyeWide']){
  const d=geometry.morphAttributes.position[mesh.morphTargetDictionary[channel+side]];
  for(let j=0;j<upper.length;j++)for(let axis=0;axis<3;axis++){
   assert(Math.abs(d.getComponent(upperSkin[j],axis)-d.getComponent(upper[j],axis)*.6)<1e-7,'Upper fold does not follow lash edge');
   assert(Math.abs(d.getComponent(lowerSkin[j],axis)-d.getComponent(lower[j],axis)*.6)<1e-7,'Lower fold does not follow lash edge');
  }
  for(const i of [10,152,14,side==='Left'?257:27])for(let axis=0;axis<3;axis++)assert.equal(d.getComponent(i,axis),0,'Fold moved unrelated face or opposite lid');
 }
 const accessories=buildRigAccessories(mesh,persona);const volume=accessories.headVolume.geometry;assert.equal(volume.attributes.position.count,FACE_OVAL.length*8+1);
 assert.equal(accessories.headVolume.material,mesh.material,'Head and face use different surface shading');
 for(const name of ['uv','color']){
  assert.equal(volume.attributes[name].count,volume.attributes.position.count);assert(volume.attributes[name].array.every(Number.isFinite));
  for(let j=0;j<FACE_OVAL.length*8;j++)for(let axis=0;axis<geometry.attributes[name].itemSize;axis++)assert.equal(volume.attributes[name].getComponent(j,axis),geometry.attributes[name].getComponent(FACE_OVAL[j%FACE_OVAL.length],axis),'Head boundary appearance mismatch '+name);
 }
 for(let j=0;j<FACE_OVAL.length;j++){
  const i=FACE_OVAL[j];for(const axis of ['X','Y','Z'])assert(Math.abs(volume.attributes.position['get'+axis](j)-geometry.attributes.position['get'+axis](i))<1e-7);
  for(let t=0;t<geometry.morphAttributes.position.length;t++)for(const key of['position','normal'])for(const axis of ['X','Y','Z'])assert(Math.abs(volume.morphAttributes[key][t]['get'+axis](j)-geometry.morphAttributes[key][t]['get'+axis](i))<1e-7,'Volume seam drift '+key);
 }
 assert.equal(accessories.eyes.length,2);assert(accessories.eyes.every(e=>e.group.children.length===4));assert.equal(accessories.group.getObjectByName('QueenCrown')!=null,persona==='velora');
 const irises=accessories.eyes.map(e=>e.group.getObjectByName('Iris'+e.side));
 assert(irises.every(i=>i?.isMesh));assert.equal(irises[0].material,irises[1].material,'Iris texture/material not shared');
 const irisMap=irises[0].material.map;assert.equal(irisMap.image.width,128);assert.equal(irisMap.image.height,128);assert.equal(irisMap.image.data.length,128*128*4);assert.equal(irisMap.colorSpace,THREE.SRGBColorSpace);
 assert.equal(irisMap.image.data.filter((_,i)=>i%4===3).every(a=>a===255),true);
 assert(new Set(irisMap.image.data.filter((_,i)=>i%4===0)).size>30,'Iris lacks surface detail');
 for(const iris of irises){const p=iris.geometry.attributes.position,uv=iris.geometry.attributes.uv;assert.equal(p.count,33*21);assert(uv.array.every(v=>Number.isFinite(v)&&v>=0&&v<=1));}
 assert.equal(accessories.upperTeeth.children.length,1);assert.equal(accessories.lowerTeeth.children.length,1);assert(accessories.upperTeeth.children[0].geometry.attributes.position.array.every(Number.isFinite));assert(accessories.upperTeeth.children[0].geometry.attributes.position.count>100,'Missing individual tooth shaping');assert.equal(accessories.tongue.name,'inner-tongue');
 if(persona==='velora'){
  const crown=accessories.group.getObjectByName('QueenCrown');assert.equal(crown.children.length,2,'Crown metal is not batched');
  const metal=crown.getObjectByName('sculpted-crown'),ruby=crown.getObjectByName('crown-ruby');assert(metal?.isMesh&&ruby?.isMesh);
  assert(metal.geometry.attributes.position.array.every(Number.isFinite));assert.equal(metal.geometry.attributes.uv.count,metal.geometry.attributes.position.count);
  assert(metal.geometry.attributes.position.count<5000,'Crown geometry exceeds its bounded budget');
 }
 const hair=accessories.group.getObjectByName('sculpted-hair');assert(hair?.isMesh);const hp=hair.geometry.attributes.position;
 assert(hp.count<6000,'Hair geometry exceeds its bounded budget');assert(hp.array.every(Number.isFinite)&&hair.geometry.attributes.normal.array.every(Number.isFinite));
 assert.equal(hair.geometry.attributes.normal.count,hp.count);assert.equal(hair.geometry.attributes.uv.count,hp.count);
 const hairEdges=new Map(),hairKey=i=>[hp.getX(i),hp.getY(i),hp.getZ(i)].map(v=>Math.round(v*1e6)).join(',');
 for(let i=0;i<hair.geometry.index.count;i+=3){const ids=[0,1,2].map(j=>hair.geometry.index.getX(i+j));for(let j=0;j<3;j++){const edge=[hairKey(ids[j]),hairKey(ids[(j+1)%3])].sort().join('|');hairEdges.set(edge,(hairEdges.get(edge)||0)+1)}}
 assert([...hairEdges.values()].every(n=>n===2),'Hair has an open cap or seam');
 const hairNormals=new Map();for(let i=0;i<hp.count;i++){
  const k=hairKey(i),n=[0,1,2].map(axis=>hair.geometry.attributes.normal.getComponent(i,axis)),previous=hairNormals.get(k);
  if(previous)assert(n.every((v,axis)=>Math.abs(v-previous[axis])<1e-5),'Welded hair seam has mismatched normals');else hairNormals.set(k,n);
 }

 assert(!accessories.group.children.some(n=>n.geometry?.type==='PlaneGeometry'),'No flat hair plates');
 const lowerReach=(edge,skin,opposite)=>Math.min(8,Math.max(1,Math.abs(geometry.attributes.uv.getY(opposite)-geometry.attributes.uv.getY(edge))*.5/Math.max(1e-6,Math.abs(geometry.attributes.uv.getY(skin)-geometry.attributes.uv.getY(edge)))));
 const leftLowerReach=lowerReach(145,23,159),rightLowerReach=lowerReach(374,253,386);
 const originalUv=geometry.attributes.uv.array.slice(),mapping=createLidTextureMapping(geometry),version=geometry.attributes.uv.version;
 assert.equal(mapping.update({}),false);assert.equal(geometry.attributes.uv.version,version);
 assert(mapping.update({eyeBlinkLeft:.5}));assert.equal(geometry.attributes.uv.getX(386),originalUv[386*2],'Left blink changed right lid');
 assert.equal(geometry.attributes.uv.getY(374),originalUv[374*2+1],'Left blink changed right lower lid');
 assert(Math.abs(geometry.attributes.uv.getY(145)-(originalUv[145*2+1]+(originalUv[23*2+1]-originalUv[145*2+1])*.375*leftLowerReach))<1e-7);
 assert(Math.abs(geometry.attributes.uv.getY(159)-(originalUv[159*2+1]+(originalUv[27*2+1]-originalUv[159*2+1])*.375))<1e-7);
 assert(mapping.update({eyeBlinkLeft:1}));assert(Math.abs(geometry.attributes.uv.getX(159)-(originalUv[159*2]+(originalUv[27*2]-originalUv[159*2])*.75))<1e-7);assert(Math.abs(geometry.attributes.uv.getY(159)-(originalUv[159*2+1]+(originalUv[27*2+1]-originalUv[159*2+1])*.75))<1e-7);
 for(const [i,s]of [[7,25],[155,112]]){
  const height=Math.abs(originalUv[159*2+1]-originalUv[145*2+1]),reach=Math.min(8,Math.max(1,height*.5/Math.max(1e-6,Math.abs(originalUv[s*2+1]-originalUv[i*2+1]))));
  assert(Math.abs(geometry.attributes.uv.getY(i)-(originalUv[i*2+1]+(originalUv[s*2+1]-originalUv[i*2+1])*.75*reach))<1e-7,'Corner samples painted eye instead of central skin reach');
 }
 assert.equal(mapping.update({eyeBlinkLeft:1}),false,'Settled eyelid UVs re-uploaded');
 assert(mapping.update({eyeBlinkRight:1}));assert(Math.abs(geometry.attributes.uv.getY(386)-(originalUv[386*2+1]+(originalUv[257*2+1]-originalUv[386*2+1])*.75))<1e-7);
 assert(Math.abs(geometry.attributes.uv.getY(374)-(originalUv[374*2+1]+(originalUv[253*2+1]-originalUv[374*2+1])*.75*rightLowerReach))<1e-7);
 for(const i of [10,152,14,33,133,263,362])assert.equal(geometry.attributes.uv.getY(i),originalUv[i*2+1],'Lid mapping changed unrelated face region');
 mapping.update({eyeBlinkLeft:.0001});mapping.update({});assert.deepEqual(geometry.attributes.uv.array,originalUv,'Neutral texture was not restored exactly');
 assert.equal(createLidTextureMapping(new THREE.BufferGeometry()),null);
 console.log(persona,supported.length,'authored deformation channels, independent eyes/lid texture mapping, solid accessories and stable neutral positions passed');
}

const parent=new THREE.Group();parent.position.set(3,-2,1);const root=new THREE.Group();root.rotation.y=.3;parent.add(root);const material=new THREE.MeshStandardMaterial();const parts=[];for(const x of[-1,1]){const part=new THREE.Mesh(new THREE.SphereGeometry(.4,16,12),material);part.position.set(x,.1,.2);root.add(part);parts.push(part);}parent.updateMatrixWorld(true);const expected=new THREE.Box3().setFromObject(root),indices=parts.reduce((sum,m)=>sum+m.geometry.index.count,0),vertices=parts.reduce((sum,m)=>sum+m.geometry.attributes.position.count,0);const merged=mergeStaticMaterial(root,material);parent.updateMatrixWorld(true);const actual=new THREE.Box3().setFromObject(root);assert.equal(root.children.length,1);assert.equal(merged.geometry.index.count,indices);assert.equal(merged.geometry.attributes.position.count,vertices);assert(expected.min.distanceTo(actual.min)<1e-6&&expected.max.distanceTo(actual.max)<1e-6);console.log('Static mesh batching preserves indexed triangles, vertices and transformed bounds');
