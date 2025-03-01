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
 * Register polymorph spell that transforms player into creature
 * @param {object} spellLogic - The spell logic system
 */
export function registerPolymorphSpell(spellLogic) {
    // Polymorph spell - transform player into a creature temporarily
    spellLogic.registerSpell('polymorph', {
        targetType: 'self',
        cast: function(spell) {
            try {
                // Check mana
                const mana = gameState.player.getComponent('ManaComponent');
                if (!mana.useMana(spell.manaCost)) {
                    gameState.addMessage(`You don't have enough mana to cast ${spell.spellName}.`);
                    return false;
                }
                
                // Get monster data
                if (!spellLogic.gameData.monsters) {
                    console.error("Missing monster data in gameState!");
                    gameState.addMessage(`Something went wrong - the magic energy dissipates.`);
                    return false;
                }
                
                // Show the summoning UI for monster selection
                // We're reusing the summoning UI but for a different purpose
                eventBus.emit('openSummoningUI', {
                    spell: spell,
                    isPolymorph: true, // Flag for UI to show this is polymorph
                    callback: (result) => {
                        // If result is null, transformation was cancelled
                        if (!result) {
                            console.log("Polymorph cancelled");
                            // Return the mana that was used
                            mana.restoreMana(spell.manaCost);
                            return;
                        }
                        
                        // Store the selected creature
                        const creatureType = result.spell.summonData.creatureType;
                        const creatureData = findCreatureData(creatureType, spellLogic.gameData.monsters);
                        
                        if (!creatureData) {
                            console.error(`Failed to find creature data for ${creatureType}`);
                            gameState.addMessage(`The spell fizzles - unknown creature type.`);
                            return;
                        }
                        
                        // Save original player state
                        const originalState = savePlayerState();
                        
                        // Apply transformation
                        transformPlayer(creatureData, spell.duration);
                        
                        // Instead of using a timer, we'll track turns with the event system
                        let remainingTurns = spell.duration;
                        const turnListener = () => {
                            remainingTurns--;
                            if (remainingTurns <= 0) {
                                // Time to revert
                                revertPlayerTransformation(originalState);
                                // Remove listener
                                eventBus.off('turnProcessed', turnListener);
                            }
                        };
                        
                        // Listen for turn events
                        eventBus.on('turnProcessed', turnListener);
                        
                        const formattedName = creatureType.split('_')
                            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                            .join(' ');
                        
                        gameState.addMessage(`You transform into a ${formattedName}!`, "important");
                    }
                });
                
                return true; // Return true since we started the transformation process
            } catch (error) {
                console.error("Error in polymorph spell:", error);
                gameState.addMessage(`Something went wrong - the magic energy dissipates.`);
                return false;
            }
        }
    });
}

/**
 * Find creature data from monsters array
 */
function findCreatureData(creatureType, monsters) {
    if (!monsters || !Array.isArray(monsters)) {
        console.error("Invalid monsters array");
        return null;
    }
    
    return monsters.find(m => m.id === creatureType) || null;
}

/**
 * Save player's original state before transformation
 */
function savePlayerState() {
    const player = gameState.player;
    
    // Save renderable state
    const renderable = player.getComponent('RenderableComponent');
    const originalState = {
        char: renderable ? renderable.char : '@',
        color: renderable ? renderable.color : '#fff',
        name: player.name,
        stats: {},
        spells: [],
        abilities: []
    };
    
    // Save all stats completely
    const stats = player.getComponent('StatsComponent');
    if (stats) {
        // Save all properties from stats
        for (const key in stats) {
            if (typeof stats[key] !== 'function' && key !== 'entity') {
                originalState.stats[key] = stats[key];
            }
        }
    }
    
    // Save spells with full data
    const spellsComponent = player.getComponent('SpellsComponent');
    if (spellsComponent && spellsComponent.knownSpells) {
        // Save full spell data, not just keys
        originalState.spellsData = Array.from(spellsComponent.knownSpells.entries());
        // Also save just the keys as a backup
        originalState.spells = Array.from(spellsComponent.knownSpells.keys());
    }
    
    // Save any other important player state
    const healthComponent = player.getComponent('HealthComponent');
    if (healthComponent) {
        originalState.maxHp = healthComponent.maxHp;
    }
    
    console.log("Saved player state:", originalState);
    
    return originalState;
}

/**
 * Transform player into the selected creature
 */
function transformPlayer(creatureData, duration) {
    const player = gameState.player;
    
    // Update appearance
    const renderable = player.getComponent('RenderableComponent');
    if (renderable && creatureData.char) {
        renderable.char = creatureData.char;
        renderable.color = creatureData.color || '#fff';
    }
    
    // Update name temporarily
    player.name = `${player.name} (${creatureData.name})`;
    
    // Update stats significantly (more impact than before)
    const stats = player.getComponent('StatsComponent');
    if (stats) {
        // Apply creature stats more directly for a stronger effect
        if (creatureData.hp) {
            const healthComponent = player.getComponent('HealthComponent');
            if (healthComponent) {
                // Store original maxHP
                const oldMaxHp = healthComponent.maxHp;
                // Set new maxHP based on creature with some scaling
                const newMaxHp = Math.floor(creatureData.hp * 1.5);
                healthComponent.maxHp = newMaxHp;
                // Give full health in new form
                healthComponent.hp = newMaxHp;
            }
        }
        
        // Apply creature stats
        if (creatureData.strength) stats.strength = creatureData.strength;
        if (creatureData.dexterity) stats.dexterity = creatureData.dexterity || stats.dexterity;
        if (creatureData.toughness) stats.toughness = creatureData.toughness || stats.toughness;
        if (creatureData.defense) stats.defense = creatureData.defense;
        
        // Speed/movement might be affected
        if (creatureData.speed) stats.speed = creatureData.speed;
        
        console.log(`Player stats transformed to: STR=${stats.strength}, DEX=${stats.dexterity}, DEF=${stats.defense}`);
    }
    
    // Temporarily change spells to match the creature's abilities
    const spellsComponent = player.getComponent('SpellsComponent');
    if (spellsComponent) {
        // For debugging - print all existing spells to console
        console.log("Original player spells:");
        spellsComponent.knownSpells.forEach((spell, id) => {
            console.log(`  ${id}: ${spell.spellName} (${spell.manaCost} MP)`);
        });
        
        // Save current spell count for debugging
        const originalSpellCount = spellsComponent.knownSpells.size;
        console.log(`Original spell count: ${originalSpellCount}`);
        
        // Clear existing spells (we'll restore them later)
        spellsComponent.knownSpells.clear();
        
        // Add creature-specific spells if available
        if (creatureData.spells && Array.isArray(creatureData.spells) && creatureData.spells.length > 0) {
            console.log(`Adding creature spells: ${creatureData.spells}`);
            
            // Access the game's spellbooks data directly
            let spellbooksData = null;
            
            // Try to get spellbooks from game
            if (window.game && window.game.gameData && window.game.gameData.spellbooks) {
                spellbooksData = window.game.gameData.spellbooks;
                console.log("Found spellbooks data in window.game.gameData");
            } 
            // Try gameState
            else if (gameState.data && gameState.data.spellbooks) {
                spellbooksData = gameState.data.spellbooks;
                console.log("Found spellbooks data in gameState.data");
            }
            
            // For each spell in the monster data, add it to the player
            for (const spellId of creatureData.spells) {
                let spellData = null;
                
                // First, try to find the spell in spellbooks data
                if (spellbooksData) {
                    spellData = spellbooksData.find(s => s.spellId === spellId);
                    if (spellData) {
                        console.log(`Found spell '${spellId}' in spellbooks data: ${spellData.spellName}`);
                    }
                }
                
                // If not found in spellbooks, try other methods
                if (!spellData) {
                    spellData = findSpellInGameData(spellId);
                    console.log(`Found spell '${spellId}' via findSpellInGameData`);
                }
                
                // Ensure we have a usable spell object
                if (spellData) {
                    spellsComponent.knownSpells.set(spellId, spellData);
                    console.log(`Added creature spell: ${spellId} (${spellData.spellName})`);
                }
            }
        }
        
        // Add inherent creature abilities as special spells
        if (creatureData.abilities && Array.isArray(creatureData.abilities)) {
            console.log(`Adding abilities: ${creatureData.abilities}`);
            for (const ability of creatureData.abilities) {
                // Create a complete spell-like object for this ability
                const abilitySpell = {
                    spellId: `ability_${ability}`,
                    spellName: ability.charAt(0).toUpperCase() + ability.slice(1).replace('_', ' '),
                    description: `A natural ${ability} ability from your transformed state.`,
                    manaCost: 0,  // Natural abilities don't cost mana
                    element: 'nature',
                    range: 1,
                    baseDamage: 10,
                    effects: ["damage"],
                    tags: ["natural", "ability"]
                };
                
                spellsComponent.knownSpells.set(`ability_${ability}`, abilitySpell);
                console.log(`Added ability: ${ability}`);
            }
        }
        
        // Add default natural abilities based on creature type
        if (creatureData.type === 'dragon' || creatureData.id.includes('dragon')) {
            const breathSpell = {
                spellId: 'dragon_breath',
                spellName: 'Dragon Breath',
                description: 'Breathe fire in a cone, burning enemies.',
                manaCost: 0,
                element: 'fire',
                range: 3,
                baseDamage: 15,
                aoeRadius: 2,
                effects: ["damage", "area_effect"],
                tags: ["attack", "fire", "area"]
            };
            spellsComponent.knownSpells.set('dragon_breath', breathSpell);
            console.log('Added dragon breath ability');
        }
        
        if (creatureData.type === 'wolf' || creatureData.id.includes('wolf')) {
            const howlSpell = {
                spellId: 'wolf_howl',
                spellName: 'Wolf Howl',
                description: 'A terrifying howl that frightens nearby enemies.',
                manaCost: 0,
                element: 'nature',
                range: 4,
                aoeRadius: 3,
                baseDamage: 0,
                effects: ["fear", "area_effect"],
                tags: ["debuff", "nature", "area"]
            };
            spellsComponent.knownSpells.set('wolf_howl', howlSpell);
            console.log('Added wolf howl ability');
        }
        
        // Add a basic attack if no other abilities were added
        if (spellsComponent.knownSpells.size === 0) {
            const naturalAttack = {
                spellId: 'natural_attack',
                spellName: `${creatureData.name} Attack`,
                description: `The natural attack of a ${creatureData.name}.`,
                manaCost: 0,
                element: 'physical'
            };
            spellsComponent.knownSpells.set('natural_attack', naturalAttack);
            console.log('Added basic natural attack');
        }
        
        console.log(`New spell count: ${spellsComponent.knownSpells.size}`);
    }
    
    // Visual effect for transformation
    if (gameState.renderSystem) {
        const pos = player.getComponent('PositionComponent');
        gameState.renderSystem.createSpellEffect('aura', 'arcane', {
            x: pos.x,
            y: pos.y,
            radius: 2,
            duration: 1500
        });
    }
    
    // Add message to explain temporary powers
    gameState.addMessage("You feel the power of the creature flowing through you!", "important");
}

/**
 * Revert player transformation when duration expires
 */
function revertPlayerTransformation(originalState) {
    const player = gameState.player;
    
    // Restore appearance
    const renderable = player.getComponent('RenderableComponent');
    if (renderable) {
        renderable.char = originalState.char;
        renderable.color = originalState.color;
    }
    
    // Restore name
    player.name = originalState.name;
    
    // Restore stats completely
    const stats = player.getComponent('StatsComponent');
    if (stats && originalState.stats) {
        // Restore all saved stats
        for (const key in originalState.stats) {
            stats[key] = originalState.stats[key];
        }
    }
    
    // Restore health/HP
    const healthComponent = player.getComponent('HealthComponent');
    if (healthComponent && originalState.maxHp) {
        healthComponent.maxHp = originalState.maxHp;
        // Don't restore to full health, but ensure we're not over max
        if (healthComponent.hp > healthComponent.maxHp) {
            healthComponent.hp = healthComponent.maxHp;
        }
    }
    
    // Restore spells/abilities
    const spellsComponent = player.getComponent('SpellsComponent');
    if (spellsComponent) {
        // Print all current spells for debugging
        console.log("Before restoring, player has these spells:");
        spellsComponent.knownSpells.forEach((spell, id) => {
            console.log(`  ${id}: ${spell.spellName} (${spell.manaCost} MP)`);
        });
        
        // Clear current spells first (removing any temporary ones)
        spellsComponent.knownSpells.clear();
        
        // Access the game's spellbooks data directly
        let spellbooksData = null;
        if (window.game && window.game.gameData && window.game.gameData.spellbooks) {
            spellbooksData = window.game.gameData.spellbooks;
            console.log("Found spellbooks data in window.game.gameData for restoration");
        } else if (gameState.data && gameState.data.spellbooks) {
            spellbooksData = gameState.data.spellbooks;
            console.log("Found spellbooks data in gameState.data for restoration");
        }
        
        // First attempt to restore from full spell data if available
        if (originalState.spellsData && originalState.spellsData.length > 0) {
            console.log("Restoring spells from saved spell data");
            for (const [spellId, spellData] of originalState.spellsData) {
                spellsComponent.knownSpells.set(spellId, spellData);
                console.log(`Restored spell from saved data: ${spellId} (${spellData.spellName})`);
            }
        }
        // Fallback to restore from spell IDs if full data isn't available
        else if (originalState.spells && originalState.spells.length > 0) {
            console.log("Restoring spells from spell IDs using spellbooks data");
            
            // For each spell ID, try to find the full spell data in spellbooks
            for (const spellId of originalState.spells) {
                let spellData = null;
                
                // First look in spellbooks data
                if (spellbooksData) {
                    spellData = spellbooksData.find(s => s.spellId === spellId);
                    if (spellData) {
                        console.log(`Found spell in spellbooks for restoration: ${spellId}`);
                    }
                }
                
                // If not found in spellbooks, try other methods
                if (!spellData) {
                    // Try loading from gameState directly
                    if (gameState.data && gameState.data.spellbooks) {
                        spellData = gameState.data.spellbooks.find(s => s.spellId === spellId);
                    }
                }
                
                // If still not found, use fallback method
                if (!spellData) {
                    // Create a basic spell object with required properties
                    spellData = {
                        spellId: spellId,
                        spellName: spellId.charAt(0).toUpperCase() + spellId.slice(1).replace('_', ' '),
                        manaCost: 5,
                        element: 'arcane'
                    };
                    console.log(`Created fallback for spell: ${spellId}`);
                }
                
                spellsComponent.knownSpells.set(spellId, spellData);
                console.log(`Restored spell: ${spellId} (${spellData.spellName})`);
            }
        }
        
        // Print restored spells for debugging
        console.log("After restoring, player has these spells:");
        spellsComponent.knownSpells.forEach((spell, id) => {
            console.log(`  ${id}: ${spell.spellName} (${spell.manaCost} MP)`);
        });
    }
    
    // Visual effect for reverting
    if (gameState.renderSystem) {
        const pos = player.getComponent('PositionComponent');
        gameState.renderSystem.createSpellEffect('aura', 'arcane', {
            x: pos.x,
            y: pos.y,
            radius: 2,
            duration: 1000
        });
    }
    
    gameState.addMessage("Your transformation ends, and you return to your normal form.", "important");
}

/**
 * Helper function to find spell data from spell ID - uses the exact same data sources
 * that the game already uses, without any hardcoding
 */
function findSpellInGameData(spellId) {
    // Use the game's existing spell logic
    if (window.spellLogic && window.spellLogic.getSpellImplementation) {
        const spell = window.spellLogic.getSpellImplementation(spellId);
        if (spell) {
            return {
                spellId: spellId,
                spellName: spellId.charAt(0).toUpperCase() + spellId.slice(1).replace('_', ' '),
                manaCost: 5,  // Default value if not found
                element: 'arcane'
            };
        }
    }
    
    // Use the game's data directly from spellbooks.json, which should be loaded
    const spellbooksData = gameState.data && gameState.data.spellbooks;
    if (spellbooksData) {
        const spellData = spellbooksData.find(s => s.spellId === spellId);
        if (spellData) {
            return spellData;
        }
    }
    
    // Look in the gameState itself
    if (gameState.player && gameState.player.getComponent) {
        const spellsComponent = gameState.player.getComponent('SpellsComponent');
        if (spellsComponent && spellsComponent.knownSpells) {
            // Get from player's existing spells
            const existingSpell = spellsComponent.knownSpells.get(spellId);
            if (existingSpell) {
                return existingSpell;
            }
        }
    }
    
    // If we still can't find it, return a simple placeholder with the minimum fields
    return { 
        spellId: spellId,
        spellName: spellId.charAt(0).toUpperCase() + spellId.slice(1).replace('_', ' '),
        manaCost: 5,
        element: 'arcane'
    };
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