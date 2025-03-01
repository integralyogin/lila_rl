import { Component } from './baseComponents.js';

// Limb component - for entities that have body parts
export class LimbComponent extends Component {
    constructor(limbs = {}) {
        super();
        this.limbs = limbs;
    }
    
    // Check if a limb exists
    hasLimb(limbId) {
        return this.limbs.hasOwnProperty(limbId);
    }
    
    // Get a specific limb
    getLimb(limbId) {
        return this.limbs[limbId];
    }
    
    // Get all limbs
    getAllLimbs() {
        return this.limbs;
    }
    
    // Damage a limb
    damageLimb(limbId, amount) {
        if (!this.hasLimb(limbId)) return false;
        
        this.limbs[limbId].health -= amount;
        if (this.limbs[limbId].health < 0) this.limbs[limbId].health = 0;
        
        return true;
    }
    
    // Heal a limb
    healLimb(limbId, amount) {
        if (!this.hasLimb(limbId)) return false;
        
        this.limbs[limbId].health += amount;
        if (this.limbs[limbId].health > 100) this.limbs[limbId].health = 100;
        
        return true;
    }
    
    // Check if a limb is severed (zero health)
    isLimbSevered(limbId) {
        if (!this.hasLimb(limbId)) return false;
        return this.limbs[limbId].health <= 0;
    }
    
    // Sever a limb
    severLimb(limbId) {
        if (!this.hasLimb(limbId)) return false;
        
        // Set health to zero
        this.limbs[limbId].health = 0;
        
        // If the limb has an equipped item, drop it
        if (this.limbs[limbId].equipped) {
            // This would need to be handled by the game logic to create a dropped item
            const droppedItem = this.limbs[limbId].equipped;
            this.limbs[limbId].equipped = null;
            return { severed: true, droppedItem };
        }
        
        return { severed: true };
    }
    
    // Regrow a severed limb (for creatures with regeneration)
    regrowLimb(limbId) {
        if (!this.hasLimb(limbId)) return false;
        
        const limb = this.limbs[limbId];
        if (limb.regeneration && limb.health <= 0) {
            limb.health = 25; // Start with 25% health
            return true;
        }
        
        return false;
    }
    
    // Equip item to a limb
    equipToLimb(limbId, itemId) {
        if (!this.hasLimb(limbId) || this.isLimbSevered(limbId)) return false;
        
        this.limbs[limbId].equipped = itemId;
        return true;
    }
    
    // Unequip item from a limb
    unequipFromLimb(limbId) {
        if (!this.hasLimb(limbId)) return false;
        
        const previousItem = this.limbs[limbId].equipped;
        this.limbs[limbId].equipped = null;
        return previousItem;
    }
    
    // Get all equipped items
    getAllEquippedItems() {
        const equipped = {};
        for (const [limbId, limb] of Object.entries(this.limbs)) {
            if (limb.equipped) {
                equipped[limbId] = limb.equipped;
            }
        }
        return equipped;
    }
    
    // Get all usable limbs of a specific type (e.g., "hand")
    getUsableLimbsOfType(slotType) {
        return Object.entries(this.limbs)
            .filter(([_, limb]) => limb.slot === slotType && limb.health > 0)
            .map(([limbId, _]) => limbId);
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
            armor: null,
            head: null,
            chest: null,
            leftHand: null,
            rightHand: null,
            feet: null
        };
        
        // Legacy slots map to new slots for backward compatibility
        this.legacySlotMap = {
            'weapon': 'rightHand',
            'armor': 'chest'
        };
    }
    
    equip(item, specificLimb = null) {
        if (!item.hasComponent('EquippableComponent')) {
            return false;
        }
        
        const equippable = item.getComponent('EquippableComponent');
        let slot = equippable.slot;
        
        // Handle legacy slot names
        if (this.legacySlotMap[slot] && !specificLimb) {
            slot = this.legacySlotMap[slot];
        }
        
        // If a specific limb is specified, use that instead
        if (specificLimb && this.slots.hasOwnProperty(specificLimb)) {
            slot = specificLimb;
        }
        
        // For hand items, check if we're trying to equip to a specific hand
        if (slot === 'hand' && !specificLimb) {
            // Auto-select the first available hand
            if (!this.slots.rightHand) {
                slot = 'rightHand';
            } else if (!this.slots.leftHand) {
                slot = 'leftHand';
            } else {
                // Both hands are occupied, default to right hand
                slot = 'rightHand';
            }
        }
        
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
        equippable.equippedSlot = slot;
        
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
            equippable.equippedSlot = null;
        }
        
        this.slots[slot] = null;
        return true;
    }
    
    // Get all equipped items
    getAllEquipped() {
        const equipped = [];
        for (const [slot, item] of Object.entries(this.slots)) {
            if (item) {
                equipped.push({ slot, item });
            }
        }
        return equipped;
    }
}

// Equippable component - for items that can be equipped
export class EquippableComponent extends Component {
    constructor(slot = 'hand', statModifiers = {}) {
        super();
        this.slot = slot;
        this.isEquipped = false;
        this.equippedSlot = null; // The specific slot where the item is equipped
        this.statModifiers = statModifiers;
        
        // Add limb-specific properties
        this.twoHanded = false;      // Requires both hands to use
        this.limbDamage = 0;         // Extra damage to limbs
        this.limbProtection = 0;     // Protects limbs from damage
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