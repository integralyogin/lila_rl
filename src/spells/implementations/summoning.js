import gameState from '../../core/gameState.js';
import eventBus from '../../core/eventEmitter.js';
import EntityFactory from '../../entities/entityFactory.js';
import { targetingSystem } from '../../systems/targetingSystem.js';
import summoningUI from '../../ui/summoningUI.js';

/**
 * Register summoning spells
 * @param {object} spellLogic - The spell logic system
 */
export function registerSummoningSpells(spellLogic) {
    // Generic summon spell handler
    spellLogic.registerSpell('summon', {
        targetType: 'location',
        target: (spell, callback) => {
            gameState.addMessage(`Choose a location to summon your ${spell.spellName}. Press ESC to cancel.`, "important");
            targetingSystem.startTargeting(spell, callback);
        },
        cast: function(spell, target) {
            try {
                // Validate spell cast
                if (!validateSummonSpell(spell, target)) {
                    return false;
                }
                
                // Create entity
                const summonedEntity = createSummonedEntity(spell, target, spellLogic.gameData);
                if (!summonedEntity) {
                    return false;
                }
                
                // Handle summon expiration
                setupSummonExpiration(summonedEntity);
                
                // Display success message
                gameState.addMessage(`You cast ${spell.spellName} and summon a ${summonedEntity.name}!`, "important");
                return true;
            } catch (error) {
                console.error("Error in summon spell:", error);
                gameState.addMessage(`Something went wrong - the magic energy dissipates.`);
                return false;
            }
        }
    });
    
    // Summon Creature spell (with monster selection UI)
    spellLogic.registerSpell('summoncreature', {
        targetType: 'location',
        target: (spell, callback) => {
            gameState.addMessage(`Choose a location to summon a creature. Press ESC to cancel.`, "important");
            targetingSystem.startTargeting(spell, callback);
        },
        cast: function(spell, target) {
            try {
                // Initial validation - only check mana
                if (!validateInitialSummon(spell)) {
                    return false;
                }
                
                // If target is invalid, return false
                if (!target || target.x === undefined || target.y === undefined) {
                    console.error("Invalid target for summon spell");
                    gameState.addMessage(`The spell fizzles - invalid target location.`);
                    return false;
                }
                
                // Show the summoning UI for monster selection
                eventBus.emit('openSummoningUI', {
                    spell: spell,
                    targetPosition: target,
                    callback: (result) => {
                        // If result is null, summoning was cancelled
                        if (!result) {
                            console.log("Summoning cancelled");
                            return;
                        }
                        
                        // Use the modified spell with selected creature
                        const success = spellLogic.castSpell('summon', result.spell, result.target);
                        
                        if (success) {
                            const creatureType = result.spell.summonData.creatureType;
                            const formattedName = creatureType.split('_')
                                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                                .join(' ');
                                
                            gameState.addMessage(`You successfully summoned a ${formattedName} to aid you!`, "info");
                        }
                    }
                });
                
                return true; // Return true since we started the summoning process
            } catch (error) {
                console.error("Error in summoncreature spell:", error);
                gameState.addMessage(`Something went wrong - the magic energy dissipates.`);
                return false;
            }
        }
    });
    
    // Summon Hydra spell
    spellLogic.registerSpell('summonhydra', {
        targetType: 'location',
        target: (spell, callback) => {
            gameState.addMessage(`Choose a location to summon your Hydra. Press ESC to cancel.`, "important");
            targetingSystem.startTargeting(spell, callback);
        },
        cast: function(spell, target) {
            try {
                // Prepare hydra spell data
                prepareHydraSummonData(spell);
                
                // Show summoning message
                gameState.addMessage("You begin the summoning ritual for a Hydra...", "important");
                
                // Use the generic handler
                const success = spellLogic.castSpell('summon', spell, target);
                
                if (success) {
                    gameState.addMessage("The Hydra will remain in place and attack enemies with fire breath.", "info");
                }
                
                return success;
            } catch (error) {
                console.error("Error in summonhydra spell:", error);
                gameState.addMessage(`Something went wrong - the magic energy dissipates.`);
                return false;
            }
        }
    });
}

/**
 * Validate only the initial mana for summoning UI
 */
function validateInitialSummon(spell) {
    // Check mana
    const mana = gameState.player.getComponent('ManaComponent');
    if (!mana.useMana(spell.manaCost)) {
        gameState.addMessage(`You don't have enough mana to cast ${spell.spellName}.`);
        return false;
    }
    
    return true;
}

/**
 * Validate a summon spell's parameters and use mana
 */
function validateSummonSpell(spell, target) {
    // For summoning that doesn't use the monster selection UI, check mana
    if (!spell.dontCheckMana) {
        const mana = gameState.player.getComponent('ManaComponent');
        if (!mana.useMana(spell.manaCost)) {
            gameState.addMessage(`You don't have enough mana to cast ${spell.spellName}.`);
            return false;
        }
    }
    
    // Check summon data
    if (!spell.summonData || !spell.summonData.creatureType) {
        console.error("Missing summonData.creatureType in spell");
        gameState.addMessage(`Something went wrong - the magic energy dissipates.`);
        return false;
    }
    
    // Check target
    if (!target || target.x === undefined || target.y === undefined) {
        console.error("Invalid target for summon spell");
        gameState.addMessage(`The spell fizzles - invalid target location.`);
        return false;
    }
    
    return true;
}

/**
 * Create a summoned entity
 */
function createSummonedEntity(spell, target, gameData) {
    // Initialize entity factory
    const entityFactory = new EntityFactory();
    if (!gameData.monsters) {
        console.error("Missing monster data in gameState!");
        gameState.addMessage(`Something went wrong - the magic energy dissipates.`);
        return null;
    }
    
    entityFactory.initialize({
        monsters: gameData.monsters
    });
    
    // Create entity
    const summonedEntity = entityFactory.createSummonedEntity(
        spell.summonData.creatureType,
        target.x,
        target.y,
        gameState.player,
        spell.summonData
    );
    
    if (!summonedEntity) {
        console.error(`Failed to create summoned entity of type ${spell.summonData.creatureType}`);
        gameState.addMessage(`Something went wrong - the magic energy dissipates.`);
        return null;
    }
    
    // Add to game
    gameState.addEntity(summonedEntity);
    return summonedEntity;
}

/**
 * Set up expiration tracking for summoned creatures
 */
function setupSummonExpiration(entity) {
    const checkSummonExpiration = () => {
        // If entity no longer exists, remove the listener
        if (!gameState.entities.has(entity.id)) {
            eventBus.off('turnProcessed', checkSummonExpiration);
            return;
        }
        
        // Check if the summon has expired
        const summonedBy = entity.getComponent('SummonedByComponent');
        if (summonedBy && summonedBy.isExpired) {
            gameState.addMessage(`Your summoned ${entity.name} fades away.`);
            gameState.removeEntity(entity.id);
            eventBus.off('turnProcessed', checkSummonExpiration);
        }
    };
    
    // Register the check to run each turn
    eventBus.on('turnProcessed', checkSummonExpiration);
}

/**
 * Prepare hydra summon data
 */
function prepareHydraSummonData(spell) {
    if (!spell.summonData) {
        spell.summonData = {
            creatureType: "hydra",
            name: "Summoned Hydra",
            duration: spell.duration || 30,
            isStationary: true,
            attackRange: 6,
            attackElement: "fire",
            intelligenceScaling: {
                hp: 0.8,
                strength: 0.4,
                defense: 0.2,
                intelligence: 0.5
            }
        };
    } else {
        // Ensure the hydra is stationary
        spell.summonData.isStationary = true;
    }
}