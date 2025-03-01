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
  EnergyComponent,
  LimbComponent,
  WillpowerComponent,
  StaminaComponent,
  DialogueComponent,
  ArenaManagerComponent
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
          mana: monster.mana,
          manaRegen: monster.manaRegen || 0,
          hpRegen: monster.hpRegen || 0,
          xp: monster.xp,
          limbs: monster.limbs || null,
          spells: monster.spells || [],
          ai: monster.ai || null
        };
      });
    }
    
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
          value: item.value,
          twoHanded: item.twoHanded || false,
          limbDamage: item.limbDamage || 0,
          limbProtection: item.limbProtection || 0
        };
      });
    }
    
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
    
    const maxHp = this.playerData ? this.playerData.maxHp : 20;
    const strength = this.playerData ? this.playerData.strength : 7;
    const defense = this.playerData ? this.playerData.defense : 1;
    const intelligence = this.playerData ? this.playerData.intelligence : 5;
    const dexterity = this.playerData ? this.playerData.dexterity : 5;
    const toughness = this.playerData ? this.playerData.toughness : 5;
    const perception = this.playerData ? this.playerData.perception : 5;
    const wisdom = this.playerData ? this.playerData.wisdom : 5;
    const charisma = this.playerData ? this.playerData.charisma : 5;
    const willpower = this.playerData ? this.playerData.willpower : 4;
    const speed = this.playerData ? this.playerData.speed : 100;
    const accuracy = this.playerData ? this.playerData.accuracy : 70;
    const pv = this.playerData ? this.playerData.pv : 1;
    const dv = this.playerData ? this.playerData.dv : 1;
    const hpRegen = this.playerData ? this.playerData.hpRegen : 1;
    const manaRegen = this.playerData ? this.playerData.manaRegen : 1;
    const wpRegen = this.playerData ? this.playerData.wpRegen : 1;
    const spRegen = this.playerData ? this.playerData.spRegen : 2;
    const maxMana = this.playerData?.maxMana ? this.playerData.maxMana : 10 + (intelligence * 2) + (wisdom * 1);
    const maxWP = this.playerData?.maxWP ? this.playerData.maxWP : 20 + (willpower * 5);
    const maxSP = this.playerData?.maxSP ? this.playerData.maxSP : 30 + (strength * 3) + (toughness * 2);
    
    player.addComponent(new PositionComponent(x, y));
    player.addComponent(new RenderableComponent('@', COLORS.PLAYER, null, 100));
    player.addComponent(new HealthComponent(maxHp, false, hpRegen));
    player.addComponent(new StatsComponent(
      strength, defense, intelligence, 
      dexterity, toughness, perception, 
      wisdom, charisma, willpower, speed, 
      accuracy, pv, dv
    ));
    player.addComponent(new InventoryComponent(10));
    player.addComponent(new EquipmentComponent());
    player.addComponent(new ManaComponent(maxMana, manaRegen));
    player.addComponent(new WillpowerComponent(maxWP, wpRegen));
    player.addComponent(new StaminaComponent(maxSP, spRegen));
    player.addComponent(new SpellsComponent());
    player.addComponent(new GoldComponent(100));
    player.addComponent(new EnergyComponent(speed));
    
    if (this.playerData?.limbs) {
      player.addComponent(new LimbComponent(this.playerData.limbs));
    } else {
      const defaultLimbs = {
        head: { name: "Head", slot: "head", equipped: null, health: 100 },
        chest: { name: "Chest", slot: "chest", equipped: null, health: 100 },
        leftHand: { name: "Left Hand", slot: "hand", equipped: null, health: 100 },
        rightHand: { name: "Right Hand", slot: "hand", equipped: null, health: 100 },
        feet: { name: "Feet", slot: "feet", equipped: null, health: 100 }
      };
      player.addComponent(new LimbComponent(defaultLimbs));
    }
    
    if (this.playerData?.inventory && Array.isArray(this.playerData.inventory)) {
      const inventory = player.getComponent('InventoryComponent');
      for (const itemId of this.playerData.inventory) {
        const item = this.createItem(itemId, 0, 0);
        if (item) {
          inventory.addItem(item);
        }
      }
    }
    
    if (this.playerData?.knownSpells && Array.isArray(this.playerData.knownSpells)) {
      const spells = player.getComponent('SpellsComponent');
      for (const spellId of this.playerData.knownSpells) {
        const spellTemplate = this.spellbookTemplates[spellId];
        if (spellTemplate) {
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
        }
      }
    }
    
    return player;
  }
  
  createMonster(type, x, y) {
    const template = this.monsterTemplates[type];
    if (!template) return null;
    
    console.log(`[ENTITY] Creating monster of type ${type}, template:`, template);
    
    const uniqueId = `${type}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    
    const monster = new Entity(template.name || type.charAt(0).toUpperCase() + type.slice(1));
    monster.id = uniqueId;
    monster.type = type;
    
    monster.addComponent(new PositionComponent(x, y));
    monster.addComponent(new RenderableComponent(template.char, template.color, null, 50));
    monster.addComponent(new HealthComponent(template.hp, false, template.hpRegen || 0));
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
    
    if (template.mana || (template.intelligence && template.intelligence > 3)) {
      const maxMana = template.mana || (10 + template.intelligence * 2);
      monster.addComponent(new ManaComponent(maxMana, template.manaRegen || 1));
    }
    
    if (template.spells?.length > 0) {
      const spellsComponent = new SpellsComponent();
      
      for (const spellId of template.spells) {
        const spellTemplate = this.spellbookTemplates[spellId];
        
        if (spellTemplate) {
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
          
          spellsComponent.learnSpell(spellId, spell);
        } else {
          const fallbackSpell = {
            id: spellId,
            name: spellId.charAt(0).toUpperCase() + spellId.slice(1),
            manaCost: 5,
            baseDamage: 6,
            element: 'arcane',
            range: 5,
            aoeRadius: 1,
            duration: 3,
            turnCost: 1,
            effects: [],
            description: `A basic ${spellId} spell`
          };
          
          spellsComponent.learnSpell(spellId, fallbackSpell);
        }
      }
      
      monster.addComponent(spellsComponent);
    }
    
    monster.addComponent(new EnergyComponent(template.speed || 100));
    
    const ai = new AIComponent('hostile');
    monster.addComponent(ai);
    
    if (template.ai) {
      // Initialize using the AI component's method
      ai.initializeFromMonsterData({
        ai: template.ai,
        specialAbilities: template.specialAbilities
      });
      
      // Map behavior type to behavior ID for data-driven system
      if (template.ai.behaviorType) {
        console.log(`[ENTITY] Setting behavior for ${monster.name}, type: ${template.ai.behaviorType}`);
        ai.behaviorType = template.ai.behaviorType;
        
        // Assign behavior ID even if behaviorLoader isn't available yet
        if (window.behaviorLoader) {
          ai.behaviorId = window.behaviorLoader.mapAITypeToBehaviorId(template.ai.behaviorType);
        } else {
          // Direct mapping if loader isn't available
          const mapping = {
            'default': 'melee_attacker',
            'ranged': 'ranged_attacker',
            'spellcaster': 'spellcaster',
            'summoner': 'summoner',
            'hydra': 'hydra',
            'stationary': 'stationary_caster'
          };
          ai.behaviorId = mapping[template.ai.behaviorType] || 'melee_attacker';
        }
        
        console.log(`[ENTITY] Assigned behaviorId: ${ai.behaviorId} to ${monster.name}`);
        
        // Set initial state from behavior definition
        if (window.behaviorDefinition) {
          const behavior = window.behaviorDefinition.behaviors[ai.behaviorId];
          if (behavior && behavior.initial_state) {
            ai.currentState = behavior.initial_state;
          }
        } else {
          // Default initial state if behavior definition isn't available
          ai.currentState = 'idle';
        }
      }
      
      // Legacy support for other properties
      if (template.ai.preferredMinDist) ai.preferredMinDist = template.ai.preferredMinDist;
      if (template.ai.preferredMaxDist) ai.preferredMaxDist = template.ai.preferredMaxDist;
      if (template.ai.attackRange) ai.attackRange = template.ai.attackRange;
      if (template.ai.attackCooldown) ai.attackCooldown = template.ai.attackCooldown;
    }
    
    // Add special abilities if any
    if (template.specialAbilities) {
      ai.specialAbilities = Array.isArray(template.specialAbilities) 
        ? template.specialAbilities 
        : [template.specialAbilities];
    }
    
    console.log(`[ENTITY] Final AI component for ${monster.name}:`, {
      type: ai.type,
      behaviorType: ai.behaviorType,
      behaviorId: ai.behaviorId,
      currentState: ai.currentState,
      state: ai.state
    });
    
    if (gameState?.player) {
      ai.target = gameState.player;
      ai.state = 'chase';
    }
    
    monster.addComponent(new BlocksMovementComponent());
    monster.blockMovement = true;
    
    if (template.limbs) {
      monster.addComponent(new LimbComponent(template.limbs));
      
      for (const [limbId, limb] of Object.entries(template.limbs)) {
        if (limb.equipped) {
          const item = this.createItem(limb.equipped, x, y);
          if (item) {
            if (!monster.hasComponent('InventoryComponent')) {
              monster.addComponent(new InventoryComponent(5));
            }
            monster.getComponent('InventoryComponent').addItem(item);
            
            const limbComponent = monster.getComponent('LimbComponent');
            if (limbComponent) {
              limbComponent.equipToLimb(limbId, limb.equipped);
            }
          }
        }
      }
    } else {
      const defaultLimbs = {
        head: { name: "Head", slot: "head", equipped: null, health: 100 },
        chest: { name: "Chest", slot: "chest", equipped: null, health: 100 },
        leftHand: { name: "Left Hand", slot: "hand", equipped: null, health: 100 },
        rightHand: { name: "Right Hand", slot: "hand", equipped: null, health: 100 },
        feet: { name: "Feet", slot: "feet", equipped: null, health: 100 }
      };
      monster.addComponent(new LimbComponent(defaultLimbs));
    }
    
    return monster;
  }

  createItem(type, x, y) {
    const template = this.itemTemplates[type];
    if (!template) return null;
    
    const item = new Entity(template.name);
    
    item.addComponent(new PositionComponent(x, y));
    item.addComponent(new RenderableComponent(template.char, template.color, null, 20));
    item.addComponent(new ItemComponent(template.type, template.value));
    
    if (template.type === 'weapon' || template.type === 'armor' || template.type === 'shield') {
      const equippable = new EquippableComponent(template.slot, template.statModifiers);
      
      if (template.twoHanded) equippable.twoHanded = template.twoHanded;
      if (template.limbDamage) equippable.limbDamage = template.limbDamage;
      if (template.limbProtection) equippable.limbProtection = template.limbProtection;
      
      item.addComponent(equippable);
    } else if (template.type === 'potion') {
      item.addComponent(new UsableComponent(template.effect, template.power));
    }
    
    return item;
  }
  
  createSpellbook(type, x, y) {
    const template = this.spellbookTemplates[type];
    if (!template) return null;
    
    const spellbook = new Entity(template.name);
    
    spellbook.addComponent(new PositionComponent(x, y));
    spellbook.addComponent(new RenderableComponent(template.char, template.color, null, 20));
    spellbook.addComponent(new ItemComponent('spellbook', template.value || 50));
    
    spellbook.addComponent(new SpellbookComponent(
      template.spellId,
      template.spellName,
      template.description,
      template.element,
      template.manaCost,
      template.baseDamage || 0,
      template.range || 1
    ));
    
    spellbook.addComponent(new UsableComponent('learn_spell', 0));
    
    return spellbook;
  }
  
  createRandomMonster(x, y, dungeonLevel = 1) {
    const monsterTypes = Object.keys(this.monsterTemplates);
    
    if (monsterTypes.length === 0) return null;
    
    let type;
    
    if (dungeonLevel <= 1) {
      type = monsterTypes.find(t => t === 'goblin') || monsterTypes[0];
    } else if (dungeonLevel <= 3) {
      type = Math.random() < 0.7 ? 
        (monsterTypes.find(t => t === 'goblin') || monsterTypes[0]) :
        (monsterTypes.find(t => t === 'orc') || monsterTypes[0]);
    } else {
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
    const itemTypes = Object.keys(this.itemTemplates);
    const spellbookTypes = Object.keys(this.spellbookTemplates);
    
    if (itemTypes.length === 0 && spellbookTypes.length === 0) return null;
    
    const potions = itemTypes.filter(id => this.itemTemplates[id].type === 'potion');
    const weapons = itemTypes.filter(id => this.itemTemplates[id].type === 'weapon');
    const armor = itemTypes.filter(id => this.itemTemplates[id].type === 'armor');
    
    const roll = Math.random();
    
    if (roll < 0.1 && spellbookTypes.length > 0) {
      const spellbookType = spellbookTypes[Math.floor(Math.random() * spellbookTypes.length)];
      return this.createSpellbook(spellbookType, x, y);
    }
    
    const adjustedRoll = Math.random();
    let type;
    
    if (adjustedRoll < 0.5 && potions.length > 0) {
      type = potions[Math.floor(Math.random() * potions.length)];
    } else if (adjustedRoll < 0.8 && weapons.length > 0) {
      if (dungeonLevel >= 3 && weapons.length > 1) {
        const betterWeapon = weapons.find(id => id !== 'sword');
        type = betterWeapon || weapons[0];
      } else {
        type = weapons[Math.floor(Math.random() * weapons.length)];
      }
    } else if (armor.length > 0) {
      if (dungeonLevel >= 4 && armor.length > 1) {
        const betterArmor = armor.find(id => id !== 'leather_armor');
        type = betterArmor || armor[0];
      } else {
        type = armor[Math.floor(Math.random() * armor.length)];
      }
    } else {
      type = itemTypes[Math.floor(Math.random() * itemTypes.length)];
    }
    
    return this.createItem(type, x, y);
  }

  createSummonedEntity(type, x, y, summoner, summonData = {}) {
    const monster = this.createMonster(type, x, y);
    if (!monster) return null;
    
    let allyBehavior = null;
    
    if (type === 'hydra') {
      allyBehavior = ALLY_BEHAVIORS.STATIONARY_CASTER;
      
      monster.removeComponent('AIComponent');
      
      const newAI = new AIComponent('friendly');
      newAI.type = 'friendly';
      newAI.faction = 'ally';
      newAI.state = 'idle';
      newAI.target = null;
      newAI.attackRange = 6;
      newAI.attackCooldown = 2;
      newAI.behaviorType = 'stationary';
      monster.addComponent(newAI);
      
      const stats = monster.getComponent('StatsComponent');
      if (stats) {
        stats.intelligence = 8;
        
        if (summoner && summonData.intelligenceScaling) {
          const summonerIntelligence = summoner.getComponent('StatsComponent')?.intelligence || 0;
          stats.intelligence += Math.floor(summonerIntelligence * 0.5);
        }
      }
    } else {
      allyBehavior = ALLY_BEHAVIORS.FOLLOWER;
      
      monster.removeComponent('AIComponent');
      
      const newAI = new AIComponent('friendly');
      newAI.type = 'friendly';
      newAI.faction = 'ally';
      newAI.state = 'follow';
      newAI.target = null;
      newAI.attackRange = 1;
      newAI.attackCooldown = 2;
      newAI.behaviorType = 'follower';
      
      if (monster.type === 'fire_mage') {
        newAI.behaviorType = 'spellcaster';
        newAI.attackRange = 6;
        newAI.spellPriorities = { "fireball": { "priority": 1, "cooldown": 3 } };
        // Always use real spells for fire mages - this is critical for proper spell casting
        newAI.useRealSpells = true;
        console.log("Fire Mage created - useRealSpells flag set to TRUE");
      }
      else if (monster.type === 'archer' || monster.type === 'orc_shaman') {
        newAI.attackRange = 5;
        newAI.behaviorType = 'ranged';
      }
      
      monster.addComponent(newAI);
    }
    
    if (summonData.name) {
      monster.name = summonData.name;
    } else {
      monster.name = `Summoned ${monster.name}`;
    }
    
    if (summonData.color) {
      const renderable = monster.getComponent('RenderableComponent');
      if (renderable) {
        renderable.color = summonData.color;
      }
    }
    
    const stats = monster.getComponent('StatsComponent');
    if (stats) {
      if (summonData.strength) stats.strength = summonData.strength;
      if (summonData.defense) stats.defense = summonData.defense;
      
      if (summoner && summonData.intelligenceScaling) {
        const intelligence = summoner.getComponent('StatsComponent')?.intelligence || 0;
        stats.strength += Math.floor(intelligence * summonData.intelligenceScaling.strength);
        stats.defense += Math.floor(intelligence * summonData.intelligenceScaling.defense);
      }
      
      if (monster.type === 'fire_mage' && stats.intelligence < 9) {
        stats.intelligence = 9;
      }
    }
    
    const health = monster.getComponent('HealthComponent');
    if (health && summonData.hp) {
      health.maxHp = summonData.hp;
      health.hp = summonData.hp;
      
      if (summoner && summonData.intelligenceScaling) {
        const intelligence = summoner.getComponent('StatsComponent')?.intelligence || 0;
        const hpBonus = Math.floor(intelligence * summonData.intelligenceScaling.hp);
        health.maxHp += hpBonus;
        health.hp = health.maxHp;
      }
    }
    
    if (monster.type === 'fire_mage') {
      // Set up mana for the fire mage
      const manaComp = monster.getComponent('ManaComponent');
      if (manaComp) {
        if (manaComp.mana < 15 || manaComp.maxMana < 15) {
          manaComp.maxMana = 90;
          manaComp.mana = 90;
        }
      } else {
        monster.addComponent(new ManaComponent(90, 2));
      }
      
      // We'll load ALL spells from the monster template
      console.log(`NOTICE: Setting up Fire Mage spells from monster template`);
      
      // Don't create or assign any hardcoded spells - we'll use exactly what's in the template
      
      // Get the existing SpellsComponent that was created during monster creation
      const spellsComp = monster.getComponent('SpellsComponent');
      
      // Set the flag to use real implementations for ALL spells this monster has
      if (spellsComp && spellsComp.knownSpells) {
        // Mark all spells to use real implementation
        spellsComp.knownSpells.forEach((spell, id) => {
          spell.useRealImplementation = true;
          console.log(`Marking spell ${id} to use real implementation`);
        });
        
        // Fetch the latest spellbook data to ensure we have proper spell info
        fetch('data/spellbooks.json')
          .then(response => response.json())
          .then(spellbooks => {
            // Update each spell with the latest data from spellbooks.json
            spellsComp.knownSpells.forEach((spell, id) => {
              const spellbook = spellbooks.find(s => s.spellId === id);
              if (spellbook) {
                // Update spell with data from spellbook
                Object.assign(spell, {
                  name: spellbook.spellName,
                  spellName: spellbook.spellName,
                  manaCost: spellbook.manaCost,
                  baseDamage: spellbook.baseDamage,
                  element: spellbook.element,
                  range: spellbook.range,
                  aoeRadius: spellbook.aoeRadius,
                  effects: spellbook.effects,
                  description: spellbook.description,
                  tags: spellbook.tags,
                  useRealImplementation: true,
                  loadTimeStamp: Date.now()
                });
                console.log(`Updated ${id} from spellbooks.json: ${spellbook.spellName}, element: ${spellbook.element}`);
              }
            });
          })
          .catch(e => console.error(`Error fetching spellbooks.json:`, e));
      } else {
        console.error("Fire Mage is missing SpellsComponent - this is unexpected!");
      }
    } // End of fire_mage specific block
    
    const duration = summonData.duration || 20;
    monster.addComponent(new SummonedByComponent(summoner, duration));
    
    const summonedBy = monster.getComponent('SummonedByComponent');
    if (summonedBy) {
      summonedBy.startTurn = gameState.turn;
    }
    
    if (allyBehavior) {
      allyLogic.registerSummonedCreature(monster.id, x, y, allyBehavior);
    }
    
    if (type === 'fire_mage') {
      import('./ai/monsterSpellcaster.js').then(module => {
        const spellcaster = module.default;
        spellcaster.setupMonsterForRealSpells(monster);
      }).catch(error => { });
      
      gameState.addMessage(`A ${monster.name} appears, ready to cast powerful fire spells!`);
    } else if (type === 'hydra') {
      gameState.addMessage(`A ${monster.name} appears! It hisses menacingly and glares at nearby enemies.`);
    }
    
    return monster;
  }
}

export default EntityFactory;
