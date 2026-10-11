class SearchRequests {
  constructor() { this.active=new Map(); }
  cancel(id) {
    const controller=this.active.get(id);if(!controller)return false;
    controller.abort(new Error('Search cancelled.'));this.active.delete(id);return true;
  }
  cancelAll() { for(const id of this.active.keys())this.cancel(id); }
  async run(id,task) {
    if(typeof id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(id))throw Error('Invalid search request ID.');
    if(this.active.has(id))throw Error('Search request is already running.');
    this.cancelAll();const controller=new AbortController();this.active.set(id,controller);
    try { const result=await task(controller.signal);controller.signal.throwIfAborted();return result; }
    catch(error) { throw controller.signal.aborted?controller.signal.reason:error; }
    finally { if(this.active.get(id)===controller)this.active.delete(id); }
  }
}
module.exports={SearchRequests};
