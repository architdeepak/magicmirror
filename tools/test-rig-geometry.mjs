import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {authorFaceMorphs,buildRigAccessories} from '../src/rigGeometry.js';
for(const persona of ['velora','solenne']){
 const bytes=fs.readFileSync(new URL(`../src/assets/personas/${persona}-3d-v1.glb`,import.meta.url)),length=bytes.readUInt32LE(12),gltf=JSON.parse(bytes.subarray(20,20+length)),bin=bytes.subarray(28+length),primitive=gltf.meshes[0].primitives[0];
 const accessor=gltf.accessors[primitive.attributes.POSITION],view=gltf.bufferViews[accessor.bufferView],start=(view.byteOffset||0)+(accessor.byteOffset||0),positions=new Float32Array(accessor.count*3);
 for(let i=0;i<positions.length;i++)positions[i]=bin.readFloatLE(start+i*4);
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
 const indexAccessor=gltf.accessors[primitive.indices],indexView=gltf.bufferViews[indexAccessor.bufferView],indexStart=(indexView.byteOffset||0)+(indexAccessor.byteOffset||0),indices=[];for(let i=0;i<indexAccessor.count;i++)indices.push(indexAccessor.componentType===5125?bin.readUInt32LE(indexStart+i*4):bin.readUInt16LE(indexStart+i*2));geometry.setIndex(indices);geometry.computeVertexNormals();
 const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial());mesh.morphTargetDictionary=Object.fromEntries(gltf.meshes[0].extras.targetNames.map((n,i)=>[n,i]));
 const before=positions.slice(),supported=authorFaceMorphs(mesh);assert(supported.length>=25);assert.deepEqual(positions,before);assert.equal(geometry.morphTargetsRelative,true);assert.equal(geometry.morphAttributes.normal.length,geometry.morphAttributes.position.length);assert(geometry.morphAttributes.normal.every(n=>n.count===positions.length/3&&n.array.every(Number.isFinite)));
 for(const name of ['eyeBlinkLeft','eyeBlinkRight','browInnerUp','jawOpen','mouthSmileLeft','mouthFunnel'])assert(supported.includes(name));
 assert(!supported.includes('tongueOut'),'Do not claim unsupported tongue');
 const jaw=geometry.morphAttributes.position[mesh.morphTargetDictionary.jawOpen];assert(jaw.getY(14)<-.15);assert(jaw.getY(10)===0,'Speech cannot shift forehead');
 const blink=geometry.morphAttributes.position[mesh.morphTargetDictionary.eyeBlinkLeft];assert(blink.getY(159)<0);assert(positions[159*3+2]+blink.getZ(159)>.22,'Closed lid must sit in front of iris');assert.equal(blink.getY(10),0);assert.equal(blink.getY(386),0,'Independent eyelids');
 const accessories=buildRigAccessories(mesh,persona);assert.equal(accessories.eyes.length,2);assert(accessories.eyes.every(e=>e.group.children.length===4));assert.equal(accessories.group.getObjectByName('QueenCrown')!=null,persona==='velora');
 assert(!accessories.group.children.some(n=>n.geometry?.type==='PlaneGeometry'),'No flat hair plates');
 console.log(persona,supported.length,'authored deformation channels, independent eyes, solid accessories and stable neutral positions passed');
}
