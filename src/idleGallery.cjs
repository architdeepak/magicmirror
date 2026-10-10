const fs=require('fs/promises'),path=require('path');
class IdleGallery {
  constructor(directory,nativeImage){Object.assign(this,{directory,nativeImage});this.busy=false;}
  async list(){
    try{const names=JSON.parse(await fs.readFile(path.join(this.directory,'gallery.json'),'utf8'));const images=[];
      for(const name of names.slice(0,10)){if(!/^photo[0-9]\.jpg$/.test(name))continue;const bytes=await fs.readFile(path.join(this.directory,name));if(bytes.length<=5_000_000)images.push('data:image/jpeg;base64,'+bytes.toString('base64'));}return {images};
    }catch(error){if(error.code==='ENOENT')return {images:[]};throw error;}
  }
  async import(files){
    if(this.busy)throw Error('Photos are already being imported.');this.busy=true;
    try{const names=[];const prepared=[];
      for(const file of files.slice(0,10)){if((await fs.stat(file)).size>30_000_000)throw Error('Choose photos smaller than 30 MB.');
        const image=this.nativeImage.createFromPath(file);if(image.isEmpty())throw Error('This photo could not be read. Choose JPG or PNG.');
        const size=image.getSize();const scale=Math.min(1,1920/Math.max(size.width,size.height));const result=image.resize({width:Math.max(1,Math.round(size.width*scale)),height:Math.max(1,Math.round(size.height*scale)),quality:'best'}).toJPEG(88);prepared.push(result);}
      await fs.mkdir(this.directory,{recursive:true});for(const [i,bytes] of prepared.entries()){const name='photo'+i+'.jpg';await fs.writeFile(path.join(this.directory,name),bytes);names.push(name);}
      await fs.writeFile(path.join(this.directory,'gallery.json'),JSON.stringify(names));return this.list();
    }finally{this.busy=false;}
  }
}
module.exports={IdleGallery};
