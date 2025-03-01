import gameState from '../core/gameState.js';
import eventBus from '../core/eventEmitter.js';

/**
 * MouseHandler - enhances the game with mouse interactions for UI elements
 * Allows clicking on inventory items, spells, character screen elements, etc.
 */
class MouseHandler {
    constructor() {
        this.init();
    }
    
    init() {
        // Set up event listeners for each UI component
        this.setupInventoryMouseHandlers();
        this.setupSpellbookMouseHandlers();
        this.setupCharacterMouseHandlers();
    }
    
    /**
     * Setup inventory mouse interactions
     */
    setupInventoryMouseHandlers() {
        // Use event delegation for inventory items
        document.addEventListener('click', (event) => {
            // Only process when in inventory mode
            if (gameState.gameMode !== 'inventory') return;
            
            // Check if the click was on an inventory item
            const inventoryItem = event.target.closest('.inventory-item');
            if (inventoryItem) {
                // Find the item index
                const items = document.querySelectorAll('.inventory-item');
                const itemIndex = Array.from(items).indexOf(inventoryItem);
                
                // Emit an event to select this item
                eventBus.emit('inventoryKeyPressed', 'select-item');
                eventBus.emit('inventoryItemSelected', itemIndex);
            }
            
            // Check for action buttons
            if (event.target.matches('.inventory-action-use')) {
                eventBus.emit('inventoryKeyPressed', 'u');
            } else if (event.target.matches('.inventory-action-equip')) {
                eventBus.emit('inventoryKeyPressed', 'e');
            } else if (event.target.matches('.inventory-action-drop')) {
                eventBus.emit('inventoryKeyPressed', 'd');
            }
        });
    }
    
    /**
     * Setup spellbook mouse interactions
     */
    setupSpellbookMouseHandlers() {
        // Use event delegation for spellbook items
        document.addEventListener('click', (event) => {
            // Only process when in spellbook mode
            if (gameState.gameMode !== 'spellbook') return;
            
            // Check if the click was on a spell
            const spellItem = event.target.closest('.spellbook-spell');
            if (spellItem) {
                // Find the spell index
                const spells = document.querySelectorAll('.spellbook-spell');
                const spellIndex = Array.from(spells).indexOf(spellItem);
                
                // Emit an event to select this spell
                eventBus.emit('spellbookKeyPressed', 'select-spell');
                eventBus.emit('spellbookSpellSelected', spellIndex);
            }
            
            // Check for cast button
            if (event.target.matches('.spellbook-action-cast')) {
                eventBus.emit('spellbookKeyPressed', 'c');
            }
        });
    }
    
    /**
     * Setup character screen mouse interactions
     */
    setupCharacterMouseHandlers() {
        // Use event delegation for character UI
        document.addEventListener('click', (event) => {
            // Only process when in character mode
            if (gameState.gameMode !== 'character') return;
            
            // For now, just allow clicking outside to close
            if (!event.target.closest('.character-content') && 
                !event.target.closest('.character-header') &&
                !event.target.closest('.character-footer')) {
                eventBus.emit('characterKeyPressed', 'Escape');
            }
        });
    }
}

export default MouseHandler;