import gameState from '../core/gameState.js';
import eventBus from '../core/eventEmitter.js';
import { PositionComponent } from '../entities/components.js';
import { targetingSystem } from '../systems/targetingSystem.js';

class SpellbookUI {
    constructor() {
        this.visible = false;
        this.selectedIndex = 0;
        this.spellbookElement = null;
        this.clickOutsideHandler = this.handleClickOutside.bind(this);
        
        // Initialize the UI
        this.initialize();
        
        // Subscribe to events
        eventBus.on('spellbookOpened', () => this.open());
        eventBus.on('spellbookClosed', () => this.close());
        eventBus.on('spellbookKeyPressed', (key) => this.handleKeyPress(key));
        eventBus.on('spellbookSpellSelected', (index) => this.selectSpell(index));
    }
    
    /**
     * Handle clicks outside the spellbook panel
     * @param {MouseEvent} event - The click event
     */
    handleClickOutside(event) {
        const spellbookUI = document.getElementById('spellbook-ui');
        if (!spellbookUI) return;
        
        // Log the event for debugging
        console.log("SpellbookUI click outside handler triggered, target:", event.target);
        
        // Check if click was outside the spellbook UI
        if (this.visible && !spellbookUI.contains(event.target)) {
            console.log("Click detected outside spellbook UI, closing via handleClickOutside");
            this.close();
            gameState.gameMode = 'exploration';
            eventBus.emit('spellbookClosed');
        }
    }
    
    initialize() {
        // Create spellbook UI container if it doesn't exist
        if (!document.getElementById('spellbook-ui')) {
            const spellbookUI = document.createElement('div');
            spellbookUI.id = 'spellbook-ui';
            spellbookUI.className = 'spellbook-ui';
            spellbookUI.style.display = 'none';
            spellbookUI.style.width = '350px'; // Increased width for better spell display
            
            // Create header with close button
            const header = document.createElement('div');
            header.className = 'spellbook-header';
            
            // Create a flex container for the header content
            header.style.display = 'flex';
            header.style.justifyContent = 'space-between';
            header.style.alignItems = 'center';
            
            // Add the title
            const title = document.createElement('span');
            title.textContent = 'Spellbook';
            
            // Add close button
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
            closeButton.title = 'Close spellbook';
            
            // Add hover effect
            closeButton.addEventListener('mouseenter', () => {
                closeButton.style.color = '#ff9999';
            });
            closeButton.addEventListener('mouseleave', () => {
                closeButton.style.color = '#fff';
            });
            
            // Add click handler
            closeButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this.close();
                gameState.gameMode = 'exploration';
                eventBus.emit('spellbookClosed');
            });
            
            // Assemble header
            header.appendChild(title);
            header.appendChild(closeButton);
            
            // Create spell list container
            const spellList = document.createElement('div');
            spellList.className = 'spellbook-spells';
            spellList.id = 'spellbook-spells';
            
            // Create footer with instructions
            const footer = document.createElement('div');
            footer.className = 'spellbook-footer';
            footer.innerHTML = `
                <div class="spellbook-controls">
                    <div><b>↑↓</b> Navigate spells</div>
                    <div><b>PgUp/PgDn</b> Jump 5 spells</div>
                    <div><b>Home/End</b> First/Last spell</div>
                    <div><button id="cast-spell-button" class="spellbook-action-cast"><b>c</b> Cast spell</button></div>
                    <div><b>ESC/s</b> Close spellbook</div>
                </div>
            `;
            
            // Add click handler for the cast spell button after it's added to the DOM
            setTimeout(() => {
                const castButton = document.getElementById('cast-spell-button');
                if (castButton) {
                    castButton.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log("Cast spell button clicked directly");
                        this.castSelectedSpell();
                    });
                }
            }, 100);
            
            // Add some CSS to style the buttons
            const style = document.createElement('style');
            style.textContent = `
                .spellbook-controls button {
                    background: #333;
                    border: 1px solid #555;
                    color: white;
                    padding: 2px 5px;
                    margin: 2px 0;
                    cursor: pointer;
                    font-family: monospace;
                }
                .spellbook-controls button:hover {
                    background: #444;
                }
                .spellbook-spell {
                    cursor: pointer;
                }
                .spellbook-spell:hover:not(.disabled) {
                    background: #333;
                }
                .spellbook-spell.disabled {
                    cursor: not-allowed;
                }
            `;
            document.head.appendChild(style);
            
            // Assemble the UI
            spellbookUI.appendChild(header);
            spellbookUI.appendChild(spellList);
            spellbookUI.appendChild(footer);
            
            // Add to the game container
            const gameContainer = document.getElementById('game-container') || document.body;
            gameContainer.appendChild(spellbookUI);
            
            this.spellbookElement = spellList;
        } else {
            this.spellbookElement = document.getElementById('spellbook-spells');
        }
    }
    
    open() {
        if (!gameState.player || !gameState.player.hasComponent('SpellsComponent')) {
            gameState.addMessage("You don't know any spells.");
            gameState.gameMode = 'exploration';
            return;
        }
        
        const spells = gameState.player.getComponent('SpellsComponent');
        
        // Check if spellbook is empty
        if (spells.spellCount === 0) {
            gameState.addMessage("Your spellbook is empty. Find spellbooks to learn spells.");
            gameState.gameMode = 'exploration';
            return;
        }
        
        // Reset selection
        this.selectedIndex = 0;
        
        // Update UI
        this.render();
        
        // Show spellbook UI
        const spellbookUI = document.getElementById('spellbook-ui');
        if (spellbookUI) {
            spellbookUI.style.display = 'flex';
        }
        
        this.visible = true;
        
        // Add click outside listener
        // Wait a bit to add the event listener to prevent triggering on the same click that opened it
        setTimeout(() => {
            document.addEventListener('click', this.clickOutsideHandler);
        }, 100);
    }
    
    close() {
        // Hide spellbook UI
        const spellbookUI = document.getElementById('spellbook-ui');
        if (spellbookUI) {
            spellbookUI.style.display = 'none';
        }
        
        this.visible = false;
        
        // Remove click outside listener
        document.removeEventListener('click', this.clickOutsideHandler);
    }
    
    render() {
        if (!this.spellbookElement) return;
        
        // Clear the element
        this.spellbookElement.innerHTML = '';
        
        // Get player's spells
        const spells = gameState.player.getComponent('SpellsComponent');
        if (!spells || spells.spellCount === 0) return;
        
        // Get mana component
        const mana = gameState.player.getComponent('ManaComponent');
        
        // Create an array from the spell map
        const spellArray = Array.from(spells.knownSpells.entries());
        
        // Create a container for spell list
        const spellListContainer = document.createElement('div');
        spellListContainer.className = 'spellbook-list-container';
        
        // Create an element for each spell
        spellArray.forEach(([spellId, spell], index) => {
            const spellElement = document.createElement('div');
            spellElement.className = 'spellbook-spell';
            
            // Highlight selected spell
            if (index === this.selectedIndex) {
                spellElement.classList.add('selected');
            }
            
            // Check if player has enough mana
            const hasEnoughMana = mana && mana.mana >= spell.manaCost;
            if (!hasEnoughMana) {
                spellElement.classList.add('disabled');
            }
            
            // Create the spell name display with element icon
            const elementIcon = document.createElement('span');
            elementIcon.className = 'spell-element';
            
            // Choose icon based on element
            switch (spell.element) {
                case 'fire':
                    elementIcon.textContent = '🔥';
                    break;
                case 'ice':
                    elementIcon.textContent = '❄️';
                    break;
                case 'arcane':
                    elementIcon.textContent = '✨';
                    break;
                case 'life':
                    elementIcon.textContent = '🌱';
                    break;
                default:
                    elementIcon.textContent = '✧';
            }
            
            // Create name with info
            const nameElement = document.createElement('span');
            nameElement.className = 'spell-name';
            nameElement.textContent = spell.name;
            
            // Add selection indicator
            if (index === this.selectedIndex) {
                nameElement.style.fontWeight = 'bold';
            }
            
            // Add spell info (mana cost, damage, etc)
            const infoElement = document.createElement('span');
            infoElement.className = 'spell-info';
            
            let infoText = `${spell.manaCost} MP`;
            
            if (spell.baseDamage > 0) {
                infoText += ` | ${spell.baseDamage} dmg`;
            }
            
            if (spell.range > 0) {
                infoText += ` | ${spell.range} range`;
            }
            
            infoElement.textContent = infoText;
            
            // Assemble spell row
            spellElement.appendChild(elementIcon);
            spellElement.appendChild(nameElement);
            spellElement.appendChild(infoElement);
            
            // Add click handler to select this spell
            spellElement.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log(`Spell clicked directly: ${index} (${spell.name})`);
                this.selectedIndex = index;
                this.render();
            });
            
            // Add double click handler to immediately cast the spell
            spellElement.addEventListener('dblclick', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log(`Spell double-clicked: ${index} (${spell.name})`);
                this.selectedIndex = index;
                this.render();
                // Execute the cast action
                setTimeout(() => this.castSelectedSpell(), 50);
            });
            
            spellListContainer.appendChild(spellElement);
        });
        
        // Add the spell list container to the main element
        this.spellbookElement.appendChild(spellListContainer);
        
        // Add spell description for selected spell
        if (spellArray.length > 0) {
            const [spellId, selectedSpell] = spellArray[this.selectedIndex];
            
            const descriptionElement = document.createElement('div');
            descriptionElement.className = 'spell-description';
            descriptionElement.textContent = selectedSpell.description;
            
            this.spellbookElement.appendChild(descriptionElement);
        }
        
        // Ensure the selected spell is visible by scrolling to it
        const selectedElement = spellListContainer.children[this.selectedIndex];
        if (selectedElement) {
            selectedElement.scrollIntoView({ block: 'center', behavior: 'auto' });
        }
    }
    
    handleKeyPress(key) {
        const spells = gameState.player.getComponent('SpellsComponent');
        if (!spells || spells.spellCount === 0) return;
        
        // Get the spell array
        const spellArray = Array.from(spells.knownSpells.entries());
        
        // Handle special mouse-triggered event
        if (key === 'select-spell') {
            // This is handled by selectSpell method
            return;
        }
        
        // Navigate through spells
        if (key === 'ArrowUp' || key === 'w' || key === 'k') {
            this.selectedIndex = (this.selectedIndex - 1 + spellArray.length) % spellArray.length;
            this.render(); // This will now scroll to the selected item
        } else if (key === 'ArrowDown' || key === 's' || key === 'j') {
            this.selectedIndex = (this.selectedIndex + 1) % spellArray.length;
            this.render(); // This will now scroll to the selected item
        }
        // Page up - move 5 spells up
        else if (key === 'PageUp') {
            this.selectedIndex = Math.max(0, this.selectedIndex - 5);
            this.render();
        }
        // Page down - move 5 spells down
        else if (key === 'PageDown') {
            this.selectedIndex = Math.min(spellArray.length - 1, this.selectedIndex + 5);
            this.render();
        }
        // Home - go to the first spell
        else if (key === 'Home') {
            this.selectedIndex = 0;
            this.render();
        }
        // End - go to the last spell
        else if (key === 'End') {
            this.selectedIndex = spellArray.length - 1;
            this.render();
        }
        // Cast spell
        else if (key === 'c') {
            this.castSelectedSpell();
        }
    }
    
    // Method to directly select a spell by index (for mouse clicks)
    selectSpell(index) {
        const spells = gameState.player.getComponent('SpellsComponent');
        if (!spells || spells.spellCount === 0) return;
        
        const spellArray = Array.from(spells.knownSpells.entries());
        
        // Validate the index
        if (index >= 0 && index < spellArray.length) {
            this.selectedIndex = index;
            this.render();
        }
    }
    
    getSelectedSpell() {
        const spells = gameState.player.getComponent('SpellsComponent');
        if (!spells || spells.spellCount === 0) {
            return null;
        }
        
        const spellArray = Array.from(spells.knownSpells.entries());
        if (this.selectedIndex >= spellArray.length) {
            return null;
        }
        
        return {
            id: spellArray[this.selectedIndex][0],
            spell: spellArray[this.selectedIndex][1]
        };
    }
    
    castSelectedSpell() {
        const selectedSpell = this.getSelectedSpell();
        if (!selectedSpell) return;
        
        const { id, spell } = selectedSpell;
        
        // Check if player has enough mana
        const mana = gameState.player.getComponent('ManaComponent');
        if (!mana || mana.mana < spell.manaCost) {
            gameState.addMessage("You don't have enough mana to cast this spell.");
            return;
        }
        
        // Use ES modules dynamic import
        console.log("Attempting to cast spell:", id, spell);
        
        import('../spells/spell_logic.js').then(module => {
            const spellLogic = module.default;
            console.log("Got spellLogic module:", spellLogic ? "yes" : "no");
                
            // Make sure it's valid
            if (!spellLogic) {
                console.error("SpellLogic module not found");
                gameState.addMessage("The magical energy fizzles.");
                return;
            }
            
            // Log the known spells
            console.log("Known spell effects:", Array.from(spellLogic.spellEffects.keys()));
            
            // Check if this spell is implemented
            if (spellLogic.hasSpell(id)) {
                console.log("Found spell implementation for:", id);
                
                // Get the implementation
                const implementation = spellLogic.getSpellImplementation(id);
                
                // Handle targeting spells
                if (implementation && (implementation.targetType === 'location' || implementation.targetType === 'entity')) {
                    if (implementation.target && typeof implementation.target === 'function') {
                        // Use the spell's targeting method
                        implementation.target(spell, (target) => {
                            if (target) {
                                // Cast the spell with the target
                                const success = implementation.cast(spell, target);
                                if (success) {
                                    // Close spellbook and return to exploration
                                    this.close();
                                    gameState.gameMode = 'exploration';
                                }
                            } else {
                                console.log("Spell targeting canceled");
                            }
                        });
                        
                        // Close the spellbook and enter targeting mode
                        this.close();
                        gameState.gameMode = 'targeting';
                        return;
                    }
                }
                
                // For non-targeted spells, cast directly
                const success = spellLogic.castSpell(id, spell);
                if (success) {
                    // Close spellbook and return to exploration
                    this.close();
                    gameState.gameMode = 'exploration';
                }
            } else {
                console.error(`Spell implementation not found for: ${id}`);
                gameState.addMessage(`You don't know how to cast ${spell.name} yet.`);
            }
        }).catch(error => {
            console.error("Error importing spell_logic.js:", error);
            gameState.addMessage("Something went wrong with your spell. The magical energy dissipates.");
        });
    }
    
    // The individual spell casting methods are now moved to the spell_logic.js file
    // and are handled by the modular spell system.
    // The methods below are kept as legacy references and can be removed
    // once the new system is fully tested and verified.
    
    /*
    // Legacy methods - these have been moved to spell_logic.js
    castFirebolt(spell) { ... }
    castIceSpear(spell) { ... }
    castHealing(spell) { ... }
    castTownPortal(spell) { ... }
    */
}

export default SpellbookUI;