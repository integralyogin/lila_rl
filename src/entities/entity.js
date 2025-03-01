// Unique ID generator
let nextEntityId = 1;

class Entity {
    constructor(name = 'Unknown') {
        this.id = nextEntityId++;
        this.name = name;
        this.components = new Map();
    }
    
    addComponent(component) {
        component.entity = this;
        this.components.set(component.constructor.name, component);
        
        // Call onAdd method if it exists
        if (typeof component.onAdd === 'function') {
            component.onAdd(this);
        }
        
        return this;
    }
    
    getComponent(componentClass) {
        // Support passing either the class itself or its name as a string
        const className = typeof componentClass === 'string' 
            ? componentClass 
            : componentClass.name;
            
        return this.components.get(className);
    }
    
    hasComponent(componentClass) {
        const className = typeof componentClass === 'string' 
            ? componentClass 
            : componentClass.name;
            
        return this.components.has(className);
    }
    
    removeComponent(componentClass) {
        const className = typeof componentClass === 'string' 
            ? componentClass 
            : componentClass.name;
            
        const component = this.components.get(className);
        if (component) {
            this.components.delete(className);
            component.entity = null;
        }
        return this;
    }
    
    // Shorthand property getters for common components
    get position() {
        return this.getComponent('PositionComponent');
    }
    
    get renderable() {
        return this.getComponent('RenderableComponent');
    }
    
    get health() {
        return this.getComponent('HealthComponent');
    }
    
    get inventory() {
        return this.getComponent('InventoryComponent');
    }
    
    get limbs() {
        return this.getComponent('LimbComponent');
    }
}

export default Entity;