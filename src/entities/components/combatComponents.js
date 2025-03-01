import { Component } from './baseComponents.js';
import gameState from '../../core/gameState.js';

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
        console.log(`Created HealthComponent with HP: ${this.hp}/${this.maxHp}, immortal: ${this.immortal}`);
    }
    
    takeDamage(amount) {
        const entityName = this.entity ? this.entity.name : 'Unknown';
        console.log(`${entityName} taking ${amount} damage, current HP: ${this.hp}/${this.maxHp}, immortal: ${this.immortal}`);
        
        const originalHp = this.hp;
        this.hp = Math.max(0, this.hp - amount);
        
        // If immortal, restore HP to 1 if it would be 0
        if (this.immortal && this.hp <= 0) {
            this.hp = 1;
            console.log(`${entityName} is immortal! HP after damage: ${this.hp}`);
        } else {
            console.log(`${entityName} HP after damage: ${this.hp}`);
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
        willpower = 4,
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
        this.willpower = willpower;       // Mental strength, resistance to fear/mental effects, affects WP
        
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