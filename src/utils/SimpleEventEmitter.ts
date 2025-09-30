export default class SimpleEventEmitter<Events extends Record<string, any>> {
  private listeners = new Map<keyof Events, Set<Function>>();

  on<K extends keyof Events>(event: K, fn: (payload: Events[K]) => void) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(fn as any);
    return () => this.off(event, fn);
  }

  off<K extends keyof Events>(event: K, fn: (payload: Events[K]) => void) {
    this.listeners.get(event)?.delete(fn as any);
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]) {
    const fns = this.listeners.get(event);
    if (!fns) return;
    fns.forEach(fn => {
      try { (fn as any)(payload); } catch { /* ignore */ }
    });
  }
}
