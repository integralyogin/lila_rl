import { Component } from './baseComponents.js';
import gameState from '../../core/gameState.js';
import aiBehaviorManager from '../ai/aiBehaviorManager.js';

const ALLY_BEHAVIORS = {
  STATIONARY_CASTER: 'stationary_caster',
  FOLLOWER: 'follower',
  GUARDIAN: 'guardian'
};

class DecisionNode {
  constructor(condition, trueAction, falseAction) {
    this.condition = condition;
    this.trueAction = trueAction;
    this.falseAction = falseAction;
  }
  
  evaluate(entity, context) {
    return this.condition(entity, context) ? this.trueAction : this.falseAction;
  }
}

const monsterBehaviors = {
  'default': {
    decisionTree: new DecisionNode(
      (entity, context) => !context.target,
      new DecisionNode(
        (entity, context) => gameState.player,
        'seekPlayer',
        'moveRandomly'
      ),
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
  
  'ranged': {
    decisionTree: new DecisionNode(
      (entity, context) => !context.target,
      new DecisionNode(
        (entity, context) => gameState.player,
        'seekPlayer',
        'moveRandomly'
      ),
      new DecisionNode(
        (entity, context) => context.distanceToTarget <= context.preferredMinDist,
        'retreatFromTarget',
        new DecisionNode(
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
        if (!context.target) return { success: false };
        
        const targetHealth = context.target.getComponent('HealthComponent');
        const stats = entity.getComponent('StatsComponent');
        
        if (!targetHealth || !stats) return { success: false };
        
        const baseDamage = 3 + Math.floor(stats.dexterity * 0.6);
        const variance = 0.2;
        const multiplier = 1 + (Math.random() * variance * 2 - variance);
        const finalDamage = Math.max(1, Math.floor(baseDamage * multiplier));
        
        const result = targetHealth.takeDamage ? 
          targetHealth.takeDamage(finalDamage) : 
          { damage: finalDamage, isDead: targetHealth.hp <= finalDamage };
        
        if (!result) {
          targetHealth.hp -= finalDamage;
          if (targetHealth.hp <= 0) targetHealth.hp = 0;
        }
        
        gameState.addMessage(`${entity.name} fires an arrow at ${context.target.name} for ${finalDamage} damage!`);
        
        const isDead = result?.isDead || targetHealth.hp <= 0;
        if (isDead) {
          gameState.addMessage(`${context.target.name} is slain by ${entity.name}'s arrow!`);
          
          if (context.target !== gameState.player && !context.inArenaCombat) {
            gameState.removeEntity(context.target.id);
          }
        }
        
        return { success: true, damage: finalDamage, isDead };
      }
    }
  },

  'summoner': {
    decisionTree: new DecisionNode(
      (entity, context) => !context.target,
      new DecisionNode(
        (entity, context) => gameState.player,
        'seekPlayer',
        'moveRandomly'
      ),
      new DecisionNode(
        (entity, context) => context.distanceToTarget <= context.preferredMinDist,
        'retreatFromTarget',
        new DecisionNode(
          (entity, context) => context.distanceToTarget <= context.attackRange,
          new DecisionNode(
            (entity, context) => {
              const mana = entity.getComponent('ManaComponent');
              const spellCost = context.spellManaCost || 15;
              
              const ai = entity.getComponent('AIComponent');
              const lastCast = ai ? ai.lastAttackAt || 0 : 0;
              const cooldown = 3;
              
              if (gameState.turn - lastCast < cooldown) return false;
              
              return mana && mana.mana >= spellCost;
            },
            'castSpell',
            'moveRandomly'
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
        const aiComp = entity.getComponent('AIComponent');
        
        if (context.spellId) {
          if (aiComp) {
            if (!aiComp.lastSpellCast) {
              aiComp.lastSpellCast = {};
            }
            aiComp.lastSpellCast[context.spellId] = gameState.turn;
          }
          
          if (entity.getComponent('SpellsComponent')) {
            const spellsComp = entity.getComponent('SpellsComponent');
            if (!spellsComp.lastCastTime) {
              spellsComp.lastCastTime = new Map();
            }
            spellsComp.lastCastTime.set(context.spellId, gameState.turn);
          }
        }
        
        const result = aiBehaviorManager.execute('castSpell', entity, context);
        
        if (aiComp) {
          aiComp.lastAttackAt = gameState.turn;
        }
        
        return result;
      }
    }
  },
  
  'spellcaster': {
    decisionTree: new DecisionNode(
      (entity, context) => !context.target,
      new DecisionNode(
        (entity, context) => gameState.player,
        'seekPlayer',
        'moveRandomly'
      ),
      new DecisionNode(
        (entity, context) => context.distanceToTarget <= context.preferredMinDist,
        'retreatFromTarget',
        new DecisionNode(
          (entity, context) => context.distanceToTarget <= context.attackRange,
          new DecisionNode(
            (entity, context) => {
              const mana = entity.getComponent('ManaComponent');
              const spellCost = context.spellManaCost || 5;
              if (entity.name === 'Wizard') return true;
              return mana && mana.mana >= spellCost;
            },
            'castSpell',
            'meleeAttack'
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
        const aiComp = entity.getComponent('AIComponent');
        
        if (context.spellId) {
          if (aiComp) {
            if (!aiComp.lastSpellCast) {
              aiComp.lastSpellCast = {};
            }
            aiComp.lastSpellCast[context.spellId] = gameState.turn;
          }
          
          if (entity.getComponent('SpellsComponent')) {
            const spellsComp = entity.getComponent('SpellsComponent');
            if (!spellsComp.lastCastTime) {
              spellsComp.lastCastTime = new Map();
            }
            spellsComp.lastCastTime.set(context.spellId, gameState.turn);
          }
        }
        
        const result = aiBehaviorManager.execute('castSpell', entity, context);
        
        if (aiComp) {
          aiComp.lastAttackAt = gameState.turn;
        }
        
        return result;
      }
    }
  },
  
  'hydra': {
    decisionTree: new DecisionNode(
      (entity, context) => !context.target,
      'stayIdle',
      new DecisionNode(
        (entity, context) => {
          const health = entity.getComponent('HealthComponent');
          if (!health) return false;
          
          const healthPercent = (health.hp / health.maxHp) * 100;
          const healthThreshold = 50;
          
          if (healthPercent < healthThreshold) {
            const ai = entity.getComponent('AIComponent');
            const lastSpawnTime = ai ? ai.lastSpawnAt || 0 : 0;
            const spawnCooldown = 10;
            
            return gameState.turn - lastSpawnTime >= spawnCooldown;
          }
          
          return false;
        },
        'spawnNewHead',
        new DecisionNode(
          (entity, context) => context.distanceToTarget <= context.attackRange,
          new DecisionNode(
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
        return { success: true, action: 'idle' };
      },
      'spawnNewHead': (entity, context) => {
        const ai = entity.getComponent('AIComponent');
        if (ai) {
          ai.lastSpawnAt = gameState.turn;
        }
        
        context.spellId = 'spawnnewhead';
        
        return aiBehaviorManager.execute('castSpell', entity, context);
      },
      'castSpell': (entity, context) => {
        const aiComp = entity.getComponent('AIComponent');
        
        if (context.spellId) {
          if (aiComp) {
            if (!aiComp.lastSpellCast) {
              aiComp.lastSpellCast = {};
            }
            aiComp.lastSpellCast[context.spellId] = gameState.turn;
          }
        }
        
        const result = aiBehaviorManager.execute('castSpell', entity, context);
        
        if (aiComp) {
          aiComp.lastAttackAt = gameState.turn;
        }
        
        return result;
      }
    }
  },
  
  'stationary': {
    decisionTree: new DecisionNode(
      (entity, context) => !context.target,
      'stayIdle',
      new DecisionNode(
        (entity, context) => context.distanceToTarget <= context.attackRange,
        new DecisionNode(
          (entity, context) => gameState.turn - (context.lastAttackAt || 0) >= (context.attackCooldown || 3),
          'castSpell',
          'stayIdle'
        ),
        'stayIdle'
      )
    ),
    actions: {
      'stayIdle': (entity, context) => {
        return { success: true, action: 'idle' };
      },
      'castSpell': (entity, context) => {
        const aiComp = entity.getComponent('AIComponent');
        
        if (context.spellId) {
          if (aiComp) {
            if (!aiComp.lastSpellCast) {
              aiComp.lastSpellCast = {};
            }
            aiComp.lastSpellCast[context.spellId] = gameState.turn;
          }
        }
        
        const result = aiBehaviorManager.execute('castSpell', entity, context);
        
        if (aiComp) {
          aiComp.lastAttackAt = gameState.turn;
        }
        
        return result;
      }
    }
  }
};

export class AIComponent extends Component {
  constructor(type = 'basic') {
    super();
    this.type = type;
    this.state = 'idle';
    this.target = null;
    this.lastMoveAt = 0;
    this.lastAttackAt = 0;
    this.lastSpellCast = {};
    this.attackCooldown = 3;
    this.attackRange = 5;
    this.behaviorType = null;
    this.behaviorId = null;  // ID of the behavior definition to use
    this.currentState = null; // Current state in the state machine
    this.stateTimeout = 0;   // Timer for temporary states
    this.lastKnownTargetPos = null; // Target's last known position
    this.targetLostTimer = 0;      // Timer for tracking lost targets
    this.spellPriorities = null;
    this.specialAbilities = [];    // Special abilities from JSON
    this.lastAction = null;        // Last successful action
    this.preferredMinDist = 3;
    this.preferredMaxDist = 6;
  }
  
  /**
   * Initialize AI parameters based on monster data
   * @param {object} monsterData - Data from monsters.json
   */
  initializeFromMonsterData(monsterData) {
    if (monsterData?.ai) {
      // Copy all AI properties from monster data
      Object.assign(this, monsterData.ai);
      
      // Add special abilities
      if (monsterData.specialAbilities) {
        this.specialAbilities = Array.isArray(monsterData.specialAbilities) 
          ? monsterData.specialAbilities 
          : [monsterData.specialAbilities];
      }
    }
  }
  
  /**
   * Process AI behavior using the data-driven approach
   */
  takeTurn() {
    if (!this.entity) {
      console.warn('AIComponent.takeTurn called without entity reference');
      return;
    }
    
    // If we have behaviorType but not behaviorId, try to set it
    if (this.behaviorType && !this.behaviorId && window.behaviorLoader) {
      console.log(`[AI] ${this.entity.name} has behaviorType ${this.behaviorType} but no behaviorId, setting it now`);
      this.behaviorId = window.behaviorLoader.mapAITypeToBehaviorId(this.behaviorType);
      
      // Set initial state if not already set
      if (!this.currentState && window.behaviorDefinition) {
        const behavior = window.behaviorDefinition.behaviors[this.behaviorId];
        if (behavior && behavior.initial_state) {
          this.currentState = behavior.initial_state;
        }
      }
    }
    
    // Create context for behavior processing
    const context = this._createContext();
    
    // Process behavior using behavior definition system
    if (window.behaviorDefinition && this.behaviorId) {
      console.log(`[AI] ${this.entity.name} using behavior definition, id: ${this.behaviorId}, state: ${this.currentState || 'none'}`);
      window.behaviorDefinition.processBehavior(this.entity, context);
    } else if (window.aiBehaviorManager) {
      // Fallback to basic behavior if no behavior ID is set
      console.log(`[AI] ${this.entity.name} using basic behavior (no behaviorId: ${this.behaviorId}, type: ${this.behaviorType})`);
      this._basicBehavior(context);
    } else {
      console.log(`[AI] ${this.entity.name} has no behavior system!`);
    }
  }
  
  /**
   * Create context for behavior processing
   * @returns {object} Context object with target, distance, etc.
   */
  _createContext() {
    // Get gameState from window
    const gameState = window.gameState;
    
    const context = {
      entity: this.entity,
      target: this.target,
      gameState: gameState,
      inArenaCombat: this.inArenaCombat || false,
      lastAttackAt: this.lastAttackAt,
      attackCooldown: this.attackCooldown,
      attackRange: this.attackRange,
      preferredMinDist: this.preferredMinDist,
      preferredMaxDist: this.preferredMaxDist,
      distanceToTarget: Infinity
    };
    
    // Calculate distance to target
    if (this.target) {
      const pos = this.entity.getComponent('PositionComponent');
      const targetPos = this.target.getComponent('PositionComponent');
      
      if (pos && targetPos) {
        const dx = targetPos.x - pos.x;
        const dy = targetPos.y - pos.y;
        context.distanceToTarget = Math.sqrt(dx * dx + dy * dy);
      }
    }
    
    // Get spell information
    const entityData = this._getEntityData();
    if (entityData?.spells?.length > 0) {
      context.spellId = this._selectBestSpell(entityData.spells, context);
      
      const spell = this._getSpellData(context.spellId);
      if (spell) {
        context.spellManaCost = spell.manaCost;
        context.spellRange = spell.range;
        context.attackRange = Math.max(context.attackRange, spell.range);
      }
    }
    
    return context;
  }

  /**
   * Select the best spell to cast based on priorities and context
   * @param {Array} spells - Available spells
   * @param {object} context - Context for spell selection
   * @returns {string} Selected spell ID
   */
  _selectBestSpell(spells, context) {
    const spellPriorities = this.spellPriorities || {};
    
    if (Object.keys(spellPriorities).length === 0) {
      return spells[0]; // No priorities set, use first spell
    }
    
    let selectedSpell = null;
    let highestPriority = 999;
    
    const manaComp = this.entity.getComponent('ManaComponent');
    
    for (const spellId of spells) {
      if (!spellPriorities[spellId]) continue;
      
      const priority = spellPriorities[spellId].priority;
      if (priority >= highestPriority) continue;
      
      const spell = this._getSpellData(spellId);
      if (!spell) continue;
      
      // Check if we have enough mana
      if (manaComp && manaComp.mana < spell.manaCost) continue;
      
      // Check cooldown
      const cooldown = spellPriorities[spellId].cooldown || 0;
      const lastCast = this.lastSpellCast ? this.lastSpellCast[spellId] || 0 : 0;
      const gameState = window.gameState;
      if (cooldown > 0 && gameState && gameState.turn - lastCast < cooldown) continue;
      
      // Check health threshold if specified
      if (spellPriorities[spellId].healthThreshold) {
        const healthComp = this.entity.getComponent('HealthComponent');
        if (!healthComp) continue;
        
        const healthPercent = (healthComp.hp / healthComp.maxHp) * 100;
        if (healthPercent > spellPriorities[spellId].healthThreshold) continue;
      }
      
      // Check mana threshold if specified
      if (spellPriorities[spellId].manaThreshold) {
        if (!manaComp) continue;
        
        const manaPercent = (manaComp.mana / manaComp.maxMana) * 100;
        if (manaPercent < spellPriorities[spellId].manaThreshold) continue;
      }
      
      selectedSpell = spellId;
      highestPriority = priority;
    }
    
    return selectedSpell || spells[0];
  }
  
  /**
   * Get entity data for spells
   * @returns {object} Entity data
   */
  _getEntityData() {
    const spellsComp = this.entity.getComponent('SpellsComponent');
    if (spellsComp?.knownSpells?.size > 0) {
      return {
        spells: Array.from(spellsComp.knownSpells.keys()),
        behaviorType: 'spellcaster'
      };
    }
    
    return null;
  }
  
  /**
   * Get spell data
   * @param {string} spellId - Spell ID
   * @returns {object} Spell data
   */
  _getSpellData(spellId) {
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
      },
      'spawnnewhead': {
        name: 'Spawn New Head',
        manaCost: 10,
        baseDamage: 0,
        element: 'nature',
        range: 1,
        isSelfTargeting: true,
        message: 'grows a new hydra head',
        isHydraSpawning: true
      },
      'ranged_attack': {
        name: 'Ranged Attack',
        manaCost: 0,
        baseDamage: 5,
        element: 'physical',
        range: 5,
        isSelfTargeting: false,
        message: 'fires an arrow at',
        deathMessage: 'is shot by'
      }
    };
    
    return spellDefaults[spellId] || null;
  }
  
  /**
   * Basic behavior fallback for entities without a defined behavior
   * @param {object} context - Context
   */
  _basicBehavior(context) {
    const aiBehaviorManager = window.aiBehaviorManager;
    if (!aiBehaviorManager) return;
    
    if (context.target) {
      if (context.distanceToTarget <= 1.5) {
        aiBehaviorManager.execute('meleeAttack', this.entity, context);
      } else {
        aiBehaviorManager.execute('moveTowardTarget', this.entity, context);
      }
    } else {
      aiBehaviorManager.execute('moveRandomly', this.entity, {});
    }
  }
  
  /**
   * Update state when an action is performed
   * @param {string} actionId - ID of the action
   * @param {object} result - Result of the action
   */
  updateState(actionId, result) {
    if (!result) return;
    
    const gameState = window.gameState;
    
    if (actionId === 'meleeAttack' || actionId === 'castSpell') {
      if (gameState && typeof gameState.turn !== 'undefined') {
        this.lastAttackAt = gameState.turn;
      } else {
        // Default behavior if gameState isn't available
        this.lastAttackAt = this.lastAttackAt ? this.lastAttackAt + 1 : 1;
      }
    }
    
    if (result.isDead && !this.inArenaCombat) {
      this.target = null;
    }
    
    // Store last action
    this.lastAction = actionId;
  }
  
  /**
   * Called when this component is added to an entity
   * @param {Entity} entity - The entity this component is being added to
   */
  onAdd(entity) {
    // Store reference to the entity
    this.entity = entity;
    
    // Fix missing behavior ID if we're added after the behavior system is loaded
    if (this.behaviorType && !this.behaviorId && window.behaviorLoader) {
      console.log(`[AI] Setting behaviorId for ${entity.name}, behaviorType: ${this.behaviorType}`);
      this.behaviorId = window.behaviorLoader.mapAITypeToBehaviorId(this.behaviorType);
      
      // Set initial state if it's not already set
      if (!this.currentState && window.behaviorDefinition) {
        const behavior = window.behaviorDefinition.behaviors[this.behaviorId];
        if (behavior && behavior.initial_state) {
          this.currentState = behavior.initial_state;
        }
      }
    }
  }
}

export class SummonedByComponent extends Component {
  constructor(summoner, duration = 20) {
    super();
    this.summoner = summoner;
    this.duration = duration;
    this.startTurn = null;
  }
  
  get isExpired() {
    if (!this.startTurn) return false;
    return (gameState.turn - this.startTurn) >= this.duration;
  }
}

export { ALLY_BEHAVIORS };
