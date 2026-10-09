import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {authorFaceMorphs,buildRigAccessories,mergeStaticMaterial,FACE_OVAL} from '../src/rigGeometry.js';
for(const persona of ['velora','solenne']){
 const bytes=fs.readFileSync(new URL(`../src/assets/personas/${persona}-3d-v1.glb`,import.meta.url)),length=bytes.readUInt32LE(12),gltf=JSON.parse(bytes.subarray(20,20+length)),bin=bytes.subarray(28+length),primitive=gltf.meshes[0].primitives[0];
 const accessor=gltf.accessors[primitive.attributes.POSITION],view=gltf.bufferViews[accessor.bufferView],start=(view.byteOffset||0)+(accessor.byteOffset||0),positions=new Float32Array(accessor.count*3);
 for(let i=0;i<positions.length;i++)positions[i]=bin.readFloatLE(start+i*4);
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
 const indexAccessor=gltf.accessors[primitive.indices],indexView=gltf.bufferViews[indexAccessor.bufferView],indexStart=(indexView.byteOffset||0)+(indexAccessor.byteOffset||0),indices=[];for(let i=0;i<indexAccessor.count;i++)indices.push(indexAccessor.componentType===5125?bin.readUInt32LE(indexStart+i*4):bin.readUInt16LE(indexStart+i*2));geometry.setIndex(indices);geometry.computeVertexNormals();
 const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial());mesh.morphTargetDictionary=Object.fromEntries(gltf.meshes[0].extras.targetNames.map((n,i)=>[n,i]));
 const before=positions.slice(),supported=authorFaceMorphs(mesh);assert(supported.length>=25);assert.deepEqual(positions,before);assert.equal(geometry.morphTargetsRelative,true);assert.equal(geometry.morphAttributes.normal.length,geometry.morphAttributes.position.length);assert(geometry.morphAttributes.normal.every(n=>n.count===positions.length/3&&n.array.every(Number.isFinite)));
 for(const name of ['eyeBlinkLeft','eyeBlinkRight','browInnerUp','jawOpen','mouthSmileLeft','mouthFunnel','mouthRollLower'])assert(supported.includes(name));
 assert(!supported.includes('tongueOut'),'Do not claim unsupported tongue');
 const jaw=geometry.morphAttributes.position[mesh.morphTargetDictionary.jawOpen];assert(jaw.getY(14)<-.15);assert(jaw.getY(10)===0,'Speech cannot shift forehead');
 const blink=geometry.morphAttributes.position[mesh.morphTargetDictionary.eyeBlinkLeft];assert(blink.getY(159)<0);assert(positions[159*3+2]+blink.getZ(159)>.22,'Closed lid must sit in front of iris');assert.equal(blink.getY(10),0);assert.equal(blink.getY(386),0,'Independent eyelids');
 const accessories=buildRigAccessories(mesh,persona);const volume=accessories.headVolume.geometry;assert.equal(volume.attributes.position.count,FACE_OVAL.length*8+1);
 for(let j=0;j<FACE_OVAL.length;j++){
  const i=FACE_OVAL[j];for(const axis of ['X','Y','Z'])assert(Math.abs(volume.attributes.position['get'+axis](j)-geometry.attributes.position['get'+axis](i))<1e-7);
  for(let t=0;t<geometry.morphAttributes.position.length;t++)for(const key of['position','normal'])for(const axis of ['X','Y','Z'])assert(Math.abs(volume.morphAttributes[key][t]['get'+axis](j)-geometry.morphAttributes[key][t]['get'+axis](i))<1e-7,'Volume seam drift '+key);
 }
 assert.equal(accessories.eyes.length,2);assert(accessories.eyes.every(e=>e.group.children.length===4));assert.equal(accessories.group.getObjectByName('QueenCrown')!=null,persona==='velora');
 assert.equal(accessories.upperTeeth.children.length,1);assert.equal(accessories.lowerTeeth.children.length,1);assert(accessories.upperTeeth.children[0].geometry.attributes.position.array.every(Number.isFinite));assert(accessories.upperTeeth.children[0].geometry.attributes.position.count>100,'Missing individual tooth shaping');assert.equal(accessories.tongue.name,'inner-tongue');
 assert(!accessories.group.children.some(n=>n.geometry?.type==='PlaneGeometry'),'No flat hair plates');
 console.log(persona,supported.length,'authored deformation channels, independent eyes, solid accessories and stable neutral positions passed');
}

const parent=new THREE.Group();parent.position.set(3,-2,1);const root=new THREE.Group();root.rotation.y=.3;parent.add(root);const material=new THREE.MeshStandardMaterial();const parts=[];for(const x of[-1,1]){const part=new THREE.Mesh(new THREE.SphereGeometry(.4,16,12),material);part.position.set(x,.1,.2);root.add(part);parts.push(part);}parent.updateMatrixWorld(true);const expected=new THREE.Box3().setFromObject(root),indices=parts.reduce((sum,m)=>sum+m.geometry.index.count,0),vertices=parts.reduce((sum,m)=>sum+m.geometry.attributes.position.count,0);const merged=mergeStaticMaterial(root,material);parent.updateMatrixWorld(true);const actual=new THREE.Box3().setFromObject(root);assert.equal(root.children.length,1);assert.equal(merged.geometry.index.count,indices);assert.equal(merged.geometry.attributes.position.count,vertices);assert(expected.min.distanceTo(actual.min)<1e-6&&expected.max.distanceTo(actual.max)<1e-6);console.log('Static mesh batching preserves indexed triangles, vertices and transformed bounds');
