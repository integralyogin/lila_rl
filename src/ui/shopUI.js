import gameState from '../core/gameState.js';
import eventBus from '../core/eventEmitter.js';
import { PositionComponent, ItemComponent, RenderableComponent, EquippableComponent, UsableComponent } from '../entities/components.js';
import Entity from '../entities/entity.js';

// Debug flag
const DEBUG = true;
function log(...args) {
    if (DEBUG) console.log(...args);
}

class ShopUI {
    constructor() {
        this.visible = false;
        this.selectedIndex = 0;
        this.shopElement = null;
        this.shopkeeper = null;
        this.items = [];
        this.mode = 'buy'; // 'buy' or 'sell'
        this.entityFactory = null; // Will be set by game.js
        
        // Initialize the UI
        this.initialize();
        
        // Subscribe to events
        eventBus.on('shopOpened', (shopkeeper, items) => this.open(shopkeeper, items));
        eventBus.on('shopClosed', () => this.close());
        
        // Add direct key listener for shop keys
        this.boundHandleKeyDown = this.handleKeyDown.bind(this);
        // Will add event listener when shop opens, not in constructor
        
        // Also keep the event bus listener as backup
        eventBus.on('shopKeyPressed', (key) => this.handleKeyPress(key));
    }
    
    initialize() {
        // Create shop UI container if it doesn't exist
        if (!document.getElementById('shop-ui')) {
            const shopUI = document.createElement('div');
            shopUI.id = 'shop-ui';
            shopUI.className = 'shop-ui';
            shopUI.style.display = 'none';
            
            // Create header
            const header = document.createElement('div');
            header.className = 'shop-header';
            header.innerHTML = `<div id="shop-title">Shop</div><div id="player-gold">Gold: 0</div>`;
            
            // Create item list container
            const itemList = document.createElement('div');
            itemList.className = 'shop-items';
            itemList.id = 'shop-items';
            
            // Create mode toggle
            const modeToggle = document.createElement('div');
            modeToggle.className = 'shop-mode-toggle';
            modeToggle.id = 'shop-mode-toggle';
            modeToggle.innerHTML = `
                <div class="mode-option mode-buy selected">Buy</div>
                <div class="mode-option mode-sell">Sell</div>
            `;
            
            // Create footer with instructions
            const footer = document.createElement('div');
            footer.className = 'shop-footer';
            footer.innerHTML = `
                <div><b>↑↓</b> Navigate items</div>
                <div><b>B/S</b> or <b>←/→</b> Switch buy/sell mode</div>
                <div><b>Enter</b> or <b>Space</b> Buy/Sell selected item</div>
                <div><b>ESC</b> Close shop</div>
            `;
            
            // Assemble the UI
            shopUI.appendChild(header);
            shopUI.appendChild(modeToggle);
            shopUI.appendChild(itemList);
            shopUI.appendChild(footer);
            
            // Add to the game container
            const gameContainer = document.getElementById('game-container') || document.body;
            gameContainer.appendChild(shopUI);
            
            this.shopElement = itemList;
            
            // Add custom CSS for shop UI
            this.addShopStyles();
        } else {
            this.shopElement = document.getElementById('shop-items');
        }
    }
    
    addShopStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .shop-ui {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 50%;
                max-width: 500px;
                background: #222;
                border: 2px solid #666;
                color: #fff;
                padding: 10px;
                display: flex;
                flex-direction: column;
                z-index: 100;
                font-family: monospace;
            }

            .shop-header {
                display: flex;
                justify-content: space-between;
                padding: 5px;
                background: #333;
                margin-bottom: 10px;
                font-weight: bold;
            }
            
            #player-gold {
                color: #ffd700;
            }
            
            .shop-mode-toggle {
                display: flex;
                margin-bottom: 10px;
            }
            
            .mode-option {
                flex: 1;
                text-align: center;
                padding: 5px;
                background: #333;
                cursor: pointer;
            }
            
            .mode-option.selected {
                background: #555;
                font-weight: bold;
            }
            
            .shop-items {
                max-height: 300px;
                overflow-y: auto;
                margin-bottom: 10px;
            }
            
            .shop-item {
                display: flex;
                justify-content: space-between;
                padding: 5px;
                border-bottom: 1px solid #444;
            }
            
            .shop-item.selected {
                background: #335;
            }
            
            .item-symbol {
                margin-right: 10px;
            }
            
            .item-name {
                flex: 1;
            }
            
            .item-price {
                color: #ffd700;
                margin-left: 10px;
            }
            
            .shop-footer {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 5px;
                padding: 5px;
                background: #333;
                font-size: 0.8em;
            }
        `;
        document.head.appendChild(style);
    }
    
    open(shopkeeper, items) {
        log("ShopUI.open called with shopkeeper:", shopkeeper?.name);
        
        if (!gameState.player) {
            gameState.addMessage("Can't access shop.");
            gameState.gameMode = 'exploration';
            return;
        }
        
        this.shopkeeper = shopkeeper;
        
        // Reset all item lists - critical for preventing reused inventory
        this.items = null;
        
        // Hard force unique shop behavior - remove any existing inventory reference
        delete this._lastShopInventory;
        
        // Check if shopkeeper has inventory in their DialogueComponent
        const dialogue = shopkeeper.getComponent('DialogueComponent');
        
        // Debug deeply what's in the dialogue component
        log("ShopUI detailed debug for " + shopkeeper.name + ":");
        log("- Has DialogueComponent:", !!dialogue);
        if (dialogue) {
            log("- isShopkeeper:", dialogue.isShopkeeper);
            log("- Has inventory:", !!dialogue.inventory);
            log("- Shop token:", dialogue._shopkeeperToken || "none");
            if (dialogue.inventory) {
                log("- Inventory length:", dialogue.inventory.length);
                log("- First item:", dialogue.inventory[0]?.name);
                log("- All items:", dialogue.inventory.map(i => i.name).join(", "));
            }
        }
        
        // CREATE FRESH INVENTORY SPECIFIC TO THIS SHOPKEEPER
        // IMPORTANT FIX: Always use the DialogueComponent inventory for shopkeepers
        if (dialogue && dialogue.isShopkeeper && dialogue.inventory) {
            // Make a deep copy of the inventory to absolutely prevent shared reference issues
            const inventoryCopy = dialogue.inventory.map(item => ({...item}));
            log(`ShopUI: Using DialogueComponent inventory for ${shopkeeper.name} with token ${dialogue._shopkeeperToken}`);
            log(`Items: ${inventoryCopy.map(i => i.name).join(", ")}`);
            
            this.items = inventoryCopy;
            // Store NPC identity to prevent inventory mixing
            this._lastShopIdentity = shopkeeper.name + "-" + (dialogue._shopkeeperToken || Math.random().toString(36).substring(2, 15));
        }
        // Fallback to direct property (old method)
        else if (shopkeeper && shopkeeper.inventory) {
            log(`ShopUI: Using direct inventory property for ${shopkeeper.name}`);
            // Make a copy of the inventory to prevent shared reference issues
            this.items = shopkeeper.inventory.map(item => ({...item}));
        } 
        // Last resort - use default inventory
        else {
            log(`ShopUI: No inventory found for shopkeeper - using default`);
            // Fall back to provided items or default inventory
            this.items = items || this.getShopInventory();
        }
        
        // Always log final inventory to confirm
        log(`Final inventory for ${shopkeeper.name}:`, 
            this.items ? this.items.map(i => i.name).join(", ") : "none");
        
        // Reset selection
        this.selectedIndex = 0;
        this.mode = 'buy';
        
        // Update UI
        this.renderShopTitle();
        this.renderModeToggle();
        this.renderPlayerGold();
        this.render();
        
        // Show shop UI
        const shopUI = document.getElementById('shop-ui');
        if (shopUI) {
            shopUI.style.display = 'flex';
            log("ShopUI: Shop UI element is now visible");
        } else {
            log("ShopUI ERROR: Shop UI element not found!");
        }
        
        this.visible = true;
        
        // Set game mode to 'shop'
        gameState.gameMode = 'shop';
        
        // Re-add event listener when shop opens
        document.addEventListener('keydown', this.boundHandleKeyDown);
        log("ShopUI: Added keydown event listener");
        
        // Display shop welcome message
        gameState.addMessage(`${this.shopkeeper.name} says: "Welcome! Take a look at my wares."`, "speech");
    }
    
    close() {
        // Hide shop UI
        const shopUI = document.getElementById('shop-ui');
        if (shopUI) {
            shopUI.style.display = 'none';
        }
        
        this.visible = false;
        gameState.gameMode = 'exploration';
        
        // Remove event listener when shop closes
        document.removeEventListener('keydown', this.boundHandleKeyDown);
        
        // Display shop goodbye message
        if (this.shopkeeper) {
            gameState.addMessage(`${this.shopkeeper.name} says: "Come back anytime!"`, "speech");
        }
    }
    
    handleKeyDown(event) {
        // Only process key events when shop is visible
        if (!this.visible) {
            log("ShopUI: Ignoring key event - UI not visible");
            return;
        }
        
        // Prevent default browser behavior for these keys
        const key = event.key;
        log(`ShopUI.handleKeyDown: Key pressed: "${key}" in mode: ${this.mode}`);
        
        // Process the key press
        this.handleKeyPress(key);
        
        // Prevent event from affecting the game
        event.preventDefault();
        event.stopPropagation();
    }
    
    getShopInventory() {
        // Default items to sell in the shop
        return [
            {
                name: 'Health Potion',
                type: 'potion',
                effect: 'healing',
                power: 10, 
                price: 30,
                description: 'Restores 10 health points.'
            },
            {
                name: 'Iron Sword',
                type: 'weapon',
                damage: 5,
                price: 75,
                description: 'A basic sword with 5 damage.'
            },
            {
                name: 'Leather Armor',
                type: 'armor',
                defense: 3,
                price: 60,
                description: 'Basic armor with 3 defense.'
            },
            {
                name: 'Town Portal Scroll',
                type: 'scroll',
                effect: 'portal',
                price: 25,
                description: 'A scroll that teleports you back to town.'
            }
        ];
    }
    
    renderShopTitle() {
        const titleElement = document.getElementById('shop-title');
        if (titleElement && this.shopkeeper) {
            titleElement.textContent = `${this.shopkeeper.name}'s Shop`;
        }
    }
    
    renderModeToggle() {
        const buyButton = document.querySelector('.mode-buy');
        const sellButton = document.querySelector('.mode-sell');
        
        if (buyButton && sellButton) {
            if (this.mode === 'buy') {
                buyButton.classList.add('selected');
                sellButton.classList.remove('selected');
            } else {
                buyButton.classList.remove('selected');
                sellButton.classList.add('selected');
            }
        }
    }
    
    renderPlayerGold() {
        const goldElement = document.getElementById('player-gold');
        if (goldElement && gameState.player) {
            const gold = gameState.player.getComponent('GoldComponent')?.amount || 0;
            goldElement.textContent = `Gold: ${gold}`;
        }
    }
    
    render() {
        if (!this.shopElement) return;
        
        // Clear the element
        this.shopElement.innerHTML = '';
        
        // Render different content based on mode
        if (this.mode === 'buy') {
            this.renderBuyMode();
        } else {
            this.renderSellMode();
        }
    }
    
    renderBuyMode() {
        // Get shop items
        const items = this.items;
        
        if (items.length === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'shop-empty';
            emptyMessage.textContent = "No items available for purchase.";
            this.shopElement.appendChild(emptyMessage);
            return;
        }
        
        // Create an element for each item in the shop
        items.forEach((item, index) => {
            const itemElement = document.createElement('div');
            itemElement.className = 'shop-item';
            
            // Highlight selected item
            if (index === this.selectedIndex) {
                itemElement.classList.add('selected');
            }
            
            // Create the item symbol
            const symbol = document.createElement('span');
            symbol.className = 'item-symbol';
            symbol.textContent = this.getItemSymbol(item.type);
            symbol.style.color = this.getItemColor(item.type);
            
            // Create name with description
            const nameElement = document.createElement('span');
            nameElement.className = 'item-name';
            nameElement.textContent = `${item.name} (${item.description || ''})`;
            
            // Create price element
            const priceElement = document.createElement('span');
            priceElement.className = 'item-price';
            priceElement.textContent = `${item.price} gold`;
            
            // Assemble item row
            itemElement.appendChild(symbol);
            itemElement.appendChild(nameElement);
            itemElement.appendChild(priceElement);
            
            this.shopElement.appendChild(itemElement);
        });
    }
    
    renderSellMode() {
        // Get player's inventory
        const inventory = gameState.player.getComponent('InventoryComponent');
        if (!inventory || inventory.items.length === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'shop-empty';
            emptyMessage.textContent = "You have no items to sell.";
            this.shopElement.appendChild(emptyMessage);
            return;
        }
        
        // Create an element for each item in the inventory
        inventory.items.forEach((item, index) => {
            const itemElement = document.createElement('div');
            itemElement.className = 'shop-item';
            
            // Highlight selected item
            if (index === this.selectedIndex) {
                itemElement.classList.add('selected');
            }
            
            // Get item components
            const itemComp = item.getComponent('ItemComponent');
            const renderable = item.getComponent('RenderableComponent');
            
            // Skip if item can't be sold (no value)
            if (!itemComp || !itemComp.value) {
                return;
            }
            
            // Create the item symbol
            const symbol = document.createElement('span');
            symbol.className = 'item-symbol';
            symbol.textContent = renderable ? renderable.char : '?';
            symbol.style.color = renderable ? renderable.color : '#fff';
            
            // Create name element
            const nameElement = document.createElement('span');
            nameElement.className = 'item-name';
            nameElement.textContent = item.name;
            
            // Create price element (sell price is half of buy price)
            const priceElement = document.createElement('span');
            priceElement.className = 'item-price';
            priceElement.textContent = `${Math.floor(itemComp.value / 2)} gold`;
            
            // Assemble item row
            itemElement.appendChild(symbol);
            itemElement.appendChild(nameElement);
            itemElement.appendChild(priceElement);
            
            this.shopElement.appendChild(itemElement);
        });
    }
    
    getItemSymbol(type) {
        switch (type) {
            case 'weapon': return '/';
            case 'armor': return '[';
            case 'potion': return '!';
            case 'scroll': return '?';
            case 'spellbook': return '+';
            default: return '*';
        }
    }
    
    getItemColor(type) {
        switch (type) {
            case 'weapon': return '#aaa';
            case 'armor': return '#8b4513';
            case 'potion': return '#f00';
            case 'scroll': return '#ff0';
            case 'spellbook': return '#0ff';
            default: return '#fff';
        }
    }
    
    handleKeyPress(key) {
        log(`ShopUI.handleKeyPress: Processing key "${key}" in mode "${this.mode}"`);
        
        // Exit shop
        if (key === 'Escape') {
            log("ShopUI: Closing shop due to Escape key");
            this.close();
            return;
        }
        
        // Navigate through items
        if (key === 'ArrowUp' || key === 'w' || key === 'k') {
            const itemCount = this.mode === 'buy' ? this.items.length : gameState.player.getComponent('InventoryComponent')?.items.length || 0;
            if (itemCount > 0) {
                this.selectedIndex = (this.selectedIndex - 1 + itemCount) % itemCount;
                log(`ShopUI: Selected item ${this.selectedIndex + 1} of ${itemCount}`);
                this.render();
            }
        } else if (key === 'ArrowDown' || key === 'j') {
            const itemCount = this.mode === 'buy' ? this.items.length : gameState.player.getComponent('InventoryComponent')?.items.length || 0;
            if (itemCount > 0) {
                this.selectedIndex = (this.selectedIndex + 1) % itemCount;
                log(`ShopUI: Selected item ${this.selectedIndex + 1} of ${itemCount}`);
                this.render();
            }
        }
        // Toggle between buy and sell mode with B/S or left/right arrows
        else if (key === 'b' || key === 'B' || key === 'ArrowLeft') {
            log("ShopUI: Switching to BUY mode");
            this.mode = 'buy';
            this.selectedIndex = 0;
            this.renderModeToggle();
            this.render();
        } else if (key === 's' || key === 'S' || key === 'ArrowRight') {
            log("ShopUI: Switching to SELL mode");
            this.mode = 'sell';
            this.selectedIndex = 0;
            this.renderModeToggle();
            this.render();
        }
        // Buy or sell selected item with Enter or Space
        else if (key === 'Enter' || key === ' ') {
            if (this.mode === 'buy') {
                log("ShopUI: Attempting to buy selected item");
                this.buySelectedItem();
            } else {
                log("ShopUI: Attempting to sell selected item");
                this.sellSelectedItem();
            }
        } else {
            log(`ShopUI: Unrecognized key "${key}" - no action taken`);
        }
    }
    
    buySelectedItem() {
        if (this.selectedIndex >= this.items.length) {
            log("ShopUI.buySelectedItem: Invalid selected index");
            return;
        }
        
        const item = this.items[this.selectedIndex];
        log(`ShopUI.buySelectedItem: Attempting to buy ${item.name} for ${item.price} gold`);
        
        const playerGold = gameState.player.getComponent('GoldComponent');
        
        // Check if player has enough gold
        if (!playerGold || playerGold.amount < item.price) {
            log(`ShopUI: Not enough gold (have ${playerGold?.amount}, need ${item.price})`);
            gameState.addMessage("You don't have enough gold to buy that item.", "error");
            return;
        }
        
        // Check if inventory has space
        const inventory = gameState.player.getComponent('InventoryComponent');
        if (inventory.isFull) {
            log("ShopUI: Inventory is full");
            gameState.addMessage("Your inventory is full.", "error");
            return;
        }
        
        // Create the actual item to add to inventory
        log("ShopUI: Creating item from template");
        const newItem = this.createItemFromTemplate(item);
        if (!newItem) {
            log("ShopUI ERROR: Failed to create item from template");
            gameState.addMessage("There was a problem with that item.", "error");
            return;
        }
        
        // Add item to inventory
        log("ShopUI: Adding item to inventory");
        inventory.addItem(newItem);
        
        // Deduct gold
        playerGold.amount -= item.price;
        log(`ShopUI: Deducted ${item.price} gold, player now has ${playerGold.amount}`);
        
        // Play transaction sound
        // if (this.coinSound) this.coinSound.play();
        
        // Update UI
        this.renderPlayerGold();
        
        // Show message
        gameState.addMessage(`You bought a ${item.name} for ${item.price} gold.`);
        gameState.addMessage(`${this.shopkeeper.name} says: "A fine choice!"`, "speech");
    }
    
    sellSelectedItem() {
        const inventory = gameState.player.getComponent('InventoryComponent');
        if (!inventory || this.selectedIndex >= inventory.items.length) return;
        
        const item = inventory.items[this.selectedIndex];
        const itemComp = item.getComponent('ItemComponent');
        
        // Check if item can be sold
        if (!itemComp || !itemComp.value) {
            gameState.addMessage("This item cannot be sold.", "error");
            return;
        }
        
        // Calculate sell price (half of buy price)
        const sellPrice = Math.floor(itemComp.value / 2);
        
        // Add gold to player
        const playerGold = gameState.player.getComponent('GoldComponent');
        playerGold.amount += sellPrice;
        
        // Remove item from inventory
        inventory.removeItem(item);
        
        // Update UI
        this.selectedIndex = Math.min(this.selectedIndex, inventory.items.length - 1);
        this.renderPlayerGold();
        this.render();
        
        // Show message
        gameState.addMessage(`You sold ${item.name} for ${sellPrice} gold.`);
        gameState.addMessage(`${this.shopkeeper.name} says: "Thank you for your business!"`, "speech");
    }
    
    createItemFromTemplate(template) {
        // Create an appropriate Entity based on the item template provided by shop
        const item = new Entity(template.name);
        
        // Add basic components
        // Position is null in inventory
        item.addComponent(new PositionComponent(null, null));
        
        // Symbol is based on type
        const symbol = this.getItemSymbol(template.type);
        const color = this.getItemColor(template.type);
        item.addComponent(new RenderableComponent(symbol, color, null, 20));
        
        // Add ItemComponent with value equal to price
        item.addComponent(new ItemComponent(template.type, template.price));
        
        // Add specialized components based on item type
        if (template.type === 'weapon') {
            item.addComponent(new EquippableComponent('weapon', { damage: template.damage || 1 }));
        } else if (template.type === 'armor') {
            item.addComponent(new EquippableComponent('armor', { defense: template.defense || 1 }));
        } else if (template.type === 'potion') {
            item.addComponent(new UsableComponent(template.effect, template.power || 1));
        }
        
        // Add description if available
        if (template.description) {
            item.description = template.description;
        }
        
        return item;
    }
}

export default ShopUI;