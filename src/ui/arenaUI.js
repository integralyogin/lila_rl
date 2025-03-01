import gameState from '../core/gameState.js';
import eventBus from '../core/eventEmitter.js';
import EntityFactory from '../entities/entityFactory.js';

/**
 * ArenaUI - Handles the UI for arena fights
 */
class ArenaUI {
    constructor() {
        this.visible = false;
        this.currentMonsters = [];
        this.entityFactory = null;
        
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
        this.container.className = 'arena-ui hidden';
        this.container.style.display = 'none';
        document.getElementById('game-container').appendChild(this.container);
        
        // Create header
        this.header = document.createElement('div');
        this.header.className = 'arena-header';
        this.header.textContent = 'Arena Match';
        this.container.appendChild(this.header);
        
        // Create close button
        const closeButton = document.createElement('button');
        closeButton.className = 'close-button';
        closeButton.innerHTML = '&times;';
        closeButton.addEventListener('click', () => this.hideArenaUI());
        this.header.appendChild(closeButton);
        
        // Create monster selection area
        this.monsterSelectArea = document.createElement('div');
        this.monsterSelectArea.className = 'arena-monster-select';
        this.container.appendChild(this.monsterSelectArea);
        
        // Create selected monsters area
        this.selectedMonstersArea = document.createElement('div');
        this.selectedMonstersArea.className = 'arena-selected-monsters';
        this.container.appendChild(this.selectedMonstersArea);
        
        // Create buttons container
        this.buttonsContainer = document.createElement('div');
        this.buttonsContainer.className = 'arena-buttons';
        this.container.appendChild(this.buttonsContainer);
        
        // Create start match button
        this.startMatchButton = document.createElement('button');
        this.startMatchButton.textContent = 'Start Match';
        this.startMatchButton.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.startMatch();
        });
        this.buttonsContainer.appendChild(this.startMatchButton);
        
        // Create cancel button
        this.cancelButton = document.createElement('button');
        this.cancelButton.textContent = 'Cancel';
        this.cancelButton.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.hideArenaUI();
        });
        this.buttonsContainer.appendChild(this.cancelButton);
    }
    
    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Listen for arena open event
        eventBus.on('openArena', (npc) => {
            this.showArenaUI(npc);
        });
        
        // Listen for arena close event
        eventBus.on('arenaClose', () => {
            this.hideArenaUI();
        });
        
        // Listen for dialogue key presses
        eventBus.on('dialogueKeyPressed', (key) => {
            // Check if Enter pressed on an arena manager NPC
            if (key === 'Enter' || key === ' ') {
                const currentNPC = gameState.currentDialogue?.npc;
                if (currentNPC && currentNPC.hasComponent && 
                    currentNPC.hasComponent('ArenaManagerComponent')) {
                    // Close dialogue and open arena UI
                    eventBus.emit('dialogueClosed');
                    this.showArenaUI(currentNPC);
                }
            }
        });
        
        // Custom click handler to block clicks during selection
        document.addEventListener('click', (event) => {
            if (gameState.gameMode === 'arena_selection') {
                // If we're in arena selection mode, block all clicks not on arena UI
                const arenaUI = document.querySelector('.arena-ui');
                
                // If the click is not inside the arena UI, prevent it
                if (!arenaUI || !arenaUI.contains(event.target)) {
                    console.log("Blocking click outside arena UI during arena selection");
                    event.stopPropagation();
                    event.preventDefault();
                } else {
                    console.log("Click inside arena UI allowed");
                }
            }
        }, true); // Use capture phase to get clicks before other handlers
    }
    
    /**
     * Show the arena UI
     */
    showArenaUI(npc) {
        // Only proceed if we have a valid arena manager
        if (!npc || !npc.hasComponent('ArenaManagerComponent')) {
            console.error('No valid arena manager provided');
            return;
        }
        
        console.log('Opening Arena UI');
        this.currentManager = npc;
        this.visible = true;
        this.container.classList.remove('hidden');
        this.container.style.display = 'block';
        gameState.gameMode = 'arena_selection';
        
        // Get reference to entityFactory if needed
        if (!this.entityFactory) {
            this.entityFactory = new EntityFactory();
        }
        
        // Populate monster selection area
        this.populateMonsterSelection();
    }
    
    /**
     * Hide the arena UI
     */
    hideArenaUI() {
        this.visible = false;
        this.container.classList.add('hidden');
        this.container.style.display = 'none';
        gameState.gameMode = 'exploration';
        
        // Clear selections
        this.currentMonsters = [];
        this.selectedMonstersArea.innerHTML = '';
        this.monsterSelectArea.innerHTML = '';
    }
    
    /**
     * Populate the monster selection area
     */
    populateMonsterSelection() {
        // Clear existing content
        this.monsterSelectArea.innerHTML = '';
        
        // Create header
        const header = document.createElement('h3');
        header.textContent = 'Select Monsters to Fight';
        this.monsterSelectArea.appendChild(header);
        
        // Try to get all available monster types from the entity factory
        let monsterTypes = [];
        
        if (window.game && window.game.entityFactory && window.game.entityFactory.monsterTemplates) {
            // Get all monster types from the loaded templates
            monsterTypes = Object.keys(window.game.entityFactory.monsterTemplates);
            console.log("Got monster types from entityFactory:", monsterTypes);
        } else {
            // Fallback to a default list
            monsterTypes = ['goblin', 'orc', 'orc_warrior', 'orc_shaman', 'orc_chieftain', 'hydra', 'troll'];
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
     * Select a monster and add it to the fight
     */
    selectMonster(monsterId) {
        if (this.currentMonsters.length >= 2) {
            // Only allow 2 monsters for simplicity
            alert('You can only select 2 monsters for a fight');
            return;
        }
        
        // Add to selected monsters
        this.currentMonsters.push(monsterId);
        
        // Add a sound effect or visual feedback
        console.log(`Monster ${monsterId} selected!`);
        
        // Stop event propagation to prevent click from reaching player movement
        event.preventDefault();
        event.stopPropagation();
        
        // Update the selected monsters display
        this.updateSelectedMonsters();
    }
    
    /**
     * Update the display of selected monsters
     */
    updateSelectedMonsters() {
        // Clear existing content
        this.selectedMonstersArea.innerHTML = '';
        
        // Create header
        const header = document.createElement('h3');
        header.textContent = 'Selected Fighters';
        this.selectedMonstersArea.appendChild(header);
        
        // Create list of selected monsters
        const selectedList = document.createElement('ul');
        
        // Add each selected monster
        this.currentMonsters.forEach((monsterId, index) => {
            const monsterItem = document.createElement('li');
            monsterItem.textContent = `${index + 1}. ${this.formatMonsterName(monsterId)}`;
            
            // Add remove button
            const removeButton = document.createElement('button');
            removeButton.textContent = 'Remove';
            removeButton.addEventListener('click', (event) => {
                // Explicitly stop propagation
                event.preventDefault();
                event.stopPropagation();
                
                this.currentMonsters.splice(index, 1);
                this.updateSelectedMonsters();
            });
            
            monsterItem.appendChild(removeButton);
            selectedList.appendChild(monsterItem);
        });
        
        this.selectedMonstersArea.appendChild(selectedList);
        
        // Update start button state
        this.startMatchButton.disabled = this.currentMonsters.length < 2;
    }
    
    /**
     * Start the arena match with selected monsters
     */
    startMatch() {
        if (this.currentMonsters.length < 2) {
            alert('Select at least 2 monsters to start a match');
            return;
        }
        
        // Try to get a reference to the entity factory and game data
        console.log("Window game object:", window.game);
        
        // First try to get the factory and data from the game object
        if (window.game && window.game.entityFactory) {
            console.log("Using window.game.entityFactory");
            this.entityFactory = window.game.entityFactory;
        } 
        // Otherwise, load the data manually
        else {
            console.log("Loading monster data manually");
            
            if (!this.entityFactory) {
                this.entityFactory = new EntityFactory();
            }
            
            // Load monsters.json directly
            fetch('data/monsters.json')
                .then(response => response.json())
                .then(monstersData => {
                    console.log("Loaded monsters data:", monstersData);
                    const gameData = { monsters: monstersData };
                    this.entityFactory.initialize(gameData);
                    this.startMatchWithLoadedData();
                })
                .catch(error => {
                    console.error("Error loading monster data:", error);
                    alert("Could not load monster data");
                });
                
            return; // Return early, we'll continue after data is loaded
        }
        
        this.startMatchWithLoadedData();
    }
    
    /**
     * Start match after ensuring data is loaded
     */
    startMatchWithLoadedData() {
        console.log("Starting match with templates:", Object.keys(this.entityFactory.monsterTemplates));
        
        // Create actual monster entities
        const fighters = [];
        for (const monsterId of this.currentMonsters) {
            console.log(`Creating fighter: ${monsterId}`);
            const fighter = this.entityFactory.createMonster(monsterId, 0, 0);
            if (fighter) {
                fighters.push(fighter);
                console.log(`Created fighter ${fighter.name}`);
            } else {
                console.error(`Failed to create fighter: ${monsterId}`);
            }
        }
        
        if (fighters.length < 2) {
            alert('Not enough valid fighters could be created');
            return;
        }
        
        // Hide the UI
        this.hideArenaUI();
        
        // Start the match
        eventBus.emit('startArenaMatch', { fighters });
    }
}

export default ArenaUI;