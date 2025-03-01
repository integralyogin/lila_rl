import gameState from '../core/gameState.js';
import eventBus from '../core/eventEmitter.js';
import Pathfinder from '../utils/pathfinding.js';

class PathfindingSystem {
    constructor() {
        this.currentPath = null;
        this.pathHighlights = [];
        this.pathfinder = null;
        this.followingPath = false;
        this.pathDestination = null;
        this.pathMoveDelay = 200;
        this.pathMoveTimerId = null;
        this.pathfindingEnabled = true;
        
        eventBus.on('turnProcessed', () => this.checkPathFollowing());
        eventBus.on('pathMovement', (nextStep) => this.handlePathMovement(nextStep));
    }
    
    shutdown() {
        eventBus.off('turnProcessed', () => this.checkPathFollowing());
        eventBus.off('pathMovement', (nextStep) => this.handlePathMovement(nextStep));
        
        if (this.pathMoveTimerId) {
            clearTimeout(this.pathMoveTimerId);
            this.pathMoveTimerId = null;
        }
        
        this.clearPathHighlights();
    }
    
    togglePathfinding() {
        this.pathfindingEnabled = !this.pathfindingEnabled;
        eventBus.emit('logMessage', { 
            message: `Pathfinding ${this.pathfindingEnabled ? 'enabled' : 'disabled'}`,
            type: 'info'
        });
    }
    
    isPathfindingEnabled() {
        return this.pathfindingEnabled;
    }
    
    setPathfindingEnabled(enabled) {
        this.pathfindingEnabled = enabled;
    }
    
    isFollowingPath() {
        return this.followingPath;
    }
    
    hasPath() {
        return this.currentPath && this.currentPath.length > 0;
    }
    
    cancelPathFollowing(reason = "Path following canceled") {
        this.followingPath = false;
        this.currentPath = null;
        this.pathDestination = null;
        this.clearPathHighlights();
        
        if (this.pathMoveTimerId) {
            clearTimeout(this.pathMoveTimerId);
            this.pathMoveTimerId = null;
        }
        
        eventBus.emit('logMessage', { 
            message: reason, 
            type: 'info' 
        });
    }
    
    pausePathFollowing() {
        this.followingPath = false;
        this.clearPathHighlights();
        
        if (this.pathMoveTimerId) {
            clearTimeout(this.pathMoveTimerId);
            this.pathMoveTimerId = null;
        }
        
        eventBus.emit('logMessage', { 
            message: "Path following paused", 
            type: 'info' 
        });
    }
    
    resumePathFollowing() {
        if (!this.currentPath || this.currentPath.length === 0) {
            return;
        }
        
        this.followingPath = true;
        this.highlightPath(this.currentPath);
        
        if (!this.pathMoveTimerId) {
            this.pathMoveTimerId = setTimeout(() => {
                this.executePathMovement();
            }, this.pathMoveDelay);
        }
        
        eventBus.emit('logMessage', { 
            message: "Path following resumed", 
            type: 'info' 
        });
    }
    
    stepAlongPath() {
        if (!this.followingPath || !this.currentPath || this.currentPath.length === 0) {
            return;
        }
        
        this.currentPath.shift();
        
        if (this.currentPath.length === 0) {
            this.followingPath = false;
            this.pathDestination = null;
            this.clearPathHighlights();
            
            if (this.pathMoveTimerId) {
                clearTimeout(this.pathMoveTimerId);
                this.pathMoveTimerId = null;
            }
        } else {
            this.highlightPath(this.currentPath);
        }
    }
    
    calculatePath(targetX, targetY, usePathfinding = null) {
        if (!gameState.player || !gameState.map) {
            return null;
        }
        
        const shouldUsePathfinding = usePathfinding !== null ? 
            usePathfinding : this.pathfindingEnabled;
        
        targetX = Math.floor(targetX);
        targetY = Math.floor(targetY);
        
        const playerX = Math.floor(gameState.player.position.x);
        const playerY = Math.floor(gameState.player.position.y);
        
        if (playerX === targetX && playerY === targetY) {
            return null;
        }
        
        if (!this.pathfinder) {
            this.pathfinder = new Pathfinder(gameState.map);
        }
        
        this.clearPathHighlights();
        
        let path = null;
        
        if (shouldUsePathfinding) {
            path = this.pathfinder.findPath(playerX, playerY, targetX, targetY);
        }
        
        if (!path || path.length === 0) {
            return null;
        }
        
        this.currentPath = path;
        this.pathDestination = { x: targetX, y: targetY };
        
        if (path.length > 1) {
            this.followingPath = true;
            
            eventBus.emit('logMessage', { 
                message: `Path found (${path.length} steps). Use ESC to cancel.`, 
                type: 'info' 
            });
            
            if (this.pathMoveTimerId) {
                clearTimeout(this.pathMoveTimerId);
                this.pathMoveTimerId = null;
            }
            
            this.pathMoveTimerId = setTimeout(() => {
                this.executePathMovement();
            }, this.pathMoveDelay);
        }
        
        this.highlightPath(path);
        
        return path[0];
    }
    
    checkPathFollowing() {
        if (!this.followingPath || !this.currentPath || this.currentPath.length === 0) {
            return;
        }
        
        const playerX = Math.floor(gameState.player.position.x);
        const playerY = Math.floor(gameState.player.position.y);
        
        const playerStats = gameState.player.getComponent('StatsComponent');
        if (playerStats && playerStats.lastDamageTaken > 0 && 
            gameState.turn - playerStats.lastDamageTurn < 3) {
            this.cancelPathFollowing("Movement interrupted by damage!");
            return;
        }
        
        if (this.pathDestination) {
            const newPath = this.pathfinder.findPath(
                playerX, 
                playerY, 
                this.pathDestination.x, 
                this.pathDestination.y
            );
            
            if (newPath && newPath.length > 0) {
                this.currentPath = newPath;
                this.highlightPath(newPath);
            } else {
                this.cancelPathFollowing("Path is blocked!");
                return;
            }
        }
        
        if (this.currentPath.length === 0 ||
           (this.pathDestination && 
            playerX === this.pathDestination.x && 
            playerY === this.pathDestination.y)) {
            this.cancelPathFollowing("Reached destination");
            return;
        }
        
        if (!this.pathMoveTimerId) {
            this.pathMoveTimerId = setTimeout(() => {
                this.executePathMovement();
            }, this.pathMoveDelay);
        }
    }
    
    executePathMovement() {
        this.pathMoveTimerId = null;
        
        if (!this.followingPath || !this.currentPath || this.currentPath.length === 0) {
            return;
        }
        
        const nextStep = this.currentPath[0];
        
        eventBus.emit('pathMovement', nextStep);
    }
    
    handlePathMovement(nextStep) {
        const playerX = Math.floor(gameState.player.position.x);
        const playerY = Math.floor(gameState.player.position.y);
        
        const dx = nextStep.x - playerX;
        const dy = nextStep.y - playerY;
        
        eventBus.emit('movePlayer', { dx, dy });
    }
    
    highlightPath(path) {
        if (!path || path.length === 0) return;
        
        this.clearPathHighlights();
        
        const gameMap = document.getElementById('game-map');
        if (!gameMap) return;
        
        path.forEach((step, index) => {
            const cell = gameMap.querySelector(`[data-x="${step.x}"][data-y="${step.y}"]`);
            if (cell) {
                cell.classList.add('path-highlight');
                
                this.pathHighlights.push(cell);
                
                if (path.length > 2) {
                    const pathNumber = document.createElement('div');
                    pathNumber.className = 'path-number';
                    pathNumber.textContent = index + 1;
                    cell.appendChild(pathNumber);
                    
                    this.pathHighlights.push(pathNumber);
                }
            }
        });
    }
    
    clearPathHighlights() {
        this.pathHighlights.forEach(element => {
            if (element.classList) {
                element.classList.remove('path-highlight');
            } else if (element.parentNode) {
                element.parentNode.removeChild(element);
            }
        });
        
        this.pathHighlights = [];
        
        document.querySelectorAll('.path-number').forEach(element => {
            if (element.parentNode) {
                element.parentNode.removeChild(element);
            }
        });
    }
    
    calculateDirectMovement(targetX, targetY) {
        const playerX = Math.floor(gameState.player.position.x);
        const playerY = Math.floor(gameState.player.position.y);
        
        const dx = targetX - playerX;
        const dy = targetY - playerY;
        
        let moveX = 0;
        let moveY = 0;
        
        if (dx > 0) moveX = 1;
        else if (dx < 0) moveX = -1;
        
        if (dy > 0) moveY = 1;
        else if (dy < 0) moveY = -1;
        
        return { x: moveX, y: moveY };
    }
}

export default new PathfindingSystem();
