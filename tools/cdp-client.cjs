async function connect(url) {
  const socket = new WebSocket(url);const pending=new Map();const listeners=new Set();let next=0;
  await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true})});
  socket.addEventListener('message',event=>{const data=JSON.parse(event.data);if(data.method){for(const listener of listeners)listener(data);return}const request=pending.get(data.id);if(!request)return;pending.delete(data.id);clearTimeout(request.timer);data.error?request.reject(new Error(data.error.message)):request.resolve(data.result)});
  socket.addEventListener('close',()=>{for(const request of pending.values()){clearTimeout(request.timer);request.reject(new Error('Debug target closed'))}pending.clear()});
  const call=(method,params={},timeout=10000)=>new Promise((resolve,reject)=>{const id=++next;const timer=setTimeout(()=>{pending.delete(id);reject(new Error(method+' timed out'))},timeout);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}))});
  return {call,onEvent:listener=>{listeners.add(listener);return()=>listeners.delete(listener)},close:()=>socket.close(),evaluate:async(expression,timeout)=>{const response=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true},timeout);if(response.exceptionDetails)throw new Error(response.exceptionDetails.exception?.description||response.exceptionDetails.text);return response.result.value}};
}
module.exports={connect};
