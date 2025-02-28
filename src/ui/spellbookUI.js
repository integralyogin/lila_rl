import gameState from '../core/gameState.js';
import eventBus from '../core/eventEmitter.js';
import { PositionComponent } from '../entities/components.js';
import { targetingSystem } from '../systems/targetingSystem.js';

class SpellbookUI {
    constructor() {
        this.visible = false;
        this.selectedIndex = 0;
        this.spellbookElement = null;
        
        // Initialize the UI
        this.initialize();
        
        // Subscribe to events
        eventBus.on('spellbookOpened', () => this.open());
        eventBus.on('spellbookClosed', () => this.close());
        eventBus.on('spellbookKeyPressed', (key) => this.handleKeyPress(key));
    }
    
    initialize() {
        // Create spellbook UI container if it doesn't exist
        if (!document.getElementById('spellbook-ui')) {
            const spellbookUI = document.createElement('div');
            spellbookUI.id = 'spellbook-ui';
            spellbookUI.className = 'spellbook-ui';
            spellbookUI.style.display = 'none';
            spellbookUI.style.width = '350px'; // Increased width for better spell display
            
            // Create header
            const header = document.createElement('div');
            header.className = 'spellbook-header';
            header.textContent = 'Spellbook';
            
            // Create spell list container
            const spellList = document.createElement('div');
            spellList.className = 'spellbook-spells';
            spellList.id = 'spellbook-spells';
            
            // Create footer with instructions
            const footer = document.createElement('div');
            footer.className = 'spellbook-footer';
            footer.innerHTML = `
                <div><b>↑↓</b> Navigate spells</div>
                <div><b>PgUp/PgDn</b> Jump 5 spells</div>
                <div><b>Home/End</b> First/Last spell</div>
                <div><b>c</b> Cast selected spell</div>
                <div><b>ESC/s</b> Close spellbook</div>
            `;
            
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
    }
    
    close() {
        // Hide spellbook UI
        const spellbookUI = document.getElementById('spellbook-ui');
        if (spellbookUI) {
            spellbookUI.style.display = 'none';
        }
        
        this.visible = false;
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
        
        // Dynamically import spell logic to ensure it's loaded
        import('../spells/spell_logic.js').then(module => {
            const spellLogic = module.default;
            
            // Try to cast the spell
            if (spellLogic.hasSpell(id)) {
                console.log("Attempting to cast spell:", id, spell);
                
                // For location-targeted spells, we need the targeting system
                const implementation = spellLogic.getSpellImplementation(id);
                if (implementation && implementation.targetType === 'location') {
                    // Use the spell's targeting method instead of direct cast
                    if (implementation.target && typeof implementation.target === 'function') {
                        implementation.target(spell, (target) => {
                            if (target) {
                                const success = implementation.cast(spell, target);
                                if (success) {
                                    // Close spellbook and go back to exploration mode
                                    this.close();
                                    gameState.gameMode = 'exploration';
                                }
                            } else {
                                console.log("Spell targeting canceled");
                            }
                        });
                        this.close();
                        gameState.gameMode = 'targeting';
                        return;
                    }
                }
                
                // For non-targeted spells, cast directly
                const success = spellLogic.castSpell(id, spell);
                if (success) {
                    // Close spellbook and go back to exploration mode
                    this.close();
                    gameState.gameMode = 'exploration';
                }
            } else {
                gameState.addMessage(`You don't know how to cast ${spell.name} yet.`);
            }
        }).catch(error => {
            console.error("Error loading spell logic:", error);
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