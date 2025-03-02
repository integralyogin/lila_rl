import { TILE_TYPES } from '../constants.js';
import Map from './map.js';

class TownGenerator {
    constructor(width, height, townData) {
        this.width = width;
        this.height = height;
        this.townData = townData;
    }

    async generate() {
        // Create a new map
        const map = new Map(this.width, this.height);
        await map.initialize();
        
        // Fill the map with town floor tiles
        await map.fill(TILE_TYPES.TOWN_FLOOR);
        
        // Create building outlines
        if (this.townData && this.townData.buildings) {
            for (const building of this.townData.buildings) {
                this.createBuilding(map, building);
            }
        }
        
        // Calculate the center of the town for player start position
        const startX = Math.floor(this.width / 2);
        const startY = Math.floor(this.height / 2);
        
        // Place the dungeon entrance
        if (this.townData && this.townData.dungeonEntrance) {
            const entranceX = startX + (this.townData.dungeonEntrance.x_offset || 0);
            const entranceY = startY + (this.townData.dungeonEntrance.y_offset || 0);
            
            if (map.isInBounds(entranceX, entranceY)) {
                map.setTile(entranceX, entranceY, TILE_TYPES.DUNGEON_ENTRANCE);
                // Store sign message if available
                if (this.townData.dungeonEntrance.signMessage) {
                    map.tiles[entranceY][entranceX].signMessage = this.townData.dungeonEntrance.signMessage;
                }
            }
        }
        
        // Place orc camp entrance if available
        if (this.townData && this.townData.orcCampEntrance) {
            const entranceX = startX + (this.townData.orcCampEntrance.x_offset || 0);
            const entranceY = startY + (this.townData.orcCampEntrance.y_offset || 0);
            
            if (map.isInBounds(entranceX, entranceY)) {
                map.setTile(entranceX, entranceY, TILE_TYPES.AREA_EXIT);
                // Store exit info in the tile
                map.tiles[entranceY][entranceX].exitInfo = {
                    name: 'orc_camp',
                    signMessage: this.townData.orcCampEntrance.signMessage,
                    mapFile: this.townData.orcCampEntrance.mapFile
                };
            }
        }
        
        // Place area exits
        if (this.townData && this.townData.exits) {
            for (const exit of this.townData.exits) {
                const exitX = startX + (exit.x_offset || 0);
                const exitY = startY + (exit.y_offset || 0);
                
                if (map.isInBounds(exitX, exitY)) {
                    map.setTile(exitX, exitY, TILE_TYPES.AREA_EXIT);
                    // Store exit info in tile metadata
                    map.tiles[exitY][exitX].exitInfo = {
                        name: exit.name,
                        signMessage: exit.signMessage,
                        destination_x: exit.destination_x,
                        destination_y: exit.destination_y
                    };
                }
            }
        }
        
        // Place town exit (for returning from other areas)
        if (this.townData && this.townData.townExit) {
            const exitX = startX + (this.townData.townExit.x_offset || 0);
            const exitY = startY + (this.townData.townExit.y_offset || 0);
            
            if (map.isInBounds(exitX, exitY)) {
                map.setTile(exitX, exitY, TILE_TYPES.AREA_EXIT);
                // Store exit info in tile metadata
                map.tiles[exitY][exitX].exitInfo = {
                    name: 'town',
                    signMessage: this.townData.townExit.signMessage,
                    destination_x: this.townData.townExit.destination_x,
                    destination_y: this.townData.townExit.destination_y
                };
            }
        }
        
        return {
            map,
            startPosition: [startX, startY]
        };
    }
    
    createBuilding(map, building) {
        const { x, y, width, height, isOpen } = building;
        
        if (!map.isInBounds(x, y) || !map.isInBounds(x + width - 1, y + height - 1)) {
            return false;
        }
        
        // Create walls for the building outline or an open area
        for (let i = 0; i < width; i++) {
            for (let j = 0; j < height; j++) {
                // For arena and other open areas
                if (isOpen) {
                    // Only mark the corners for reference
                    if ((i === 0 && j === 0) || 
                        (i === width-1 && j === 0) || 
                        (i === 0 && j === height-1) || 
                        (i === width-1 && j === height-1)) {
                        map.setTile(x + i, y + j, TILE_TYPES.WALL);
                    } 
                    // Everything else is floor
                    else {
                        map.setTile(x + i, y + j, TILE_TYPES.FLOOR);
                    }
                }
                // Regular buildings with walls
                else {
                    // If it's on the perimeter, place a wall
                    if (i === 0 || i === width - 1 || j === 0 || j === height - 1) {
                        map.setTile(x + i, y + j, TILE_TYPES.WALL);
                    } 
                    // Otherwise, make it a floor inside the building
                    else {
                        map.setTile(x + i, y + j, TILE_TYPES.FLOOR);
                    }
                }
            }
        }
        
        // Add a door in the middle of one of the walls (only for normal buildings)
        if (!isOpen) {
            const doorPosition = Math.floor(width / 2);
            map.setTile(x + doorPosition, y + height - 1, TILE_TYPES.DOOR);
        }
        
        // Store the building in map's rooms array
        map.addRoom({
            x1: x,
            y1: y,
            x2: x + width - 1,
            y2: y + height - 1,
            width,
            height,
            type: building.type
        });
        
        return true;
    }
}

export default TownGenerator;