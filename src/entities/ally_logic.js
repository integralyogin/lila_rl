import gameState from '../core/gameState.js';
import { 
    PositionComponent, 
    RenderableComponent,
    HealthComponent,
    StatsComponent,
    AIComponent,
    ManaComponent,
    SpellsComponent,
    BlocksMovementComponent
} from './components/index.js';

// Import monsterSpellcaster to reuse spell casting logic
import monsterSpellcaster from './ai/monsterSpellcaster.js';

const ALLY_BEHAVIORS = {
    STATIONARY_CASTER: 'stationary_caster',
    FOLLOWER: 'follower',
    GUARDIAN: 'guardian'
};

const summonedPositions = new Map();

class AllyLogic {
    constructor() {
        // Nothing needed in constructor
    }
    
    registerSummonedCreature(entityId, x, y, behavior) {
        summonedPositions.set(entityId, {
            x, 
            y, 
            behavior
        });
    }
    
    handleAllyTurn(entity) {
        if (!entity || !entity.id) return;
        
        const summonData = summonedPositions.get(entity.id);
        if (!summonData) return false;
        
        const pos = entity.getComponent('PositionComponent');
        if (!pos) return false;
        
        if (summonData.behavior === ALLY_BEHAVIORS.STATIONARY_CASTER) {
            return this.handleStationaryCaster(entity, summonData, pos);
        }
        else if (summonData.behavior === ALLY_BEHAVIORS.FOLLOWER) {
            return this.handleFollower(entity, summonData, pos);
        }
        
        return false;
    }
    
    handleFollower(entity, summonData, pos) {
        const ai = entity.getComponent('AIComponent');
        if (!ai) return true;
        
        if (ai.lastAttackAt && gameState.turn - ai.lastAttackAt < (ai.attackCooldown || 2)) {
            return true;
        }
        
        // Try to cast a spell using monsterSpellcaster for unified spell logic
        const spellCastResult = this.tryCastSpell(entity);
        
        if (spellCastResult) {
            ai.lastAttackAt = gameState.turn;
            return true;
        }
        
        // Fall back to normal attack if no spell was cast
        const enemy = this.findNearestEnemy(entity, pos, ai.attackRange || 1);
        
        if (enemy) {
            this.performAllyAttack(entity, enemy, ai.attackRange > 1);
            ai.lastAttackAt = gameState.turn;
            return true;
        } else {
            // If no enemies nearby, stay close to player
            this.followPlayer(entity, pos);
        }
        
        return true;
    }
    
    tryCastSpell(entity) {
        // Skip if spellLogic isn't available
        if (!gameState.spellLogic) return false;
        
        const ai = entity.getComponent('AIComponent');
        const spellsComp = entity.getComponent('SpellsComponent');
        const manaComp = entity.getComponent('ManaComponent');
        const pos = entity.getComponent('PositionComponent');
        
        if (!spellsComp || !manaComp || !pos || !spellsComp.knownSpells || spellsComp.knownSpells.size === 0) {
            return false;
        }
        
        // Find the best spell to cast
        const spellInfo = this.getBestSpellToCast(entity);
        
        if (!spellInfo) {
            return false;
        }
        
        // Find an enemy within range
        const enemy = this.findNearestEnemy(entity, pos, spellInfo.range || 5);
        
        if (!enemy) {
            return false;
        }
        
        // Create the context object for monsterSpellcaster
        const context = {
            spellId: spellInfo.id,
            target: enemy
        };
        
        // Use the monsterSpellcaster to handle the spell casting
        // This ensures we use the same code path as monsters
        const result = monsterSpellcaster.castRealSpell(entity, context);
        
        return result.success;
    }
    
    getBestSpellToCast(entity) {
        const spellsComp = entity.getComponent('SpellsComponent');
        const manaComp = entity.getComponent('ManaComponent');
        
        if (!spellsComp || !manaComp || !spellsComp.knownSpells || manaComp.mana <= 0) {
            return null;
        }
        
        // For debugging
        if (entity.type === 'fire_mage') {
            spellsComp.knownSpells.forEach((spell, id) => {
                console.log(`Available spell: ${id}, mana cost: ${spell.manaCost}, damage: ${spell.baseDamage}`);
            });
        }
        
        let availableSpells = [];
        
        // Convert the Map to an array of spell objects
        for (const [spellId, spell] of spellsComp.knownSpells.entries()) {
            if (manaComp.mana >= spell.manaCost) {
                availableSpells.push({
                    id: spellId,
                    name: spell.name || spell.spellName || spellId,
                    manaCost: spell.manaCost,
                    baseDamage: spell.baseDamage,
                    element: spell.element,
                    range: spell.range || 5,
                    aoeRadius: spell.aoeRadius
                });
            }
        }
        
        // Return null if no spells are available
        if (availableSpells.length === 0) {
            return null;
        }
        
        // Sort by damage potential if that property exists
        availableSpells.sort((a, b) => {
            // Prioritize ranged spells
            if ((a.range || 5) !== (b.range || 5)) {
                return (b.range || 5) - (a.range || 5);
            }
            
            // Then prioritize by damage
            const aDamage = a.baseDamage || 0;
            const bDamage = b.baseDamage || 0;
            return bDamage - aDamage;
        });
        
        // Return the best spell
        return availableSpells[0];
    }
    
    followPlayer(entity, pos) {
        if (!gameState.player || !gameState.player.position) return;
        
        const playerPos = gameState.player.position;
        const dx = playerPos.x - pos.x;
        const dy = playerPos.y - pos.y;
        const distSquared = dx * dx + dy * dy;
        
        // Only follow if too far from player (more than 3 tiles away)
        if (distSquared > 9) {
            // Move towards player (simplified pathfinding)
            const moveX = dx === 0 ? 0 : (dx > 0 ? 1 : -1);
            const moveY = dy === 0 ? 0 : (dy > 0 ? 1 : -1);
            
            // Check if the move is valid
            if (this.isValidMove(pos.x + moveX, pos.y + moveY)) {
                pos.x += moveX;
                pos.y += moveY;
            }
        }
    }
    
    isValidMove(x, y) {
        // Check if the position is in bounds
        if (!gameState.map || !gameState.map.isInBounds(x, y)) {
            return false;
        }
        
        // Check if the tile is walkable
        if (!gameState.map.isWalkable(x, y)) {
            return false;
        }
        
        // Check if there's another entity blocking movement
        for (const entity of gameState.entities.values()) {
            if (entity.blockMovement && 
                entity.position && 
                entity.position.x === x && 
                entity.position.y === y) {
                return false;
            }
        }
        
        return true;
    }
    
    findNearestEnemy(entity, pos, range) {
        let nearestEnemy = null;
        let minDist = Infinity;
        
        gameState.entities.forEach(target => {
            // Skip player, self, friendly entities, and entities without needed components
            if (target === gameState.player || 
                target === entity || 
                !target.position || 
                !target.health) {
                return;
            }
            
            // Skip other allies by checking if they have a friendly AI
            const targetAI = target.getComponent('AIComponent');
            if (targetAI && (targetAI.faction === 'ally' || targetAI.type === 'friendly')) {
                return;
            }
            
            // Consider entity an enemy if it's a monster or has hostile AI
            const isEnemy = 
                (target.type && target.type.includes("monster")) || 
                (target.name && (
                    target.name.toLowerCase().includes("goblin") ||
                    target.name.toLowerCase().includes("orc") ||
                    target.name.toLowerCase().includes("troll")
                )) ||
                (targetAI && targetAI.type === 'hostile');
            
            if (!isEnemy) {
                return;
            }
            
            // Calculate distance
            const dx = target.position.x - pos.x;
            const dy = target.position.y - pos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist <= range && dist < minDist) {
                minDist = dist;
                nearestEnemy = target;
            }
        });
        
        return nearestEnemy;
    }
    
    handleStationaryCaster(entity, summonData, pos) {
        // FORCE position to original position no matter what
        pos.x = summonData.x;
        pos.y = summonData.y;
        
        // Check cooldown
        const ai = entity.getComponent('AIComponent');
        if (!ai) return true;
        
        // Skip attack if on cooldown
        if (ai.lastAttackAt && gameState.turn - ai.lastAttackAt < (ai.attackCooldown || 3)) {
            return true;
        }
        
        // Try to cast a spell first using monsterSpellcaster
        const spellCastResult = this.tryCastSpell(entity);
        
        if (spellCastResult) {
            ai.lastAttackAt = gameState.turn;
            return true;
        }
        
        // Fall back to ranged attack if no spell was cast
        const monster = this.findNearestEnemy(entity, pos, ai.attackRange || 6);
        
        if (monster) {
            this.performRangedAttack(entity, monster);
            ai.lastAttackAt = gameState.turn;
        }
        
        return true;
    }
    
    performAllyAttack(attacker, target, isRanged) {
        if (isRanged) {
            this.performRangedAttack(attacker, target);
        } else {
            this.performMeleeAttack(attacker, target);
        }
    }
    
    performMeleeAttack(attacker, target) {
        // Get components needed for attack
        const targetHealth = target.getComponent('HealthComponent');
        const stats = attacker.getComponent('StatsComponent');
        
        if (!targetHealth || !stats) return;
        
        // Calculate damage based on strength
        const damage = 2 + Math.floor(stats.strength * 0.7);
        
        // Apply damage
        const isDead = targetHealth.takeDamage(damage);
        
        // Show attack message
        gameState.addMessage(`${attacker.name} attacks ${target.name} for ${damage} damage!`);
        
        // Check if target died
        if (isDead) {
            gameState.addMessage(`${attacker.name} defeats ${target.name}!`);
            
            // If target is not the player, remove it
            if (target !== gameState.player) {
                gameState.removeEntity(target.id);
            }
        }
    }
    
    performRangedAttack(attacker, target) {
        // Get components needed for attack
        const targetHealth = target.getComponent('HealthComponent');
        const stats = attacker.getComponent('StatsComponent');
        
        if (!targetHealth || !stats) return;
        
        // Calculate damage based on intelligence (for spellcasting)
        const damage = 6 + Math.floor(stats.intelligence * 0.5);
        
        // Create visual spell effect for the attack
        if (gameState.renderSystem) {
            const attackerPos = attacker.getComponent('PositionComponent');
            const targetPos = target.getComponent('PositionComponent');
            
            if (attackerPos && targetPos) {
                // Use a different effect based on monster type
                let element = 'fire';
                let attackDesc = 'breathes fire at';
                let deathDesc = 'incinerated by';
                
                // Special handling for different types
                if (attacker.type === 'fire_mage') {
                    element = 'fire';
                    attackDesc = 'casts fireball at';
                    deathDesc = 'incinerated by';
                } else if (attacker.type === 'archer') {
                    element = 'physical';
                    attackDesc = 'shoots an arrow at';
                    deathDesc = 'shot down by';
                } else if (attacker.type === 'orc_shaman') {
                    element = 'lightning';
                    attackDesc = 'casts lightning at';
                    deathDesc = 'electrocuted by';
                }
                
                // Create bolt effect
                gameState.renderSystem.createSpellEffect('bolt', element, {
                    sourceX: attackerPos.x,
                    sourceY: attackerPos.y,
                    targetX: targetPos.x,
                    targetY: targetPos.y,
                    duration: 500
                });
                
                // Create impact effect after delay
                setTimeout(() => {
                    gameState.renderSystem.createSpellEffect('impact', element, {
                        x: targetPos.x,
                        y: targetPos.y,
                        duration: 600
                    });
                }, 400);
                
                // Apply damage
                const isDead = targetHealth.takeDamage(damage);
                
                // Show attack message with appropriate effect
                gameState.addMessage(`${attacker.name} ${attackDesc} ${target.name} for ${damage} damage!`);
                
                // Check if target died
                if (isDead) {
                    gameState.addMessage(`${target.name} is ${deathDesc} ${attacker.name}'s attack!`);
                    
                    // If target is not the player, remove it
                    if (target !== gameState.player) {
                        gameState.removeEntity(target.id);
                    }
                }
            }
        } else {
            // No render system, just apply damage directly
            const isDead = targetHealth.takeDamage(damage);
            
            // Show attack message
            gameState.addMessage(`${attacker.name} attacks ${target.name} for ${damage} damage!`);
            
            // Check if target died
            if (isDead) {
                gameState.addMessage(`${attacker.name} defeats ${target.name}!`);
                
                // If target is not the player, remove it
                if (target !== gameState.player) {
                    gameState.removeEntity(target.id);
                }
            }
        }
    }
    
    isRegistered(entityId) {
        return summonedPositions.has(entityId);
    }
    
    unregisterSummonedCreature(entityId) {
        if (summonedPositions.has(entityId)) {
            summonedPositions.delete(entityId);
            return true;
        }
        return false;
    }
}

const allyLogic = new AllyLogic();
export { allyLogic, ALLY_BEHAVIORS };
