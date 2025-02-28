import gameState from '../core/gameState.js';
import eventBus from '../core/eventEmitter.js';

class DialogueUI {
    constructor() {
        this.visible = false;
        this.currentNPC = null;
        this.initUI();
        this.setupEventListeners();
    }
    
    initUI() {
        // Create dialogue UI container
        this.container = document.createElement('div');
        this.container.className = 'dialogue-ui hidden';
        this.container.style.display = 'none'; // Make sure it's hidden initially
        document.getElementById('game-container').appendChild(this.container);
        
        // Create header for NPC name
        this.header = document.createElement('div');
        this.header.className = 'dialogue-header';
        this.container.appendChild(this.header);
        
        // Create dialogue content area
        this.dialogueContent = document.createElement('div');
        this.dialogueContent.className = 'dialogue-content';
        this.container.appendChild(this.dialogueContent);
        
        // Create footer with instructions
        this.footer = document.createElement('div');
        this.footer.className = 'dialogue-footer';
        this.footer.textContent = 'Press Space to continue, Escape to exit';
        this.container.appendChild(this.footer);
    }
    
    setupEventListeners() {
        // Listen for start dialogue event
        eventBus.on('startDialogue', (npc) => {
            console.log("DialogueUI: Received startDialogue event for", npc.name);
            this.showDialogue(npc);
        });
        
        // Listen for key presses when dialogue is active
        document.addEventListener('keydown', (event) => {
            if (!this.visible) return;
            
            console.log("DialogueUI: Key pressed in dialogue:", event.key);
            
            if (event.key === ' ' || event.key === 'Enter') {
                this.advanceDialogue();
                event.preventDefault();
            } else if (event.key === 'Escape') {
                this.hideDialogue();
                event.preventDefault();
            }
        });
    }
    
    showDialogue(npc) {
        if (!npc || !npc.hasComponent('DialogueComponent')) return;
        
        console.log(`DialogueUI.showDialogue: Opening dialogue with ${npc.name}`);
        
        this.currentNPC = npc;
        const dialogue = npc.getComponent('DialogueComponent');
        
        console.log(`DialogueUI: NPC dialogue state - isShopkeeper:${dialogue.isShopkeeper}, hasCompletedDialogue:${dialogue.hasCompletedDialogue}, hasMoreDialogue:${dialogue.hasMoreDialogue()}`);
        
        // Start conversation (this will handle checking if dialogue can be repeated)
        dialogue.startConversation();
        
        // Check if NPC has anything to say (could be false if hasCompletedDialogue is true)
        if (dialogue.hasCompletedDialogue && !dialogue.hasMoreDialogue() && !dialogue.isShopkeeper) {
            gameState.addMessage(`${npc.name} has nothing more to say right now.`);
            return;
        }
        
        // Special handling for shopkeepers
        if (dialogue.hasCompletedDialogue && !dialogue.hasMoreDialogue() && dialogue.isShopkeeper) {
            console.log(`DialogueUI: Skipping dialogue for shopkeeper ${npc.name} and going straight to shop`);
            // Skip dialogue and go straight to shop
            eventBus.emit('shopOpened', npc);
            gameState.gameMode = 'shop';
            return;
        }
        
        // Show the dialogue UI
        this.container.classList.remove('hidden');
        this.container.style.display = 'flex';
        this.visible = true;
        
        // Set NPC name in header
        this.header.textContent = npc.name;
        this.header.style.color = npc.hasComponent('RenderableComponent') ? 
            npc.getComponent('RenderableComponent').color : '#fff';
        
        // Set game mode to dialogue
        gameState.gameMode = 'dialogue';
        
        // Show first line of dialogue
        this.advanceDialogue();
    }
    
    advanceDialogue() {
        if (!this.currentNPC) return;
        
        const dialogue = this.currentNPC.getComponent('DialogueComponent');
        
        // Check if there's more dialogue
        if (!dialogue.hasMoreDialogue()) {
            // Check if this is a shopkeeper
            if (dialogue.isShopkeeper) {
                // Open the shop
                eventBus.emit('shopOpened', this.currentNPC);
                gameState.gameMode = 'shop';
                
                // Don't mark shopkeeper dialogue as completed
                dialogue.hasCompletedDialogue = false;
            } else {
                gameState.addMessage(`${this.currentNPC.name} has nothing more to say.`);
            }
            
            // Close the dialogue UI
            this.hideDialogue();
            return;
        }
        
        const nextLine = dialogue.getNextLine();
        
        if (nextLine) {
            // Display the dialogue line
            this.dialogueContent.textContent = nextLine;
        } else {
            // No more dialogue, close the dialogue UI
            this.hideDialogue();
        }
    }
    
    hideDialogue() {
        this.container.classList.add('hidden');
        this.container.style.display = 'none';
        this.visible = false;
        
        // Reset the dialogue component on the NPC
        if (this.currentNPC && this.currentNPC.hasComponent('DialogueComponent')) {
            const dialogue = this.currentNPC.getComponent('DialogueComponent');
            dialogue.resetDialogue();
            dialogue.endConversation();
        }
        
        this.currentNPC = null;
        
        // Reset game mode
        gameState.gameMode = 'exploration';
        
        // Emit dialogue ended event
        eventBus.emit('dialogueEnded');
    }
}

export default DialogueUI;