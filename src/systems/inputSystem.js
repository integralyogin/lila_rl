import { KEYS, TILE_TYPES } from '../constants.js';
import gameState from '../core/gameState.js';
import eventBus from '../core/eventEmitter.js';
import { targetingSystem } from './targetingSystem.js';
import Pathfinder from '../utils/pathfinding.js';
import { allyLogic } from '../entities/ally_logic.js';

class InputSystem {
    constructor() {
        this.boundHandleKeyDown = this.handleKeyDown.bind(this);
        this.boundHandleClick = this.handleClick.bind(this);
        this.boundHandleMouseMove = this.handleMouseMove.bind(this);
        this.boundHandleMouseLeave = this.handleMouseLeave.bind(this);
        
        // Set up event listeners
        window.addEventListener('keydown', this.boundHandleKeyDown);
        
        // Add mouse click handler for targeting and movement
        document.addEventListener('click', this.boundHandleClick);
        
        // Add mouse move handler for hover information
        document.addEventListener('mousemove', this.boundHandleMouseMove);
        
        // Add event handler to hide tooltip when mouse leaves the map
        const gameMap = document.getElementById('game-map');
        if (gameMap) {
            gameMap.addEventListener('mouseleave', this.boundHandleMouseLeave);
        } else {
            // If map isn't ready yet, set up once the DOM is fully loaded
            document.addEventListener('DOMContentLoaded', () => {
                const map = document.getElementById('game-map');
                if (map) {
                    map.addEventListener('mouseleave', this.boundHandleMouseLeave);
                }
            });
        }
        
        // Initialize path visualization objects
        this.currentPath = null;
        this.pathHighlights = [];
        this.pathfinder = null;
    }
    
    shutdown() {
        // Clean up event listeners when system is destroyed
        window.removeEventListener('keydown', this.boundHandleKeyDown);
        document.removeEventListener('click', this.boundHandleClick);
        document.removeEventListener('mousemove', this.boundHandleMouseMove);
        
        const gameMap = document.getElementById('game-map');
        if (gameMap) {
            gameMap.removeEventListener('mouseleave', this.boundHandleMouseLeave);
        }
        
        // Clear any path in progress
        this.currentPath = null;
    }
    
    handleKeyDown(event) {
        // Ignore keystrokes if there's no player
        if (!gameState.player) return;
        
        // Get the key that was pressed
        const key = event.key;
        
        // Check if targeting is active first, regardless of game mode
        if (targetingSystem.isTargetingActive()) {
            this.handleTargetingInput(key);
            event.preventDefault();
            return;
        }
        
        // Handle different game modes
        switch (gameState.gameMode) {
            case 'exploration':
                this.handleExplorationInput(key);
                break;
            case 'inventory':
                this.handleInventoryInput(key);
                break;
            case 'spellbook':
                this.handleSpellbookInput(key);
                break;
            case 'character':
                this.handleCharacterInput(key);
                break;
            case 'dialogue':
                // Prevent movement during dialogue - only allow DialogueUI to handle inputs
                // Other dialogue input (space/enter/escape) is handled by the DialogueUI
                break;
            case 'shop':
                // Forward key presses to the shop UI and prevent default game behavior
                eventBus.emit('shopKeyPressed', key);
                // Prevent event from bubbling
                event.preventDefault();
                break;
            default:
                console.warn(`Unknown game mode: ${gameState.gameMode}`);
        }
    }
    
    handleClick(event) {
        // Ignore clicks if there's no player
        if (!gameState.player) return;
        
        // Handle targeting mode separately
        if (targetingSystem.isTargetingActive()) {
            this.handleTargetingClick(event);
            return;
        }
        
        // For normal gameplay, handle movement clicks
        if (gameState.gameMode === 'exploration') {
            this.handleMovementClick(event);
        }
    }
    
    handleTargetingClick(event) {
        // Get the tile under the click
        const tileInfo = this.getTileFromMouseEvent(event);
        if (!tileInfo) return;
        
        const { mapX, mapY, viewX, viewY } = tileInfo;
        
        console.log(`Targeting click at cell ${viewX},${viewY} -> map position ${mapX},${mapY}`);
        
        // Send the target selection directly to the targeting system
        targetingSystem.selectTarget({ x: mapX, y: mapY });
        
        // Prevent default click behavior
        event.preventDefault();
    }
    
    handleMovementClick(event) {
        // Only handle clicks in exploration mode
        if (gameState.gameMode !== 'exploration') return;
        
        // Get the tile under the click
        const tileInfo = this.getTileFromMouseEvent(event);
        if (!tileInfo) return;
        
        const { mapX, mapY, viewX, viewY } = tileInfo;
        
        console.log(`Movement click at cell ${viewX},${viewY} -> map position ${mapX},${mapY}`);
        
        // Get the tile at the clicked location
        const clickedTile = gameState.map.getTile(mapX, mapY);
        
        // Check if clicked directly on special tiles that are adjacent to player
        if (clickedTile) {
            const playerX = gameState.player.position.x;
            const playerY = gameState.player.position.y;
            const isAdjacent = Math.abs(mapX - playerX) <= 1 && Math.abs(mapY - playerY) <= 1;
            
            // If clicked on an adjacent special tile, use it immediately instead of pathing
            if (isAdjacent && (
                clickedTile.type === TILE_TYPES.STAIRS_DOWN || 
                clickedTile.type === TILE_TYPES.STAIRS_UP || 
                clickedTile.type === TILE_TYPES.DUNGEON_ENTRANCE || 
                clickedTile.type === TILE_TYPES.AREA_EXIT)) {
                
                // First move to the special tile (if we're not already on it)
                const dx = mapX - playerX;
                const dy = mapY - playerY;
                if (dx !== 0 || dy !== 0) {
                    this.tryMove(dx, dy);
                }
                
                // Then interact with it
                this.tryUseStairs();
                
                // Prevent default click behavior
                event.preventDefault();
                return;
            }
        }
        
        // Initialize pathfinder if needed
        if (!this.pathfinder) {
            this.pathfinder = new Pathfinder(gameState.map);
        }
        
        // Get player position
        const playerX = gameState.player.position.x;
        const playerY = gameState.player.position.y;
        
        // Update the pathfinder with the current map
        this.pathfinder.map = gameState.map;
        
        // Check if the tile is explored - we need to update the tiles' explored property
        // from the gameState's exploredTiles Set
        if (clickedTile) {
            clickedTile.explored = gameState.isTileExplored(mapX, mapY);
        }
        
        // Find a path to the clicked location
        const path = this.pathfinder.findPath(
            playerX, playerY, 
            mapX, mapY, 
            false // Changed to false to allow pathing to unexplored tiles
        );
        
        // If no path found, show a message
        if (!path || path.length === 0) {
            gameState.addMessage("Cannot find a path to that location.");
            return;
        }
        
        // Begin moving along the path
        this.currentPath = path;
        this.followPath();
        
        // Prevent default click behavior
        event.preventDefault();
    }
    
    followPath() {
        if (!this.currentPath || this.currentPath.length === 0) {
            // Path completed or no path
            this.currentPath = null;
            return;
        }
        
        // Get next step
        const nextStep = this.currentPath[0];
        
        // Calculate direction to move
        const playerX = gameState.player.position.x;
        const playerY = gameState.player.position.y;
        const dx = nextStep.x - playerX;
        const dy = nextStep.y - playerY;
        
        // Try to move in that direction
        const actionTaken = this.tryMove(dx, dy);
        
        if (actionTaken) {
            // Remove this step from the path
            this.currentPath.shift();
            
            // Check if we've reached the final destination
            if (this.currentPath.length === 0) {
                // We've reached our final destination, check if we need to interact with this tile
                const currX = gameState.player.position.x;
                const currY = gameState.player.position.y;
                const tile = gameState.map.getTile(currX, currY);
                
                // If this is a special tile (stairs, door, etc.), interact with it
                if (tile && (tile.type === TILE_TYPES.STAIRS_DOWN || 
                             tile.type === TILE_TYPES.STAIRS_UP || 
                             tile.type === TILE_TYPES.DUNGEON_ENTRANCE ||
                             tile.type === TILE_TYPES.AREA_EXIT)) {
                    this.tryUseStairs();
                }
            } 
            // If there are more steps, continue on next turn
            else if (this.currentPath.length > 0) {
                // Schedule the next step for the next game tick
                setTimeout(() => {
                    // Check if we're still in exploration mode
                    if (gameState.gameMode === 'exploration') {
                        this.followPath();
                    } else {
                        // Path interrupted by a mode change (e.g., combat)
                        this.currentPath = null;
                    }
                }, 100); // Small delay to make movement visible
            }
        } else {
            // If we couldn't move, cancel the path
            // This can happen if an entity moved into our path
            this.currentPath = null;
            gameState.addMessage("Path blocked.");
        }
    }
    
    // Helper method to calculate map coordinates from a mouse event
    getTileFromMouseEvent(event) {
        // Find the map cell under the mouse
        const mapCells = document.getElementsByClassName('map-cell');
        
        // Find the cell
        for (let i = 0; i < mapCells.length; i++) {
            const cell = mapCells[i];
            if (event.target === cell) {
                // Calculate map position based on the cell index
                const cellIndex = Array.from(mapCells).indexOf(cell);
                const mapWidth = 40; // This should match the viewWidth in render system
                
                const viewX = cellIndex % mapWidth;
                const viewY = Math.floor(cellIndex / mapWidth);
                
                // Calculate real map coordinates by adding the viewport offset
                const playerX = gameState.player ? gameState.player.position.x : 0;
                const playerY = gameState.player ? gameState.player.position.y : 0;
                const halfViewWidth = 20;
                const halfViewHeight = 10;
                
                const viewportStartX = Math.max(0, playerX - halfViewWidth);
                const viewportStartY = Math.max(0, playerY - halfViewHeight);
                
                const mapX = viewportStartX + viewX;
                const mapY = viewportStartY + viewY;
                
                return { cell, mapX, mapY, viewX, viewY };
            }
        }
        
        return null;
    }
    
    handleMouseMove(event) {
        // Get the tile under the mouse
        const tileInfo = this.getTileFromMouseEvent(event);
        if (!tileInfo) return;
        
        const { cell, mapX, mapY } = tileInfo;
        
        // If in targeting mode, highlight the current target
        if (gameState.gameMode === 'targeting') {
            this.updateTargetingHighlight(cell, mapX, mapY);
        }
        
        // Update hover tooltip
        this.updateHoverInfo(cell, mapX, mapY);
    }
    
    handleMouseLeave(event) {
        // Hide the tooltip when mouse leaves the game map
        const tooltip = document.getElementById('hover-tooltip');
        if (tooltip) {
            tooltip.style.display = 'none';
        }
        
        // Clear any temporary targeting highlight
        this.clearTargetingHighlight();
    }
    
    updateTargetingHighlight(cell, x, y) {
        // Clear any previous highlight
        this.clearTargetingHighlight();
        
        // Only apply highlighting for valid targets
        if (!gameState.isTileVisible(x, y)) {
            return;
        }
        
        // Find entities at this position
        const entities = gameState.getEntitiesAt(x, y);
        const entitiesWithHealth = entities.filter(e => e.hasComponent('HealthComponent'));
        
        // Check if the target is within range and valid for the current spell
        if (gameState.player && gameState.targetingData) {
            const playerX = gameState.player.position.x;
            const playerY = gameState.player.position.y;
            const distance = Math.sqrt(Math.pow(playerX - x, 2) + Math.pow(playerY - y, 2));
            const maxRange = gameState.targetingData.range;
            
            // Create or update targeting tooltip
            let targetTooltip = document.getElementById('targeting-tooltip');
            if (!targetTooltip) {
                targetTooltip = document.createElement('div');
                targetTooltip.id = 'targeting-tooltip';
                targetTooltip.style.position = 'absolute';
                targetTooltip.style.padding = '5px';
                targetTooltip.style.borderRadius = '3px';
                targetTooltip.style.fontSize = '12px';
                targetTooltip.style.pointerEvents = 'none';
                targetTooltip.style.zIndex = '1001'; // Higher than normal tooltip
                document.body.appendChild(targetTooltip);
            }
            
            // Position the tooltip
            const rect = cell.getBoundingClientRect();
            targetTooltip.style.left = rect.right + 5 + 'px';
            targetTooltip.style.top = rect.top + 'px';
            
            // If target is in range - all visible tiles are valid targets
            if (distance <= maxRange) {
                // Highlight the cell
                cell.classList.add('targeting-highlight');
                
                // Store the highlighted cell for later cleanup
                gameState.currentTargetingHighlight = cell;
                
                // Customize tooltip based on spell
                if (gameState.targetingData.spellId === 'firebolt') {
                    // Calculate potential damage
                    const intelligence = gameState.player.getComponent('StatsComponent').intelligence;
                    const spell = gameState.targetingData.spell;
                    const damage = spell.baseDamage + Math.floor(intelligence * 0.5);
                    
                    if (entitiesWithHealth.length > 0) {
                        // There's a valid target entity
                        const targetEntity = entitiesWithHealth[0];
                        
                        // Check if target will die
                        const health = targetEntity.getComponent('HealthComponent');
                        const willDie = health.hp <= damage;
                        
                        // Show detailed damage prediction
                        targetTooltip.innerHTML = `<b>Firebolt</b>: ${damage} damage to ${targetEntity.name}<br>`;
                        targetTooltip.innerHTML += `Target HP: ${health.hp}/${health.maxHp}<br>`;
                        targetTooltip.innerHTML += `Range: ${distance.toFixed(1)}/${maxRange}`;
                        
                        if (willDie) {
                            targetTooltip.innerHTML += "<br><span style='color:#ff0;'>LETHAL!</span>";
                            targetTooltip.style.backgroundColor = 'rgba(200,0,0,0.9)';
                            targetTooltip.style.borderLeft = '3px solid #ff0';
                        } else {
                            targetTooltip.style.backgroundColor = 'rgba(255,120,0,0.9)';
                            targetTooltip.style.borderLeft = '3px solid #f80';
                        }
                        
                        // Special warning for targeting the wizard
                        if (targetEntity.name === "Wizard" || targetEntity.name.includes("Wizard")) {
                            targetTooltip.innerHTML += "<br><span style='color:#f00;'>WARNING: Attacking the wizard may be dangerous!</span>";
                            targetTooltip.style.backgroundColor = 'rgba(200,0,0,0.9)';
                        }
                    } else {
                        // No target - just showing a generic message
                        targetTooltip.innerHTML = `<b>Firebolt</b> (${damage} damage)<br>`;
                        targetTooltip.innerHTML += `No target at this location<br>`;
                        targetTooltip.innerHTML += `Range: ${distance.toFixed(1)}/${maxRange}`;
                        targetTooltip.style.backgroundColor = 'rgba(255,120,0,0.7)';
                        targetTooltip.style.borderLeft = '3px solid #f80';
                    }
                    
                    targetTooltip.style.display = 'block';
                } else if (gameState.targetingData.spellId === 'icespear') {
                    // Similar tooltip for ice spear with frost styling
                    const intelligence = gameState.player.getComponent('StatsComponent').intelligence;
                    const spell = gameState.targetingData.spell;
                    const damage = spell.baseDamage + Math.floor(intelligence * 0.5);
                    
                    targetTooltip.innerHTML = `<b>Ice Spear</b>: ${damage} frost damage<br>`;
                    targetTooltip.innerHTML += `50% chance to slow target<br>`;
                    targetTooltip.innerHTML += `Range: ${distance.toFixed(1)}/${maxRange}`;
                    targetTooltip.style.backgroundColor = 'rgba(100,200,255,0.8)';
                    targetTooltip.style.borderLeft = '3px solid #0af';
                    targetTooltip.style.display = 'block';
                }
            } else {
                // Target is out of range - show range information
                targetTooltip.innerHTML = `<b>Out of Range</b><br>`;
                targetTooltip.innerHTML += `Target distance: ${distance.toFixed(1)}<br>`;
                targetTooltip.innerHTML += `Maximum range: ${maxRange}`;
                targetTooltip.style.backgroundColor = 'rgba(100,100,100,0.8)';
                targetTooltip.style.borderLeft = '3px solid #888';
                targetTooltip.style.display = 'block';
                
                // No highlight for out-of-range targets
            }
        }
    }
    
    clearTargetingHighlight() {
        // Remove highlight class from previously highlighted cell
        if (gameState.currentTargetingHighlight) {
            gameState.currentTargetingHighlight.classList.remove('targeting-highlight');
            gameState.currentTargetingHighlight = null;
        }
        
        // Hide targeting tooltip
        const targetTooltip = document.getElementById('targeting-tooltip');
        if (targetTooltip) {
            targetTooltip.style.display = 'none';
        }
    }

    updateHoverInfo(cell, x, y) {
        // Only show info for visible tiles
        if (!gameState.isTileVisible(x, y)) {
            return;
        }
        
        // Find entities at this position
        const entities = gameState.getEntitiesAt(x, y);
        
        // Get the highest priority entity (the one being rendered)
        const visibleEntities = entities.filter(e => e.hasComponent('RenderableComponent'));
        
        if (visibleEntities.length > 0) {
            // Sort entities by render priority
            visibleEntities.sort((a, b) => {
                const renderableA = a.getComponent('RenderableComponent');
                const renderableB = b.getComponent('RenderableComponent');
                
                if (!renderableA) return -1;
                if (!renderableB) return 1;
                
                return renderableB.priority - renderableA.priority;
            });
            
            // Display the name of the highest priority entity
            const entity = visibleEntities[0];
            
            // Create or update tooltip
            let tooltip = document.getElementById('hover-tooltip');
            if (!tooltip) {
                tooltip = document.createElement('div');
                tooltip.id = 'hover-tooltip';
                tooltip.style.position = 'absolute';
                tooltip.style.backgroundColor = 'rgba(0,0,0,0.8)';
                tooltip.style.color = '#fff';
                tooltip.style.padding = '5px';
                tooltip.style.borderRadius = '3px';
                tooltip.style.fontSize = '12px';
                tooltip.style.pointerEvents = 'none';
                tooltip.style.zIndex = '1000';
                document.body.appendChild(tooltip);
            }
            
            // Position the tooltip near the mouse but not directly under it
            const rect = cell.getBoundingClientRect();
            tooltip.style.left = rect.right + 'px';
            tooltip.style.top = rect.top + 'px';
            
            // Set the tooltip content
            tooltip.style.display = 'block';
            
            // Clear previous content
            tooltip.innerHTML = '';
            
            // Create structured tooltip content
            if (entity.hasComponent('HealthComponent')) {
                // For monsters/NPCs with health, create fancy HP display
                const health = entity.getComponent('HealthComponent');
                const tooltipContent = document.createElement('div');
                tooltipContent.className = 'monster-tooltip';
                
                // Add name section
                const nameElem = document.createElement('div');
                nameElem.className = 'monster-name';
                nameElem.textContent = entity.name;
                
                // Add type indicator
                if (entity.hasComponent('DialogueComponent')) {
                    nameElem.textContent += ' (NPC)';
                }
                
                tooltipContent.appendChild(nameElem);
                
                // Add HP section
                const hpElem = document.createElement('div');
                hpElem.className = 'monster-hp';
                hpElem.textContent = `HP: ${health.hp}/${health.maxHp}`;
                tooltipContent.appendChild(hpElem);
                
                // Add HP bar
                const hpBar = document.createElement('div');
                hpBar.className = 'hp-bar';
                
                const hpFill = document.createElement('div');
                hpFill.className = 'hp-fill';
                hpFill.style.width = `${(health.hp / health.maxHp) * 100}%`;
                
                hpBar.appendChild(hpFill);
                tooltipContent.appendChild(hpBar);
                
                tooltip.appendChild(tooltipContent);
            } else if (entity.hasComponent('ItemComponent')) {
                // For items, just show name and type
                const item = entity.getComponent('ItemComponent');
                tooltip.textContent = `${entity.name} (${item.type})`;
            } else {
                // For other entities, just show name
                tooltip.textContent = entity.name;
            }
        } else {
            // Show tile type if no entities
            const tile = gameState.map.getTile(x, y);
            
            if (tile) {
                let tooltip = document.getElementById('hover-tooltip');
                if (!tooltip) {
                    tooltip = document.createElement('div');
                    tooltip.id = 'hover-tooltip';
                    tooltip.style.position = 'absolute';
                    tooltip.style.backgroundColor = 'rgba(0,0,0,0.8)';
                    tooltip.style.color = '#fff';
                    tooltip.style.padding = '5px';
                    tooltip.style.borderRadius = '3px';
                    tooltip.style.fontSize = '12px';
                    tooltip.style.pointerEvents = 'none';
                    tooltip.style.zIndex = '1000';
                    document.body.appendChild(tooltip);
                }
                
                // Position the tooltip
                const rect = cell.getBoundingClientRect();
                tooltip.style.left = rect.right + 'px';
                tooltip.style.top = rect.top + 'px';
                
                // Set content based on tile type
                let tileType = "";
                switch (tile.type) {
                    case TILE_TYPES.FLOOR: tileType = "Floor"; break;
                    case TILE_TYPES.WALL: tileType = "Wall"; break;
                    case TILE_TYPES.STAIRS_DOWN: tileType = "Stairs Down"; break;
                    case TILE_TYPES.STAIRS_UP: tileType = "Stairs Up"; break;
                    case TILE_TYPES.DOOR: tileType = "Door"; break;
                    case TILE_TYPES.TOWN_FLOOR: tileType = "Town Path"; break;
                    case TILE_TYPES.BUILDING: tileType = "Building"; break;
                    case TILE_TYPES.DUNGEON_ENTRANCE: tileType = "Dungeon Entrance"; break;
                    case TILE_TYPES.AREA_EXIT: 
                        tileType = tile.exitInfo?.name ? 
                            `Exit to ${tile.exitInfo.name}` : "Area Exit";
                        break;
                    default: tileType = "Unknown";
                }
                
                tooltip.textContent = tileType;
                tooltip.style.display = 'block';
            } else {
                // Hide tooltip if no entity and no tile
                const tooltip = document.getElementById('hover-tooltip');
                if (tooltip) {
                    tooltip.style.display = 'none';
                }
            }
        }
    }
    
    handleTargetingInput(key) {
        // Handle movement keys for targeting
        if (KEYS.UP.includes(key)) {
            eventBus.emit('moveTarget', { x: 0, y: -1 });
        } else if (KEYS.DOWN.includes(key)) {
            eventBus.emit('moveTarget', { x: 0, y: 1 });
        } else if (KEYS.LEFT.includes(key)) {
            eventBus.emit('moveTarget', { x: -1, y: 0 });
        } else if (KEYS.RIGHT.includes(key)) {
            eventBus.emit('moveTarget', { x: 1, y: 0 });
        } else if (KEYS.UP_LEFT.includes(key)) {
            eventBus.emit('moveTarget', { x: -1, y: -1 });
        } else if (KEYS.UP_RIGHT.includes(key)) {
            eventBus.emit('moveTarget', { x: 1, y: -1 });
        } else if (KEYS.DOWN_LEFT.includes(key)) {
            eventBus.emit('moveTarget', { x: -1, y: 1 });
        } else if (KEYS.DOWN_RIGHT.includes(key)) {
            eventBus.emit('moveTarget', { x: 1, y: 1 });
        } 
        // Confirm target with Enter or Space
        else if (key === 'Enter' || key === ' ') {
            eventBus.emit('selectTarget');
        }
        // Cancel targeting with Escape
        else if (key === 'Escape') {
            eventBus.emit('cancelTargeting');
        }
    }
    
    handleExplorationInput(key) {
        let actionTaken = false;
        
        // Cancel any active path if any key is pressed
        if (this.currentPath) {
            this.currentPath = null;
            // Don't immediately take another action, just cancel the path
            return;
        }
        
        // Movement
        if (KEYS.UP.includes(key)) {
            actionTaken = this.tryMove(0, -1);
        } else if (KEYS.DOWN.includes(key)) {
            actionTaken = this.tryMove(0, 1);
        } else if (KEYS.LEFT.includes(key)) {
            actionTaken = this.tryMove(-1, 0);
        } else if (KEYS.RIGHT.includes(key)) {
            actionTaken = this.tryMove(1, 0);
        } else if (KEYS.UP_LEFT.includes(key)) {
            actionTaken = this.tryMove(-1, -1);
        } else if (KEYS.UP_RIGHT.includes(key)) {
            actionTaken = this.tryMove(1, -1);
        } else if (KEYS.DOWN_LEFT.includes(key)) {
            actionTaken = this.tryMove(-1, 1);
        } else if (KEYS.DOWN_RIGHT.includes(key)) {
            actionTaken = this.tryMove(1, 1);
        } 
        // Wait (skip turn)
        else if (KEYS.WAIT.includes(key)) {
            if (gameState.player.hasComponent('EnergyComponent')) {
                const energy = gameState.player.getComponent('EnergyComponent');
                
                // Spend less energy for waiting
                energy.spendEnergy('wait');
                gameState.addMessage("You wait and recover your strength.");
            }
            
            actionTaken = true;
        }
        // Open inventory
        else if (KEYS.INVENTORY.includes(key)) {
            gameState.gameMode = 'inventory';
            eventBus.emit('inventoryOpened');
            return;
        }
        // Open spellbook
        else if (KEYS.SPELLBOOK.includes(key)) {
            gameState.gameMode = 'spellbook';
            eventBus.emit('spellbookOpened');
            return;
        }
        // Open character screen
        else if (KEYS.CHARACTER.includes(key)) {
            gameState.gameMode = 'character';
            eventBus.emit('characterOpened');
            return;
        }
        // Use stairs
        else if (KEYS.USE_STAIRS.includes(key)) {
            actionTaken = this.tryUseStairs();
        }
        // Pickup item
        else if (KEYS.PICKUP.includes(key)) {
            actionTaken = this.tryPickupItem();
        }
        // Interact with NPCs or objects
        else if (KEYS.INTERACT.includes(key)) {
            actionTaken = this.tryInteract();
        }
        
        // If player took an action, process the turn
        if (actionTaken) {
            this.processTurn();
        }
    }
    
    handleInventoryInput(key) {
        // If ESC key or Inventory key again, close inventory
        if (key === 'Escape' || KEYS.INVENTORY.includes(key)) {
            gameState.gameMode = 'exploration';
            eventBus.emit('inventoryClosed');
            return;
        }
        
        // Emit the key event for the inventory UI to handle
        eventBus.emit('inventoryKeyPressed', key);
    }
    
    handleSpellbookInput(key) {
        // If ESC key or Spellbook key again, close spellbook
        if (key === 'Escape' || KEYS.SPELLBOOK.includes(key)) {
            gameState.gameMode = 'exploration';
            eventBus.emit('spellbookClosed');
            return;
        }
        
        // Emit the key event for the spellbook UI to handle
        eventBus.emit('spellbookKeyPressed', key);
    }
    
    handleCharacterInput(key) {
        // If ESC key or Character key again, close character screen
        if (key === 'Escape' || KEYS.CHARACTER.includes(key)) {
            gameState.gameMode = 'exploration';
            eventBus.emit('characterClosed');
            return;
        }
        
        // Emit the key event for the character UI to handle
        eventBus.emit('characterKeyPressed', key);
    }
    
    tryMove(dx, dy) {
        if (!gameState.player.position) return false;
        
        // Get player's energy component - we'll spend energy later if the action succeeds
        let energyComp = null;
        if (gameState.player.hasComponent('EnergyComponent')) {
            energyComp = gameState.player.getComponent('EnergyComponent');
        }
        
        const x = gameState.player.position.x;
        const y = gameState.player.position.y;
        const newX = x + dx;
        const newY = y + dy;
        
        // Check if the destination is walkable
        if (!gameState.map.isWalkable(newX, newY)) {
            return false;
        }
        
        // Check for entities at the destination
        const entities = gameState.getEntitiesAt(newX, newY);
        
        // Check for blocking entities (like NPCs or monsters)
        for (const entity of entities) {
            if (entity.hasComponent('BlocksMovementComponent')) {
                // Check if it's an NPC (has dialogue component)
                const isNPC = entity.hasComponent('DialogueComponent');
                
                // If entity is an NPC and not hostile, start dialogue
                if (isNPC && (!entity.hasComponent('AIComponent') || 
                    (entity.hasComponent('AIComponent') && 
                     entity.getComponent('AIComponent').state === 'idle'))) {
                    // Starting dialogue costs energy too (represents the time spent talking)
                    if (gameState.player.hasComponent('EnergyComponent')) {
                        const energy = gameState.player.getComponent('EnergyComponent');
                        energy.spendEnergy('move');
                    }
                    
                    // Start dialogue with this NPC
                    eventBus.emit('startDialogue', entity);
                    return true;
                }
                
                // If entity is AI-controlled and hostile, attack
                if (entity.hasComponent('AIComponent')) {
                    const ai = entity.getComponent('AIComponent');
                    
                    
                    // Only automatically attack if the AI is already hostile to player
                    if (ai.state === 'chase' || ai.state === 'enraged') {
                        // Try to attack if it's a combatant entity
                        if (entity.hasComponent('HealthComponent')) {
                            // Spend energy for the attack
                            if (gameState.player.hasComponent('EnergyComponent')) {
                                const energy = gameState.player.getComponent('EnergyComponent');
                                energy.spendEnergy('attack');
                            }
                            
                            this.attack(gameState.player, entity);
                            return true;
                        }
                    } else {
                        // For non-hostile AI, ask for confirmation before attacking
                        const confirmed = window.confirm(`Do you want to attack ${entity.name}? This might have serious consequences.`);
                        
                        if (!confirmed) {
                            // Player decided not to attack, but still spent some energy considering
                            if (gameState.player.hasComponent('EnergyComponent')) {
                                const energy = gameState.player.getComponent('EnergyComponent');
                                energy.spendEnergy('wait'); // Use less energy for just thinking about it
                            }
                            
                            gameState.addMessage(`You decide not to attack ${entity.name}.`);
                            return true; // Turn is spent reconsidering
                        }
                        
                        // If confirmed, proceed with attack and spend energy
                        if (gameState.player.hasComponent('EnergyComponent')) {
                            const energy = gameState.player.getComponent('EnergyComponent');
                            energy.spendEnergy('attack');
                        }
                        
                        gameState.addMessage(`You attack ${entity.name}!`, 'danger');
                        if (entity.hasComponent('HealthComponent')) {
                            this.attack(gameState.player, entity);
                            return true;
                        }
                    }
                } else {
                    // For entities without AI but with health (like static enemies)
                    if (entity.hasComponent('HealthComponent')) {
                        // Spend energy for the attack
                        if (gameState.player.hasComponent('EnergyComponent')) {
                            const energy = gameState.player.getComponent('EnergyComponent');
                            energy.spendEnergy('attack');
                        }
                        
                        this.attack(gameState.player, entity);
                        return true;
                    }
                }
                
                return false;
            }
        }
        
        // Spend energy for movement
        if (gameState.player.hasComponent('EnergyComponent')) {
            const energy = gameState.player.getComponent('EnergyComponent');
            energy.spendEnergy('move');
        }
        
        // Move the player
        gameState.player.position.moveTo(newX, newY);
        
        // Update FOV after movement
        eventBus.emit('playerMoved', { x: newX, y: newY });
        
        return true;
    }
    
    attack(attacker, defender) {
        // Skip if either entity is missing required components
        if (!attacker.hasComponent('StatsComponent') || !defender.hasComponent('HealthComponent')) {
            return false;
        }
        
        const attackerStats = attacker.getComponent('StatsComponent');
        const defenderHealth = defender.getComponent('HealthComponent');
        const defenderStats = defender.getComponent('StatsComponent');
        
        // Check if attacker can hit the defender using accuracy and dodge
        let hitChance = attackerStats.accuracy || 70; // Default accuracy of 70%
        
        // Modify hit chance based on attacker's perception and defender's dexterity and DV
        if (defenderStats) {
            const attackerPerception = attackerStats.perception || 5;
            const defenderDV = defenderStats.dv || 0;
            
            // Adjust hit chance: +5% per point of perception
            hitChance += (attackerPerception - 5) * 5; // Bonus/penalty for perception
            
            // DV reduces hit chance significantly (complete dodge chance)
            // Each point of DV gives 5% chance to completely dodge
            hitChance -= defenderDV * 5; 
            
            // Ensure hit chance is within reasonable bounds (5% minimum, 95% maximum)
            hitChance = Math.max(5, Math.min(95, hitChance));
        }
        
        // Roll to see if the attack hits (DV-based dodge)
        const hitRoll = Math.random() * 100;
        const hits = hitRoll <= hitChance;
        
        // Handle complete miss from DV (dodge)
        if (!hits) {
            // Special dodge message to differentiate from normal miss
            if (defenderStats && defenderStats.dv > 0) {
                gameState.addMessage(`${defender.name} dodges ${attacker.name}'s attack!`);
            } else {
                gameState.addMessage(`${attacker.name} misses ${defender.name}!`);
            }
            return true; // Attack was attempted, even if it missed
        }
        
        // Calculate base damage from strength
        let damage = attackerStats.strength;
        
        // Add weapon damage if equipped
        if (attacker.hasComponent('EquipmentComponent')) {
            const equipment = attacker.getComponent('EquipmentComponent');
            const weapon = equipment.slots.weapon;
            
            if (weapon) {
                const equippable = weapon.getComponent('EquippableComponent');
                if (equippable && equippable.statModifiers.damage) {
                    damage += equippable.statModifiers.damage;
                }
            }
        }
        
        // Apply randomization to damage (±20%)
        const variance = 0.2;
        const multiplier = 1 + (Math.random() * variance * 2 - variance);
        damage = Math.floor(damage * multiplier);
        
        // Reduce damage by defender's protection value (PV) - primary defense mechanic
        if (defenderStats && defenderStats.pv) {
            const damageReduction = defenderStats.pv;
            const originalDamage = damage;
            damage = Math.max(1, damage - damageReduction);
            
            // Show message about damage reduction if significant
            if (damageReduction >= 3 && originalDamage > damage + 2) {
                gameState.addMessage(`${defender.name}'s armor absorbs ${damageReduction} damage!`);
            }
        }
        
        // Apply legacy defense as a secondary damage reduction
        if (defenderStats) {
            damage = Math.max(1, damage - defenderStats.defense);
        }
        
        // Check if attacking an NPC in town
        const isNPC = defender.hasComponent('DialogueComponent');
        
        // Determine if we're in town (this is a simplified check)
        const inTown = gameState.location === 'town';
        
        // Check if defender is immortal (like training dummy)
        const isImmortal = defenderHealth.immortal;
        
        // Add special warning when attacking NPCs in town (except for immortal training dummies)
        if (isNPC && inTown && attacker === gameState.player && !isImmortal) {
            gameState.addMessage(`WARNING: You're attacking ${defender.name}! This may have consequences.`, 'danger');
            
            // Activate NPC's AI if they have one
            if (defender.hasComponent('AIComponent')) {
                const npcAI = defender.getComponent('AIComponent');
                
                // Set NPC to combat mode
                npcAI.state = 'enraged';
                npcAI.target = gameState.player;
                
                // NPCs with high intelligence can cast spells as immediate retaliation
                if (defender.hasComponent('StatsComponent') && 
                    defender.hasComponent('ManaComponent')) {
                    
                    const npcStats = defender.getComponent('StatsComponent');
                    const npcMana = defender.getComponent('ManaComponent');
                    
                    // Check if NPC has decent intelligence and mana for spellcasting
                    if (npcStats.intelligence >= 5 && npcMana.mana >= 10) {
                        // Determine spell power based on NPC's intelligence
                        const intelligence = npcStats.intelligence;
                        const spellDamage = Math.floor(intelligence * 1.5) + 5;
                        
                        // Cast a spell based on NPC's intelligence
                        gameState.addMessage(`${defender.name}'s eyes flash with anger!`, 'danger');
                        
                        // NPCs with higher intelligence cast more powerful spells
                        if (intelligence >= 10) {
                            gameState.addMessage(`${defender.name} raises their hands and unleashes arcane energy!`, 'danger');
                            
                            // Deal damage to player
                            const playerHealth = gameState.player.getComponent('HealthComponent');
                            if (playerHealth) {
                                // Use player's DV to determine if they can dodge
                                const playerStats = gameState.player.getComponent('StatsComponent');
                                const playerDV = playerStats ? playerStats.dv : 0;
                                
                                // Roll to see if player can dodge - 5% per point of DV
                                const dodgeChance = Math.min(75, playerDV * 5);
                                const dodgeRoll = Math.random() * 100;
                                const completelyDodged = dodgeRoll <= dodgeChance / 2;  // Half chance for complete dodge
                                const partiallyDodged = !completelyDodged && dodgeRoll <= dodgeChance;
                                
                                // Complete dodge (high DV can fully negate damage)
                                if (completelyDodged) {
                                    gameState.addMessage(`You completely dodge ${defender.name}'s magical attack!`, 'success');
                                    return true;
                                }
                                // Partial dodge (reduced damage)
                                else if (partiallyDodged) {
                                    const actualDamage = Math.floor(spellDamage / 2);
                                    gameState.addMessage("You partially dodge the magical attack!", 'info');
                                    
                                    // Apply damage with PV reduction from armor
                                    const damageResult = playerHealth.takeDamage(actualDamage);
                                    gameState.addMessage(`You take ${damageResult.damage} damage from ${defender.name}'s spell!`, 'danger');
                                }
                                // No dodge (full damage)
                                else {
                                    // Apply damage with PV reduction from armor
                                    const damageResult = playerHealth.takeDamage(spellDamage);
                                    gameState.addMessage(`You take ${damageResult.damage} damage from ${defender.name}'s spell!`, 'danger');
                                    
                                    // Show damage absorption message if significant
                                    if (playerStats && playerStats.pv > 0 && damageResult.reduction > 2) {
                                        gameState.addMessage(`Your armor absorbs ${damageResult.reduction} magical damage!`);
                                    }
                                }
                                
                                // Use some of NPC's mana
                                npcMana.useMana(10);
                            }
                        } else {
                            // Lower intelligence NPCs just make threatening gestures but don't cast yet
                            gameState.addMessage(`${defender.name} takes a defensive stance, ready to fight back!`, 'danger');
                        }
                    }
                }
            }
        }
        
        // Apply damage
        const result = defenderHealth.takeDamage(damage);
        const isDead = result.isDead || false;
        const actualDamage = result.damage || damage;
        
        // Log the attack with actual damage after reductions
        gameState.addMessage(`${attacker.name} attacks ${defender.name} for ${actualDamage} damage!`);
        
        // If significant damage was absorbed by PV, show damage reduction message
        if (defenderStats && defenderStats.pv > 0 && result.reduction && result.reduction > 2) {
            gameState.addMessage(`${defender.name}'s armor absorbs ${result.reduction} damage!`);
        }
        
        // Special message for immortal entities like training dummies
        if (isImmortal) {
            gameState.addMessage(`${defender.name} takes the hit but remains standing.`);
            return true;
        }
        
        // Check if defender died
        if (isDead) {
            // Special death message for NPCs
            if (isNPC) {
                gameState.addMessage(`${defender.name} has been killed!`, 'important');
                
                // Special consequences for killing town NPCs
                if (inTown) {
                    gameState.addMessage("The townsfolk will remember this...", 'danger');
                }
            } else {
                // Regular monster death
                gameState.addMessage(`${defender.name} dies!`);
            }
            
            // Award experience to player if they killed a monster or NPC
            if (attacker === gameState.player && defenderStats) {
                const xpGained = defenderStats.level * 10;
                const playerStats = attacker.getComponent('StatsComponent');
                
                if (playerStats) {
                    const didLevelUp = playerStats.addXp(xpGained);
                    gameState.addMessage(`You gain ${xpGained} XP.`);
                    
                    if (didLevelUp) {
                        gameState.addMessage(`You advance to level ${playerStats.level}!`, 'important');
                    }
                }
                
                // Increase score
                gameState.score += xpGained;
            }
            
            // Remove the dead entity
            gameState.removeEntity(defender.id);
        }
        
        return true;
    }
    
    tryUseStairs() {
        const { x, y } = gameState.player.position;
        const tile = gameState.map.getTile(x, y);
        
        if (tile) {
            // Handle different transition types
            if (tile.type === TILE_TYPES.STAIRS_DOWN || tile.type === TILE_TYPES.DUNGEON_ENTRANCE) {
                eventBus.emit('useStairs');
                
                if (tile.type === TILE_TYPES.DUNGEON_ENTRANCE) {
                    gameState.addMessage("You enter the dungeon...", "important");
                } else {
                    // Use default message for stairs
                    gameState.addMessage("You descend deeper into the dungeon...", "important");
                }
                
                return true;
            }
            else if (tile.type === TILE_TYPES.STAIRS_UP) {
                eventBus.emit('useStairs');
                
                if (gameState.currentLevel === 1) {
                    gameState.addMessage("You return to town...", "important");
                } else {
                    gameState.addMessage("You ascend to the previous level...", "important");
                }
                
                return true;
            } 
            else if (tile.type === TILE_TYPES.AREA_EXIT) {
                // Handle area transitions
                eventBus.emit('useStairs');
                
                if (tile.exitInfo && tile.exitInfo.name) {
                    gameState.addMessage(`You travel to ${tile.exitInfo.name}...`, "important");
                } else {
                    gameState.addMessage("You travel to a new area...", "important");
                }
                
                return true;
            }
        }
        
        gameState.addMessage("There is no entrance or exit here.");
        return false;
    }
    
    tryPickupItem() {
        if (!gameState.player.hasComponent('InventoryComponent')) {
            gameState.addMessage("You can't pick up items.");
            return false;
        }
        
        const { x, y } = gameState.player.position;
        const entities = gameState.getEntitiesAt(x, y);
        
        // Find items at this position
        const items = entities.filter(entity => entity.hasComponent('ItemComponent'));
        
        if (items.length === 0) {
            gameState.addMessage("There's nothing here to pick up.");
            return false;
        }
        
        // Get the first item (could implement a menu for multiple items later)
        const item = items[0];
        const playerInventory = gameState.player.getComponent('InventoryComponent');
        
        if (playerInventory.isFull) {
            gameState.addMessage("Your inventory is full.");
            return false;
        }
        
        // Add to inventory and remove from map
        if (playerInventory.addItem(item)) {
            gameState.removeEntity(item.id);
            gameState.addMessage(`You pick up the ${item.name}.`);
            return true;
        }
        
        return false;
    }
    
    processTurn() {
        // Increment turn counter
        gameState.turn++;
        
        // Process player-specific turn logic
        this.processPlayerTurn();
        
        // Process entity turn logic
        this.processEntityTurns();
        
        // Update FOV after everyone has moved
        eventBus.emit('turnProcessed');
        
        // Force re-render
        eventBus.emit('fovUpdated');
    }
    
    processPlayerTurn() {
        // Player-specific turn logic
    }
    
    processEntityTurns() {
        // Get all entities with AI components
        const entities = gameState.getEntitiesWithComponents('AIComponent');
        
        for (const entity of entities) {
            const ai = entity.getComponent('AIComponent');
            
            // First check if this is a special stationary ally like a hydra
            // that should be handled by allyLogic
            const isHandledByAllyLogic = allyLogic.handleAllyTurn(entity);
            
            // If not handled by allyLogic, use regular AI
            if (!isHandledByAllyLogic) {
                // Update AI state and decision making
                this.updateAI(entity, ai);
                
                // Execute the AI's chosen action
                ai.takeTurn();
            }
        }
    }
    
    tryInteract() {
        if (!gameState.player || !gameState.player.position) return false;
        
        const { x, y } = gameState.player.position;
        
        console.log("InputSystem: tryInteract at position", x, y);
        
        // Check for NPCs in adjacent tiles
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                // Skip the player's position
                if (dx === 0 && dy === 0) continue;
                
                const nx = x + dx;
                const ny = y + dy;
                
                // Get entities at this position
                const entities = gameState.getEntitiesAt(nx, ny);
                console.log(`InputSystem: Checking entities at (${nx}, ${ny}):`, entities.map(e => e.name));
                
                // Find NPCs (entities with DialogueComponent)
                for (const entity of entities) {
                    if (entity.hasComponent('DialogueComponent')) {
                        const dialogue = entity.getComponent('DialogueComponent');
                        console.log(`InputSystem: Found NPC ${entity.name}, isShopkeeper:`, dialogue.isShopkeeper);
                        
                        // If it's a shopkeeper, always talk to them
                        if (dialogue.isShopkeeper) {
                            console.log(`InputSystem: Starting dialogue with shopkeeper ${entity.name}`);
                            eventBus.emit('startDialogue', entity);
                            return true;
                        }
                        
                        // Check if the NPC has completed their dialogue recently
                        if (dialogue.hasCompletedDialogue && !dialogue.canTalkAgain()) {
                            // NPC doesn't want to talk again yet
                            gameState.addMessage(`${entity.name} has nothing more to say right now.`);
                            return true;
                        }
                        
                        // Start dialogue with this NPC
                        console.log(`InputSystem: Starting dialogue with NPC ${entity.name}`);
                        eventBus.emit('startDialogue', entity);
                        return true;
                    }
                }
            }
        }
        
        gameState.addMessage("There's nothing to interact with nearby.");
        return false;
    }
    
    updateAI(entity, ai) {
        // Skip if entity is missing required components
        if (!entity.hasComponent('PositionComponent')) return;
        
        const pos = entity.getComponent('PositionComponent');
        
        // Check if entity is an NPC or monster
        const isNPC = entity.hasComponent('DialogueComponent');
        
        // For NPCs in idle state, don't do anything aggressive
        if (isNPC && ai.state === 'idle') {
            return;
        }
        
        // Handle combat-capable NPCs or monsters
        if (!ai.target && gameState.player) {
            const playerPos = gameState.player.position;
            const dx = Math.abs(playerPos.x - pos.x);
            const dy = Math.abs(playerPos.y - pos.y);
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // Awareness radius - entities detect the player when close or in line of sight
            const awarenessRadius = isNPC ? 5 : 8;
            
            // Within visibility range and has line of sight
            if (distance <= awarenessRadius && gameState.isTileVisible(pos.x, pos.y)) {
                // For NPCs that are initially peaceful, they need to be provoked first
                if (!isNPC || ai.state === 'enraged') {
                    ai.target = gameState.player;
                    ai.state = 'chase';
                }
            }
        }
        
        // Active combat behavior
        if (ai.target === gameState.player && (ai.state === 'chase' || ai.state === 'enraged')) {
            const playerPos = gameState.player.position;
            const dx = Math.abs(playerPos.x - pos.x);
            const dy = Math.abs(playerPos.y - pos.y);
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // Check if entity can cast spells
            const canCastSpells = entity.hasComponent('StatsComponent') && 
                                 entity.hasComponent('ManaComponent');
            
            // Get stats and mana if available
            let intelligence = 0;
            let mana = null;
            
            if (canCastSpells) {
                intelligence = entity.getComponent('StatsComponent').intelligence;
                mana = entity.getComponent('ManaComponent');
            }
            
            // Spellcasting behavior for intelligent entities
            if (canCastSpells && intelligence >= 7 && mana.mana >= 10) {
                // Ideal distance for spellcasters
                const optimalDistance = 3;
                
                // Cast a spell every few turns
                if (gameState.turn % 3 === 0 && distance <= 5) {
                    const spellDamage = Math.floor(intelligence * 1.2);
                    
                    // Choose spell type based on intelligence and randomness
                    const spellRoll = Math.random();
                    
                    if (spellRoll < 0.4) {
                        // Fire spell
                        gameState.addMessage(`${entity.name} casts a fire spell at you!`, 'danger');
                        gameState.player.getComponent('HealthComponent').takeDamage(spellDamage);
                        gameState.addMessage(`You take ${spellDamage} fire damage!`, 'danger');
                    } 
                    else if (spellRoll < 0.7) {
                        // Ice/cold spell
                        gameState.addMessage(`${entity.name} casts a frost spell!`, 'danger');
                        gameState.player.getComponent('HealthComponent').takeDamage(spellDamage - 2);
                        gameState.addMessage(`You take ${spellDamage - 2} cold damage and feel slowed!`, 'danger');
                    } 
                    else {
                        // Lightning/arcane spell (more powerful)
                        gameState.addMessage(`${entity.name} casts an arcane bolt!`, 'danger');
                        gameState.player.getComponent('HealthComponent').takeDamage(spellDamage + 3);
                        gameState.addMessage(`You take ${spellDamage + 3} arcane damage!`, 'danger');
                    }
                    
                    // Use mana
                    mana.useMana(10);
                    return;
                }
                
                // Move to maintain optimal casting distance
                if (distance < optimalDistance) {
                    // Move away from player to maintain range
                    const dx = Math.sign(pos.x - playerPos.x);
                    const dy = Math.sign(pos.y - playerPos.y);
                    
                    const newX = pos.x + dx;
                    const newY = pos.y + dy;
                    
                    if (gameState.map.isWalkable(newX, newY)) {
                        const entitiesAtDest = gameState.getEntitiesAt(newX, newY);
                        const blockers = entitiesAtDest.filter(e => 
                            e.hasComponent('BlocksMovementComponent'));
                        
                        if (blockers.length === 0) {
                            pos.moveTo(newX, newY);
                        }
                    }
                } 
                else if (distance > optimalDistance + 2) {
                    // Move closer to get in spell range
                    const dx = Math.sign(playerPos.x - pos.x);
                    const dy = Math.sign(playerPos.y - pos.y);
                    
                    const newX = pos.x + dx;
                    const newY = pos.y + dy;
                    
                    if (gameState.map.isWalkable(newX, newY)) {
                        const entitiesAtDest = gameState.getEntitiesAt(newX, newY);
                        const blockers = entitiesAtDest.filter(e => 
                            e.hasComponent('BlocksMovementComponent'));
                        
                        if (blockers.length === 0) {
                            pos.moveTo(newX, newY);
                        }
                    }
                }
            } 
            else {
                // Melee fighter behavior - move toward player to attack
                // Check if adjacent to player
                if (Math.abs(playerPos.x - pos.x) <= 1 && Math.abs(playerPos.y - pos.y) <= 1) {
                    // Attack player
                    this.attack(entity, gameState.player);
                } else {
                    // Try to move towards player
                    const dx = Math.sign(playerPos.x - pos.x);
                    const dy = Math.sign(playerPos.y - pos.y);
                    
                    const newX = pos.x + dx;
                    const newY = pos.y + dy;
                    
                    if (gameState.map.isWalkable(newX, newY)) {
                        // Check if there's an entity blocking the way
                        const entitiesAtDest = gameState.getEntitiesAt(newX, newY);
                        const blockers = entitiesAtDest.filter(e => 
                            e.hasComponent('BlocksMovementComponent'));
                        
                        if (blockers.length === 0) {
                            pos.moveTo(newX, newY);
                        }
                    }
                }
            }
        }
    }
}

export default InputSystem;