/**
 * TileManager - Manages tile definitions and creation
 * 
 * This class loads tile definitions from JSON and provides methods to create
 * and manage tiles based on those definitions.
 */
class TileManager {
    constructor() {
        this.tileDefinitions = new Map(); // Map of typeId -> tile definition
        this.tilesByName = new Map();     // Map of tile id -> tile definition
        this.initialized = false;
    }
    
    /**
     * Initialize the tile manager by loading tile definitions
     */
    async initialize() {
        if (this.initialized) return;
        
        try {
            const response = await fetch('/games/lila_rl/data/tiles/tiles.json');
            const data = await response.json();
            
            if (data && data.tiles) {
                this.loadTileDefinitions(data.tiles);
                this.initialized = true;
                console.log(`TileManager: Loaded ${this.tileDefinitions.size} tile definitions`);
            }
        } catch (error) {
            console.error('Error loading tile definitions:', error);
        }
    }
    
    /**
     * Load tile definitions from JSON data
     * @param {Array} tilesData - Array of tile definition objects
     */
    loadTileDefinitions(tilesData) {
        tilesData.forEach(tileData => {
            // Store by typeId for compatibility with existing code
            this.tileDefinitions.set(tileData.typeId, tileData);
            
            // Also store by name for lookup by id
            this.tilesByName.set(tileData.id, tileData);
        });
    }
    
    /**
     * Get a tile definition by typeId
     * @param {number} typeId - The type ID of the tile
     * @returns {Object} The tile definition or null if not found
     */
    getTileDefinition(typeId) {
        return this.tileDefinitions.get(typeId) || null;
    }
    
    /**
     * Get a tile definition by id (name)
     * @param {string} id - The id/name of the tile
     * @returns {Object} The tile definition or null if not found
     */
    getTileById(id) {
        return this.tilesByName.get(id) || null;
    }
    
    /**
     * Create a tile instance based on a definition
     * @param {number} typeId - The type ID of the tile definition to use
     * @returns {Object} A new tile instance
     */
    createTile(typeId) {
        const definition = this.getTileDefinition(typeId);
        if (!definition) {
            console.warn(`No tile definition found for typeId ${typeId}`);
            // Return a default "unknown" tile
            return {
                type: typeId,
                blocked: false,
                blocksSight: false,
                visible: false,
                explored: false
            };
        }
        
        // Create a new tile instance based on the definition
        const tile = {
            type: typeId,
            id: definition.id,
            blocked: definition.blocked,
            blocksSight: definition.blocksSight,
            visible: false,
            explored: false,
            name: definition.name,
            description: definition.description,
            char: definition.char,
            color: definition.color
        };
        
        // Add interactive property if applicable
        if (definition.interactive) {
            tile.interactive = true;
            if (definition.actionName) {
                tile.actionName = definition.actionName;
            }
        }
        
        // Add state support for doors
        if (definition.states && definition.states.length > 0) {
            tile.hasStates = true;
            tile.currentState = 'closed'; // Default state
            
            // For doors, add isOpen property
            if (definition.id === 'door') {
                tile.isOpen = false;
            }
        }
        
        // Add movement cost if specified
        if (definition.movementCost) {
            tile.movementCost = definition.movementCost;
        }
        
        return tile;
    }
    
    /**
     * Set a tile's state (e.g., door open/closed)
     * @param {Object} tile - The tile to modify
     * @param {string} stateId - The state ID to set
     * @returns {boolean} Whether the operation was successful
     */
    setTileState(tile, stateId) {
        if (!tile || !tile.hasStates) return false;
        
        const definition = this.getTileDefinition(tile.type);
        if (!definition || !definition.states) return false;
        
        const newState = definition.states.find(s => s.id === stateId);
        if (!newState) return false;
        
        // Update tile properties based on the new state
        tile.currentState = stateId;
        tile.blocked = newState.blocked;
        tile.blocksSight = newState.blocksSight;
        tile.char = newState.char;
        
        // For doors, update isOpen
        if (definition.id === 'door') {
            tile.isOpen = stateId === 'open';
        }
        
        return true;
    }
}

// Export a singleton instance
export default new TileManager();