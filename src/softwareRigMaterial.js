import * as THREE from 'three';

// CPU rasterizers need a cheaper lighting shader, not a smaller/flat face.
// Keep authored topology, local morphs, original textures and direct lights.
export function softwareRigMaterial(source) {
  if (!source.isMeshStandardMaterial) return source;
  const metal=THREE.MathUtils.clamp(source.metalness||0,0,1);
  const rough=THREE.MathUtils.clamp(source.roughness??.7,.15,1);
  const material=new THREE.MeshPhongMaterial({
    color:source.color.clone().multiplyScalar(1-metal*.35),
    specular:new THREE.Color(.04,.04,.04).lerp(source.color,metal),
    shininess:Math.min(96,Math.max(2,2/rough**4-2)),
    map:source.map,normalMap:source.normalMap,normalScale:source.normalScale?.clone(),
    aoMap:source.aoMap,aoMapIntensity:source.aoMapIntensity,
    bumpMap:source.bumpMap,bumpScale:source.bumpScale,alphaMap:source.alphaMap,
    side:source.side,transparent:source.transparent,opacity:source.opacity,
    alphaTest:source.alphaTest,depthTest:source.depthTest,depthWrite:source.depthWrite,
    vertexColors:source.vertexColors,toneMapped:source.toneMapped
  });
  material.name=source.name;
  // Retain ownership of any source maps the cheaper shader does not consume.
  material.userData.sourceTextures=Object.values(source).filter(value=>value?.isTexture);
  return material;
}

export function useSoftwareRigLighting(root){
  const materials=new Map();
  root.traverse(node=>{if(!node.isMesh)return;const convert=source=>{
    if(!materials.has(source))materials.set(source,softwareRigMaterial(source));
    return materials.get(source);
  };node.material=Array.isArray(node.material)?node.material.map(convert):convert(node.material);});
  for(const [source,result]of materials)if(source!==result)source.dispose();
}
