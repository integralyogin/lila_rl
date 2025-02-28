import gameState from '../core/gameState.js';
import eventBus from '../core/eventEmitter.js';

class FOVSystem {
    constructor() {
        this.radius = 8;
        
        // Schedule an initial update after a small delay
        setTimeout(() => this.update(), 100);
    }
    
    update() {
        if (!gameState.player || !gameState.map) return;
        
        // Clear visible tiles
        gameState.resetVisibility();
        
        // Reset map's visibility flags
        gameState.map.resetVisibility();
        
        const { x, y } = gameState.player.position;
        
        // Store player position in map for FOV checks
        gameState.map.playerX = x;
        gameState.map.playerY = y;
        
        // Add current position
        gameState.setTileVisible(x, y);
        
        // Mark the current tile as visible in the map
        if (gameState.map.isInBounds(x, y)) {
            gameState.map.tiles[y][x].visible = true;
        }
        
        // Cast rays in a full circle around the player
        for (let angle = 0; angle < 360; angle++) {
            this._castRay(x, y, angle, this.radius);
        }
        
        // Notify that FOV has been updated
        eventBus.emit('fovUpdated');
    }
    
    _castRay(startX, startY, angle, radius) {
        const radians = angle * (Math.PI / 180);
        const dx = Math.cos(radians);
        const dy = Math.sin(radians);
        
        let x = startX;
        let y = startY;
        
        for (let i = 0; i < radius; i++) {
            // Move along the ray
            x += dx;
            y += dy;
            
            // Round to nearest tile
            const tileX = Math.round(x);
            const tileY = Math.round(y);
            
            // Check if we're out of bounds
            if (!gameState.map.isInBounds(tileX, tileY)) {
                break;
            }
            
            // Add tile to visible set
            gameState.setTileVisible(tileX, tileY);
            
            // Mark this tile as visible in the map
            if (gameState.map.isInBounds(tileX, tileY)) {
                gameState.map.tiles[tileY][tileX].visible = true;
            }
            
            // Stop at walls
            if (!gameState.map.isTransparent(tileX, tileY)) {
                break;
            }
        }
    }
}

export default FOVSystem;