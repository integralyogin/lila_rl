import gameState from '../core/gameState.js';
import eventBus from '../core/eventEmitter.js';
import { targetingSystem } from './targetingSystem.js';
import tooltipSystem from '../ui/tooltipSystem.js'; 
import contextMenuUI from '../ui/contextMenuUI.js';
import pathfindingSystem from './pathfindingSystem.js';
import { TILE_TYPES } from '../constants.js';
import { getEntityArray, getEntitiesAtPosition } from '../utils/entityUtils.js';
import combatSystem from './combatSystem.js';

/**
 * MouseSystem - Handles all mouse interaction with the game world
 * Combines functionality from the original InputSystem and MouseHandler
 * to provide a unified interface for all mouse events.
 */
class MouseSystem {
    constructor() {
        this.boundHandleClick = this.handleClick.bind(this);
        this.boundHandleContextMenu = this.handleContextMenu.bind(this);
        this.boundHandleMouseMove = this.handleMouseMove.bind(this);
        
        // Add mouse event listeners
        document.addEventListener('click', this.boundHandleClick);
        document.addEventListener('contextmenu', this.boundHandleContextMenu);
        document.addEventListener('mousemove', this.boundHandleMouseMove);
        
        // Set up tooltip mouseleave handler
        const setupMapLeaveHandler = () => {
            const gameMap = document.getElementById('game-map');
            if (gameMap) {
                console.log("Adding mouseleave event to game map");
                gameMap.addEventListener('mouseleave', () => {
                    console.log("Mouse left game map, hiding tooltip");
                    tooltipSystem.handleMouseLeave();
                });
            } else {
                console.log("Game map not found, will try again later");
                // Try again after a short delay if map isn't ready
                setTimeout(setupMapLeaveHandler, 500);
            }
        };
        
        // Set up event handler to hide tooltip when mouse leaves the map
        // Run this on a slight delay to make sure DOM is fully loaded
        setTimeout(setupMapLeaveHandler, 100);
    }
    
    /**
     * Clean up event listeners when system is destroyed
     */
    shutdown() {
        document.removeEventListener('click', this.boundHandleClick);
        document.removeEventListener('contextmenu', this.boundHandleContextMenu);
        document.removeEventListener('mousemove', this.boundHandleMouseMove);
        
        const gameMap = document.getElementById('game-map');
        if (gameMap) {
            gameMap.removeEventListener('mouseleave', () => tooltipSystem.handleMouseLeave());
        }
    }
    
    /**
     * Handle mouse click events
     * @param {MouseEvent} event - The click event
     */
    handleClick(event) {
        // Ignore clicks if there's no player
        if (!gameState.player) return;
        
        // Enhanced debugging for shop issue
        console.log(`Click detected at (${event.clientX}, ${event.clientY}), game mode: ${gameState.gameMode}`);
        console.log(`Click target:`, event.target);
        
        // Special case for UI elements that should always intercept clicks regardless of game mode
        // This prevents clicks from bleeding through to the game map
        
        // SHOP UI: Special check with extra logging
        const shopUI = document.getElementById('shop-ui');
        if (shopUI) {
            console.log(`Shop UI display: ${shopUI.style.display}, visible: ${shopUI.style.display !== 'none'}`);
            const shopRect = shopUI.getBoundingClientRect();
            console.log(`Shop UI rect: left=${shopRect.left}, top=${shopRect.top}, right=${shopRect.right}, bottom=${shopRect.bottom}`);
            
            if (shopUI.style.display !== 'none') {
                // Additional check: is point inside rectangle?
                const isPointInShop = event.clientX >= shopRect.left && 
                                    event.clientX <= shopRect.right && 
                                    event.clientY >= shopRect.top && 
                                    event.clientY <= shopRect.bottom;
                                    
                console.log(`Is click point in shop rect: ${isPointInShop}`);
                                    
                // Force shop handling if we're in shop mode or if point is in shop rect
                if (gameState.gameMode === 'shop' || shopUI.contains(event.target) || isPointInShop) {
                    console.log("Forcing shop click handler");
                    this.handleShopClick(event);
                    return;
                }
            }
        }
        
        // Check for spellbook UI clicks
        const spellbookUI = document.getElementById('spellbook-ui');
        if (spellbookUI && spellbookUI.style.display !== 'none' && spellbookUI.contains(event.target)) {
            console.log("Click detected inside spellbook UI, forcing spellbook mode handling");
            this.handleSpellbookClick(event);
            return;
        }
        
        // Check for inventory UI clicks
        const inventoryUI = document.getElementById('inventory-ui');
        if (inventoryUI && inventoryUI.style.display !== 'none' && inventoryUI.contains(event.target)) {
            console.log("Click detected inside inventory UI, forcing inventory mode handling");
            this.handleInventoryClick(event);
            return;
        }
        
        // Check for character UI clicks
        const characterUI = document.getElementById('character-ui');
        if (characterUI && characterUI.style.display !== 'none' && characterUI.contains(event.target)) {
            console.log("Click detected inside character UI, forcing character mode handling");
            this.handleCharacterClick(event);
            return;
        }
        
        // Check for dialogue UI clicks
        const dialogueUI = document.getElementById('dialogue-ui');
        if (dialogueUI && dialogueUI.style.display !== 'none' && dialogueUI.contains(event.target)) {
            console.log("Click detected inside dialogue UI, forcing dialogue mode handling");
            this.handleDialogueClick(event);
            return;
        }
        
        // Handle UI clicks based on game mode
        switch (gameState.gameMode) {
            case 'inventory':
                this.handleInventoryClick(event);
                break;
            case 'spellbook':
                this.handleSpellbookClick(event);
                break;
            case 'character':
                this.handleCharacterClick(event);
                break;
            case 'targeting':
                this.handleTargetingClick(event);
                break;
            case 'shop':
                // Handle shop UI clicks - prevent map interaction
                this.handleShopClick(event);
                break;
            case 'dialogue':
                // Handle dialogue UI clicks - prevent map interaction
                this.handleDialogueClick(event);
                break;
            case 'arena_selection':
                // Handle arena selection UI clicks - prevent map interaction
                this.handleArenaSelectionClick(event);
                break;
            case 'summoning_selection':
                // Handle summoning selection UI clicks - prevent map interaction
                this.handleSummoningSelectionClick(event);
                break;
            case 'arena':
                // Handle arena mode clicks - prevent map interaction
                event.preventDefault();
                event.stopPropagation();
                break;
            case 'exploration':
                this.handleExplorationClick(event);
                break;
            default:
                // No special handling for other modes
                break;
        }
    }
    
    /**
     * Handle right-click (context menu) events
     * @param {MouseEvent} event - The context menu event
     */
    handleContextMenu(event) {
        // Always prevent the default context menu
        event.preventDefault();
        
        // Use stopPropagation to prevent document click handlers from firing
        event.stopPropagation();
        
        // Ignore if there's no player
        if (!gameState.player) return;
        
        console.log(`Right-click detected, game mode: ${gameState.gameMode}`);
        
        // For shop, dialogue, arena, summoning modes, completely block all right-click actions
        if (gameState.gameMode === 'shop' || gameState.gameMode === 'dialogue' || 
            gameState.gameMode === 'arena' || gameState.gameMode === 'arena_selection' ||
            gameState.gameMode === 'summoning_selection') {
            console.log(`Completely blocking right-click in ${gameState.gameMode} mode`);
            return; // Do nothing, just block the event
        }
        
        // Cancel path following if active
        if (pathfindingSystem.isFollowingPath()) {
            pathfindingSystem.cancelPathFollowing("Path following canceled by right-click");
            return;
        }
        
        // Handle right-click for different game modes
        switch (gameState.gameMode) {
            case 'exploration':
                // Get the clicked position
                const tilePos = tooltipSystem.getTileFromMouseEvent(event);
                if (!tilePos) return;
                
                // Get the player position
                const playerX = Math.floor(gameState.player.position.x);
                const playerY = Math.floor(gameState.player.position.y);
                
                // Check if right-clicked on player
                if (tilePos.x === playerX && tilePos.y === playerY) {
                    this.showPlayerContextMenu(event);
                    return;
                }
                
                // Get entities at click position
                const clickedEntities = getEntitiesAtPosition(tilePos.x, tilePos.y);
                
                // Check for entities that can have context menus
                const clickableEntity = clickedEntities.find(e => e.blockMovement) || 
                                     clickedEntities.find(e => e.getComponent('DialogueComponent')) ||
                                     clickedEntities.find(e => e.getComponent('ItemComponent'));
                
                if (clickableEntity) {
                    this.showEntityContextMenu(event, clickableEntity, tilePos);
                }
                break;
                
            case 'inventory':
                // Future: Show context menu for inventory items
                break;
                
            case 'spellbook':
                // Future: Show context menu for spells
                break;
                
            case 'targeting':
                // Cancel targeting with right-click
                targetingSystem.cancelTargeting();
                break;
                
            default:
                // No special handling for other modes
                break;
        }
    }
    
    /**
     * Show a context menu for the player
     * @param {MouseEvent} event - The right-click event
     */
    showPlayerContextMenu(event) {
        console.log("Showing player context menu");
        
        // Define menu items for player
        const menuItems = [
            {
                label: "Character",
                key: "c",
                action: () => {
                    console.log("Opening character screen from context menu");
                    setTimeout(() => {
                        gameState.gameMode = 'character';
                        eventBus.emit('openCharacterScreen');
                        eventBus.emit('characterOpened');
                    }, 50);
                }
            },
            {
                label: "Inventory",
                key: "i",
                action: () => {
                    console.log("Opening inventory from context menu");
                    setTimeout(() => {
                        gameState.gameMode = 'inventory';
                        eventBus.emit('openInventory');
                        eventBus.emit('inventoryOpened');
                    }, 50);
                }
            },
            {
                label: "Spellbook",
                key: "b",
                action: () => {
                    console.log("Opening spellbook from context menu");
                    setTimeout(() => {
                        gameState.gameMode = 'spellbook';
                        eventBus.emit('openSpellbook');
                        eventBus.emit('spellbookOpened');
                    }, 50);
                }
            },
            {
                separator: true
            },
            {
                label: "Wait",
                key: ".",
                action: () => {
                    console.log("Wait a turn from context menu");
                    setTimeout(() => {
                        eventBus.emit('turnProcessed');
                    }, 50);
                }
            },
            {
                label: "Pick Up Item",
                key: "g",
                action: () => {
                    console.log("Picking up item from context menu");
                    setTimeout(() => {
                        const x = gameState.player.position.x;
                        const y = gameState.player.position.y;
                        eventBus.emit('pickupItem', { x, y });
                    }, 50);
                }
            }
        ];
        
        // Check if player is on stairs to add a stairs option
        const playerX = Math.floor(gameState.player.position.x);
        const playerY = Math.floor(gameState.player.position.y);
        const tile = gameState.map.getTile(playerX, playerY);
        
        if (tile && (tile.type === TILE_TYPES.STAIRS_DOWN || 
                   tile.type === TILE_TYPES.STAIRS_UP || 
                   tile.type === TILE_TYPES.AREA_EXIT ||
                   tile.type === TILE_TYPES.DUNGEON_ENTRANCE)) {
            
            let stairsLabel = "Use Stairs";
            if (tile.type === TILE_TYPES.STAIRS_DOWN) stairsLabel = "Descend Stairs";
            if (tile.type === TILE_TYPES.STAIRS_UP) stairsLabel = "Ascend Stairs";
            if (tile.type === TILE_TYPES.AREA_EXIT) stairsLabel = `Exit to ${tile.exitInfo?.name || 'another area'}`;
            if (tile.type === TILE_TYPES.DUNGEON_ENTRANCE) stairsLabel = "Enter Dungeon";
            
            // Insert at the top of the menu
            menuItems.unshift({
                label: stairsLabel,
                key: ">",
                action: () => {
                    console.log("Using stairs from context menu");
                    setTimeout(() => {
                        eventBus.emit('useStairs');
                    }, 50);
                }
            });
        }
        
        // Show the context menu
        eventBus.emit('showContextMenu', {
            x: event.clientX,
            y: event.clientY,
            target: gameState.player,
            items: menuItems
        });
    }
    
    /**
     * Show a context menu for an entity
     * @param {MouseEvent} event - The right-click event
     * @param {Object} entity - The entity to show menu for
     * @param {Object} tilePos - The position of the entity
     */
    showEntityContextMenu(event, entity, tilePos) {
        console.log(`Showing context menu for ${entity.name}`);
        
        const menuItems = [];
        
        // Check what type of entity this is and add relevant options
        
        // For NPCs with dialogue
        if (entity.getComponent('DialogueComponent')) {
            menuItems.push({
                label: `Talk to ${entity.name}`,
                key: "t",
                action: () => {
                    console.log(`Talking to ${entity.name} from context menu`);
                    
                    // Need to add a slight delay to make sure any other click handlers
                    // have finished before we open dialogue
                    setTimeout(() => {
                        gameState.gameMode = 'dialogue';
                        gameState.currentDialogue = {
                            npc: entity,
                            dialogueState: 'start'
                        };
                        eventBus.emit('startDialogue', entity);
                    }, 50);
                }
            });
        }
        
        // For items
        if (entity.getComponent('ItemComponent')) {
            menuItems.push({
                label: `Pick up ${entity.name}`,
                key: "g",
                action: () => {
                    console.log(`Picking up ${entity.name} from context menu`);
                    setTimeout(() => {
                        eventBus.emit('pickupItem', { 
                            x: tilePos.x, 
                            y: tilePos.y, 
                            item: entity 
                        });
                    }, 50);
                }
            });
        }
        
        // For enemies
        const aiComponent = entity.getComponent('AIComponent');
        if (entity.blockMovement && aiComponent && aiComponent.faction !== 'ally') {
            menuItems.push({
                label: `Attack ${entity.name}`,
                action: () => {
                    console.log(`Attacking ${entity.name} from context menu`);
                    setTimeout(() => {
                        if (combatSystem.attack(tilePos.x, tilePos.y)) {
                            eventBus.emit('turnProcessed');
                        }
                    }, 50);
                }
            });
        }
        
        // Only show menu if we have items
        if (menuItems.length > 0) {
            eventBus.emit('showContextMenu', {
                x: event.clientX,
                y: event.clientY,
                target: entity,
                items: menuItems
            });
        }
    }
    
    /**
     * Handle mouse movement
     * @param {MouseEvent} event - The mouse move event
     */
    handleMouseMove(event) {
        tooltipSystem.handleMouseMove(event);
        
        // If in targeting mode, update targeting highlight
        if (targetingSystem.isTargetingActive()) {
            const tile = tooltipSystem.getTileFromMouseEvent(event);
            if (tile) {
                targetingSystem.updateTargetingHighlight(tile);
            }
        }
    }
    
    /**
     * Handle clicks during exploration mode
     * @param {MouseEvent} event - The click event
     */
    handleExplorationClick(event) {
        console.log("Click during exploration mode");
        
        // Determine pathfinding mode
        const usePathfinding = pathfindingSystem.isPathfindingEnabled();
        
        // Allow Shift+click to force opposite of current setting
        if (event.shiftKey) {
            console.log("Shift key detected, inverting pathfinding mode for this click");
            this.handleMovementClick(event, !usePathfinding);
        } else {
            this.handleMovementClick(event, usePathfinding);
        }
    }
    
    /**
     * Handle clicks during targeting mode
     * @param {MouseEvent} event - The click event
     */
    handleTargetingClick(event) {
        console.log("Click during targeting mode");
        
        // Stop propagation and prevent default to prevent the click from affecting the game map
        event.stopPropagation();
        event.preventDefault();
        
        const tile = tooltipSystem.getTileFromMouseEvent(event);
        if (tile) {
            targetingSystem.selectTarget(tile);
        }
    }
    
    /**
     * Handle clicks on inventory UI
     * @param {MouseEvent} event - The click event
     */
    handleInventoryClick(event) {
        // Always prevent default and stop propagation to prevent clicks from affecting the game
        event.preventDefault();
        event.stopPropagation();
        
        // Check if click is outside inventory UI - if so, close inventory
        const inventoryUI = document.getElementById('inventory-ui');
        if (inventoryUI && !inventoryUI.contains(event.target)) {
            console.log("Click outside inventory UI detected, closing inventory");
            eventBus.emit('inventoryKeyPressed', 'Escape');
            gameState.gameMode = 'exploration'; // Force mode change
            eventBus.emit('inventoryClosed');
            return;
        }
        
        // Check if the click was on an inventory item
        const inventoryItem = event.target.closest('.inventory-item');
        if (inventoryItem) {
            // Find the item index
            const items = document.querySelectorAll('.inventory-item');
            const itemIndex = Array.from(items).indexOf(inventoryItem);
            
            console.log(`Inventory item clicked: ${itemIndex}`);
            
            // Emit an event to select this item
            eventBus.emit('inventoryKeyPressed', 'select-item');
            eventBus.emit('inventoryItemSelected', itemIndex);
        }
        
        // Check for action buttons
        if (event.target.matches('.inventory-action-use')) {
            eventBus.emit('inventoryKeyPressed', 'u');
        } else if (event.target.matches('.inventory-action-equip')) {
            eventBus.emit('inventoryKeyPressed', 'e');
        } else if (event.target.matches('.inventory-action-drop')) {
            eventBus.emit('inventoryKeyPressed', 'd');
        }
    }
    
    /**
     * Handle clicks on spellbook UI
     * @param {MouseEvent} event - The click event
     */
    handleSpellbookClick(event) {
        // Always prevent default to avoid interactions with game map
        event.preventDefault();
        event.stopPropagation();
        
        // Check if click is outside spellbook UI - if so, close spellbook
        const spellbookUI = document.getElementById('spellbook-ui');
        if (spellbookUI && !spellbookUI.contains(event.target)) {
            console.log("Click outside spellbook UI detected, closing spellbook");
            eventBus.emit('spellbookKeyPressed', 'Escape');
            gameState.gameMode = 'exploration'; // Force mode change
            eventBus.emit('spellbookClosed');
            return;
        }
        
        // Check if the click was on a spell
        const spellItem = event.target.closest('.spellbook-spell');
        if (spellItem) {
            // Find the spell index
            const spells = document.querySelectorAll('.spellbook-spell');
            const spellIndex = Array.from(spells).indexOf(spellItem);
            
            // Emit an event to select this spell
            eventBus.emit('spellbookKeyPressed', 'select-spell');
            eventBus.emit('spellbookSpellSelected', spellIndex);
        }
        
        // Check for cast button
        if (event.target.matches('.spellbook-action-cast')) {
            eventBus.emit('spellbookKeyPressed', 'c');
        }
    }
    
    /**
     * Handle clicks on character screen UI
     * @param {MouseEvent} event - The click event
     */
    handleCharacterClick(event) {
        // For now, just allow clicking outside to close
        if (!event.target.closest('.character-content') && 
            !event.target.closest('.character-header') &&
            !event.target.closest('.character-footer')) {
            eventBus.emit('characterKeyPressed', 'Escape');
        }
    }
    
    /**
     * Handle clicks on shop UI
     * @param {MouseEvent} event - The click event
     */
    handleShopClick(event) {
        // Completely block interaction with the game map when in shop mode
        console.log("Shop click detected at coordinates:", event.clientX, event.clientY);
        
        // Set the game mode to shop mode to ensure proper handling
        if (gameState.gameMode !== 'shop') {
            console.log("Setting game mode to shop for proper handling");
            gameState.gameMode = 'shop';
        }
        
        // Always prevent default and stop propagation to block any game map interaction
        event.preventDefault();
        event.stopPropagation();
        
        // Enhanced logging for shop click debugging
        console.log("Shop click target:", event.target);
        console.log("Shop click target tag:", event.target.tagName);
        console.log("Shop click target class:", event.target.className);
        console.log("Shop click target ID:", event.target.id);
        
        // Add a check for recently opened shop to avoid immediate closing
        // Get the current timestamp
        const currentTime = Date.now();
        
        // If the shop was opened less than 300ms ago, don't process outside clicks
        // This prevents the same click that closed the dialogue from closing the shop
        if (!window.lastShopOpenTime) {
            window.lastShopOpenTime = 0;
        }
        
        const timeSinceOpen = currentTime - window.lastShopOpenTime;
        console.log(`Time since shop opened: ${timeSinceOpen}ms`);
        
        // Check if click is outside shop UI - if so, close shop (but not if recently opened)
        const shopUI = document.getElementById('shop-ui');
        if (shopUI && !shopUI.contains(event.target) && timeSinceOpen > 300) {
            console.log("Click outside shop UI detected, closing shop");
            eventBus.emit('shopKeyPressed', 'Escape');
            gameState.gameMode = 'exploration'; // Force mode change
            eventBus.emit('shopClosed');
            return;
        }
        
        // Add item selection logic with enhanced checking
        // First check if the click is on a child of a shop item (like the name or price)
        const shopItem = event.target.closest('.shop-item');
        if (shopItem) {
            // Find the item index
            const items = document.querySelectorAll('.shop-item');
            const itemIndex = Array.from(items).indexOf(shopItem);
            
            console.log(`Shop item clicked, index: ${itemIndex}`);
            // Select the item and emit a selection event to notify the shop UI
            // IMPORTANT: Do not emit 'shopKeyPressed' with 'select-item' as it's not properly handled
            // Instead, directly use the shopItemSelected event which is properly connected to the selectItem method
            eventBus.emit('shopItemSelected', itemIndex);
            
            // Direct DOM update as fallback
            items.forEach((el, i) => {
                if (i === itemIndex) {
                    el.classList.add('selected');
                } else {
                    el.classList.remove('selected');
                }
            });
            
            // Force set selected index directly in the shop UI object
            if (window.game && window.game.shopUI) {
                window.game.shopUI.selectedIndex = itemIndex;
                console.log("Directly set shop UI selected index to", itemIndex);
            }
            
            return; // Prevent further processing
        }
        
        // Mode toggle buttons with enhanced checking
        if (event.target.matches('.mode-option.mode-buy') || event.target.closest('.mode-option.mode-buy')) {
            console.log("Buy mode selected");
            eventBus.emit('shopKeyPressed', 'b');
            return; // Prevent further processing
        } else if (event.target.matches('.mode-option.mode-sell') || event.target.closest('.mode-option.mode-sell')) {
            console.log("Sell mode selected");
            eventBus.emit('shopKeyPressed', 's');
            return; // Prevent further processing
        }
        
        // Handle buy/sell buttons if clicked with enhanced checking
        if (event.target.matches('.shop-action-button') || event.target.closest('.shop-action-button')) {
            console.log("Buy/Sell action button clicked via mouseSystem");
            
            // Get a reference to the shop UI
            if (window.game && window.game.shopUI) {
                // Execute the action directly on the shopUI object
                try {
                    if (window.game.shopUI.mode === 'buy') {
                        console.log("Executing buySelectedItem directly");
                        window.game.shopUI.buySelectedItem();
                    } else {
                        console.log("Executing sellSelectedItem directly");
                        window.game.shopUI.sellSelectedItem();
                    }
                } catch (error) {
                    console.error("Error executing shop action:", error);
                    // Fall back to event emission
                    eventBus.emit('shopKeyPressed', 'Enter');
                }
            } else {
                // Fall back to event emission if we can't access the shop UI directly
                eventBus.emit('shopKeyPressed', 'Enter');
            }
            
            return; // Prevent further processing
        }
        
        // Handle close button
        if (event.target.matches('.close-button') || event.target.closest('.close-button')) {
            console.log("Close button clicked");
            eventBus.emit('shopKeyPressed', 'Escape');
            return; // Prevent further processing
        }
        
        // If we got here, click was inside shop UI but not on a specific interactive element
        console.log("Click was inside shop UI but not on a specific interactive element");
    }
    
    /**
     * Handle clicks on dialogue UI
     * @param {MouseEvent} event - The click event
     */
    handleDialogueClick(event) {
        // Prevent the click from affecting the game world
        event.stopPropagation();
        
        // Check if click is outside dialogue UI - if so, close dialogue
        const dialogueUI = document.getElementById('dialogue-ui');
        if (dialogueUI && !dialogueUI.contains(event.target)) {
            console.log("Click outside dialogue UI detected, closing dialogue");
            eventBus.emit('dialogueKeyPressed', 'Escape');
            return;
        }
    }
    
    /**
     * Handle clicks on arena selection UI
     * @param {MouseEvent} event - The click event
     */
    handleArenaSelectionClick(event) {
        // Always prevent default and stop propagation
        event.preventDefault();
        event.stopPropagation();
        
        // Check if click is outside arena UI - if so, close arena UI
        const arenaUI = document.querySelector('.arena-ui');
        if (arenaUI && !arenaUI.contains(event.target)) {
            console.log("Click outside arena UI detected, closing arena");
            eventBus.emit('arenaClose');
            gameState.gameMode = 'exploration';
            return;
        }
        
        // All other click handling inside arena UI is managed by the UI itself
    }
    
    /**
     * Handle clicks on summoning selection UI
     * @param {MouseEvent} event - The click event
     */
    handleSummoningSelectionClick(event) {
        // Always prevent default and stop propagation
        event.preventDefault();
        event.stopPropagation();
        
        // Check if click is outside summoning UI - if so, close summoning UI
        const summoningUI = document.querySelector('.summoning-ui');
        if (summoningUI && !summoningUI.contains(event.target)) {
            console.log("Click outside summoning UI detected, closing summoning UI");
            eventBus.emit('summoningClose');
            gameState.gameMode = 'exploration';
            return;
        }
        
        // All other click handling inside summoning UI is managed by the UI itself
    }
    
    /**
     * Handle movement clicks on the map
     * @param {MouseEvent} event - The click event
     * @param {boolean} usePathfinding - Whether to use pathfinding
     * @returns {boolean} Whether the click was handled
     */
    handleMovementClick(event, usePathfinding = true) {
        // Only handle clicks in exploration mode
        if (gameState.gameMode !== 'exploration') return false;
        
        const tilePos = tooltipSystem.getTileFromMouseEvent(event);
        if (!tilePos) {
            console.log("Click detected but no valid tile found");
            return false;
        }
        
        // Ensure integer coordinates
        const x = Math.floor(tilePos.x);
        const y = Math.floor(tilePos.y);
        
        console.log(`Clicked on tile at (${x}, ${y}), pathfinding: ${usePathfinding}`);
        
        // Get player position for distance checks
        const playerX = Math.floor(gameState.player.position.x);
        const playerY = Math.floor(gameState.player.position.y);
        
        // Check if clicked on self
        const clickedSelf = playerX === x && playerY === y;
        
        // Check if adjacent to player
        const isAdjacent = Math.abs(playerX - x) <= 1 && Math.abs(playerY - y) <= 1;
        
        // Check for entities at the clicked position
        const clickedEntities = getEntitiesAtPosition(x, y);
        
        // Find the highest priority entity (obstacles, NPCs, items)
        const clickableEntity = clickedEntities.find(e => e.blockMovement) || 
                              clickedEntities.find(e => e.getComponent('DialogueComponent')) ||
                              clickedEntities.find(e => e.getComponent('ItemComponent'));
        
        // Check the tile type
        const mapTile = gameState.map.getTile(x, y);
        const isSpecialTile = mapTile && (
            mapTile.type === TILE_TYPES.STAIRS_DOWN || 
            mapTile.type === TILE_TYPES.STAIRS_UP || 
            mapTile.type === TILE_TYPES.AREA_EXIT ||
            mapTile.type === TILE_TYPES.DUNGEON_ENTRANCE
        );
        
        // Handle interactions based on position and entities
        
        // 1. Handle clicking on self (for stairs)
        if (clickedSelf && isSpecialTile) {
            console.log(`Special tile (${mapTile.type}) at player position. Attempting to use.`);
            eventBus.emit('useStairs');
            return true;
        }
        
        // 2. Handle adjacent interactions
        if (isAdjacent && !clickedSelf) {
            // 2a. Handle special tile interactions
            if (isSpecialTile) {
                console.log(`Player is adjacent to special tile (${mapTile.type}). Moving to ${x},${y}`);
                
                // Move player to the stairs position
                const moveX = x - playerX;
                const moveY = y - playerY;
                
                // Emit a move event
                eventBus.emit('movePlayer', { dx: moveX, dy: moveY });
                
                // After moving, emit the useStairs event on the next frame
                setTimeout(() => {
                    console.log("Player now on stairs, emitting useStairs event");
                    eventBus.emit('useStairs');
                }, 50);
                
                return true;
            }
            
            // 2b. Handle entity interactions when adjacent
            if (clickableEntity) {
                if (clickableEntity.blockMovement) {
                    // Attack if entity blocks movement and isn't friendly
                    const aiComponent = clickableEntity.getComponent('AIComponent');
                    if (aiComponent && aiComponent.faction !== 'ally') {
                        if (combatSystem.attack(x, y)) {
                            eventBus.emit('turnProcessed');
                            return true;
                        }
                    }
                } else if (clickableEntity.getComponent('DialogueComponent')) {
                    // Talk to NPC
                    gameState.gameMode = 'dialogue';
                    gameState.currentDialogue = {
                        npc: clickableEntity,
                        dialogueState: 'start'
                    };
                    
                    // Emit dialogue event
                    eventBus.emit('startDialogue', clickableEntity);
                    return true;
                } else if (clickableEntity.getComponent('ItemComponent')) {
                    // Emit an event to pick up the item
                    eventBus.emit('pickupItem', { x, y, item: clickableEntity });
                    return true;
                }
            }
        }
        
        // 3. Handle distant movement (pathfinding)
        console.log(`Attempting to move towards ${x},${y}`);
        
        // If pathfinding is enabled, use it
        if (usePathfinding) {
            // Start path movement with calculatePath - returns the first step
            const nextStep = pathfindingSystem.calculatePath(x, y);
            if (nextStep) {
                // Calculate the move direction for the first step
                const moveX = nextStep.x - playerX;
                const moveY = nextStep.y - playerY;
                
                // Emit a move event for the first step
                // The pathfindingSystem will handle subsequent steps
                eventBus.emit('movePlayer', { dx: moveX, dy: moveY });
                return true;
            }
        }
        
        // Fallback to direct movement if pathfinding fails or is disabled
        const movement = pathfindingSystem.calculateDirectMovement(x, y);
        eventBus.emit('movePlayer', { dx: movement.x, dy: movement.y });
        return true;
    }
}

// Export singleton instance
export default new MouseSystem();