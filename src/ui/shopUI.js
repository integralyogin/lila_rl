import gameState from '../core/gameState.js';
import eventBus from '../core/eventEmitter.js';
import { PositionComponent, ItemComponent, RenderableComponent, EquippableComponent, UsableComponent } from '../entities/components.js';
import Entity from '../entities/entity.js';

class ShopUI {
    constructor() {
        this.visible = false;
        this.selectedIndex = 0;
        this.shopElement = null;
        this.shopkeeper = null;
        this.items = [];
        this.mode = 'buy'; // 'buy' or 'sell'
        this.entityFactory = null; // Will be set by game.js
        
        this.boundHandleKeyDown = this.handleKeyDown.bind(this);
        this.clickOutsideHandler = this.handleClickOutside.bind(this);
        
        this.initialize();
        
        eventBus.on('shopOpened', (shopkeeper, items) => this.open(shopkeeper, items));
        eventBus.on('shopClosed', () => this.close());
        eventBus.on('shopKeyPressed', (key) => this.handleKeyPress(key));
        eventBus.on('shopItemSelected', (index) => {
            if (index >= 0) {
                this.selectItem(index);
            }
        });
    }
    
    handleClickOutside(event) {
        const shopUI = document.getElementById('shop-ui');
        if (!shopUI) return;
        
        if (this.visible && !shopUI.contains(event.target)) {
            this.close();
            gameState.gameMode = 'exploration';
            eventBus.emit('shopClosed');
        }
    }
    
    selectItem(index) {
        if (index >= 0) {
            const oldIndex = this.selectedIndex;
            this.selectedIndex = index;
            
            const allItems = document.querySelectorAll('.shop-item');
            
            if (allItems.length > 0) {
                allItems.forEach((item, i) => {
                    if (i === index) {
                        item.classList.add('selected');
                        item.scrollIntoView({ block: 'nearest', behavior: 'auto' });
                    } else {
                        item.classList.remove('selected');
                    }
                });
                
                if (oldIndex !== index) {
                    const event = new CustomEvent('shopselectionchanged', { 
                        detail: { oldIndex, newIndex: index, mode: this.mode } 
                    });
                    document.dispatchEvent(event);
                }
            } else {
                if (this.mode === 'buy') {
                    this.renderBuyMode();
                } else {
                    this.renderSellMode();
                }
                
                setTimeout(() => {
                    const newItems = document.querySelectorAll('.shop-item');
                    if (newItems[index]) {
                        newItems[index].classList.add('selected');
                    }
                }, 10);
            }
        }
    }
    
    initialize() {
        if (!document.getElementById('shop-ui')) {
            const shopUI = document.createElement('div');
            shopUI.id = 'shop-ui';
            shopUI.className = 'shop-ui';
            shopUI.style.display = 'none';
            
            const header = document.createElement('div');
            header.className = 'shop-header';
            header.style.display = 'flex';
            header.style.justifyContent = 'space-between';
            header.style.alignItems = 'center';
            header.style.padding = '5px 10px';
            
            const titleGoldArea = document.createElement('div');
            titleGoldArea.style.display = 'flex';
            titleGoldArea.style.justifyContent = 'space-between';
            titleGoldArea.style.flex = '1';
            
            const title = document.createElement('div');
            title.id = 'shop-title';
            title.textContent = 'Shop';
            
            const goldDisplay = document.createElement('div');
            goldDisplay.id = 'player-gold';
            goldDisplay.textContent = 'Gold: 0';
            
            titleGoldArea.appendChild(title);
            titleGoldArea.appendChild(goldDisplay);
            
            const closeButton = document.createElement('button');
            closeButton.className = 'close-button';
            closeButton.innerHTML = '&times;';
            closeButton.style.background = 'none';
            closeButton.style.border = 'none';
            closeButton.style.color = '#fff';
            closeButton.style.fontSize = '20px';
            closeButton.style.cursor = 'pointer';
            closeButton.style.padding = '0 5px';
            closeButton.style.marginLeft = '10px';
            closeButton.title = 'Close shop';
            
            closeButton.addEventListener('mouseenter', () => {
                closeButton.style.color = '#ff9999';
            });
            closeButton.addEventListener('mouseleave', () => {
                closeButton.style.color = '#fff';
            });
            
            closeButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this.close();
                gameState.gameMode = 'exploration';
                eventBus.emit('shopClosed');
            });
            
            header.appendChild(titleGoldArea);
            header.appendChild(closeButton);
            
            const itemList = document.createElement('div');
            itemList.className = 'shop-items';
            itemList.id = 'shop-items';
            
            const modeToggle = document.createElement('div');
            modeToggle.className = 'shop-mode-toggle';
            modeToggle.id = 'shop-mode-toggle';
            
            const buyMode = document.createElement('div');
            buyMode.className = 'mode-option mode-buy selected';
            buyMode.textContent = 'Buy';
            buyMode.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.mode = 'buy';
                this.selectedIndex = 0;
                this.renderModeToggle();
                this.render();
            });
            
            const sellMode = document.createElement('div');
            sellMode.className = 'mode-option mode-sell';
            sellMode.textContent = 'Sell';
            sellMode.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.mode = 'sell';
                this.selectedIndex = 0;
                this.renderModeToggle();
                this.render();
            });
            
            modeToggle.appendChild(buyMode);
            modeToggle.appendChild(sellMode);
            
            const footer = document.createElement('div');
            footer.className = 'shop-footer';
            footer.innerHTML = `
                <div><b>↑↓</b> Navigate items</div>
                <div><b>B/S</b> or <b>←/→</b> Switch buy/sell mode</div>
                <div><b>Enter</b> or <b>Space</b> Buy/Sell selected item</div>
                <div><b>ESC</b> Close shop</div>
            `;
            
            shopUI.appendChild(header);
            shopUI.appendChild(modeToggle);
            shopUI.appendChild(itemList);
            shopUI.appendChild(footer);
            
            const gameContainer = document.getElementById('game-container') || document.body;
            gameContainer.appendChild(shopUI);
            
            this.shopElement = itemList;
            
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
                cursor: pointer;
                transition: background-color 0.2s;
            }
            
            .shop-item:hover {
                background: #444;
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
            
            .shop-action-button {
                background-color: #335;
                color: white;
                border: 1px solid #447;
                padding: 8px 16px;
                cursor: pointer;
                font-family: monospace;
                font-size: 16px;
                transition: background-color 0.2s, transform 0.1s;
                text-align: center;
                width: 100%;
                margin-top: 10px;
                border-radius: 4px;
            }
            
            .shop-action-button:hover {
                background-color: #447;
            }
            
            .shop-action-button:active {
                background-color: #558;
                transform: scale(0.98);
            }
        `;
        document.head.appendChild(style);
    }
    
    open(shopkeeper, items) {
        if (!gameState.player) {
            gameState.addMessage("Can't access shop.");
            gameState.gameMode = 'exploration';
            return;
        }
        
        this.shopkeeper = shopkeeper;
        this.items = null;
        delete this._lastShopInventory;
        
        const dialogue = shopkeeper.getComponent('DialogueComponent');
        
        if (dialogue && dialogue.isShopkeeper && dialogue.inventory) {
            const inventoryCopy = dialogue.inventory.map(item => ({...item}));
            this.items = inventoryCopy;
            this._lastShopIdentity = shopkeeper.name + "-" + (dialogue._shopkeeperToken || Math.random().toString(36).substring(2, 15));
        } else if (shopkeeper && shopkeeper.inventory) {
            this.items = shopkeeper.inventory.map(item => ({...item}));
        } else {
            this.items = items || this.getShopInventory();
        }
        
        this.selectedIndex = 0;
        this.mode = 'buy';
        
        this.renderShopTitle();
        this.renderModeToggle();
        this.renderPlayerGold();
        this.render();
        
        const shopUI = document.getElementById('shop-ui');
        if (shopUI) {
            shopUI.style.display = 'flex';
            gameState.gameMode = 'shop';
            
            shopUI.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        }
        
        this.visible = true;
        gameState.gameMode = 'shop';
        
        document.addEventListener('keydown', this.boundHandleKeyDown);
        
        setTimeout(() => {
            document.addEventListener('click', this.clickOutsideHandler);
        }, 100);
        
        gameState.addMessage(`${this.shopkeeper.name} says: "Welcome! Take a look at my wares."`, "speech");
        
        setTimeout(() => {
            const allItems = document.querySelectorAll('.shop-item');
            allItems.forEach((item, index) => {
                item.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.selectItem(index);
                };
            });
            
            const actionButton = document.querySelector('.shop-action-button');
            if (actionButton) {
                actionButton.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    actionButton.style.backgroundColor = '#558';
                    setTimeout(() => actionButton.style.backgroundColor = '', 200);
                    
                    gameState.gameMode = 'shop';
                    
                    if (this.mode === 'buy') {
                        this.buySelectedItem();
                    } else {
                        this.sellSelectedItem();
                    }
                };
            }
        }, 200);
    }
    
    close() {
        const shopUI = document.getElementById('shop-ui');
        if (shopUI) {
            shopUI.style.display = 'none';
        }
        
        this.visible = false;
        gameState.gameMode = 'exploration';
        
        document.removeEventListener('keydown', this.boundHandleKeyDown);
        document.removeEventListener('click', this.clickOutsideHandler);
        
        if (this.shopkeeper) {
            gameState.addMessage(`${this.shopkeeper.name} says: "Come back anytime!"`, "speech");
        }
    }
    
    handleKeyDown(event) {
        if (!this.visible) {
            return;
        }
        
        const key = event.key;
        this.handleKeyPress(key);
        
        event.preventDefault();
        event.stopPropagation();
    }
    
    getShopInventory() {
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
        
        const oldSelectedIndex = this.selectedIndex;
        this.shopElement.innerHTML = '';
        
        if (this.mode === 'buy') {
            this.renderBuyMode();
        } else {
            this.renderSellMode();
        }
        
        this.selectedIndex = oldSelectedIndex;
        
        const actionButton = document.createElement('button');
        actionButton.id = 'shop-action-button';
        actionButton.className = 'shop-action-button';
        actionButton.textContent = this.mode === 'buy' ? 'Buy Selected Item' : 'Sell Selected Item';
        
        actionButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            gameState.gameMode = 'shop';
            
            try {
                if (this.mode === 'buy') {
                    this.buySelectedItem();
                } else {
                    this.sellSelectedItem();
                }
            } catch (error) {
                console.error("Error executing action:", error);
            }
        });
        
        this.shopElement.appendChild(actionButton);
        
        setTimeout(() => {
            const selectedItem = document.querySelectorAll('.shop-item')[this.selectedIndex];
            if (selectedItem) {
                selectedItem.classList.add('selected');
                selectedItem.scrollIntoView({ block: 'nearest', behavior: 'auto' });
            }
        }, 10);
    }
    
    renderBuyMode() {
        const items = this.items;
        
        if (items.length === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'shop-empty';
            emptyMessage.textContent = "No items available for purchase.";
            this.shopElement.appendChild(emptyMessage);
            return;
        }
        
        items.forEach((item, index) => {
            const itemElement = document.createElement('div');
            itemElement.className = 'shop-item';
            
            if (index === this.selectedIndex) {
                itemElement.classList.add('selected');
            }
            
            const symbol = document.createElement('span');
            symbol.className = 'item-symbol';
            symbol.textContent = this.getItemSymbol(item.type);
            symbol.style.color = this.getItemColor(item.type);
            
            const nameElement = document.createElement('span');
            nameElement.className = 'item-name';
            nameElement.textContent = `${item.name} (${item.description || ''})`;
            
            const priceElement = document.createElement('span');
            priceElement.className = 'item-price';
            priceElement.textContent = `${item.price} gold`;
            
            itemElement.appendChild(symbol);
            itemElement.appendChild(nameElement);
            itemElement.appendChild(priceElement);
            
            itemElement.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                gameState.gameMode = 'shop';
                this.selectItem(index);
                eventBus.emit('shopItemSelected', index);
            });
            
            itemElement.addEventListener('dblclick', (e) => {
                e.preventDefault();
                e.stopPropagation();
                gameState.gameMode = 'shop';
                this.selectedIndex = index;
                this.render();
                setTimeout(() => this.buySelectedItem(), 50);
            });
            
            this.shopElement.appendChild(itemElement);
        });
    }
    
    renderSellMode() {
        const inventory = gameState.player.getComponent('InventoryComponent');
        if (!inventory || inventory.items.length === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'shop-empty';
            emptyMessage.textContent = "You have no items to sell.";
            this.shopElement.appendChild(emptyMessage);
            return;
        }
        
        inventory.items.forEach((item, index) => {
            const itemElement = document.createElement('div');
            itemElement.className = 'shop-item';
            
            if (index === this.selectedIndex) {
                itemElement.classList.add('selected');
            }
            
            const itemComp = item.getComponent('ItemComponent');
            const renderable = item.getComponent('RenderableComponent');
            
            if (!itemComp || !itemComp.value) {
                return;
            }
            
            const symbol = document.createElement('span');
            symbol.className = 'item-symbol';
            symbol.textContent = renderable ? renderable.char : '?';
            symbol.style.color = renderable ? renderable.color : '#fff';
            
            const nameElement = document.createElement('span');
            nameElement.className = 'item-name';
            nameElement.textContent = item.name;
            
            const priceElement = document.createElement('span');
            priceElement.className = 'item-price';
            priceElement.textContent = `${Math.floor(itemComp.value / 2)} gold`;
            
            itemElement.appendChild(symbol);
            itemElement.appendChild(nameElement);
            itemElement.appendChild(priceElement);
            
            itemElement.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                gameState.gameMode = 'shop';
                this.selectItem(index);
                eventBus.emit('shopItemSelected', index);
            });
            
            itemElement.addEventListener('dblclick', (e) => {
                e.preventDefault();
                e.stopPropagation();
                gameState.gameMode = 'shop';
                this.selectedIndex = index;
                this.render();
                setTimeout(() => this.sellSelectedItem(), 50);
            });
            
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
        if (key === 'Escape') {
            this.close();
            return;
        }
        
        if (key === 'ArrowUp' || key === 'w' || key === 'k') {
            const itemCount = this.mode === 'buy' ? this.items.length : gameState.player.getComponent('InventoryComponent')?.items.length || 0;
            if (itemCount > 0) {
                this.selectedIndex = (this.selectedIndex - 1 + itemCount) % itemCount;
                this.render();
            }
        } else if (key === 'ArrowDown' || key === 'j') {
            const itemCount = this.mode === 'buy' ? this.items.length : gameState.player.getComponent('InventoryComponent')?.items.length || 0;
            if (itemCount > 0) {
                this.selectedIndex = (this.selectedIndex + 1) % itemCount;
                this.render();
            }
        } else if (key === 'b' || key === 'B' || key === 'ArrowLeft') {
            this.mode = 'buy';
            this.selectedIndex = 0;
            this.renderModeToggle();
            this.render();
        } else if (key === 's' || key === 'S' || key === 'ArrowRight') {
            this.mode = 'sell';
            this.selectedIndex = 0;
            this.renderModeToggle();
            this.render();
        } else if (key === 'Enter' || key === ' ') {
            if (this.mode === 'buy') {
                this.buySelectedItem();
            } else {
                this.sellSelectedItem();
            }
        }
    }
    
    buySelectedItem() {
        if (this.selectedIndex >= this.items.length) {
            return;
        }
        
        const item = this.items[this.selectedIndex];
        const playerGold = gameState.player.getComponent('GoldComponent');
        
        if (!playerGold || playerGold.amount < item.price) {
            gameState.addMessage("You don't have enough gold to buy that item.", "error");
            return;
        }
        
        const inventory = gameState.player.getComponent('InventoryComponent');
        if (inventory.isFull) {
            gameState.addMessage("Your inventory is full.", "error");
            return;
        }
        
        const newItem = this.createItemFromTemplate(item);
        if (!newItem) {
            gameState.addMessage("There was a problem with that item.", "error");
            return;
        }
        
        inventory.addItem(newItem);
        playerGold.amount -= item.price;
        
        this.renderPlayerGold();
        
        gameState.addMessage(`You bought a ${item.name} for ${item.price} gold.`);
        gameState.addMessage(`${this.shopkeeper.name} says: "A fine choice!"`, "speech");
    }
    
    sellSelectedItem() {
        const inventory = gameState.player.getComponent('InventoryComponent');
        if (!inventory || this.selectedIndex >= inventory.items.length) return;
        
        const item = inventory.items[this.selectedIndex];
        const itemComp = item.getComponent('ItemComponent');
        
        if (!itemComp || !itemComp.value) {
            gameState.addMessage("This item cannot be sold.", "error");
            return;
        }
        
        const sellPrice = Math.floor(itemComp.value / 2);
        
        const playerGold = gameState.player.getComponent('GoldComponent');
        playerGold.amount += sellPrice;
        
        inventory.removeItem(item);
        
        this.selectedIndex = Math.min(this.selectedIndex, inventory.items.length - 1);
        this.renderPlayerGold();
        this.render();
        
        gameState.addMessage(`You sold ${item.name} for ${sellPrice} gold.`);
        gameState.addMessage(`${this.shopkeeper.name} says: "Thank you for your business!"`, "speech");
    }
    
    createItemFromTemplate(template) {
        const item = new Entity(template.name);
        
        item.addComponent(new PositionComponent(null, null));
        
        const symbol = this.getItemSymbol(template.type);
        const color = this.getItemColor(template.type);
        item.addComponent(new RenderableComponent(symbol, color, null, 20));
        
        item.addComponent(new ItemComponent(template.type, template.price));
        
        if (template.type === 'weapon') {
            item.addComponent(new EquippableComponent('weapon', { damage: template.damage || 1 }));
        } else if (template.type === 'armor') {
            item.addComponent(new EquippableComponent('armor', { defense: template.defense || 1 }));
        } else if (template.type === 'potion') {
            item.addComponent(new UsableComponent(template.effect, template.power || 1));
        }
        
        if (template.description) {
            item.description = template.description;
        }
        
        return item;
    }
}

export default ShopUI;