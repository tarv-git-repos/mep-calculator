export type EventHandler = (...args: any[]) => void;

export class EventBus {
    private events: Map<string, EventHandler[]> = new Map();

    /**
     * Subscribe to an event.
     */
    on(event: string, handler: EventHandler): void {
        const handlers = this.events.get(event) || [];
        handlers.push(handler);
        this.events.set(event, handlers);
    }

    /**
     * Unsubscribe from an event.
     */
    off(event: string, handler: EventHandler): void {
        const handlers = this.events.get(event);
        if (handlers) {
            this.events.set(event, handlers.filter(h => h !== handler));
        }
    }

    /**
     * Emit an event.
     */
    emit(event: string, ...args: any[]): void {
        const handlers = this.events.get(event);
        if (handlers) {
            handlers.forEach(handler => {
                try {
                    handler(...args);
                } catch (error) {
                    console.error(`Error in event handler for ${event}:`, error);
                }
            });
        }
    }

    /**
     * Clear all event listeners.
     */
    clear(): void {
        this.events.clear();
    }
}

// Global instance
export const eventBus = new EventBus();
