// ui/creatorUI.js
import gameState from '../core/gameState.js';
import eventBus from '../core/eventEmitter.js';
import ItemCreator from './creators/itemCreator.js';
import SpellCreator from './creators/spellCreator.js';
import MonsterCreator from './creators/monsterCreator.js';
import TileCreator from './creators/tileCreator.js';
import MapCreator from './creators/mapCreator.js';

class CreatorUI {
    constructor() {
        this.uiElement = null;
        this.visible = false;
        this.entityFactory = null; // Will be assigned later
        this.previousGameMode = 'exploration'; // Default fallback
        
        // Bind methods
        this.show = this.show.bind(this);
        this.hide = this.hide.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        
        // Create UI
        this.createUI();
        
        // Register events
        eventBus.on('showCreator', this.show);
        eventBus.on('hideCreator', this.hide);
        eventBus.on('creatorClosed', () => {
            this.visible = false;
            gameState.gameMode = 'exploration';
            console.log('Creator mode force reset to exploration');
        });
    }
    
    createUI() {
        if (this.uiElement) return;
        
        this.uiElement = document.createElement('div');
        this.uiElement.id = 'creator-ui';
        this.uiElement.className = 'creator-ui';
        this.uiElement.style.position = 'fixed';
        this.uiElement.style.top = '50%';
        this.uiElement.style.left = '50%';
        this.uiElement.style.transform = 'translate(-50%, -50%)';
        this.uiElement.style.width = '700px';
        this.uiElement.style.maxHeight = '80vh';
        this.uiElement.style.backgroundColor = 'rgba(20, 20, 30, 0.95)';
        this.uiElement.style.border = '2px solid #666';
        this.uiElement.style.borderRadius = '5px';
        this.uiElement.style.padding = '10px';
        this.uiElement.style.zIndex = '1002'; // Higher than dataViewer
        this.uiElement.style.display = 'none';
        this.uiElement.style.color = '#ddd';
        this.uiElement.style.fontFamily = 'monospace';
        this.uiElement.style.overflow = 'auto';
        this.uiElement.style.boxShadow = '0 0 20px rgba(0, 0, 0, 0.5)';
        
        document.body.appendChild(this.uiElement);
    }
    
    show() {
        // Save previous game mode and set to creator mode
        this.previousGameMode = gameState.gameMode;
        gameState.gameMode = 'creator';
        gameState.creatorMode = true;
        
        // Add keyboard event listener
        document.addEventListener('keydown', this.handleKeyDown);
        
        // Set editing flag for input fields
        window.isEditingEntityData = true;
        
        // Populate UI
        this.populateUI();
        
        // Show the UI
        this.uiElement.style.display = 'block';
        this.visible = true;
        
        console.log('Creator UI opened, game mode set to:', gameState.gameMode);
    }
    
    hide() {
        if (this.uiElement) {
            this.uiElement.style.display = 'none';
        }
        
        console.log('Previous game mode before reset:', this.previousGameMode);
        
        // Make sure we're going back to exploration mode
        this.previousGameMode = this.previousGameMode || 'exploration';
        
        // Force game mode back to exploration
        gameState.gameMode = 'exploration';
        gameState.creatorMode = false;
        
        // Remove keyboard event listener
        document.removeEventListener('keydown', this.handleKeyDown);
        
        // Reset editing flag
        window.isEditingEntityData = false;
        
        this.visible = false;
        
        // Force focus back to game container
        const gameContainer = document.getElementById('game-container');
        if (gameContainer) {
            gameContainer.focus();
        }
        
        // Timeout to ensure game state is reset after other operations complete
        setTimeout(() => {
            if (gameState.gameMode !== 'exploration') {
                console.log('Forcing game mode reset to exploration');
                gameState.gameMode = 'exploration';
                eventBus.emit('fovUpdated'); // Trigger a render update
            }
        }, 50);
        
        // Emit event to make sure game state is properly reset
        eventBus.emit('creatorClosed');
        
        console.log('Creator UI closed, game mode set to:', gameState.gameMode);
    }
    
    handleKeyDown(event) {
        if (event.key === 'Escape') {
            this.hide();
        }
    }
    
    populateUI() {
        // Clear previous content
        this.uiElement.innerHTML = '';
        
        // Create header
        const header = document.createElement('div');
        header.className = 'creator-header';
        header.style.borderBottom = '1px solid #666';
        header.style.marginBottom = '10px';
        header.style.paddingBottom = '10px';
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';
        
        const title = document.createElement('h2');
        title.textContent = 'Creator Mode';
        title.style.margin = '0';
        title.style.color = '#fff';
        
        const closeButton = document.createElement('button');
        closeButton.textContent = '×';
        closeButton.style.background = 'none';
        closeButton.style.border = 'none';
        closeButton.style.color = '#fff';
        closeButton.style.fontSize = '24px';
        closeButton.style.cursor = 'pointer';
        closeButton.style.padding = '0 5px';
        closeButton.addEventListener('click', this.hide);
        
        header.appendChild(title);
        header.appendChild(closeButton);
        this.uiElement.appendChild(header);
        
        // Create tab buttons
        const tabs = document.createElement('div');
        tabs.className = 'creator-tabs';
        tabs.style.display = 'flex';
        tabs.style.marginBottom = '15px';
        tabs.style.borderBottom = '1px solid #444';
        
        // Define tabs
        const tabItems = [
            { id: 'items', label: 'Create Item' },
            { id: 'spells', label: 'Create Spell' },
            { id: 'monsters', label: 'Create Monster' },
            { id: 'tiles', label: 'Edit Tile' },
	    { id: 'maps', label: 'Edit Map' }  // Add this line
        ];
        
        // Create tab buttons
        tabItems.forEach(tab => {
            const tabButton = document.createElement('button');
            tabButton.className = 'creator-tab';
            tabButton.textContent = tab.label;
            tabButton.style.padding = '8px 16px';
            tabButton.style.margin = '0 5px';
            tabButton.style.backgroundColor = 'rgba(40, 40, 50, 0.7)';
            tabButton.style.border = 'none';
            tabButton.style.borderBottom = '2px solid transparent';
            tabButton.style.color = '#ccc';
            tabButton.style.cursor = 'pointer';
            
            tabButton.addEventListener('click', () => {
                // Remove active class from all tabs
                tabs.querySelectorAll('.creator-tab').forEach(btn => {
                    btn.style.backgroundColor = 'rgba(40, 40, 50, 0.7)';
                    btn.style.borderBottom = '2px solid transparent';
                    btn.style.color = '#ccc';
                });
                
                // Set this tab as active
                tabButton.style.backgroundColor = 'rgba(60, 60, 80, 0.7)';
                tabButton.style.borderBottom = '2px solid #77aaff';
                tabButton.style.color = '#fff';
                
                // Show appropriate content
                this.showTabContent(tab.id);
            });
            
            tabs.appendChild(tabButton);
        });
        
        this.uiElement.appendChild(tabs);
        
        // Create content container
        const contentContainer = document.createElement('div');
        contentContainer.id = 'creator-content';
        contentContainer.style.padding = '10px';
        this.uiElement.appendChild(contentContainer);
        
        // Default to items tab
        tabs.querySelector('.creator-tab').click();
    }
    
     

// Finally, update the showTabContent method:
showTabContent(tabId) {
    const contentContainer = document.getElementById('creator-content');
    contentContainer.innerHTML = '';
    
    switch(tabId) {
        case 'items':
            ItemCreator.show(contentContainer, this.entityFactory);
            break;
        case 'spells':
            SpellCreator.show(contentContainer, this.entityFactory);
            break;
        case 'monsters':
            MonsterCreator.show(contentContainer, this.entityFactory);
            break;
        case 'tiles':
            TileCreator.show(contentContainer);
            break;
        case 'maps':
            MapCreator.show(contentContainer);  // Add this case
            break;
    }
}


    showPlaceholder(container, message) {
        const placeholder = document.createElement('p');
        placeholder.textContent = message;
        placeholder.style.textAlign = 'center';
        placeholder.style.padding = '20px';
        placeholder.style.color = '#aaa';
        container.appendChild(placeholder);
    }
    
    // Method to set the entity factory reference
    setEntityFactory(factory) {
        this.entityFactory = factory;
        // Pass the factory to all creators
        ItemCreator.setEntityFactory(factory);
        SpellCreator.setEntityFactory(factory);
        MonsterCreator.setEntityFactory(factory);
    }
}

// Export singleton instance
export default new CreatorUI();
