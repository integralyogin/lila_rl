// Targeting system for spells and abilities
import EventEmitter from '../core/eventEmitter.js';
import gameState from '../core/gameState.js';

class TargetingSystem {
  constructor() {
    this.isTargeting = false;
    this.targetingSpell = null;
    this.targetingRange = 0;
    this.validTargets = [];
    this.currentTargetIndex = 0;
    this.targetingCallback = null;
    
    // Register event handlers
    EventEmitter.on('startTargeting', this.startTargeting.bind(this));
    EventEmitter.on('cancelTargeting', this.cancelTargeting.bind(this));
    EventEmitter.on('selectTarget', this.selectTarget.bind(this));
    EventEmitter.on('moveTarget', this.moveTarget.bind(this));
  }

  startTargeting(spellData, callback) {
    this.isTargeting = true;
    this.targetingSpell = spellData;
    this.targetingRange = spellData.range || 5;
    this.targetingCallback = callback;
    
    // Set game mode to targeting
    gameState.gameMode = 'targeting';
    
    // Store targeting data in gameState for other systems to access
    gameState.targetingData = {
      spellId: spellData.id || 'unknown',
      spell: spellData,
      range: this.targetingRange
    };
    
    // Calculate valid targets based on range
    this.calculateValidTargets();
    
    // Set initial target position to player
    const player = gameState.player;
    this.currentTarget = { x: player.position.x, y: player.position.y };
    
    // Set cursor style
    document.body.style.cursor = 'crosshair';
    
    // Emit event for other systems to respond
    EventEmitter.emit('targetingStarted', {
      spell: this.targetingSpell,
      range: this.targetingRange,
      validTargets: this.validTargets
    });
    
    // Trigger render with targeting overlay
    EventEmitter.emit('render');
  }
  
  calculateValidTargets() {
    this.validTargets = [];
    const player = gameState.player;
    const map = gameState.map;
    
    if (!player || !player.position || !map) {
      console.error('Unable to calculate valid targets - missing player position or map');
      return;
    }
    
    const playerX = player.position.x;
    const playerY = player.position.y;
    
    // Check if we're targeting with a location spell (all tiles in range are valid)
    const isLocationTargeting = this.targetingSpell && 
                               this.targetingSpell.id && 
                               this.targetingSpell.targetType === 'location';
    
    // Check all tiles within range
    for (let y = playerY - this.targetingRange; y <= playerY + this.targetingRange; y++) {
      for (let x = playerX - this.targetingRange; x <= playerX + this.targetingRange; x++) {
        // Check if within circular range
        const distance = Math.sqrt(Math.pow(x - playerX, 2) + Math.pow(y - playerY, 2));
        
        if (distance <= this.targetingRange && map.isInBounds(x, y)) {
          // Check line of sight if needed
          if (!this.targetingSpell.requiresLineOfSight || map.hasLineOfSight(playerX, playerY, x, y)) {
            // For location spells, all tiles in range are valid
            this.validTargets.push({ x, y });
          }
        }
      }
    }
    
    console.log(`Calculated ${this.validTargets.length} valid targets for ${this.targetingSpell?.id || 'unknown spell'}`);
  }
  
  moveTarget(direction) {
    if (!this.isTargeting) return;
    
    const newX = this.currentTarget.x + (direction.x || 0);
    const newY = this.currentTarget.y + (direction.y || 0);
    
    // Check if new position is valid
    if (gameState.currentMap.isInBounds(newX, newY)) {
      this.currentTarget = { x: newX, y: newY };
      EventEmitter.emit('targetMoved', this.currentTarget);
      EventEmitter.emit('render');
    }
  }
  
  /**
   * Update the targeting highlight based on mouse position
   * @param {Object} tile - The tile position {x, y}
   */
  updateTargetingHighlight(tile) {
    if (!this.isTargeting) return;
    
    // Update the current target position
    this.currentTarget = { x: tile.x, y: tile.y };
    
    // Check if this is a valid target
    const isValid = this.validTargets.some(
      target => target.x === tile.x && target.y === tile.y
    );
    
    // Emit event to update the target display
    EventEmitter.emit('targetMoved', {
      position: this.currentTarget,
      isValid: isValid
    });
    
    // Trigger render to show the updated target
    EventEmitter.emit('render');
  }
  
  selectTarget(position = null) {
    if (!this.isTargeting) return;
    
    // If a position is provided (e.g., from a click), use that position
    // Otherwise use the current target position
    const selectedPosition = position || this.currentTarget;
    
    // Check if target is valid
    const isValidTarget = this.validTargets.some(
      target => target.x === selectedPosition.x && target.y === selectedPosition.y
    );
    
    if (isValidTarget) {
      // Call callback with selected target
      if (this.targetingCallback) {
        this.targetingCallback(selectedPosition);
      }
      
      // Reset targeting state
      this.cancelTargeting();
    } else {
      // Invalid target - provide feedback
      gameState.addMessage('Target out of range', 'warning');
      
      // If this was a mouse click on invalid target, don't cancel targeting
      if (!position) {
        EventEmitter.emit('render'); // Re-render to update visual feedback
      }
    }
  }
  
  cancelTargeting() {
    if (!this.isTargeting) return;
    
    this.isTargeting = false;
    this.targetingSpell = null;
    this.validTargets = [];
    this.currentTarget = null;
    this.targetingCallback = null;
    
    // Reset game mode
    gameState.gameMode = 'exploration';
    
    // Clear targeting data
    gameState.targetingData = null;
    
    // Reset cursor style
    document.body.style.cursor = 'default';
    
    // Emit event for other systems
    EventEmitter.emit('targetingCancelled');
    
    // Trigger render to remove targeting overlay
    EventEmitter.emit('render');
  }
  
  isTargetingActive() {
    return this.isTargeting;
  }
  
  getTargetingInfo() {
    if (!this.isTargeting) return null;
    
    return {
      spell: this.targetingSpell,
      range: this.targetingRange,
      validTargets: this.validTargets,
      currentTarget: this.currentTarget,
      isValidTarget: this.validTargets.some(
        target => target.x === this.currentTarget.x && target.y === this.currentTarget.y
      )
    };
  }
}

// Singleton instance
export const targetingSystem = new TargetingSystem();