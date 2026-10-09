// Analytic layered volume on the GPU. No full-frame canvas readback in use.
// It is a visual density model, not CFD; only explicit cues draw new frames.
const vertex = `attribute vec2 aPosition;varying vec2 vUv;void main(){vUv=aPosition*.5+.5;gl_Position=vec4(aPosition,0.,1.);}`;
const fragment = `precision highp float;
varying vec2 vUv;uniform sampler2D uNoise;uniform float uProgress;uniform float uArrival;uniform float uSlices;uniform vec2 uSize;
float n(vec3 p){float a=texture2D(uNoise,(p.xy+vec2(p.z*17.13,p.z*7.71)+.5)/128.).r;float b=texture2D(uNoise,(p.yx*1.73+vec2(p.z*9.1,p.z*23.7)+32.5)/128.).r;return a*.7+b*.3;}
float fbm(vec3 p){return n(p)*.58+n(p*2.07+13.7)*.27+n(p*4.13+37.1)*.11+n(p*8.31+71.9)*.04;}
vec3 film(vec3 x){return pow(clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.),vec3(1./2.2));}
void main(){
 vec2 uv=vec2(vUv.x,1.-vUv.y);vec2 q=(uv-vec2(.5,.48))*2.;
 float time=mix(uProgress*3.,3.+uProgress*1.1,uArrival);
 float envelope=mix(smoothstep(0.,.22,uProgress)*(1.-.46*smoothstep(.65,1.,uProgress)),.54*pow(1.-uProgress,1.6),uArrival);
 float r2=dot(q*q,vec2(.85,.72));float edge=max(0.,1.-r2*.72);
 float clearing=1.-uArrival*smoothstep(0.,.85,uProgress)*exp(-r2*4.);
 float turn=time*.65/(1.+r2*2.6);float denominator=1.+turn*turn;
 float cosine=(1.-turn*turn)/denominator;float sine=2.*turn/denominator;
 vec2 flow=vec2(q.x*cosine-q.y*sine,q.x*sine+q.y*cosine);
 vec3 radiance=vec3(0.);float transmittance=1.;
 for(int i=0;i<6;i++){
  if(float(i)>=uSlices)break;float z=float(i)/uSlices;
  vec3 p=vec3(flow.x*6.,flow.y*6.-time*1.4,z*2.3+time*.12);
  float warp=n(p*.48+vec3(time*.3,-time*.25,8.));
  p.xy+=vec2(warp*3.+sin(p.y*.65+time*.35)*.32,warp*2.);
  float field=fbm(p);float density=max(0.,field-.28)*2.3;
  float back=n(p+vec3(-.22,-.28,.11));float rim=max(0.,back-field)*2.;
  float optical=density*density*edge*envelope*clearing*3.7/uSlices;
  float alpha=1.-exp(-optical);
  float warm=exp(-dot((q+vec2(.32,.05))*(q+vec2(.32,.05)),vec2(4.,2.)))*.18;
  vec3 light=vec3(.13,.17,.22)*(density*.35+.3+rim*2.8)+vec3(.28,.18,.07)*warm;
  radiance+=transmittance*alpha*light;transmittance*=1.-alpha;
 }
 float alpha=min(.94,1.-transmittance);vec3 color=film(radiance/max(.001,alpha));
 // Sub-LSB spatial dithering reduces banding, with no flickering random frame.
 // Reuse bounded noise values: large-coordinate sine hashes can become
 // non-finite on native drivers and turn the upper image black.
 float grain=texture2D(uNoise,(gl_FragCoord.xy+.5)/128.).r-.5;
 gl_FragColor=vec4(color+grain/255.,alpha);
}`;
export class GpuMirrorFog {
  constructor(canvas) {
    this.canvas=canvas;this.frames=0;this.lost=false;
    const gl=canvas.getContext('webgl',{alpha:true,premultipliedAlpha:false,antialias:false,depth:false,stencil:false,preserveDrawingBuffer:false});
    if(!gl)throw new Error('Accelerated smoke unavailable');this.gl=gl;
    canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();this.lost=true});
    const compile=(type,text)=>{const shader=gl.createShader(type);gl.shaderSource(shader,text);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){const message=gl.getShaderInfoLog(shader);gl.deleteShader(shader);throw new Error(message)}return shader};
    try{
      const vs=compile(gl.VERTEX_SHADER,vertex),fs=compile(gl.FRAGMENT_SHADER,fragment);this.program=gl.createProgram();gl.attachShader(this.program,vs);gl.attachShader(this.program,fs);gl.linkProgram(this.program);gl.deleteShader(vs);gl.deleteShader(fs);
      if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(this.program));gl.useProgram(this.program);
      this.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);const attribute=gl.getAttribLocation(this.program,'aPosition');gl.enableVertexAttribArray(attribute);gl.vertexAttribPointer(attribute,2,gl.FLOAT,false,0,0);
      this.texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);
      const noise=new Uint8Array(128*128);let seed=71391;for(let i=0;i<noise.length;i++){seed=(Math.imul(seed,1664525)+1013904223)|0;noise[i]=seed>>>24}gl.texImage2D(gl.TEXTURE_2D,0,gl.LUMINANCE,128,128,0,gl.LUMINANCE,gl.UNSIGNED_BYTE,noise);
      this.uniforms=Object.fromEntries(['uProgress','uArrival','uSlices','uSize','uNoise'].map(name=>[name,gl.getUniformLocation(this.program,name)]));gl.uniform1i(this.uniforms.uNoise,0);
    }catch(error){this.dispose();throw error}
  }
  render(progress,arrival=false,slices=5){
    if(this.lost||this.gl.isContextLost())throw new Error('Smoke graphics context lost');const gl=this.gl;
    gl.viewport(0,0,this.canvas.width,this.canvas.height);gl.useProgram(this.program);gl.uniform1f(this.uniforms.uProgress,Math.max(0,Math.min(1,progress)));gl.uniform1f(this.uniforms.uArrival,arrival?1:0);gl.uniform1f(this.uniforms.uSlices,slices);gl.uniform2f(this.uniforms.uSize,this.canvas.width,this.canvas.height);gl.drawArrays(gl.TRIANGLES,0,3);this.frames++;
  }
  dispose(){const gl=this.gl;if(!gl)return;gl.deleteTexture(this.texture);gl.deleteBuffer(this.buffer);gl.deleteProgram(this.program);gl.getExtension('WEBGL_lose_context')?.loseContext();this.lost=true;}
}
