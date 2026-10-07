// A request owns its abort signal. Cancelling an old request cannot cancel its
// replacement, and a late provider response cannot revive a cancelled job.
class TryOnRequests {
  constructor({ timeoutMs = 120000 } = {}) { this.timeoutMs = timeoutMs; this.active = new Map(); }
  run(id, task) {
    if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(id)) return Promise.reject(new Error('A valid try-on request ID is required.'));
    if (this.active.has(id)) return Promise.reject(new Error('This try-on request is already running.'));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(new Error('Try-on provider timed out after 120 seconds.')), this.timeoutMs);
    this.active.set(id, controller);
    return (async () => {
      try {
        controller.signal.throwIfAborted();
        const result = await task(controller.signal);
        controller.signal.throwIfAborted();
        return result;
      } catch (error) { throw controller.signal.aborted ? controller.signal.reason : error; }
      finally { clearTimeout(timeout); if (this.active.get(id) === controller) this.active.delete(id); }
    })();
  }
  cancel(id) {
    const controller = this.active.get(id);
    if (!controller) return false;
    controller.abort(new Error('Try-on render cancelled.'));
    this.active.delete(id);
    return true;
  }
  cancelAll() { for (const id of this.active.keys()) this.cancel(id); }
}
module.exports = { TryOnRequests };
