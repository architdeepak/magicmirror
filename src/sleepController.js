// Sleep keeps only the local wake detector armed. Renderer callbacks must use
// `sleeping` to ignore navigation, tracking and late assistant events.
export class SleepController {
  constructor({ wakeListener, onSleep = () => {}, onWake = () => {}, onError = () => {} }) {
    this.wakeListener = wakeListener;
    this.onSleep = onSleep;
    this.onWake = onWake;
    this.onError = onError;
    this.sleeping = false;
    this.generation = 0;
  }

  async enter() {
    const generation = ++this.generation;
    this.sleeping = true;
    try {
      // Stop audio/mic and black out the display before awaiting anything.
      const stopped = this.onSleep();
      await this.wakeListener.pause();
      await stopped;
      if (!this.sleeping || generation !== this.generation) return false;
      this.wakeListener.setCommandsOnly?.(false);
      await this.wakeListener.start();
      return this.sleeping && generation === this.generation;
    } catch (error) {
      if (generation === this.generation) this.onError(error);
      return false;
    }
  }

  async wakeFromPhrase() {
    if (!this.sleeping) return false;
    const generation = ++this.generation;
    this.sleeping = false;
    try {
      await this.onWake();
      return !this.sleeping && generation === this.generation;
    } catch (error) {
      if (generation === this.generation) this.onError(error);
      return false;
    }
  }

  cancelPendingWake() {
    // STOP can mute even a pending sleep transition without waking the display.
    this.generation += 1;
  }
}
