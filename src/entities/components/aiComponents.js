import { Component } from './baseComponents.js';
import gameState from '../../core/gameState.js';
import aiBehaviorManager from '../ai/aiBehaviorManager.js';

// Different ally behavior patterns
const ALLY_BEHAVIORS = {
    STATIONARY_CASTER: 'stationary_caster',
    FOLLOWER: 'follower',
    GUARDIAN: 'guardian'
};

// Decision node for evaluating conditions and selecting appropriate actions
class DecisionNode {
    constructor(condition, trueAction, falseAction) {
        this.condition = condition; // Function that returns true/false
        this.trueAction = trueAction; // Action to take if condition is true
        this.falseAction = falseAction; // Action to take if condition is false
    }
    
    evaluate(entity, context) {
        if (this.condition(entity, context)) {
            return this.trueAction;
        } else {
            return this.falseAction;
        }
    }
}

// Define common behavior trees for different monster types
const monsterBehaviors = {
    'default': {
        // Default behavior for all monsters
        decisionTree: new DecisionNode(
            // No target?
            (entity, context) => !context.target,
            // True: Find player or move randomly
            new DecisionNode(
                (entity, context) => gameState.player,
                'seekPlayer',
                'moveRandomly'
            ),
            // False: Has target - check distance
            new DecisionNode(
                (entity, context) => context.distanceToTarget <= 1.5,
                'meleeAttack',
                'moveTowardTarget'
            )
        ),
        actions: {
            'seekPlayer': (entity, context) => {
                context.target = gameState.player;
                return aiBehaviorManager.execute('moveTowardTarget', entity, context);
            }
        }
    },
    
    // Ranged attacker (archers, mages)
    'ranged': {
        decisionTree: new DecisionNode(
            // No target?
            (entity, context) => !context.target,
            // True: Find player or move randomly
            new DecisionNode(
                (entity, context) => gameState.player,
                'seekPlayer',
                'moveRandomly'
            ),
            // False: Has target - check distance
            new DecisionNode(
                // Too close?
                (entity, context) => context.distanceToTarget <= context.preferredMinDist,
                'retreatFromTarget',
                new DecisionNode(
                    // In range?
                    (entity, context) => context.distanceToTarget <= context.attackRange,
                    'useRangedAttack',
                    'approachTarget'
                )
            )
        ),
        actions: {
            'seekPlayer': (entity, context) => {
                context.target = gameState.player;
                return aiBehaviorManager.execute('moveTowardTarget', entity, context);
            },
            'retreatFromTarget': (entity, context) => {
                gameState.addMessage(`${entity.name} backs away to maintain distance.`);
                return aiBehaviorManager.execute('moveAwayFromTarget', entity, context);
            },
            'approachTarget': (entity, context) => {
                gameState.addMessage(`${entity.name} moves to get within range.`);
                return aiBehaviorManager.execute('moveTowardTarget', entity, context);
            },
            'useRangedAttack': (entity, context) => {
                // For now, this is a basic ranged attack using dexterity instead of strength
                // In a full implementation, this would use different weapons/projectiles
                
                if (!context.target) return { success: false };
                
                // Target must have health
                const targetHealth = context.target.getComponent('HealthComponent');
                const stats = entity.getComponent('StatsComponent');
                
                if (!targetHealth || !stats) return { success: false };
                
                // Calculate damage based on dexterity for ranged attacks
                const baseDamage = 3 + Math.floor(stats.dexterity * 0.6);
                
                // Apply randomization (±20%)
                const variance = 0.2;
                const multiplier = 1 + (Math.random() * variance * 2 - variance);
                const finalDamage = Math.max(1, Math.floor(baseDamage * multiplier));
                
                // Apply damage
                const result = targetHealth.takeDamage ? 
                    targetHealth.takeDamage(finalDamage) : 
                    { damage: finalDamage, isDead: targetHealth.hp <= finalDamage };
                
                // Apply damage manually if takeDamage didn't work
                if (!result) {
                    targetHealth.hp -= finalDamage;
                    if (targetHealth.hp <= 0) targetHealth.hp = 0;
                }
                
                // Show attack message
                gameState.addMessage(`${entity.name} fires an arrow at ${context.target.name} for ${finalDamage} damage!`);
                
                // Check if target died
                const isDead = result?.isDead || targetHealth.hp <= 0;
                if (isDead) {
                    gameState.addMessage(`${context.target.name} is slain by ${entity.name}'s arrow!`);
                    
                    // If target is not the player, remove it
                    if (context.target !== gameState.player && !context.inArenaCombat) {
                        gameState.removeEntity(context.target.id);
                    }
                }
                
                return { 
                    success: true, 
                    damage: finalDamage, 
                    isDead: isDead 
                };
            }
        }
    },

    // Summoner - Special behavior for the summoner enemy
    'summoner': {
        decisionTree: new DecisionNode(
            // No target?
            (entity, context) => !context.target,
            // True: Find player or move randomly
            new DecisionNode(
                (entity, context) => gameState.player,
                'seekPlayer',
                'moveRandomly'
            ),
            // False: Has target - check distance and cooldown
            new DecisionNode(
                // Too close?
                (entity, context) => context.distanceToTarget <= context.preferredMinDist,
                'retreatFromTarget',
                new DecisionNode(
                    // In range for summoning?
                    (entity, context) => context.distanceToTarget <= context.attackRange,
                    new DecisionNode(
                        // Has enough mana and not on cooldown?
                        (entity, context) => {
                            const mana = entity.getComponent('ManaComponent');
                            // Summoning is expensive
                            const spellCost = context.spellManaCost || 15;
                            
                            console.log(`[AI] Summoner checking mana: Has ${mana ? mana.mana : 'no'} mana, needs ${spellCost}`);
                            
                            // Check cooldown
                            const ai = entity.getComponent('AIComponent');
                            const lastCast = ai ? ai.lastAttackAt || 0 : 0;
                            const cooldown = 3; // Default cooldown for summoning
                            
                            if (gameState.turn - lastCast < cooldown) {
                                console.log(`[AI] Summoner still on cooldown for ${cooldown - (gameState.turn - lastCast)} turns`);
                                return false;
                            }
                            
                            return mana && mana.mana >= spellCost;
                        },
                        'castSpell',
                        'moveRandomly' // If on cooldown, move around randomly
                    ),
                    'approachTarget'
                )
            )
        ),
        actions: {
            'seekPlayer': (entity, context) => {
                context.target = gameState.player;
                return aiBehaviorManager.execute('moveTowardTarget', entity, context);
            },
            'retreatFromTarget': (entity, context) => {
                gameState.addMessage(`${entity.name} backs away to prepare a summoning ritual.`);
                return aiBehaviorManager.execute('moveAwayFromTarget', entity, context);
            },
            'approachTarget': (entity, context) => {
                gameState.addMessage(`${entity.name} moves to get within summoning range.`);
                return aiBehaviorManager.execute('moveTowardTarget', entity, context);
            },
            'castSpell': (entity, context) => {
                // Get the AI Component
                const aiComp = entity.getComponent('AIComponent');
                const entityName = entity.name || entity.id;
                
                // Use the already selected spell from context
                console.log(`[AI] ${entityName} about to cast spell: ${context.spellId}`);
                
                // Mark that we're casting the spell for cooldown tracking
                if (context.spellId) {
                    // Track in AI component for all monsters
                    if (aiComp) {
                        if (!aiComp.lastSpellCast) {
                            aiComp.lastSpellCast = {};
                        }
                        aiComp.lastSpellCast[context.spellId] = gameState.turn;
                    }
                    
                    // Also track in SpellsComponent if it exists (for backward compatibility)
                    if (entity.getComponent('SpellsComponent')) {
                        const spellsComp = entity.getComponent('SpellsComponent');
                        if (!spellsComp.lastCastTime) {
                            spellsComp.lastCastTime = new Map();
                        }
                        spellsComp.lastCastTime.set(context.spellId, gameState.turn);
                    }
                }
                
                // Execute the spell casting
                const result = aiBehaviorManager.execute('castSpell', entity, context);
                
                // Mark last attack time
                if (aiComp) {
                    aiComp.lastAttackAt = gameState.turn;
                }
                
                return result;
            }
        }
    },
    
    // Spellcaster
    'spellcaster': {
        decisionTree: new DecisionNode(
            // No target?
            (entity, context) => !context.target,
            // True: Find player or move randomly
            new DecisionNode(
                (entity, context) => gameState.player,
                'seekPlayer',
                'moveRandomly'
            ),
            // False: Has target - check distance
            new DecisionNode(
                // Too close?
                (entity, context) => context.distanceToTarget <= context.preferredMinDist,
                'retreatFromTarget',
                new DecisionNode(
                    // In range for spell?
                    (entity, context) => context.distanceToTarget <= context.attackRange,
                    new DecisionNode(
                        // Has enough mana?
                        (entity, context) => {
                            const mana = entity.getComponent('ManaComponent');
                            const spellCost = context.spellManaCost || 5;
                            
                            // Debug for wizard
                            if (entity.name === 'Wizard') {
                                console.log(`[AI] Wizard checking mana: Has ${mana ? mana.mana : 'no'} mana, needs ${spellCost}`);
                            }
                            
                            // Always allow wizard to cast for testing
                            if (entity.name === 'Wizard') return true;
                            
                            return mana && mana.mana >= spellCost;
                        },
                        'castSpell',
                        'meleeAttack' // Fallback if no mana
                    ),
                    'approachTarget'
                )
            )
        ),
        actions: {
            'seekPlayer': (entity, context) => {
                context.target = gameState.player;
                return aiBehaviorManager.execute('moveTowardTarget', entity, context);
            },
            'retreatFromTarget': (entity, context) => {
                gameState.addMessage(`${entity.name} backs away to cast a spell.`);
                return aiBehaviorManager.execute('moveAwayFromTarget', entity, context);
            },
            'approachTarget': (entity, context) => {
                gameState.addMessage(`${entity.name} moves to get within spellcasting range.`);
                return aiBehaviorManager.execute('moveTowardTarget', entity, context);
            },
            'castSpell': (entity, context) => {
                // Get the AI Component
                const aiComp = entity.getComponent('AIComponent');
                const entityName = entity.name || entity.id;
                
                // Use the already selected spell from context
                console.log(`[AI] ${entityName} about to cast spell: ${context.spellId}`);
                
                // Mark that we're casting the spell for cooldown tracking
                if (context.spellId) {
                    // Track in AI component for all monsters
                    if (aiComp) {
                        if (!aiComp.lastSpellCast) {
                            aiComp.lastSpellCast = {};
                        }
                        aiComp.lastSpellCast[context.spellId] = gameState.turn;
                    }
                    
                    // Also track in SpellsComponent if it exists (for backward compatibility)
                    if (entity.getComponent('SpellsComponent')) {
                        const spellsComp = entity.getComponent('SpellsComponent');
                        if (!spellsComp.lastCastTime) {
                            spellsComp.lastCastTime = new Map();
                        }
                        spellsComp.lastCastTime.set(context.spellId, gameState.turn);
                    }
                }
                
                // Execute the spell casting
                const result = aiBehaviorManager.execute('castSpell', entity, context);
                
                // Mark last attack time
                if (aiComp) {
                    aiComp.lastAttackAt = gameState.turn;
                }
                
                return result;
            }
        }
    },
    
    // Hydra behavior - special multi-headed monster behavior
    'hydra': {
        decisionTree: new DecisionNode(
            // No target?
            (entity, context) => !context.target,
            // True: Stay idle
            'stayIdle',
            new DecisionNode(
                // Should spawn a new head? (low health, hasn't spawned recently)
                (entity, context) => {
                    // Get health component
                    const health = entity.getComponent('HealthComponent');
                    if (!health) return false;
                    
                    // Check if health is below threshold
                    const healthPercent = (health.hp / health.maxHp) * 100;
                    const healthThreshold = 50;
                    
                    // If health is below threshold, consider spawning
                    if (healthPercent < healthThreshold) {
                        // Check cooldown for spawning
                        const ai = entity.getComponent('AIComponent');
                        const lastSpawnTime = ai ? ai.lastSpawnAt || 0 : 0;
                        const spawnCooldown = 10; // Turns between spawns
                        
                        return gameState.turn - lastSpawnTime >= spawnCooldown;
                    }
                    
                    return false;
                },
                'spawnNewHead',
                new DecisionNode(
                    // In range for attack?
                    (entity, context) => context.distanceToTarget <= context.attackRange,
                    new DecisionNode(
                        // Cooldown finished?
                        (entity, context) => gameState.turn - (context.lastAttackAt || 0) >= (context.attackCooldown || 3),
                        'castSpell',
                        'stayIdle'
                    ),
                    'stayIdle'
                )
            )
        ),
        actions: {
            'stayIdle': (entity, context) => {
                // Do nothing - stationary entity
                return { success: true, action: 'idle' };
            },
            'spawnNewHead': (entity, context) => {
                console.log(`[AI] Hydra attempting to spawn a new head`);
                
                // Mark cooldown for spawning
                const ai = entity.getComponent('AIComponent');
                if (ai) {
                    ai.lastSpawnAt = gameState.turn;
                }
                
                // Change spell to spawnnewhead
                context.spellId = 'spawnnewhead';
                
                // Attempt the spawning
                return aiBehaviorManager.execute('castSpell', entity, context);
            },
            'castSpell': (entity, context) => {
                // Get the AI Component
                const aiComp = entity.getComponent('AIComponent');
                const entityName = entity.name || entity.id;
                
                // Use the already selected spell from context
                console.log(`[AI] Hydra about to cast spell: ${context.spellId}`);
                
                // Mark that we're casting the spell for cooldown tracking
                if (context.spellId) {
                    // Track in AI component for all monsters
                    if (aiComp) {
                        if (!aiComp.lastSpellCast) {
                            aiComp.lastSpellCast = {};
                        }
                        aiComp.lastSpellCast[context.spellId] = gameState.turn;
                    }
                }
                
                // Execute the spell casting
                const result = aiBehaviorManager.execute('castSpell', entity, context);
                
                // Mark last attack time
                if (aiComp) {
                    aiComp.lastAttackAt = gameState.turn;
                }
                
                return result;
            }
        }
    },
    
    // Stationary caster (basic monsters)
    'stationary': {
        decisionTree: new DecisionNode(
            // No target?
            (entity, context) => !context.target,
            // True: Stay idle
            'stayIdle',
            new DecisionNode(
                // In range for attack?
                (entity, context) => context.distanceToTarget <= context.attackRange,
                new DecisionNode(
                    // Cooldown finished?
                    (entity, context) => gameState.turn - (context.lastAttackAt || 0) >= (context.attackCooldown || 3),
                    'castSpell',
                    'stayIdle'
                ),
                'stayIdle'
            )
        ),
        actions: {
            'stayIdle': (entity, context) => {
                // Do nothing - stationary entity
                return { success: true, action: 'idle' };
            },
            'castSpell': (entity, context) => {
                // Get the AI Component
                const aiComp = entity.getComponent('AIComponent');
                const entityName = entity.name || entity.id;
                
                // Use the already selected spell from context
                console.log(`[AI] ${entityName} about to cast spell: ${context.spellId}`);
                
                // Mark that we're casting the spell for cooldown tracking
                if (context.spellId) {
                    // Track in AI component for all monsters
                    if (aiComp) {
                        if (!aiComp.lastSpellCast) {
                            aiComp.lastSpellCast = {};
                        }
                        aiComp.lastSpellCast[context.spellId] = gameState.turn;
                    }
                }
                
                // Execute the spell casting
                const result = aiBehaviorManager.execute('castSpell', entity, context);
                
                // Mark last attack time
                if (aiComp) {
                    aiComp.lastAttackAt = gameState.turn;
                }
                
                return result;
            }
        }
    }
};

// AI component - for monsters that can take actions
export class AIComponent extends Component {
    constructor(type = 'basic') {
        super();
        this.type = type;         // 'basic', 'hostile', 'friendly', 'stationary', etc.
        this.state = 'idle';      // 'idle', 'chase', 'attack', 'follow', 'cast', etc.
        this.target = null;       // Target entity
        this.lastMoveAt = 0;      // Track last movement for cooldown
        this.lastAttackAt = 0;    // Track last attack for ranged cooldowns
        this.lastSpellCast = {};  // Track last time each spell was cast, keyed by spell ID
        this.attackCooldown = 3;  // Default cooldown between attacks (in turns)
        this.attackRange = 5;     // Default range for ranged attacks
        this.behaviorType = null; // Which behavior tree to use
        this.spellPriorities = null; // Spell priorities for spellcaster entities
        
        // Behavior settings
        this.preferredMinDist = 3; // Minimum preferred distance for ranged attackers
        this.preferredMaxDist = 6; // Maximum preferred distance for ranged attackers
    }
    
    takeTurn() {
        // Create the context for AI decisions
        const context = this._createContext();
        
        // Determine the behavior type based on entity's monster type
        this._determineBehaviorType();
        
        
        // Get the behavior tree
        const behavior = monsterBehaviors[this.behaviorType] || monsterBehaviors.default;
        
        // Evaluate the decision tree to get the action to take
        const actionId = this._evaluateDecisionTree(behavior.decisionTree, context);
        
        // Execute the action
        this._executeAction(actionId, behavior, context);
    }
    
    // Create context with all information needed for decision making
    _createContext() {
        const context = {
            target: this.target,
            inArenaCombat: this.inArenaCombat || false,
            lastAttackAt: this.lastAttackAt,
            attackCooldown: this.attackCooldown,
            attackRange: this.attackRange,
            preferredMinDist: this.preferredMinDist,
            preferredMaxDist: this.preferredMaxDist,
            distanceToTarget: Infinity
        };
        
        
        // Calculate distance to target if available
        if (this.target) {
            const pos = this.entity.getComponent('PositionComponent');
            const targetPos = this.target.getComponent('PositionComponent');
            
            if (pos && targetPos) {
                const dx = targetPos.x - pos.x;
                const dy = targetPos.y - pos.y;
                context.distanceToTarget = Math.sqrt(dx * dx + dy * dy);
            }
        }
        
        // Add spell information if entity has spells
        const entityData = this._getEntityData();
        if (entityData && entityData.spells && entityData.spells.length > 0) {
            // Check for spell priorities in AI configuration
            const spellPriorities = this.spellPriorities || 
                                    (this.entity.getComponent('AIComponent')?.spellPriorities);
            
            if (spellPriorities) {
                // Try to find a spell based on priorities
                let selectedSpell = null;
                let highestPriority = 999;
                
                // Check the mana component
                const manaComp = this.entity.getComponent('ManaComponent');
                if (!manaComp) {
                    context.spellId = entityData.spells[0];
                } else {
                    // Check each available spell
                    for (const spellId of entityData.spells) {
                        if (!spellPriorities[spellId]) continue;
                        
                        const priority = spellPriorities[spellId].priority;
                        if (priority >= highestPriority) continue;
                        
                        // Get spell data
                        const spell = this._getSpellData(spellId);
                        if (!spell) continue;
                        
                        // Check mana cost
                        if (manaComp.mana < spell.manaCost) continue;
                        
                        // Check cooldown
                        const cooldown = spellPriorities[spellId].cooldown || 0;
                        const lastCast = this.lastSpellCast ? this.lastSpellCast[spellId] || 0 : 0;
                        if (cooldown > 0 && gameState.turn - lastCast < cooldown) continue;
                        
                        // This spell passes the checks, select it
                        selectedSpell = spellId;
                        highestPriority = priority;
                    }
                    
                    // If no suitable spell was found based on priorities, just use the first one
                    context.spellId = selectedSpell || entityData.spells[0];
                    
                    // Debug spell choice 
                    if (this.entity.name === 'Wizard' || this.entity.name === 'Fire Mage') {
                        console.log(`[AI] ${this.entity.name} selected spell: ${context.spellId} based on priorities`);
                    }
                }
            } else {
                // No priorities, just use the first spell
                context.spellId = entityData.spells[0];
            }
            
            // Debug spell choice for special entities
            if (this.entity && (this.entity.name === 'Wizard' || this.entity.name === 'Fire Mage')) {
                console.log(`[AI] ${this.entity.name} has spells: ${entityData.spells.join(', ')}`);
                console.log(`[AI] ${this.entity.name} will use spell: ${context.spellId}`);
            }
            
            // Get spell data if available
            const spell = this._getSpellData(context.spellId);
            if (spell) {
                context.spellManaCost = spell.manaCost;
                context.spellRange = spell.range;
                context.attackRange = Math.max(context.attackRange, spell.range);
                
                if (this.entity && (this.entity.name === 'Wizard' || this.entity.name === 'Fire Mage')) {
                    console.log(`[AI] ${this.entity.name} spell details: Mana cost: ${spell.manaCost}, Range: ${spell.range}`);
                }
            }
        }
        
        return context;
    }
    
    // Determine what behavior tree to use based on entity type
    _determineBehaviorType() {
        if (this.behaviorType) return; // Already determined
        
        const entityName = this.entity.name ? this.entity.name.toLowerCase() : '';
        const entityId = this.entity.id || '';
        const entityData = this._getEntityData();
        
        // Check for behavior override in entity data
        if (entityData && entityData.behaviorType) {
            this.behaviorType = entityData.behaviorType;
            return;
        }
        
               
        console.log(`Determined behavior type for ${entityName}: ${this.behaviorType}`);
    }
    
    // Get entity template data
    _getEntityData() {
        // This would be enhanced to actually look up the entity in monster templates
        // For now just look for specific entities we know about
        const entityId = this.entity.id || 
                        (this.entity.name ? this.entity.name.toLowerCase().replace(/\s+/g, '_') : null);
        
       
        
        // As a fallback, check if entity has spells component and fetch from there
        const spellsComp = this.entity.getComponent('SpellsComponent');
        if (spellsComp && spellsComp.knownSpells && spellsComp.knownSpells.size > 0) {
            console.log(`[AI] Entity has SpellsComponent with ${spellsComp.knownSpells.size} spells`);
            return {
                spells: Array.from(spellsComp.knownSpells.keys()),
                behaviorType: 'spellcaster'
            };
        }
        
        return null;
    }
    
    // Get spell data
    _getSpellData(spellId) {
        // This would be enhanced to look up from spell templates
        const spellDefaults = {
            'firebolt': {
                name: 'Firebolt',
                manaCost: 5,
                baseDamage: 8,
                element: 'fire',
                range: 6,
                isSelfTargeting: false,
                message: 'hurls a bolt of fire at',
                deathMessage: 'is incinerated by'
            },
            'shockbolt': {
                name: 'Shock Bolt',
                manaCost: 5,
                baseDamage: 6,
                element: 'lightning',
                range: 5,
                isSelfTargeting: false,
                message: 'sends a bolt of electricity at',
                deathMessage: 'is electrocuted by'
            },
            'icespear': {
                name: 'Ice Spear',
                manaCost: 7,
                baseDamage: 10,
                element: 'ice',
                range: 5,
                isSelfTargeting: false,
                message: 'launches a spear of ice at',
                deathMessage: 'is frozen solid by'
            },
            'fireball': {
                name: 'Fireball',
                manaCost: 12,
                baseDamage: 14,
                element: 'fire',
                range: 6,
                aoeRadius: 2,
                isSelfTargeting: false,
                message: 'hurls a fireball at',
                deathMessage: 'is incinerated by'
            },
            'frostaura': {
                name: 'Frost Aura',
                manaCost: 2,
                baseDamage: 2,
                element: 'ice',
                range: 1,
                aoeRadius: 3,
                duration: 12,
                isSelfTargeting: true
            },
            'healing': {
                name: 'Minor Healing',
                manaCost: 8,
                healAmount: 12,
                element: 'life',
                range: 0,
                isSelfTargeting: true
            },
            'summonhydra': {
                name: 'Summon Hydra',
                manaCost: 15,
                baseDamage: 0,
                element: 'nature',
                range: 3,
                isSelfTargeting: false,
                message: 'summons a hydra near',
                deathMessage: 'is killed by',
                isSummoning: true,
                summonType: 'hydra'
            }
        };
        
        return spellDefaults[spellId] || null;
    }
    
    // Evaluate decision tree to determine action
    _evaluateDecisionTree(node, context) {
        if (typeof node === 'string') {
            // It's an action ID
            return node;
        }
        
        // It's a decision node, evaluate it
        return this._evaluateDecisionTree(node.evaluate(this.entity, context), context);
    }
    
    // Execute determined action
    _executeAction(actionId, behavior, context) {
        // Check if it's a core action
        const customActions = behavior.actions || {};
        
        if (actionId in customActions) {
            // Debug info for wizard
            if (this.entity.name === 'Wizard') {
                console.log(`[AI] Wizard executing action: ${actionId}`);
            }
            
            // Execute custom action
            const result = customActions[actionId](this.entity, context);
            
            // Debug for wizard
            if (this.entity.name === 'Wizard') {
                console.log(`[AI] Wizard action result:`, result);
            }
            
            // Update AI state based on result
            this._updateStateFromResult(actionId, result);
            return;
        }
        
        // Try as a core behavior
        const result = aiBehaviorManager.execute(actionId, this.entity, context);
        
        // Update AI state based on result
        this._updateStateFromResult(actionId, result);
    }
    
    // Update AI state based on action result
    _updateStateFromResult(actionId, result) {
        if (!result) return;
        
        // Update last attack time if it was an attack
        if (actionId === 'meleeAttack' || actionId === 'castSpell') {
            this.lastAttackAt = gameState.turn;
        }
        
        // If target died, clear target (unless in arena)
        if (result.isDead && !this.inArenaCombat) {
            this.target = null;
        }
    }
    
    // Helper: Move randomly in any direction
    _moveRandomly() {
        aiBehaviorManager.execute('moveRandomly', this.entity, {});
    }
    
    // Helper: Move toward the current target
    _moveTowardTarget() {
        aiBehaviorManager.execute('moveTowardTarget', this.entity, { target: this.target });
    }
    
    // Move away from target (for ranged fighters)
    _moveAwayFromTarget() {
        aiBehaviorManager.execute('moveAwayFromTarget', this.entity, { target: this.target });
    }
    
    // Helper: Attack target
    _attackTarget(target) {
        aiBehaviorManager.execute('meleeAttack', this.entity, { target });
    }
}

// SummonedByComponent - for entities summoned by the player or other entities
export class SummonedByComponent extends Component {
    constructor(summoner, duration = 20) {
        super();
        this.summoner = summoner;   // Entity that summoned this entity
        this.duration = duration;   // How many turns the summon lasts
        this.startTurn = null;      // Will be set when added to game
    }
    
    // Check if the summon has expired
    get isExpired() {
        if (!this.startTurn) return false;
        return (gameState.turn - this.startTurn) >= this.duration;
    }
}

export { ALLY_BEHAVIORS };
