import Map from './map.js';
import { TILE_TYPES } from '../constants.js';

// Room class for dungeon generation
class Room {
    constructor(x, y, width, height) {
        this.x1 = x;
        this.y1 = y;
        this.x2 = x + width - 1;
        this.y2 = y + height - 1;
        this.width = width;
        this.height = height;
    }
    
    center() {
        const centerX = Math.floor((this.x1 + this.x2) / 2);
        const centerY = Math.floor((this.y1 + this.y2) / 2);
        return [centerX, centerY];
    }
    
    intersects(other) {
        return (
            this.x1 <= other.x2 + 1 &&
            this.x2 >= other.x1 - 1 &&
            this.y1 <= other.y2 + 1 &&
            this.y2 >= other.y1 - 1
        );
    }
}

class DungeonGenerator {
    constructor(width, height, options = {}) {
        this.width = width;
        this.height = height;
        this.options = {
            roomMinSize: options.roomMinSize || 4,
            roomMaxSize: options.roomMaxSize || 10,
            maxRooms: options.maxRooms || 15,
            ...options
        };
        
        // Debug mode for testing
        this.debug = false;
        console.log(`Dungeon generator initialized: ${width}x${height}`);
    }
    
    async generate() {
        // Create empty map filled with walls
        const map = new Map(this.width, this.height);
        await map.initialize();
        
        const rooms = [];
        
        // Try to place each room
        for (let i = 0; i < this.options.maxRooms; i++) {
            // Generate random room size and position
            const roomWidth = this._randomRange(this.options.roomMinSize, this.options.roomMaxSize);
            const roomHeight = this._randomRange(this.options.roomMinSize, this.options.roomMaxSize);
            const x = this._randomRange(1, this.width - roomWidth - 1);
            const y = this._randomRange(1, this.height - roomHeight - 1);
            
            const newRoom = new Room(x, y, roomWidth, roomHeight);
            
            // Check for room overlap
            let hasOverlap = false;
            for (const room of rooms) {
                if (newRoom.intersects(room)) {
                    hasOverlap = true;
                    break;
                }
            }
            
            if (!hasOverlap) {
                // Carve out room
                this._carveRoom(map, newRoom);
                
                // Connect to previous room
                if (rooms.length > 0) {
                    const [prevX, prevY] = rooms[rooms.length - 1].center();
                    const [newX, newY] = newRoom.center();
                    
                    // Randomly decide which corridor to carve first
                    if (Math.random() < 0.5) {
                        this._carveHCorridor(map, prevX, newX, prevY);
                        this._carveVCorridor(map, prevY, newY, newX);
                    } else {
                        this._carveVCorridor(map, prevY, newY, prevX);
                        this._carveHCorridor(map, prevX, newX, newY);
                    }
                }
                
                // Add this room to the list
                rooms.push(newRoom);
                map.addRoom(newRoom);
            }
        }
        
        if (rooms.length === 0) {
            // Emergency fallback if no rooms were created
            const room = new Room(
                Math.floor(this.width / 4),
                Math.floor(this.height / 4),
                Math.floor(this.width / 2),
                Math.floor(this.height / 2)
            );
            this._carveRoom(map, room);
            rooms.push(room);
            map.addRoom(room);
        }
        
        // Place stairs in the last room
        const lastRoom = rooms[rooms.length - 1];
        const [stairsX, stairsY] = lastRoom.center();
        map.setTile(stairsX, stairsY, TILE_TYPES.STAIRS_DOWN);
        
        return {
            map,
            startPosition: rooms[0].center(),
            endPosition: lastRoom.center()
        };
    }
    
    _carveRoom(map, room) {
        for (let y = room.y1; y <= room.y2; y++) {
            for (let x = room.x1; x <= room.x2; x++) {
                map.setTile(x, y, TILE_TYPES.FLOOR);
            }
        }
    }
    
    _carveHCorridor(map, x1, x2, y) {
        const start = Math.min(x1, x2);
        const end = Math.max(x1, x2);
        
        for (let x = start; x <= end; x++) {
            map.setTile(x, y, TILE_TYPES.FLOOR);
        }
    }
    
    _carveVCorridor(map, y1, y2, x) {
        const start = Math.min(y1, y2);
        const end = Math.max(y1, y2);
        
        for (let y = start; y <= end; y++) {
            map.setTile(x, y, TILE_TYPES.FLOOR);
        }
    }
    
    // Random number generator for inclusive range
    _randomRange(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
}

export default DungeonGenerator;