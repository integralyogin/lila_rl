// ally_logic.js - Specialized AI behaviors for allied creatures
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

// Different ally behavior types
const ALLY_BEHAVIORS = {
    STATIONARY_CASTER: 'stationary_caster',
    FOLLOWER: 'follower',
    GUARDIAN: 'guardian'
};

// Keep track of summoned creatures' original positions
const summonedPositions = new Map();

class AllyLogic {
    constructor() {
        // Nothing needed in constructor
    }
    
    // Register a summoned creature's position
    registerSummonedCreature(entityId, x, y, behavior) {
        summonedPositions.set(entityId, {
            x, 
            y, 
            behavior
        });
        console.log(`Registered summoned creature ${entityId} at position (${x}, ${y}) with behavior ${behavior}`);
    }
    
    // Handle AI turn for an allied entity
    handleAllyTurn(entity) {
        if (!entity || !entity.id) return;
        
        // Check if this is a registered entity
        const summonData = summonedPositions.get(entity.id);
        if (!summonData) return false;
        
        const pos = entity.getComponent('PositionComponent');
        if (!pos) return false;
        
        // Handle different behavior types
        if (summonData.behavior === ALLY_BEHAVIORS.STATIONARY_CASTER) {
            return this.handleStationaryCaster(entity, summonData, pos);
        }
        else if (summonData.behavior === ALLY_BEHAVIORS.FOLLOWER) {
            return this.handleFollower(entity, summonData, pos);
        }
        
        return false; // Not handled
    }
    
    // For allies that follow the player and attack enemies
    handleFollower(entity, summonData, pos) {
        const ai = entity.getComponent('AIComponent');
        if (!ai) return true;
        
        // Skip attack if on cooldown
        if (ai.lastAttackAt && gameState.turn - ai.lastAttackAt < (ai.attackCooldown || 2)) {
            return true;
        }
        
        // Check if this entity should cast spells
        const spellInfo = this.getSpellToCast(entity);
        
        if (spellInfo) {
            // Find enemies in spell range
            const spellRange = spellInfo.range || 5;
            const enemy = this.findNearestEnemy(entity, pos, spellRange);
            
            if (enemy) {
                console.log(`${entity.name} casting ${spellInfo.name} at ${enemy.name}`);
                
                // Spend mana
                const manaComp = entity.getComponent('ManaComponent');
                if (manaComp) {
                    manaComp.mana -= spellInfo.manaCost;
                }
                
                // Create special spell effect based on spell type
                this.createSpellEffect(entity, enemy, spellInfo);
                
                // Apply damage to enemy
                const targetHealth = enemy.getComponent('HealthComponent');
                if (targetHealth) {
                    // Calculate intelligence-based damage
                    const stats = entity.getComponent('StatsComponent');
                    const baseDamage = spellInfo.damage || 6;
                    const intelligenceBonus = stats ? Math.floor(stats.intelligence * 0.5) : 0;
                    const damage = baseDamage + intelligenceBonus;
                    
                    // Apply damage
                    const isDead = targetHealth.takeDamage(damage);
                    
                    // Add message
                    gameState.addMessage(`${entity.name} casts ${spellInfo.name} at ${enemy.name} for ${damage} damage!`);
                    
                    // Handle enemy death
                    if (isDead) {
                        gameState.addMessage(`${enemy.name} is defeated by ${entity.name}'s spell!`);
                        if (enemy !== gameState.player) {
                            gameState.removeEntity(enemy.id);
                        }
                    }
                }
                
                ai.lastAttackAt = gameState.turn;
                return true;
            }
        }
        
        // If no spell cast, try normal attack
        const enemy = this.findNearestEnemy(entity, pos, ai.attackRange || 1);
        
        if (enemy) {
            console.log(`${entity.name} attacks ${enemy.name}`);
            this.performAllyAttack(entity, enemy, ai.attackRange > 1);
            ai.lastAttackAt = gameState.turn;
            return true;
        } else {
            // If no enemies nearby, stay close to player
            this.followPlayer(entity, pos);
        }
        
        return true;
    }
    
    /**
     * Create a visual spell effect
     */
    createSpellEffect(caster, target, spellInfo) {
        if (!gameState.renderSystem) return;
        
        const casterPos = caster.getComponent('PositionComponent');
        const targetPos = target.getComponent('PositionComponent');
        
        if (!casterPos || !targetPos) return;
        
        // Check for special spell types
        if (spellInfo.id === 'summon_hydra') {
            // Don't create a bolt effect for summoning spells
            // The actual summoning code will create an impact effect
            console.log("Skipping bolt effect for summon_hydra spell");
            return;
        }
        
        // Determine element based on spell or caster type
        let element = spellInfo.element || 'arcane';
        const casterName = caster.name ? caster.name.toLowerCase() : '';
        
        if (casterName.includes('fire')) {
            element = 'fire';
        } else if (casterName.includes('ice') || casterName.includes('frost')) {
            element = 'ice';
        }
        
        // Create bolt effect
        gameState.renderSystem.createSpellEffect('bolt', element, {
            sourceX: casterPos.x,
            sourceY: casterPos.y,
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
    }
    
    // Keep ally close to player
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
                console.log(`${entity.name} follows player to (${pos.x}, ${pos.y})`);
            }
        }
    }
    
    // Check if a move is valid
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
    
    // Find the nearest enemy to attack
    findNearestEnemy(entity, pos, range) {
        let nearestEnemy = null;
        let minDist = Infinity;
        
        // Create explicit array of candidate targets
        const candidates = [];
        
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
            
            candidates.push(target);
            
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
    
    /**
     * Check if an entity should cast spells
     * @param {Entity} entity - The entity to check
     * @returns {Object|null} - Spell info if should cast, null otherwise
     */
    getSpellToCast(entity) {
        // Skip if entity doesn't have SpellsComponent or ManaComponent
        if (!entity.hasComponent('SpellsComponent') || !entity.hasComponent('ManaComponent')) {
            return null;
        }
        
        const spellsComp = entity.getComponent('SpellsComponent');
        const manaComp = entity.getComponent('ManaComponent');
        
        // Skip if no spells or no mana
        if (!spellsComp.knownSpells || spellsComp.knownSpells.size === 0 || manaComp.mana <= 0) {
            return null;
        }
        
        // If entity is a Wizard, get their preferred spell
        const entityName = entity.name ? entity.name.toLowerCase() : '';
        if (entityName.includes('wizard')) {
            // Wizard prefers higher damage spells
            const preferredSpells = ['fireball', 'icespear', 'lightning', 'firebolt', 'frostbolt'];
            
            // Try each preferred spell in order
            for (const spellId of preferredSpells) {
                if (spellsComp.knownSpells.has(spellId)) {
                    const spell = spellsComp.knownSpells.get(spellId);
                    if (manaComp.mana >= spell.manaCost) {
                        return {
                            id: spellId,
                            name: spell.name || spellId,
                            manaCost: spell.manaCost,
                            damage: spell.baseDamage,
                            range: spell.range || 5,
                            element: spell.element || 'arcane'
                        };
                    }
                }
            }
            
            // If no preferred spells found, get first available spell with enough mana
            for (const [spellId, spell] of spellsComp.knownSpells.entries()) {
                if (manaComp.mana >= spell.manaCost) {
                    return {
                        id: spellId,
                        name: spell.name || spellId,
                        manaCost: spell.manaCost,
                        damage: spell.baseDamage,
                        range: spell.range || 5,
                        element: spell.element || 'arcane'
                    };
                }
            }
        }
        
        // For Fire Mage, return fireball info
        if (entityName.includes('fire mage')) {
            // Skip the hydra summoning logic and just return fireball info
            // The actual casting will be handled by the monsterSpellcaster.js module
            return {
                id: 'fireball',
                name: 'Fireball',
                manaCost: 12,
                damage: 14,
                range: 6,
                element: 'fire'
            };
            
            // The code below is no longer used
            if (false) { // This condition is always false to skip the code
                // Find a valid position near the mage
                const pos = entity.getComponent('PositionComponent');
                if (pos) {
                    // Attempt to summon a hydra nearby
                    const validPositions = [];
                    for (let dx = -1; dx <= 1; dx++) {
                        for (let dy = -1; dy <= 1; dy++) {
                            if (dx === 0 && dy === 0) continue;
                            const nx = pos.x + dx;
                            const ny = pos.y + dy;
                            if (this.isValidMove(nx, ny)) {
                                validPositions.push({x: nx, y: ny});
                            }
                        }
                    }
                    
                    if (validPositions.length > 0) {
                        // Spend mana
                        manaComp.mana -= 15;
                        
                        // Choose a random position
                        const spawnPos = validPositions[Math.floor(Math.random() * validPositions.length)];
                        
                        // Create a hydra entity
                        const hydra = new (entity.constructor)('Baby Hydra');
                        
                        // Can't import inside functions - we need to use the required components
                        // directly from a global scope or get a reference to them from elsewhere
                        
                        // Add components as instances
                        hydra.addComponent(new PositionComponent(spawnPos.x, spawnPos.y));
                        hydra.addComponent(new RenderableComponent('h', '#0fa'));
                        hydra.addComponent(new HealthComponent(12, false, 0));
                        hydra.addComponent(new StatsComponent(
                            5, // strength
                            1, // defense
                            4, // intelligence
                            3, // dexterity
                            4, // toughness
                            4, // perception
                            2, // wisdom
                            1, // charisma
                            1, // willpower
                            100, // speed
                            65, // accuracy
                            2, // pv
                            1  // dv
                        ));
                        
                        // Add AI component
                        const aiComp = new AIComponent('hostile');
                        aiComp.behaviorType = 'stationary';
                        aiComp.attackRange = 3;
                        aiComp.attackCooldown = 3;
                        hydra.addComponent(aiComp);
                        
                        // Add mana for spellcasting
                        hydra.addComponent(new ManaComponent(10, 1));
                        
                        // Add spells
                        const spellsComp = new SpellsComponent();
                        spellsComp.learnSpell('firebolt', {
                            name: 'Firebolt',
                            manaCost: 3,
                            baseDamage: 5,
                            element: 'fire',
                            range: 3
                        });
                        hydra.addComponent(spellsComp);
                        
                        // Add blocks movement
                        hydra.addComponent(new BlocksMovementComponent());
                        
                        // Register as summoned creature
                        this.registerSummonedCreature(
                            hydra.id, 
                            spawnPos.x, 
                            spawnPos.y, 
                            ALLY_BEHAVIORS.STATIONARY_CASTER
                        );
                        
                        // Add to game
                        gameState.addEntity(hydra);
                        
                        // Visual effect
                        if (gameState.renderSystem) {
                            gameState.renderSystem.createSpellEffect('impact', 'nature', {
                                x: spawnPos.x,
                                y: spawnPos.y,
                                duration: 600
                            });
                        }
                        
                        // Message
                        gameState.addMessage(`${entity.name} summons a Baby Hydra!`);
                        
                        // Ensure the summoned hydra targets the player
                        if (aiComp) {
                            aiComp.target = gameState.player;
                        }
                        
                        // Return a "fake" spell object to complete the function
                        return {
                            id: 'summon_hydra',
                            name: 'Summon Hydra',
                            manaCost: 15,
                            damage: 0,
                            range: 1,
                            element: 'nature'
                        };
                    }
                }
            }
            
            // Fallback to firebolt if summoning isn't possible
            if (spellsComp.knownSpells.has('firebolt')) {
                const spell = spellsComp.knownSpells.get('firebolt');
                if (manaComp.mana >= spell.manaCost) {
                    return {
                        id: 'firebolt',
                        name: 'Firebolt',
                        manaCost: spell.manaCost,
                        damage: spell.baseDamage,
                        range: spell.range || 5,
                        element: 'fire'
                    };
                }
            }
        }
        
        // For Orc Shaman, use shockbolt
        if (entityName.includes('orc shaman') && spellsComp.knownSpells.has('shockbolt')) {
            const spell = spellsComp.knownSpells.get('shockbolt');
            if (manaComp.mana >= spell.manaCost) {
                return {
                    id: 'shockbolt',
                    name: 'Shock Bolt',
                    manaCost: spell.manaCost,
                    damage: spell.baseDamage,
                    range: spell.range || 5,
                    element: 'lightning'
                };
            }
        }
        
        // Default behavior - get first available spell
        for (const [spellId, spell] of spellsComp.knownSpells.entries()) {
            if (manaComp.mana >= spell.manaCost) {
                return {
                    id: spellId,
                    name: spell.name || spellId,
                    manaCost: spell.manaCost,
                    damage: spell.baseDamage,
                    range: spell.range || 5,
                    element: spell.element || 'arcane'
                };
            }
        }
        
        return null;
    }
    
    handleStationaryCaster(entity, summonData, pos) {
        // FORCE position to original position no matter what
        pos.x = summonData.x;
        pos.y = summonData.y;
        
        console.log(`Enforcing stationary position for ${entity.name} at (${pos.x}, ${pos.y})`);
        
        // Check cooldown
        const ai = entity.getComponent('AIComponent');
        if (!ai) return true;
        
        // Skip attack if on cooldown
        if (ai.lastAttackAt && gameState.turn - ai.lastAttackAt < (ai.attackCooldown || 3)) {
            return true;
        }
        
        // Find a monster to target
        const monster = this.findNearestEnemy(entity, pos, ai.attackRange || 6);
        
        if (monster) {
            console.log(`Hydra targeting ${monster.name} at distance ${Math.sqrt(
                Math.pow(monster.position.x - pos.x, 2) + 
                Math.pow(monster.position.y - pos.y, 2)
            ).toFixed(1)}`);
            
            this.performRangedAttack(entity, monster);
            ai.lastAttackAt = gameState.turn;
        } else {
            console.log(`Hydra found no valid enemy targets`);
        }
        
        return true;
    }
    
    // Handle different types of ally attacks
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
        
        // Create visual spell effect for the firebolt
        if (gameState.renderSystem) {
            const attackerPos = attacker.getComponent('PositionComponent');
            const targetPos = target.getComponent('PositionComponent');
            
            if (attackerPos && targetPos) {
                // Use a different effect based on monster type
                let element = 'fire';
                let attackDesc = 'breathes fire at';
                let deathDesc = 'incinerated by';
                
                // Special handling for Fire Mage
                if (attacker.type === 'fire_mage') {
                    // Update the display text
                    element = 'fire';
                    attackDesc = 'casts fireball at';
                    deathDesc = 'incinerated by';
                    
                    // But otherwise just let normal ranged attack code run
                    // This is simpler than trying to add separate real spell logic
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
    
    // Check if a creature is registered with ally logic
    isRegistered(entityId) {
        return summonedPositions.has(entityId);
    }
    
    // Remove a summoned creature from tracking
    unregisterSummonedCreature(entityId) {
        if (summonedPositions.has(entityId)) {
            summonedPositions.delete(entityId);
            return true;
        }
        return false;
    }
}

// Create and export a singleton instance
const allyLogic = new AllyLogic();
export { allyLogic, ALLY_BEHAVIORS };