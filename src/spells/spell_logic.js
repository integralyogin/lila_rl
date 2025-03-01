import gameState from '../core/gameState.js';
import { registerBoltSpells, createBoltSpell } from './implementations/boltSpells.js';
import { registerAuraSpells } from './implementations/auraSpells.js';
import { registerUtilitySpells } from './implementations/utilitySpells.js';
import { registerSummoningSpells } from './implementations/summoning.js';
import { registerAoESpells } from './implementations/aoeSpells.js';
import { 
    findEntityAtPosition, 
    handleNPCTargeting, 
    handleEntityDeath, 
    removeAuraVisualEffect 
} from './helpers.js';

class SpellLogic {
    constructor() {
        this.spellEffects = new Map();
        this.gameData = {
            monsters: null
        };
        this.registerAllSpells();
    }
    
    // Helper methods bound to this object for use in spells
    removeAuraVisualEffect = removeAuraVisualEffect;
    findEntityAtPosition = findEntityAtPosition;
    handleNPCTargeting = handleNPCTargeting;
    handleEntityDeath = handleEntityDeath;
    
    /**
     * Update game data for use in spell effects
     * @param {Object} data - The game data object
     */
    updateGameData(data) {
        this.gameData = data;
        // Only log when monsters are loaded for debugging purposes
        if (data && data.monsters) {
            console.log("SpellLogic: Loaded monster templates:", data.monsters.map(m => m.id));
        }
    }

    /**
     * Register a spell effect implementation
     * @param {string} spellId - Unique identifier for the spell
     * @param {object} implementation - Implementation object with cast and optionally target methods
     */
    registerSpell(spellId, implementation) {
        this.spellEffects.set(spellId, implementation);
    }

    /**
     * Register all spells in the system
     */
    registerAllSpells() {
        // Register bolt spells (direct damage projectiles)
        registerBoltSpells(this);
        
        // Register AoE spells (area damage)
        registerAoESpells(this);
        
        // Register aura spells (lingering damage/effects)
        registerAuraSpells(this);
        
        // Register utility spells (healing, teleports, etc)
        registerUtilitySpells(this);
        
        // Register summoning spells
        registerSummoningSpells(this);
    }
    
    /**
     * Create a standard bolt spell (firebolt, frostbolt, etc)
     */
    registerBoltSpell(spellId, element, intelligenceScale, deathMessage, missMessage, hasSlowEffect = false) {
        this.registerSpell(spellId, 
            createBoltSpell(spellId, element, intelligenceScale, deathMessage, missMessage, hasSlowEffect)
        );
    }
    
    /**
     * Determine if a spell exists in the registry
     * @param {string} spellId - The spell ID to check
     * @returns {boolean} True if the spell exists
     */
    hasSpell(spellId) {
        return this.spellEffects.has(spellId);
    }
    
    /**
     * Get the implementation for a spell
     * @param {string} spellId - The spell ID to get
     * @returns {object|null} The spell implementation or null if not found
     */
    getSpellImplementation(spellId) {
        return this.spellEffects.get(spellId) || null;
    }
    
    /**
     * Cast a spell
     * @param {string} spellId - ID of the spell to cast
     * @param {object} spell - The spell data object
     * @param {object} target - Optional target information
     * @returns {boolean} True if the spell was cast successfully
     */
    castSpell(spellId, spell, target = null) {
        if (!this.hasSpell(spellId)) {
            console.error(`No implementation found for spell: ${spellId}`);
            return false;
        }

        const implementation = this.spellEffects.get(spellId);

        // Check if this spell needs a target
        if ((implementation.targetType === 'entity' || implementation.targetType === 'location') && !target) {
            // Start targeting mode if we have a targeting method
            if (implementation.target) {
                implementation.target(spell, (selectedTarget) => {
                    // Once target is selected, cast the spell with that target
                    implementation.cast.call(this, spell, selectedTarget);
                });
                return true; // Return true as we've started the targeting process
            }
            return false; // No targeting method available
        }

        // Cast the spell directly for self-targeting spells
        return implementation.cast.call(this, spell, target);
    }
}

// Create and export a singleton instance
const spellLogic = new SpellLogic();

export default spellLogic;