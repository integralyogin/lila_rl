import Entity from './entity.js';
import { COLORS } from '../constants.js';
import gameState from '../core/gameState.js';
import { 
    PositionComponent, 
    RenderableComponent,
    HealthComponent,
    StatsComponent,
    AIComponent,
    InventoryComponent,
    EquipmentComponent,
    ItemComponent,
    EquippableComponent,
    UsableComponent,
    BlocksMovementComponent,
    ManaComponent,
    SpellsComponent,
    SpellbookComponent,
    GoldComponent,
    SummonedByComponent,
    EnergyComponent
} from './components.js';
import { allyLogic, ALLY_BEHAVIORS } from './ally_logic.js';

class EntityFactory {
    constructor() {
        this.monsterTemplates = {};
        this.itemTemplates = {};
        this.spellbookTemplates = {};
        this.playerData = null;
    }
    
    initialize(gameData) {
        this.playerData = gameData.playerData;
        
        // Process monster data from JSON
        if (gameData.monsters && Array.isArray(gameData.monsters)) {
            gameData.monsters.forEach(monster => {
                this.monsterTemplates[monster.id] = {
                    name: monster.name,
                    char: monster.char,
                    color: monster.color,
                    hp: monster.hp,
                    strength: monster.strength,
                    defense: monster.defense,
                    dexterity: monster.dexterity || 5,
                    toughness: monster.toughness || 5,
                    perception: monster.perception || 5,
                    intelligence: monster.intelligence || 3,
                    wisdom: monster.wisdom || 3,
                    charisma: monster.charisma || 3,
                    speed: monster.speed || 100,
                    accuracy: monster.accuracy || 70,
                    pv: monster.pv || 0,
                    dv: monster.dv || 0,
                    manaRegen: monster.manaRegen || 0,
                    hpRegen: monster.hpRegen || 0,
                    xp: monster.xp
                };
            });
        }
        
        // Process item data from JSON
        if (gameData.items && Array.isArray(gameData.items)) {
            gameData.items.forEach(item => {
                this.itemTemplates[item.id] = {
                    name: item.name,
                    char: item.char,
                    color: item.color,
                    type: item.type,
                    slot: item.slot,
                    effect: item.effect,
                    power: item.power,
                    statModifiers: item.statModifiers,
                    value: item.value
                };
            });
        }
        
        // Process spellbook data from JSON
        if (gameData.spellbooks && Array.isArray(gameData.spellbooks)) {
            gameData.spellbooks.forEach(spellbook => {
                this.spellbookTemplates[spellbook.id] = {
                    name: spellbook.name,
                    char: spellbook.char,
                    color: spellbook.color,
                    type: spellbook.type,
                    spellId: spellbook.spellId,
                    spellName: spellbook.spellName,
                    description: spellbook.description,
                    element: spellbook.element,
                    manaCost: spellbook.manaCost,
                    baseDamage: spellbook.baseDamage,
                    range: spellbook.range,
                    aoeRadius: spellbook.aoeRadius,
                    duration: spellbook.duration,
                    turnCost: spellbook.turnCost,
                    effects: spellbook.effects || [],
                    value: spellbook.price
                };
            });
        }
        
        // If no data was loaded, use default templates
        if (Object.keys(this.monsterTemplates).length === 0) {
            this.monsterTemplates = {
                'goblin': {
                    char: 'g',
                    color: COLORS.MONSTER.GOBLIN,
                    hp: 5,
                    strength: 3,
                    defense: 0,
                    xp: 5
                },
                'orc': {
                    char: 'o',
                    color: COLORS.MONSTER.ORC,
                    hp: 10,
                    strength: 5,
                    defense: 1,
                    xp: 10
                }
            };
        }
        
        if (Object.keys(this.itemTemplates).length === 0) {
            this.itemTemplates = {
                'health_potion': {
                    char: '!',
                    color: COLORS.ITEM.POTION,
                    name: 'Health Potion',
                    type: 'potion',
                    effect: 'healing',
                    power: 5,
                    value: 20
                },
                'sword': {
                    char: '/',
                    color: COLORS.ITEM.WEAPON,
                    name: 'Sword',
                    type: 'weapon',
                    slot: 'weapon',
                    statModifiers: { strength: 2 },
                    value: 30
                },
                'leather_armor': {
                    char: '[',
                    color: COLORS.ITEM.ARMOR,
                    name: 'Leather Armor',
                    type: 'armor',
                    slot: 'armor',
                    statModifiers: { defense: 1 },
                    value: 25
                }
            };
        }
    }
    
    createPlayer(x, y) {
        const player = new Entity('Player');
        
        // Use player data from JSON if available
        const maxHp = this.playerData ? this.playerData.maxHp : 20;
        const strength = this.playerData ? this.playerData.strength : 7;
        const defense = this.playerData ? this.playerData.defense : 1;
        const intelligence = this.playerData ? this.playerData.intelligence : 5;
        
        // New stats
        const dexterity = this.playerData ? this.playerData.dexterity : 5;
        const toughness = this.playerData ? this.playerData.toughness : 5;
        const perception = this.playerData ? this.playerData.perception : 5;
        const wisdom = this.playerData ? this.playerData.wisdom : 5;
        const charisma = this.playerData ? this.playerData.charisma : 5;
        const speed = this.playerData ? this.playerData.speed : 100;
        const accuracy = this.playerData ? this.playerData.accuracy : 70;
        const pv = this.playerData ? this.playerData.pv : 1;
        const dv = this.playerData ? this.playerData.dv : 1;
        
        // Regen stats
        const hpRegen = this.playerData ? this.playerData.hpRegen : 1;
        const manaRegen = this.playerData ? this.playerData.manaRegen : 1;
        
        // Calculate max mana based on intelligence and wisdom
        const maxMana = this.playerData && this.playerData.maxMana ? 
            this.playerData.maxMana : 10 + (intelligence * 2) + (wisdom * 1);
        
        // Add components
        player.addComponent(new PositionComponent(x, y));
        player.addComponent(new RenderableComponent('@', COLORS.PLAYER, null, 100)); // Highest render priority
        player.addComponent(new HealthComponent(maxHp, false, hpRegen));
        player.addComponent(new StatsComponent(
            strength, defense, intelligence, 
            dexterity, toughness, perception, 
            wisdom, charisma, speed, 
            accuracy, pv, dv
        ));
        player.addComponent(new InventoryComponent(10));
        player.addComponent(new EquipmentComponent());
        player.addComponent(new ManaComponent(maxMana, manaRegen));
        player.addComponent(new SpellsComponent());
        player.addComponent(new GoldComponent(100)); // Start with 100 gold
        player.addComponent(new EnergyComponent(speed)); // Add energy component with player speed
        
        // Add starting inventory items if defined in player data
        if (this.playerData && this.playerData.inventory && Array.isArray(this.playerData.inventory)) {
            const inventory = player.getComponent('InventoryComponent');
            for (const itemId of this.playerData.inventory) {
                const item = this.createItem(itemId, 0, 0); // Position doesn't matter for inventory items
                if (item) {
                    inventory.addItem(item);
                    console.log(`Added starting item: ${item.name} to player inventory`);
                }
            }
        }
        
        // Add starting spells if defined in player data
        if (this.playerData && this.playerData.knownSpells && Array.isArray(this.playerData.knownSpells)) {
            const spells = player.getComponent('SpellsComponent');
            for (const spellId of this.playerData.knownSpells) {
                // Get spell data from spellbook templates
                const spellTemplate = this.spellbookTemplates[spellId];
                if (spellTemplate) {
                    // Create a spell object with the data from the template
                    const spell = {
                        id: spellId,
                        name: spellTemplate.spellName,
                        element: spellTemplate.element,
                        manaCost: spellTemplate.manaCost,
                        baseDamage: spellTemplate.baseDamage || 0,
                        range: spellTemplate.range || 1,
                        aoeRadius: spellTemplate.aoeRadius || 1,
                        duration: spellTemplate.duration || 5,
                        turnCost: spellTemplate.turnCost || 1,
                        effects: spellTemplate.effects || [],
                        description: spellTemplate.description
                    };
                    
                    spells.learnSpell(spellId, spell);
                    console.log(`Added starting spell: ${spell.name} to player spellbook`);
                }
            }
        }
        
        return player;
    }
    
    createMonster(type, x, y) {
        const template = this.monsterTemplates[type];
        if (!template) {
            console.error(`Monster type "${type}" not found!`);
            return null;
        }
        
        const monster = new Entity(template.name || type.charAt(0).toUpperCase() + type.slice(1));
        
        // Add components
        monster.addComponent(new PositionComponent(x, y));
        monster.addComponent(new RenderableComponent(template.char, template.color, null, 50));
        monster.addComponent(new HealthComponent(template.hp, false, template.hpRegen || 0));
        
        // Add StatsComponent with all the new stats
        monster.addComponent(new StatsComponent(
            template.strength,
            template.defense,
            template.intelligence || 1,
            template.dexterity || 5,
            template.toughness || 5,
            template.perception || 5,
            template.wisdom || 1,
            template.charisma || 1,
            template.speed || 100,
            template.accuracy || 70,
            template.pv || 0,
            template.dv || 0
        ));
        
        // Add ManaComponent if intelligence > 3
        if (template.intelligence && template.intelligence > 3) {
            const maxMana = template.mana || (10 + template.intelligence * 2);
            monster.addComponent(new ManaComponent(maxMana, template.manaRegen || 1));
        }
        
        // Add EnergyComponent for action economy
        monster.addComponent(new EnergyComponent(template.speed || 100));
        
        // Add AI component with target set to player to make monsters aggressive immediately
        const ai = new AIComponent('hostile');
        monster.addComponent(ai);
        
        // Set player as target to make monster immediately aggressive
        if (gameState && gameState.player) {
            ai.target = gameState.player;
            ai.state = 'chase';
        }
        
        monster.addComponent(new BlocksMovementComponent());
        
        return monster;
    }
    
    createItem(type, x, y) {
        const template = this.itemTemplates[type];
        if (!template) {
            console.error(`Item type "${type}" not found!`);
            return null;
        }
        
        const item = new Entity(template.name);
        
        // Add basic components
        item.addComponent(new PositionComponent(x, y));
        item.addComponent(new RenderableComponent(template.char, template.color, null, 20));
        item.addComponent(new ItemComponent(template.type, template.value));
        
        // Add specialized components based on item type
        if (template.type === 'weapon' || template.type === 'armor') {
            item.addComponent(new EquippableComponent(template.slot, template.statModifiers));
        } else if (template.type === 'potion') {
            item.addComponent(new UsableComponent(template.effect, template.power));
        }
        
        return item;
    }
    
    createSpellbook(type, x, y) {
        const template = this.spellbookTemplates[type];
        if (!template) {
            console.error(`Spellbook type "${type}" not found!`);
            console.log("Available templates:", Object.keys(this.spellbookTemplates));
            return null;
        }
        
        console.log(`Creating spellbook of type "${type}" with template:`, template);
        
        const spellbook = new Entity(template.name);
        
        // Add basic components
        spellbook.addComponent(new PositionComponent(x, y));
        spellbook.addComponent(new RenderableComponent(template.char, template.color, null, 20));
        spellbook.addComponent(new ItemComponent('spellbook', template.value || 50));
        
        // Add spellbook-specific component
        spellbook.addComponent(new SpellbookComponent(
            template.spellId,
            template.spellName,
            template.description,
            template.element,
            template.manaCost,
            template.baseDamage || 0,
            template.range || 1
        ));
        
        // Make the spellbook usable (to learn the spell)
        spellbook.addComponent(new UsableComponent('learn_spell', 0));
        
        console.log("Spellbook created:", spellbook);
        console.log("Components:", Array.from(spellbook.components.keys()));
        
        return spellbook;
    }
    
    createRandomMonster(x, y, dungeonLevel = 1) {
        // Get all monster types
        const monsterTypes = Object.keys(this.monsterTemplates);
        
        if (monsterTypes.length === 0) {
            return null;
        }
        
        // For higher levels, increase chance of tougher monsters
        let type;
        
        if (dungeonLevel <= 1) {
            // Level 1: Mostly weaker monsters
            type = monsterTypes.find(t => t === 'goblin') || monsterTypes[0];
        } else if (dungeonLevel <= 3) {
            // Level 2-3: Mix of weak and strong monsters
            type = Math.random() < 0.7 ? 
                (monsterTypes.find(t => t === 'goblin') || monsterTypes[0]) :
                (monsterTypes.find(t => t === 'orc') || monsterTypes[0]);
        } else {
            // Level 4+: More strong monsters, chance of trolls
            if (Math.random() < 0.4 && monsterTypes.includes('troll')) {
                type = 'troll';
            } else {
                type = Math.random() < 0.3 ? 
                    (monsterTypes.find(t => t === 'goblin') || monsterTypes[0]) :
                    (monsterTypes.find(t => t === 'orc') || monsterTypes[0]);
            }
        }
        
        return this.createMonster(type, x, y);
    }
    
    createRandomItem(x, y, dungeonLevel = 1) {
        // Get all item types
        const itemTypes = Object.keys(this.itemTemplates);
        const spellbookTypes = Object.keys(this.spellbookTemplates);
        
        if (itemTypes.length === 0 && spellbookTypes.length === 0) {
            return null;
        }
        
        // Filter by item type
        const potions = itemTypes.filter(id => 
            this.itemTemplates[id].type === 'potion');
        const weapons = itemTypes.filter(id => 
            this.itemTemplates[id].type === 'weapon');
        const armor = itemTypes.filter(id => 
            this.itemTemplates[id].type === 'armor');
        
        // Choose random item type, with different weights for different items
        const roll = Math.random();
        
        // 10% chance of a spellbook if any exist
        if (roll < 0.1 && spellbookTypes.length > 0) {
            const spellbookType = spellbookTypes[Math.floor(Math.random() * spellbookTypes.length)];
            return this.createSpellbook(spellbookType, x, y);
        }
        
        // Adjust other roll probabilities
        const adjustedRoll = Math.random();
        let type;
        
        if (adjustedRoll < 0.5 && potions.length > 0) {
            // 50% chance of potion
            type = potions[Math.floor(Math.random() * potions.length)];
        } else if (adjustedRoll < 0.8 && weapons.length > 0) {
            // 30% chance of weapon
            // For higher levels, prefer better weapons
            if (dungeonLevel >= 3 && weapons.length > 1) {
                // Try to find a better weapon (e.g., steel sword)
                const betterWeapon = weapons.find(id => id !== 'sword');
                type = betterWeapon || weapons[0];
            } else {
                type = weapons[Math.floor(Math.random() * weapons.length)];
            }
        } else if (armor.length > 0) {
            // 20% chance of armor
            // For higher levels, prefer better armor
            if (dungeonLevel >= 4 && armor.length > 1) {
                // Try to find better armor (e.g., chainmail)
                const betterArmor = armor.find(id => id !== 'leather_armor');
                type = betterArmor || armor[0];
            } else {
                type = armor[Math.floor(Math.random() * armor.length)];
            }
        } else {
            // Fallback to any item
            type = itemTypes[Math.floor(Math.random() * itemTypes.length)];
        }
        
        return this.createItem(type, x, y);
    }

    /**
     * Creates a summoned creature that is allied with the summoner
     * @param {string} type - The type of creature to summon
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {object} summoner - The entity that summoned this creature
     * @param {object} summonData - Additional customization data for the summon
     * @returns {Entity} The summoned entity
     */
    createSummonedEntity(type, x, y, summoner, summonData = {}) {
        // Start with a base monster of the specified type
        const monster = this.createMonster(type, x, y);
        if (!monster) return null;
        
        let allyBehavior = null;
        
        // Set up AI type based on creature type
        if (type === 'hydra') {
            // Hydras are stationary casters that shoot firebolts
            allyBehavior = ALLY_BEHAVIORS.STATIONARY_CASTER;
            
            // Get AI component and set it up for ranged attacks
            const ai = monster.getComponent('AIComponent');
            if (ai) {
                ai.type = 'friendly'; // Keep it friendly, we'll use our custom ally logic
                ai.state = 'idle';    // Start in idle state
                ai.target = null;     // No initial target
                ai.attackRange = 6;   // Better range for attacks
                ai.attackCooldown = 2; // Attack every 2 turns
            }
            
            // Give the hydra some intelligence for spellcasting
            const stats = monster.getComponent('StatsComponent');
            if (stats) {
                stats.intelligence = 8;  // Base intelligence for firebolts
                
                // Scale intelligence if summoner intelligence is provided
                if (summoner && summonData.intelligenceScaling) {
                    const summonerIntelligence = summoner.getComponent('StatsComponent')?.intelligence || 0;
                    stats.intelligence += Math.floor(summonerIntelligence * 0.5);  // Benefit from summoner's intelligence
                }
            }
        } else {
            // Default behavior for other summons - follow and help summoner
            allyBehavior = ALLY_BEHAVIORS.FOLLOWER;
            
            const ai = monster.getComponent('AIComponent');
            if (ai) {
                ai.type = 'friendly';
                ai.state = 'follow';
                ai.target = null;
            }
        }
        
        // Apply customization from summonData
        if (summonData.name) {
            monster.name = summonData.name;
        } else {
            monster.name = `Summoned ${monster.name}`;
        }
        
        // Apply color override
        if (summonData.color) {
            const renderable = monster.getComponent('RenderableComponent');
            if (renderable) {
                renderable.color = summonData.color;
            }
        }
        
        // Apply stat modifiers
        const stats = monster.getComponent('StatsComponent');
        if (stats) {
            if (summonData.strength) stats.strength = summonData.strength;
            if (summonData.defense) stats.defense = summonData.defense;
            
            // Scale stats if summoner intelligence is provided
            if (summoner && summonData.intelligenceScaling) {
                const intelligence = summoner.getComponent('StatsComponent')?.intelligence || 0;
                stats.strength += Math.floor(intelligence * summonData.intelligenceScaling.strength);
                stats.defense += Math.floor(intelligence * summonData.intelligenceScaling.defense);
            }
        }
        
        // Apply health modifiers
        const health = monster.getComponent('HealthComponent');
        if (health && summonData.hp) {
            health.maxHp = summonData.hp;
            health.hp = summonData.hp;
            
            // Scale HP if summoner intelligence is provided
            if (summoner && summonData.intelligenceScaling) {
                const intelligence = summoner.getComponent('StatsComponent')?.intelligence || 0;
                const hpBonus = Math.floor(intelligence * summonData.intelligenceScaling.hp);
                health.maxHp += hpBonus;
                health.hp = health.maxHp;
            }
        }
        
        // Add SummonedBy component
        const duration = summonData.duration || 20; // Default duration of 20 turns
        monster.addComponent(new SummonedByComponent(summoner, duration));
        
        // Set the turn when this summon was created
        const summonedBy = monster.getComponent('SummonedByComponent');
        if (summonedBy) {
            summonedBy.startTurn = gameState.turn;
        }
        
        // Register with AllyLogic to handle special behaviors
        if (allyBehavior) {
            allyLogic.registerSummonedCreature(monster.id, x, y, allyBehavior);
        }
        
        // Update the summoning announcement based on creature type
        if (type === 'hydra') {
            gameState.addMessage(`A ${monster.name} appears! It hisses menacingly and glares at nearby enemies.`);
        }
        
        return monster;
    }
}

export default EntityFactory;