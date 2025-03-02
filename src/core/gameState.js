import eventBus from './eventEmitter.js';

class GameState {
    constructor() {
        this.entities = new Map();
        this.player = null;
        this.map = null;
        this.currentLevel = 1;
        this.gameMode = 'exploration'; // exploration, inventory, targeting, creator, etc.
        this.turn = 0;
        this.messages = [];
        this.visibleTiles = new Set();
        this.exploredTiles = new Set();
        this.score = 0;
        this.location = 'town'; // 'town' or 'dungeon'
        this.systems = new Map(); // Store references to game systems
        this.currentTargetingHighlight = null; // For tracking mouseover highlighting
        this.creatorMode = false; // Flag to track if creator mode is active
    }
    
    // Register a system with the game state
    registerSystem(name, system) {
        this.systems.set(name, system);
    }
    
    // Get a system by name
    getSystem(name) {
        return this.systems.get(name);
    }
    
    addEntity(entity) {
        this.entities.set(entity.id, entity);
        eventBus.emit('entityAdded', entity);
        return entity;
    }
    
    removeEntity(entityId) {
        const entity = this.entities.get(entityId);
        if (entity) {
            this.entities.delete(entityId);
            eventBus.emit('entityRemoved', entity);
        }
        return entity;
    }
    
    getEntitiesAt(x, y) {
        const result = [];
        this.entities.forEach(entity => {
            if (entity.position && entity.position.x === x && entity.position.y === y) {
                result.push(entity);
            }
        });
        return result;
    }
    
    getEntitiesWithComponents(...componentTypes) {
        const result = [];
        
        this.entities.forEach(entity => {
            if (componentTypes.every(type => entity.hasComponent(type))) {
                result.push(entity);
            }
        });
        
        // Debug output to help find issues
        console.log(`Found ${result.length} entities with components: ${componentTypes.join(', ')}`);
        result.forEach(entity => {
            console.log(`Entity: ${entity.name}, id: ${entity.id}`);
        });
        
        return result;
    }
    
    addMessage(text, type = 'info') {
        this.messages.unshift({ text, type, turn: this.turn });
        
        // Keep message log to a reasonable size
        if (this.messages.length > 100) {
            this.messages.pop();
        }
        
        eventBus.emit('messageAdded', { text, type });
    }
    
    setTileVisible(x, y) {
        const key = `${x},${y}`;
        this.visibleTiles.add(key);
        this.exploredTiles.add(key);
    }
    
    isTileVisible(x, y) {
        return this.visibleTiles.has(`${x},${y}`);
    }
    
    isTileExplored(x, y) {
        return this.exploredTiles.has(`${x},${y}`);
    }
    
    resetVisibility() {
        this.visibleTiles.clear();
    }
}

// Create singleton instance
const gameState = new GameState();
export default gameState;