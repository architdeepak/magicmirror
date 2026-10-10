import * as THREE from 'three';

// A closed curved root volume, shared with the existing batched hair material.
export function buildHairCap(persona) {
  const segments=96,rings=11,positions=[],indices=[];
  for(let row=0;row<rings;row++){
    const latitude=row/rings*Math.PI/2,t=Math.sin(latitude),radial=Math.cos(latitude);
    for(let col=0;col<=segments;col++){
      const angle=col/segments*Math.PI*2,s=Math.sin(angle),c=Math.cos(angle);
      const front=Math.max(0,c),queen=persona==='velora';
      const peak=(queen?.07:.06)*Math.exp(-(((s-(queen?0:.30))/(queen?.20:.30))**2));
      const base=.80+.19*front-peak*front;
      positions.push(.86*s*radial,base+(1.47-base)*t,-.26+.64*c*radial);
    }
  }
  for(let row=0;row<rings-1;row++)for(let col=0;col<segments;col++){
    const a=row*(segments+1)+col,b=a+segments+1;
    indices.push(a,b,a+1,b,b+1,a+1);
  }
  const top=positions.length/3;positions.push(0,1.47,-.26);
  const bottom=positions.length/3;positions.push(0,.80,-.26);
  for(let col=0;col<segments;col++){
    const a=(rings-1)*(segments+1)+col;
    indices.push(a,top,a+1,col,col+1,bottom);
  }
  for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(Array(positions.length/3*2).fill(0),2));geometry.setIndex(indices);geometry.computeVertexNormals();
  // Match the duplicated angular seam after normal generation.
  const normal=geometry.attributes.normal;
  for(let row=0;row<rings;row++){
    const a=row*(segments+1),b=a+segments,n=new THREE.Vector3().fromBufferAttribute(normal,a).add(new THREE.Vector3().fromBufferAttribute(normal,b)).normalize();
    normal.setXYZ(a,n.x,n.y,n.z);normal.setXYZ(b,n.x,n.y,n.z);
  }
  return geometry;
}
