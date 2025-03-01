import gameState from '../core/gameState.js';

/**
 * Helper method to find an entity at a specific position
 * @param {Object} target - The position {x, y} to search
 * @returns {Entity|null} - The entity at that position or null if none found
 */
export function findEntityAtPosition(target) {
    if (!target || typeof target.x !== 'number' || typeof target.y !== 'number') {
        console.warn('Invalid target position:', target);
        return null;
    }
    
    return Array.from(gameState.entities.values()).find(e => {
        if (e.hasComponent('PositionComponent')) {
            const pos = e.getComponent('PositionComponent');
            return pos.x === target.x && pos.y === target.y && e.hasComponent('HealthComponent');
        }
        return false;
    });
}

/**
 * Helper for targeting hostile NPCs and handling confirmation
 * @param {object} entity - The entity to potentially target 
 * @param {object} spell - The spell being cast
 * @returns {boolean} - Whether to proceed with the attack
 */
export function handleNPCTargeting(entity, spell) {
    // Not an NPC or already hostile
    if (!entity || !entity.hasComponent('AIComponent')) {
        return true;
    }
    
    const ai = entity.getComponent('AIComponent');
    if (ai.state !== 'idle') {
        console.log(`[handleNPCTargeting] ${entity.name} is already in state ${ai.state}`);
        return true; // Already hostile, proceed with attack
    }
    
    // Debug info
    console.log(`[handleNPCTargeting] Preparing to target ${entity.name} with AI type: ${ai.type}`); 
    
    // Confirm attack on peaceful NPC
    const proceedWithAttack = window.confirm(
        `Do you want to attack ${entity.name} with ${spell.name}? This might have serious consequences.`
    );
    
    if (!proceedWithAttack) {
        gameState.addMessage(`You redirect your ${spell.name} spell away from ${entity.name} at the last moment.`);
        return false;
    }
    
    // Make NPC hostile
    gameState.addMessage(`You deliberately target ${entity.name} with your ${spell.name}!`, 'danger');
    
    // Explicitly activate combat AI
    ai.state = 'attack';
    ai.target = gameState.player;
    
    // Force spellcaster behavior for wizards and mages
    const entityName = entity.name ? entity.name.toLowerCase() : '';
    if (entityName.includes('wizard') || entityName.includes('mage')) {
        ai.behaviorType = 'spellcaster';
        ai.type = 'hostile'; // Ensure it's properly hostile
        
        // Get reference to the spells component if any
        const spellsComp = entity.getComponent('SpellsComponent');
        if (!spellsComp || !spellsComp.knownSpells || spellsComp.knownSpells.size === 0) {
            console.log(`[handleNPCTargeting] ${entity.name} doesn't have proper spells - forcing firebolt`);
            
            // If no spells, add firebolt directly to context
            if (!entity.hasContext) entity.context = {};
            entity.context.spellId = 'firebolt';
        }
    }
    
    console.log(`[handleNPCTargeting] ${entity.name} is now hostile! State: ${ai.state}, Target: Player, Behavior: ${ai.behaviorType || 'default'}`);
    return true;
}

/**
 * Helper method to handle entity death and XP rewards
 * @param {Entity} entity - The entity that died
 * @param {string} deathMessage - Custom message to display on death
 */
export function handleEntityDeath(entity, deathMessage) {
    if (!entity) return;
    
    console.log(`[handleEntityDeath] Processing death of ${entity.name}`);
    
    // Log entity components for debugging
    if (entity.components) {
        console.log(`[handleEntityDeath] Entity components:`, Array.from(entity.components.keys()));
    }
    
    // Check immortality again as a safeguard
    const health = entity.getComponent('HealthComponent');
    if (health && health.immortal) {
        console.log(`[handleEntityDeath] WARNING: Attempting to kill immortal entity ${entity.name}!`);
        health.hp = 1; // Force restore health
        return; // Exit without killing
    }
    
    // If health is not depleted, this is a bug
    if (health && health.hp > 0) {
        console.log(`[handleEntityDeath] WARNING: Attempting to kill entity ${entity.name} with non-zero HP (${health.hp}/${health.maxHp})`);
    }
    
    // Display death message
    gameState.addMessage(deathMessage);
    
    // Award XP if it was an enemy with AI and stats
    if (entity.hasComponent('AIComponent') && entity.hasComponent('StatsComponent')) {
        const targetStats = entity.getComponent('StatsComponent');
        const playerStats = gameState.player.getComponent('StatsComponent');
        const xpGained = targetStats.level * 10;
        const didLevelUp = playerStats.addXp(xpGained);
        
        gameState.addMessage(`You gain ${xpGained} XP.`);
        if (didLevelUp) {
            gameState.addMessage(`You advance to level ${playerStats.level}!`, 'important');
        }
        
        gameState.score += xpGained;
    } else if (entity.hasComponent('DialogueComponent')) {
        // Special handling for NPCs
        gameState.addMessage(`You've killed ${entity.name}! This may have consequences...`);
    }
    
    // Remove the entity from the game
    console.log(`[handleEntityDeath] Removing entity ${entity.name} with ID ${entity.id} from game`);
    gameState.removeEntity(entity.id);
}

/**
 * Helper method to safely remove aura visual effects
 * @param {Object} auraEffect - The aura visual effect to remove
 * @param {string} reason - Reason for removal (for logging)
 */
export function removeAuraVisualEffect(auraEffect, reason) {
    if (auraEffect && auraEffect.container) {
        if (auraEffect.parentNode) {
            auraEffect.parentNode.removeChild(auraEffect);
        }
        if (auraEffect.container.parentNode) {
            auraEffect.container.parentNode.removeChild(auraEffect.container);
        }
        console.log(`Removed persistent aura visual effect due to ${reason}`);
    }
}