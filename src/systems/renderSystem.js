import { COLORS, TILE_TYPES } from '../constants.js';
import gameState from '../core/gameState.js';
import eventBus from '../core/eventEmitter.js';
import { targetingSystem } from './targetingSystem.js';

class RenderSystem {
    constructor() {
        this.mapElement = null;
        this.messageElement = null;
        
        // Initialize immediately if the DOM is already loaded
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
            this.initialize();
        } else {
            // Otherwise wait for the DOM to be ready
            document.addEventListener('DOMContentLoaded', () => {
                this.initialize();
            });
        }
        
        // Subscribe to events
        eventBus.on('fovUpdated', () => this.render());
        eventBus.on('messageAdded', () => this.renderMessages());
        eventBus.on('targetingStarted', () => this.render());
        eventBus.on('targetingCancelled', () => this.render());
        eventBus.on('targetMoved', () => this.render());
        eventBus.on('render', () => this.render());
        
        // Force an initial render after a short delay
        setTimeout(() => {
            console.log("Initial render triggered");
            this.render();
            this.renderMessages();
        }, 500);
    }
    
    initialize() {
        this.mapElement = document.getElementById('game-map');
        this.messageElement = document.getElementById('message-log');
        this.miniMapElement = document.getElementById('mini-map');
        
        if (!this.mapElement) {
            console.error('Game map element not found');
        }
        
        if (!this.messageElement) {
            console.error('Message log element not found');
        }
        
        if (!this.miniMapElement) {
            console.error('Mini-map element not found');
        }
    }
    
    render() {
        if (!this.mapElement) {
            console.error("Map element not found!");
            return;
        }
        
        if (!gameState.map) {
            console.error("No map in gameState!");
            this._renderEmptyMap();
            return;
        }
        
        // Check if player exists
        if (!gameState.player) {
            console.error("Player not found in gameState!");
        } else if (!gameState.entities.has(gameState.player.id)) {
            console.warn("Player exists but is not in entities collection! Re-adding player...");
            gameState.addEntity(gameState.player);
        }
        
        console.log("Rendering map...");
        
        // Clear the map display
        this.mapElement.innerHTML = '';
        
        const map = gameState.map;
        
        // Calculate viewport bounds (centered on player if possible)
        let startX = 0;
        let startY = 0;
        
        if (gameState.player && gameState.player.position) {
            const playerX = gameState.player.position.x;
            const playerY = gameState.player.position.y;
            
            // Center the view on the player
            const halfViewWidth = 20;
            const halfViewHeight = 10;
            
            // Always center on player - allow scrolling to all map areas
            startX = Math.max(0, playerX - halfViewWidth);
            startY = Math.max(0, playerY - halfViewHeight);
        }
        
        const viewWidth = 40;
        const viewHeight = 25;
        
        // Debug info
        console.log(`Rendering map view: (${startX},${startY}) to (${startX+viewWidth},${startY+viewHeight})`);
        
        // Create rows and cells for the map
        for (let y = startY; y < startY + viewHeight && y < map.height; y++) {
            const rowElement = document.createElement('div');
            rowElement.className = 'map-row';
            
            for (let x = startX; x < startX + viewWidth && x < map.width; x++) {
                const tile = map.getTile(x, y);
                if (!tile) {
                    console.error(`No tile at position (${x},${y})`);
                    continue;
                }
                
                const cellElement = document.createElement('div');
                cellElement.className = 'map-cell';
                
                // Check if we should show the actual map or FOV
                const debugMode = false; // Set to true to see the whole map
                
                if (debugMode) {
                    // In debug mode, show the whole map
                    this._renderTile(cellElement, tile);
                } else {
                    // Normal gameplay mode with FOV
                    if (gameState.isTileVisible(x, y)) {
                        // Render visible tile
                        this._renderVisibleTile(cellElement, tile, x, y);
                    } else if (gameState.isTileExplored(x, y)) {
                        // Render explored but not visible tile
                        this._renderExploredTile(cellElement, tile);
                    } else {
                        // Render unexplored tile (black)
                        cellElement.textContent = ' ';
                        cellElement.style.backgroundColor = '#000';
                    }
                }
                
                rowElement.appendChild(cellElement);
            }
            
            this.mapElement.appendChild(rowElement);
        }
        
        // Update UI elements
        this._updateStats();
    }
    
    _renderEmptyMap() {
        // Render a blank map if no real map exists
        this.mapElement.innerHTML = '';
        
        const viewWidth = 40;
        const viewHeight = 25;
        
        for (let y = 0; y < viewHeight; y++) {
            const rowElement = document.createElement('div');
            rowElement.className = 'map-row';
            
            for (let x = 0; x < viewWidth; x++) {
                const cellElement = document.createElement('div');
                cellElement.className = 'map-cell';
                cellElement.textContent = ' ';
                cellElement.style.backgroundColor = '#000';
                
                rowElement.appendChild(cellElement);
            }
            
            this.mapElement.appendChild(rowElement);
        }
    }
    
    _renderVisibleTile(cellElement, tile, x, y) {
        // First check for entities at this position
        const entities = gameState.getEntitiesAt(x, y);
        
        // Sort entities by render priority (higher = on top)
        entities.sort((a, b) => {
            const renderableA = a.getComponent('RenderableComponent');
            const renderableB = b.getComponent('RenderableComponent');
            
            if (!renderableA) return -1;
            if (!renderableB) return 1;
            
            return renderableB.priority - renderableA.priority;
        });
        
        if (entities.length > 0 && entities[0].renderable) {
            // Render the highest priority entity
            const renderable = entities[0].renderable;
            cellElement.textContent = renderable.char;
            cellElement.style.color = renderable.color;
            
            // Set background if entity has one, otherwise use tile background
            if (renderable.background) {
                cellElement.style.backgroundColor = renderable.background;
            } else {
                this._setTileBackground(cellElement, tile);
            }
        } else {
            // Render the tile itself
            this._renderTile(cellElement, tile);
        }
        
        // Add targeting highlighting if we're in targeting mode
        if (targetingSystem.isTargetingActive()) {
            // Make clickable cells more obvious
            cellElement.style.cursor = 'crosshair';
            
            const targetingInfo = targetingSystem.getTargetingInfo();
            if (targetingInfo && gameState.player) {
                const playerX = gameState.player.x;
                const playerY = gameState.player.y;
                const distance = Math.sqrt(Math.pow(playerX - x, 2) + Math.pow(playerY - y, 2));
                
                // Add the targeting class to all visible tiles
                cellElement.classList.add('targeting-cell');
                
                // Check if this position is the current target position
                const isCurrentTarget = targetingInfo.currentTarget && 
                                       targetingInfo.currentTarget.x === x && 
                                       targetingInfo.currentTarget.y === y;
                
                // Check if position is a valid target
                const isValidTarget = targetingInfo.validTargets.some(
                    target => target.x === x && target.y === y
                );
                
                if (isValidTarget) {
                    // This is a valid target in range
                    cellElement.classList.add('in-range');
                    
                    // Detect if there's a target with health at this position
                    const hasTarget = entities.some(e => e.hasComponent('HealthComponent'));
                    
                    if (hasTarget) {
                        // Valid target with enemy - highlight strongly
                        cellElement.classList.add('has-target');
                        cellElement.style.border = isCurrentTarget ? '3px solid red' : '2px solid red';
                        cellElement.style.backgroundColor = `rgba(255, 50, 0, 0.3)`;
                    } else {
                        // Valid empty space target - subtle highlight
                        cellElement.style.border = isCurrentTarget ? 
                                                '2px solid rgba(255, 255, 255, 0.9)' : 
                                                '1px solid rgba(255, 255, 255, 0.7)';
                        cellElement.style.backgroundColor = isCurrentTarget ?
                                                         `rgba(255, 255, 255, 0.2)` :
                                                         `rgba(255, 255, 255, 0.1)`;
                    }
                } else {
                    // Out of range - clearly show as invalid
                    cellElement.classList.add('out-of-range');
                    cellElement.style.opacity = '0.6';
                    cellElement.style.border = '1px dashed rgba(100, 100, 100, 0.5)';
                }
                
                // Extra highlight for current target position
                if (isCurrentTarget) {
                    cellElement.classList.add('current-target');
                    // Add a pulsing animation if this is the current target
                    cellElement.style.animation = 'targetPulse 1.5s infinite';
                }
            }
        }
    }
    
    _renderExploredTile(cellElement, tile) {
        this._renderTile(cellElement, tile, true);
    }
    
    _renderTile(cellElement, tile, dimmed = false) {
        // Choose character based on tile type
        switch (tile.type) {
            case TILE_TYPES.WALL:
                cellElement.textContent = '#';
                cellElement.style.color = dimmed ? '#444' : COLORS.WALL;
                break;
            case TILE_TYPES.FLOOR:
                cellElement.textContent = '.';
                cellElement.style.color = dimmed ? '#222' : '#666';
                break;
            case TILE_TYPES.STAIRS_DOWN:
                cellElement.textContent = '>';
                cellElement.style.color = dimmed ? '#666' : '#fff';
                break;
            case TILE_TYPES.DOOR:
                cellElement.textContent = '+';
                cellElement.style.color = dimmed ? '#666' : '#8b4513';
                break;
            case TILE_TYPES.TOWN_FLOOR:
                cellElement.textContent = '.';
                cellElement.style.color = dimmed ? '#2a5c30' : COLORS.TOWN_FLOOR;
                break;
            case TILE_TYPES.BUILDING:
                cellElement.textContent = '#';
                cellElement.style.color = dimmed ? '#653008' : COLORS.BUILDING;
                break;
            case TILE_TYPES.DUNGEON_ENTRANCE:
                cellElement.textContent = '>';
                cellElement.style.color = dimmed ? '#333' : '#fff';
                break;
            case TILE_TYPES.AREA_EXIT:
                cellElement.textContent = '⋄';
                cellElement.style.color = dimmed ? '#666' : '#ffcc00';
                break;
            case TILE_TYPES.STAIRS_UP:
                cellElement.textContent = '<';
                cellElement.style.color = dimmed ? '#666' : '#fff';
                break;
            default:
                cellElement.textContent = '?';
                cellElement.style.color = dimmed ? '#666' : '#f00';
        }
        
        // Set background color
        this._setTileBackground(cellElement, tile, dimmed);
    }
    
    _setTileBackground(cellElement, tile, dimmed = false) {
        if (dimmed) {
            cellElement.style.backgroundColor = '#111';
            return;
        }
        
        switch (tile.type) {
            case TILE_TYPES.FLOOR:
                cellElement.style.backgroundColor = '#111';
                break;
            case TILE_TYPES.TOWN_FLOOR:
                cellElement.style.backgroundColor = '#1a3c20';
                break;
            case TILE_TYPES.DUNGEON_ENTRANCE:
                cellElement.style.backgroundColor = '#222';
                break;
            case TILE_TYPES.AREA_EXIT:
                cellElement.style.backgroundColor = '#222';
                break;
            default:
                cellElement.style.backgroundColor = '#000';
        }
    }
    
    renderMessages() {
        if (!this.messageElement) return;
        
        this.messageElement.innerHTML = '';
        
        // Show the most recent messages (up to 5)
        const messages = gameState.messages.slice(0, 5);
        
        messages.forEach(message => {
            const messageElement = document.createElement('div');
            messageElement.className = `message message-${message.type}`;
            messageElement.textContent = message.text;
            this.messageElement.appendChild(messageElement);
        });
    }
    
    _updateStats() {
        // Update player stats display if available
        if (gameState.player && gameState.player.health) {
            const healthElement = document.getElementById('health');
            const manaElement = document.getElementById('mana');
            const levelElement = document.getElementById('level');
            const scoreElement = document.getElementById('score');
            
            if (healthElement) {
                healthElement.textContent = `HP: ${gameState.player.health.hp}/${gameState.player.health.maxHp}`;
            }
            
            // Add mana display
            const mana = gameState.player.getComponent('ManaComponent');
            if (manaElement && mana) {
                manaElement.textContent = `MP: ${mana.mana}/${mana.maxMana}`;
            }
            
            if (levelElement && gameState.player.getComponent('StatsComponent')) {
                levelElement.textContent = `Level: ${gameState.player.getComponent('StatsComponent').level}`;
            }
            
            if (scoreElement) {
                scoreElement.textContent = `Score: ${gameState.score}`;
            }
        }
        
        // Render the mini-map when stats are updated
        this.renderMiniMap();
    }
    
    renderMiniMap() {
        if (!this.miniMapElement || !gameState.map) return;
        
        // Clear the mini-map
        this.miniMapElement.innerHTML = '';
        
        const map = gameState.map;
        const scale = 3; // One dot per 3x3 tiles
        
        // Calculate mini-map bounds
        const miniMapWidth = Math.ceil(map.width / scale);
        const miniMapHeight = Math.ceil(map.height / scale);
        
        // Create rows for the mini-map
        for (let y = 0; y < miniMapHeight; y++) {
            const rowElement = document.createElement('div');
            rowElement.style.display = 'flex';
            rowElement.style.height = '3px';
            
            for (let x = 0; x < miniMapWidth; x++) {
                const cellElement = document.createElement('div');
                cellElement.style.width = '3px';
                cellElement.style.height = '3px';
                
                // Get the average type of the 3x3 grid of tiles
                let hasFloor = false;
                let hasWall = false;
                let hasNPC = false;
                
                // Check the 3x3 area
                for (let dy = 0; dy < scale; dy++) {
                    for (let dx = 0; dx < scale; dx++) {
                        const mapX = x * scale + dx;
                        const mapY = y * scale + dy;
                        
                        if (mapX < map.width && mapY < map.height) {
                            const tile = map.getTile(mapX, mapY);
                            if (tile) {
                                if (tile.type !== 0) { // Not a wall
                                    hasFloor = true;
                                } else {
                                    hasWall = true;
                                }
                                
                                // Check if there's an NPC at this location
                                const entitiesHere = gameState.getEntitiesAt(mapX, mapY);
                                if (entitiesHere.some(e => e.hasComponent('DialogueComponent'))) {
                                    hasNPC = true;
                                }
                            }
                        }
                    }
                }
                
                // Set the color based on the tile type
                if (hasNPC) {
                    cellElement.style.backgroundColor = '#ff0'; // Yellow for NPCs
                } else if (hasFloor) {
                    cellElement.style.backgroundColor = '#484'; // Dark green for floors
                } else if (hasWall) {
                    cellElement.style.backgroundColor = '#666'; // Gray for walls
                } else {
                    cellElement.style.backgroundColor = '#000'; // Black for unexplored
                }
                
                // Mark player position
                if (gameState.player && gameState.player.position) {
                    const playerX = Math.floor(gameState.player.position.x / scale);
                    const playerY = Math.floor(gameState.player.position.y / scale);
                    
                    if (x === playerX && y === playerY) {
                        cellElement.style.backgroundColor = '#fff'; // White for player
                    }
                }
                
                rowElement.appendChild(cellElement);
            }
            
            this.miniMapElement.appendChild(rowElement);
        }
    }
}

export default RenderSystem;