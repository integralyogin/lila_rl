import { COLORS, TILE_TYPES } from '../constants.js';
import gameState from '../core/gameState.js';
import eventBus from '../core/eventEmitter.js';
import { targetingSystem } from './targetingSystem.js';

class RenderSystem {
  constructor() {
    this.mapElement = null;
    this.messageElement = null;
    
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      this.initialize();
    } else {
      document.addEventListener('DOMContentLoaded', () => this.initialize());
    }
    
    eventBus.on('fovUpdated', () => this.render());
    eventBus.on('messageAdded', () => this.renderMessages());
    eventBus.on('targetingStarted', () => this.render());
    eventBus.on('targetingCancelled', () => this.render());
    eventBus.on('targetMoved', () => this.render());
    eventBus.on('render', () => this.render());
    
    setTimeout(() => {
      this.render();
      this.renderMessages();
    }, 500);
  }
  
  initialize() {
    this.mapElement = document.getElementById('game-map');
    this.messageElement = document.getElementById('message-log');
    this.miniMapElement = document.getElementById('mini-map');
    
    this.spellEffectsContainer = document.createElement('div');
    this.spellEffectsContainer.id = 'spell-effects-container';
    this.spellEffectsContainer.style.position = 'absolute';
    this.spellEffectsContainer.style.top = '0';
    this.spellEffectsContainer.style.left = '0';
    this.spellEffectsContainer.style.width = '100%';
    this.spellEffectsContainer.style.height = '100%';
    this.spellEffectsContainer.style.pointerEvents = 'none';
    this.spellEffectsContainer.style.zIndex = '50';
    
    this.mapElement?.appendChild(this.spellEffectsContainer);
  }
  
  render() {
    if (!this.mapElement) return;
    if (!gameState.map) {
      this._renderEmptyMap();
      return;
    }
    
    if (gameState.player && !gameState.entities.has(gameState.player.id)) {
      gameState.addEntity(gameState.player);
    }
    
    this.mapElement.innerHTML = '';
    
    const map = gameState.map;
    let startX = 0, startY = 0;
    
    if (gameState.player?.position) {
      const playerX = gameState.player.position.x;
      const playerY = gameState.player.position.y;
      startX = Math.max(0, playerX - 20);
      startY = Math.max(0, playerY - 10);
    }
    
    const viewWidth = 40;
    const viewHeight = 25;
    
    for (let y = startY; y < startY + viewHeight && y < map.height; y++) {
      const rowElement = document.createElement('div');
      rowElement.className = 'map-row';
      
      for (let x = startX; x < startX + viewWidth && x < map.width; x++) {
        const tile = map.getTile(x, y);
        if (!tile) continue;
        
        const cellElement = document.createElement('div');
        cellElement.className = 'map-cell';
        
        const viewX = x - startX;
        const viewY = y - startY;
        
        cellElement.dataset.x = String(viewX);
        cellElement.dataset.y = String(viewY);
        cellElement.dataset.mapX = String(x);
        cellElement.dataset.mapY = String(y);
        
        if (gameState.isTileVisible(x, y)) {
          this._renderVisibleTile(cellElement, tile, x, y);
        } else if (gameState.isTileExplored(x, y)) {
          this._renderExploredTile(cellElement, tile);
        } else {
          cellElement.textContent = ' ';
          cellElement.style.backgroundColor = '#000';
        }
        
        rowElement.appendChild(cellElement);
      }
      
      this.mapElement.appendChild(rowElement);
    }
    
    this._updateStats();
  }
  
  _renderEmptyMap() {
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
    const entities = gameState.getEntitiesAt(x, y);
    
    entities.sort((a, b) => {
      const renderableA = a.getComponent('RenderableComponent');
      const renderableB = b.getComponent('RenderableComponent');
      if (!renderableA) return -1;
      if (!renderableB) return 1;
      return (renderableB.priority || 0) - (renderableA.priority || 0);
    });
    
    if (entities.length > 0 && entities[0].renderable) {
      const renderable = entities[0].renderable;
      cellElement.textContent = renderable.char;
      cellElement.style.color = renderable.color;
      
      if (renderable.background) {
        cellElement.style.backgroundColor = renderable.background;
      } else {
        this._setTileBackground(cellElement, tile);
      }
    } else {
      this._renderTile(cellElement, tile);
    }
    
    if (targetingSystem.isTargetingActive()) {
      cellElement.style.cursor = 'crosshair';
      
      const targetingInfo = targetingSystem.getTargetingInfo();
      if (targetingInfo && gameState.player) {
        cellElement.classList.add('targeting-cell');
        
        const isCurrentTarget = targetingInfo.currentTarget && 
                               targetingInfo.currentTarget.x === x && 
                               targetingInfo.currentTarget.y === y;
        
        const isValidTarget = targetingInfo.validTargets.some(
          target => target.x === x && target.y === y
        );
        
        if (isValidTarget) {
          cellElement.classList.add('in-range');
          
          const hasTarget = entities.some(e => e.hasComponent('HealthComponent'));
          
          if (hasTarget) {
            cellElement.classList.add('has-target');
            cellElement.style.border = isCurrentTarget ? '3px solid red' : '2px solid red';
            cellElement.style.backgroundColor = `rgba(255, 50, 0, 0.3)`;
          } else {
            cellElement.style.border = isCurrentTarget ? 
                                     '2px solid rgba(255, 255, 255, 0.9)' : 
                                     '1px solid rgba(255, 255, 255, 0.7)';
            cellElement.style.backgroundColor = isCurrentTarget ?
                                              `rgba(255, 255, 255, 0.2)` :
                                              `rgba(255, 255, 255, 0.1)`;
          }
        } else {
          cellElement.classList.add('out-of-range');
          cellElement.style.opacity = '0.6';
          cellElement.style.border = '1px dashed rgba(100, 100, 100, 0.5)';
        }
        
        if (isCurrentTarget) {
          cellElement.classList.add('current-target');
          cellElement.style.animation = 'targetPulse 1.5s infinite';
        }
      }
    }
  }
  
  _renderExploredTile(cellElement, tile) {
    this._renderTile(cellElement, tile, true);
  }
  
  _renderTile(cellElement, tile, dimmed = false) {
    cellElement.classList.remove('stairs-down', 'stairs-up', 'area-exit', 'dungeon-entrance');
    
    // If tile has a char and color defined from JSON, use those
    if (tile.char && tile.color) {
      cellElement.textContent = tile.char;
      
      // Adjust colors based on visibility
      if (dimmed) {
        // Create a dimmed version of the color
        const color = tile.color.startsWith('#') ? 
          this._dimColor(tile.color) : 
          tile.color;
        cellElement.style.color = color;
      } else {
        cellElement.style.color = tile.color;
      }
      
      // Add special classes for interactive tiles
      if (!dimmed) {
        switch (tile.type) {
          case TILE_TYPES.STAIRS_DOWN:
            cellElement.classList.add('stairs-down');
            break;
          case TILE_TYPES.STAIRS_UP:
            cellElement.classList.add('stairs-up');
            break;
          case TILE_TYPES.AREA_EXIT:
            cellElement.classList.add('area-exit');
            break;
          case TILE_TYPES.DUNGEON_ENTRANCE:
            cellElement.classList.add('dungeon-entrance');
            break;
        }
      }
      
      return;
    }
    
    // Fallback to old switch case if tile doesn't have char/color
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
        if (!dimmed) cellElement.classList.add('dungeon-entrance');
        break;
      case TILE_TYPES.AREA_EXIT:
        cellElement.textContent = '⋄';
        cellElement.style.color = dimmed ? '#666' : '#ffcc00';
        if (!dimmed) cellElement.classList.add('area-exit');
        break;
      case TILE_TYPES.STAIRS_UP:
        cellElement.textContent = '<';
        cellElement.style.color = dimmed ? '#666' : '#fff';
        if (!dimmed) cellElement.classList.add('stairs-up');
        break;
      default:
        cellElement.textContent = '?';
        cellElement.style.color = dimmed ? '#666' : '#f00';
    }
    
    cellElement.setAttribute('data-tile-type', tile.type);
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
    const messages = gameState.messages.slice(0, 5);
    
    messages.forEach(message => {
      const messageElement = document.createElement('div');
      const messageText = message.text || message.message;
      
      if (!messageText) return;
      
      messageElement.className = `message message-${message.type || 'info'}`;
      messageElement.textContent = messageText;
      this.messageElement.appendChild(messageElement);
    });
  }
  
  _updateStats() {
    if (gameState.player?.health) {
      const healthElement = document.getElementById('health');
      const manaElement = document.getElementById('mana');
      const levelElement = document.getElementById('level');
      const scoreElement = document.getElementById('score');
      
      if (healthElement) {
        healthElement.textContent = `HP: ${gameState.player.health.hp}/${gameState.player.health.maxHp}`;
      }
      
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
    
    this.renderMiniMap();
  }
  
  renderMiniMap() {
    if (!this.miniMapElement || !gameState.map) return;
    
    this.miniMapElement.innerHTML = '';
    
    const map = gameState.map;
    const scale = 3;
    
    const miniMapWidth = Math.ceil(map.width / scale);
    const miniMapHeight = Math.ceil(map.height / scale);
    
    for (let y = 0; y < miniMapHeight; y++) {
      const rowElement = document.createElement('div');
      rowElement.style.display = 'flex';
      rowElement.style.height = '3px';
      
      for (let x = 0; x < miniMapWidth; x++) {
        const cellElement = document.createElement('div');
        cellElement.style.width = '3px';
        cellElement.style.height = '3px';
        
        let hasFloor = false;
        let hasWall = false;
        let hasNPC = false;
        
        for (let dy = 0; dy < scale; dy++) {
          for (let dx = 0; dx < scale; dx++) {
            const mapX = x * scale + dx;
            const mapY = y * scale + dy;
            
            if (mapX < map.width && mapY < map.height) {
              const tile = map.getTile(mapX, mapY);
              if (tile) {
                if (tile.type !== 0) {
                  hasFloor = true;
                } else {
                  hasWall = true;
                }
                
                const entitiesHere = gameState.getEntitiesAt(mapX, mapY);
                if (entitiesHere.some(e => e.hasComponent('DialogueComponent'))) {
                  hasNPC = true;
                }
              }
            }
          }
        }
        
        if (hasNPC) {
          cellElement.style.backgroundColor = '#ff0';
        } else if (hasFloor) {
          cellElement.style.backgroundColor = '#484';
        } else if (hasWall) {
          cellElement.style.backgroundColor = '#666';
        } else {
          cellElement.style.backgroundColor = '#000';
        }
        
        if (gameState.player?.position) {
          const playerX = Math.floor(gameState.player.position.x / scale);
          const playerY = Math.floor(gameState.player.position.y / scale);
          
          if (x === playerX && y === playerY) {
            cellElement.style.backgroundColor = '#fff';
          }
        }
        
        rowElement.appendChild(cellElement);
      }
      
      this.miniMapElement.appendChild(rowElement);
    }
  }
  
  createSpellEffect(type, element, options = {}) {
    const gameContainer = document.getElementById('game-container');
    if (!gameContainer) return;
    
    const effectsContainer = document.createElement('div');
    effectsContainer.id = 'temp-spell-effect-container';
    effectsContainer.style.position = 'absolute';
    effectsContainer.style.top = '0';
    effectsContainer.style.left = '0';
    effectsContainer.style.width = '100%';
    effectsContainer.style.height = '100%';
    effectsContainer.style.pointerEvents = 'none';
    effectsContainer.style.zIndex = '1000';
    
    gameContainer.appendChild(effectsContainer);
    
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
    
    const effectElement = document.createElement('div');
    effectElement.className = `spell-effect ${element} ${type}`;
    const effectId = `effect-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    effectElement.id = effectId;
    
    effectElement.style.position = 'absolute';
    effectElement.style.transformStyle = 'preserve-3d';
    
    if (type === 'aura' || type === 'persistent-aura' || type === 'wave') {
      const cellSize = 20;
      const radiusInPx = radius * cellSize;
      
      const gameMap = document.getElementById('game-map');
      const mapRect = gameMap ? gameMap.getBoundingClientRect() : null;
      
      const cellElement = document.querySelector(`[data-map-x="${x}"][data-map-y="${y}"]`);
      let cellRect = null;
      
      if (cellElement) {
        cellRect = cellElement.getBoundingClientRect();
      }
      
      let adjustedX, adjustedY;
      
      if (cellRect && mapRect) {
        adjustedX = cellRect.left - mapRect.left + cellSize/2 - radiusInPx;
        adjustedY = cellRect.top - mapRect.top + cellSize/2 - radiusInPx;
      } else {
        const viewWidth = 40;
        const viewHeight = 25;
        adjustedX = (x % viewWidth) * cellSize + cellSize/2 - radiusInPx;
        adjustedY = (y % viewHeight) * cellSize + cellSize/2 - radiusInPx;
      }
      
      effectElement.style.left = `${adjustedX}px`;
      effectElement.style.top = `${adjustedY}px`;
      effectElement.style.width = `${radiusInPx * 2}px`;
      effectElement.style.height = `${radiusInPx * 2}px`;
      
      effectElement.style.animationDuration = `${duration}ms`;
    } 
    else if (type === 'bolt') {
      const cellSize = 20;
      
      let srcX = sourceX;
      let srcY = sourceY;
      
      if (srcX === null || srcY === null) {
        if (gameState.player?.position) {
          srcX = gameState.player.position.x;
          srcY = gameState.player.position.y;
        } else {
          return;
        }
      }
      
      const sourceCell = document.querySelector(`[data-map-x="${srcX}"][data-map-y="${srcY}"]`);
      const targetCell = document.querySelector(`[data-map-x="${targetX}"][data-map-y="${targetY}"]`);
      const gameMap = document.getElementById('game-map');
      const mapRect = gameMap ? gameMap.getBoundingClientRect() : null;
      
      let sourceCellRect = null;
      let targetCellRect = null;
      
      if (sourceCell) sourceCellRect = sourceCell.getBoundingClientRect();
      if (targetCell) targetCellRect = targetCell.getBoundingClientRect();
      
      let screenStartX, screenStartY;
      let screenTargetX, screenTargetY;
      let boltLength, boltAngle;
      
      if (sourceCellRect && targetCellRect && mapRect) {
        screenStartX = sourceCellRect.left - mapRect.left + cellSize/2;
        screenStartY = sourceCellRect.top - mapRect.top + cellSize/2;
        
        screenTargetX = targetCellRect.left - mapRect.left + cellSize/2;
        screenTargetY = targetCellRect.top - mapRect.top + cellSize/2;
        
        const actualDx = screenTargetX - screenStartX;
        const actualDy = screenTargetY - screenStartY;
        boltLength = Math.sqrt(actualDx * actualDx + actualDy * actualDy);
        boltAngle = Math.atan2(actualDy, actualDx) * (180 / Math.PI);
      } else {
        const viewWidth = 40;
        const viewHeight = 25;
        
        screenStartX = (srcX % viewWidth) * cellSize + cellSize/2;
        screenStartY = (srcY % viewHeight) * cellSize + cellSize/2;
        
        screenTargetX = (targetX % viewWidth) * cellSize + cellSize/2;
        screenTargetY = (targetY % viewHeight) * cellSize + cellSize/2;
        
        const estDx = screenTargetX - screenStartX;
        const estDy = screenTargetY - screenStartY;
        boltLength = Math.sqrt(estDx * estDx + estDy * estDy);
        boltAngle = Math.atan2(estDy, estDx) * (180 / Math.PI);
      }

      effectElement.style.left = `${screenStartX}px`;
      effectElement.style.top = `${screenStartY}px`;
      effectElement.style.width = `${boltLength}px`;
      
      effectElement.style.transformOrigin = 'left center';
      effectElement.style.position = 'absolute';
      
      effectElement.style.cssText += `
        width: ${boltLength}px !important;
        height: 10px !important;
        transform: rotate(${boltAngle}deg) !important;
        transform-origin: left center !important; 
        pointer-events: none !important;
        z-index: 9999 !important;
      `;
      
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
      
      effectElement.style.animationDuration = `${duration}ms`;
    }
    else if (type === 'impact') {
      const cellSize = 20;
      const size = cellSize * 1.5;
      
      const cellElement = document.querySelector(`[data-map-x="${x}"][data-map-y="${y}"]`);
      const gameMap = document.getElementById('game-map');
      const mapRect = gameMap ? gameMap.getBoundingClientRect() : null;
      
      let adjustedX, adjustedY;
      
      if (cellElement && mapRect) {
        const cellRect = cellElement.getBoundingClientRect();
        adjustedX = cellRect.left - mapRect.left + cellSize/2 - size/2;
        adjustedY = cellRect.top - mapRect.top + cellSize/2 - size/2;
      } else {
        const viewWidth = 40;
        const viewHeight = 25;
        adjustedX = (x % viewWidth) * cellSize + cellSize/2 - size/2;
        adjustedY = (y % viewHeight) * cellSize + cellSize/2 - size/2;
      }
      
      effectElement.style.left = `${adjustedX}px`;
      effectElement.style.top = `${adjustedY}px`;
      effectElement.style.width = `${size}px`;
      effectElement.style.height = `${size}px`;
      effectElement.style.borderRadius = '50%';
      
      effectElement.style.animationDuration = `${duration}ms`;
    }
    
    effectElement.style.zIndex = '100';
    if (type === 'bolt') {
      effectElement.style.height = '8px';
      effectElement.style.minWidth = '10px'; 
      effectElement.style.border = `2px solid ${element === 'fire' ? '#ff0' : 
                                    element === 'ice' ? '#6ff' : 
                                    element === 'lightning' ? '#ff6' : '#fff'}`;
    }
    
    effectsContainer.appendChild(effectElement);
    
    if (type === 'persistent-aura') {
      effectElement.container = effectsContainer;
      return effectElement;
    }
    
    setTimeout(() => {
      if (effectElement.parentNode) {
        effectElement.parentNode.removeChild(effectElement);
      }
      
      if (effectsContainer.parentNode) {
        effectsContainer.parentNode.removeChild(effectsContainer);
      }
    }, duration);
    
    return effectElement;
  }
  
  /**
   * Dim a hex color to make it darker (for non-visible but explored tiles)
   * @param {string} color - A hex color like '#ff0000'
   * @returns {string} A dimmed version of the color
   */
  _dimColor(color) {
    // If not a hex color, return as is
    if (!color.startsWith('#')) return color;
    
    // Remove # and convert to RGB
    const hex = color.substring(1);
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    // Dim by reducing brightness
    const dimFactor = 0.4; // How much to dim (0-1)
    const dimR = Math.floor(r * dimFactor);
    const dimG = Math.floor(g * dimFactor);
    const dimB = Math.floor(b * dimFactor);
    
    // Convert back to hex
    return `#${dimR.toString(16).padStart(2, '0')}${dimG.toString(16).padStart(2, '0')}${dimB.toString(16).padStart(2, '0')}`;
  }
}

export default RenderSystem;
