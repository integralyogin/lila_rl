import gameState from '../core/gameState.js';
import eventBus from '../core/eventEmitter.js';
import { BlocksMovementComponent } from '../entities/components.js';

/**
 * ArenaSystem - Handles arena combat between monsters
 * Allows player to watch monsters fight each other with time passing automatically
 */
class ArenaSystem {
    constructor() {
        this.isActive = false;
        this.fighters = [];
        this.currentFighter = 0;
        this.intervalId = null;
        this.turnDelay = 200; // ms between turns
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Listen for arena mode activation
        eventBus.on('startArenaMatch', (data) => {
            console.log("ArenaSystem received startArenaMatch event with data:", data);
            this.startArenaMatch(data);
        });

        // Listen for arena mode deactivation
        eventBus.on('stopArenaMatch', () => {
            this.stopArenaMatch();
        });

        // Listen for game mode changes
        eventBus.on('dialogueClosed', () => {
            if (this.isActive) {
                this.stopArenaMatch();
            }
        });
    }

    /**
     * Start an arena match with selected fighters
     * @param {Object} data - Contains fighters array
     */
    startArenaMatch(data) {
        if (!data || !data.fighters || data.fighters.length < 2) {
            console.error("Not enough fighters for arena match");
            return false;
        }

        const fighters = data.fighters;
        console.log(`Starting arena match with ${fighters.length} fighters`);
        this.isActive = true;
        this.fighters = fighters;
        this.currentFighter = 0;
        
        // Store current location to return to later
        this.previousLocation = gameState.location;
        
        // Store previous game mode
        const previousGameMode = gameState.gameMode;
        gameState.previousGameMode = previousGameMode;
        
        // Change game mode to arena
        gameState.gameMode = 'arena';
        
        // Transport player to arena map - adding a delay to ensure map loads fully
        this.transportToArena(() => {
            // Add message about the match starting
            gameState.addMessage("The arena match is about to begin! Fighters take their positions.", "important");
            
            // Add fighters to the game after a brief delay to ensure map is fully loaded
            setTimeout(() => {
                this.addFightersToArena();
                
                // Additional message when fighters are actually added
                gameState.addMessage("The crowd roars as the fight begins!", "important");
            }, 500);
        });
        
        // Notify about the match starting 
        eventBus.emit('arenaMatchStarted', { fighters: this.fighters });
        
        // Start the turn cycle with a delay to allow map loading
        setTimeout(() => {
            this.intervalId = setInterval(() => this.processTurn(), this.turnDelay);
        }, 1000);
        
        return true;
    }

    /**
     * End the current arena match
     */
    stopArenaMatch() {
        if (!this.isActive) return;
        
        console.log("Stopping arena match");
        this.isActive = false;
        
        // Clear interval
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        
        // Clean up fighters
        this.removeFightersFromArena();
        
        // Return to previous location
        this.returnToPreviousLocation(() => {
            // Switch back to previous game mode after transport
            gameState.gameMode = gameState.previousGameMode || 'exploration';
            
            // Notify about the match ending
            eventBus.emit('arenaMatchEnded');
            gameState.addMessage("The arena match has ended.", "important");
        });
    }
    
    /**
     * Transport player to the arena map
     * @param {Function} callback - Function to call after transport completes
     */
    transportToArena(callback) {
        console.log("Transporting player to arena...");

        // Preserve current FOV settings
        this.originalFOVRadius = null;
        
        // Get FOV system to expand visibility
        const fovSystem = gameState.getSystem('FOVSystem');
        if (fovSystem) {
            // Store original FOV radius
            this.originalFOVRadius = fovSystem.radius;
            
            // Set expanded radius for arena visibility - keep it small enough to fit in view
            fovSystem.radius = 15;
            console.log(`Expanded FOV radius from ${this.originalFOVRadius} to ${fovSystem.radius}`);
        }
        
        // Use the game's changeArea method to move to arena map
        if (window.game && window.game.changeArea) {
            // This is the proper way to change areas using the game's own methods
            window.game.changeArea('arena').then(() => {
                console.log("Arrived at arena");
                
                // Position player in the viewing area, not in the middle of the map
                if (gameState.player && gameState.player.position) {
                    // Position player directly above the arena pit for better visibility
                    gameState.player.position.x = 14; // Center X of expanded arena pit 
                    gameState.player.position.y = 3;  // Well above the arena for better viewing
                    console.log(`Positioned player at (${gameState.player.position.x}, ${gameState.player.position.y})`);
                }
                
                // Mark entire arena map as explored and visible
                this.illuminateArena();
                
                if (callback) callback();
            });
        } else {
            // Fallback method to try to change location directly
            console.warn("Using fallback method to change to arena");
            gameState.location = 'arena';
            
            // Attempt to load arena map
            fetch('data/maps/arena.json')
                .then(response => response.json())
                .then(arenaData => {
                    console.log("Loaded arena map data");
                    eventBus.emit('mapChanged', { mapData: arenaData });
                    
                    // Position player in the viewing area
                    if (gameState.player && gameState.player.position) {
                        gameState.player.position.x = 14; // Center X of expanded arena pit
                        gameState.player.position.y = 3;  // Well above the arena for better viewing
                        console.log(`Positioned player at (${gameState.player.position.x}, ${gameState.player.position.y})`);
                    }
                    
                    // Mark entire arena map as explored and visible
                    this.illuminateArena();
                    
                    if (callback) callback();
                })
                .catch(error => {
                    console.error("Error loading arena map:", error);
                });
        }
    }
    
    /**
     * Make the entire arena map visible
     */
    illuminateArena() {
        console.log("Illuminating the entire arena");
        
        // Only continue if we have a map
        if (!gameState.map) return;
        
        // Make the entire map visible and explored
        for (let y = 0; y < gameState.map.height; y++) {
            for (let x = 0; x < gameState.map.width; x++) {
                if (gameState.map.isInBounds(x, y)) {
                    gameState.map.tiles[y][x].visible = true;
                    gameState.map.tiles[y][x].explored = true;
                    gameState.setTileVisible(x, y);
                }
            }
        }
        
        // Update FOV to show changes
        eventBus.emit('fovUpdated');
        
        // Add a message
        gameState.addMessage("The arena is brightly lit for the spectators!", "important");
    }
    
    /**
     * Return player to their previous location
     * @param {Function} callback - Function to call after transport completes
     */
    returnToPreviousLocation(callback) {
        console.log(`Returning player to ${this.previousLocation || 'town'}...`);
        
        // Restore original FOV radius if we modified it
        if (this.originalFOVRadius) {
            const fovSystem = gameState.getSystem('FOVSystem');
            if (fovSystem) {
                console.log(`Restoring FOV radius from ${fovSystem.radius} to ${this.originalFOVRadius}`);
                fovSystem.radius = this.originalFOVRadius;
            }
            this.originalFOVRadius = null;
        }
        
        // Use the game's changeArea method to move back
        if (window.game && window.game.changeArea) {
            window.game.changeArea(this.previousLocation || 'town').then(() => {
                console.log("Returned to previous location");
                if (callback) callback();
            });
        } else {
            // Fallback method
            console.warn("Using fallback method to return to previous location");
            gameState.location = this.previousLocation || 'town';
            
            // Reset previous location
            this.previousLocation = null;
            
            // Trigger map change event
            eventBus.emit('mapChanged');
            
            if (callback) callback();
        }
    }

    /**
     * Process a single turn for one fighter
     */
    processTurn() {
        if (!this.isActive || this.fighters.length < 2) {
            this.stopArenaMatch();
            return;
        }

        // Get current fighter
        const fighter = this.fighters[this.currentFighter];
        
        // Skip dead fighters
        if (this.isFighterDefeated(fighter)) {
            this.advanceToNextFighter();
            return;
        }
        
        // Process fighter's turn
        this.processFighterTurn(fighter);
        
        // Check if the match should end
        if (this.shouldMatchEnd()) {
            // Get the winner
            const winner = this.getWinner();
            if (winner) {
                gameState.addMessage(`${winner.name} is victorious!`, "important");
            } else {
                gameState.addMessage("The match has ended in a draw!", "important");
            }
            
            // End the match after a delay
            setTimeout(() => this.stopArenaMatch(), 2000);
            return;
        }
        
        // Move to next fighter
        this.advanceToNextFighter();
        
        // Force a render update
        eventBus.emit('fovUpdated');
    }

    /**
     * Process the current fighter's turn
     */
    processFighterTurn(fighter) {
        if (!fighter) return;
        
        // Find a target
        const target = this.findTarget(fighter);
        if (!target) return;
        
        // Get fighter's AI component to check type
        const aiComponent = fighter.getComponent('AIComponent');
        
        // If fighter has valid AI component, use its attack logic
        if (aiComponent) {
            console.log(`Using AI logic for ${fighter.name}, AI type: ${aiComponent.type}`);
            
            // Set target in AI component
            aiComponent.target = target;
            
            // Mark AI as being in arena combat
            aiComponent.inArenaCombat = true;
            
            // Store distance to target for AI decision making
            const dist = this.getDistance(fighter.position, target.position);
            aiComponent.distanceToTarget = dist;
            
            // Add fighter type identification for specific spell effects
            const name = fighter.name.toLowerCase();
            
            // For mages, give them a spell if they don't have one
            if ((name.includes('mage') || name.includes('wizard') || name.includes('shaman')) && 
                !fighter.getComponent('SpellsComponent')) {
                
                // Create a spells component if needed
                function SpellsComponent() {
                    this.knownSpells = new Map();
                    
                    // Add appropriate spell based on name
                    if (name.includes('fire')) {
                        this.knownSpells.set('firebolt', {
                            name: 'Firebolt',
                            manaCost: 5,
                            baseDamage: 8, 
                            element: 'fire',
                            range: 6,
                            intelligenceScale: 0.5,
                            message: 'hurls a bolt of fire',
                            deathMessage: 'is incinerated'
                        });
                    } else if (name.includes('ice')) {
                        this.knownSpells.set('icespear', {
                            name: 'Ice Spear',
                            manaCost: 7,
                            baseDamage: 10,
                            element: 'ice',
                            range: 6,
                            intelligenceScale: 0.6,
                            message: 'launches a spear of ice',
                            deathMessage: 'is frozen solid'
                        });
                    } else {
                        this.knownSpells.set('shockbolt', {
                            name: 'Shock Bolt',
                            manaCost: 5,
                            baseDamage: 6,
                            element: 'lightning',
                            range: 5,
                            intelligenceScale: 0.7,
                            message: 'sends a bolt of electricity',
                            deathMessage: 'is electrocuted'
                        });
                    }
                };
                
                // Create a mana component if needed
                function ManaComponent() {
                    this.mana = 50;
                    this.maxMana = 50;
                }
                
                // Add components to the fighter
                fighter.addComponent = fighter.addComponent || function(component) {
                    if (!this.components) this.components = new Map();
                    
                    const componentName = component.constructor.name || 'UnknownComponent';
                    this.components.set(componentName, component);
                    component.entity = this;
                    
                    console.log(`Added ${componentName} to ${this.name}`);
                };
                
                fighter.addComponent(new SpellsComponent());
                fighter.addComponent(new ManaComponent());
                
                console.log(`Added spell capabilities to ${fighter.name}`);
            }
            
            // Try to use AI's own takeTurn method first
            if (aiComponent.takeTurn) {
                // Create a wrapper for the takeTurn method to hook into it for visual effects
                const originalTakeTurn = aiComponent.takeTurn;
                
                // Make sure we have a global reference to the AI behavior manager
                if (typeof aiBehaviorManager === 'undefined') {
                    // Try to find it from another component's reference
                    const TestEntity = Array.from(gameState.entities.values()).find(e => 
                        e.getComponent && e.getComponent('AIComponent') && 
                        e.getComponent('AIComponent').behaviorType);
                    
                    if (TestEntity) {
                        console.log("Getting aiBehaviorManager from existing entity");
                        // Access through a getter
                        const aiComp = TestEntity.getComponent('AIComponent');
                        if (aiComp) {
                            // Try to access the behavior manager through the component's manager property
                            window.aiBehaviorManager = aiComp.behaviorManager || window.aiBehaviorManager;
                        }
                    }
                    
                    // Create a fallback if we couldn't find it
                    if (typeof aiBehaviorManager === 'undefined') {
                        console.log("Creating a mock aiBehaviorManager");
                        window.aiBehaviorManager = {
                            execute: function(behaviorId, entity, context) {
                                console.log(`Mock aiBehaviorManager executing ${behaviorId}`);
                                return { success: true };
                            }
                        };
                    }
                }
                
                // Replace with our enhanced version
                aiComponent.takeTurn = function() {
                    // Store the original spellcast functionality
                    const createSpellEffect = (spellId, source, target) => {
                        // Get renderSystem from gameState
                        const renderSystem = gameState.renderSystem || gameState.getSystem('RenderSystem');
                        if (!renderSystem || !renderSystem.createSpellEffect) {
                            console.error("RenderSystem or createSpellEffect method not found");
                            return;
                        }
                        
                        // Determine the visual element based on spell name
                        let element = 'fire';
                        if (spellId.includes('ice') || spellId.includes('frost')) {
                            element = 'ice';
                        } else if (spellId.includes('shock') || spellId.includes('lightning')) {
                            element = 'lightning';
                        }
                        
                        console.log(`Creating spell effect for ${spellId} (${element})`);
                        
                        // Create bolt effect
                        renderSystem.createSpellEffect('bolt', element, {
                            sourceX: source.position.x,
                            sourceY: source.position.y,
                            targetX: target.position.x,
                            targetY: target.position.y,
                            duration: 500
                        });
                        
                        // Create impact effect after a short delay
                        setTimeout(() => {
                            renderSystem.createSpellEffect('impact', element, {
                                x: target.position.x,
                                y: target.position.y,
                                duration: 600
                            });
                        }, 400);
                    };
                    
                    // Try to access either global or window.aiBehaviorManager
                    const behaviorManager = typeof aiBehaviorManager !== 'undefined' ? 
                        aiBehaviorManager : (window.aiBehaviorManager || null);
                    
                    // Skip hooking if we can't find the behavior manager
                    if (!behaviorManager) {
                        console.error("Could not find AI behavior manager to hook");
                        return originalTakeTurn.apply(this, arguments);
                    }
                    
                    // Store original execute method to hook into it
                    const oldExecute = behaviorManager.execute;
                    
                    // Hook into spell casting
                    behaviorManager.execute = function(behaviorId, entity, context) {
                        // Call the original method first
                        const result = oldExecute.call(this, behaviorId, entity, context);
                        
                        // If this was a spell cast and it succeeded, create visual effect
                        if (behaviorId === 'castSpell' && result && result.success && context.spellId) {
                            createSpellEffect(context.spellId, entity, context.target);
                        }
                        
                        return result;
                    };
                    
                    // Call the original method
                    const result = originalTakeTurn.apply(this, arguments);
                    
                    // Restore the original execute method
                    behaviorManager.execute = oldExecute;
                    
                    return result;
                };
                
                // Allow the AI to make its own decisions with our enhanced version
                aiComponent.takeTurn();
                return;
            }
            
            // Fallback for older AI entities that don't have specialized behavior
            // Check if fighter is adjacent to target - use the distance we already calculated
            const adjacentDist = this.getDistance(fighter.position, target.position);
            
            if (adjacentDist <= 1.5) {
                // Attack if adjacent
                if (aiComponent._attackTarget) {
                    aiComponent._attackTarget(target);
                } else {
                    // Fallback to direct attack
                    this.attackTarget(fighter, target);
                }
            } else {
                // Move toward target
                this.moveTowardTarget(fighter, target);
                
                // Log movement with variety
                const moveMessages = [
                    `${fighter.name} moves toward ${target.name}.`,
                    `${fighter.name} advances on ${target.name}.`,
                    `${fighter.name} lunges toward ${target.name}.`
                ];
                const randomMessage = moveMessages[Math.floor(Math.random() * moveMessages.length)];
                gameState.addMessage(randomMessage);
            }
        } else {
            // Fallback to simple attack logic if no AI component
            this.attackTarget(fighter, target);
        }
    }
    
    /**
     * Calculate distance between two positions
     */
    getDistance(pos1, pos2) {
        if (!pos1 || !pos2) return Infinity;
        
        const dx = pos2.x - pos1.x;
        const dy = pos2.y - pos1.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    /**
     * Move fighter toward a target
     */
    moveTowardTarget(fighter, target) {
        if (!fighter || !target || !fighter.position || !target.position) return;
        
        const dx = Math.sign(target.position.x - fighter.position.x);
        const dy = Math.sign(target.position.y - fighter.position.y);
        
        // Try to move in primary direction first
        if (Math.abs(dx) > Math.abs(dy)) {
            if (!this.isPositionBlocked(fighter.position.x + dx, fighter.position.y)) {
                fighter.position.x += dx;
            } else if (!this.isPositionBlocked(fighter.position.x, fighter.position.y + dy)) {
                fighter.position.y += dy;
            }
        } else {
            if (!this.isPositionBlocked(fighter.position.x, fighter.position.y + dy)) {
                fighter.position.y += dy;
            } else if (!this.isPositionBlocked(fighter.position.x + dx, fighter.position.y)) {
                fighter.position.x += dx;
            }
        }
    }
    
    /**
     * Check if a position is blocked
     */
    isPositionBlocked(x, y) {
        // Check map boundaries
        if (!gameState.map || 
            x < 0 || y < 0 || 
            x >= gameState.map.width || 
            y >= gameState.map.height) {
            return true;
        }
        
        // Check if the tile is blocked
        const tile = gameState.map.getTile(x, y);
        if (tile.blocked) {
            return true;
        }
        
        // Check if there's an entity blocking the position
        const entities = Array.from(gameState.entities.values());
        for (const entity of entities) {
            if (entity.position && 
                entity.position.x === x && 
                entity.position.y === y &&
                (entity.blockMovement || entity.getComponent('BlocksMovementComponent'))) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Find a target for the fighter
     */
    findTarget(fighter) {
        // Simple targeting: pick the first living opponent
        for (const potential of this.fighters) {
            if (potential !== fighter && !this.isFighterDefeated(potential)) {
                return potential;
            }
        }
        return null;
    }

    /**
     * Attack a target with the current fighter
     */
    attackTarget(attacker, target) {
        if (!attacker || !target) {
            console.error("Missing attacker or target in attackTarget", { attacker, target });
            return;
        }
        
        // Get combat stats - check for HealthComponent for HP and StatsComponent for stats
        const attackerHealth = attacker.getComponent('HealthComponent');
        const targetHealth = target.getComponent('HealthComponent');
        const attackerStats = attacker.getComponent('StatsComponent');
        const targetStats = target.getComponent('StatsComponent');
        
        if (!attackerHealth || !targetHealth) {
            console.error("Missing HealthComponents", { 
                attacker: attacker.name, 
                attackerHealth: !!attackerHealth,
                target: target.name,
                targetHealth: !!targetHealth 
            });
            return;
        }
        
        if (!attackerStats || !targetStats) {
            console.error("Missing StatsComponents", { 
                attacker: attacker.name, 
                attackerStats: !!attackerStats,
                target: target.name,
                targetStats: !!targetStats 
            });
            return;
        }
        
        // Get AI component if available for special attack handling
        const aiComponent = attacker.getComponent('AIComponent');
        
        // If attacker has special attack method, use it
        if (aiComponent && aiComponent._attackTarget) {
            console.log(`Using AI component's attack method for ${attacker.name}`);
            aiComponent.target = target;
            aiComponent._attackTarget(target);
            return;
        }
        
        // Calculate damage with some variance (±20%)
        const baseDamage = Math.max(1, attackerStats.strength - Math.floor(targetStats.defense / 2));
        const variance = 0.2;
        const multiplier = 1 + (Math.random() * variance * 2 - variance);
        const damage = Math.max(1, Math.floor(baseDamage * multiplier));
        
        // Apply damage
        targetHealth.hp -= damage;
        
        console.log(`${attacker.name} attacks ${target.name} for ${damage} damage! ${target.name} has ${targetHealth.hp}/${targetHealth.maxHp} HP remaining.`);
        
        // Add some variety to attack messages
        const attackMessages = [
            `${attacker.name} strikes ${target.name} for ${damage} damage!`,
            `${attacker.name} slashes at ${target.name}, dealing ${damage} damage!`,
            `${attacker.name} lands a powerful blow on ${target.name} for ${damage} damage!`
        ];
        
        // Log the attack with variety
        const randomMessage = attackMessages[Math.floor(Math.random() * attackMessages.length)];
        gameState.addMessage(randomMessage);
        
        // Occasionally add crowd reaction
        if (Math.random() < 0.3) {
            const crowdMessages = [
                "The crowd cheers at the impressive strike!",
                "Spectators gasp at the powerful attack!",
                "The audience roars with excitement!"
            ];
            const crowdMessage = crowdMessages[Math.floor(Math.random() * crowdMessages.length)];
            gameState.addMessage(crowdMessage);
        }
        
        // Check if target is defeated
        if (targetHealth.hp <= 0) {
            targetHealth.hp = 0;
            gameState.addMessage(`${target.name} has been defeated by ${attacker.name}!`, "important");
            gameState.addMessage("The crowd erupts in cheers for the victorious fighter!", "important");
        }
    }

    /**
     * Check if a fighter is defeated
     */
    isFighterDefeated(fighter) {
        if (!fighter) return true;
        
        const health = fighter.getComponent('HealthComponent');
        return !health || health.hp <= 0;
    }

    /**
     * Check if the match should end
     */
    shouldMatchEnd() {
        // Count living fighters
        let livingCount = 0;
        for (const fighter of this.fighters) {
            if (!this.isFighterDefeated(fighter)) {
                livingCount++;
            }
        }
        
        // Match ends when only one or no fighters remain
        return livingCount <= 1;
    }

    /**
     * Get the winner of the match
     */
    getWinner() {
        for (const fighter of this.fighters) {
            if (!this.isFighterDefeated(fighter)) {
                return fighter;
            }
        }
        return null; // No winner (all defeated)
    }

    /**
     * Move to the next fighter
     */
    advanceToNextFighter() {
        this.currentFighter = (this.currentFighter + 1) % this.fighters.length;
    }

    /**
     * Add fighters to the arena map
     */
    addFightersToArena() {
        console.log("Adding fighters to arena...");
        
        // Positioning logic for fighters - place them in the arena pit
        // Get the actual arena pit dimensions from the map data
        const arenaPit = {
            x: 7,
            y: 8,
            width: 14,
            height: 10
        };
        
        // Calculate center of the arena pit
        const centerX = arenaPit.x + Math.floor(arenaPit.width / 2);
        const centerY = arenaPit.y + Math.floor(arenaPit.height / 2);
        const radius = 3; // Larger radius for a better spread in the expanded arena
        
        console.log(`Arena pit center: (${centerX}, ${centerY})`);
        
        // Filter out null fighters
        this.fighters = this.fighters.filter(fighter => fighter !== null);
        
        if (this.fighters.length < 2) {
            console.error("Not enough valid fighters for the arena");
            this.stopArenaMatch();
            return;
        }
        
        // Log all fighters and their IDs
        this.fighters.forEach((fighter, index) => {
            console.log(`Fighter ${index+1}: ${fighter.name}, ID: ${fighter.id}, type: ${fighter.type || 'unknown'}`);
        });
        
        // Configure optimal starting positions based on fighter types
        // We want ranged fighters to be further away than melee fighters
        const isRanged = {};
        this.fighters.forEach(fighter => {
            const name = fighter.name.toLowerCase();
            isRanged[fighter.id] = name.includes('hydra') || 
                                   name.includes('shaman') || 
                                   name.includes('wizard') ||
                                   name.includes('mage') ||
                                   name.includes('archer');
        });
        
        // Make sure fighters have all needed components
        this.fighters.forEach((fighter, index) => {
            // Log fighter details
            console.log(`Setting up fighter ${index+1}: ${fighter.name} with ID ${fighter.id}`);
            
            if (!fighter || !fighter.position) {
                console.error("Invalid fighter:", fighter);
                return;
            }
            
            // For two fighters, place them on opposite sides
            let x, y;
            if (this.fighters.length === 2) {
                if (index === 0) {
                    // First fighter on left side
                    x = centerX - 4;
                    y = centerY;
                } else {
                    // Second fighter on right side
                    x = centerX + 4;
                    y = centerY;
                }
            } else {
                // For more than 2 fighters, place them in a circle
                const angle = (index / this.fighters.length) * 2 * Math.PI;
                // Use a larger radius for ranged fighters
                const fighterRadius = isRanged[fighter.id] ? radius + 3 : radius + 2;
                x = Math.floor(centerX + Math.cos(angle) * fighterRadius);
                y = Math.floor(centerY + Math.sin(angle) * fighterRadius);
            }
            
            // Ensure fighters are inside the arena pit
            x = Math.max(arenaPit.x + 1, Math.min(x, arenaPit.x + arenaPit.width - 2));
            y = Math.max(arenaPit.y + 1, Math.min(y, arenaPit.y + arenaPit.height - 2));
            
            console.log(`Positioning fighter ${fighter.name} at (${x}, ${y})`);
            
            // Position the fighter
            fighter.position.x = x;
            fighter.position.y = y;
            
            // Add descriptive message to make the fighter's location clear
            if (isRanged[fighter.id]) {
                gameState.addMessage(`${fighter.name} takes a strategic position in the arena!`);
            } else {
                gameState.addMessage(`${fighter.name} enters the arena!`);
            }
            
            // Make sure fighter has a BlocksMovementComponent
            if (!fighter.hasComponent('BlocksMovementComponent')) {
                fighter.addComponent(new BlocksMovementComponent());
            }
            
            // Determine AI type based on monster name
            let aiType = 'basic';
            const name = fighter.name.toLowerCase();
            
            if (name.includes('hydra')) {
                aiType = 'stationary';
            } else if (name.includes('orc')) {
                aiType = 'hostile';
            }
            
            // Make sure fighter has an AIComponent
            if (!fighter.hasComponent('AIComponent')) {
                const aiComponent = new AIComponent(aiType);
                fighter.addComponent(aiComponent);
                console.log(`Added AIComponent to ${fighter.name} with type: ${aiComponent.type}`);
                
                // Set appropriate attack range and behavior type based on monster type
                if (name.includes('hydra')) {
                    aiComponent.attackRange = 6; // Extended range for larger arena
                    aiComponent.behaviorType = 'stationary';
                    console.log(`Set ${fighter.name} attack range to ${aiComponent.attackRange}, behavior: ${aiComponent.behaviorType}`);
                } else if (name.includes('shaman') || name.includes('mage') || name.includes('wizard')) {
                    aiComponent.attackRange = 5; // Extended range for larger arena
                    aiComponent.behaviorType = 'spellcaster';
                    console.log(`Set ${fighter.name} attack range to ${aiComponent.attackRange}, behavior: ${aiComponent.behaviorType}`);
                } else if (name.includes('archer')) {
                    aiComponent.attackRange = 4; // Extended range for larger arena
                    aiComponent.behaviorType = 'ranged';
                    console.log(`Set ${fighter.name} attack range to ${aiComponent.attackRange}, behavior: ${aiComponent.behaviorType}`);
                }
                
                // Mark for arena combat
                aiComponent.inArenaCombat = true;
            } else {
                // Update existing AI component for arena combat
                const aiComponent = fighter.getComponent('AIComponent');
                console.log(`${fighter.name} already has AIComponent with type: ${aiComponent.type}`);
                
                // Override AI type for special monsters
                if (name.includes('hydra')) {
                    aiComponent.type = 'stationary';
                    aiComponent.behaviorType = 'stationary';
                    aiComponent.attackRange = 6; // Extended range for larger arena
                } else if (name.includes('shaman') || name.includes('mage') || name.includes('wizard')) {
                    aiComponent.behaviorType = 'spellcaster';
                    aiComponent.attackRange = 5; // Extended range for larger arena
                } else if (name.includes('archer')) {
                    aiComponent.behaviorType = 'ranged';
                    aiComponent.attackRange = 4; // Extended range for larger arena
                }
                
                // Make sure AI knows it's in arena combat
                aiComponent.inArenaCombat = true;
                
                console.log(`Updated ${fighter.name} AI: type=${aiComponent.type}, range=${aiComponent.attackRange}`);
            }
            
            // Log fighter stats for battle commentary
            const stats = fighter.getComponent('StatsComponent');
            const health = fighter.getComponent('HealthComponent');
            if (stats && health) {
                gameState.addMessage(`${fighter.name}: ${health.hp}/${health.maxHp} HP, Str: ${stats.strength}, Def: ${stats.defense}`);
            }
            
            // For two identical monsters, modify the name to distinguish them
            if (this.fighters.length === 2 && 
                this.fighters[0].type === this.fighters[1].type && 
                index === 1) {
                const oldName = fighter.name;
                fighter.name = `${fighter.name} II`;
                console.log(`Renamed fighter from "${oldName}" to "${fighter.name}" to distinguish from first fighter`);
                gameState.addMessage(`The second ${oldName} takes its position as ${fighter.name}!`);
            }
            
            // Add to game entities if not already there - use unique ID
            if (!gameState.entities.has(fighter.id)) {
                gameState.addEntity(fighter);
                console.log(`Added ${fighter.name} with ID ${fighter.id} to entities`);
            } else {
                console.log(`${fighter.name} with ID ${fighter.id} already in entities`);
            }
        });
        
        // Update FOV to make sure fighters are visible
        const fovSystem = gameState.getSystem('FOVSystem');
        if (fovSystem) {
            fovSystem.update();
            eventBus.emit('fovUpdated');
        }
        
        // Log all entities
        console.log(`Total entities in arena: ${gameState.entities.size}`);
        gameState.entities.forEach((entity, id) => {
            console.log(`Entity: ${entity.name}, ID: ${id}`);
        });
    }

    /**
     * Remove fighters from the arena
     */
    removeFightersFromArena() {
        // Remove all fighters from the game
        this.fighters.forEach(fighter => {
            if (gameState.entities.has(fighter.id)) {
                gameState.entities.delete(fighter.id);
            }
        });
        
        this.fighters = [];
    }
}

// Create and export a singleton instance
export default new ArenaSystem();