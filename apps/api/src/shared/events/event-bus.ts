import { EventEmitter } from 'events';
import { logger } from '@/infrastructure/logger/logger';

class EventBus extends EventEmitter {
  emit(event: string, payload?: unknown): boolean {
    logger.debug('Event fired', { event, payload });
    return super.emit(event, payload);
  }
}

// One singleton for the whole application
export const eventBus = new EventBus();
eventBus.setMaxListeners(100);   // many modules will subscribe