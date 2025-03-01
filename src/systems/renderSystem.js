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
        
        // Create a container for spell effects
        this.spellEffectsContainer = document.createElement('div');
        this.spellEffectsContainer.id = 'spell-effects-container';
        this.spellEffectsContainer.style.position = 'absolute';
        this.spellEffectsContainer.style.top = '0';
        this.spellEffectsContainer.style.left = '0';
        this.spellEffectsContainer.style.width = '100%';
        this.spellEffectsContainer.style.height = '100%';
        this.spellEffectsContainer.style.pointerEvents = 'none';
        this.spellEffectsContainer.style.zIndex = '50';
        
        // Insert the container into the map element itself
        this.mapElement.appendChild(this.spellEffectsContainer);
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
                
                // Add data attributes for position
                const viewX = x - startX;
                const viewY = y - startY;
                
                cellElement.dataset.x = String(viewX);
                cellElement.dataset.y = String(viewY);
                cellElement.dataset.mapX = String(x);
                cellElement.dataset.mapY = String(y);
                
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
                
                // Add data attributes for position
                cellElement.dataset.x = String(x); 
                cellElement.dataset.y = String(y);
                cellElement.dataset.mapX = String(x);
                cellElement.dataset.mapY = String(y);
                
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
            
            return (renderableB.priority || 0) - (renderableA.priority || 0);
        });
        
        // Remove the duplicate targeting highlight call (handled below)
        
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
                const playerX = gameState.player.position.x;
                const playerY = gameState.player.position.y;
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
        // First, remove any special tile classes that might be present
        cellElement.classList.remove('stairs-down', 'stairs-up', 'area-exit', 'dungeon-entrance');
        
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
                // Add special class for stairs down
                if (!dimmed) cellElement.classList.add('stairs-down');
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
                // Add special class for dungeon entrance
                if (!dimmed) cellElement.classList.add('dungeon-entrance');
                break;
            case TILE_TYPES.AREA_EXIT:
                cellElement.textContent = '⋄';
                cellElement.style.color = dimmed ? '#666' : '#ffcc00';
                // Add special class for area exit
                if (!dimmed) cellElement.classList.add('area-exit');
                break;
            case TILE_TYPES.STAIRS_UP:
                cellElement.textContent = '<';
                cellElement.style.color = dimmed ? '#666' : '#fff';
                // Add special class for stairs up
                if (!dimmed) cellElement.classList.add('stairs-up');
                break;
            default:
                cellElement.textContent = '?';
                cellElement.style.color = dimmed ? '#666' : '#f00';
        }
        
        // Add a data attribute for the tile type to help with debugging
        cellElement.setAttribute('data-tile-type', tile.type);
        
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
        if (!this.messageElement) {
            console.error("Message element not found");
            return;
        }
        
        this.messageElement.innerHTML = '';
        
        // Show the most recent messages (up to 5)
        const messages = gameState.messages.slice(0, 5);
        
        console.log("Rendering messages:", messages);
        
        messages.forEach(message => {
            const messageElement = document.createElement('div');
            // Handle both "text" and "message" property names for backward compatibility
            const messageText = message.text || message.message;
            
            if (!messageText) {
                console.warn("Message without text:", message);
                return;
            }
            
            messageElement.className = `message message-${message.type || 'info'}`;
            messageElement.textContent = messageText;
            this.messageElement.appendChild(messageElement);
        });
    }
    
    /**
     * Apply targeting highlight to the cell if it's in the valid range
     * This method is no longer used - targeting highlights are applied directly in _renderVisibleTile
     * @deprecated
     */
    _applyTargetingHighlight(cellElement, x, y) {
        // This method is kept for compatibility but no longer used
        // All targeting highlighting is now done in the _renderVisibleTile method
        return;
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
    
    /**
     * Create a spell visual effect
     * @param {string} type - Type of spell effect ('aura', 'bolt', etc)
     * @param {string} element - Element of the spell ('fire', 'ice', etc)
     * @param {object} options - Additional options for the effect
     */
    createSpellEffect(type, element, options = {}) {
        // Force create the container every time to ensure it exists and is properly positioned
        const gameContainer = document.getElementById('game-container');
        if (!gameContainer) {
            console.error("Cannot find game-container element for spell effects");
            return;
        }
        
        // Create a new container each time to avoid any positioning issues
        const effectsContainer = document.createElement('div');
        effectsContainer.id = 'temp-spell-effect-container';
        effectsContainer.style.position = 'absolute';
        effectsContainer.style.top = '0';
        effectsContainer.style.left = '0';
        effectsContainer.style.width = '100%';
        effectsContainer.style.height = '100%';
        effectsContainer.style.pointerEvents = 'none';
        effectsContainer.style.zIndex = '1000';
        
        // Add debugging border for development
        effectsContainer.style.border = 'none'; // Change to '1px solid red' to debug container
        
        // Add it directly to the game container
        gameContainer.appendChild(effectsContainer);
        console.log("Created new effects container for this spell");
        
        // Confirm position and dimensions
        const rect = effectsContainer.getBoundingClientRect();
        console.log(`Effects container positioned at (${rect.left},${rect.top}) with size ${rect.width}x${rect.height}`);
        
        // Position defaults to center of map
        const { 
            x = 0, 
            y = 0, 
            sourceX = null, 
            sourceY = null, 
            targetX = null, 
            targetY = null, 
            radius = 2, 
            duration = 800 
        } = options;
        
        // Create the effect element
        const effectElement = document.createElement('div');
        effectElement.className = `spell-effect ${element} ${type}`;
        // Add a randomized ID for debugging
        const effectId = `effect-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        effectElement.id = effectId;
        console.log(`Created effect with ID: ${effectId}`);
        
        // Set base style
        effectElement.style.position = 'absolute';
        // Force any transforms to override animation
        effectElement.style.transformStyle = 'preserve-3d';
        
        // For absolute positioning on the game container, we don't need to adjust for viewport
        
        // Handle different effect types
        if (type === 'aura' || type === 'persistent-aura' || type === 'wave') {
            // For aura effects, create a circle centered on the caster
            const cellSize = 20; // Match the cell size from CSS
            const radiusInPx = radius * cellSize;
            
            // Position in absolute coordinates for the container
            const gameMap = document.getElementById('game-map');
            const mapRect = gameMap ? gameMap.getBoundingClientRect() : null;
            
            // Get the cell element at the specified position
            const cellElement = document.querySelector(`[data-map-x="${x}"][data-map-y="${y}"]`);
            let cellRect = null;
            
            if (cellElement) {
                cellRect = cellElement.getBoundingClientRect();
                console.log(`Found cell at position ${x},${y}`, cellRect);
            }
            
            // Use the cell's position if found, otherwise estimate
            let adjustedX, adjustedY;
            
            if (cellRect && mapRect) {
                // Use the actual position of the cell relative to the game container
                adjustedX = cellRect.left - mapRect.left + cellSize/2 - radiusInPx;
                adjustedY = cellRect.top - mapRect.top + cellSize/2 - radiusInPx;
                console.log(`Using actual cell position: ${adjustedX},${adjustedY}`);
            } else {
                // Fallback to estimation
                const viewWidth = 40;
                const viewHeight = 25;
                adjustedX = (x % viewWidth) * cellSize + cellSize/2 - radiusInPx;
                adjustedY = (y % viewHeight) * cellSize + cellSize/2 - radiusInPx;
                console.log(`Using estimated position: ${adjustedX},${adjustedY}`);
            }
            
            effectElement.style.left = `${adjustedX}px`;
            effectElement.style.top = `${adjustedY}px`;
            effectElement.style.width = `${radiusInPx * 2}px`;
            effectElement.style.height = `${radiusInPx * 2}px`;
            
            // Set animation duration
            effectElement.style.animationDuration = `${duration}ms`;
        } 
        else if (type === 'bolt') {
            // For bolt effects, draw a line from source to target
            const cellSize = 20; // Match the cell size from CSS
            
            // If source not specified, use player position
            let srcX = sourceX;
            let srcY = sourceY;
            
            if (srcX === null || srcY === null) {
                if (gameState.player && gameState.player.position) {
                    srcX = gameState.player.position.x;
                    srcY = gameState.player.position.y;
                } else {
                    return; // Can't draw a bolt without a start position
                }
            }
            
            // Position and size
            const dx = targetX - srcX;
            const dy = targetY - srcY;
            const length = Math.sqrt(dx * dx + dy * dy) * cellSize;
            const angle = Math.atan2(dy, dx) * (180 / Math.PI);
            
            // Position using DOM coordinates for accuracy
            // Get the source and target cell positions
            const sourceCell = document.querySelector(`[data-map-x="${srcX}"][data-map-y="${srcY}"]`);
            const targetCell = document.querySelector(`[data-map-x="${targetX}"][data-map-y="${targetY}"]`);
            const gameMap = document.getElementById('game-map');
            const mapRect = gameMap ? gameMap.getBoundingClientRect() : null;
            
            let sourceCellRect = null;
            let targetCellRect = null;
            
            if (sourceCell) {
                sourceCellRect = sourceCell.getBoundingClientRect();
                console.log(`Found source cell at ${srcX},${srcY}`, sourceCellRect);
            }
            
            if (targetCell) {
                targetCellRect = targetCell.getBoundingClientRect();
                console.log(`Found target cell at ${targetX},${targetY}`, targetCellRect);
            }
            
            let screenStartX, screenStartY;
            let screenTargetX, screenTargetY;
            let boltLength, boltAngle;
            
            if (sourceCellRect && targetCellRect && mapRect) {
                // Use the actual position relative to the game container
                screenStartX = sourceCellRect.left - mapRect.left + cellSize/2;
                screenStartY = sourceCellRect.top - mapRect.top + cellSize/2;
                
                // Calculate actual target position
                screenTargetX = targetCellRect.left - mapRect.left + cellSize/2;
                screenTargetY = targetCellRect.top - mapRect.top + cellSize/2;
                
                // Calculate the angle and length based on screen coordinates
                const actualDx = screenTargetX - screenStartX;
                const actualDy = screenTargetY - screenStartY;
                boltLength = Math.sqrt(actualDx * actualDx + actualDy * actualDy);
                boltAngle = Math.atan2(actualDy, actualDx) * (180 / Math.PI);
                
                console.log(`Found cells and calculating precise bolt:`);
                console.log(`  Source: (${screenStartX}, ${screenStartY})`);
                console.log(`  Target: (${screenTargetX}, ${screenTargetY})`);
                console.log(`  Bolt length: ${boltLength}px, angle: ${boltAngle}°`);
            } else {
                // Fallback to viewport calculation
                console.log(`Missing cells for precise bolt calculation, using estimates.`);
                const viewWidth = 40;
                const viewHeight = 25;
                
                // Estimate source coordinates
                screenStartX = (srcX % viewWidth) * cellSize + cellSize/2;
                screenStartY = (srcY % viewHeight) * cellSize + cellSize/2;
                
                // Estimate target coordinates
                screenTargetX = (targetX % viewWidth) * cellSize + cellSize/2;
                screenTargetY = (targetY % viewHeight) * cellSize + cellSize/2;
                
                // Calculate length and angle
                const estDx = screenTargetX - screenStartX;
                const estDy = screenTargetY - screenStartY;
                boltLength = Math.sqrt(estDx * estDx + estDy * estDy);
                boltAngle = Math.atan2(estDy, estDx) * (180 / Math.PI);
                
                console.log(`  Estimated source: (${screenStartX}, ${screenStartY})`);
                console.log(`  Estimated target: (${screenTargetX}, ${screenTargetY})`);
                console.log(`  Estimated bolt length: ${boltLength}px, angle: ${boltAngle}°`);
            }

            // Position the bolt element at the source's center
            effectElement.style.left = `${screenStartX}px`;
            effectElement.style.top = `${screenStartY}px`;
            effectElement.style.width = `${boltLength}px`;
            
            // Implement a completely different approach for bolt rendering
            effectElement.style.transformOrigin = 'left center';
            effectElement.style.position = 'absolute';
            
            // Create a bolt with explicit inline styles that override any CSS
            // This is a brute force approach but should work
            effectElement.style.cssText += `
                width: ${boltLength}px !important;
                height: 10px !important;
                transform: rotate(${boltAngle}deg) !important;
                transform-origin: left center !important; 
                pointer-events: none !important;
                z-index: 9999 !important;
            `;
            
            // Add extra element inside to ensure visibility
            const innerBolt = document.createElement('div');
            innerBolt.style.cssText = `
                width: 100%;
                height: 100%;
                position: absolute;
                top: 0;
                left: 0;
                background: ${element === 'fire' ? 'linear-gradient(to right, #F60, #F90)' : 
                              element === 'ice' ? 'linear-gradient(to right, #08F, #0CF)' :
                              element === 'lightning' ? 'linear-gradient(to right, #FF0, #FF8)' : 
                              'white'};
                border-radius: 3px;
            `;
            effectElement.appendChild(innerBolt);
            
            // Log detailed transformation
            console.log(`Applied rotation transform: rotate(${boltAngle}deg) to effect ${effectElement.id}`);
            
            // Log info about what's happening
            console.log(`Bolt created: from map(${srcX},${srcY}) to map(${targetX},${targetY})`);
            console.log(`Bolt rotation: ${boltAngle}° with length ${boltLength}px`);
            
            // Set animation duration
            effectElement.style.animationDuration = `${duration}ms`;
        }
        else if (type === 'impact') {
            // For impact effects, create a flash at the target location
            const cellSize = 20; // Match the cell size from CSS
            const size = cellSize * 1.5;
            
            // Position using DOM coordinates for accuracy
            const cellElement = document.querySelector(`[data-map-x="${x}"][data-map-y="${y}"]`);
            const gameMap = document.getElementById('game-map');
            const mapRect = gameMap ? gameMap.getBoundingClientRect() : null;
            
            let adjustedX, adjustedY;
            
            if (cellElement && mapRect) {
                const cellRect = cellElement.getBoundingClientRect();
                adjustedX = cellRect.left - mapRect.left + cellSize/2 - size/2;
                adjustedY = cellRect.top - mapRect.top + cellSize/2 - size/2;
                console.log(`Using actual impact position at ${x},${y}: ${adjustedX},${adjustedY}`);
            } else {
                // Fallback to estimation
                const viewWidth = 40;
                const viewHeight = 25;
                adjustedX = (x % viewWidth) * cellSize + cellSize/2 - size/2;
                adjustedY = (y % viewHeight) * cellSize + cellSize/2 - size/2;
                console.log(`Using estimated impact position: ${adjustedX},${adjustedY}`);
            }
            
            effectElement.style.left = `${adjustedX}px`;
            effectElement.style.top = `${adjustedY}px`;
            effectElement.style.width = `${size}px`;
            effectElement.style.height = `${size}px`;
            effectElement.style.borderRadius = '50%';
            
            // Set animation duration
            effectElement.style.animationDuration = `${duration}ms`;
        }
        
        // Log effect creation for debugging
        console.log(`Creating ${element} ${type} effect at position (${x}, ${y})`);
        
        // Make effects more visible for testing
        effectElement.style.zIndex = '100';
        if (type === 'bolt') {
            effectElement.style.height = '8px'; // Make bolts thinner to represent projectiles
            // Ensure bolt has a visible width and make it stand out more
            effectElement.style.minWidth = '10px'; 
            effectElement.style.border = `2px solid ${element === 'fire' ? '#ff0' : 
                                          element === 'ice' ? '#6ff' : 
                                          element === 'lightning' ? '#ff6' : '#fff'}`;
        }
        
        // Add to the container
        effectsContainer.appendChild(effectElement);
        console.log("Added effect to container:", effectsContainer.childNodes.length, "elements");
        
        // For persistent effects, handle differently
        if (type === 'persistent-aura') {
            // Return the element so it can be managed by the spell logic
            // Don't remove it automatically
            console.log("Created persistent aura effect that will be managed by spell logic");
            
            // Store a reference to the container to allow removal later
            effectElement.container = effectsContainer;
            return effectElement;
        }
        
        // For regular effects, remove after animation completes
        setTimeout(() => {
            if (effectElement.parentNode) {
                effectElement.parentNode.removeChild(effectElement);
                console.log(`Removed ${element} ${type} effect after ${duration}ms`);
            }
            
            // Also remove the container
            if (effectsContainer.parentNode) {
                effectsContainer.parentNode.removeChild(effectsContainer);
                console.log("Removed temporary effects container");
            }
        }, duration);
        
        return effectElement;
    }
}

export default RenderSystem;