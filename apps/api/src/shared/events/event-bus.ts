import { EventEmitter } from 'events';

class MediCoreEventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50);
  }

  safeEmit(event: string, payload: unknown): void {
    try {
      this.emit(event, payload);
    } catch (err) {
      console.error(`EventBus error on event "${event}":`, err);
    }
  }
}

export const eventBus = new MediCoreEventBus();
