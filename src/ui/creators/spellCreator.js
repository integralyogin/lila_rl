import gameState from '../../core/gameState.js';
import eventBus from '../../core/eventEmitter.js';
import spellLogic from '../../spells/spell_logic.js';
import { createBoltSpell } from '../../spells/implementations/boltSpells.js';
import { targetingSystem } from '../../systems/targetingSystem.js';

class SpellCreator {
    constructor() {
        this.entityFactory = null;
        this.elements = ['fire', 'ice', 'lightning', 'arcane', 'nature', 'radiant', 'life', 'neutral'];
        this.effects = ['damage', 'heal', 'slow', 'area_effect', 'damage_over_time', 'summon', 'transform'];
        this.tags = ['attack', 'healing', 'area', 'target', 'self', 'bolt', 'aura', 'utility', 'summoning'];
    }
    
    setEntityFactory(factory) {
        this.entityFactory = factory;
    }
    
    show(container, entityFactory) {
        if (entityFactory) this.entityFactory = entityFactory;
        
        // Create form container
        const form = document.createElement('div');
        form.className = 'spell-creator-form';
        form.style.maxHeight = '80vh';
        form.style.overflowY = 'auto';
        form.style.padding = '10px';
        
        // Create header
        const header = document.createElement('h3');
        header.textContent = 'Spell Creator';
        header.style.color = '#bb99ff';
        header.style.marginBottom = '15px';
        form.appendChild(header);
        
        // Add spell selector
        this.addSpellSelector(form);
        
        // Create spell fields
        this.addBasicFields(form);
        
        // Add preview section
        this.addPreviewSection(form);
        
        // Add buttons
        this.addButtons(form);
        
        container.appendChild(form);
    }
    
    addSpellSelector(form) {
        // Container for template selector
        const section = document.createElement('div');
        section.style.marginBottom = '20px';
        section.style.padding = '10px';
        section.style.backgroundColor = 'rgba(60, 40, 90, 0.2)';
        section.style.border = '1px solid #774488';
        section.style.borderRadius = '5px';
        
        // Create label
        const label = document.createElement('label');
        label.textContent = 'Load existing spell:';
        label.style.fontWeight = 'bold';
        label.style.display = 'block';
        label.style.marginBottom = '5px';
        
        // Create dropdown
        const select = document.createElement('select');
        select.id = 'spell-selector';
        select.style.width = '100%';
        select.style.padding = '8px';
        select.style.margin = '5px 0';
        select.style.backgroundColor = 'rgba(40, 40, 60, 0.7)';
        select.style.color = '#fff';
        select.style.border = '1px solid #555';
        select.style.borderRadius = '3px';
        
        // Add default option
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = '-- Select a spell --';
        select.appendChild(defaultOption);
        
        // Get spells from different possible sources
        let spells = this.getSpellbooks();
        
        if (spells) {
            // Sort spells alphabetically
            const sortedSpells = Object.entries(spells)
                .map(([id, spell]) => ({ id, name: spell.name || spell.spellName || id }))
                .sort((a, b) => a.name.localeCompare(b.name));
            
            // Add spell options to dropdown
            sortedSpells.forEach(({ id, name }) => {
                const option = document.createElement('option');
                option.value = id;
                option.textContent = name;
                select.appendChild(option);
            });
        }
        
        // Create load button
        const loadBtn = document.createElement('button');
        loadBtn.textContent = 'Load Spell';
        loadBtn.style.width = '100%';
        loadBtn.style.padding = '8px';
        loadBtn.style.margin = '5px 0';
        loadBtn.style.backgroundColor = '#7755cc';
        loadBtn.style.color = '#fff';
        loadBtn.style.border = 'none';
        loadBtn.style.borderRadius = '3px';
        loadBtn.style.cursor = 'pointer';
        
        // Load button click handler
        loadBtn.addEventListener('click', () => {
            const spellId = select.value;
            if (!spellId) {
                alert('Please select a spell to load');
                return;
            }
            
            const spell = spells[spellId];
            if (spell) {
                this.populateForm(form, spell);
            } else {
                alert('Error: Could not find the selected spell');
            }
        });
        
        // Create duplicate button
        const dupBtn = document.createElement('button');
        dupBtn.textContent = 'Duplicate & Modify';
        dupBtn.style.width = '100%';
        dupBtn.style.padding = '8px';
        dupBtn.style.margin = '5px 0';
        dupBtn.style.backgroundColor = '#775599';
        dupBtn.style.color = '#fff';
        dupBtn.style.border = 'none';
        dupBtn.style.borderRadius = '3px';
        dupBtn.style.cursor = 'pointer';
        
        // Duplicate button click handler
        dupBtn.addEventListener('click', () => {
            const spellId = select.value;
            if (!spellId) {
                alert('Please select a spell to duplicate');
                return;
            }
            
            const spell = spells[spellId];
            if (spell) {
                // Create duplicate with modified ID
                const duplicate = JSON.parse(JSON.stringify(spell));
                duplicate.id = `${spell.id}_copy`;
                duplicate.name = `${spell.name} (Copy)`;
                duplicate.spellId = `${spell.spellId || spell.id}_copy`;
                duplicate.spellName = `${spell.spellName || spell.name} (Copy)`;
                
                // Populate form with duplicate
                this.populateForm(form, duplicate);
            } else {
                alert('Error: Could not find the selected spell');
            }
        });
        
        // Add elements to container
        section.appendChild(label);
        section.appendChild(select);
        section.appendChild(loadBtn);
        section.appendChild(dupBtn);
        form.appendChild(section);
    }
    
    addBasicFields(form) {
        // Create fieldset
        const fieldset = document.createElement('fieldset');
        fieldset.style.border = '1px solid #444';
        fieldset.style.borderRadius = '5px';
        fieldset.style.padding = '15px';
        fieldset.style.marginBottom = '15px';
        
        // Create legend
        const legend = document.createElement('legend');
        legend.textContent = 'Spell Properties';
        legend.style.color = '#bb99ff';
        legend.style.padding = '0 10px';
        fieldset.appendChild(legend);
        
        // Create grid layout
        const grid = document.createElement('div');
        grid.style.display = 'grid';
        grid.style.gridTemplateColumns = 'auto 1fr';
        grid.style.gap = '10px';
        grid.style.alignItems = 'center';
        
        // Define fields
        const fields = [
            { name: 'id', label: 'ID', placeholder: 'unique_spell_id', required: true },
            { name: 'name', label: 'Spellbook Name', placeholder: 'Spell Name', required: true },
            { name: 'spellId', label: 'Spell ID', placeholder: 'spell_id', required: true },
            { name: 'spellName', label: 'Spell Name', placeholder: 'Spell Name', required: true },
            { name: 'char', label: 'Character', placeholder: '+', required: true },
            { name: 'color', label: 'Color', placeholder: '#ff4500', type: 'color', required: true },
            { name: 'description', label: 'Description', placeholder: 'Describe the spell...', required: true },
            { name: 'element', label: 'Element', type: 'select', options: this.elements, required: true },
            { name: 'manaCost', label: 'Mana Cost', type: 'number', placeholder: '10', required: true },
            { name: 'baseDamage', label: 'Base Damage', type: 'number', placeholder: '8' },
            { name: 'range', label: 'Range', type: 'number', placeholder: '5' },
            { name: 'aoeRadius', label: 'AoE Radius', type: 'number', placeholder: '2' },
            { name: 'duration', label: 'Duration', type: 'number', placeholder: '10' },
            { name: 'price', label: 'Value (Gold)', type: 'number', placeholder: '100', required: true }
        ];
        
        // Create fields
        fields.forEach(field => {
            // Create label
            const label = document.createElement('label');
            label.textContent = field.label + (field.required ? ' *' : '');
            label.style.fontWeight = 'bold';
            
            // Create input
            let input;
            if (field.type === 'select') {
                input = document.createElement('select');
                field.options.forEach(option => {
                    const opt = document.createElement('option');
                    opt.value = option;
                    opt.textContent = option.charAt(0).toUpperCase() + option.slice(1);
                    input.appendChild(opt);
                });
            } else {
                input = document.createElement('input');
                input.type = field.type || 'text';
                input.placeholder = field.placeholder || '';
            }
            
            input.name = field.name;
            input.id = field.name;
            input.required = field.required;
            input.style.padding = '8px';
            input.style.backgroundColor = 'rgba(40, 40, 60, 0.7)';
            input.style.color = '#fff';
            input.style.border = '1px solid #555';
            input.style.borderRadius = '3px';
            input.style.width = '100%';
            
            // Add to grid
            grid.appendChild(label);
            grid.appendChild(input);
        });
        
        // Add effects section
        this.addEffectsSection(grid);
        
        // Add tags section
        this.addTagsSection(grid);
        
        fieldset.appendChild(grid);
        form.appendChild(fieldset);
    }
    
    addEffectsSection(container) {
        // Label for effects
        const label = document.createElement('label');
        label.textContent = 'Effects:';
        label.style.fontWeight = 'bold';
        label.style.gridColumn = '1 / 3';
        label.style.marginTop = '10px';
        container.appendChild(label);
        
        // Container for checkboxes
        const effectsContainer = document.createElement('div');
        effectsContainer.style.display = 'grid';
        effectsContainer.style.gridTemplateColumns = 'repeat(3, 1fr)';
        effectsContainer.style.gap = '5px';
        effectsContainer.style.gridColumn = '1 / 3';
        effectsContainer.style.padding = '5px';
        effectsContainer.style.marginBottom = '10px';
        effectsContainer.style.backgroundColor = 'rgba(40, 40, 60, 0.3)';
        effectsContainer.style.borderRadius = '3px';
        
        // Create checkbox for each effect
        this.effects.forEach(effect => {
            const div = document.createElement('div');
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `effect_${effect}`;
            checkbox.name = `effect_${effect}`;
            
            const checkLabel = document.createElement('label');
            checkLabel.htmlFor = `effect_${effect}`;
            checkLabel.textContent = effect.replace('_', ' ');
            checkLabel.style.marginLeft = '5px';
            
            div.appendChild(checkbox);
            div.appendChild(checkLabel);
            effectsContainer.appendChild(div);
        });
        
        container.appendChild(effectsContainer);
    }
    
    addTagsSection(container) {
        // Label for tags
        const label = document.createElement('label');
        label.textContent = 'Tags:';
        label.style.fontWeight = 'bold';
        label.style.gridColumn = '1 / 3';
        container.appendChild(label);
        
        // Container for checkboxes
        const tagsContainer = document.createElement('div');
        tagsContainer.style.display = 'grid';
        tagsContainer.style.gridTemplateColumns = 'repeat(3, 1fr)';
        tagsContainer.style.gap = '5px';
        tagsContainer.style.gridColumn = '1 / 3';
        tagsContainer.style.padding = '5px';
        tagsContainer.style.marginBottom = '10px';
        tagsContainer.style.backgroundColor = 'rgba(40, 40, 60, 0.3)';
        tagsContainer.style.borderRadius = '3px';
        
        // Create checkbox for each tag
        this.tags.forEach(tag => {
            const div = document.createElement('div');
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `tag_${tag}`;
            checkbox.name = `tag_${tag}`;
            
            const checkLabel = document.createElement('label');
            checkLabel.htmlFor = `tag_${tag}`;
            checkLabel.textContent = tag;
            checkLabel.style.marginLeft = '5px';
            
            div.appendChild(checkbox);
            div.appendChild(checkLabel);
            tagsContainer.appendChild(div);
        });
        
        container.appendChild(tagsContainer);
    }
    
    addPreviewSection(form) {
        // Container
        const section = document.createElement('div');
        section.style.marginBottom = '20px';
        section.style.padding = '10px';
        section.style.backgroundColor = 'rgba(30, 30, 40, 0.7)';
        section.style.borderRadius = '5px';
        
        // Header
        const header = document.createElement('h4');
        header.textContent = 'JSON Preview';
        header.style.color = '#ffcc99';
        header.style.marginBottom = '10px';
        
        // Textarea
        const preview = document.createElement('textarea');
        preview.id = 'json-preview';
        preview.readOnly = true;
        preview.style.width = '100%';
        preview.style.height = '150px';
        preview.style.padding = '8px';
        preview.style.backgroundColor = 'rgba(20, 20, 30, 0.7)';
        preview.style.color = '#fff';
        preview.style.border = '1px solid #555';
        preview.style.borderRadius = '3px';
        preview.style.fontFamily = 'monospace';
        
        // Add elements to section
        section.appendChild(header);
        section.appendChild(preview);
        form.appendChild(section);
        
        // Add event listeners to update preview
        form.querySelectorAll('input, select').forEach(input => {
            input.addEventListener('input', () => this.updatePreview(form));
            input.addEventListener('change', () => this.updatePreview(form));
        });
    }
    
    addButtons(form) {
        // Container
        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.justifyContent = 'space-between';
        container.style.marginTop = '20px';
        
        // Reset button
        const resetBtn = document.createElement('button');
        resetBtn.textContent = 'Reset Form';
        resetBtn.style.padding = '8px 16px';
        resetBtn.style.backgroundColor = '#aa6622';
        resetBtn.style.color = '#fff';
        resetBtn.style.border = 'none';
        resetBtn.style.borderRadius = '3px';
        resetBtn.style.cursor = 'pointer';
        resetBtn.addEventListener('click', () => this.resetForm(form));
        
        // Create button
        const createBtn = document.createElement('button');
        createBtn.textContent = 'Create Spell';
        createBtn.style.padding = '8px 16px';
        createBtn.style.backgroundColor = '#22aa66';
        createBtn.style.color = '#fff';
        createBtn.style.border = 'none';
        createBtn.style.borderRadius = '3px';
        createBtn.style.cursor = 'pointer';
        createBtn.addEventListener('click', () => this.createSpell(form, false));
        
        // Create & Learn button
        const learnBtn = document.createElement('button');
        learnBtn.textContent = 'Create & Learn';
        learnBtn.style.padding = '8px 16px';
        learnBtn.style.backgroundColor = '#2266aa';
        learnBtn.style.color = '#fff';
        learnBtn.style.border = 'none';
        learnBtn.style.borderRadius = '3px';
        learnBtn.style.cursor = 'pointer';
        learnBtn.addEventListener('click', () => this.createSpell(form, true));
        
        // Add buttons to container
        container.appendChild(resetBtn);
        container.appendChild(createBtn);
        container.appendChild(learnBtn);
        form.appendChild(container);
    }
    
    getSpellbooks() {
        // Try to get spells from entityFactory
        if (this.entityFactory && this.entityFactory.spellbookTemplates) {
            return this.entityFactory.spellbookTemplates;
        }
        
        // Try to get from window.game
        if (window.game && window.game.entityFactory && window.game.entityFactory.spellbookTemplates) {
            return window.game.entityFactory.spellbookTemplates;
        }
        
        // Try to get from gameState
        if (gameState.data && gameState.data.spellbooks) {
            const templates = {};
            gameState.data.spellbooks.forEach(spell => {
                templates[spell.id] = spell;
            });
            return templates;
        }
        
        console.warn('Could not find any spell templates');
        return null;
    }
    
    populateForm(form, spellData) {
        console.log('Loading spell data:', spellData);
        
        // Set basic fields
        Object.entries(spellData).forEach(([key, value]) => {
            const input = form.querySelector(`#${key}`);
            if (input) {
                if (input.type === 'checkbox') {
                    input.checked = !!value;
                } else {
                    input.value = value;
                }
            }
        });
        
        // Clear all checkboxes first
        form.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.checked = false;
        });
        
        // Set effects checkboxes
        if (spellData.effects && Array.isArray(spellData.effects)) {
            spellData.effects.forEach(effect => {
                const checkbox = form.querySelector(`#effect_${effect}`);
                if (checkbox) checkbox.checked = true;
            });
        }
        
        // Set tags checkboxes
        if (spellData.tags && Array.isArray(spellData.tags)) {
            spellData.tags.forEach(tag => {
                const checkbox = form.querySelector(`#tag_${tag}`);
                if (checkbox) checkbox.checked = true;
            });
        }
        
        // Update preview
        this.updatePreview(form);
    }
    
    updatePreview(form) {
        const formData = this.getFormData(form);
        const jsonString = JSON.stringify(formData, null, 2);
        const preview = form.querySelector('#json-preview');
        if (preview) preview.value = jsonString;
    }
    
    getFormData(form) {
        const formData = {};
        
        // Get text, number, and select inputs
        form.querySelectorAll('input:not([type="checkbox"]), select').forEach(input => {
            if (input.name && input.name !== 'spell-selector') {
                if (input.type === 'number' && input.value) {
                    formData[input.name] = parseFloat(input.value);
                } else if (input.value) {
                    formData[input.name] = input.value;
                }
            }
        });
        
        // Add type property
        formData.type = 'spellbook';
        
        // Get effects
        const effects = [];
        form.querySelectorAll('input[id^="effect_"]').forEach(checkbox => {
            if (checkbox.checked) {
                effects.push(checkbox.id.replace('effect_', ''));
            }
        });
        if (effects.length > 0) {
            formData.effects = effects;
        }
        
        // Get tags
        const tags = [];
        form.querySelectorAll('input[id^="tag_"]').forEach(checkbox => {
            if (checkbox.checked) {
                tags.push(checkbox.id.replace('tag_', ''));
            }
        });
        if (tags.length > 0) {
            formData.tags = tags;
        }
        
        return formData;
    }
    
    resetForm(form) {
        // Reset all inputs
        form.querySelectorAll('input, select').forEach(input => {
            if (input.type === 'checkbox') {
                input.checked = false;
            } else {
                input.value = '';
            }
        });
        
        // Reset preview
        const preview = form.querySelector('#json-preview');
        if (preview) preview.value = '';
    }
    
    createSpell(form, learnSpell) {
        // Get form data
        const formData = this.getFormData(form);
        
        // Validate required fields
        const requiredFields = ['id', 'name', 'spellId', 'spellName', 'char', 'color', 'description', 'element', 'manaCost', 'price'];
        const missingFields = requiredFields.filter(field => !formData[field]);
        
        if (missingFields.length > 0) {
            alert(`Missing required fields: ${missingFields.join(', ')}`);
            return;
        }
        
        // Get factory for adding the spell
        const factory = this.entityFactory || window.game?.entityFactory;
        if (!factory) {
            alert('Error: Could not access entity factory');
            return;
        }
        
        // Check if spell already exists
        if (factory.spellbookTemplates && factory.spellbookTemplates[formData.id]) {
            if (!confirm(`A spell with ID "${formData.id}" already exists. Overwrite it?`)) {
                return;
            }
        }
        
        // Add to templates
        factory.spellbookTemplates[formData.id] = formData;
        
        // Create spell object
        const spell = {
            id: formData.spellId,
            name: formData.spellName,
            element: formData.element,
            manaCost: formData.manaCost,
            baseDamage: formData.baseDamage || 0,
            range: formData.range || 0,
            aoeRadius: formData.aoeRadius || 0,
            duration: formData.duration || 0,
            effects: formData.effects || [],
            tags: formData.tags || [],
            description: formData.description
        };
        
        // Register the spell implementation with spellLogic
        this.registerSpellImplementation(formData.spellId, spell);
        
        // Add success message
        gameState.addMessage(`Spell template "${formData.name}" created successfully!`, "important");
        
        if (learnSpell) {
            // Get player
            const player = gameState.player;
            if (!player || !player.hasComponent('SpellsComponent')) {
                alert('Error: Player does not have spell capability');
                return;
            }
            
            // Learn the spell
            player.getComponent('SpellsComponent').learnSpell(formData.spellId, spell);
            
            // Add message
            gameState.addMessage(`Learned spell: ${formData.spellName}`, "important");
            
            // Close creator
            eventBus.emit('hideCreator');
        }
    }
    
    /**
     * Register a spell implementation with the spell logic system
     * @param {string} spellId - The ID of the spell
     * @param {object} spell - The spell data
     */
    registerSpellImplementation(spellId, spell) {
        // Check if implementation already exists
        if (spellLogic.hasSpell(spellId)) {
            console.log(`Spell implementation for ${spellId} already exists, updating...`);
        }
        
        // Determine spell type based on properties and tags
        let spellType;
        if (spell.tags && spell.tags.includes('bolt')) {
            spellType = 'bolt';
        } else if (spell.tags && spell.tags.includes('area')) {
            spellType = 'area';
        } else if (spell.aoeRadius && spell.aoeRadius > 0) {
            spellType = 'area';  // Fallback to area if it has an aoe radius
        } else if (spell.range && spell.range > 1) {
            spellType = 'bolt';  // Fallback to bolt if it has range > 1
        } else {
            spellType = 'self';  // Default to self-cast
        }
        
        console.log(`Creating implementation for ${spellId} as type: ${spellType}`);
        
        let implementation;
        
        // Create implementation based on determined type
        if (spellType === 'bolt') {
            // Use bolt spell creator for bolt spells
            implementation = {
                targetType: 'entity',
                targetingType: 'entity',
                target: function(spellData, callback) {
                    gameState.addMessage(`Select a target for your ${spellData.name}. Press ESC to cancel.`, "important");
                    
                    // Set targeting data
                    spellData.range = spellData.range || 6;
                    
                    // Use the targeting system
                    targetingSystem.startTargeting(spellData, callback);
                },
                cast: function(spellData, target) {
                    if (!target) return false;
                    
                    const player = gameState.player;
                    const mana = player.getComponent('ManaComponent');
                    
                    // Deduct mana
                    if (mana && mana.mana >= spellData.manaCost) {
                        mana.mana -= spellData.manaCost;
                    } else {
                        gameState.addMessage("You don't have enough mana.");
                        return false;
                    }
                    
                    // Find the targeted entity
                    const entity = Array.from(gameState.entities.values()).find(e => {
                        if (e.hasComponent('PositionComponent')) {
                            const pos = e.getComponent('PositionComponent');
                            return pos.x === target.x && pos.y === target.y;
                        }
                        return false;
                    });
                    
                    if (entity && entity.hasComponent('HealthComponent')) {
                        // Apply damage if entity exists
                        const health = entity.getComponent('HealthComponent');
                        const damage = spellData.baseDamage || 10;
                        
                        health.takeDamage(damage, 'magic', {
                            sourceEntity: player,
                            element: spellData.element
                        });
                        
                        gameState.addMessage(`Your ${spellData.name} hits ${entity.name} for ${damage} damage!`);
                        
                        // Create visual effect (bolt hitting target)
                        if (gameState.renderSystem) {
                            const playerPos = player.getComponent('PositionComponent');
                            
                            // Bolt traveling effect
                            gameState.renderSystem.createSpellEffect('bolt', spellData.element || 'arcane', {
                                sourceX: playerPos.x,
                                sourceY: playerPos.y,
                                targetX: target.x,
                                targetY: target.y,
                                duration: 300
                            });
                            
                            // Impact effect
                            setTimeout(() => {
                                gameState.renderSystem.createSpellEffect('impact', spellData.element || 'arcane', {
                                    x: target.x,
                                    y: target.y,
                                    duration: 300
                                });
                            }, 300);
                        }
                    } else {
                        // Miss message
                        gameState.addMessage(`Your ${spellData.name} hits nothing.`);
                    }
                    
                    return true;
                }
            };
        } else if (spellType === 'area') {
            // Basic area effect implementation
            implementation = {
                targetType: 'location',
                targetingType: 'location',
                target: function(spellData, callback) {
                    gameState.addMessage(`Choose a location for your ${spellData.name}. Press ESC to cancel.`, "important");
                    // Make sure the spell has necessary properties
                    spellData.range = spellData.range || 6;
                    spellData.aoeRadius = spellData.aoeRadius || 2;
                    
                    // Use the targeting system to handle targeting
                    targetingSystem.startTargeting(spellData, callback);
                },
                cast: function(spellData, target) {
                    if (!target) return false;
                    
                    console.log(`Casting area spell ${spellData.name} at target:`, target);
                    
                    const player = gameState.player;
                    const mana = player.getComponent('ManaComponent');
                    
                    // Deduct mana
                    if (mana && mana.mana >= spellData.manaCost) {
                        mana.mana -= spellData.manaCost;
                    } else {
                        gameState.addMessage("You don't have enough mana.");
                        return false;
                    }
                    
                    // Get entities in the affected area
                    const entitiesInRange = Array.from(gameState.entities.values()).filter(entity => {
                        if (entity.id === player.id) return false; // Skip player
                        if (!entity.hasComponent('PositionComponent') || !entity.hasComponent('HealthComponent')) return false;
                        
                        const pos = entity.getComponent('PositionComponent');
                        const dx = Math.abs(pos.x - target.x);
                        const dy = Math.abs(pos.y - target.y);
                        return Math.max(dx, dy) <= (spellData.aoeRadius || 2);
                    });
                    
                    console.log(`Found ${entitiesInRange.length} entities in range for ${spellData.name}`);
                    
                    // Apply damage to each entity
                    entitiesInRange.forEach(entity => {
                        const health = entity.getComponent('HealthComponent');
                        const damage = spellData.baseDamage || 10;
                        
                        health.takeDamage(damage, 'magic', {
                            sourceEntity: player,
                            element: spellData.element
                        });
                        
                        gameState.addMessage(`Your ${spellData.name} hits ${entity.name} for ${damage} damage!`);
                    });
                    
                    // Show visual effects
                    if (gameState.renderSystem) {
                        const playerPos = player.getComponent('PositionComponent');
                        
                        // Create projectile effect first
                        gameState.renderSystem.createSpellEffect('bolt', spellData.element || 'arcane', {
                            sourceX: playerPos.x,
                            sourceY: playerPos.y,
                            targetX: target.x,
                            targetY: target.y,
                            duration: 300
                        });
                        
                        // Then explosion effect with delay
                        setTimeout(() => {
                            // Explosion effect
                            gameState.renderSystem.createSpellEffect('impact', spellData.element || 'arcane', {
                                x: target.x,
                                y: target.y,
                                radius: spellData.aoeRadius || 2,
                                duration: 500
                            });
                            
                            // Wave effect
                            gameState.renderSystem.createSpellEffect('wave', spellData.element || 'arcane', {
                                x: target.x,
                                y: target.y,
                                radius: spellData.aoeRadius || 2,
                                duration: 400
                            });
                        }, 300);
                    }
                    
                    return true;
                }
            };
        } else {
            // Default implementation for self-targeting spells
            implementation = {
                targetType: 'self',
                cast: function(spellData) {
                    const player = gameState.player;
                    const mana = player.getComponent('ManaComponent');
                    
                    // Deduct mana
                    if (mana && mana.mana >= spellData.manaCost) {
                        mana.mana -= spellData.manaCost;
                    } else {
                        gameState.addMessage("You don't have enough mana.");
                        return false;
                    }
                    
                    // Apply a basic effect
                    gameState.addMessage(`You cast ${spellData.name}!`);
                    
                    // Show a visual effect around the player
                    const playerPos = player.getComponent('PositionComponent');
                    if (playerPos && gameState.renderSystem) {
                        gameState.renderSystem.createSpellEffect('pulse', spellData.element || 'arcane', {
                            x: playerPos.x,
                            y: playerPos.y,
                            radius: 2,
                            duration: 500
                        });
                    }
                    
                    return true;
                }
            };
        }
        
        // Register the implementation
        spellLogic.registerSpell(spellId, implementation);
        console.log(`Registered spell implementation for: ${spellId}`);
    }
}

export default new SpellCreator();
