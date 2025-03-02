import gameState from '../core/gameState.js';
import eventBus from '../core/eventEmitter.js';
import { targetingSystem } from './targetingSystem.js';
import tooltipSystem from '../ui/tooltipSystem.js'; 
import contextMenuUI from '../ui/contextMenuUI.js';
import dataViewerUI from '../ui/dataViewerUI.js';
import pathfindingSystem from './pathfindingSystem.js';
import { TILE_TYPES } from '../constants.js';
import { getEntityArray, getEntitiesAtPosition } from '../utils/entityUtils.js';
import combatSystem from './combatSystem.js';

class MouseSystem {
  constructor() {
    this.boundHandleClick = this.handleClick.bind(this);
    this.boundHandleContextMenu = this.handleContextMenu.bind(this);
    this.boundHandleMouseMove = this.handleMouseMove.bind(this);
    
    document.addEventListener('click', this.boundHandleClick);
    document.addEventListener('contextmenu', this.boundHandleContextMenu);
    document.addEventListener('mousemove', this.boundHandleMouseMove);
    
    const setupMapLeaveHandler = () => {
      const gameMap = document.getElementById('game-map');
      if (gameMap) {
        gameMap.addEventListener('mouseleave', () => {
          tooltipSystem.handleMouseLeave();
        });
      } else {
        setTimeout(setupMapLeaveHandler, 500);
      }
    };
    
    setTimeout(setupMapLeaveHandler, 100);
  }
  
  shutdown() {
    document.removeEventListener('click', this.boundHandleClick);
    document.removeEventListener('contextmenu', this.boundHandleContextMenu);
    document.removeEventListener('mousemove', this.boundHandleMouseMove);
    
    const gameMap = document.getElementById('game-map');
    if (gameMap) {
      gameMap.removeEventListener('mouseleave', () => tooltipSystem.handleMouseLeave());
    }
  }
  
  handleClick(event) {
    if (!gameState.player) return;
    
    const shopUI = document.getElementById('shop-ui');
    if (shopUI && shopUI.style.display !== 'none' && 
        (gameState.gameMode === 'shop' || shopUI.contains(event.target))) {
      this.handleShopClick(event);
      return;
    }
    
    const uiElements = [
      { id: 'spellbook-ui', mode: 'spellbook', handler: this.handleSpellbookClick },
      { id: 'inventory-ui', mode: 'inventory', handler: this.handleInventoryClick },
      { id: 'character-ui', mode: 'character', handler: this.handleCharacterClick },
      { id: 'dialogue-ui', mode: 'dialogue', handler: this.handleDialogueClick }
    ];
    
    for (const { id, mode, handler } of uiElements) {
      const element = document.getElementById(id);
      if (element && element.style.display !== 'none' && element.contains(event.target)) {
        handler.call(this, event);
        return;
      }
    }
    
    const modeHandlers = {
      'inventory': this.handleInventoryClick,
      'spellbook': this.handleSpellbookClick,
      'character': this.handleCharacterClick,
      'targeting': this.handleTargetingClick,
      'shop': this.handleShopClick,
      'dialogue': this.handleDialogueClick,
      'arena_selection': this.handleArenaSelectionClick,
      'summoning_selection': this.handleSummoningSelectionClick,
      'arena': (e) => { e.preventDefault(); e.stopPropagation(); },
      'exploration': this.handleExplorationClick
    };
    
    const handler = modeHandlers[gameState.gameMode];
    if (handler) handler.call(this, event);
  }
  
  handleContextMenu(event) {
    event.preventDefault();
    event.stopPropagation();
    
    if (!gameState.player) return;
    
    const blockedModes = ['shop', 'dialogue', 'arena', 'arena_selection', 'summoning_selection'];
    if (blockedModes.includes(gameState.gameMode)) return;
    
    if (pathfindingSystem.isFollowingPath()) {
      pathfindingSystem.cancelPathFollowing("Path following canceled by right-click");
      return;
    }
    
    if (gameState.gameMode === 'exploration') {
      const tilePos = tooltipSystem.getTileFromMouseEvent(event);
      if (!tilePos) return;
      
      const playerX = Math.floor(gameState.player.position.x);
      const playerY = Math.floor(gameState.player.position.y);
      
      if (tilePos.x === playerX && tilePos.y === playerY) {
        this.showPlayerContextMenu(event);
        return;
      }
      
      const clickedEntities = getEntitiesAtPosition(tilePos.x, tilePos.y);
      const clickableEntity = clickedEntities.find(e => e.blockMovement) || 
                           clickedEntities.find(e => e.getComponent('DialogueComponent')) ||
                           clickedEntities.find(e => e.getComponent('ItemComponent'));
      
      if (clickableEntity) {
        this.showEntityContextMenu(event, clickableEntity, tilePos);
      } else {
        // If no clickable entity, show tile context menu
        this.showTileContextMenu(event, tilePos);
      }
    } else if (gameState.gameMode === 'targeting') {
      targetingSystem.cancelTargeting();
    }
  }
  
  showPlayerContextMenu(event) {
    const menuItems = [
      {
        label: "Character",
        key: "c",
        action: () => {
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
          setTimeout(() => {
            gameState.gameMode = 'spellbook';
            eventBus.emit('openSpellbook');
            eventBus.emit('spellbookOpened');
          }, 50);
        }
      },
      {
        label: "View Data",
        action: () => {
          setTimeout(() => {
            eventBus.emit('showDataViewer', gameState.player);
          }, 50);
        }
      },
      { separator: true },
      {
        label: "Wait",
        key: ".",
        action: () => {
          setTimeout(() => {
            eventBus.emit('turnProcessed');
          }, 50);
        }
      },
      {
        label: "Pick Up Item",
        key: "g",
        action: () => {
          setTimeout(() => {
            const x = gameState.player.position.x;
            const y = gameState.player.position.y;
            eventBus.emit('pickupItem', { x, y });
          }, 50);
        }
      }
    ];
    
    const playerX = Math.floor(gameState.player.position.x);
    const playerY = Math.floor(gameState.player.position.y);
    const tile = gameState.map.getTile(playerX, playerY);
    
    if (tile && [TILE_TYPES.STAIRS_DOWN, TILE_TYPES.STAIRS_UP, 
               TILE_TYPES.AREA_EXIT, TILE_TYPES.DUNGEON_ENTRANCE].includes(tile.type)) {
      
      let stairsLabel = "Use Stairs";
      if (tile.type === TILE_TYPES.STAIRS_DOWN) stairsLabel = "Descend Stairs";
      if (tile.type === TILE_TYPES.STAIRS_UP) stairsLabel = "Ascend Stairs";
      if (tile.type === TILE_TYPES.AREA_EXIT) stairsLabel = `Exit to ${tile.exitInfo?.name || 'another area'}`;
      if (tile.type === TILE_TYPES.DUNGEON_ENTRANCE) stairsLabel = "Enter Dungeon";
      
      menuItems.unshift({
        label: stairsLabel,
        key: ">",
        action: () => {
          setTimeout(() => {
            eventBus.emit('useStairs');
          }, 50);
        }
      });
    }
    
    eventBus.emit('showContextMenu', {
      x: event.clientX,
      y: event.clientY,
      target: gameState.player,
      items: menuItems
    });
  }
  
  showEntityContextMenu(event, entity, tilePos) {
    const menuItems = [];
    
    if (entity.getComponent('DialogueComponent')) {
      menuItems.push({
        label: `Talk to ${entity.name}`,
        key: "t",
        action: () => {
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
    
    if (entity.getComponent('ItemComponent')) {
      menuItems.push({
        label: `Pick up ${entity.name}`,
        key: "g",
        action: () => {
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
    
    const aiComponent = entity.getComponent('AIComponent');
    if (entity.blockMovement && aiComponent && aiComponent.faction !== 'ally') {
      menuItems.push({
        label: `Attack ${entity.name}`,
        action: () => {
          setTimeout(() => {
            if (combatSystem.attack(tilePos.x, tilePos.y)) {
              eventBus.emit('turnProcessed');
            }
          }, 50);
        }
      });
    }
    
    // Always add View Data option for all entities
    menuItems.push({
      label: `View Data for ${entity.name}`,
      action: () => {
        setTimeout(() => {
          eventBus.emit('showDataViewer', entity);
        }, 50);
      }
    });
    
    if (menuItems.length > 0) {
      eventBus.emit('showContextMenu', {
        x: event.clientX,
        y: event.clientY,
        target: entity,
        items: menuItems
      });
    }
  }
  
  showTileContextMenu(event, tilePos) {
    const x = tilePos.x;
    const y = tilePos.y;
    const tile = gameState.map.getTile(x, y);
    
    if (!tile) return;
    
    // Determine tile name based on type
    let tileName = "Unknown";
    let tileLabel = "Unknown Tile";
    
    switch(tile.type) {
      case TILE_TYPES.WALL:
        tileName = "Wall";
        tileLabel = "Wall";
        break;
      case TILE_TYPES.FLOOR:
        tileName = "Floor";
        tileLabel = "Floor";
        break;
      case TILE_TYPES.DOOR:
        tileName = "Door";
        tileLabel = tile.isOpen ? "Open Door" : "Closed Door";
        break;
      case TILE_TYPES.STAIRS_DOWN:
        tileName = "StairsDown";
        tileLabel = "Stairs Down";
        break;
      case TILE_TYPES.STAIRS_UP:
        tileName = "StairsUp";
        tileLabel = "Stairs Up";
        break;
      case TILE_TYPES.AREA_EXIT:
        tileName = "AreaExit";
        tileLabel = tile.exitInfo?.name ? `Exit to ${tile.exitInfo.name}` : "Area Exit";
        break;
      case TILE_TYPES.DUNGEON_ENTRANCE:
        tileName = "DungeonEntrance";
        tileLabel = "Dungeon Entrance";
        break;
      case TILE_TYPES.TOWN_FLOOR:
        tileName = "TownFloor";
        tileLabel = "Town Floor";
        break;
      case TILE_TYPES.BUILDING:
        tileName = "Building";
        tileLabel = "Building";
        break;
      default:
        tileName = `Tile${tile.type}`;
        tileLabel = `Tile Type ${tile.type}`;
    }
    
    const menuItems = [];
    
    // Check if tile is special (stairs, door, exit)
    const isSpecialTile = [
      TILE_TYPES.STAIRS_DOWN, 
      TILE_TYPES.STAIRS_UP, 
      TILE_TYPES.AREA_EXIT, 
      TILE_TYPES.DUNGEON_ENTRANCE
    ].includes(tile.type);
    
    if (isSpecialTile) {
      const playerX = Math.floor(gameState.player.position.x);
      const playerY = Math.floor(gameState.player.position.y);
      const isPlayerAdjacent = Math.abs(playerX - x) <= 1 && Math.abs(playerY - y) <= 1;
      
      if (isPlayerAdjacent) {
        let actionLabel = "Use Stairs";
        
        if (tile.type === TILE_TYPES.STAIRS_DOWN) actionLabel = "Descend Stairs";
        if (tile.type === TILE_TYPES.STAIRS_UP) actionLabel = "Ascend Stairs";
        if (tile.type === TILE_TYPES.AREA_EXIT) actionLabel = `Exit to ${tile.exitInfo?.name || 'another area'}`;
        if (tile.type === TILE_TYPES.DUNGEON_ENTRANCE) actionLabel = "Enter Dungeon";
        
        menuItems.push({
          label: actionLabel,
          key: ">",
          action: () => {
            setTimeout(() => {
              // First move to the tile if not already on it
              if (playerX !== x || playerY !== y) {
                const moveX = x - playerX;
                const moveY = y - playerY;
                eventBus.emit('movePlayer', { dx: moveX, dy: moveY });
              }
              
              // Then use the stairs/exit
              setTimeout(() => {
                eventBus.emit('useStairs');
              }, 100);
            }, 50);
          }
        });
      }
    }
    
    // Add door open/close option
    if (tile.type === TILE_TYPES.DOOR) {
      const playerX = Math.floor(gameState.player.position.x);
      const playerY = Math.floor(gameState.player.position.y);
      const isPlayerAdjacent = Math.abs(playerX - x) <= 1 && Math.abs(playerY - y) <= 1;
      
      if (isPlayerAdjacent) {
        const doorAction = tile.isOpen ? "Close Door" : "Open Door";
        menuItems.push({
          label: doorAction,
          action: () => {
            setTimeout(() => {
              // Toggle door state
              tile.isOpen = !tile.isOpen;
              tile.blocked = !tile.isOpen;
              eventBus.emit('doorToggled', { x, y, isOpen: tile.isOpen });
              eventBus.emit('turnProcessed');
            }, 50);
          }
        });
      }
    }
    
    // Add View Tile Data option
    menuItems.push({
      label: `View Data for ${tileLabel}`,
      action: () => {
        setTimeout(() => {
          // Create a pseudo-entity to represent the tile
          const tileEntity = {
            id: `tile_${x}_${y}`,
            name: tileLabel,
            components: new Map(),
            tile: tile,
            position: { x, y },
            isTile: true
          };
          
          // Add tile data as components
          const tileDataComponent = {
            type: tile.type,
            typeName: tileName,
            blocked: tile.blocked,
            blocksSight: tile.blocksSight,
            visible: tile.visible,
            explored: tile.explored,
            x: x,
            y: y,
            entity: tileEntity
          };
          
          // Add exitInfo if it exists
          if (tile.exitInfo) {
            tileDataComponent.exitInfo = tile.exitInfo;
          }
          
          // Add special properties specific to tile types
          if (tile.type === TILE_TYPES.DOOR) {
            tileDataComponent.isOpen = tile.isOpen || false;
          }
          
          tileEntity.components.set('TileDataComponent', tileDataComponent);
          
          eventBus.emit('showDataViewer', tileEntity);
        }, 50);
      }
    });
    
    if (menuItems.length > 0) {
      eventBus.emit('showContextMenu', {
        x: event.clientX,
        y: event.clientY,
        target: { type: 'tile', x, y },
        items: menuItems
      });
    }
  }
  
  handleMouseMove(event) {
    tooltipSystem.handleMouseMove(event);
    
    if (targetingSystem.isTargetingActive()) {
      const tile = tooltipSystem.getTileFromMouseEvent(event);
      if (tile) {
        targetingSystem.updateTargetingHighlight(tile);
      }
    }
  }
  
  handleExplorationClick(event) {
    const usePathfinding = pathfindingSystem.isPathfindingEnabled();
    this.handleMovementClick(event, event.shiftKey ? !usePathfinding : usePathfinding);
  }
  
  handleTargetingClick(event) {
    event.stopPropagation();
    event.preventDefault();
    
    const tile = tooltipSystem.getTileFromMouseEvent(event);
    if (tile) {
      targetingSystem.selectTarget(tile);
    }
  }
  
  handleInventoryClick(event) {
    event.preventDefault();
    event.stopPropagation();
    
    const inventoryUI = document.getElementById('inventory-ui');
    if (inventoryUI && !inventoryUI.contains(event.target)) {
      eventBus.emit('inventoryKeyPressed', 'Escape');
      gameState.gameMode = 'exploration';
      eventBus.emit('inventoryClosed');
      return;
    }
    
    const inventoryItem = event.target.closest('.inventory-item');
    if (inventoryItem) {
      const items = document.querySelectorAll('.inventory-item');
      const itemIndex = Array.from(items).indexOf(inventoryItem);
      
      eventBus.emit('inventoryKeyPressed', 'select-item');
      eventBus.emit('inventoryItemSelected', itemIndex);
    }
    
    if (event.target.matches('.inventory-action-use')) {
      eventBus.emit('inventoryKeyPressed', 'u');
    } else if (event.target.matches('.inventory-action-equip')) {
      eventBus.emit('inventoryKeyPressed', 'e');
    } else if (event.target.matches('.inventory-action-drop')) {
      eventBus.emit('inventoryKeyPressed', 'd');
    }
  }
  
  handleSpellbookClick(event) {
    event.preventDefault();
    event.stopPropagation();
    
    const spellbookUI = document.getElementById('spellbook-ui');
    if (spellbookUI && !spellbookUI.contains(event.target)) {
      eventBus.emit('spellbookKeyPressed', 'Escape');
      gameState.gameMode = 'exploration';
      eventBus.emit('spellbookClosed');
      return;
    }
    
    const spellItem = event.target.closest('.spellbook-spell');
    if (spellItem) {
      const spells = document.querySelectorAll('.spellbook-spell');
      const spellIndex = Array.from(spells).indexOf(spellItem);
      
      eventBus.emit('spellbookKeyPressed', 'select-spell');
      eventBus.emit('spellbookSpellSelected', spellIndex);
    }
    
    if (event.target.matches('.spellbook-action-cast')) {
      eventBus.emit('spellbookKeyPressed', 'c');
    }
  }
  
  handleCharacterClick(event) {
    if (!event.target.closest('.character-content') && 
        !event.target.closest('.character-header') &&
        !event.target.closest('.character-footer')) {
      eventBus.emit('characterKeyPressed', 'Escape');
    }
  }
  
  handleShopClick(event) {
    event.preventDefault();
    event.stopPropagation();
    
    if (gameState.gameMode !== 'shop') {
      gameState.gameMode = 'shop';
    }
    
    const currentTime = Date.now();
    if (!window.lastShopOpenTime) {
      window.lastShopOpenTime = 0;
    }
    
    const timeSinceOpen = currentTime - window.lastShopOpenTime;
    
    const shopUI = document.getElementById('shop-ui');
    if (shopUI && !shopUI.contains(event.target) && timeSinceOpen > 300) {
      eventBus.emit('shopKeyPressed', 'Escape');
      gameState.gameMode = 'exploration';
      eventBus.emit('shopClosed');
      return;
    }
    
    const shopItem = event.target.closest('.shop-item');
    if (shopItem) {
      const items = document.querySelectorAll('.shop-item');
      const itemIndex = Array.from(items).indexOf(shopItem);
      
      eventBus.emit('shopItemSelected', itemIndex);
      
      items.forEach((el, i) => {
        if (i === itemIndex) {
          el.classList.add('selected');
        } else {
          el.classList.remove('selected');
        }
      });
      
      if (window.game?.shopUI) {
        window.game.shopUI.selectedIndex = itemIndex;
      }
      
      return;
    }
    
    if (event.target.matches('.mode-option.mode-buy') || event.target.closest('.mode-option.mode-buy')) {
      eventBus.emit('shopKeyPressed', 'b');
      return;
    } else if (event.target.matches('.mode-option.mode-sell') || event.target.closest('.mode-option.mode-sell')) {
      eventBus.emit('shopKeyPressed', 's');
      return;
    }
    
    if (event.target.matches('.shop-action-button') || event.target.closest('.shop-action-button')) {
      if (window.game?.shopUI) {
        try {
          if (window.game.shopUI.mode === 'buy') {
            window.game.shopUI.buySelectedItem();
          } else {
            window.game.shopUI.sellSelectedItem();
          }
        } catch (error) {
          eventBus.emit('shopKeyPressed', 'Enter');
        }
      } else {
        eventBus.emit('shopKeyPressed', 'Enter');
      }
      
      return;
    }
    
    if (event.target.matches('.close-button') || event.target.closest('.close-button')) {
      eventBus.emit('shopKeyPressed', 'Escape');
      return;
    }
  }
  
  handleDialogueClick(event) {
    event.stopPropagation();
    
    const dialogueUI = document.getElementById('dialogue-ui');
    if (dialogueUI && !dialogueUI.contains(event.target)) {
      eventBus.emit('dialogueKeyPressed', 'Escape');
    }
  }
  
  handleArenaSelectionClick(event) {
    event.preventDefault();
    event.stopPropagation();
    
    const arenaUI = document.querySelector('.arena-ui');
    if (arenaUI && !arenaUI.contains(event.target)) {
      eventBus.emit('arenaClose');
      gameState.gameMode = 'exploration';
    }
  }
  
  handleSummoningSelectionClick(event) {
    event.preventDefault();
    event.stopPropagation();
    
    const summoningUI = document.querySelector('.summoning-ui');
    if (summoningUI && !summoningUI.contains(event.target)) {
      eventBus.emit('summoningClose');
      gameState.gameMode = 'exploration';
    }
  }
  
  handleMovementClick(event, usePathfinding = true) {
    if (gameState.gameMode !== 'exploration') return false;
    
    const tilePos = tooltipSystem.getTileFromMouseEvent(event);
    if (!tilePos) return false;
    
    const x = Math.floor(tilePos.x);
    const y = Math.floor(tilePos.y);
    
    const playerX = Math.floor(gameState.player.position.x);
    const playerY = Math.floor(gameState.player.position.y);
    
    const clickedSelf = playerX === x && playerY === y;
    const isAdjacent = Math.abs(playerX - x) <= 1 && Math.abs(playerY - y) <= 1;
    
    const clickedEntities = getEntitiesAtPosition(x, y);
    const clickableEntity = clickedEntities.find(e => e.blockMovement) || 
                          clickedEntities.find(e => e.getComponent('DialogueComponent')) ||
                          clickedEntities.find(e => e.getComponent('ItemComponent'));
    
    const mapTile = gameState.map.getTile(x, y);
    const isSpecialTile = mapTile && [
      TILE_TYPES.STAIRS_DOWN, TILE_TYPES.STAIRS_UP, 
      TILE_TYPES.AREA_EXIT, TILE_TYPES.DUNGEON_ENTRANCE
    ].includes(mapTile.type);
    
    if (clickedSelf && isSpecialTile) {
      eventBus.emit('useStairs');
      return true;
    }
    
    if (isAdjacent && !clickedSelf) {
      if (isSpecialTile) {
        const moveX = x - playerX;
        const moveY = y - playerY;
        
        eventBus.emit('movePlayer', { dx: moveX, dy: moveY });
        
        setTimeout(() => {
          eventBus.emit('useStairs');
        }, 50);
        
        return true;
      }
      
      if (clickableEntity) {
        if (clickableEntity.blockMovement) {
          const aiComponent = clickableEntity.getComponent('AIComponent');
          if (aiComponent && aiComponent.faction !== 'ally') {
            if (combatSystem.attack(x, y)) {
              eventBus.emit('turnProcessed');
              return true;
            }
          }
        } else if (clickableEntity.getComponent('DialogueComponent')) {
          gameState.gameMode = 'dialogue';
          gameState.currentDialogue = {
            npc: clickableEntity,
            dialogueState: 'start'
          };
          
          eventBus.emit('startDialogue', clickableEntity);
          return true;
        } else if (clickableEntity.getComponent('ItemComponent')) {
          eventBus.emit('pickupItem', { x, y, item: clickableEntity });
          return true;
        }
      }
    }
    
    if (usePathfinding) {
      const nextStep = pathfindingSystem.calculatePath(x, y);
      if (nextStep) {
        const moveX = nextStep.x - playerX;
        const moveY = nextStep.y - playerY;
        
        eventBus.emit('movePlayer', { dx: moveX, dy: moveY });
        return true;
      }
    }
    
    const movement = pathfindingSystem.calculateDirectMovement(x, y);
    eventBus.emit('movePlayer', { dx: movement.x, dy: movement.y });
    return true;
  }
}

export default new MouseSystem();
