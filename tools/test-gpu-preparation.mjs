import assert from 'node:assert/strict';
import {waitForPreparedGpu} from '../src/gpuPreparation.js';
function gpu(statuses){return{SYNC_GPU_COMMANDS_COMPLETE:1,ALREADY_SIGNALED:2,CONDITION_SATISFIED:3,WAIT_FAILED:4,deleted:0,flushed:0,reads:0,fenceSync(){return{}},flush(){this.flushed++},isContextLost(){return false},clientWaitSync(_fence,flags,timeout){assert.equal(flags,0);assert.equal(timeout,0);this.reads++;return statuses.shift()??5},deleteSync(){this.deleted++}}}
let gl=gpu([5,2]);assert(await waitForPreparedGpu(gl));assert.equal(gl.reads,2);assert.equal(gl.flushed,1);assert.equal(gl.deleted,1);
gl=gpu([3]);assert(await waitForPreparedGpu(gl));assert.equal(gl.deleted,1);
gl=gpu([5]);assert.equal(await waitForPreparedGpu(gl,()=>false),false);assert.equal(gl.reads,0);assert.equal(gl.deleted,1);
gl=gpu([5]);let current=true;gl.clientWaitSync=()=>{current=false;return 5};assert.equal(await waitForPreparedGpu(gl,()=>current),false);assert.equal(gl.deleted,1);
gl=gpu([4]);await assert.rejects(waitForPreparedGpu(gl),/failed/);assert.equal(gl.deleted,1);
gl=gpu([5]);gl.isContextLost=()=>true;await assert.rejects(waitForPreparedGpu(gl),/context lost/);assert.equal(gl.deleted,1);
gl=gpu([5]);await assert.rejects(waitForPreparedGpu(gl,()=>true,0),/timed out/);assert.equal(gl.deleted,1);
gl=gpu([5]);gl.fenceSync=()=>null;await assert.rejects(waitForPreparedGpu(gl),/could not start/);assert.equal(gl.deleted,0);
console.log('GPU preparation: nonblocking polling, completion, cancellation, loss/failure/timeout and fence disposal passed');
