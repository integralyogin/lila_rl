import { KEYS, TILE_TYPES } from '../constants.js';
import gameState from '../core/gameState.js';
import eventBus from '../core/eventEmitter.js';
import combatSystem from './combatSystem.js';
import aiSystem from './aiSystem.js';
import { getEntityArray } from '../utils/entityUtils.js';
import pathfindingSystem from './pathfindingSystem.js';

class InputSystem {
  constructor() {
    this.boundHandleKeyDown = this.handleKeyDown.bind(this);
    window.addEventListener('keydown', this.boundHandleKeyDown);
    setTimeout(() => this.runSanityCheck(), 2000);
  }
  
  runSanityCheck() {
    if (!gameState) {
      console.error("SANITY CHECK FAILED: gameState is not defined");
      return;
    }
    
    if (!gameState.map) {
      console.warn("SANITY CHECK WARNING: gameState.map is not defined");
    }
    
    if (!gameState.player) {
      console.warn("SANITY CHECK WARNING: gameState.player is not defined");
    }
    
    if (!gameState.entities) {
      console.error("SANITY CHECK FAILED: gameState.entities is not defined");
      gameState.entities = new Map();
    } else if (!(gameState.entities instanceof Map)) {
      console.error("SANITY CHECK FAILED: gameState.entities is not a Map");
      if (Array.isArray(gameState.entities)) {
        const newMap = new Map();
        gameState.entities.forEach((entity, index) => {
          if (entity && entity.id) {
            newMap.set(entity.id, entity);
          } else {
            newMap.set(`entity-${index}`, entity);
          }
        });
        gameState.entities = newMap;
      } else {
        gameState.entities = new Map();
      }
    }
    
    if (!gameState._entitiesArray) {
      Object.defineProperty(gameState, '_entitiesArray', {
        get: function() {
          return Array.from(this.entities.values());
        }
      });
    }
  }
  
  shutdown() {
    window.removeEventListener('keydown', this.boundHandleKeyDown);
  }
  
  handleKeyDown(event) {
    if (!gameState.player) return;
    
    const key = event.key;
    
    if (key === '`') {
      gameState.gameMode = 'exploration';
      eventBus.emit('emergencyReset');
      event.preventDefault();
      return;
    }
    
    if (key === 'Escape' && pathfindingSystem.isFollowingPath()) {
      pathfindingSystem.cancelPathFollowing();
      event.preventDefault();
      return;
    }
    
    if (key === 'p' && event.altKey) {
      pathfindingSystem.togglePathfinding();
      event.preventDefault();
      return;
    }
    
    const modeHandlers = {
      'exploration': () => this.handleExplorationInput(key, event),
      'inventory': () => {
        if (key === 'Escape') {
          gameState.gameMode = 'exploration';
          eventBus.emit('inventoryClosed');
          event.preventDefault();
        } else {
          eventBus.emit('inventoryKeyPressed', key);
        }
      },
      'targeting': () => {
        event.preventDefault();
        eventBus.emit('targetingKeyPressed', key);
      },
      'spellbook': () => {
        if (key === 'Escape') {
          gameState.gameMode = 'exploration';
          eventBus.emit('spellbookClosed');
          event.preventDefault();
        } else {
          eventBus.emit('spellbookKeyPressed', key);
        }
      },
      'character': () => {
        if (key === 'Escape') {
          gameState.gameMode = 'exploration';
          eventBus.emit('characterClosed');
          event.preventDefault();
        } else {
          eventBus.emit('characterKeyPressed', key);
        }
      },
      'dialogue': () => {
        if (key === 'Escape') {
          gameState.gameMode = 'exploration';
          eventBus.emit('dialogueClosed');
          event.preventDefault();
        } else {
          eventBus.emit('dialogueKeyPressed', key);
        }
      },
      'shop': () => {
        event.preventDefault();
        event.stopPropagation();
        
        if (key === 'Escape') {
          gameState.gameMode = 'exploration';
          eventBus.emit('shopClosed');
        } else {
          eventBus.emit('shopKeyPressed', key);
        }
      },
      'arena': () => {
        event.preventDefault();
        if (key === 'Escape') {
          eventBus.emit('stopArenaMatch');
        }
      },
      'arena_selection': () => {
        event.preventDefault();
        if (key === 'Escape') {
          gameState.gameMode = 'exploration';
          eventBus.emit('arenaClose');
        }
      }
    };
    
    const handler = modeHandlers[gameState.gameMode];
    if (handler) {
      handler();
    }
  }
  
  handleExplorationInput(key, event) {
    let handled = false;
    
    if (pathfindingSystem.isFollowingPath() && 
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd', 
         'Home', 'End', 'PageUp', 'PageDown'].includes(key)) {
      pathfindingSystem.cancelPathFollowing("Path following interrupted by manual movement");
    }
    
    const movementKeys = {
      'ArrowUp': [0, -1], 'w': [0, -1], 'k': [0, -1],
      'ArrowRight': [1, 0], 'd': [1, 0], 'l': [1, 0],
      'ArrowDown': [0, 1], 's': [0, 1], 'j': [0, 1],
      'ArrowLeft': [-1, 0], 'a': [-1, 0], 'h': [-1, 0],
      'Home': [-1, -1], 'PageUp': [1, -1], 'End': [-1, 1], 'PageDown': [1, 1]
    };
    
    if (movementKeys[key]) {
      const [dx, dy] = movementKeys[key];
      handled = this.tryMove(dx, dy);
    } else {
      switch (key) {
        case '.':
        case ' ':
        case '5':
          this.processTurn();
          handled = true;
          break;
        case '>':
        case '<':
          handled = this.tryUseStairs();
          break;
        case 'g':
        case ',':
          handled = this.tryPickupItem();
          break;
        case 'i':
          gameState.gameMode = 'inventory';
          eventBus.emit('openInventory');
          eventBus.emit('inventoryOpened');
          handled = true;
          break;
        case 'b':
          gameState.gameMode = 'spellbook';
          eventBus.emit('openSpellbook');
          eventBus.emit('spellbookOpened');
          handled = true;
          break;
        case 'c':
          gameState.gameMode = 'character';
          eventBus.emit('openCharacterScreen');
          eventBus.emit('characterOpened');
          handled = true;
          break;
        case 't':
          handled = this.tryInteract();
          break;
        case 'f':
          if (pathfindingSystem.isFollowingPath()) {
            pathfindingSystem.pausePathFollowing();
          } else if (pathfindingSystem.hasPath()) {
            pathfindingSystem.resumePathFollowing();
          } else {
            eventBus.emit('logMessage', { message: "No path to follow", type: 'info' });
          }
          handled = true;
          break;
      }
    }
    
    if (handled) {
      event.preventDefault();
    }
  }
  
  tryMove(dx, dy) {
    if (!gameState.player || !gameState.map) {
      return false;
    }
    
    const newX = gameState.player.position.x + dx;
    const newY = gameState.player.position.y + dy;
    
    if (newX < 0 || newY < 0 || newX >= gameState.map.width || newY >= gameState.map.height) {
      if (pathfindingSystem.isFollowingPath()) {
        pathfindingSystem.cancelPathFollowing("Path leads out of bounds");
      }
      return false;
    }
    
    const entityArray = getEntityArray();
    
    const entitiesAtPosition = entityArray.filter(
      entity => entity && entity.position && 
      entity.position.x === newX && 
      entity.position.y === newY
    );
    
    for (const entity of entitiesAtPosition) {
      const hasBlockComponent = entity.getComponent && entity.getComponent('BlocksMovementComponent');
      
      if (entity.blockMovement || hasBlockComponent) {
        if (pathfindingSystem.isFollowingPath()) {
          pathfindingSystem.cancelPathFollowing("Path blocked by entity");
        }
        
        if (combatSystem.attack(newX, newY)) {
          this.processTurn();
          return true;
        }
        return false;
      }
    }
    
    const tile = gameState.map.getTile(newX, newY);
    if (tile.blocked) {
      if (pathfindingSystem.isFollowingPath()) {
        pathfindingSystem.cancelPathFollowing("Path blocked by terrain");
      }
      return false;
    }
    
    gameState.player.position.x = newX;
    gameState.player.position.y = newY;
    
    this.processTurn();
    
    eventBus.emit('playerMoved', { x: newX, y: newY });
    
    if (pathfindingSystem.isFollowingPath()) {
      pathfindingSystem.stepAlongPath();
    }
    
    return true;
  }
  
  tryUseStairs() {
    if (!gameState.player || !gameState.map) return false;
    
    const x = gameState.player.position.x;
    const y = gameState.player.position.y;
    
    const tile = gameState.map.getTile(x, y);
    
    if (tile.type === TILE_TYPES.STAIRS_DOWN || 
        tile.type === TILE_TYPES.STAIRS_UP ||
        tile.type === TILE_TYPES.AREA_EXIT ||
        tile.type === TILE_TYPES.DUNGEON_ENTRANCE) {
      
      eventBus.emit('useStairs');
      return true;
    }
    
    return false;
  }
  
  tryPickupItem() {
    if (!gameState.player || !gameState.map) return false;
    
    const x = gameState.player.position.x;
    const y = gameState.player.position.y;
    
    const entityArray = getEntityArray();
    
    const items = entityArray.filter(entity => 
      entity && 
      entity.position && 
      entity.position.x === x && 
      entity.position.y === y &&
      entity.getComponent && 
      entity.getComponent('ItemComponent')
    );
    
    if (items.length > 0) {
      const item = items[0];
      
      const inventory = gameState.player.getComponent('InventoryComponent');
      if (inventory) {
        inventory.items.push(item);
        
        gameState.entities = new Map(
          Array.from(gameState.entities.entries())
          .filter(([id, e]) => e !== item)
        );
        
        item.removeComponent('PositionComponent');
        
        eventBus.emit('logMessage', { 
          message: `Picked up ${item.name}`, 
          type: 'info' 
        });
        
        this.processTurn();
        return true;
      }
    }
    
    return false;
  }
  
  tryInteract() {
    if (!gameState.player || !gameState.map) return false;
    
    const playerX = gameState.player.position.x;
    const playerY = gameState.player.position.y;
    
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        
        const x = playerX + dx;
        const y = playerY + dy;
        
        const entityArray = getEntityArray();
        
        const entities = entityArray.filter(entity => 
          entity && 
          entity.position && 
          entity.position.x === x && 
          entity.position.y === y
        );
        
        for (const entity of entities) {
          const dialogueComponent = entity.getComponent('DialogueComponent');
          if (dialogueComponent) {
            gameState.gameMode = 'dialogue';
            gameState.currentDialogue = {
              npc: entity,
              dialogueState: 'start'
            };
            
            eventBus.emit('startDialogue', entity);
            return true;
          }
        }
      }
    }
    
    return false;
  }
  
  processTurn() {
    gameState.turn++;
    
    this.processPlayerTurn();
    
    aiSystem.processEntityTurns();
    
    eventBus.emit('turnProcessed');
    
    eventBus.emit('fovUpdated');
  }
  
  processPlayerTurn() {
    // Player-specific turn logic
  }
}

export default new InputSystem();
