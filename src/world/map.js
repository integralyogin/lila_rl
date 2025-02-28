import { TILE_TYPES } from '../constants.js';

class Map {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.tiles = [];
        this.rooms = [];
        this.initialized = false;
    }
    
    initialize() {
        // Create empty map filled with walls
        for (let y = 0; y < this.height; y++) {
            const row = [];
            for (let x = 0; x < this.width; x++) {
                row.push({
                    type: TILE_TYPES.WALL,
                    blocked: true,
                    blocksSight: true,
                    visible: false,
                    explored: false
                });
            }
            this.tiles.push(row);
        }
        this.initialized = true;
        
        // Track player position for FOV checks
        this.playerX = 0;
        this.playerY = 0;
    }
    
    resetVisibility() {
        // Reset all tiles to not visible
        if (!this.initialized) return;
        
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                if (this.tiles[y][x]) {
                    this.tiles[y][x].visible = false;
                }
            }
        }
    }
    
    fill(tileType) {
        if (!this.initialized) {
            this.initialize();
        }
        
        const isWall = tileType === TILE_TYPES.WALL;
        
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                this.tiles[y][x] = {
                    type: tileType,
                    blocked: isWall,
                    blocksSight: isWall
                };
            }
        }
    }
    
    isInBounds(x, y) {
        return x >= 0 && x < this.width && y >= 0 && y < this.height;
    }
    
    getTile(x, y) {
        if (!this.isInBounds(x, y)) {
            return null;
        }
        return this.tiles[y][x];
    }
    
    setTile(x, y, tileType) {
        if (!this.isInBounds(x, y)) {
            return false;
        }
        
        const isWall = tileType === TILE_TYPES.WALL;
        const isDoor = tileType === TILE_TYPES.DOOR;
        const isBlocked = isWall; // Doors are not blocked so player can walk through them
        const blocksSight = isWall; // Only walls block sight
        
        this.tiles[y][x] = {
            type: tileType,
            blocked: isBlocked,
            blocksSight: blocksSight
        };
        
        return true;
    }
    
    isWalkable(x, y) {
        if (!this.isInBounds(x, y)) {
            return false;
        }
        
        return !this.tiles[y][x].blocked;
    }
    
    isTransparent(x, y) {
        if (!this.isInBounds(x, y)) {
            return false;
        }
        
        return !this.tiles[y][x].blocksSight;
    }
    
    isInPlayerFOV(x, y) {
        if (!this.isInBounds(x, y)) {
            return false;
        }
        
        // Player's position is always visible
        if (x === this.playerX && y === this.playerY) {
            return true;
        }
        
        // Check if the tile is visible
        return this.tiles[y][x].visible === true;
    }
    
    addRoom(room) {
        this.rooms.push(room);
    }
    
    // For debugging - output ASCII map
    debugPrint() {
        let output = '';
        for (let y = 0; y < this.height; y++) {
            let row = '';
            for (let x = 0; x < this.width; x++) {
                const tile = this.tiles[y][x];
                switch (tile.type) {
                    case TILE_TYPES.WALL:
                        row += '#';
                        break;
                    case TILE_TYPES.FLOOR:
                        row += '.';
                        break;
                    case TILE_TYPES.STAIRS_DOWN:
                        row += '>';
                        break;
                    case TILE_TYPES.DOOR:
                        row += '+';
                        break;
                    case TILE_TYPES.TOWN_FLOOR:
                        row += ',';
                        break;
                    case TILE_TYPES.BUILDING:
                        row += 'B';
                        break;
                    case TILE_TYPES.DUNGEON_ENTRANCE:
                        row += '>';
                        break;
                    default:
                        row += '?';
                }
            }
            output += row + '\n';
        }
        return output;
    }
}

export default Map;