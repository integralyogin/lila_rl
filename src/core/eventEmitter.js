class EventEmitter {
    constructor() {
        this.events = new Map();
    }
    
    on(eventName, callback) {
        if (!this.events.has(eventName)) {
            this.events.set(eventName, []);
        }
        this.events.get(eventName).push(callback);
        
        // Return an "off" function for easy cleanup
        return () => this.off(eventName, callback);
    }
    
    off(eventName, callback) {
        if (!this.events.has(eventName)) return;
        
        const callbacks = this.events.get(eventName);
        const index = callbacks.indexOf(callback);
        if (index !== -1) {
            callbacks.splice(index, 1);
        }
    }
    
    emit(eventName, ...args) {
        if (!this.events.has(eventName)) return;
        
        this.events.get(eventName).forEach(callback => {
            callback(...args);
        });
    }
}

// Global event bus as a singleton
const eventBus = new EventEmitter();
export default eventBus;