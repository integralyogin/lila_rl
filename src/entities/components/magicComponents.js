import { Component } from './baseComponents.js';

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

// WillpowerComponent - for entities that can use willpower for mental abilities
export class WillpowerComponent extends Component {
    constructor(maxWP = 40, wpRegen = 1) {
        super();
        this.maxWP = maxWP;
        this.wp = maxWP;
        this.wpRegen = wpRegen;       // WP regenerated per turn
        this.lastRegenAt = 0;         // Track last regeneration
        this.regenInterval = 10;      // Regenerate every 10 turns
    }
    
    useWP(amount) {
        if (this.wp < amount) {
            return false;
        }
        
        this.wp -= amount;
        return true;
    }
    
    restoreWP(amount) {
        this.wp = Math.min(this.maxWP, this.wp + amount);
    }
    
    regenerate(turn) {
        // Only regenerate if we have WP regen and enough time has passed
        if (this.wpRegen <= 0 || (turn - this.lastRegenAt) < this.regenInterval) {
            return 0;
        }
        
        // Don't regenerate if already at max WP
        if (this.wp >= this.maxWP) {
            return 0;
        }
        
        // Calculate regeneration amount
        const regenAmount = this.wpRegen;
        this.wp = Math.min(this.maxWP, this.wp + regenAmount);
        this.lastRegenAt = turn;
        
        return regenAmount;
    }
    
    get isEmpty() {
        return this.wp <= 0;
    }
}

// StaminaComponent - for entities that perform physical actions
export class StaminaComponent extends Component {
    constructor(maxSP = 60, spRegen = 2) {
        super();
        this.maxSP = maxSP;
        this.sp = maxSP;
        this.spRegen = spRegen;       // SP regenerated per turn
        this.lastRegenAt = 0;         // Track last regeneration
        this.regenInterval = 5;       // Regenerate every 5 turns (faster than mana/wp)
    }
    
    useSP(amount) {
        if (this.sp < amount) {
            return false;
        }
        
        this.sp -= amount;
        return true;
    }
    
    restoreSP(amount) {
        this.sp = Math.min(this.maxSP, this.sp + amount);
    }
    
    regenerate(turn) {
        // Only regenerate if we have SP regen and enough time has passed
        if (this.spRegen <= 0 || (turn - this.lastRegenAt) < this.regenInterval) {
            return 0;
        }
        
        // Don't regenerate if already at max SP
        if (this.sp >= this.maxSP) {
            return 0;
        }
        
        // Calculate regeneration amount
        const regenAmount = this.spRegen;
        this.sp = Math.min(this.maxSP, this.sp + regenAmount);
        this.lastRegenAt = turn;
        
        return regenAmount;
    }
    
    get isEmpty() {
        return this.sp <= 0;
    }
}