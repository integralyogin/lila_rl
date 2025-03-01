import gameState from '../core/gameState.js';
import eventBus from '../core/eventEmitter.js';
import Pathfinder from '../utils/pathfinding.js';

/**
 * PathfindingSystem - Handles path calculation, visualization, and following
 * Contains functionality extracted from InputSystem related to pathfinding
 */
class PathfindingSystem {
    constructor() {
        // Initialize path visualization objects
        this.currentPath = null;
        this.pathHighlights = [];
        this.pathfinder = null;
        this.followingPath = false;
        this.pathDestination = null;
        
        // Path movement delay (milliseconds) to make movement smooth and visible
        this.pathMoveDelay = 200;  // Can be adjusted for different movement speeds
        this.pathMoveTimerId = null;
        
        // Support for pathfinding toggles
        this.pathfindingEnabled = true; // Default to enabled
        
        // Set up event listeners for turn processed to update path following
        eventBus.on('turnProcessed', () => this.checkPathFollowing());
        
        // Set up event listener for path movement events
        eventBus.on('pathMovement', (nextStep) => this.handlePathMovement(nextStep));
    }
    
    /**
     * Clean up resources used by the pathfinding system
     */
    shutdown() {
        // Remove event listeners
        eventBus.off('turnProcessed', () => this.checkPathFollowing());
        eventBus.off('pathMovement', (nextStep) => this.handlePathMovement(nextStep));
        
        // Clear any movement timer
        if (this.pathMoveTimerId) {
            clearTimeout(this.pathMoveTimerId);
            this.pathMoveTimerId = null;
        }
        
        // Clean up any path highlights
        this.clearPathHighlights();
    }
    
    /**
     * Toggle pathfinding on/off
     */
    togglePathfinding() {
        this.pathfindingEnabled = !this.pathfindingEnabled;
        console.log(`Pathfinding ${this.pathfindingEnabled ? 'enabled' : 'disabled'}`);
        
        // Log message to player
        eventBus.emit('logMessage', { 
            message: `Pathfinding ${this.pathfindingEnabled ? 'enabled' : 'disabled'}`,
            type: 'info'
        });
    }
    
    /**
     * Check if pathfinding is currently enabled
     * @returns {boolean} True if pathfinding is enabled
     */
    isPathfindingEnabled() {
        return this.pathfindingEnabled;
    }
    
    /**
     * Set pathfinding enabled state
     * @param {boolean} enabled - Whether pathfinding should be enabled
     */
    setPathfindingEnabled(enabled) {
        this.pathfindingEnabled = enabled;
    }
    
    /**
     * Check if we're currently following a path
     * @returns {boolean} True if actively following a path
     */
    isFollowingPath() {
        return this.followingPath;
    }
    
    /**
     * Check if we have a valid path
     * @returns {boolean} True if we have a path
     */
    hasPath() {
        return this.currentPath && this.currentPath.length > 0;
    }
    
    /**
     * Cancel path following and clean up
     * @param {string} reason - Optional reason for cancellation (will be logged)
     */
    cancelPathFollowing(reason = "Path following canceled") {
        console.log(reason);
        
        // Clean up path state
        this.followingPath = false;
        this.currentPath = null;
        this.pathDestination = null;
        this.clearPathHighlights();
        
        // Clear any pending movement timer
        if (this.pathMoveTimerId) {
            clearTimeout(this.pathMoveTimerId);
            this.pathMoveTimerId = null;
        }
        
        // Show feedback message
        eventBus.emit('logMessage', { 
            message: reason, 
            type: 'info' 
        });
    }
    
    /**
     * Pause path following without clearing the path
     */
    pausePathFollowing() {
        console.log("Path following paused");
        this.followingPath = false;
        this.clearPathHighlights();
        
        // Clear any pending timer
        if (this.pathMoveTimerId) {
            clearTimeout(this.pathMoveTimerId);
            this.pathMoveTimerId = null;
        }
        
        // Show feedback message
        eventBus.emit('logMessage', { 
            message: "Path following paused", 
            type: 'info' 
        });
    }
    
    /**
     * Resume path following if we have a valid path
     */
    resumePathFollowing() {
        if (!this.currentPath || this.currentPath.length === 0) {
            console.log("No path to resume");
            return;
        }
        
        console.log("Resuming path following");
        this.followingPath = true;
        this.highlightPath(this.currentPath);
        
        // Schedule next movement
        if (!this.pathMoveTimerId) {
            this.pathMoveTimerId = setTimeout(() => {
                this.executePathMovement();
            }, this.pathMoveDelay);
        }
        
        // Show feedback message
        eventBus.emit('logMessage', { 
            message: "Path following resumed", 
            type: 'info' 
        });
    }
    
    /**
     * Update path after player has taken a step
     * Removes the first step from the path
     */
    stepAlongPath() {
        if (!this.followingPath || !this.currentPath || this.currentPath.length === 0) {
            return;
        }
        
        // Remove the step we just took
        this.currentPath.shift();
        
        // If the path is now empty, we've reached the destination
        if (this.currentPath.length === 0) {
            console.log("Reached end of path");
            this.followingPath = false;
            this.pathDestination = null;
            this.clearPathHighlights();
            
            // Clear any pending timer
            if (this.pathMoveTimerId) {
                clearTimeout(this.pathMoveTimerId);
                this.pathMoveTimerId = null;
            }
        } else {
            // Update path highlighting to show remaining path
            this.highlightPath(this.currentPath);
        }
    }
    
    /**
     * Calculate a path to a target position and begin following it
     * @param {number} targetX - Target X coordinate
     * @param {number} targetY - Target Y coordinate 
     * @param {boolean} usePathfinding - Whether to use pathfinding (vs direct movement)
     * @returns {Object} First step in the path as {x, y} or null if no path
     */
    calculatePath(targetX, targetY, usePathfinding = null) {
        if (!gameState.player || !gameState.map) {
            console.error("Missing player or map in calculatePath");
            return null;
        }
        
        // Use provided pathfinding setting or default to system setting
        const shouldUsePathfinding = usePathfinding !== null ? 
            usePathfinding : this.pathfindingEnabled;
        
        // Ensure coordinates are integers
        targetX = Math.floor(targetX);
        targetY = Math.floor(targetY);
        
        // Get player position
        const playerX = Math.floor(gameState.player.position.x);
        const playerY = Math.floor(gameState.player.position.y);
        
        // If we're already at the target, do nothing
        if (playerX === targetX && playerY === targetY) {
            console.log("Already at target position");
            return null;
        }
        
        // Debug: Output movement info
        console.log(`PATHFINDING: From player(${playerX}, ${playerY}) to target(${targetX}, ${targetY})`);
        
        // Initialize pathfinder if not already done
        if (!this.pathfinder) {
            console.log("Creating new Pathfinder instance");
            this.pathfinder = new Pathfinder(gameState.map);
        }
        
        // Clear any existing path highlights
        this.clearPathHighlights();
        
        let path = null;
        
        // Only calculate A* path if pathfinding is enabled
        if (shouldUsePathfinding) {
            // Calculate the path
            path = this.pathfinder.findPath(playerX, playerY, targetX, targetY);
            console.log("Path calculated:", path);
        }
        
        // If path is empty, null, or pathfinding is disabled, return null
        // The caller can implement fallback direct movement
        if (!path || path.length === 0) {
            console.log("No path found or pathfinding disabled");
            return null;
        }
        
        // Store the path for visualization and continuous movement
        this.currentPath = path;
        this.pathDestination = { x: targetX, y: targetY };
        
        // Enable path following if there's more than one step
        if (path.length > 1) {
            console.log("Setting up continuous path following");
            this.followingPath = true;
            
            // Display message to the player about path following
            eventBus.emit('logMessage', { 
                message: `Path found (${path.length} steps). Use ESC to cancel.`, 
                type: 'info' 
            });
            
            // Clear any existing timer
            if (this.pathMoveTimerId) {
                clearTimeout(this.pathMoveTimerId);
                this.pathMoveTimerId = null;
            }
            
            // Schedule the next movement step with a delay
            // We'll take the first step immediately but delay subsequent steps
            this.pathMoveTimerId = setTimeout(() => {
                this.executePathMovement();
            }, this.pathMoveDelay);
        }
        
        // Highlight the path
        this.highlightPath(path);
        
        // Return the first step of the path
        return path[0];
    }
    
    /**
     * Continue path following by checking conditions and planning next steps
     */
    checkPathFollowing() {
        // Skip if not following a path
        if (!this.followingPath || !this.currentPath || this.currentPath.length === 0) {
            return;
        }
        
        console.log("Checking path following status, remaining steps:", this.currentPath.length);
        
        // Get player position
        const playerX = Math.floor(gameState.player.position.x);
        const playerY = Math.floor(gameState.player.position.y);
        
        // Check if player has taken damage recently (optional interruption)
        const playerStats = gameState.player.getComponent('StatsComponent');
        if (playerStats && playerStats.lastDamageTaken > 0 && 
            gameState.turn - playerStats.lastDamageTurn < 3) {
            // Player was hit recently, stop automatic following
            this.cancelPathFollowing("Movement interrupted by damage!");
            return;
        }
        
        // Recalculate path if we're following a distant target
        // This ensures we adapt to moving entities and changes in the environment
        if (this.pathDestination) {
            const newPath = this.pathfinder.findPath(
                playerX, 
                playerY, 
                this.pathDestination.x, 
                this.pathDestination.y
            );
            
            // If we have a valid new path, update our current path
            if (newPath && newPath.length > 0) {
                this.currentPath = newPath;
                this.highlightPath(newPath);
            } else {
                // If we can no longer find a path, stop following
                this.cancelPathFollowing("Path is blocked!");
                return;
            }
        }
        
        // If we've reached the destination, stop following
        if (this.currentPath.length === 0 ||
           (this.pathDestination && 
            playerX === this.pathDestination.x && 
            playerY === this.pathDestination.y)) {
            this.cancelPathFollowing("Reached destination");
            return;
        }
        
        // Schedule the next movement with a delay if not already scheduled
        if (!this.pathMoveTimerId) {
            this.pathMoveTimerId = setTimeout(() => {
                this.executePathMovement();
            }, this.pathMoveDelay);
        }
    }
    
    /**
     * Execute a single step along the path
     * This is called after a delay to make movement visible
     */
    executePathMovement() {
        // Clear the timer ID since we're executing now
        this.pathMoveTimerId = null;
        
        // Skip if no longer following path
        if (!this.followingPath || !this.currentPath || this.currentPath.length === 0) {
            return;
        }
        
        // Get the next step in the path
        const nextStep = this.currentPath[0];
        
        // Emit an event that the input system will listen for
        eventBus.emit('pathMovement', nextStep);
    }
    
    /**
     * Handle path movement event from mouseSystem
     * This is triggered when player clicks on a tile and pathfinding is active
     * @param {Object} nextStep - The next step to move to
     */
    handlePathMovement(nextStep) {
        console.log(`Path movement to ${nextStep.x},${nextStep.y}`);
        
        // Get player position
        const playerX = Math.floor(gameState.player.position.x);
        const playerY = Math.floor(gameState.player.position.y);
        
        // Calculate movement vector
        const dx = nextStep.x - playerX;
        const dy = nextStep.y - playerY;
        
        // Execute the movement
        eventBus.emit('movePlayer', { dx, dy });
    }
    
    /**
     * Highlight a path on the game map
     * @param {Array} path - Array of {x, y} coordinates
     */
    highlightPath(path) {
        if (!path || path.length === 0) return;
        
        // Clear any existing highlights
        this.clearPathHighlights();
        
        // Get the game map
        const gameMap = document.getElementById('game-map');
        if (!gameMap) return;
        
        // Highlight each cell in the path
        path.forEach((step, index) => {
            // Find the cell at this position
            const cell = gameMap.querySelector(`[data-x="${step.x}"][data-y="${step.y}"]`);
            if (cell) {
                // Add highlight class
                cell.classList.add('path-highlight');
                
                // Store the cell in our highlights array for later clearing
                this.pathHighlights.push(cell);
                
                // Add path number for longer paths (optional)
                if (path.length > 2) {
                    const pathNumber = document.createElement('div');
                    pathNumber.className = 'path-number';
                    pathNumber.textContent = index + 1;
                    cell.appendChild(pathNumber);
                    
                    // Store for cleanup
                    this.pathHighlights.push(pathNumber);
                }
            }
        });
    }
    
    /**
     * Clear all path highlights
     */
    clearPathHighlights() {
        // Clear existing highlight elements
        this.pathHighlights.forEach(element => {
            if (element.classList) {
                element.classList.remove('path-highlight');
            } else if (element.parentNode) {
                element.parentNode.removeChild(element);
            }
        });
        
        // Reset the array
        this.pathHighlights = [];
        
        // Also clear all path-number elements
        document.querySelectorAll('.path-number').forEach(element => {
            if (element.parentNode) {
                element.parentNode.removeChild(element);
            }
        });
    }
    
    /**
     * Calculate a direct movement vector towards a target
     * For use when pathfinding fails or is disabled
     * @param {number} targetX - Target X coordinate 
     * @param {number} targetY - Target Y coordinate
     * @returns {Object} Movement vector as {x, y}
     */
    calculateDirectMovement(targetX, targetY) {
        // Get player position
        const playerX = Math.floor(gameState.player.position.x);
        const playerY = Math.floor(gameState.player.position.y);
        
        // Calculate direction vector
        const dx = targetX - playerX;
        const dy = targetY - playerY;
        
        // Normalize to single step directions
        let moveX = 0;
        let moveY = 0;
        
        if (dx > 0) moveX = 1;
        else if (dx < 0) moveX = -1;
        
        if (dy > 0) moveY = 1;
        else if (dy < 0) moveY = -1;
        
        return { x: moveX, y: moveY };
    }
}

// Export singleton instance
export default new PathfindingSystem();