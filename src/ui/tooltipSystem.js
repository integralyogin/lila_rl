import gameState from '../core/gameState.js';
import { TILE_TYPES } from '../constants.js';

/**
 * TooltipSystem - Handles rendering tooltips and hover information for game elements
 */
class TooltipSystem {
    constructor() {
        this.tooltip = null;
        this.targetHighlight = null;
        this.hoverTile = { x: -1, y: -1 };
        this.initialized = false;
        this.mouseX = 0;
        this.mouseY = 0;
        
        this.ensureTooltipExists();
        
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initialize());
        } else {
            this.initialize();
        }
    }
    
    initialize() {
        this.ensureTooltipExists();
        this.ensureTargetHighlightExists();
        
        document.addEventListener('mousemove', (event) => this.handleMouseMove(event));
        
        const gameMap = document.getElementById('game-map');
        if (gameMap) {
            gameMap.addEventListener('mouseleave', () => this.handleMouseLeave());
        } else {
            setTimeout(() => {
                const gameMap = document.getElementById('game-map');
                if (gameMap) {
                    gameMap.addEventListener('mouseleave', () => this.handleMouseLeave());
                }
            }, 1000);
        }
        
        this.initialized = true;
    }
    
    handleMouseMove(event) {
        if (!this.initialized || !gameState || !gameState.map) {
            return;
        }
        
        this.mouseX = event.clientX;
        this.mouseY = event.clientY;
        
        const tile = this.getTileFromMouseEvent(event);
        if (!tile) {
            this.hideTooltip();
            return;
        }
        
        this.hoverTile = tile;
        this.updateHoverInfo(tile.x, tile.y);
        
        if (gameState.gameMode === 'targeting') {
            this.updateTargetingHighlight(tile.x, tile.y);
        }
    }
    
    handleMouseLeave() {
        this.hideTooltip();
        this.clearTargetingHighlight();
    }
    
    getTileFromMouseEvent(event) {
        const gameMap = document.getElementById('game-map');
        if (!gameMap || !gameState.map) {
            return null;
        }
        
        try {
            const mapRect = gameMap.getBoundingClientRect();
            
            if (event.clientX < mapRect.left || event.clientX > mapRect.right || 
                event.clientY < mapRect.top || event.clientY > mapRect.bottom) {
                return null;
            }
            
            const cells = gameMap.querySelectorAll('.cell, .map-cell');
            if (!cells.length) {
                return null;
            }
            
            const cellRect = cells[0].getBoundingClientRect();
            const cellWidth = cellRect.width || 16;
            const cellHeight = cellRect.height || 16;
            
            const relativeX = event.clientX - mapRect.left;
            const relativeY = event.clientY - mapRect.top;
            
            const viewWidth = Math.floor(mapRect.width / cellWidth);
            const viewX = Math.floor(relativeX / cellWidth);
            const viewY = Math.floor(relativeY / cellHeight);
            
            const cameraX = gameState.camera ? gameState.camera.x : 0;
            const cameraY = gameState.camera ? gameState.camera.y : 0;
            
            const x = Math.floor(viewX + cameraX);
            const y = Math.floor(viewY + cameraY);
            
            if (x < 0 || y < 0 || x >= gameState.map.width || y >= gameState.map.height) {
                return null;
            }
            
            let cellElement = null;
            
            const element = document.elementFromPoint(event.clientX, event.clientY);
            if (element && (element.classList.contains('cell') || element.classList.contains('map-cell'))) {
                cellElement = element;
                
                if (cellElement.dataset.mapX !== undefined && cellElement.dataset.mapY !== undefined) {
                    const mapX = parseInt(cellElement.dataset.mapX);
                    const mapY = parseInt(cellElement.dataset.mapY);
                    
                    return {
                        x: mapX,
                        y: mapY,
                        viewX: parseInt(cellElement.dataset.x || "0"),
                        viewY: parseInt(cellElement.dataset.y || "0"),
                        cell: cellElement
                    };
                }
            }
            
            if (!cellElement) {
                for (let i = 0; i < cells.length; i++) {
                    const cell = cells[i];
                    if ((cell.dataset.x && parseInt(cell.dataset.x) === viewX) && 
                        (cell.dataset.y && parseInt(cell.dataset.y) === viewY)) {
                        cellElement = cell;
                        break;
                    }
                }
                
                if (!cellElement && viewWidth > 0) {
                    const index = viewY * viewWidth + viewX;
                    if (index >= 0 && index < cells.length) {
                        cellElement = cells[index];
                    }
                }
            }
            
            return { x, y, viewX, viewY, cell: cellElement };
        } catch (error) {
            console.error("Error getting tile from mouse event:", error);
            return null;
        }
    }
    
    ensureTooltipExists() {
        if (!this.tooltip) {
            this.tooltip = document.getElementById('tooltip');
            
            if (!this.tooltip) {
                this.tooltip = document.createElement('div');
                this.tooltip.id = 'tooltip';
                this.tooltip.className = 'tooltip';
                this.tooltip.style.display = 'none';
                this.tooltip.style.position = 'absolute';
                this.tooltip.style.zIndex = '1000';
                this.tooltip.style.backgroundColor = 'rgba(0, 0, 0, 0.85)';
                this.tooltip.style.color = 'white';
                this.tooltip.style.padding = '5px 8px';
                this.tooltip.style.borderRadius = '4px';
                this.tooltip.style.border = '1px solid #666';
                this.tooltip.style.boxShadow = '0 0 5px rgba(0, 0, 0, 0.5)';
                this.tooltip.style.fontSize = '12px';
                this.tooltip.style.pointerEvents = 'none';
                this.tooltip.style.maxWidth = '250px';
                document.body.appendChild(this.tooltip);
            }
        }
    }
    
    updateHoverInfo(x, y) {
        if (!gameState.map) return;
        
        const tile = gameState.map.getTile(x, y);
        
        if (!tile) {
            this.hideTooltip();
            return;
        }
        
        const intX = Math.floor(x);
        const intY = Math.floor(y);
        
        let entitiesAtPosition = [];
        
        if (gameState._entitiesArray) {
            entitiesAtPosition = gameState._entitiesArray.filter(e => 
                e && e.position && 
                Math.floor(e.position.x) === intX && 
                Math.floor(e.position.y) === intY
            );
        } else if (gameState.entities) {
            if (gameState.entities instanceof Map) {
                entitiesAtPosition = Array.from(gameState.entities.values()).filter(e => 
                    e && e.position && 
                    Math.floor(e.position.x) === intX && 
                    Math.floor(e.position.y) === intY
                );
            } else if (Array.isArray(gameState.entities)) {
                entitiesAtPosition = gameState.entities.filter(e => 
                    e && e.position && 
                    Math.floor(e.position.x) === intX && 
                    Math.floor(e.position.y) === intY
                );
            }
        }
        
        if (entitiesAtPosition.length > 0) {
            this.showEntityTooltip(entitiesAtPosition[0], x, y);
        } else if (tile.type !== TILE_TYPES.FLOOR) {
            this.showTileTooltip(tile, x, y);
        } else {
            this.hideTooltip();
        }
    }
    
    showEntityTooltip(entity, x, y) {
        if (!entity) return;
        
        let tooltipContent = `<strong>${entity.name}</strong>`;
        
        if (entity.health) {
            const healthPercent = Math.floor((entity.health.hp / entity.health.maxHp) * 100);
            let healthColor = '#00ff00';
            
            if (healthPercent < 30) {
                healthColor = '#ff0000';
            } else if (healthPercent < 70) {
                healthColor = '#ffff00';
            }
            
            tooltipContent += `<br>HP: <span style="color: ${healthColor};">${entity.health.hp}/${entity.health.maxHp}</span>`;
        }
        
        const itemComponent = entity.getComponent('ItemComponent');
        if (itemComponent) {
            tooltipContent += `<br><em>${itemComponent.description}</em>`;
            
            const equippableComponent = entity.getComponent('EquippableComponent');
            if (equippableComponent) {
                if (equippableComponent.slot === 'weapon') {
                    tooltipContent += `<br>Attack: +${equippableComponent.attackBonus}`;
                    tooltipContent += `<br>Damage: +${equippableComponent.damageBonus}`;
                } else if (equippableComponent.slot === 'armor') {
                    tooltipContent += `<br>Defense: +${equippableComponent.defenseBonus}`;
                    tooltipContent += `<br>Armor Class: ${equippableComponent.armorClass}`;
                }
            }
            
            const usableComponent = entity.getComponent('UsableComponent');
            if (usableComponent) {
                tooltipContent += `<br>Effect: ${usableComponent.effect} (${usableComponent.amount})`;
            }
        }
        
        const dialogueComponent = entity.getComponent('DialogueComponent');
        if (dialogueComponent) {
            tooltipContent += `<br><em>(Press 'T' to talk)</em>`;
        }
        
        this.positionTooltip(x, y, tooltipContent);
    }
    
    showTileTooltip(tile, x, y) {
        let tooltipContent = '';
        
        switch (tile.type) {
            case TILE_TYPES.WALL:
                tooltipContent = 'Wall';
                break;
            case TILE_TYPES.DOOR:
                tooltipContent = tile.open ? 'Open Door' : 'Closed Door';
                break;
            case TILE_TYPES.STAIRS_DOWN:
                tooltipContent = 'Stairs Down (Press > to descend)';
                break;
            case TILE_TYPES.STAIRS_UP:
                tooltipContent = 'Stairs Up (Press < to ascend)';
                break;
            case TILE_TYPES.AREA_EXIT:
                tooltipContent = `Exit to ${tile.exitInfo?.name || 'another area'}`;
                break;
            default:
                this.hideTooltip();
                return;
        }
        
        this.positionTooltip(x, y, tooltipContent);
    }
    
    positionTooltip(tileX, tileY, content) {
        if (!this.mouseX || !this.mouseY) {
            return;
        }
        
        this.tooltip.innerHTML = content;
        
        this.tooltip.style.left = (this.mouseX + 15) + 'px';
        this.tooltip.style.top = (this.mouseY - 10) + 'px';
        this.tooltip.style.display = 'block';
        
        const tooltipRect = this.tooltip.getBoundingClientRect();
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        
        if (tooltipRect.right > windowWidth) {
            this.tooltip.style.left = (this.mouseX - tooltipRect.width - 5) + 'px';
        }
        
        if (tooltipRect.bottom > windowHeight) {
            this.tooltip.style.top = (this.mouseY - tooltipRect.height - 5) + 'px';
        }
    }
    
    hideTooltip() {
        if (this.tooltip) {
            this.tooltip.style.display = 'none';
        }
    }
    
    updateTargetingHighlight(x, y) {
        if (gameState.gameMode !== 'targeting' || !gameState.targetingData) {
            this.clearTargetingHighlight();
            return;
        }
        
        const targetingData = gameState.targetingData;
        
        const sourceX = targetingData.sourceX || (gameState.player && gameState.player.position ? gameState.player.position.x : 0);
        const sourceY = targetingData.sourceY || (gameState.player && gameState.player.position ? gameState.player.position.y : 0);
        
        const dx = x - sourceX;
        const dy = y - sourceY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        let isValidTarget = true;
        let highlightColor = '#3498db';
        
        if (targetingData.range && distance > targetingData.range) {
            isValidTarget = false;
            highlightColor = '#e74c3c';
        }
        
        this.ensureTargetHighlightExists();
        
        const gameMap = document.getElementById('game-map');
        if (!gameMap) return;
        
        const cells = gameMap.querySelectorAll('.cell, .map-cell');
        if (!cells.length) return;
        
        const cellRect = cells[0].getBoundingClientRect();
        const cellWidth = cellRect.width || 16;
        const cellHeight = cellRect.height || 16;
        
        const mapRect = gameMap.getBoundingClientRect();
        
        const cameraX = gameState.camera ? gameState.camera.x : 0;
        const cameraY = gameState.camera ? gameState.camera.y : 0;
        
        const screenX = ((x - cameraX) * cellWidth) + mapRect.left;
        const screenY = ((y - cameraY) * cellHeight) + mapRect.top;
        
        this.targetHighlight.style.left = screenX + 'px';
        this.targetHighlight.style.top = screenY + 'px';
        this.targetHighlight.style.width = cellWidth + 'px';
        this.targetHighlight.style.height = cellHeight + 'px';
        this.targetHighlight.style.backgroundColor = highlightColor;
        this.targetHighlight.style.opacity = '0.3';
        this.targetHighlight.style.display = 'block';
        
        let tooltipContent = `<strong>Targeting: ${targetingData.name}</strong>`;
        
        if (!isValidTarget) {
            tooltipContent += '<br>Out of range';
        } else {
            const intX = Math.floor(x);
            const intY = Math.floor(y);
            let entitiesAtPosition = [];
            
            if (gameState._entitiesArray) {
                entitiesAtPosition = gameState._entitiesArray.filter(e => 
                    e && e.position && 
                    Math.floor(e.position.x) === intX && 
                    Math.floor(e.position.y) === intY
                );
            } else if (gameState.entities) {
                if (gameState.entities instanceof Map) {
                    entitiesAtPosition = Array.from(gameState.entities.values()).filter(e => 
                        e && e.position && 
                        Math.floor(e.position.x) === intX && 
                        Math.floor(e.position.y) === intY
                    );
                } else if (Array.isArray(gameState.entities)) {
                    entitiesAtPosition = gameState.entities.filter(e => 
                        e && e.position && 
                        Math.floor(e.position.x) === intX && 
                        Math.floor(e.position.y) === intY
                    );
                }
            }
            
            if (entitiesAtPosition.length > 0) {
                const entity = entitiesAtPosition[0];
                tooltipContent += `<br>Target: ${entity.name}`;
                
                if (entity.health) {
                    tooltipContent += `<br>HP: ${entity.health.hp}/${entity.health.maxHp}`;
                }
            } else {
                tooltipContent += '<br>Target: Empty Space';
            }
        }
        
        tooltipContent += `<br>Range: ${Math.round(distance)} / ${targetingData.range || 'unlimited'}`;
        tooltipContent += '<br><em>Left-click to select, right-click or ESC to cancel</em>';
        
        this.positionTooltip(x, y, tooltipContent);
    }
    
    ensureTargetHighlightExists() {
        if (!this.targetHighlight) {
            this.targetHighlight = document.getElementById('target-highlight');
            
            if (!this.targetHighlight) {
                this.targetHighlight = document.createElement('div');
                this.targetHighlight.id = 'target-highlight';
                this.targetHighlight.className = 'target-highlight';
                this.targetHighlight.style.display = 'none';
                this.targetHighlight.style.position = 'absolute';
                this.targetHighlight.style.zIndex = '999';
                this.targetHighlight.style.pointerEvents = 'none';
                this.targetHighlight.style.border = '2px solid white';
                document.body.appendChild(this.targetHighlight);
            }
        }
    }
    
    clearTargetingHighlight() {
        if (this.targetHighlight) {
            this.targetHighlight.style.display = 'none';
        }
    }
}

const tooltipSystem = new TooltipSystem();
export default tooltipSystem;