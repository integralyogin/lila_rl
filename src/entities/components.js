// Base component class - all components should extend this
export class Component {
    constructor() {
        this.entity = null;
    }
}

// Position component - for entities that exist on the map
export class PositionComponent extends Component {
    constructor(x = 0, y = 0) {
        super();
        this.x = x;
        this.y = y;
    }
    
    moveTo(x, y) {
        this.x = x;
        this.y = y;
    }
    
    moveBy(dx, dy) {
        this.x += dx;
        this.y += dy;
    }
}

// Renderable component - for entities that can be seen
export class RenderableComponent extends Component {
    constructor(char = '?', color = '#fff', background = null, priority = 0) {
        super();
        this.char = char;
        this.color = color;
        this.background = background;
        this.priority = priority; // Higher priority renders on top
    }
}

// Health component - for entities that can take damage
export class HealthComponent extends Component {
    constructor(maxHp = 10, immortal = false, hpRegen = 0) {
        super();
        this.maxHp = maxHp;
        this.hp = maxHp;
        this.hpRegen = hpRegen;       // HP regenerated per turn
        this.immortal = immortal;     // If true, entity can take damage but can't be killed
        this.lastRegenAt = 0;         // Track last regeneration
        this.regenInterval = 10;      // Regenerate every 10 turns (at 1000 energy per turn)
    }
    
    takeDamage(amount) {
        const originalHp = this.hp;
        this.hp = Math.max(0, this.hp - amount);
        
        // If immortal, restore HP to 1 if it would be 0
        if (this.immortal && this.hp <= 0) {
            this.hp = 1;
        }
        
        // Return consistent object format with CombatComponent.takeDamage
        return {
            damage: amount,
            originalDamage: amount,
            reduction: 0, // No inherent reduction in basic HealthComponent
            hpLost: originalHp - this.hp,
            isDead: !this.immortal && this.hp <= 0
        };
    }
    
    heal(amount) {
        this.hp = Math.min(this.maxHp, this.hp + amount);
    }
    
    regenerate(turn) {
        // Only regenerate if we have HP regen and enough time has passed
        if (this.hpRegen <= 0 || (turn - this.lastRegenAt) < this.regenInterval) {
            return 0;
        }
        
        // Don't regenerate if already at max HP
        if (this.hp >= this.maxHp) {
            return 0;
        }
        
        // Calculate regeneration amount
        const regenAmount = this.hpRegen;
        this.hp = Math.min(this.maxHp, this.hp + regenAmount);
        this.lastRegenAt = turn;
        
        return regenAmount;
    }
    
    get isDead() {
        // Immortal entities can never be considered dead
        return !this.immortal && this.hp <= 0;
    }
}

// Stats component - for entities with attributes
export class StatsComponent extends Component {
    constructor(
        strength = 5, 
        defense = 1, 
        intelligence = 5,
        dexterity = 5,
        toughness = 5,
        perception = 5,
        wisdom = 5,
        charisma = 5,
        speed = 100,
        accuracy = 70,
        pv = 1,
        dv = 1
    ) {
        super();
        // Primary attributes
        this.strength = strength;         // Physical power, affects damage
        this.dexterity = dexterity;       // Agility, affects accuracy and dodge
        this.toughness = toughness;       // Physical resilience, affects health and damage resistance
        this.perception = perception;     // Awareness, affects hit chance and detection
        this.intelligence = intelligence; // Mental acuity, affects spell power and learn rate
        this.wisdom = wisdom;             // Mental fortitude, affects mana and magic resistance
        this.charisma = charisma;         // Personality, affects interactions and influence
        
        // Derived attributes
        this.speed = speed;               // Action speed (higher = more actions per turn)
        this.accuracy = accuracy;         // Base hit chance (%)
        this.pv = pv;                     // Protection Value (flat damage reduction)
        this.dv = dv;                     // Dodge Value (chance to completely avoid attacks)
        this.defense = defense;           // Legacy defense value
        
        // Character progression
        this.level = 1;
        this.xp = 0;
        this.xpToNext = 20;
    }
    
    addXp(amount) {
        this.xp += amount;
        
        // Check for level up
        if (this.xp >= this.xpToNext) {
            this.levelUp();
            return true;
        }
        return false;
    }
    
    levelUp() {
        this.level++;
        this.xp -= this.xpToNext;
        this.xpToNext = Math.floor(this.xpToNext * 1.5);
        
        // Increase stats
        this.strength += 1;
        this.dexterity += 1;
        this.toughness += 1;
        this.perception += 1;
        this.intelligence += 1;
        this.wisdom += 1;
        this.charisma += 1;
        
        // Derived stats
        this.defense += 1;
        this.accuracy += 2;
        this.pv += 1;
        this.dv += 1;
        
        // Heal to full when leveling up
        const health = this.entity.getComponent('HealthComponent');
        if (health) {
            health.maxHp += 5;
            health.hp = health.maxHp;
        }
        
        // Restore mana when leveling up
        const mana = this.entity.getComponent('ManaComponent');
        if (mana) {
            mana.maxMana += 5;
            mana.mana = mana.maxMana;
        }
    }
}

// AI component - for monsters that can take actions
export class AIComponent extends Component {
    constructor(type = 'basic') {
        super();
        this.type = type;         // 'basic', 'hostile', 'friendly', 'stationary', etc.
        this.state = 'idle';      // 'idle', 'chase', 'attack', 'follow', 'cast', etc.
        this.target = null;       // Target entity
        this.lastMoveAt = 0;      // Track last movement for cooldown
        this.lastAttackAt = 0;    // Track last attack for ranged cooldowns
        this.attackCooldown = 3;  // Default cooldown between attacks (in turns)
        this.attackRange = 5;     // Default range for ranged attacks
    }
    
    takeTurn() {
        // Debug the AI type decision
        console.log(`Entity ${this.entity?.name || 'unknown'} AI Turn - Type: ${this.type}, State: ${this.state}`);
        
        // Handle different AI types - be extra explicit with type check
        if (this.type === 'stationary') {
            console.log("HYDRA TAKING STATIONARY TURN");
            this._handleStationaryAI();
        } else if (this.type === 'friendly') {
            this._handleFriendlyAI();
        } else {
            this._handleHostileAI();
        }
    }
    
    // Stationary AI behavior - stay in place and use ranged attacks
    _handleStationaryAI() {
        console.log("INSIDE STATIONARY AI HANDLER");
        const pos = this.entity.getComponent('PositionComponent');
        if (!pos) return;
        
        // Force position to stay the same - don't move at all
        const originalX = pos.x;
        const originalY = pos.y;
        
        // Find the summoner from SummonedByComponent
        const summonedBy = this.entity.getComponent('SummonedByComponent');
        const summoner = summonedBy ? summonedBy.summoner : null;
        
        // If no summoner, just idle
        if (!summoner) {
            return;
        }
        
        // Only attack once every X turns (cooldown)
        if (gameState.turn - this.lastAttackAt < this.attackCooldown) {
            console.log("Hydra on cooldown, waiting");
            
            // Make sure position didn't change
            pos.x = originalX;
            pos.y = originalY;
            return;
        }
        
        // Find nearby enemies to attack
        let nearestEnemy = null;
        let minEnemyDist = Infinity;
        
        gameState.entities.forEach(entity => {
            // Skip self, the summoner, and anything without position/health
            if (entity === this.entity || entity === summoner || 
                !entity.hasComponent('PositionComponent') || 
                !entity.hasComponent('HealthComponent')) {
                return;
            }
            
            // Check if it's an enemy (has hostile AI)
            const entityAI = entity.getComponent('AIComponent');
            if (!entityAI || entityAI.type !== 'hostile') return;
            
            // Calculate distance
            const entityPos = entity.getComponent('PositionComponent');
            const dx = entityPos.x - pos.x;
            const dy = entityPos.y - pos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            // If entity is within attack range and closer than any other enemy,
            // make it our target
            if (dist <= this.attackRange && dist < minEnemyDist) {
                nearestEnemy = entity;
                minEnemyDist = dist;
            }
        });
        
        // If we found an enemy in range, attack it
        if (nearestEnemy) {
            this.state = 'cast';
            this.target = nearestEnemy;
            
            // Get stats for damage calculation
            const stats = this.entity.getComponent('StatsComponent');
            if (!stats) return;
            
            // Use ranged attack (firebolt)
            const targetHealth = this.target.getComponent('HealthComponent');
            if (targetHealth) {
                // Calculate damage - hydra uses intelligence-based firebolt damage
                const damage = 6 + Math.floor(stats.intelligence * 0.5);
                
                // Apply damage
                const isDead = targetHealth.takeDamage(damage);
                
                // Show attack message with firebolt effect
                gameState.addMessage(`${this.entity.name} breathes fire at ${this.target.name} for ${damage} damage!`);
                
                // Record the time of this attack
                this.lastAttackAt = gameState.turn;
                
                // Check if target died
                if (isDead) {
                    gameState.addMessage(`${this.target.name} is incinerated by ${this.entity.name}'s fire!`);
                    
                    // If target is not the player, remove it
                    if (this.target !== gameState.player) {
                        gameState.removeEntity(this.target.id);
                    }
                    
                    // Clear target
                    this.target = null;
                }
            }
        } else {
            console.log("No enemies in range for hydra to attack");
            // No enemies in range, just stay idle
            this.state = 'idle';
            this.target = null;
        }
        
        // CRITICALLY IMPORTANT: Reset position to original spot
        pos.x = originalX;
        pos.y = originalY;
    }
    
    // Friendly AI behavior - help player by attacking their enemies
    _handleFriendlyAI() {
        const pos = this.entity.getComponent('PositionComponent');
        if (!pos) return;
        
        // Find the summoner from SummonedByComponent
        const summonedBy = this.entity.getComponent('SummonedByComponent');
        const summoner = summonedBy ? summonedBy.summoner : null;
        
        // If no summoner, just idle
        if (!summoner) {
            this._moveRandomly();
            return;
        }
        
        // Get summoner's position
        const summonerPos = summoner.getComponent('PositionComponent');
        if (!summonerPos) return;
        
        // Calculate distance to summoner
        const dxToSummoner = summonerPos.x - pos.x;
        const dyToSummoner = summonerPos.y - pos.y;
        const distToSummoner = Math.sqrt(dxToSummoner * dxToSummoner + dyToSummoner * dyToSummoner);
        
        // Find nearby enemies to attack
        let nearestEnemy = null;
        let minEnemyDist = Infinity;
        
        gameState.entities.forEach(entity => {
            // Skip self, the summoner, and anything without position/health
            if (entity === this.entity || entity === summoner || 
                !entity.hasComponent('PositionComponent') || 
                !entity.hasComponent('HealthComponent')) {
                return;
            }
            
            // Check if it's an enemy (has hostile AI)
            const entityAI = entity.getComponent('AIComponent');
            if (!entityAI || entityAI.type !== 'hostile') return;
            
            // Calculate distance
            const entityPos = entity.getComponent('PositionComponent');
            const dx = entityPos.x - pos.x;
            const dy = entityPos.y - pos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            // If entity is within 5 tiles and closer than any other enemy,
            // make it our target
            if (dist <= 5 && dist < minEnemyDist) {
                nearestEnemy = entity;
                minEnemyDist = dist;
            }
        });
        
        // Priority 1: Attack nearest enemy if found
        if (nearestEnemy) {
            this.state = 'attack';
            this.target = nearestEnemy;
            
            // Move toward or attack the enemy
            this._moveTowardTarget();
        }
        // Priority 2: If no enemy and too far from summoner, follow summoner
        else if (distToSummoner > 3) {
            this.state = 'follow';
            this.target = summoner;
            
            // Move toward summoner
            this._moveTowardTarget();
        }
        // Priority 3: If near summoner and no enemies, just idle in place
        else {
            this.state = 'idle';
            this.target = null;
            
            // 20% chance to move randomly when idle
            if (Math.random() < 0.2) {
                this._moveRandomly();
            }
        }
    }
    
    // Hostile AI behavior - chase and attack the player
    _handleHostileAI() {
        // Basic hostile AI with existing behavior
        if (!this.target) {
            // 50% chance to move in a random direction
            if (Math.random() < 0.5) {
                this._moveRandomly();
            }
        } else {
            // Move toward target
            this._moveTowardTarget();
        }
    }
    
    // Helper: Move randomly in any direction
    _moveRandomly() {
        const dx = Math.floor(Math.random() * 3) - 1; // -1, 0, or 1
        const dy = Math.floor(Math.random() * 3) - 1; // -1, 0, or 1
        
        const pos = this.entity.getComponent('PositionComponent');
        if (pos) {
            pos.moveBy(dx, dy);
        }
    }
    
    // Helper: Move toward the current target
    _moveTowardTarget() {
        if (!this.target) return;
        
        const pos = this.entity.getComponent('PositionComponent');
        const targetPos = this.target.getComponent('PositionComponent');
        
        if (!pos || !targetPos) return;
        
        // Calculate direction to move
        const dx = Math.sign(targetPos.x - pos.x);
        const dy = Math.sign(targetPos.y - pos.y);
        
        // If already adjacent to target, attack it
        if (Math.abs(targetPos.x - pos.x) <= 1 && Math.abs(targetPos.y - pos.y) <= 1) {
            // If target has health, attack it
            const targetHealth = this.target.getComponent('HealthComponent');
            const stats = this.entity.getComponent('StatsComponent');
            
            if (targetHealth && stats) {
                // Check if target can dodge based on DV
                const targetStats = this.target.getComponent('StatsComponent');
                const targetDV = targetStats ? targetStats.dv : 0;
                
                // Calculate dodge chance - 5% per DV point
                if (targetDV > 0) {
                    const dodgeChance = Math.min(75, targetDV * 5);
                    if (Math.random() * 100 <= dodgeChance) {
                        // Target dodged the attack
                        if (this.type === 'friendly') {
                            gameState.addMessage(`${this.target.name} dodges ${this.entity.name}'s attack!`);
                        } else if (this.target === gameState.player) {
                            gameState.addMessage(`You dodge ${this.entity.name}'s attack!`);
                        } else {
                            gameState.addMessage(`${this.target.name} dodges the attack!`);
                        }
                        return; // Attack was dodged, no damage dealt
                    }
                }
                
                // Calculate base damage
                let damage = stats.strength;
                
                // Apply randomization to damage (±20%)
                const variance = 0.2;
                const multiplier = 1 + (Math.random() * variance * 2 - variance);
                damage = Math.floor(damage * multiplier);
                
                // Apply damage with PV/defense reduction
                const result = targetHealth.takeDamage(damage);
                const actualDamage = result.damage || damage;
                
                // Show attack message
                if (this.type === 'friendly') {
                    // Friendly summon attacking hostile entity
                    gameState.addMessage(`${this.entity.name} attacks ${this.target.name} for ${actualDamage} damage!`);
                } else {
                    // Hostile entity attacking player
                    gameState.addMessage(`${this.entity.name} hits you for ${actualDamage} damage!`);
                }
                
                // Show damage reduction message if PV is significant
                if (targetStats && targetStats.pv > 0 && result.reduction > 2) {
                    if (this.target === gameState.player) {
                        gameState.addMessage(`Your armor absorbs ${result.reduction} damage!`);
                    } else {
                        gameState.addMessage(`${this.target.name}'s armor absorbs ${result.reduction} damage!`);
                    }
                }
                
                // Check if target died
                if (targetHealth.isDead) {
                    if (this.type === 'friendly') {
                        gameState.addMessage(`${this.entity.name} defeats ${this.target.name}!`);
                    }
                    
                    // If target is not the player, remove it
                    if (this.target !== gameState.player) {
                        gameState.removeEntity(this.target.id);
                    }
                    
                    // Clear target
                    this.target = null;
                }
            }
        } else {
            // Move toward target
            pos.moveBy(dx, dy);
        }
    }
}

// Inventory component - for entities that can carry items
export class InventoryComponent extends Component {
    constructor(capacity = 10) {
        super();
        this.items = [];
        this.capacity = capacity;
        this.gold = 0;
    }
    
    addItem(item) {
        if (this.items.length < this.capacity) {
            this.items.push(item);
            return true;
        }
        return false;
    }
    
    removeItem(item) {
        const index = this.items.indexOf(item);
        if (index !== -1) {
            this.items.splice(index, 1);
            return true;
        }
        return false;
    }
    
    get isFull() {
        return this.items.length >= this.capacity;
    }
}

// Equipment component - for entities that can equip items
export class EquipmentComponent extends Component {
    constructor() {
        super();
        this.slots = {
            weapon: null,
            armor: null
        };
    }
    
    equip(item) {
        if (!item.hasComponent('EquippableComponent')) {
            return false;
        }
        
        const equippable = item.getComponent('EquippableComponent');
        const slot = equippable.slot;
        
        if (!this.slots.hasOwnProperty(slot)) {
            return false;
        }
        
        // Unequip current item in this slot if any
        if (this.slots[slot]) {
            this.unequip(slot);
        }
        
        // Equip the new item
        this.slots[slot] = item;
        equippable.isEquipped = true;
        
        return true;
    }
    
    unequip(slot) {
        if (!this.slots.hasOwnProperty(slot) || !this.slots[slot]) {
            return false;
        }
        
        const item = this.slots[slot];
        const equippable = item.getComponent('EquippableComponent');
        
        if (equippable) {
            equippable.isEquipped = false;
        }
        
        this.slots[slot] = null;
        return true;
    }
}

// Equippable component - for items that can be equipped
export class EquippableComponent extends Component {
    constructor(slot = 'weapon', statModifiers = {}) {
        super();
        this.slot = slot;
        this.isEquipped = false;
        this.statModifiers = statModifiers;
    }
}

// Item component - for entities that can be picked up
export class ItemComponent extends Component {
    constructor(type = 'misc', value = 1) {
        super();
        this.type = type;
        this.value = value;
    }
}

// Gold component - for entities that can carry gold
export class GoldComponent extends Component {
    constructor(amount = 0) {
        super();
        this.amount = amount;
    }
    
    addGold(amount) {
        this.amount += amount;
    }
    
    spendGold(amount) {
        if (this.amount >= amount) {
            this.amount -= amount;
            return true;
        }
        return false;
    }
}

// Usable component - for items that can be used (potions, scrolls, etc.)
export class UsableComponent extends Component {
    constructor(effect = 'none', power = 0) {
        super();
        this.effect = effect;
        this.power = power;
    }
    
    use(target) {
        // Base implementation does nothing
        return false;
    }
}

// BlocksMovement component - for entities that block movement
export class BlocksMovementComponent extends Component {
    constructor() {
        super();
    }
}

// ManaComponent - for entities that can cast spells
export class ManaComponent extends Component {
    constructor(maxMana = 20, manaRegen = 1) {
        super();
        this.maxMana = maxMana;
        this.mana = maxMana;
        this.manaRegen = manaRegen;    // Mana regenerated per interval
        this.lastRegenAt = 0;          // Track last regeneration
        this.regenInterval = 10;       // Regenerate every 10 turns (at 1000 energy per turn)
    }
    
    useMana(amount) {
        if (this.mana < amount) {
            return false;
        }
        this.mana -= amount;
        return true;
    }
    
    restoreMana(amount) {
        this.mana = Math.min(this.maxMana, this.mana + amount);
    }
    
    regenerate(turn) {
        // Only regenerate if we have mana regen and enough time has passed
        if (this.manaRegen <= 0 || (turn - this.lastRegenAt) < this.regenInterval) {
            return 0;
        }
        
        // Don't regenerate if already at max mana
        if (this.mana >= this.maxMana) {
            return 0;
        }
        
        // Calculate regeneration amount
        const regenAmount = this.manaRegen;
        this.mana = Math.min(this.maxMana, this.mana + regenAmount);
        this.lastRegenAt = turn;
        
        return regenAmount;
    }
    
    get isEmpty() {
        return this.mana <= 0;
    }
}

// SpellbookComponent - for spellbook items
export class SpellbookComponent extends Component {
    constructor(spellId, spellName, description, element, manaCost, baseDamage = 0, range = 1) {
        super();
        this.spellId = spellId;
        this.spellName = spellName;
        this.description = description;
        this.element = element;
        this.manaCost = manaCost;
        this.baseDamage = baseDamage;
        this.range = range;
    }
}

// SpellsComponent - for entities that can learn and cast spells
export class SpellsComponent extends Component {
    constructor() {
        super();
        this.knownSpells = new Map();  // Map of spellId -> spell object
    }
    
    learnSpell(spellId, spell) {
        this.knownSpells.set(spellId, spell);
    }
    
    forgetSpell(spellId) {
        this.knownSpells.delete(spellId);
    }
    
    hasSpell(spellId) {
        return this.knownSpells.has(spellId);
    }
    
    getSpell(spellId) {
        return this.knownSpells.get(spellId);
    }
    
    get spellCount() {
        return this.knownSpells.size;
    }
}

// CombatComponent - for entities that can fight
export class CombatComponent extends Component {
    constructor(
        maxHp = 10, 
        strength = 3, 
        defense = 0, 
        xpValue = 0,
        dexterity = 5,
        accuracy = 70,
        pv = 0,
        dv = 0
    ) {
        super();
        this.maxHp = maxHp;
        this.hp = maxHp;
        this.strength = strength;
        this.defense = defense;
        this.dexterity = dexterity;
        this.accuracy = accuracy;
        this.pv = pv;                // Protection Value (flat damage reduction)
        this.dv = dv;                // Dodge Value (chance to avoid attacks)
        this.xpValue = xpValue;
    }
    
    // Calculate if an attack hits based on attacker's accuracy and defender's dodge
    calculateHit(targetDv) {
        // Base hit chance from accuracy
        const hitChance = this.accuracy;
        
        // Adjust for target's dodge value - each point of DV gives 5% dodge chance
        const adjustedHitChance = Math.max(5, Math.min(95, hitChance - targetDv * 5));
        
        // Random roll to determine hit
        return Math.random() * 100 < adjustedHitChance;
    }
    
    // Calculate damage based on strength and weapon
    calculateDamage(weapon = null) {
        // Base damage from strength
        let damage = this.strength;
        
        // Add weapon damage if equipped
        if (weapon) {
            const equippable = weapon.getComponent('EquippableComponent');
            if (equippable && equippable.statModifiers.damage) {
                damage += equippable.statModifiers.damage;
            }
        }
        
        // Randomize damage a bit (±20%)
        const variance = 0.2;
        const multiplier = 1 + (Math.random() * variance * 2 - variance);
        
        return Math.floor(damage * multiplier);
    }
    
    takeDamage(amount) {
        // First check if defender completely dodges the attack due to DV
        // This is typically handled before calling takeDamage, in the attack method
        
        // Apply protection value (PV) as primary damage reduction
        // PV represents armor and provides flat damage reduction
        const originalDamage = amount;
        let actualDamage = Math.max(1, amount - this.pv);
        
        // Apply defense to further reduce damage (legacy)
        actualDamage = Math.max(1, actualDamage - this.defense);
        
        // Show significant damage reduction
        if (this.pv >= 3 && originalDamage > actualDamage + 2) {
            // Note: This message is now also handled in the attack method
            // But we keep it here for completeness in case takeDamage is called directly
            if (gameState && this.entity) {
                gameState.addMessage(`${this.entity.name}'s armor absorbs ${this.pv} damage!`);
            }
        }
        
        // Apply damage to health
        this.hp = Math.max(0, this.hp - actualDamage);
        
        return {
            damage: actualDamage,
            originalDamage: originalDamage,
            reduction: originalDamage - actualDamage,
            isDead: this.hp <= 0
        };
    }
    
    heal(amount) {
        this.hp = Math.min(this.maxHp, this.hp + amount);
    }
    
    get isDead() {
        return this.hp <= 0;
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

// EnergyComponent - for entities that can take actions using the energy system
export class EnergyComponent extends Component {
    constructor(speed = 100) {
        super();
        this.energy = 0;              // Current energy level 
        this.baseSpeed = speed;       // Base speed (higher = faster)
        this.currentSpeed = speed;    // Current speed (can be modified by effects)
        this.energyPerTurn = 1000;    // Base energy gained per game turn
        
        // Default action costs - these determine action speed, not whether actions can be performed
        // The energy system controls timing only - faster entities act more often
        // A cost of 1000 means one action per turn at 100 speed
        // A cost of 500 means two actions per turn at 100 speed
        this.actionCosts = {
            move: 1000,               // Basic movement
            attack: 1000,             // Basic attack
            cast: 1500,               // Basic spell cast
            use: 1000,                // Use item
            wait: 500                 // Wait action (for recovery)
        };
    }
    
    gainEnergy() {
        // Calculate energy gain based on speed
        // At 100 speed, gain 1000 energy (1 normal action)
        // At 200 speed, gain 2000 energy (2 normal actions)
        const energyGain = Math.floor(this.energyPerTurn * (this.currentSpeed / 100));
        this.energy += energyGain;
        return energyGain;
    }
    
    canAct(actionType = 'move') {
        // Check if entity has enough energy for the specified action
        const cost = this.actionCosts[actionType] || this.actionCosts.move;
        return this.energy >= cost;
    }
    
    spendEnergy(actionType = 'move') {
        // Spend energy for the specified action
        const cost = this.actionCosts[actionType] || this.actionCosts.move;
        
        if (this.energy < cost) {
            return false;
        }
        
        this.energy -= cost;
        return true;
    }
    
    // Calculate how many turns needed for next action
    turnsToNextAction(actionType = 'move') {
        const cost = this.actionCosts[actionType] || this.actionCosts.move;
        if (this.energy >= cost) return 0;
        
        const energyNeeded = cost - this.energy;
        const energyPerTurn = Math.floor(this.energyPerTurn * (this.currentSpeed / 100));
        return Math.ceil(energyNeeded / energyPerTurn);
    }
    
    // Set custom action cost (for special abilities or items)
    setActionCost(actionType, cost) {
        this.actionCosts[actionType] = cost;
    }
    
    // Apply speed modifier (from buffs/debuffs)
    modifySpeed(modifier) {
        this.currentSpeed = Math.max(10, this.baseSpeed + modifier); // Minimum speed of 10
    }
    
    // Reset speed to base value
    resetSpeed() {
        this.currentSpeed = this.baseSpeed;
    }
}

import gameState from '../core/gameState.js';

// DialogueComponent - for NPCs that can be talked to
export class DialogueComponent extends Component {
    constructor(dialogueData = [], isShopkeeper = false, inventory = null) {
        super();
        this.dialogueData = dialogueData; // Array of dialogue options or tree
        this.currentDialogue = 0;         // Current position in dialogue
        this.inConversation = false;      // Whether currently talking to this NPC
        this.hasCompletedDialogue = false; // Whether we've gone through all dialogue
        this.lastTalkTime = 0;            // Game turn when last talked
        this.isShopkeeper = isShopkeeper; // Whether this NPC is a shopkeeper
        
        // Important: Make a deep copy of the inventory items to prevent reference sharing
        if (inventory) {
            // Use a deep copy to ensure each item is also copied
            this.inventory = inventory.map(item => ({...item}));
            console.log(`DialogueComponent: Setting inventory for ${this.entity?.name || 'NPC'} with ${this.inventory.length} items. First item: ${this.inventory[0]?.name}`);
            
            // Force these properties to be distinct between NPCs
            this._shopkeeperToken = Math.random().toString(36).substring(2, 15);
            console.log(`Created unique shop token: ${this._shopkeeperToken}`);
        } else {
            this.inventory = null;
        }
    }
    
    getNextLine() {
        if (this.currentDialogue < this.dialogueData.length) {
            const dialogue = this.dialogueData[this.currentDialogue];
            this.currentDialogue++;
            
            // Check if this is the last line
            if (this.currentDialogue >= this.dialogueData.length) {
                this.hasCompletedDialogue = true;
            }
            
            return dialogue;
        }
        return null; // No more dialogue
    }
    
    resetDialogue() {
        this.currentDialogue = 0;
        // Don't reset hasCompletedDialogue here - it persists until canTalkAgain() is called
    }
    
    hasMoreDialogue() {
        return this.currentDialogue < this.dialogueData.length;
    }
    
    // For dialogue trees and choices
    selectOption(optionIndex) {
        // If current dialogue has options, select one
        const current = this.dialogueData[this.currentDialogue - 1];
        if (current && current.options && current.options[optionIndex]) {
            this.dialogueData = current.options[optionIndex].next;
            this.currentDialogue = 0;
            return true;
        }
        return false;
    }
    
    startConversation() {
        this.inConversation = true;
        
        // If we've completed dialogue before, check if enough time has passed
        if (this.hasCompletedDialogue) {
            // Reset if they can talk again
            if (this.canTalkAgain()) {
                this.hasCompletedDialogue = false;
                this.resetDialogue();
            }
        } else {
            this.resetDialogue();
        }
        
        // Record the time of this conversation
        this.lastTalkTime = gameState.turn;
    }
    
    endConversation() {
        this.inConversation = false;
    }
    
    canTalkAgain() {
        // Shopkeepers should always be available to talk
        if (this.isShopkeeper) {
            return true;
        }
        
        // Regular NPCs won't repeat their dialogue until at least 50 game turns have passed
        const currentTurn = gameState.turn;
        return (currentTurn - this.lastTalkTime) >= 50;
    }
}