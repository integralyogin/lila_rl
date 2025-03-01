import gameState from '../core/gameState.js';
import eventBus from '../core/eventEmitter.js';
import { KEYS, TILE_TYPES } from '../constants.js';
import { allyLogic, ALLY_BEHAVIORS } from '../entities/ally_logic.js';
import combatSystem from './combatSystem.js';

class AISystem {
  constructor() { }
  
  processEntityTurns() {
    if (!gameState.player) return;
    
    let entityArray = gameState._entitiesArray || 
      (gameState.entities instanceof Map ? Array.from(gameState.entities.values()) : 
      (Array.isArray(gameState.entities) ? gameState.entities : []));
    
    for (let entity of entityArray) {
      if (!entity || entity === gameState.player) continue;
      
      // Skip polymorphed entities in the main game loop
      if (entity.hasComponent && entity.hasComponent('PolymorphComponent')) {
        // Update polymorph duration if needed
        const polymorphComp = entity.getComponent('PolymorphComponent');
        if (polymorphComp) polymorphComp.update();
        continue;
      }
      
      // Disable Gladiator AI to prevent issues
      if (entity.name && entity.name.toLowerCase().includes('gladiator')) {
        if (entity.getComponent && entity.getComponent('AIComponent')) entity.removeComponent('AIComponent');
        const health = entity.getComponent('HealthComponent');
        if (health) health.immortal = true;
        if (entity.position) { entity.position.x = 35; entity.position.y = 25; }
        entity.friendly = true;
      }
    }
    
    if (gameState.currentMap === "town") {
      for (let entity of entityArray) {
        if (!entity || entity === gameState.player || !entity.getComponent) continue;
        
        // Skip polymorphed entities
        if (entity.hasComponent && entity.hasComponent('PolymorphComponent')) {
          // Update polymorph duration if needed
          const polymorphComp = entity.getComponent('PolymorphComponent');
          if (polymorphComp) polymorphComp.update();
          continue;
        }
        
        const ai = entity.getComponent('AIComponent');
        if (!ai) continue;
        
        if (entity.name && entity.name.toLowerCase().includes('gladiator')) {
          entity.removeComponent('AIComponent');
          continue;
        }
        
        if (ai.state === 'hostile' || ai.target === gameState.player) {
          ai.state = 'idle'; ai.target = null;
          const entityName = entity.name ? entity.name.toLowerCase() : '';
          if (entityName.includes('wizard') || entityName.includes('mage')) {
            ai.type = 'friendly'; entity.friendly = true;
          }
        }
        
        if (ai.faction === 'ally') this.handleAllyEntity(entity);
      }
      return;
    }
    
    for (let entity of entityArray) {
      if (!entity || entity === gameState.player) continue;
      if (!entity.getComponent) { console.warn("Entity missing getComponent method:", entity); continue; }
      
      const aiComponent = entity.getComponent('AIComponent');
      if (!aiComponent) continue;
      
      if (aiComponent.faction === 'ally') this.handleAllyEntity(entity);
      else this.updateAI(entity);
    }
  }
  
  updateAI(entity) {
    if (!entity || !gameState.player) return;
    
    const aiComponent = entity.getComponent('AIComponent');
    if (!aiComponent) return;
    
    const entityPos = entity.position;
    const playerPos = gameState.player.position;
    if (!entityPos || !playerPos) return;

    if (gameState.currentMap === "town") {
      const entityName = entity.name ? entity.name.toLowerCase() : '';
      if (entityName.includes('wizard') || entityName.includes('mage') || 
          entityName.includes('gladiator') || entityName.includes('shopkeeper') || 
          entityName.includes('innkeeper') || entityName.includes('blacksmith') || 
          entity.friendly === true) {
        if (aiComponent.state !== 'hostile' && !aiComponent.target) return;
      }
    }
    
    const dx = playerPos.x - entityPos.x, dy = playerPos.y - entityPos.y;
    const distanceToPlayer = Math.sqrt(dx * dx + dy * dy);
    const canSeePlayer = this.hasLineOfSight(entityPos.x, entityPos.y, playerPos.x, playerPos.y);
    
    // Update last known position if player is visible
    if (canSeePlayer) {
      aiComponent.lastKnownTargetPos = { x: playerPos.x, y: playerPos.y };
      aiComponent.targetLostTimer = 5; // Reset timer
    }
    
    if (aiComponent.state === 'idle') {
      const entityName = entity.name ? entity.name.toLowerCase() : '';
      if (entity.friendly === true || (gameState.currentMap === "town" && 
         (entityName.includes('gladiator') || entityName.includes('wizard') || 
          entityName.includes('mage')))) return;
      
      if (canSeePlayer && distanceToPlayer < (aiComponent.aggroRange || 8)) {
        aiComponent.state = 'hostile'; aiComponent.target = gameState.player;
        
        // Set initial state from behavior if available
        if (window.behaviorDefinition && aiComponent.behaviorId) {
          const behavior = window.behaviorDefinition.behaviors[aiComponent.behaviorId];
          if (behavior && behavior.initial_state) {
            aiComponent.currentState = behavior.initial_state;
          }
        }
        
        if (!entity.alertedPlayer) {
          entity.alertedPlayer = true;
          eventBus.emit('logMessage', {message: `The ${entity.name} notices you!`, type: 'warning'});
        }
      }
    }
    
    if (aiComponent.state === 'hostile' && aiComponent.target) {
      // Process behavior using takeTurn method, which now uses the data-driven system
      if (typeof aiComponent.takeTurn === 'function') {
        aiComponent.takeTurn();
        return;
      }
      
      // Fall back to hardcoded behavior if takeTurn isn't available
      const hasSpells = entity.getComponent('SpellsComponent')?.knownSpells?.size > 0;
      const hasMana = entity.getComponent('ManaComponent')?.mana > 0;
      
      if (hasSpells && hasMana && distanceToPlayer <= 6 && distanceToPlayer > 1.5) {
        const spellsComponent = entity.getComponent('SpellsComponent');
        const spellId = Array.from(spellsComponent.knownSpells.keys())[0];
        const spell = spellsComponent.knownSpells.get(spellId);
        const context = {
          target: gameState.player, 
          spellId, 
          spellManaCost: spell.manaCost || 5
        };
        
        const aiBehaviorManager = window.aiBehaviorManager || 
          (window.AIBehaviorManager ? new window.AIBehaviorManager() : null);
        
        if (aiBehaviorManager) {
          aiBehaviorManager.execute('castSpell', entity, context);
        } else {
          if (distanceToPlayer <= 1.5) this.entityAttack(entity, gameState.player);
          else this.moveTowardTarget(entity, playerPos.x, playerPos.y);
        }
      } 
      else if (distanceToPlayer <= 1.5) this.entityAttack(entity, gameState.player);
      else if (canSeePlayer) this.moveTowardTarget(entity, playerPos.x, playerPos.y);
      else if (aiComponent.lastKnownTargetPos && aiComponent.targetLostTimer > 0) {
        // Move toward last known position if target is lost
        aiComponent.targetLostTimer--;
        this.moveTowardTarget(entity, aiComponent.lastKnownTargetPos.x, aiComponent.lastKnownTargetPos.y);
      }
      else if (Math.random() < 0.7) this.moveRandomly(entity);
    } 
    else if (Math.random() < 0.3) this.moveRandomly(entity);
    
    // Process special abilities
    if (window.behaviorDefinition && aiComponent.specialAbilities && aiComponent.specialAbilities.length > 0) {
      window.behaviorDefinition.processAbilities(entity, 'turn_start', {
        entity,
        gameState: gameState
      });
    }
  }
  
  entityAttack(attacker, target) {
    if (!attacker || !target || !attacker.health || !target.health) return;
    
    const attackerStats = attacker.getComponent('StatsComponent');
    const targetStats = target.getComponent('StatsComponent');
    
    let attackValue = attackerStats ? attackerStats.strength : 3;
    let defenseValue = targetStats ? targetStats.dexterity : 5;
    let damageValue = attackerStats ? Math.floor(attackerStats.strength / 3) + 1 : 1;
    
    const hitChance = Math.min(0.8, Math.max(0.2, 0.5 + (attackValue - defenseValue) * 0.05));
    
    if (Math.random() <= hitChance) {
      const armorClass = combatSystem.getEntityArmorClass(target);
      const finalDamage = Math.max(1, damageValue - Math.floor(armorClass / 2));
      
      target.health.hp -= finalDamage;
      eventBus.emit('logMessage', {
        message: `The ${attacker.name} hits you for ${finalDamage} damage!`, type: 'danger'
      });
      
      if (target.health.hp <= 0) {
        gameState.player.health.hp = 0;
        eventBus.emit('logMessage', {message: 'You have died! Game over.', type: 'danger'});
        gameState.gameMode = 'gameOver';
        eventBus.emit('gameOver');
      }
    } else {
      eventBus.emit('logMessage', {message: `The ${attacker.name} misses you.`, type: 'info'});
    }
  }
  
  handleAllyEntity(entity) {
    try {
      if (entity.getComponent('SummonedByComponent')) {
        const entityId = entity.id;
        const pos = entity.getComponent('PositionComponent');
        if (!pos) return;
        
        const ai = entity.getComponent('AIComponent');
        if (!ai) return;
        
        const entityName = entity.name ? entity.name.toLowerCase() : '';
        const entityType = entityName.includes('hydra') ? 'hydra' : entity.type || 'generic';
        let behavior = ALLY_BEHAVIORS.FOLLOWER;
        
        if (entityType === 'hydra' || ai.behaviorType === 'stationary')
          behavior = ALLY_BEHAVIORS.STATIONARY_CASTER;
        
        if (!allyLogic.isRegistered || !allyLogic.isRegistered(entityId))
          allyLogic.registerSummonedCreature(entityId, pos.x, pos.y, behavior);
        
        if (allyLogic && typeof allyLogic.handleAllyTurn === 'function')
          allyLogic.handleAllyTurn(entity);
      }
    } catch (error) { console.error(`Error in handleAllyEntity: ${error.message}`, error); }
  }
  
  moveTowardTarget(entity, targetX, targetY) {
    const pos = entity.position;
    const dx = targetX - pos.x, dy = targetY - pos.y;
    
    if (Math.abs(dx) > Math.abs(dy)) {
      if (!this.isPositionBlocked(pos.x + Math.sign(dx), pos.y)) {
        entity.position.x += Math.sign(dx); return;
      }
      if (!this.isPositionBlocked(pos.x, pos.y + Math.sign(dy))) {
        entity.position.y += Math.sign(dy); return;
      }
    } else {
      if (!this.isPositionBlocked(pos.x, pos.y + Math.sign(dy))) {
        entity.position.y += Math.sign(dy); return;
      }
      if (!this.isPositionBlocked(pos.x + Math.sign(dx), pos.y)) {
        entity.position.x += Math.sign(dx); return;
      }
    }
  }
  
  moveRandomly(entity) {
    const directions = [
      {x:0,y:-1}, {x:1,y:-1}, {x:1,y:0}, {x:1,y:1}, 
      {x:0,y:1}, {x:-1,y:1}, {x:-1,y:0}, {x:-1,y:-1}
    ];
    
    for (let i = directions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [directions[i], directions[j]] = [directions[j], directions[i]];
    }
    
    for (const dir of directions) {
      const newX = entity.position.x + dir.x, newY = entity.position.y + dir.y;
      if (!this.isPositionBlocked(newX, newY)) {
        entity.position.x = newX; entity.position.y = newY; return;
      }
    }
  }
  
  isPositionBlocked(x, y) {
    if (!gameState.map || x < 0 || y < 0 || x >= gameState.map.width || y >= gameState.map.height) return true;
    
    const tile = gameState.map.getTile(x, y);
    if (!tile || tile.blocked) return true;
    
    let entityArray = gameState._entitiesArray || 
      (gameState.entities instanceof Map ? Array.from(gameState.entities.values()) : 
      (Array.isArray(gameState.entities) ? gameState.entities : []));
    
    for (const entity of entityArray) {
      if (entity.position && entity.position.x === x && entity.position.y === y) {
        if (entity.blockMovement || (entity.getComponent && entity.getComponent('BlocksMovementComponent')))
          return true;
      }
    }
    return false;
  }
  
  hasLineOfSight(x1, y1, x2, y2) {
    const dx = Math.abs(x2 - x1), dy = Math.abs(y2 - y1);
    const sx = x1 < x2 ? 1 : -1, sy = y1 < y2 ? 1 : -1;
    let err = dx - dy, x = x1, y = y1;
    
    while (x !== x2 || y !== y2) {
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 < dx) { err += dx; y += sy; }
      
      if (x === x1 && y === y1) continue;
      if (x === x2 && y === y2) continue;
      
      const tile = gameState.map.getTile(x, y);
      if (!tile || tile.blocksVision) return false;
    }
    return true;
  }
}

const aiSystem = new AISystem();
export default aiSystem;
