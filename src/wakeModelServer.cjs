const http=require('http'),fs=require('fs/promises'),path=require('path');
async function createWakeModelServer(){
  let model;
  const server=http.createServer(async(req,res)=>{
    const host=`127.0.0.1:${server.address().port}`;
    if(req.method!=='GET'||req.headers.host!==host||req.url!=='/vosk-small-en-us-0.15.tar.gz'){res.writeHead(404);res.end();return}
    try{model ||= fs.readFile(path.join(__dirname,'assets/models/vosk-small-en-us-0.15.tar.gz'));const bytes=await model;res.writeHead(200,{'Content-Type':'application/gzip','Content-Length':bytes.length,'Access-Control-Allow-Origin':'null','X-Content-Type-Options':'nosniff','Cache-Control':'public, max-age=31536000'});res.end(bytes)}catch{res.writeHead(500);res.end()}
  });
  const listen=port=>new Promise((resolve,reject)=>{const failed=e=>{server.removeListener('listening',ready);reject(e)};const ready=()=>{server.removeListener('error',failed);resolve()};server.once('error',failed);server.once('listening',ready);server.listen(port,'127.0.0.1')});
  // A stable local URL allows Vosk's model cache to persist across normal launches.
  // Concurrent test/profile instances can use an ephemeral fallback port.
  try{await listen(39137)}catch(e){if(e.code!=='EADDRINUSE')throw e;await listen(0)}
  return {url:`http://127.0.0.1:${server.address().port}/vosk-small-en-us-0.15.tar.gz`,close:()=>server.close()};
}
module.exports={createWakeModelServer};
