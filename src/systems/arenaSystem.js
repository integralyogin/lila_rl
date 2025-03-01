import gameState from '../core/gameState.js';
import eventBus from '../core/eventEmitter.js';
import { BlocksMovementComponent } from '../entities/components.js';

class ArenaSystem {
  constructor() {
    this.isActive = false;
    this.fighters = [];
    this.currentFighter = 0;
    this.intervalId = null;
    this.turnDelay = 200;
    this.setupEventListeners();
  }

  setupEventListeners() {
    eventBus.on('startArenaMatch', (data) => this.startArenaMatch(data));
    eventBus.on('stopArenaMatch', () => this.stopArenaMatch());
    eventBus.on('dialogueClosed', () => {
      if (this.isActive) this.stopArenaMatch();
    });
  }

  startArenaMatch(data) {
    if (!data?.fighters || data.fighters.length < 2) return false;

    const fighters = data.fighters;
    this.isActive = true;
    this.fighters = fighters;
    this.currentFighter = 0;
    
    this.previousLocation = gameState.location;
    const previousGameMode = gameState.gameMode;
    gameState.previousGameMode = previousGameMode;
    gameState.gameMode = 'arena';
    
    this.transportToArena(() => {
      gameState.addMessage("The arena match is about to begin! Fighters take their positions.", "important");
      setTimeout(() => {
        this.addFightersToArena();
        gameState.addMessage("The crowd roars as the fight begins!", "important");
      }, 500);
    });
    
    eventBus.emit('arenaMatchStarted', { fighters: this.fighters });
    
    setTimeout(() => {
      this.intervalId = setInterval(() => this.processTurn(), this.turnDelay);
    }, 1000);
    
    return true;
  }

  stopArenaMatch() {
    if (!this.isActive) return;
    
    this.isActive = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    this.removeFightersFromArena();
    
    this.returnToPreviousLocation(() => {
      gameState.gameMode = gameState.previousGameMode || 'exploration';
      eventBus.emit('arenaMatchEnded');
      gameState.addMessage("The arena match has ended.", "important");
    });
  }
  
  transportToArena(callback) {
    this.originalFOVRadius = null;
    
    const fovSystem = gameState.getSystem('FOVSystem');
    if (fovSystem) {
      this.originalFOVRadius = fovSystem.radius;
      fovSystem.radius = 15;
    }
    
    if (window.game?.changeArea) {
      window.game.changeArea('arena').then(() => {
        if (gameState.player?.position) {
          gameState.player.position.x = 14;
          gameState.player.position.y = 3;
        }
        
        this.illuminateArena();
        if (callback) callback();
      });
    } else {
      gameState.location = 'arena';
      
      fetch('data/maps/arena.json')
        .then(response => response.json())
        .then(arenaData => {
          eventBus.emit('mapChanged', { mapData: arenaData });
          
          if (gameState.player?.position) {
            gameState.player.position.x = 14;
            gameState.player.position.y = 3;
          }
          
          this.illuminateArena();
          if (callback) callback();
        });
    }
  }
  
  illuminateArena() {
    if (!gameState.map) return;
    
    for (let y = 0; y < gameState.map.height; y++) {
      for (let x = 0; x < gameState.map.width; x++) {
        if (gameState.map.isInBounds(x, y)) {
          gameState.map.tiles[y][x].visible = true;
          gameState.map.tiles[y][x].explored = true;
          gameState.setTileVisible(x, y);
        }
      }
    }
    
    eventBus.emit('fovUpdated');
    gameState.addMessage("The arena is brightly lit for the spectators!", "important");
  }
  
  returnToPreviousLocation(callback) {
    if (this.originalFOVRadius) {
      const fovSystem = gameState.getSystem('FOVSystem');
      if (fovSystem) {
        fovSystem.radius = this.originalFOVRadius;
      }
      this.originalFOVRadius = null;
    }
    
    if (window.game?.changeArea) {
      window.game.changeArea(this.previousLocation || 'town').then(() => {
        if (callback) callback();
      });
    } else {
      gameState.location = this.previousLocation || 'town';
      this.previousLocation = null;
      eventBus.emit('mapChanged');
      if (callback) callback();
    }
  }

  processTurn() {
    if (!this.isActive || this.fighters.length < 2) {
      this.stopArenaMatch();
      return;
    }

    const fighter = this.fighters[this.currentFighter];
    
    if (this.isFighterDefeated(fighter)) {
      this.advanceToNextFighter();
      return;
    }
    
    this.processFighterTurn(fighter);
    
    if (this.shouldMatchEnd()) {
      const winner = this.getWinner();
      if (winner) {
        gameState.addMessage(`${winner.name} is victorious!`, "important");
      } else {
        gameState.addMessage("The match has ended in a draw!", "important");
      }
      
      setTimeout(() => this.stopArenaMatch(), 2000);
      return;
    }
    
    this.advanceToNextFighter();
    eventBus.emit('fovUpdated');
  }

  processFighterTurn(fighter) {
    if (!fighter) return;
    
    const target = this.findTarget(fighter);
    if (!target) return;
    
    const aiComponent = fighter.getComponent('AIComponent');
    
    if (aiComponent) {
      aiComponent.target = target;
      aiComponent.inArenaCombat = true;
      aiComponent.distanceToTarget = this.getDistance(fighter.position, target.position);
      
      const name = fighter.name.toLowerCase();
      
      if ((name.includes('mage') || name.includes('wizard') || name.includes('shaman')) && 
          !fighter.getComponent('SpellsComponent')) {
        
        function SpellsComponent() {
          this.knownSpells = new Map();
          
          if (name.includes('fire')) {
            this.knownSpells.set('firebolt', {
              name: 'Firebolt',
              manaCost: 5,
              baseDamage: 8, 
              element: 'fire',
              range: 6,
              intelligenceScale: 0.5,
              message: 'hurls a bolt of fire',
              deathMessage: 'is incinerated'
            });
          } else if (name.includes('ice')) {
            this.knownSpells.set('icespear', {
              name: 'Ice Spear',
              manaCost: 7,
              baseDamage: 10,
              element: 'ice',
              range: 6,
              intelligenceScale: 0.6,
              message: 'launches a spear of ice',
              deathMessage: 'is frozen solid'
            });
          } else {
            this.knownSpells.set('shockbolt', {
              name: 'Shock Bolt',
              manaCost: 5,
              baseDamage: 6,
              element: 'lightning',
              range: 5,
              intelligenceScale: 0.7,
              message: 'sends a bolt of electricity',
              deathMessage: 'is electrocuted'
            });
          }
        }
        
        function ManaComponent() {
          this.mana = 50;
          this.maxMana = 50;
        }
        
        fighter.addComponent = fighter.addComponent || function(component) {
          if (!this.components) this.components = new Map();
          const componentName = component.constructor.name || 'UnknownComponent';
          this.components.set(componentName, component);
          component.entity = this;
        };
        
        fighter.addComponent(new SpellsComponent());
        fighter.addComponent(new ManaComponent());
      }
      
      if (aiComponent.takeTurn) {
        const originalTakeTurn = aiComponent.takeTurn;
        
        if (typeof aiBehaviorManager === 'undefined') {
          const TestEntity = Array.from(gameState.entities.values()).find(e => 
            e.getComponent?.('AIComponent')?.behaviorType);
          
          if (TestEntity) {
            const aiComp = TestEntity.getComponent('AIComponent');
            if (aiComp) {
              window.aiBehaviorManager = aiComp.behaviorManager || window.aiBehaviorManager;
            }
          }
          
          if (typeof aiBehaviorManager === 'undefined') {
            window.aiBehaviorManager = {
              execute: function(behaviorId, entity, context) {
                return { success: true };
              }
            };
          }
        }
        
        aiComponent.takeTurn = function() {
          const createSpellEffect = (spellId, source, target) => {
            const renderSystem = gameState.renderSystem || gameState.getSystem('RenderSystem');
            if (!renderSystem?.createSpellEffect) return;
            
            let element = 'fire';
            if (spellId.includes('ice') || spellId.includes('frost')) {
              element = 'ice';
            } else if (spellId.includes('shock') || spellId.includes('lightning')) {
              element = 'lightning';
            }
            
            renderSystem.createSpellEffect('bolt', element, {
              sourceX: source.position.x,
              sourceY: source.position.y,
              targetX: target.position.x,
              targetY: target.position.y,
              duration: 500
            });
            
            setTimeout(() => {
              renderSystem.createSpellEffect('impact', element, {
                x: target.position.x,
                y: target.position.y,
                duration: 600
              });
            }, 400);
          };
          
          const behaviorManager = typeof aiBehaviorManager !== 'undefined' ? 
            aiBehaviorManager : (window.aiBehaviorManager || null);
          
          if (!behaviorManager) {
            return originalTakeTurn.apply(this, arguments);
          }
          
          const oldExecute = behaviorManager.execute;
          
          behaviorManager.execute = function(behaviorId, entity, context) {
            const result = oldExecute.call(this, behaviorId, entity, context);
            
            if (behaviorId === 'castSpell' && result?.success && context.spellId) {
              createSpellEffect(context.spellId, entity, context.target);
            }
            
            return result;
          };
          
          const result = originalTakeTurn.apply(this, arguments);
          behaviorManager.execute = oldExecute;
          
          return result;
        };
        
        aiComponent.takeTurn();
        return;
      }
      
      const adjacentDist = this.getDistance(fighter.position, target.position);
      
      if (adjacentDist <= 1.5) {
        if (aiComponent._attackTarget) {
          aiComponent._attackTarget(target);
        } else {
          this.attackTarget(fighter, target);
        }
      } else {
        this.moveTowardTarget(fighter, target);
        
        const moveMessages = [
          `${fighter.name} moves toward ${target.name}.`,
          `${fighter.name} advances on ${target.name}.`,
          `${fighter.name} lunges toward ${target.name}.`
        ];
        gameState.addMessage(moveMessages[Math.floor(Math.random() * moveMessages.length)]);
      }
    } else {
      this.attackTarget(fighter, target);
    }
  }
  
  getDistance(pos1, pos2) {
    if (!pos1 || !pos2) return Infinity;
    
    const dx = pos2.x - pos1.x;
    const dy = pos2.y - pos1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
  
  moveTowardTarget(fighter, target) {
    if (!fighter?.position || !target?.position) return;
    
    const dx = Math.sign(target.position.x - fighter.position.x);
    const dy = Math.sign(target.position.y - fighter.position.y);
    
    if (Math.abs(dx) > Math.abs(dy)) {
      if (!this.isPositionBlocked(fighter.position.x + dx, fighter.position.y)) {
        fighter.position.x += dx;
      } else if (!this.isPositionBlocked(fighter.position.x, fighter.position.y + dy)) {
        fighter.position.y += dy;
      }
    } else {
      if (!this.isPositionBlocked(fighter.position.x, fighter.position.y + dy)) {
        fighter.position.y += dy;
      } else if (!this.isPositionBlocked(fighter.position.x + dx, fighter.position.y)) {
        fighter.position.x += dx;
      }
    }
  }
  
  isPositionBlocked(x, y) {
    if (!gameState.map || x < 0 || y < 0 || x >= gameState.map.width || y >= gameState.map.height) {
      return true;
    }
    
    const tile = gameState.map.getTile(x, y);
    if (tile.blocked) return true;
    
    const entities = Array.from(gameState.entities.values());
    for (const entity of entities) {
      if (entity.position?.x === x && entity.position?.y === y &&
          (entity.blockMovement || entity.getComponent('BlocksMovementComponent'))) {
        return true;
      }
    }
    
    return false;
  }
  
  findTarget(fighter) {
    for (const potential of this.fighters) {
      if (potential !== fighter && !this.isFighterDefeated(potential)) {
        return potential;
      }
    }
    return null;
  }

  attackTarget(attacker, target) {
    if (!attacker || !target) return;
    
    const attackerHealth = attacker.getComponent('HealthComponent');
    const targetHealth = target.getComponent('HealthComponent');
    const attackerStats = attacker.getComponent('StatsComponent');
    const targetStats = target.getComponent('StatsComponent');
    
    if (!attackerHealth || !targetHealth || !attackerStats || !targetStats) return;
    
    const aiComponent = attacker.getComponent('AIComponent');
    
    if (aiComponent?._attackTarget) {
      aiComponent.target = target;
      aiComponent._attackTarget(target);
      return;
    }
    
    const baseDamage = Math.max(1, attackerStats.strength - Math.floor(targetStats.defense / 2));
    const variance = 0.2;
    const multiplier = 1 + (Math.random() * variance * 2 - variance);
    const damage = Math.max(1, Math.floor(baseDamage * multiplier));
    
    targetHealth.hp -= damage;
    
    const attackMessages = [
      `${attacker.name} strikes ${target.name} for ${damage} damage!`,
      `${attacker.name} slashes at ${target.name}, dealing ${damage} damage!`,
      `${attacker.name} lands a powerful blow on ${target.name} for ${damage} damage!`
    ];
    
    gameState.addMessage(attackMessages[Math.floor(Math.random() * attackMessages.length)]);
    
    if (Math.random() < 0.3) {
      const crowdMessages = [
        "The crowd cheers at the impressive strike!",
        "Spectators gasp at the powerful attack!",
        "The audience roars with excitement!"
      ];
      gameState.addMessage(crowdMessages[Math.floor(Math.random() * crowdMessages.length)]);
    }
    
    if (targetHealth.hp <= 0) {
      targetHealth.hp = 0;
      gameState.addMessage(`${target.name} has been defeated by ${attacker.name}!`, "important");
      gameState.addMessage("The crowd erupts in cheers for the victorious fighter!", "important");
    }
  }

  isFighterDefeated(fighter) {
    if (!fighter) return true;
    const health = fighter.getComponent('HealthComponent');
    return !health || health.hp <= 0;
  }

  shouldMatchEnd() {
    let livingCount = 0;
    for (const fighter of this.fighters) {
      if (!this.isFighterDefeated(fighter)) {
        livingCount++;
      }
    }
    return livingCount <= 1;
  }

  getWinner() {
    for (const fighter of this.fighters) {
      if (!this.isFighterDefeated(fighter)) {
        return fighter;
      }
    }
    return null;
  }

  advanceToNextFighter() {
    this.currentFighter = (this.currentFighter + 1) % this.fighters.length;
  }

  addFightersToArena() {
    const arenaPit = {
      x: 7,
      y: 8,
      width: 14,
      height: 10
    };
    
    const centerX = arenaPit.x + Math.floor(arenaPit.width / 2);
    const centerY = arenaPit.y + Math.floor(arenaPit.height / 2);
    const radius = 3;
    
    this.fighters = this.fighters.filter(fighter => fighter !== null);
    
    if (this.fighters.length < 2) {
      this.stopArenaMatch();
      return;
    }
    
    const isRanged = {};
    this.fighters.forEach(fighter => {
      const name = fighter.name.toLowerCase();
      isRanged[fighter.id] = name.includes('hydra') || 
                             name.includes('shaman') || 
                             name.includes('wizard') ||
                             name.includes('mage') ||
                             name.includes('archer');
    });
    
    this.fighters.forEach((fighter, index) => {
      if (!fighter?.position) return;
      
      let x, y;
      if (this.fighters.length === 2) {
        if (index === 0) {
          x = centerX - 4;
          y = centerY;
        } else {
          x = centerX + 4;
          y = centerY;
        }
      } else {
        const angle = (index / this.fighters.length) * 2 * Math.PI;
        const fighterRadius = isRanged[fighter.id] ? radius + 3 : radius + 2;
        x = Math.floor(centerX + Math.cos(angle) * fighterRadius);
        y = Math.floor(centerY + Math.sin(angle) * fighterRadius);
      }
      
      x = Math.max(arenaPit.x + 1, Math.min(x, arenaPit.x + arenaPit.width - 2));
      y = Math.max(arenaPit.y + 1, Math.min(y, arenaPit.y + arenaPit.height - 2));
      
      fighter.position.x = x;
      fighter.position.y = y;
      
      if (isRanged[fighter.id]) {
        gameState.addMessage(`${fighter.name} takes a strategic position in the arena!`);
      } else {
        gameState.addMessage(`${fighter.name} enters the arena!`);
      }
      
      if (!fighter.hasComponent('BlocksMovementComponent')) {
        fighter.addComponent(new BlocksMovementComponent());
      }
      
      let aiType = 'basic';
      const name = fighter.name.toLowerCase();
      
      if (name.includes('hydra')) {
        aiType = 'stationary';
      } else if (name.includes('orc')) {
        aiType = 'hostile';
      }
      
      if (!fighter.hasComponent('AIComponent')) {
        function AIComponent(type) {
          this.type = type || 'basic';
          this.state = 'idle';
          this.target = null;
          this.inArenaCombat = true;
        }
        
        const aiComponent = new AIComponent(aiType);
        fighter.addComponent(aiComponent);
        
        if (name.includes('hydra')) {
          aiComponent.attackRange = 6;
          aiComponent.behaviorType = 'stationary';
        } else if (name.includes('shaman') || name.includes('mage') || name.includes('wizard')) {
          aiComponent.attackRange = 5;
          aiComponent.behaviorType = 'spellcaster';
        } else if (name.includes('archer')) {
          aiComponent.attackRange = 4;
          aiComponent.behaviorType = 'ranged';
        }
        
        aiComponent.inArenaCombat = true;
      } else {
        const aiComponent = fighter.getComponent('AIComponent');
        
        if (name.includes('hydra')) {
          aiComponent.type = 'stationary';
          aiComponent.behaviorType = 'stationary';
          aiComponent.attackRange = 6;
        } else if (name.includes('shaman') || name.includes('mage') || name.includes('wizard')) {
          aiComponent.behaviorType = 'spellcaster';
          aiComponent.attackRange = 5;
        } else if (name.includes('archer')) {
          aiComponent.behaviorType = 'ranged';
          aiComponent.attackRange = 4;
        }
        
        aiComponent.inArenaCombat = true;
      }
      
      const stats = fighter.getComponent('StatsComponent');
      const health = fighter.getComponent('HealthComponent');
      if (stats && health) {
        gameState.addMessage(`${fighter.name}: ${health.hp}/${health.maxHp} HP, Str: ${stats.strength}, Def: ${stats.defense}`);
      }
      
      if (this.fighters.length === 2 && 
          this.fighters[0].type === this.fighters[1].type && 
          index === 1) {
        const oldName = fighter.name;
        fighter.name = `${fighter.name} II`;
        gameState.addMessage(`The second ${oldName} takes its position as ${fighter.name}!`);
      }
      
      if (!gameState.entities.has(fighter.id)) {
        gameState.addEntity(fighter);
      }
    });
    
    const fovSystem = gameState.getSystem('FOVSystem');
    if (fovSystem) {
      fovSystem.update();
      eventBus.emit('fovUpdated');
    }
  }

  removeFightersFromArena() {
    this.fighters.forEach(fighter => {
      if (gameState.entities.has(fighter.id)) {
        gameState.entities.delete(fighter.id);
      }
    });
    
    this.fighters = [];
  }
}

export default new ArenaSystem();
