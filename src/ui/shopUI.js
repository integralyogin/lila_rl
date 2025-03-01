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
        this.mode = 'buy';
        this.entityFactory = null;
        
        this.boundHandleKeyDown = this.handleKeyDown.bind(this);
        this.clickOutsideHandler = this.handleClickOutside.bind(this);
        
        this.initialize();
        
        eventBus.on('shopOpened', (shopkeeper, items) => this.open(shopkeeper, items));
        eventBus.on('shopClosed', () => this.close());
        eventBus.on('shopKeyPressed', (key) => this.handleKeyPress(key));
        eventBus.on('shopItemSelected', (index) => {
            if (index >= 0) this.selectItem(index);
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
        if (index < 0) return;
        
        const oldIndex = this.selectedIndex;
        this.selectedIndex = index;
        
        const allItems = document.querySelectorAll('.shop-item');
        
        if (allItems.length > 0) {
            allItems.forEach((item, i) => {
                item.classList.toggle('selected', i === index);
            });
            
            if (allItems[index]) {
                allItems[index].scrollIntoView({ block: 'nearest', behavior: 'auto' });
            }
            
            if (oldIndex !== index) {
                document.dispatchEvent(new CustomEvent('shopselectionchanged', { 
                    detail: { oldIndex, newIndex: index, mode: this.mode } 
                }));
            }
        } else {
            this.render();
            
            setTimeout(() => {
                const newItems = document.querySelectorAll('.shop-item');
                if (newItems[index]) newItems[index].classList.add('selected');
            }, 10);
        }
    }
    
    initialize() {
        if (document.getElementById('shop-ui')) {
            this.shopElement = document.getElementById('shop-items');
            return;
        }
        
        const shopUI = document.createElement('div');
        shopUI.id = 'shop-ui';
        shopUI.className = 'shop-ui';
        shopUI.style.display = 'none';
        
        const header = this.createHeader();
        const itemList = document.createElement('div');
        itemList.className = 'shop-items';
        itemList.id = 'shop-items';
        const modeToggle = this.createModeToggle();
        
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
    }
    
    createHeader() {
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
        
        closeButton.addEventListener('mouseenter', () => closeButton.style.color = '#ff9999');
        closeButton.addEventListener('mouseleave', () => closeButton.style.color = '#fff');
        
        closeButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.close();
            gameState.gameMode = 'exploration';
            eventBus.emit('shopClosed');
        });
        
        header.appendChild(titleGoldArea);
        header.appendChild(closeButton);
        
        return header;
    }
    
    createModeToggle() {
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
        
        return modeToggle;
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
        
        const dialogue = shopkeeper.getComponent('DialogueComponent');
        if (dialogue && dialogue.isShopkeeper && dialogue.inventory) {
            this.items = dialogue.inventory.map(item => ({...item}));
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
            shopUI.addEventListener('click', e => {
                e.preventDefault();
                e.stopPropagation();
            });
        }
        
        this.visible = true;
        gameState.gameMode = 'shop';
        
        document.addEventListener('keydown', this.boundHandleKeyDown);
        
        setTimeout(() => {
            document.addEventListener('click', this.clickOutsideHandler);
            this.setupItemClickHandlers();
        }, 100);
        
        gameState.addMessage(`${this.shopkeeper.name} says: "Welcome! Take a look at my wares."`, "speech");
    }
    
    setupItemClickHandlers() {
        const allItems = document.querySelectorAll('.shop-item');
        allItems.forEach((item, index) => {
            item.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.selectItem(index);
            };
            
            item.ondblclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.selectedIndex = index;
                this.render();
                setTimeout(() => {
                    if (this.mode === 'buy') this.buySelectedItem();
                    else this.sellSelectedItem();
                }, 50);
            };
        });
        
        const actionButton = document.querySelector('.shop-action-button');
        if (actionButton) {
            actionButton.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                actionButton.style.backgroundColor = '#558';
                setTimeout(() => actionButton.style.backgroundColor = '', 200);
                
                if (this.mode === 'buy') this.buySelectedItem();
                else this.sellSelectedItem();
            };
        }
    }
    
    close() {
        const shopUI = document.getElementById('shop-ui');
        if (shopUI) shopUI.style.display = 'none';
        
        this.visible = false;
        gameState.gameMode = 'exploration';
        
        document.removeEventListener('keydown', this.boundHandleKeyDown);
        document.removeEventListener('click', this.clickOutsideHandler);
        
        if (this.shopkeeper) {
            gameState.addMessage(`${this.shopkeeper.name} says: "Come back anytime!"`, "speech");
        }
    }
    
    handleKeyDown(event) {
        if (!this.visible) return;
        
        this.handleKeyPress(event.key);
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
            buyButton.classList.toggle('selected', this.mode === 'buy');
            sellButton.classList.toggle('selected', this.mode === 'sell');
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
        
        if (this.mode === 'buy') this.renderBuyMode();
        else this.renderSellMode();
        
        const actionButton = document.createElement('button');
        actionButton.id = 'shop-action-button';
        actionButton.className = 'shop-action-button';
        actionButton.textContent = this.mode === 'buy' ? 'Buy Selected Item' : 'Sell Selected Item';
        this.shopElement.appendChild(actionButton);
        
        this.selectedIndex = oldSelectedIndex;
        setTimeout(() => {
            const selectedItem = document.querySelectorAll('.shop-item')[this.selectedIndex];
            if (selectedItem) {
                selectedItem.classList.add('selected');
                selectedItem.scrollIntoView({ block: 'nearest', behavior: 'auto' });
            }
            this.setupItemClickHandlers();
        }, 10);
    }
    
    renderBuyMode() {
        if (this.items.length === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'shop-empty';
            emptyMessage.textContent = "No items available for purchase.";
            this.shopElement.appendChild(emptyMessage);
            return;
        }
        
        this.items.forEach((item, index) => {
            const itemElement = this.createItemElement(
                item.name,
                item.description || '',
                item.price,
                this.getItemSymbol(item.type),
                this.getItemColor(item.type),
                index
            );
            
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
            const itemComp = item.getComponent('ItemComponent');
            const renderable = item.getComponent('RenderableComponent');
            
            if (!itemComp || !itemComp.value) return;
            
            const itemElement = this.createItemElement(
                item.name,
                item.description || '',
                Math.floor(itemComp.value / 2),
                renderable ? renderable.char : '?',
                renderable ? renderable.color : '#fff',
                index
            );
            
            this.shopElement.appendChild(itemElement);
        });
    }
    
    createItemElement(name, description, price, symbol, color, index) {
        const itemElement = document.createElement('div');
        itemElement.className = 'shop-item';
        
        if (index === this.selectedIndex) {
            itemElement.classList.add('selected');
        }
        
        const symbolEl = document.createElement('span');
        symbolEl.className = 'item-symbol';
        symbolEl.textContent = symbol;
        symbolEl.style.color = color;
        
        const nameElement = document.createElement('span');
        nameElement.className = 'item-name';
        nameElement.textContent = description ? `${name} (${description})` : name;
        
        const priceElement = document.createElement('span');
        priceElement.className = 'item-price';
        priceElement.textContent = `${price} gold`;
        
        itemElement.appendChild(symbolEl);
        itemElement.appendChild(nameElement);
        itemElement.appendChild(priceElement);
        
        return itemElement;
    }
    
    getItemSymbol(type) {
        const symbols = {
            'weapon': '/',
            'armor': '[',
            'potion': '!',
            'scroll': '?',
            'spellbook': '+'
        };
        
        return symbols[type] || '*';
    }
    
    getItemColor(type) {
        const colors = {
            'weapon': '#aaa',
            'armor': '#8b4513',
            'potion': '#f00',
            'scroll': '#ff0',
            'spellbook': '#0ff'
        };
        
        return colors[type] || '#fff';
    }
    
    handleKeyPress(key) {
        if (key === 'Escape') {
            this.close();
            return;
        }
        
        const isUp = key === 'ArrowUp' || key === 'w' || key === 'k';
        const isDown = key === 'ArrowDown' || key === 'j';
        const isBuy = key === 'b' || key === 'B' || key === 'ArrowLeft';
        const isSell = key === 's' || key === 'S' || key === 'ArrowRight';
        const isExecute = key === 'Enter' || key === ' ';
        
        if (isUp || isDown) {
            const itemCount = this.mode === 'buy' 
                ? this.items.length 
                : gameState.player.getComponent('InventoryComponent')?.items.length || 0;
                
            if (itemCount > 0) {
                this.selectedIndex = (this.selectedIndex + (isUp ? -1 : 1) + itemCount) % itemCount;
                this.render();
            }
        } else if (isBuy) {
            this.mode = 'buy';
            this.selectedIndex = 0;
            this.renderModeToggle();
            this.render();
        } else if (isSell) {
            this.mode = 'sell';
            this.selectedIndex = 0;
            this.renderModeToggle();
            this.render();
        } else if (isExecute) {
            if (this.mode === 'buy') this.buySelectedItem();
            else this.sellSelectedItem();
        }
    }
    
    buySelectedItem() {
        if (this.selectedIndex >= this.items.length) return;
        
        const item = this.items[this.selectedIndex];
        const playerGold = gameState.player.getComponent('GoldComponent');
        const inventory = gameState.player.getComponent('InventoryComponent');
        
        if (!playerGold || playerGold.amount < item.price) {
            gameState.addMessage("You don't have enough gold to buy that item.", "error");
            return;
        }
        
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
