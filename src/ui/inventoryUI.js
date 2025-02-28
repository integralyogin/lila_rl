import gameState from '../core/gameState.js';
import eventBus from '../core/eventEmitter.js';
import { PositionComponent } from '../entities/components.js';

class InventoryUI {
    constructor() {
        this.visible = false;
        this.selectedIndex = 0;
        this.inventoryElement = null;
        
        // Initialize the UI
        this.initialize();
        
        // Subscribe to events
        eventBus.on('inventoryOpened', () => this.open());
        eventBus.on('inventoryClosed', () => this.close());
        eventBus.on('inventoryKeyPressed', (key) => this.handleKeyPress(key));
    }
    
    initialize() {
        // Create inventory UI container if it doesn't exist
        if (!document.getElementById('inventory-ui')) {
            const inventoryUI = document.createElement('div');
            inventoryUI.id = 'inventory-ui';
            inventoryUI.className = 'inventory-ui';
            inventoryUI.style.display = 'none';
            
            // Create header
            const header = document.createElement('div');
            header.className = 'inventory-header';
            header.textContent = 'Inventory';
            
            // Create item list container
            const itemList = document.createElement('div');
            itemList.className = 'inventory-items';
            itemList.id = 'inventory-items';
            
            // Create footer with instructions
            const footer = document.createElement('div');
            footer.className = 'inventory-footer';
            footer.innerHTML = `
                <div><b>↑↓</b> Navigate items</div>
                <div><b>u</b> Use selected item</div>
                <div><b>e</b> Equip/unequip item</div>
                <div><b>d</b> Drop item</div>
                <div><b>ESC/i</b> Close inventory</div>
            `;
            
            // Assemble the UI
            inventoryUI.appendChild(header);
            inventoryUI.appendChild(itemList);
            inventoryUI.appendChild(footer);
            
            // Add to the game container
            const gameContainer = document.getElementById('game-container') || document.body;
            gameContainer.appendChild(inventoryUI);
            
            this.inventoryElement = itemList;
        } else {
            this.inventoryElement = document.getElementById('inventory-items');
        }
    }
    
    open() {
        if (!gameState.player || !gameState.player.hasComponent('InventoryComponent')) {
            gameState.addMessage("You don't have an inventory.");
            gameState.gameMode = 'exploration';
            return;
        }
        
        const inventory = gameState.player.getComponent('InventoryComponent');
        
        // Check if inventory is empty
        if (inventory.items.length === 0) {
            gameState.addMessage("Your inventory is empty.");
            gameState.gameMode = 'exploration';
            return;
        }
        
        // Reset selection
        this.selectedIndex = 0;
        
        // Update UI
        this.render();
        
        // Show inventory UI
        const inventoryUI = document.getElementById('inventory-ui');
        if (inventoryUI) {
            inventoryUI.style.display = 'flex';
        }
        
        this.visible = true;
    }
    
    close() {
        // Hide inventory UI
        const inventoryUI = document.getElementById('inventory-ui');
        if (inventoryUI) {
            inventoryUI.style.display = 'none';
        }
        
        this.visible = false;
    }
    
    render() {
        if (!this.inventoryElement) return;
        
        // Clear the element
        this.inventoryElement.innerHTML = '';
        
        // Get player's inventory
        const inventory = gameState.player.getComponent('InventoryComponent');
        if (!inventory) return;
        
        // Get equipment info
        const equipment = gameState.player.getComponent('EquipmentComponent');
        
        // Create an element for each item in the inventory
        inventory.items.forEach((item, index) => {
            const itemElement = document.createElement('div');
            itemElement.className = 'inventory-item';
            
            // Highlight selected item
            if (index === this.selectedIndex) {
                itemElement.classList.add('selected');
            }
            
            // Get item components
            const itemComp = item.getComponent('ItemComponent');
            const renderable = item.getComponent('RenderableComponent');
            const equippable = item.getComponent('EquippableComponent');
            
            // Create the item name display with symbol
            const symbol = document.createElement('span');
            symbol.className = 'item-symbol';
            symbol.textContent = renderable ? renderable.char : '?';
            symbol.style.color = renderable ? renderable.color : '#fff';
            
            // Create name with info
            const nameElement = document.createElement('span');
            nameElement.className = 'item-name';
            
            // Add equip status
            let itemName = item.name;
            if (equippable && equippable.isEquipped) {
                itemName += ' (equipped)';
                nameElement.style.color = '#6fc';  // Equipped items get a different color
            }
            
            // Add selection indicator
            if (index === this.selectedIndex) {
                nameElement.style.fontWeight = 'bold';
            }
            
            nameElement.textContent = itemName;
            
            // Add item type info
            const typeElement = document.createElement('span');
            typeElement.className = 'item-type';
            
            if (itemComp) {
                switch (itemComp.type) {
                    case 'weapon':
                        const damage = equippable?.statModifiers?.strength || 0;
                        typeElement.textContent = `Weapon (+${damage} dmg)`;
                        break;
                    case 'armor':
                        const defense = equippable?.statModifiers?.defense || 0;
                        typeElement.textContent = `Armor (+${defense} def)`;
                        break;
                    case 'potion':
                        const usable = item.getComponent('UsableComponent');
                        if (usable && usable.effect === 'healing') {
                            typeElement.textContent = `Potion (+${usable.power} hp)`;
                        } else {
                            typeElement.textContent = 'Potion';
                        }
                        break;
                    case 'spellbook':
                        const spellbook = item.getComponent('SpellbookComponent');
                        if (spellbook) {
                            typeElement.textContent = `Spellbook (${spellbook.spellName})`;
                            typeElement.style.color = '#6bf'; // Special color for spellbooks
                        } else {
                            typeElement.textContent = 'Spellbook';
                        }
                        break;
                    default:
                        typeElement.textContent = itemComp.type.charAt(0).toUpperCase() + itemComp.type.slice(1);
                }
            }
            
            // Assemble item row
            itemElement.appendChild(symbol);
            itemElement.appendChild(nameElement);
            itemElement.appendChild(typeElement);
            
            this.inventoryElement.appendChild(itemElement);
        });
    }
    
    handleKeyPress(key) {
        const inventory = gameState.player.getComponent('InventoryComponent');
        if (!inventory || inventory.items.length === 0) return;
        
        // Navigate through items
        if (key === 'ArrowUp' || key === 'w' || key === 'k') {
            this.selectedIndex = (this.selectedIndex - 1 + inventory.items.length) % inventory.items.length;
            this.render();
        } else if (key === 'ArrowDown' || key === 's' || key === 'j') {
            this.selectedIndex = (this.selectedIndex + 1) % inventory.items.length;
            this.render();
        }
        // Use item
        else if (key === 'u') {
            this.useSelectedItem();
        }
        // Drop item
        else if (key === 'd') {
            this.dropSelectedItem();
        }
        // Equip/unequip item
        else if (key === 'e') {
            this.equipSelectedItem();
        }
    }
    
    getSelectedItem() {
        const inventory = gameState.player.getComponent('InventoryComponent');
        if (!inventory || this.selectedIndex >= inventory.items.length) {
            return null;
        }
        
        return inventory.items[this.selectedIndex];
    }
    
    useSelectedItem() {
        const item = this.getSelectedItem();
        if (!item) return;
        
        console.log("Attempting to use item:", item);
        
        // Debug the components on this item
        console.log("Item components:", Array.from(item.components.keys()));
        
        // Check if item is usable
        if (!item.hasComponent('UsableComponent')) {
            gameState.addMessage(`You can't use the ${item.name}.`);
            return;
        }
        
        const usable = item.getComponent('UsableComponent');
        console.log("Usable component:", usable);
        
        // Handle different item effects
        if (usable.effect === 'healing') {
            // Heal the player
            const playerHealth = gameState.player.getComponent('HealthComponent');
            
            if (playerHealth.hp >= playerHealth.maxHp) {
                gameState.addMessage("You're already at full health.");
                return;
            }
            
            // Apply healing
            const healAmount = usable.power;
            playerHealth.heal(healAmount);
            
            // Remove from inventory
            const inventory = gameState.player.getComponent('InventoryComponent');
            inventory.removeItem(item);
            
            gameState.addMessage(`You use the ${item.name} and heal for ${healAmount} HP.`);
            
            // Close inventory and go back to exploration mode
            this.close();
            gameState.gameMode = 'exploration';
        } 
        // Handle spellbooks
        else if (usable.effect === 'learn_spell') {
            console.log("Handling spellbook usage");
            
            // Check if it's a spellbook
            if (!item.hasComponent('SpellbookComponent')) {
                gameState.addMessage(`This isn't a proper spellbook.`);
                console.error("Item is missing SpellbookComponent");
                return;
            }
            
            const spellbook = item.getComponent('SpellbookComponent');
            console.log("Spellbook component:", spellbook);
            
            const playerSpells = gameState.player.getComponent('SpellsComponent');
            
            if (!playerSpells) {
                gameState.addMessage(`You can't learn spells.`);
                console.error("Player is missing SpellsComponent");
                return;
            }
            
            // Check if player already knows this spell
            if (playerSpells.hasSpell(spellbook.spellId)) {
                gameState.addMessage(`You already know the ${spellbook.spellName} spell.`);
                return;
            }
            
            // Learn the spell
            playerSpells.learnSpell(spellbook.spellId, {
                name: spellbook.spellName,
                description: spellbook.description,
                element: spellbook.element,
                manaCost: spellbook.manaCost,
                baseDamage: spellbook.baseDamage,
                range: spellbook.range
            });
            
            console.log(`Player learned spell: ${spellbook.spellName}`);
            console.log("Player's spells:", playerSpells.knownSpells);
            
            // Remove the spellbook from inventory
            const inventory = gameState.player.getComponent('InventoryComponent');
            inventory.removeItem(item);
            
            gameState.addMessage(`You read the ${item.name} and learn the ${spellbook.spellName} spell!`, "important");
            
            // Close inventory and go back to exploration mode
            this.close();
            gameState.gameMode = 'exploration';
        } else {
            gameState.addMessage(`You can't figure out how to use the ${item.name}.`);
            console.log(`Unknown usable effect: ${usable.effect}`);
        }
    }
    
    dropSelectedItem() {
        const item = this.getSelectedItem();
        if (!item) return;
        
        const inventory = gameState.player.getComponent('InventoryComponent');
        
        // Check if equipped (unequip first)
        if (item.hasComponent('EquippableComponent') && item.getComponent('EquippableComponent').isEquipped) {
            const equipment = gameState.player.getComponent('EquipmentComponent');
            equipment.unequip(item.getComponent('EquippableComponent').slot);
        }
        
        // Remove from inventory
        inventory.removeItem(item);
        
        // Add item to the map at player position
        const { x, y } = gameState.player.position;
        item.addComponent(new PositionComponent(x, y));
        gameState.addEntity(item);
        
        gameState.addMessage(`You drop the ${item.name}.`);
        
        // Refresh the inventory display
        this.render();
        
        // If inventory is now empty, close it
        if (inventory.items.length === 0) {
            this.close();
            gameState.gameMode = 'exploration';
        }
    }
    
    equipSelectedItem() {
        const item = this.getSelectedItem();
        if (!item) return;
        
        // Check if item can be equipped
        if (!item.hasComponent('EquippableComponent')) {
            gameState.addMessage(`You can't equip the ${item.name}.`);
            return;
        }
        
        const equippable = item.getComponent('EquippableComponent');
        const equipment = gameState.player.getComponent('EquipmentComponent');
        
        if (!equipment) {
            gameState.addMessage("You can't equip items.");
            return;
        }
        
        // Toggle equipped state
        if (equippable.isEquipped) {
            // Unequip
            equipment.unequip(equippable.slot);
            gameState.addMessage(`You unequip the ${item.name}.`);
        } else {
            // Equip
            if (equipment.equip(item)) {
                gameState.addMessage(`You equip the ${item.name}.`);
            } else {
                gameState.addMessage(`You can't equip the ${item.name}.`);
            }
        }
        
        // Refresh the inventory display
        this.render();
    }
}

export default InventoryUI;