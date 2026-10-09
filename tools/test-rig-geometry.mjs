import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {authorFaceMorphs,buildRigAccessories,mergeStaticMaterial,FACE_OVAL} from '../src/rigGeometry.js';
import {createLidTextureMapping} from '../src/rigLidTexture.js';
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
 const blink=geometry.morphAttributes.position[mesh.morphTargetDictionary.eyeBlinkLeft];assert(blink.getY(159)<0);assert(positions[159*3+2]+blink.getZ(159)>.22,'Closed lid must sit in front of iris');assert.equal(blink.getY(10),0);assert.equal(blink.getY(386),0,'Independent eyelids');
 for(const [side,upper,lower]of [['Left',[246,161,160,159,158,157,173],[7,163,144,145,153,154,155]],['Right',[466,388,387,386,385,384,398],[249,390,373,374,380,381,382]]]){
  const delta=geometry.morphAttributes.position[mesh.morphTargetDictionary['eyeBlink'+side]];
  for(let j=0;j<upper.length;j++)for(let axis=0;axis<3;axis++){
   const a=upper[j],b=lower[j],closedA=geometry.attributes.position.getComponent(a,axis)+delta.getComponent(a,axis),closedB=geometry.attributes.position.getComponent(b,axis)+delta.getComponent(b,axis);
   assert(Math.abs(closedA-closedB)<1e-7,'Closed eyelid aperture '+side+' axis '+axis);
  }
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
 assert.equal(accessories.upperTeeth.children.length,1);assert.equal(accessories.lowerTeeth.children.length,1);assert(accessories.upperTeeth.children[0].geometry.attributes.position.array.every(Number.isFinite));assert(accessories.upperTeeth.children[0].geometry.attributes.position.count>100,'Missing individual tooth shaping');assert.equal(accessories.tongue.name,'inner-tongue');
 assert(!accessories.group.children.some(n=>n.geometry?.type==='PlaneGeometry'),'No flat hair plates');
 const lowerReach=(edge,skin,opposite)=>Math.min(4,Math.max(1,Math.abs(geometry.attributes.uv.getY(opposite)-geometry.attributes.uv.getY(edge))*.5/Math.max(1e-6,Math.abs(geometry.attributes.uv.getY(skin)-geometry.attributes.uv.getY(edge)))));
 const leftLowerReach=lowerReach(145,23,159),rightLowerReach=lowerReach(374,253,386);
 const originalUv=geometry.attributes.uv.array.slice(),mapping=createLidTextureMapping(geometry),version=geometry.attributes.uv.version;
 assert.equal(mapping.update({}),false);assert.equal(geometry.attributes.uv.version,version);
 assert(mapping.update({eyeBlinkLeft:.5}));assert.equal(geometry.attributes.uv.getX(386),originalUv[386*2],'Left blink changed right lid');
 assert.equal(geometry.attributes.uv.getY(374),originalUv[374*2+1],'Left blink changed right lower lid');
 assert(Math.abs(geometry.attributes.uv.getY(145)-(originalUv[145*2+1]+(originalUv[23*2+1]-originalUv[145*2+1])*.375*leftLowerReach))<1e-7);
 assert(Math.abs(geometry.attributes.uv.getY(159)-(originalUv[159*2+1]+(originalUv[27*2+1]-originalUv[159*2+1])*.375))<1e-7);
 assert(mapping.update({eyeBlinkLeft:1}));assert(Math.abs(geometry.attributes.uv.getX(159)-(originalUv[159*2]+(originalUv[27*2]-originalUv[159*2])*.75))<1e-7);assert(Math.abs(geometry.attributes.uv.getY(159)-(originalUv[159*2+1]+(originalUv[27*2+1]-originalUv[159*2+1])*.75))<1e-7);
 assert.equal(mapping.update({eyeBlinkLeft:1}),false,'Settled eyelid UVs re-uploaded');
 assert(mapping.update({eyeBlinkRight:1}));assert(Math.abs(geometry.attributes.uv.getY(386)-(originalUv[386*2+1]+(originalUv[257*2+1]-originalUv[386*2+1])*.75))<1e-7);
 assert(Math.abs(geometry.attributes.uv.getY(374)-(originalUv[374*2+1]+(originalUv[253*2+1]-originalUv[374*2+1])*.75*rightLowerReach))<1e-7);
 for(const i of [10,152,14,33,133,263,362])assert.equal(geometry.attributes.uv.getY(i),originalUv[i*2+1],'Lid mapping changed unrelated face region');
 mapping.update({eyeBlinkLeft:.0001});mapping.update({});assert.deepEqual(geometry.attributes.uv.array,originalUv,'Neutral texture was not restored exactly');
 assert.equal(createLidTextureMapping(new THREE.BufferGeometry()),null);
 console.log(persona,supported.length,'authored deformation channels, independent eyes/lid texture mapping, solid accessories and stable neutral positions passed');
}

const parent=new THREE.Group();parent.position.set(3,-2,1);const root=new THREE.Group();root.rotation.y=.3;parent.add(root);const material=new THREE.MeshStandardMaterial();const parts=[];for(const x of[-1,1]){const part=new THREE.Mesh(new THREE.SphereGeometry(.4,16,12),material);part.position.set(x,.1,.2);root.add(part);parts.push(part);}parent.updateMatrixWorld(true);const expected=new THREE.Box3().setFromObject(root),indices=parts.reduce((sum,m)=>sum+m.geometry.index.count,0),vertices=parts.reduce((sum,m)=>sum+m.geometry.attributes.position.count,0);const merged=mergeStaticMaterial(root,material);parent.updateMatrixWorld(true);const actual=new THREE.Box3().setFromObject(root);assert.equal(root.children.length,1);assert.equal(merged.geometry.index.count,indices);assert.equal(merged.geometry.attributes.position.count,vertices);assert(expected.min.distanceTo(actual.min)<1e-6&&expected.max.distanceTo(actual.max)<1e-6);console.log('Static mesh batching preserves indexed triangles, vertices and transformed bounds');
