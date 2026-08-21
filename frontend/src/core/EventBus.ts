type EventHandler = (payload: any) => void;

class EventBus {
  private listeners: Record<string, EventHandler[]> = {};
  public eventLog: { timestamp: string, event: string, payload: any }[] = [];

  on(event: string, callback: EventHandler) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  off(event: string, callback: EventHandler) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
  }

  publish(event: string, payload: any) {
    console.log(`[EventBus] Publishing: ${event}`, payload);
    this.eventLog.push({
      timestamp: new Date().toISOString(),
      event,
      payload
    });

    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => {
        // Run callbacks asynchronously to simulate network boundary
        setTimeout(() => cb(payload), 0);
      });
    }
  }
}

export const globalEventBus = new EventBus();
