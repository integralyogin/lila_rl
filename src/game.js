import { GAME_WIDTH, GAME_HEIGHT, TILE_TYPES } from './constants.js';
import gameState from './core/gameState.js';
import eventBus from './core/eventEmitter.js';
import EntityFactory from './entities/entityFactory.js';
import FOVSystem from './systems/fovSystem.js';
import RenderSystem from './systems/renderSystem.js';
import inputSystem from './systems/inputSystem.js';
import mouseSystem from './systems/mouseSystem.js';
import pathfindingSystem from './systems/pathfindingSystem.js';
import ActionSystem from './systems/actionSystem.js';
import arenaSystem from './systems/arenaSystem.js';
import InventoryUI from './ui/inventoryUI.js';
import SpellbookUI from './ui/spellbookUI.js';
import DialogueUI from './ui/dialogueUI.js';
import CharacterUI from './ui/characterUI.js';
import ArenaUI from './ui/arenaUI.js';
import SummoningUI from './ui/summoningUI.js';
import GameLoader from './core/gameLoader.js';
import LevelGenerator from './world/levelGenerator.js';
import MapLoader from './world/mapLoader.js';

class Game {
  constructor() {
    this.entityFactory = new EntityFactory();
    this.systems = [];
    this.ui = {};
    this.gameData = {};
    this.gameLoader = new GameLoader();
    this.mapLoader = new MapLoader();
    
    this.initialize();
    
    eventBus.on('emergencyReset', () => this.handleEmergencyReset());
    eventBus.on('logMessage', (messageData) => {
      gameState.addMessage(messageData.message, messageData.type);
    });
  }
  
  handleEmergencyReset() {
    ['inventory', 'spellbook', 'character', 'dialogue', 'shop', 'summoning'].forEach(ui => 
      eventBus.emit(`${ui}Closed`));
    gameState.gameMode = 'exploration';
  }
  
  async initialize() {
    try {
      this.gameData = await this.gameLoader.loadGameData();
      await this.mapLoader.preloadMaps();
      
      this.entityFactory.initialize(this.gameData);
      this.levelGenerator = new LevelGenerator(this.entityFactory);
      
      this.initializeSystems();
      this.initializeUI();
      this.setupEventListeners();
      this.newGame();
      
      eventBus.emit('gameInitialized');
      this.updateSpellLogic();
      this.storeMonsterTemplates();
    } catch (error) {
      console.error("Failed to initialize game:", error);
    }
  }
  
  initializeSystems() {
    const renderSystem = new RenderSystem();
    const fovSystem = new FOVSystem();
    const actionSystem = new ActionSystem();
    
    this.systems = [renderSystem, fovSystem, actionSystem];
    
    const systemMap = {
      RenderSystem: renderSystem,
      FOVSystem: fovSystem,
      InputSystem: inputSystem,
      MouseSystem: mouseSystem,
      PathfindingSystem: pathfindingSystem,
      ActionSystem: actionSystem,
      ArenaSystem: arenaSystem
    };
    
    Object.entries(systemMap).forEach(([name, system]) => {
      gameState.registerSystem(name, system);
    });
    
    gameState.renderSystem = renderSystem;
    
    eventBus.on('movePlayer', ({dx, dy}) => inputSystem.tryMove(dx, dy));
    eventBus.on('pickupItem', () => inputSystem.tryPickupItem());
  }
  
  initializeUI() {
    this.ui = {
      inventory: new InventoryUI(),
      spellbook: new SpellbookUI(),
      dialogue: new DialogueUI(),
      character: new CharacterUI(),
      arena: new ArenaUI(),
      summoning: SummoningUI
    };
    
    import('./ui/contextMenuUI.js');
    
    import('./ui/shopUI.js').then(module => {
      const ShopUI = module.default;
      this.ui.shop = new ShopUI();
      this.ui.shop.entityFactory = this.entityFactory;
      
      window.game = window.game || {};
      window.game.shopUI = this.ui.shop;
      window.game.summoningUI = this.ui.summoning;
    });
  }
  
  updateSpellLogic() {
    import('./spells/spell_logic.js').then(module => {
      const spellLogic = module.default;
      spellLogic.updateGameData(this.gameData);
      
      window.gameSpellLogic = spellLogic;
      gameState.spellLogic = spellLogic;
    }).catch(error => {
      console.error("Error loading spell_logic.js:", error);
    });
  }
  
  storeMonsterTemplates() {
    if (this.gameData?.monsters) {
      gameState.monsterTemplates = this.gameData.monsters;
      import('./entities/ai/monsterSpellcaster.js').catch(error => {
        console.error("Error importing monsterSpellcaster:", error);
      });
    }
  }
  
  setupEventListeners() {
    eventBus.on('playerMoved', () => {
      this.systems[1].update();
      this.checkTransitions();
      this.checkDialogueShouldClose();
    });
    
    eventBus.on('turnProcessed', () => {
      this.systems[1].update();
      gameState.getSystem('ActionSystem')?.update();
    });
    
    eventBus.on('useStairs', async () => {
      if (!gameState.map) return;
      
      const x = gameState.player.position.x;
      const y = gameState.player.position.y;
      const tile = gameState.map.getTile(x, y);
      
      if (!tile) return;
      
      if (tile.type === TILE_TYPES.AREA_EXIT && tile.exitInfo) {
        await this.changeArea(tile.exitInfo.name);
        return;
      }
      
      if (gameState.location === 'dungeon') {
        await this.nextLevel();
      } else if (gameState.location === 'town') {
        this.enterDungeon();
      }
    });
    
    eventBus.on('returnToTown', async () => {
      await this.returnToTown();
    });
    
    eventBus.on('messageAdded', (msg) => {
      if (msg.text === "debug") {
        this.debugSpawnSpellbooks();
      }
    });
  }
  
  newGame() {
    Object.assign(gameState, {
      currentLevel: 1,
      score: 0,
      turn: 0,
      messages: [],
      gameMode: 'exploration',
      location: 'town'
    });
    
    this.generateTown();
    gameState.addMessage("Welcome to town! Use arrow keys to move. Find the dungeon entrance.", "important");
  }
  
  generateTown() {
    const result = this.levelGenerator.generateTown(this.gameData.townData);
    
    if (!result?.map) {
      console.error("Failed to generate town!");
      return null;
    }
    
    const { map, startPosition } = result;
    
    gameState.map = map;
    gameState.entities = new Map();
    
    let playerX = startPosition[0];
    let playerY = startPosition[1];
    
    if (this.gameData.townData?.spawn_point) {
      const centerX = Math.floor(GAME_WIDTH / 2);
      const centerY = Math.floor(GAME_HEIGHT / 2);
      playerX = centerX + (this.gameData.townData.spawn_point.x_offset || 0);
      playerY = centerY + (this.gameData.townData.spawn_point.y_offset || 0);
    }
    
    if (!gameState.player) {
      gameState.player = this.entityFactory.createPlayer(playerX, playerY);
      gameState.addEntity(gameState.player);
    } else {
      gameState.player.position.moveTo(playerX, playerY);
      gameState.addEntity(gameState.player);
    }
    
    this.levelGenerator.populateTown(map, this.gameData.townData);
    
    this.systems[1].update();
    eventBus.emit('fovUpdated');
    
    return result;
  }
  
  enterDungeon() {
    const entranceInfo = this.getCurrentExit();
    
    gameState.location = 'dungeon';
    gameState.currentLevel = 1;
    
    const result = this.levelGenerator.generateDungeon(this.gameData.dungeonConfig);
    
    if (!result?.map) {
      console.error("Failed to generate dungeon!");
      return;
    }
    
    const { map, startPosition } = result;
    
    gameState.map = map;
    gameState.entities = new Map();
    
    if (entranceInfo?.destination_x !== undefined && entranceInfo?.destination_y !== undefined) {
      const centerX = Math.floor(GAME_WIDTH / 2);
      const centerY = Math.floor(GAME_HEIGHT / 2);
      gameState.player.position.moveTo(
        centerX + entranceInfo.destination_x,
        centerY + entranceInfo.destination_y
      );
    } else {
      gameState.player.position.moveTo(...startPosition);
    }
    
    gameState.addEntity(gameState.player);
    
    if (map && startPosition) {
      const entranceX = startPosition[0];
      const entranceY = startPosition[1] + 1;
      map.setTile(entranceX, entranceY, TILE_TYPES.STAIRS_UP);
      map.tiles[entranceY][entranceX].exitInfo = {
        name: 'town',
        signMessage: "Return to town",
        destination_x: 0,
        destination_y: 3
      };
    }
    
    this.levelGenerator.populateDungeon(map, this.gameData.dungeonConfig, gameState.currentLevel);
    
    this.systems[1].update();
    eventBus.emit('fovUpdated');
    eventBus.emit('mapChanged');
    
    gameState.addMessage("You enter the dark dungeon. Be careful!", "important");
  }
  
  async nextLevel() {
    const x = gameState.player.position.x;
    const y = gameState.player.position.y;
    const tile = gameState.map.getTile(x, y);
    
    if (!tile) return;
    
    if (tile.type === TILE_TYPES.STAIRS_UP) {
      if (gameState.currentLevel === 1 && tile.exitInfo?.name === 'town') {
        await this.returnToTown();
        return;
      } else if (gameState.currentLevel > 1) {
        gameState.currentLevel--;
        const result = this.levelGenerator.generateDungeon(this.gameData.dungeonConfig);
        
        if (result?.map) {
          this.setupLevel(result, `You ascend to level ${gameState.currentLevel} of the dungeon.`);
        }
        return;
      }
    }
    else if (tile.type === TILE_TYPES.STAIRS_DOWN) {
      gameState.currentLevel++;
      const result = this.levelGenerator.generateDungeon(this.gameData.dungeonConfig);
      
      if (result?.map) {
        this.setupLevel(result, `You descend to level ${gameState.currentLevel} of the dungeon.`);
      }
      return;
    }
    
    gameState.addMessage("There are no stairs here to use.", "error");
  }
  
  setupLevel(result, message) {
    const { map, startPosition } = result;
    
    gameState.map = map;
    gameState.entities = new Map();
    gameState.player.position.moveTo(...startPosition);
    gameState.addEntity(gameState.player);
    
    this.levelGenerator.populateDungeon(map, this.gameData.dungeonConfig, gameState.currentLevel);
    
    this.systems[1].update();
    eventBus.emit('fovUpdated');
    eventBus.emit('mapChanged');
    
    gameState.addMessage(message, "important");
  }
  
  async returnToTown(currentExit = null) {
    gameState.location = 'town';
    
    const result = this.generateTown();
    
    if (result?.map) {
      const centerX = Math.floor(GAME_WIDTH / 2);
      const centerY = Math.floor(GAME_HEIGHT / 2);
      
      if (currentExit?.destination_x !== undefined && currentExit?.destination_y !== undefined) {
        gameState.player.position.moveTo(
          centerX + currentExit.destination_x,
          centerY + currentExit.destination_y
        );
      } else if (currentExit?.name && this.gameData.townData?.exits) {
        const exit = this.gameData.townData.exits.find(e => e.name === currentExit.name);
        if (exit) {
          gameState.player.position.moveTo(
            centerX + (exit.x_offset || 0),
            centerY + (exit.y_offset || 0)
          );
        }
      }
    }
    
    if (!gameState.entities.has(gameState.player.id)) {
      gameState.addEntity(gameState.player);
    }
    
    eventBus.emit('mapChanged');
    this.systems[1].update();
    eventBus.emit('fovUpdated');
    
    gameState.addMessage("You return to the safety of town.", "important");
  }
  
  async changeArea(areaName) {
    const currentExit = this.getCurrentExit();
    
    if (areaName === 'town') {
      await this.returnToTown(currentExit);
      return;
    }
    
    try {
      const mapName = currentExit?.mapFile ? 
        currentExit.mapFile.replace('.json', '') : areaName;
      
      const areaData = await this.mapLoader.loadMapData(mapName);
      if (!areaData) {
        throw new Error(`Failed to load map data for ${mapName}`);
      }
      
      gameState.location = areaName;
      
      const isDungeonStyle = areaData.roomMinSize !== undefined && areaData.roomMaxSize !== undefined;
      const result = isDungeonStyle ? 
        this.levelGenerator.generateDungeon(areaData) : 
        this.levelGenerator.generateTown(areaData);
      
      if (!result?.map) {
        throw new Error(`Failed to generate ${areaName} map!`);
      }
      
      const { map, startPosition } = result;
      gameState.map = map;
      gameState.entities = new Map();
      
      const centerX = Math.floor(GAME_WIDTH / 2);
      const centerY = Math.floor(GAME_HEIGHT / 2);
      let playerX = startPosition[0], playerY = startPosition[1];
      
      if (currentExit?.destination_x !== undefined && currentExit?.destination_y !== undefined) {
        playerX = centerX + currentExit.destination_x;
        playerY = centerY + currentExit.destination_y;
      }
      
      gameState.player.position.moveTo(playerX, playerY);
      gameState.addEntity(gameState.player);
      
      isDungeonStyle ? null : this.levelGenerator.populateTown(map, areaData);
      
      this.systems[1].update();
      eventBus.emit('fovUpdated');
      eventBus.emit('mapChanged');
      
      gameState.addMessage(`You enter ${areaName}.`, "important");
      
    } catch (error) {
      console.error(`Error changing to area ${areaName}:`, error);
      gameState.addMessage(`Unable to travel to ${areaName}. The path seems blocked.`, "error");
    }
  }
  
  getCurrentExit() {
    if (!gameState.player || !gameState.map) return null;
    
    const x = gameState.player.position.x;
    const y = gameState.player.position.y;
    const tile = gameState.map.getTile(x, y);
    
    if (tile?.type === TILE_TYPES.AREA_EXIT && tile.exitInfo) {
      return {
        name: gameState.location,
        x: x,
        y: y,
        ...tile.exitInfo
      };
    }
    
    return null;
  }
  
  checkTransitions() {
    if (!gameState.player || !gameState.map) return;
    
    const x = gameState.player.position.x;
    const y = gameState.player.position.y;
    const tile = gameState.map.getTile(x, y);
    
    if (!tile) return;
    
    if (gameState.entities) {
      const items = Array.from(gameState.entities.values()).filter(
        entity => entity.hasComponent && entity.hasComponent('ItemComponent') &&
                  entity.hasComponent('PositionComponent') &&
                  entity.position.x === x && entity.position.y === y
      );
      
      if (items.length === 1) {
        gameState.addMessage(`You see a ${items[0].name}. Press 'g' to pick it up.`, "item");
      } else if (items.length > 1) {
        gameState.addMessage(`You see ${items.length} items here. Press 'g' to pick one up.`, "item");
      }
    }
    
    if (tile.signMessage) {
      gameState.addMessage(`Sign: "${tile.signMessage}"`, "sign");
    }
    
    const tilePrompts = {
      [TILE_TYPES.DUNGEON_ENTRANCE]: "Press '>' to enter the dungeon.",
      [TILE_TYPES.DOOR]: "You see a door.",
      [TILE_TYPES.AREA_EXIT]: tile.exitInfo ? `Press '>' to go to ${tile.exitInfo.name}.` : null,
      [TILE_TYPES.STAIRS_DOWN]: gameState.location === 'dungeon' && gameState.currentLevel === 1 
        ? "Press '>' to return to town."
        : "Press '>' to descend deeper into the dungeon.",
      [TILE_TYPES.STAIRS_UP]: gameState.location === 'dungeon' && gameState.currentLevel === 1
        ? "Press '<' to return to town."
        : "Press '<' to ascend to the previous level."
    };
    
    const message = tilePrompts[tile.type];
    if (message) {
      gameState.addMessage(message, "info");
    }
  }
  
  checkDialogueShouldClose() {
    if (gameState.gameMode === 'dialogue' && this.ui.dialogue?.visible) {
      const currentNPC = this.ui.dialogue.currentNPC;
      if (!currentNPC || !gameState.player) return;
      
      const dx = Math.abs(gameState.player.position.x - currentNPC.position.x);
      const dy = Math.abs(gameState.player.position.y - currentNPC.position.y);
      const distanceSquared = dx * dx + dy * dy;
      
      if (distanceSquared > 2) {
        this.ui.dialogue.hideDialogue();
        gameState.addMessage(`You walk away from ${currentNPC.name}.`);
      }
    }
  }
  
  debugSpawnSpellbooks() {
    if (!gameState.player || !this.entityFactory) return;
    
    const x = gameState.player.position.x;
    const y = gameState.player.position.y;
    
    const spellbookTypes = Object.keys(this.entityFactory.spellbookTemplates || {});
    
    if (spellbookTypes.length === 0) {
      gameState.addMessage("Debug: No spellbooks available", "error");
      return;
    }
    
    spellbookTypes.forEach((type, index) => {
      const spellbook = this.entityFactory.createSpellbook(type, x + index, y + 1);
      if (spellbook) {
        gameState.addEntity(spellbook);
        gameState.addMessage(`Debug: Spawned ${type} spellbook at ${x + index},${y + 1}`);
      }
    });
  }
}

function startGame() {
  window.game = new Game();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startGame);
} else {
  startGame();
}

export default Game;
