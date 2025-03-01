/**
 * Data-driven behavior definition system for AI entities
 * This module processes behavior definitions from JSON data
 */

class BehaviorDefinition {
  constructor() {
    this.behaviors = {};
    this.actions = {
      // Movement actions
      moveTowardTarget: (entity, context) => {
        // Implementation or call to existing behavior manager
        if (context.gameState.aiBehaviorManager) {
          return context.gameState.aiBehaviorManager.moveTowardTarget(entity, context.target);
        }
        return false;
      },
      moveAwayFromTarget: (entity, context) => {
        if (context.gameState.aiBehaviorManager) {
          return context.gameState.aiBehaviorManager.moveAwayFromTarget(entity, context.target);
        }
        return false;
      },
      moveRandomly: (entity, context) => {
        if (context.gameState.aiBehaviorManager) {
          return context.gameState.aiBehaviorManager.moveRandomly(entity);
        }
        return false;
      },
      // Combat actions
      meleeAttack: (entity, context) => {
        if (context.gameState.aiBehaviorManager) {
          return context.gameState.aiBehaviorManager.meleeAttack(entity, context.target);
        }
        return false;
      },
      castSpell: (entity, context) => {
        // Get the spell to cast based on context.params
        const spellId = context.params?.spellId;
        
        // Special handling for Fire Mage - always use fireball
        if (entity.name === 'Fire Mage' && !spellId) {
          context.params = { spellId: 'fireball' };
        }
        
        // Get the spell ID to use
        const finalSpellId = context.params?.spellId || spellId;
        
        // Get the aiBehaviorManager from where we can find it
        const aiBehaviorManager = window.aiBehaviorManager || 
                                 (context.gameState?.aiBehaviorManager) || 
                                 null;
        
        if (aiBehaviorManager) {
          if (typeof aiBehaviorManager.execute === 'function') {
            // Use the proper execute method with the castSpell behavior ID
            return aiBehaviorManager.execute('castSpell', entity, {
              ...context,
              spellId: finalSpellId
            });
          } else {
            return false;
          }
        } else {
          return false;
        }
      },
      // State actions
      setState: (entity, context) => {
        const ai = typeof entity.getComponent === 'function' 
                   ? entity.getComponent('AIComponent') 
                   : entity.components?.ai;
        
        if (ai) {
          ai.currentState = context.params.state;
          if (context.params.duration) {
            ai.stateTimeout = context.params.duration;
          }
          return true;
        }
        return false;
      },
      // Special abilities
      useSpecialAbility: (entity, context) => {
        const abilityId = context.params?.abilityId;
        
        const ai = typeof entity.getComponent === 'function' 
                   ? entity.getComponent('AIComponent') 
                   : entity.components?.ai;
        
        if (ai && ai.specialAbilities) {
          // Find the ability either by object key or array find
          let ability = null;
          
          if (Array.isArray(ai.specialAbilities)) {
            ability = ai.specialAbilities.find(a => a.id === abilityId);
          } else if (typeof ai.specialAbilities === 'object') {
            ability = ai.specialAbilities[abilityId];
          }
          
          if (ability) {
            // Call the special ability handler
            if (ability.effect === 'heal') {
              this.handleHealEffect(entity, ability);
            } else if (ability.effect === 'extra_attack') {
              this.handleExtraAttack(entity, context.target, ability);
            }
            return true;
          }
        }
        
        return false;
      }
    };
  }

  // Helper methods for handling special abilities
  handleHealEffect(entity, ability) {
    if (entity.components.health) {
      const healthComponent = entity.components.health;
      let amount = 0;
      
      if (typeof ability.amount === 'number') {
        amount = ability.amount;
      } else if (typeof ability.amount === 'string' && ability.amount.endsWith('%')) {
        // Handle percentage-based healing
        const percentage = parseFloat(ability.amount) / 100;
        amount = Math.floor(healthComponent.maxHealth * percentage);
      }
      
      if (amount > 0) {
        healthComponent.health = Math.min(healthComponent.health + amount, healthComponent.maxHealth);
        return true;
      }
    }
    return false;
  }
  
  handleExtraAttack(entity, target, ability) {
    // Implementation for extra attacks
    if (entity.components.combat && target) {
      // For this example, just call the melee attack multiple times
      const attackCount = typeof ability.amount === 'number' ? ability.amount : 1;
      
      for (let i = 0; i < attackCount; i++) {
        if (this.actions.meleeAttack) {
          this.actions.meleeAttack(entity, { target });
        }
      }
      return true;
    }
    return false;
  }

  /**
   * Register a new behavior definition
   * @param {string} id - Identifier for the behavior
   * @param {object} definition - Behavior definition object
   */
  registerBehavior(id, definition) {
    this.behaviors[id] = definition;
  }
  
  /**
   * Register a custom action
   * @param {string} id - Action identifier
   * @param {function} implementation - Action implementation function
   */
  registerAction(id, implementation) {
    this.actions[id] = implementation;
  }

  /**
   * Evaluate a condition
   * @param {object} condition - Condition to evaluate
   * @param {object} context - Evaluation context
   * @returns {boolean} Whether the condition is met
   */
  evaluateCondition(condition, context) {
    if (!condition) return true;
    
    const { entity, target, gameState } = context;
    
    switch (condition.type) {
      case 'distanceToTarget':
        if (!target) return false;
        
        const entityPos = typeof entity.getComponent === 'function' 
                        ? entity.getComponent('PositionComponent') 
                        : entity.components?.position;
        const targetPositionComp = typeof target.getComponent === 'function' 
                                 ? target.getComponent('PositionComponent') 
                                 : target.components?.position;
        
        if (!entityPos || !targetPositionComp) return false;
        
        // Use manual distance calculation instead of relying on map.getDistance
        const dx = targetPositionComp.x - entityPos.x;
        const dy = targetPositionComp.y - entityPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        return this.compareValues(distance, condition.op, condition.value);
        
      case 'hp':
        const health = typeof entity.getComponent === 'function' 
                  ? entity.getComponent('HealthComponent') 
                  : entity.components?.health;
        if (!health) return false;
        
        let hpValue = health.hp || health.health;
        let compareValue = condition.value;
        
        // Handle percentage values
        if (typeof condition.value === 'string' && condition.value.endsWith('%')) {
          const percentage = parseFloat(condition.value) / 100;
          const maxHealth = health.maxHp || health.maxHealth;
          compareValue = Math.floor(maxHealth * percentage);
        }
        
        return this.compareValues(hpValue, condition.op, compareValue);
        
      case 'lastAction':
        const aiComp = typeof entity.getComponent === 'function' 
                      ? entity.getComponent('AIComponent') 
                      : entity.components?.ai;
        if (!aiComp || !aiComp.lastAction) return false;
        return aiComp.lastAction === condition.value;
        
      case 'state':
        const aiComponent = typeof entity.getComponent === 'function' 
                          ? entity.getComponent('AIComponent') 
                          : entity.components?.ai;
        if (!aiComponent || !aiComponent.currentState) return false;
        return aiComponent.currentState === condition.value;
        
      case 'hasClearShot':
        if (!target || !gameState.map) return false;
        
        const positionEntity = typeof entity.getComponent === 'function' 
                            ? entity.getComponent('PositionComponent') 
                            : entity.components?.position;
        const targetPosObj = typeof target.getComponent === 'function' 
                           ? target.getComponent('PositionComponent') 
                           : target.components?.position;
        
        if (!positionEntity || !targetPosObj) return false;
        
        return gameState.map.hasLineOfSight(
          positionEntity.x, 
          positionEntity.y,
          targetPosObj.x,
          targetPosObj.y
        );
        
      case 'hasSpell':
        const spellcasterComp = typeof entity.getComponent === 'function' 
                              ? entity.getComponent('SpellsComponent') 
                              : entity.components?.spellcaster;
        if (!spellcasterComp || !spellcasterComp.knownSpells) {
          return false;
        }
        
        // Check if knownSpells is a Map or an array
        if (spellcasterComp.knownSpells instanceof Map) {
          return spellcasterComp.knownSpells.has(condition.value);
        } else if (Array.isArray(spellcasterComp.knownSpells)) {
          return spellcasterComp.knownSpells.includes(condition.value);
        } else {
          return false;
        }
        
      case 'spellCooldown':
        const spellcasterObj = typeof entity.getComponent === 'function' 
                             ? entity.getComponent('SpellsComponent') 
                             : entity.components?.spellcaster;
        if (!spellcasterObj || !spellcasterObj.cooldowns) {
          return false;
        }
        const cooldown = spellcasterObj.cooldowns[condition.spellId] || 0;
        return this.compareValues(cooldown, condition.op, condition.value);
        
      default:
        return false;
    }
  }
  
  /**
   * Helper to compare values with different operators
   */
  compareValues(a, op, b) {
    switch (op) {
      case '==': return a === b;
      case '!=': return a !== b;
      case '<': return a < b;
      case '<=': return a <= b;
      case '>': return a > b;
      case '>=': return a >= b;
      default: return false;
    }
  }

  /**
   * Process entity behavior based on its behavior definition
   * @param {object} entity - Entity to process behavior for
   * @param {object} context - Context for behavior processing
   * @returns {boolean} Whether a behavior was executed
   */
  processBehavior(entity, context) {
    // Get AI component using getComponent method if available, otherwise try direct access
    const ai = typeof entity.getComponent === 'function' 
              ? entity.getComponent('AIComponent') 
              : (entity.components?.ai || null);
    
    if (!ai) {
      return false;
    }
    
    // Get behavior ID from AI component
    const behaviorId = ai.behaviorId;
    
    // If no behavior is defined, do nothing
    if (!behaviorId) {
      return false;
    }
    
    if (!this.behaviors[behaviorId]) {
      return false;
    }
    
    const behavior = this.behaviors[behaviorId];
    
    // Process state transitions if defined
    if (ai.currentState && behavior.states && behavior.states[ai.currentState]) {
      const state = behavior.states[ai.currentState];
      
      // Check state transitions
      if (state.transitions) {
        for (const transition of state.transitions) {
          // Handle case where multiple conditions are incorrectly defined in behavior file
          const conditions = Array.isArray(transition.condition) 
                          ? transition.condition 
                          : [transition.condition];
          
          // A transition passes if all conditions are met
          let allConditionsMet = true;
          
          for (const condition of conditions) {
            const conditionMet = this.evaluateCondition(condition, context);
            
            if (!conditionMet) {
              allConditionsMet = false;
              break;
            }
          }
          
          if (allConditionsMet) {
            ai.currentState = transition.target;
            
            // Execute onEnter actions for the new state if defined
            const newState = behavior.states[ai.currentState];
            if (newState && newState.onEnter) {
              for (const actionId of newState.onEnter) {
                this.executeAction(entity, actionId, context);
              }
            }
            break;
          }
        }
      }
      
      // Execute state action if defined
      if (state.action) {
        return this.executeAction(entity, state.action, context);
      }
    }
    
    // If no state system or current state has no action, process priority-based actions
    if (behavior.actions && behavior.actions.priority) {
      for (const actionId of behavior.actions.priority) {
        // Check conditions for this action
        let shouldExecute = true;
        
        if (behavior.conditions) {
          const conditions = behavior.conditions.filter(c => c.action === actionId);
          shouldExecute = conditions.some(c => this.evaluateCondition(c, context));
        }
        
        if (shouldExecute) {
          const result = this.executeAction(entity, actionId, context);
          if (result) {
            return true;
          }
        }
      }
    }
    
    return false;
  }
  
  /**
   * Execute an action by ID
   * @param {object} entity - Entity performing the action
   * @param {string} actionId - ID of the action to execute
   * @param {object} context - Context for the action
   * @returns {boolean} Whether the action executed successfully
   */
  executeAction(entity, actionId, context) {
    if (this.actions[actionId]) {
      // Get AI component
      const ai = typeof entity.getComponent === 'function' 
                ? entity.getComponent('AIComponent') 
                : (entity.components?.ai || null);
      
      if (!ai) {
        return false;
      }
      
      // Add any action-specific parameters from the behavior definition
      const behavior = this.behaviors[ai.behaviorId];
      if (behavior && behavior.actionParams && behavior.actionParams[actionId]) {
        context.params = behavior.actionParams[actionId];
      }
      
      const result = this.actions[actionId](entity, context);
      
      // Update entity state with the result
      if (ai && typeof ai.updateState === 'function') {
        ai.updateState(actionId, result);
      }
      
      // Store the last action
      if (ai) {
        ai.lastAction = actionId;
      }
      
      return result;
    }
    
    return false;
  }
  
  /**
   * Process special abilities based on triggers
   * @param {object} entity - Entity with abilities
   * @param {string} trigger - The trigger event (turn_start, damaged, etc.)
   * @param {object} context - Additional context for the trigger
   */
  processAbilities(entity, trigger, context) {
    if (!entity.components.ai || !entity.components.ai.specialAbilities) {
      return;
    }
    
    const abilities = entity.components.ai.specialAbilities;
    for (const ability of abilities) {
      if (ability.trigger === trigger) {
        // Check condition if it exists
        let conditionMet = true;
        if (ability.condition) {
          // Parse condition - supports simple conditions like "hp < 50%"
          const parts = ability.condition.split(/\s+/);
          if (parts.length === 3) {
            const [param, op, value] = parts;
            if (param === 'hp' && entity.components.health) {
              const currentHp = entity.components.health.health;
              let compareValue = parseFloat(value);
              
              if (value.endsWith('%')) {
                compareValue = entity.components.health.maxHealth * (parseFloat(value) / 100);
              }
              
              conditionMet = this.compareValues(currentHp, op, compareValue);
            }
          }
        }
        
        if (conditionMet) {
          // Execute the ability
          if (ability.effect === 'heal') {
            this.handleHealEffect(entity, ability);
          } else if (ability.action) {
            // Use the action system to execute the ability
            const actionContext = { 
              ...context, 
              params: ability.params || {} 
            };
            this.executeAction(entity, ability.action, actionContext);
          }
        }
      }
    }
  }
}

// Export singleton
const behaviorDefinition = new BehaviorDefinition();
export default behaviorDefinition;