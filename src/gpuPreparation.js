// One-off asset preparation. Poll a GPU fence with zero wait time so controls
// remain available while software shader work finishes; no animation clock.
export async function waitForPreparedGpu(gl, current=()=>true, timeoutMs=10000){
 const fence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);
 if(!fence)throw new Error('3D face preparation could not start.');
 const start=performance.now();
 try{
  gl.flush();
  while(current()){
   if(gl.isContextLost())throw new Error('Graphics context lost during face preparation.');
   const status=gl.clientWaitSync(fence,0,0);
   if(status===gl.ALREADY_SIGNALED||status===gl.CONDITION_SATISFIED)return true;
   if(status===gl.WAIT_FAILED)throw new Error('3D face preparation failed.');
   if(performance.now()-start>=timeoutMs)throw new Error('3D face preparation timed out.');
   await new Promise(resolve=>setTimeout(resolve,8));
  }
  return false;
 }finally{gl.deleteSync(fence);}
}
