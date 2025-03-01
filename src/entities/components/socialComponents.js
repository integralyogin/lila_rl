import { Component } from './baseComponents.js';
import gameState from '../../core/gameState.js';
import eventBus from '../../core/eventEmitter.js';

// DialogueComponent - for NPCs that can be talked to
export class DialogueComponent extends Component {
    constructor(dialogueData = [], isShopkeeper = false, inventory = null) {
        super();
        this.dialogueData = dialogueData; // Array of dialogue options or tree
        this.currentDialogue = 0;         // Current position in dialogue
        this.inConversation = false;      // Whether currently talking to this NPC
        this.hasCompletedDialogue = false; // Whether we've gone through all dialogue
        this.lastTalkTime = 0;            // Game turn when last talked
        this.isShopkeeper = isShopkeeper; // Whether this NPC is a shopkeeper
        
        // Important: Make a deep copy of the inventory items to prevent reference sharing
        if (inventory) {
            // Use a deep copy to ensure each item is also copied
            this.inventory = inventory.map(item => ({...item}));
            console.log(`DialogueComponent: Setting inventory for ${this.entity?.name || 'NPC'} with ${this.inventory.length} items. First item: ${this.inventory[0]?.name}`);
            
            // Force these properties to be distinct between NPCs
            this._shopkeeperToken = Math.random().toString(36).substring(2, 15);
            console.log(`Created unique shop token: ${this._shopkeeperToken}`);
        } else {
            this.inventory = null;
        }
    }
    
    getNextLine() {
        if (this.currentDialogue < this.dialogueData.length) {
            const dialogue = this.dialogueData[this.currentDialogue];
            this.currentDialogue++;
            
            // Check if this is the last line
            if (this.currentDialogue >= this.dialogueData.length) {
                this.hasCompletedDialogue = true;
            }
            
            return dialogue;
        }
        return null; // No more dialogue
    }
    
    resetDialogue() {
        this.currentDialogue = 0;
        // Don't reset hasCompletedDialogue here - it persists until canTalkAgain() is called
    }
    
    hasMoreDialogue() {
        return this.currentDialogue < this.dialogueData.length;
    }
    
    // For dialogue trees and choices
    selectOption(optionIndex) {
        // If current dialogue has options, select one
        const current = this.dialogueData[this.currentDialogue - 1];
        if (current && current.options && current.options[optionIndex]) {
            this.dialogueData = current.options[optionIndex].next;
            this.currentDialogue = 0;
            return true;
        }
        return false;
    }
    
    startConversation() {
        this.inConversation = true;
        
        // If we've completed dialogue before, check if enough time has passed
        if (this.hasCompletedDialogue) {
            // Reset if they can talk again
            if (this.canTalkAgain()) {
                this.hasCompletedDialogue = false;
                this.resetDialogue();
            }
        } else {
            this.resetDialogue();
        }
        
        // Record the time of this conversation
        this.lastTalkTime = gameState.turn;
    }
    
    endConversation() {
        this.inConversation = false;
    }
    
    canTalkAgain() {
        // Shopkeepers should always be available to talk
        if (this.isShopkeeper) {
            return true;
        }
        
        // Regular NPCs won't repeat their dialogue until at least 50 game turns have passed
        const currentTurn = gameState.turn;
        return (currentTurn - this.lastTalkTime) >= 50;
    }
}

// ArenaManagerComponent - for NPCs that manage arena fights
export class ArenaManagerComponent extends Component {
    constructor() {
        super();
        this.isArenaManager = true;
        this.availableMonsters = []; // Will be populated with monster types from monsters.json
    }
    
    // Method to start an arena match with selected fighters
    startArenaMatch(fighters) {
        eventBus.emit('startArenaMatch', { fighters });
    }
    
    // Method to stop the current arena match
    stopArenaMatch() {
        eventBus.emit('stopArenaMatch');
    }
}