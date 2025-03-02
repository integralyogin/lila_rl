// ui/tilePlacer.js
import gameState from '../core/gameState.js';
import eventBus from '../core/eventEmitter.js';
import tileManager from '../world/tileManager.js';

class TilePlacer {
    constructor() {
        this.active = false;
        this.selectedTileId = null;
        this.mouseTileX = -1;
        this.mouseTileY = -1;
        
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseClick = this.handleMouseClick.bind(this);
        
        // Listen for events
        eventBus.on('startTilePlacement', this.startPlacement.bind(this));
        eventBus.on('stopTilePlacement', this.stopPlacement.bind(this));
    }
    
    startPlacement(tileId) {
        if (!tileId) {
            console.error('No tile ID provided for placement');
            return;
        }
        
        this.selectedTileId = tileId;
        this.active = true;
        
        // Store previous game mode
        this.previousGameMode = gameState.gameMode;
        gameState.gameMode = 'tile_placement';
        
        // Add event listeners
        document.addEventListener('keydown', this.handleKeyDown);
        document.addEventListener('mousemove', this.handleMouseMove);
        document.addEventListener('click', this.handleMouseClick);
        
        // Show message to user
        const tileDef = tileManager.getTileById(tileId);
        gameState.addMessage(`Tile placement mode active: Click to place ${tileDef?.name || tileId}. Press ESC to cancel.`, "important");
        
        // Create highlight element for current position
        this.createHighlight();
        
        console.log(`Tile placement started for tile: ${tileId}`);
    }
    
    stopPlacement() {
        if (!this.active) return;
        
        this.active = false;
        this.selectedTileId = null;
        
        // Restore previous game mode
        gameState.gameMode = this.previousGameMode || 'exploration';
        
        // Remove event listeners
        document.removeEventListener('keydown', this.handleKeyDown);
        document.removeEventListener('mousemove', this.handleMouseMove);
        document.removeEventListener('click', this.handleMouseClick);
        
        // Remove highlight
        this.removeHighlight();
        
        // Show message to user
        gameState.addMessage("Tile placement mode ended.", "info");
        
        console.log('Tile placement stopped');
    }
    
    handleKeyDown(event) {
        if (event.key === 'Escape') {
            this.stopPlacement();
        }
    }
    
    handleMouseMove(event) {
        if (!this.active || !gameState.map) return;
        
        const gameContainer = document.getElementById('game-container');
        const rect = gameContainer.getBoundingClientRect();
        
        // Calculate mouse position relative to game container
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        // Convert to tile coordinates - adjust these calculations based on your rendering logic
        const tileSize = 20; // Standard tile size in pixels
        const tileX = Math.floor(x / tileSize);
        const tileY = Math.floor(y / tileSize);
        
        // Update current position
        if (tileX !== this.mouseTileX || tileY !== this.mouseTileY) {
            this.mouseTileX = tileX;
            this.mouseTileY = tileY;
            this.updateHighlight();
        }
    }
    
    handleMouseClick(event) {
        if (!this.active || !gameState.map) return;
        
        // Only process left clicks
        if (event.button !== 0) return;
        
        // Prevent click from propagating to other handlers
        event.stopPropagation();
        event.preventDefault();
        
        // Get the current tile definition
        const tileDef = tileManager.getTileById(this.selectedTileId);
        if (!tileDef) {
            console.error(`Tile definition not found for ID: ${this.selectedTileId}`);
            return;
        }
        
        // Get the tile type ID
        const tileTypeId = tileDef.typeId;
        if (tileTypeId === undefined) {
            console.error(`Tile type ID not found for tile: ${this.selectedTileId}`);
            return;
        }
        
        // Attempt to place the tile on the map
        const success = this.placeTile(this.mouseTileX, this.mouseTileY, tileTypeId);
        
        if (success) {
            gameState.addMessage(`Placed tile: ${tileDef.name} at (${this.mouseTileX}, ${this.mouseTileY})`, "info");
            
            // Update FOV to reveal the new tile
            gameState.getSystem('FOVSystem')?.update();
            eventBus.emit('fovUpdated');
        }
    }
    
    placeTile(x, y, tileTypeId) {
        if (!gameState.map) {
            console.error('No map available');
            return false;
        }
        
        // Check if coordinates are within map bounds
        if (x < 0 || y < 0 || x >= gameState.map.width || y >= gameState.map.height) {
            console.error(`Coordinates out of bounds: (${x}, ${y})`);
            return false;
        }
        
        try {
            // Place the tile on the map
            gameState.map.setTile(x, y, tileTypeId);
            
            // Mark the tile as explored so it's visible
            if (gameState.map.tiles[y] && gameState.map.tiles[y][x]) {
                gameState.map.tiles[y][x].explored = true;
            }
            
            console.log(`Placed tile type ${tileTypeId} at (${x}, ${y})`);
            return true;
        } catch (error) {
            console.error(`Error placing tile: ${error.message}`);
            return false;
        }
    }
    
    createHighlight() {
        // Check if highlight already exists
        if (document.getElementById('tile-placement-highlight')) {
            return;
        }
        
        // Create a highlight element to show where the tile will be placed
        const highlight = document.createElement('div');
        highlight.id = 'tile-placement-highlight';
        highlight.style.position = 'absolute';
        highlight.style.width = '20px';
        highlight.style.height = '20px';
        highlight.style.border = '2px solid #ff9900';
        highlight.style.backgroundColor = 'rgba(255, 153, 0, 0.3)';
        highlight.style.pointerEvents = 'none';
        highlight.style.zIndex = '100';
        highlight.style.display = 'none';
        
        const gameContainer = document.getElementById('game-container');
        gameContainer.appendChild(highlight);
    }
    
    updateHighlight() {
        const highlight = document.getElementById('tile-placement-highlight');
        if (!highlight) return;
        
        if (this.mouseTileX < 0 || this.mouseTileY < 0) {
            highlight.style.display = 'none';
            return;
        }
        
        // Position the highlight at the current mouse tile position
        const tileSize = 20; // Standard tile size in pixels
        highlight.style.left = `${this.mouseTileX * tileSize}px`;
        highlight.style.top = `${this.mouseTileY * tileSize}px`;
        highlight.style.display = 'block';
        
        // Change highlight color based on whether we can place here
        if (this.canPlaceTile(this.mouseTileX, this.mouseTileY)) {
            highlight.style.border = '2px solid #00ff00';
            highlight.style.backgroundColor = 'rgba(0, 255, 0, 0.3)';
        } else {
            highlight.style.border = '2px solid #ff0000';
            highlight.style.backgroundColor = 'rgba(255, 0, 0, 0.3)';
        }
    }
    
    removeHighlight() {
        const highlight = document.getElementById('tile-placement-highlight');
        if (highlight && highlight.parentNode) {
            highlight.parentNode.removeChild(highlight);
        }
    }
    
    canPlaceTile(x, y) {
        // For simplicity, we'll allow placing tiles anywhere for now
        // This could be expanded with more complex logic in the future
        return true;
    }
}

// Export singleton instance
export default new TilePlacer();
