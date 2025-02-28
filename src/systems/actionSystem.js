// ActionSystem - handles the energy-based action economy
import gameState from '../core/gameState.js';
import eventBus from '../core/eventEmitter.js';

class ActionSystem {
    constructor() {
        this.actionQueue = [];
        this.processingActions = false;
        this.BASE_ENERGY_PER_TURN = 1000;
    }
    
    /**
     * Update the action system - called once per game tick
     * This handles energy distribution and action processing
     */
    update() {
        if (this.processingActions) return;
        
        try {
            this.processingActions = true;
            
            // 0. Initialize energy for new entities
            this.initializeEnergy();
            
            // 1. Add energy to all entities with EnergyComponent
            this.distributeEnergy();
            
            // 2. Process regeneration for all entities
            this.processRegeneration();
            
            // 3. Sort entities by energy (highest first)
            this.sortEntitiesByEnergy();
            
            // 4. Process actions for entities with enough energy
            let actionsProcessed = this.processActions();
            
            // 5. If any actions were processed, update FOV and other systems
            if (actionsProcessed > 0) {
                eventBus.emit('turnProcessed');
            }
        } finally {
            this.processingActions = false;
        }
    }
    
    /**
     * Initialize energy for new entities that haven't acted yet
     */
    initializeEnergy() {
        gameState.entities.forEach(entity => {
            if (entity.hasComponent('EnergyComponent')) {
                const energyComp = entity.getComponent('EnergyComponent');
                
                // Give entities enough initial energy for their first action
                if (energyComp.energy === 0) {
                    // Give full action energy to start (1000 is standard action cost)
                    energyComp.energy = 1000;
                }
            }
        });
    }
    
    /**
     * Distribute energy to all entities with EnergyComponent
     */
    distributeEnergy() {
        gameState.entities.forEach(entity => {
            if (entity.hasComponent('EnergyComponent')) {
                const energyComp = entity.getComponent('EnergyComponent');
                energyComp.gainEnergy();
            }
        });
    }
    
    /**
     * Process regeneration for entities with HealthComponent or ManaComponent
     */
    processRegeneration() {
        gameState.entities.forEach(entity => {
            // Process HP regeneration
            if (entity.hasComponent('HealthComponent')) {
                const healthComp = entity.getComponent('HealthComponent');
                if (healthComp.hpRegen > 0) {
                    const regenAmount = healthComp.regenerate(gameState.turn);
                    if (regenAmount > 0 && entity === gameState.player) {
                        gameState.addMessage(`You regenerate ${regenAmount} health.`);
                    }
                }
            }
            
            // Process mana regeneration
            if (entity.hasComponent('ManaComponent')) {
                const manaComp = entity.getComponent('ManaComponent');
                if (manaComp.manaRegen > 0) {
                    const regenAmount = manaComp.regenerate(gameState.turn);
                    if (regenAmount > 0 && entity === gameState.player) {
                        gameState.addMessage(`You recover ${regenAmount} mana.`);
                    }
                }
            }
        });
    }
    
    /**
     * Sort entities by energy (highest first)
     */
    sortEntitiesByEnergy() {
        this.actionQueue = [];
        
        gameState.entities.forEach(entity => {
            if (entity.hasComponent('EnergyComponent')) {
                const energyComp = entity.getComponent('EnergyComponent');
                
                // Check if entity has enough energy to take any action
                if (energyComp.canAct()) {
                    this.actionQueue.push(entity);
                }
            }
        });
        
        // Sort by energy (highest first)
        this.actionQueue.sort((a, b) => {
            const aEnergy = a.getComponent('EnergyComponent').energy;
            const bEnergy = b.getComponent('EnergyComponent').energy;
            return bEnergy - aEnergy;
        });
    }
    
    /**
     * Process actions for entities with enough energy
     * Returns the number of actions processed
     */
    processActions() {
        let actionsProcessed = 0;
        
        // If no entities can act, return
        if (this.actionQueue.length === 0) {
            return actionsProcessed;
        }
        
        // Start with player if they're ready to act
        const playerIndex = this.actionQueue.findIndex(entity => entity === gameState.player);
        if (playerIndex >= 0) {
            // Ensure player goes first
            if (playerIndex > 0) {
                const player = this.actionQueue.splice(playerIndex, 1)[0];
                this.actionQueue.unshift(player);
            }
            
            // Check if player has enough energy to act
            const playerEnergy = gameState.player.getComponent('EnergyComponent');
            if (playerEnergy.canAct()) {
                // The game already handles player actions through the input system
                // We don't need to do anything here, just increase the action count
                actionsProcessed++;
            }
            
            // Process just this single frame and let player input drive the game
            return actionsProcessed;
        }
        
        // Process actions for AI entities if player isn't ready
        // Only process a limited number of actions per frame to avoid lag
        const MAX_ACTIONS_PER_FRAME = 5;
        let actionsThisFrame = 0;
        
        while (this.actionQueue.length > 0 && actionsThisFrame < MAX_ACTIONS_PER_FRAME) {
            const entity = this.actionQueue.shift();
            
            // Skip player (should have been handled earlier)
            if (entity === gameState.player) continue;
            
            // Process AI turn
            if (entity.hasComponent('AIComponent')) {
                const ai = entity.getComponent('AIComponent');
                const energy = entity.getComponent('EnergyComponent');
                
                // Make sure entity has enough energy
                if (energy.canAct()) {
                    // Process AI turn
                    ai.takeTurn();
                    
                    // Spend energy
                    if (ai.state === 'attack') {
                        energy.spendEnergy('attack');
                    } else {
                        energy.spendEnergy('move');
                    }
                    
                    actionsProcessed++;
                    actionsThisFrame++;
                }
            }
        }
        
        return actionsProcessed;
    }
    
    /**
     * Queue a specific action for an entity
     */
    queueAction(entity, actionType, target = null) {
        if (!entity.hasComponent('EnergyComponent')) return false;
        
        const energy = entity.getComponent('EnergyComponent');
        
        // Check if entity has enough energy for the action
        if (!energy.canAct(actionType)) return false;
        
        // Spend energy
        energy.spendEnergy(actionType);
        
        // Execute the action based on type
        switch (actionType) {
            case 'move':
                // Movement is handled by the input system
                break;
                
            case 'attack':
                // Attack is handled by the input system
                break;
                
            case 'cast':
                // Casting is handled by the spell system
                break;
                
            case 'use':
                // Item use is handled by the inventory system
                break;
                
            case 'wait':
                // Wait just consumes energy
                gameState.addMessage(`${entity.name} waits...`);
                break;
        }
        
        return true;
    }
}

export default ActionSystem;