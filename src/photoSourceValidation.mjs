// Shared browser/native preflight: check dimensions before image decoding.
export const PHOTO_SOURCE_MAX_BYTES=20_000_000;
export const PHOTO_SOURCE_MAX_PIXELS=24_000_000;
export function photoSourceDimensions(bytes,mime){
 if(!(bytes instanceof Uint8Array)||!bytes.length||bytes.length>PHOTO_SOURCE_MAX_BYTES)throw new Error('Choose a photo under 20 MB.');
 const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),ascii=(at,n)=>String.fromCharCode(...bytes.subarray(at,at+n));
 const need=(at,n)=>{if(at<0||at+n>bytes.length)throw new Error('Photo header is incomplete.');};
 let width,height;
 if(mime==='image/png'){
  need(0,33);if(![137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b)||ascii(12,4)!=='IHDR'||v.getUint32(8)!==13)throw new Error('Choose a valid PNG photo.');
  width=v.getUint32(16);height=v.getUint32(20);
  for(let at=8;at<bytes.length;){need(at,8);const size=v.getUint32(at),type=ascii(at+4,4);need(at+8,size+4);if(type==='acTL')throw new Error('Choose a still clothing photo, not an animation.');at+=size+12;if(type==='IEND')break;}
 }else if(mime==='image/jpeg'){
  need(0,4);if(bytes[0]!==255||bytes[1]!==216)throw new Error('Choose a valid JPG photo.');
  let at=2;
  while(at<bytes.length){
   if(bytes[at++]!==255)throw new Error('Invalid JPG header.');
   while(bytes[at]===255)at++;
   need(at,1);const marker=bytes[at++];
   if(marker===217||marker===218)break;
   if(marker===1||(marker>=208&&marker<=215))continue;
   need(at,2);const size=v.getUint16(at);if(size<2)throw new Error('Invalid JPG header.');need(at,size);
   if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)){if(size<8)throw new Error('Invalid JPG size header.');height=v.getUint16(at+3);width=v.getUint16(at+5);break;}
   at+=size;
  }
 }else if(mime==='image/webp'){
  need(0,20);if(ascii(0,4)!=='RIFF'||ascii(8,4)!=='WEBP'||v.getUint32(4,true)+8!==bytes.length)throw new Error('Choose a valid WebP photo.');
  const u24=at=>bytes[at]+bytes[at+1]*256+bytes[at+2]*65536;
  let canvas=null,frame=null;
  for(let at=12;at<bytes.length;){
   need(at,8);const type=ascii(at,4),size=v.getUint32(at+4,true),start=at+8;need(start,size);
   if(type==='VP8X'){
    if(canvas||size!==10)throw new Error('Invalid WebP header.');
    if(bytes[start]&2)throw new Error('Choose a still clothing photo, not an animation.');
    canvas={width:1+u24(start+4),height:1+u24(start+7)};
   }else if(type==='VP8 '){
    if(frame||size<10||bytes[start]&1||ascii(start+3,3)!=='\x9d\x01\x2a')throw new Error('Invalid WebP frame.');
    frame={width:v.getUint16(start+6,true)&16383,height:v.getUint16(start+8,true)&16383};
   }else if(type==='VP8L'){
    if(frame||size<5||bytes[start]!==47)throw new Error('Invalid WebP frame.');
    const bits=v.getUint32(start+1,true);if(bits>>>29)throw new Error('Unsupported WebP header.');
    frame={width:1+(bits&16383),height:1+((bits>>>14)&16383)};
   }else if(type==='ANIM'||type==='ANMF')throw new Error('Choose a still clothing photo, not an animation.');
   at=start+size+(size&1);if(at>bytes.length)throw new Error('Photo header is incomplete.');
  }
  if(!frame||(canvas&&(canvas.width!==frame.width||canvas.height!==frame.height)))throw new Error('Invalid WebP dimensions.');
  ({width,height}=frame);
 }else throw new Error('Choose a PNG, JPG, or WebP photo.');
 if(!width||!height)throw new Error('Photo dimensions could not be read.');
 if(width>8192||height>8192||width*height>PHOTO_SOURCE_MAX_PIXELS)throw new Error('Choose a photo up to 24 megapixels and 8192 pixels per side.');
 return {width,height,mime,extension:{'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[mime],byteLength:bytes.length};
}
export function photoSourceDataUrl(value){
 if(typeof value!=='string'||value.length>Math.ceil(PHOTO_SOURCE_MAX_BYTES/3)*4+64)throw new Error('Choose a photo under 20 MB.');
 const match=/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
 if(!match||match[2].length%4)throw new Error('Choose a valid PNG, JPG, or WebP photo.');
 const bytes=typeof Buffer!=='undefined'?Buffer.from(match[2],'base64'):Uint8Array.from(atob(match[2]),c=>c.charCodeAt(0));
 return {bytes,...photoSourceDimensions(bytes,match[1])};
}
function readPhotoBlob(blob,method,signal){
 if(blob.size>PHOTO_SOURCE_MAX_BYTES)return Promise.reject(new Error('Choose a photo under 20 MB.'));
 return new Promise((resolve,reject)=>{
  const reader=new FileReader(),finish=(error,value)=>{signal?.removeEventListener('abort',abort);error?reject(error):resolve(value);};
  const abort=()=>{reader.abort();finish(new Error('Photo reading was canceled.'));};
  if(signal?.aborted){abort();return;}
  signal?.addEventListener('abort',abort,{once:true});
  reader.onload=()=>finish(null,reader.result);reader.onerror=()=>finish(new Error('Photo could not be read.'));reader.onabort=()=>finish(new Error('Photo reading was canceled.'));
  reader[method](blob);
 });
}
export const photoBlobBytes=(blob,signal)=>readPhotoBlob(blob,'readAsArrayBuffer',signal);
export const photoBlobDataUrl=(blob,signal)=>readPhotoBlob(blob,'readAsDataURL',signal);
export function photoDecodedImage(url,signal){
 return new Promise((resolve,reject)=>{
  const image=new Image(),abort=()=>{image.src='';reject(new Error('Photo loading was canceled.'));};
  if(signal?.aborted){abort();return;}
  signal?.addEventListener('abort',abort,{once:true});image.src=url;
  image.decode().then(()=>{signal?.removeEventListener('abort',abort);resolve(image);},error=>{signal?.removeEventListener('abort',abort);reject(error);});
 });
}
