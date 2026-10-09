// Native-resolution display enhancement. Original camera/ML pixels are untouched.
const VERTEX=`attribute vec2 position;varying vec2 uv;void main(){uv=vec2(position.x*.5+.5,.5-position.y*.5);gl_Position=vec4(position,0.,1.);}`;
const FRAGMENT=`precision highp float;
varying vec2 uv;uniform sampler2D source;uniform vec2 texel;uniform float gamma;uniform float gain;
float light(vec4 p,float fallback){return p.a>16./255.?dot(p.rgb,vec3(.2126,.7152,.0722)):fallback;}
void main(){vec4 p=texture2D(source,uv);if(p.a==0.){gl_FragColor=p;return;}
float center=dot(p.rgb,vec3(.2126,.7152,.0722));
float detail=center-(light(texture2D(source,uv-vec2(texel.x,0.)),center)+light(texture2D(source,uv+vec2(texel.x,0.)),center)+light(texture2D(source,uv-vec2(0.,texel.y)),center)+light(texture2D(source,uv+vec2(0.,texel.y)),center))*.25;
float sharpen=abs(detail)>3./255.?clamp(detail*.28,-8./255.,8./255.):0.;
vec3 curved=floor(clamp(gain*pow(p.rgb,vec3(gamma)),0.,1.)*255.+.5)/255.;
gl_FragColor=vec4(clamp(curved+sharpen,0.,1.),p.a);}`;
export class CameraClarityGpu {
 constructor(ownerDocument){
  this.canvas=ownerDocument.createElement('canvas');
  this.gl=this.canvas.getContext('webgl',{alpha:true,premultipliedAlpha:false,antialias:false,depth:false,stencil:false,preserveDrawingBuffer:true,powerPreference:'low-power'});
  const gl=this.gl;
  try{
   if(!gl?.createShader)throw Error('Camera enhancement graphics unavailable');
   const info=gl.getExtension('WEBGL_debug_renderer_info');
   this.renderer=String(info?gl.getParameter(info.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER));
   if(/swiftshader|llvmpipe|software|softpipe/i.test(this.renderer))throw Error('Software camera enhancement would add graphics work');
   const compile=(type,source)=>{const shader=gl.createShader(type);this.shaders.push(shader);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error('Camera shader compilation failed');return shader;};
   this.shaders=[];this.program=gl.createProgram();gl.attachShader(this.program,compile(gl.VERTEX_SHADER,VERTEX));gl.attachShader(this.program,compile(gl.FRAGMENT_SHADER,FRAGMENT));gl.linkProgram(this.program);
   if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw Error('Camera shader linking failed');
   gl.useProgram(this.program);this.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
   const position=gl.getAttribLocation(this.program,'position');gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
   this.texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.texture);
   for(const [key,value]of [[gl.TEXTURE_MIN_FILTER,gl.NEAREST],[gl.TEXTURE_MAG_FILTER,gl.NEAREST],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]])gl.texParameteri(gl.TEXTURE_2D,key,value);
   this.uniforms=Object.fromEntries(['source','texel','gamma','gain'].map(name=>[name,gl.getUniformLocation(this.program,name)]));gl.uniform1i(this.uniforms.source,0);
   this.canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();this.lost=true;});
  }catch(error){this.dispose();throw error;}
 }
 process(frame,profile){
  const gl=this.gl;if(this.lost||gl.isContextLost())throw Error('Camera enhancement context lost');
  if(frame.width*frame.height>1280*720)throw Error('Camera enhancement pixel limit exceeded');
  if(this.canvas.width!==frame.width||this.canvas.height!==frame.height){this.canvas.width=frame.width;this.canvas.height=frame.height;gl.viewport(0,0,frame.width,frame.height);}
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,frame);
  gl.uniform2f(this.uniforms.texel,1/frame.width,1/frame.height);gl.uniform1f(this.uniforms.gamma,profile.gamma);gl.uniform1f(this.uniforms.gain,profile.gain);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
  if(gl.getError()!==gl.NO_ERROR)throw Error('Camera enhancement draw failed');
  return this.canvas;
 }
 dispose(){const gl=this.gl;if(gl?.deleteProgram){if(this.texture)gl.deleteTexture(this.texture);if(this.buffer)gl.deleteBuffer(this.buffer);if(this.program)gl.deleteProgram(this.program);for(const shader of this.shaders||[])gl.deleteShader(shader);gl.getExtension('WEBGL_lose_context')?.loseContext();}this.canvas.width=this.canvas.height=1;}
}
