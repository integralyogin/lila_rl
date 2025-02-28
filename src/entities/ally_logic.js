// ally_logic.js - Specialized AI behaviors for allied creatures
import gameState from '../core/gameState.js';

// Different ally behavior types
const ALLY_BEHAVIORS = {
    STATIONARY_CASTER: 'stationary_caster',
    FOLLOWER: 'follower',
    GUARDIAN: 'guardian'
};

// Keep track of summoned creatures' original positions
const summonedPositions = new Map();

class AllyLogic {
    constructor() {
        // Nothing needed in constructor
    }
    
    // Register a summoned creature's position
    registerSummonedCreature(entityId, x, y, behavior) {
        summonedPositions.set(entityId, {
            x, 
            y, 
            behavior
        });
        console.log(`Registered summoned creature ${entityId} at position (${x}, ${y}) with behavior ${behavior}`);
    }
    
    // Handle AI turn for an allied entity
    handleAllyTurn(entity) {
        if (!entity || !entity.id) return;
        
        // Check if this is a registered stationary entity
        const summonData = summonedPositions.get(entity.id);
        if (!summonData) return false;
        
        const pos = entity.getComponent('PositionComponent');
        if (!pos) return false;
        
        // Handle different behavior types
        if (summonData.behavior === ALLY_BEHAVIORS.STATIONARY_CASTER) {
            return this.handleStationaryCaster(entity, summonData, pos);
        }
        
        return false; // Not handled
    }
    
    handleStationaryCaster(entity, summonData, pos) {
        // FORCE position to original position no matter what
        pos.x = summonData.x;
        pos.y = summonData.y;
        
        console.log(`Enforcing stationary position for ${entity.name} at (${pos.x}, ${pos.y})`);
        
        // Check cooldown
        const ai = entity.getComponent('AIComponent');
        if (!ai) return true;
        
        // Skip attack if on cooldown
        if (ai.lastAttackAt && gameState.turn - ai.lastAttackAt < (ai.attackCooldown || 3)) {
            return true;
        }
        
        // Find nearest enemy to attack
        let nearestEnemy = null;
        let minEnemyDist = Infinity;
        const attackRange = ai.attackRange || 6;
        
        gameState.entities.forEach(target => {
            // Skip self, and anything without position/health
            if (target === entity || 
                !target.hasComponent('PositionComponent') || 
                !target.hasComponent('HealthComponent')) {
                return;
            }
            
            // Check if it's a hostile entity
            const targetAI = target.getComponent('AIComponent');
            if (!targetAI || targetAI.type !== 'hostile') return;
            
            // Calculate distance
            const targetPos = target.getComponent('PositionComponent');
            const dx = targetPos.x - pos.x;
            const dy = targetPos.y - pos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            // If entity is within attack range and closer than other enemies
            if (dist <= attackRange && dist < minEnemyDist) {
                nearestEnemy = target;
                minEnemyDist = dist;
            }
        });
        
        // Attack if we found an enemy
        if (nearestEnemy) {
            this.performRangedAttack(entity, nearestEnemy);
            ai.lastAttackAt = gameState.turn;
        }
        
        return true;
    }
    
    performRangedAttack(attacker, target) {
        // Get components needed for attack
        const targetHealth = target.getComponent('HealthComponent');
        const stats = attacker.getComponent('StatsComponent');
        
        if (!targetHealth || !stats) return;
        
        // Calculate damage based on intelligence (for spellcasting)
        const damage = 6 + Math.floor(stats.intelligence * 0.5);
        
        // Apply damage
        const isDead = targetHealth.takeDamage(damage);
        
        // Show attack message with firebolt effect
        gameState.addMessage(`${attacker.name} breathes fire at ${target.name} for ${damage} damage!`);
        
        // Check if target died
        if (isDead) {
            gameState.addMessage(`${target.name} is incinerated by ${attacker.name}'s fire!`);
            
            // If target is not the player, remove it
            if (target !== gameState.player) {
                gameState.removeEntity(target.id);
            }
        }
    }
    
    // Remove a summoned creature from tracking
    unregisterSummonedCreature(entityId) {
        if (summonedPositions.has(entityId)) {
            summonedPositions.delete(entityId);
            return true;
        }
        return false;
    }
}

// Create and export a singleton instance
const allyLogic = new AllyLogic();
export { allyLogic, ALLY_BEHAVIORS };