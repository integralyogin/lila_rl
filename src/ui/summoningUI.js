import gameState from '../core/gameState.js';
import eventBus from '../core/eventEmitter.js';
import EntityFactory from '../entities/entityFactory.js';

/**
 * SummoningUI - Handles the UI for summoning creature selection
 */
class SummoningUI {
    constructor() {
        this.visible = false;
        this.selectedMonster = null;
        this.entityFactory = null;
        this.targetPosition = null;
        this.spellData = null;
        
        // We can only initialize the UI after the DOM is loaded
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.initUI();
                this.setupEventListeners();
            });
        } else {
            this.initUI();
            this.setupEventListeners();
        }
    }
    
    /**
     * Initialize the UI components
     */
    initUI() {
        // Create container
        this.container = document.createElement('div');
        this.container.className = 'summoning-ui hidden';
        this.container.style.display = 'none';
        document.getElementById('game-container').appendChild(this.container);
        
        // Create header
        this.header = document.createElement('div');
        this.header.className = 'summoning-header';
        this.header.textContent = 'Summon a Creature';
        this.container.appendChild(this.header);
        
        // Create close button
        const closeButton = document.createElement('button');
        closeButton.className = 'close-button';
        closeButton.innerHTML = '&times;';
        closeButton.addEventListener('click', () => this.hideSummoningUI());
        this.header.appendChild(closeButton);
        
        // Create monster selection area
        this.monsterSelectArea = document.createElement('div');
        this.monsterSelectArea.className = 'summoning-monster-select';
        this.container.appendChild(this.monsterSelectArea);
        
        // Create selected monster area
        this.selectedMonsterArea = document.createElement('div');
        this.selectedMonsterArea.className = 'summoning-selected-monster';
        this.container.appendChild(this.selectedMonsterArea);
        
        // Create buttons container
        this.buttonsContainer = document.createElement('div');
        this.buttonsContainer.className = 'summoning-buttons';
        this.container.appendChild(this.buttonsContainer);
        
        // Create summon button
        this.summonButton = document.createElement('button');
        this.summonButton.textContent = 'Summon';
        this.summonButton.disabled = true;
        this.summonButton.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.summonCreature();
        });
        this.buttonsContainer.appendChild(this.summonButton);
        
        // Create cancel button
        this.cancelButton = document.createElement('button');
        this.cancelButton.textContent = 'Cancel';
        this.cancelButton.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.hideSummoningUI();
        });
        this.buttonsContainer.appendChild(this.cancelButton);
    }
    
    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Listen for open summon UI event
        eventBus.on('openSummoningUI', (data) => {
            this.showSummoningUI(data.spell, data.targetPosition, data.callback);
        });
        
        // Listen for close event
        eventBus.on('summoningClose', () => {
            this.hideSummoningUI();
        });
        
        // Custom click handler to block clicks during selection
        document.addEventListener('click', (event) => {
            if (gameState.gameMode === 'summoning_selection') {
                // If we're in summoning selection mode, block all clicks not on summoning UI
                const summoningUI = document.querySelector('.summoning-ui');
                
                // If the click is not inside the summoning UI, prevent it
                if (!summoningUI || !summoningUI.contains(event.target)) {
                    console.log("Blocking click outside summoning UI during selection");
                    event.stopPropagation();
                    event.preventDefault();
                } else {
                    console.log("Click inside summoning UI allowed");
                }
            }
        }, true); // Use capture phase to get clicks before other handlers
    }
    
    /**
     * Show the summoning UI
     * @param {Object} spell - The summoning spell data
     * @param {Object} targetPosition - The target position for summoning
     * @param {Function} callback - Callback function when selection is complete
     */
    showSummoningUI(spell, targetPosition, callback) {
        console.log('Opening Summoning UI', spell, targetPosition);
        this.spellData = spell;
        this.targetPosition = targetPosition;
        this.selectionCallback = callback;
        this.selectedMonster = null;
        
        this.visible = true;
        this.container.classList.remove('hidden');
        this.container.style.display = 'block';
        gameState.gameMode = 'summoning_selection';
        
        // Update header with spell name
        this.header.textContent = `${spell.spellName}: Choose a Creature to Summon`;
        
        // Get reference to entityFactory if needed
        if (!this.entityFactory) {
            this.entityFactory = new EntityFactory();
        }
        
        // Populate monster selection area
        this.populateMonsterSelection();
        
        // Clear selected monster
        this.updateSelectedMonster();
    }
    
    /**
     * Hide the summoning UI
     */
    hideSummoningUI() {
        this.visible = false;
        this.container.classList.add('hidden');
        this.container.style.display = 'none';
        gameState.gameMode = 'exploration';
        
        // Clear selections
        this.selectedMonster = null;
        this.selectedMonsterArea.innerHTML = '';
        this.monsterSelectArea.innerHTML = '';
        
        // Cancel spell if callback exists
        if (this.selectionCallback) {
            this.selectionCallback(null); // Pass null to indicate cancellation
        }
    }
    
    /**
     * Populate the monster selection area
     */
    populateMonsterSelection() {
        // Clear existing content
        this.monsterSelectArea.innerHTML = '';
        
        // Create header
        const header = document.createElement('h3');
        header.textContent = 'Available Creatures';
        this.monsterSelectArea.appendChild(header);
        
        // Try to get all available monster types from the entity factory
        let monsterTypes = [];
        
        if (window.game && window.game.entityFactory && window.game.entityFactory.monsterTemplates) {
            // Get all monster types from the loaded templates
            monsterTypes = Object.keys(window.game.entityFactory.monsterTemplates);
            console.log("Got monster types from entityFactory:", monsterTypes);
        } else {
            // Fallback to a default list
            monsterTypes = ['goblin', 'orc', 'orc_warrior', 'orc_shaman', 'hydra', 'troll'];
            console.log("Using default monster types:", monsterTypes);
        }
        
        // Create a list of monsters
        const monsterList = document.createElement('ul');
        monsterList.className = 'monster-list';
        
        // Add each monster type
        monsterTypes.forEach(monsterId => {
            const monsterItem = document.createElement('li');
            monsterItem.textContent = this.formatMonsterName(monsterId);
            monsterItem.dataset.monsterId = monsterId;
            
            // Add click handler
            monsterItem.addEventListener('click', (event) => {
                // Explicitly stop propagation
                event.preventDefault();
                event.stopPropagation();
                
                this.selectMonster(monsterId);
            });
            
            monsterList.appendChild(monsterItem);
        });
        
        this.monsterSelectArea.appendChild(monsterList);
    }
    
    /**
     * Format a monster ID into a readable name
     */
    formatMonsterName(monsterId) {
        return monsterId
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }
    
    /**
     * Select a monster to summon
     */
    selectMonster(monsterId) {
        this.selectedMonster = monsterId;
        
        // Add a sound effect or visual feedback
        console.log(`Monster ${monsterId} selected!`);
        
        // Stop event propagation to prevent click from reaching player movement
        event.preventDefault();
        event.stopPropagation();
        
        // Update the selected monster display
        this.updateSelectedMonster();
    }
    
    /**
     * Update the display of selected monster
     */
    updateSelectedMonster() {
        // Clear existing content
        this.selectedMonsterArea.innerHTML = '';
        
        // Create header
        const header = document.createElement('h3');
        header.textContent = 'Selected Creature';
        this.selectedMonsterArea.appendChild(header);
        
        // If no monster is selected, show a message
        if (!this.selectedMonster) {
            const message = document.createElement('p');
            message.textContent = 'Select a creature to summon';
            this.selectedMonsterArea.appendChild(message);
            this.summonButton.disabled = true;
            return;
        }
        
        // Create details of selected monster
        const monsterDetails = document.createElement('div');
        monsterDetails.className = 'monster-details';
        
        // Monster name
        const monsterName = document.createElement('h4');
        monsterName.textContent = this.formatMonsterName(this.selectedMonster);
        monsterDetails.appendChild(monsterName);
        
        // Try to get more details from the template
        if (window.game && window.game.entityFactory && window.game.entityFactory.monsterTemplates) {
            const template = window.game.entityFactory.monsterTemplates[this.selectedMonster];
            if (template) {
                // Add stats
                const stats = document.createElement('ul');
                stats.className = 'monster-stats';
                
                stats.innerHTML = `
                    <li>HP: ${template.hp}</li>
                    <li>Strength: ${template.strength}</li>
                    <li>Defense: ${template.defense}</li>
                    <li>Intelligence: ${template.intelligence || 1}</li>
                `;
                
                monsterDetails.appendChild(stats);
            }
        }
        
        this.selectedMonsterArea.appendChild(monsterDetails);
        
        // Enable the summon button
        this.summonButton.disabled = false;
    }
    
    /**
     * Summon the selected creature
     */
    summonCreature() {
        if (!this.selectedMonster) {
            alert('Select a creature to summon');
            return;
        }
        
        console.log(`Summoning a ${this.selectedMonster} at ${this.targetPosition.x},${this.targetPosition.y}`);
        
        // Prepare the summon data with the selected monster type
        const summonData = {
            creatureType: this.selectedMonster,
            name: `Summoned ${this.formatMonsterName(this.selectedMonster)}`,
            duration: this.spellData.duration || 25,
            intelligenceScaling: {
                hp: 0.5,
                strength: 0.3,
                defense: 0.2,
                intelligence: 0.4
            }
        };
        
        // Hide the UI
        this.hideSummoningUI();
        
        // Call the callback with the modified spell data including summon data
        if (this.selectionCallback) {
            // Clone the spell data and add summon data
            const modifiedSpell = { ...this.spellData, summonData };
            this.selectionCallback({
                spell: modifiedSpell,
                target: this.targetPosition
            });
        }
    }
}

export default new SummoningUI();