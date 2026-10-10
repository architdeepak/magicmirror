import * as THREE from 'three';

// One small static map per persona, shared by both eyes. No runtime synthesis.
export function createIrisTexture(persona) {
  const size=128,data=new Uint8Array(size*size*4);
  const brown=persona!=='solenne';
  const base=new THREE.Color(brown?0x795639:0x48747a);
  const inner=new THREE.Color(brown?0x90603b:0x858666);
  const rim=new THREE.Color(brown?0x30261f:0x213b40);
  const smooth=(a,b,x)=>{const t=THREE.MathUtils.clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
  const color=new THREE.Color();
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const dx=(x+.5)*2/size-1,dy=(y+.5)*2/size-1;
    const radius=Math.hypot(dx,dy),angle=Math.atan2(dy,dx);
    // Integer angular frequencies keep the radial pattern continuous at ±pi.
    const fibers=.5+.5*Math.sin(angle*61+Math.sin(angle*17)*1.8+radius*13);
    const fine=.5+.5*Math.sin(angle*113+radius*27);
    color.copy(base).lerp(inner,(1-smooth(.48,.77,radius))*.4);
    color.multiplyScalar(.70+.24*fibers+.10*fine);
    color.lerp(rim,smooth(.84,.98,radius));
    color.lerp(rim,(1-smooth(.42,.52,radius))*.5);
    color.convertLinearToSRGB();
    const i=(y*size+x)*4;
    data[i]=Math.round(255*color.r);data[i+1]=Math.round(255*color.g);data[i+2]=Math.round(255*color.b);data[i+3]=255;
  }
  const texture=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);
  texture.name='local-iris-'+persona;texture.colorSpace=THREE.SRGBColorSpace;
  texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps=true;texture.needsUpdate=true;
  return texture;
}

export function irisGeometry(radius) {
  const geometry=new THREE.SphereGeometry(radius,32,20),p=geometry.attributes.position,uv=geometry.attributes.uv;
  // Planar projection keeps fibers radial on the visible front hemisphere.
  for(let i=0;i<p.count;i++)uv.setXY(i,THREE.MathUtils.clamp(.5+p.getX(i)/(2*radius),0,1),THREE.MathUtils.clamp(.5+p.getY(i)/(2*radius),0,1));
  return geometry;
}
