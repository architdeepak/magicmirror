const fs=require('fs/promises'),path=require('path'),{randomUUID}=require('crypto');
const PHOTO=/^photo[0-9](?:-[a-f0-9-]{36})?\.jpg$/;
class IdleGallery {
  constructor(directory,nativeImage,{fileSystem=fs}={}){Object.assign(this,{directory,nativeImage,fs:fileSystem});this.busy=false;this.pending=Promise.resolve();}
  serialize(task){const result=this.pending.then(task);this.pending=result.catch(()=>{});return result;}
  list(){return this.serialize(()=>this.readList());}
  async readList(){
    try{const names=JSON.parse(await this.fs.readFile(path.join(this.directory,'gallery.json'),'utf8'));const images=[];
      if(!Array.isArray(names))throw Error('The saved photo gallery could not be read.');
      for(const name of names.slice(0,10)){if(typeof name!=='string'||!PHOTO.test(name))continue;try{const bytes=await this.fs.readFile(path.join(this.directory,name));if(bytes.length<=5_000_000)images.push('data:image/jpeg;base64,'+bytes.toString('base64'));}catch(error){if(error.code!=='ENOENT')throw error;}}return {images};
    }catch(error){if(error.code==='ENOENT')return {images:[]};throw error;}
  }
  async import(files){
    if(this.busy)throw Error('Photos are already being imported.');
    if(!Array.isArray(files)||!files.length)throw Error('Choose at least one photo.');
    this.busy=true;
    try{return await this.serialize(()=>this.writeImport(files));}finally{this.busy=false;}
  }
  async writeImport(files){
    const names=[];const prepared=[];
      for(const file of files.slice(0,10)){if((await this.fs.stat(file)).size>30_000_000)throw Error('Choose photos smaller than 30 MB.');
        const image=this.nativeImage.createFromPath(file);if(image.isEmpty())throw Error('This photo could not be read. Choose JPG or PNG.');
        const size=image.getSize();const scale=Math.min(1,1920/Math.max(size.width,size.height));const result=image.resize({width:Math.max(1,Math.round(size.width*scale)),height:Math.max(1,Math.round(size.height*scale)),quality:'best'}).toJPEG(88);if(!result.length||result.length>5_000_000)throw Error('Choose a smaller photo.');prepared.push(result);}
      await this.fs.mkdir(this.directory,{recursive:true});
      const revision=randomUUID(),staged=[],manifest=path.join(this.directory,`gallery-${revision}.tmp`);
      try{
        for(const [i,bytes]of prepared.entries()){const name=`photo${i}-${revision}.jpg`,file=path.join(this.directory,name);names.push(name);staged.push(file);await this.fs.writeFile(file,bytes);}
        staged.push(manifest);await this.fs.writeFile(manifest,JSON.stringify(names));await this.fs.rename(manifest,path.join(this.directory,'gallery.json'));
      }catch(error){await Promise.allSettled(staged.map(file=>this.fs.unlink(file)));throw error;}
      // Readers share the queue; obsolete files cannot disappear mid-read.
      // Cleanup errors must not report a committed import as failed.
      try{const obsolete=(await this.fs.readdir(this.directory)).filter(name=>PHOTO.test(name)&&!names.includes(name));await Promise.allSettled(obsolete.map(name=>this.fs.unlink(path.join(this.directory,name))));}catch{}
      return {images:prepared.map(bytes=>'data:image/jpeg;base64,'+bytes.toString('base64'))};
  }
}
module.exports={IdleGallery};
