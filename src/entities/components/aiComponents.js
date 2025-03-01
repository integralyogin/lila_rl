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
    this.spellPriorities = null;
    
    this.preferredMinDist = 3;
    this.preferredMaxDist = 6;
  }
  
  takeTurn() {
    const context = this._createContext();
    this._determineBehaviorType();
    
    const behavior = monsterBehaviors[this.behaviorType] || monsterBehaviors.default;
    const actionId = this._evaluateDecisionTree(behavior.decisionTree, context);
    this._executeAction(actionId, behavior, context);
  }
  
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
    
    if (this.target) {
      const pos = this.entity.getComponent('PositionComponent');
      const targetPos = this.target.getComponent('PositionComponent');
      
      if (pos && targetPos) {
        const dx = targetPos.x - pos.x;
        const dy = targetPos.y - pos.y;
        context.distanceToTarget = Math.sqrt(dx * dx + dy * dy);
      }
    }
    
    const entityData = this._getEntityData();
    if (entityData?.spells?.length > 0) {
      const spellPriorities = this.spellPriorities || 
                            (this.entity.getComponent('AIComponent')?.spellPriorities);
      
      if (spellPriorities) {
        let selectedSpell = null;
        let highestPriority = 999;
        
        const manaComp = this.entity.getComponent('ManaComponent');
        if (!manaComp) {
          context.spellId = entityData.spells[0];
        } else {
          for (const spellId of entityData.spells) {
            if (!spellPriorities[spellId]) continue;
            
            const priority = spellPriorities[spellId].priority;
            if (priority >= highestPriority) continue;
            
            const spell = this._getSpellData(spellId);
            if (!spell) continue;
            
            if (manaComp.mana < spell.manaCost) continue;
            
            const cooldown = spellPriorities[spellId].cooldown || 0;
            const lastCast = this.lastSpellCast ? this.lastSpellCast[spellId] || 0 : 0;
            if (cooldown > 0 && gameState.turn - lastCast < cooldown) continue;
            
            selectedSpell = spellId;
            highestPriority = priority;
          }
          
          context.spellId = selectedSpell || entityData.spells[0];
        }
      } else {
        context.spellId = entityData.spells[0];
      }
      
      const spell = this._getSpellData(context.spellId);
      if (spell) {
        context.spellManaCost = spell.manaCost;
        context.spellRange = spell.range;
        context.attackRange = Math.max(context.attackRange, spell.range);
      }
    }
    
    return context;
  }
  
  _determineBehaviorType() {
    if (this.behaviorType) return;
    
    const entityData = this._getEntityData();
    
    if (entityData?.behaviorType) {
      this.behaviorType = entityData.behaviorType;
      return;
    }
  }
  
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
      }
    };
    
    return spellDefaults[spellId] || null;
  }
  
  _evaluateDecisionTree(node, context) {
    if (typeof node === 'string') {
      return node;
    }
    
    return this._evaluateDecisionTree(node.evaluate(this.entity, context), context);
  }
  
  _executeAction(actionId, behavior, context) {
    const customActions = behavior.actions || {};
    
    if (actionId in customActions) {
      const result = customActions[actionId](this.entity, context);
      this._updateStateFromResult(actionId, result);
      return;
    }
    
    const result = aiBehaviorManager.execute(actionId, this.entity, context);
    this._updateStateFromResult(actionId, result);
  }
  
  _updateStateFromResult(actionId, result) {
    if (!result) return;
    
    if (actionId === 'meleeAttack' || actionId === 'castSpell') {
      this.lastAttackAt = gameState.turn;
    }
    
    if (result.isDead && !this.inArenaCombat) {
      this.target = null;
    }
  }
  
  _moveRandomly() {
    aiBehaviorManager.execute('moveRandomly', this.entity, {});
  }
  
  _moveTowardTarget() {
    aiBehaviorManager.execute('moveTowardTarget', this.entity, { target: this.target });
  }
  
  _moveAwayFromTarget() {
    aiBehaviorManager.execute('moveAwayFromTarget', this.entity, { target: this.target });
  }
  
  _attackTarget(target) {
    aiBehaviorManager.execute('meleeAttack', this.entity, { target });
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
