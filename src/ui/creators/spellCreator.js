// ui/creators/spellCreator.js
import gameState from '../../core/gameState.js';
import eventBus from '../../core/eventEmitter.js';

class SpellCreator {
    constructor() {
        this.entityFactory = null;
        
        // Bind methods
        this.show = this.show.bind(this);
        this.createSpellTemplate = this.createSpellTemplate.bind(this);
        this.finalizeSpellCreation = this.finalizeSpellCreation.bind(this);
        this.updateSpellPreview = this.updateSpellPreview.bind(this);
    }
    
    setEntityFactory(factory) {
        this.entityFactory = factory;
    }
    
    show(container, entityFactory) {
        if (entityFactory && !this.entityFactory) {
            this.entityFactory = entityFactory;
        }
        
        const form = document.createElement('div');
        form.className = 'spell-creator-form';
        
        // Header
        const header = document.createElement('h3');
        header.textContent = 'Create New Spell';
        header.style.color = '#bb99ff';
        header.style.marginBottom = '15px';
        form.appendChild(header);
        
        // Create inputs for basic properties
        const fields = [
            // Basic Information
            { name: 'id', label: 'ID', placeholder: 'unique_spell_id', required: true },
            { name: 'name', label: 'Spellbook Name', placeholder: 'Fireball Spellbook', required: true },
            { name: 'char', label: 'Character', placeholder: '+', required: true },
            { name: 'color', label: 'Color', placeholder: '#ff4500', required: true, type: 'color' },
            { name: 'type', label: 'Type', value: 'spellbook', required: true, type: 'hidden' },
            { name: 'spellId', label: 'Spell ID', placeholder: 'fireball', required: true },
            { name: 'spellName', label: 'Spell Name', placeholder: 'Fireball', required: true },
            { name: 'description', label: 'Description', placeholder: 'Launches a ball of fire...', required: true },
            { 
                name: 'element', 
                label: 'Element', 
                type: 'select', 
                options: ['fire', 'ice', 'lightning', 'arcane', 'nature', 'holy', 'shadow'], 
                required: true 
            },
            
            // Mechanics
            { name: 'manaCost', label: 'Mana Cost', type: 'number', placeholder: '10', required: true },
            { name: 'baseDamage', label: 'Base Damage', type: 'number', placeholder: '0' },
            { name: 'range', label: 'Range', type: 'number', placeholder: '5', required: true },
            { name: 'aoeRadius', label: 'AoE Radius', type: 'number', placeholder: '0' },
            { name: 'duration', label: 'Duration (turns)', type: 'number', placeholder: '0' },
            { name: 'turnCost', label: 'Turn Cost', type: 'number', placeholder: '1', required: true },
            { name: 'price', label: 'Value (Gold)', type: 'number', placeholder: '100', required: true }
        ];
        
        // Create form fields
        const fieldContainer = document.createElement('div');
        fieldContainer.className = 'form-fields';
        fieldContainer.style.display = 'grid';
        fieldContainer.style.gridTemplateColumns = 'auto 1fr';
        fieldContainer.style.gap = '10px';
        fieldContainer.style.alignItems = 'center';
        
        fields.forEach(field => {
            // Skip hidden fields for the form layout
            if (field.type === 'hidden') {
                const hiddenInput = document.createElement('input');
                hiddenInput.type = 'hidden';
                hiddenInput.name = field.name;
                hiddenInput.value = field.value || '';
                fieldContainer.appendChild(hiddenInput);
                return;
            }
            
            const label = document.createElement('label');
            label.textContent = field.label + (field.required ? ' *' : '');
            label.style.fontWeight = 'bold';
            
            let input;
            if (field.type === 'select') {
                input = document.createElement('select');
                input.name = field.name;
                input.required = field.required;
                field.options.forEach(option => {
                    const optElement = document.createElement('option');
                    optElement.value = option;
                    optElement.textContent = option.charAt(0).toUpperCase() + option.slice(1);
                    input.appendChild(optElement);
                });
            } else if (field.type === 'checkbox') {
                input = document.createElement('input');
                input.type = 'checkbox';
                input.name = field.name;
            } else {
                input = document.createElement('input');
                input.type = field.type || 'text';
                input.name = field.name;
                input.placeholder = field.placeholder || '';
                input.required = field.required;
                if (field.type === 'number') input.min = 0;
            }
            
            input.style.padding = '5px';
            input.style.backgroundColor = 'rgba(40, 40, 60, 0.7)';
            input.style.border = '1px solid #555';
            input.style.borderRadius = '3px';
            input.style.color = '#fff';
            
            fieldContainer.appendChild(label);
            fieldContainer.appendChild(input);
        });
        
        form.appendChild(fieldContainer);
        
        // Add effects section
        const effectsSection = document.createElement('div');
        effectsSection.className = 'effects-section';
        effectsSection.style.marginTop = '20px';
        
        const effectsHeader = document.createElement('h4');
        effectsHeader.textContent = 'Spell Effects';
        effectsHeader.style.color = '#99dd99';
        effectsHeader.style.marginBottom = '10px';
        effectsSection.appendChild(effectsHeader);
        
        const effectsContainer = document.createElement('div');
        effectsContainer.style.display = 'grid';
        effectsContainer.style.gridTemplateColumns = 'repeat(3, 1fr)';
        effectsContainer.style.gap = '10px';
        
        const effectOptions = [
            { id: 'damage', label: 'Damage' },
            { id: 'heal', label: 'Healing' },
            { id: 'buff', label: 'Buff' },
            { id: 'debuff', label: 'Debuff' },
            { id: 'summon', label: 'Summon' },
            { id: 'area_effect', label: 'Area Effect' },
            { id: 'stun', label: 'Stun' },
            { id: 'teleport', label: 'Teleport' },
            { id: 'dot', label: 'Damage Over Time' }
        ];
        
        effectOptions.forEach(effect => {
            const effectDiv = document.createElement('div');
            effectDiv.style.display = 'flex';
            effectDiv.style.alignItems = 'center';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `effect_${effect.id}`;
            checkbox.name = `effect_${effect.id}`;
            checkbox.style.marginRight = '5px';
            
            const label = document.createElement('label');
            label.htmlFor = `effect_${effect.id}`;
            label.textContent = effect.label;
            
            effectDiv.appendChild(checkbox);
            effectDiv.appendChild(label);
            effectsContainer.appendChild(effectDiv);
        });
        
        effectsSection.appendChild(effectsContainer);
        form.appendChild(effectsSection);
        
        // Add tags section
        const tagsSection = document.createElement('div');
        tagsSection.className = 'tags-section';
        tagsSection.style.marginTop = '20px';
        
        const tagsHeader = document.createElement('h4');
        tagsHeader.textContent = 'Spell Tags';
        tagsHeader.style.color = '#99dd99';
        tagsHeader.style.marginBottom = '10px';
        tagsSection.appendChild(tagsHeader);
        
        const tagsContainer = document.createElement('div');
        tagsContainer.style.display = 'grid';
        tagsContainer.style.gridTemplateColumns = 'repeat(3, 1fr)';
        tagsContainer.style.gap = '10px';
        
        const tagOptions = [
            { id: 'attack', label: 'Attack' },
            { id: 'defense', label: 'Defense' },
            { id: 'utility', label: 'Utility' },
            { id: 'aoe', label: 'Area' },
            { id: 'target', label: 'Target' },
            { id: 'self', label: 'Self' }
        ];
        
        tagOptions.forEach(tag => {
            const tagDiv = document.createElement('div');
            tagDiv.style.display = 'flex';
            tagDiv.style.alignItems = 'center';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `tag_${tag.id}`;
            checkbox.name = `tag_${tag.id}`;
            checkbox.style.marginRight = '5px';
            
            const label = document.createElement('label');
            label.htmlFor = `tag_${tag.id}`;
            label.textContent = tag.label;
            
            tagDiv.appendChild(checkbox);
            tagDiv.appendChild(label);
            tagsContainer.appendChild(tagDiv);
        });
        
        tagsSection.appendChild(tagsContainer);
        form.appendChild(tagsSection);
        
        // Add preview section
        const previewSection = document.createElement('div');
        previewSection.className = 'spell-preview-section';
        previewSection.style.marginTop = '20px';
        previewSection.style.backgroundColor = 'rgba(30, 30, 40, 0.7)';
        previewSection.style.padding = '10px';
        previewSection.style.borderRadius = '5px';
        
        const previewHeader = document.createElement('h4');
        previewHeader.textContent = 'JSON Preview';
        previewHeader.style.color = '#ffcc99';
        previewHeader.style.marginBottom = '10px';
        previewSection.appendChild(previewHeader);
        
        const previewTextarea = document.createElement('textarea');
        previewTextarea.id = 'spell-json-preview';
        previewTextarea.readOnly = true;
        previewTextarea.style.width = '100%';
        previewTextarea.style.height = '150px';
        previewTextarea.style.backgroundColor = 'rgba(30, 30, 40, 0.7)';
        previewTextarea.style.border = '1px solid #555';
        previewTextarea.style.borderRadius = '3px';
        previewTextarea.style.padding = '10px';
        previewTextarea.style.color = '#fff';
        previewTextarea.style.fontFamily = 'monospace';
        previewSection.appendChild(previewTextarea);
        
        form.appendChild(previewSection);
        
        // Add action buttons
        const buttonContainer = document.createElement('div');
        buttonContainer.style.display = 'flex';
        buttonContainer.style.justifyContent = 'space-between';
        buttonContainer.style.marginTop = '20px';
        
        const createButton = document.createElement('button');
        createButton.textContent = 'Create Spell';
        createButton.style.padding = '8px 16px';
        createButton.style.backgroundColor = '#2a6';
        createButton.style.border = 'none';
        createButton.style.borderRadius = '3px';
        createButton.style.color = '#fff';
        createButton.style.cursor = 'pointer';
        createButton.addEventListener('click', () => this.createSpellTemplate(form));
        
        const spawnButton = document.createElement('button');
        spawnButton.textContent = 'Create & Learn';
        spawnButton.style.padding = '8px 16px';
        spawnButton.style.backgroundColor = '#26a';
        spawnButton.style.border = 'none';
        spawnButton.style.borderRadius = '3px';
        spawnButton.style.color = '#fff';
        spawnButton.style.cursor = 'pointer';
        spawnButton.addEventListener('click', () => {
            const result = this.createSpellTemplate(form, true);
            if (!result) return;
            setTimeout(() => eventBus.emit('hideCreator'), 200);
        });
        
        const resetButton = document.createElement('button');
        resetButton.textContent = 'Reset Form';
        resetButton.style.padding = '8px 16px';
        resetButton.style.backgroundColor = '#a62';
        resetButton.style.border = 'none';
        resetButton.style.borderRadius = '3px';
        resetButton.style.color = '#fff';
        resetButton.style.cursor = 'pointer';
        resetButton.addEventListener('click', () => {
            form.querySelectorAll('input, select').forEach(input => {
                if (input.type === 'checkbox') input.checked = false;
                else input.value = '';
            });
            this.updateSpellPreview(form);
        });
        
        buttonContainer.appendChild(resetButton);
        buttonContainer.appendChild(createButton);
        buttonContainer.appendChild(spawnButton);
        form.appendChild(buttonContainer);
        
        // Add event listeners to update preview
        form.querySelectorAll('input, select').forEach(input => {
            input.addEventListener('input', () => this.updateSpellPreview(form));
            input.addEventListener('change', () => this.updateSpellPreview(form));
        });
        
        container.appendChild(form);
        this.updateSpellPreview(form);
    }
    
    updateSpellPreview(form) {
        const formData = {};
        
        // Get basic fields
        form.querySelectorAll('input, select').forEach(input => {
            if (input.name.startsWith('effect_') || input.name.startsWith('tag_')) return;
            
            if (input.type === 'checkbox') formData[input.name] = input.checked;
            else if (input.type === 'number' && input.value) formData[input.name] = parseFloat(input.value);
            else if (input.value) formData[input.name] = input.value;
        });
        
        // Add effects
        const effects = [];
        form.querySelectorAll('input[name^="effect_"]').forEach(input => {
            if (input.checked) {
                effects.push(input.name.replace('effect_', ''));
            }
        });
        
        if (effects.length > 0) {
            formData.effects = effects;
        }
        
        // Add tags
        const tags = [];
        form.querySelectorAll('input[name^="tag_"]').forEach(input => {
            if (input.checked) {
                tags.push(input.name.replace('tag_', ''));
            }
        });
        
        if (tags.length > 0) {
            formData.tags = tags;
        }
        
        // Format JSON with indentation
        const jsonString = JSON.stringify(formData, null, 2);
        
        // Update preview
        const previewTextarea = form.querySelector('#spell-json-preview');
        if (previewTextarea) previewTextarea.value = jsonString;
    }
    
    createSpellTemplate(form, learnSpell = false) {
        const formData = {};
        
        // Get basic fields
        form.querySelectorAll('input, select').forEach(input => {
            if (input.name.startsWith('effect_') || input.name.startsWith('tag_')) return;
            
            if (input.type === 'checkbox') formData[input.name] = input.checked;
            else if (input.type === 'number' && input.value) formData[input.name] = parseFloat(input.value);
            else if (input.value) formData[input.name] = input.value;
        });
        
        // Validate required fields
        const requiredFields = ['id', 'name', 'char', 'color', 'type', 'spellId', 'spellName', 'element', 'manaCost', 'range', 'price'];
        const missingFields = requiredFields.filter(field => !formData[field]);
        
        if (missingFields.length > 0) {
            console.error(`Missing required fields: ${missingFields.join(', ')}`);
            
            const errorMsg = document.createElement('div');
            errorMsg.style.color = '#ff5555';
            errorMsg.style.marginBottom = '10px';
            errorMsg.style.padding = '5px';
            errorMsg.style.border = '1px solid #ff0000';
            errorMsg.style.backgroundColor = 'rgba(255, 0, 0, 0.1)';
            errorMsg.textContent = `Missing required fields: ${missingFields.join(', ')}`;
            
            if (form.firstChild) form.insertBefore(errorMsg, form.firstChild);
            else form.appendChild(errorMsg);
            
            setTimeout(() => {
                if (errorMsg.parentNode) errorMsg.parentNode.removeChild(errorMsg);
            }, 5000);
            
            return false;
        }
        
        // Add effects
        const effects = [];
        form.querySelectorAll('input[name^="effect_"]').forEach(input => {
            if (input.checked) {
                effects.push(input.name.replace('effect_', ''));
            }
        });
        
        if (effects.length > 0) {
            formData.effects = effects;
        }
        
        // Add tags
        const tags = [];
        form.querySelectorAll('input[name^="tag_"]').forEach(input => {
            if (input.checked) {
                tags.push(input.name.replace('tag_', ''));
            }
        });
        
        if (tags.length > 0) {
            formData.tags = tags;
        }
        
        // Check if spell ID already exists
        const factory = this.entityFactory || window.game?.entityFactory;
        if (factory?.spellbookTemplates[formData.id]) {
            const confirmDialog = document.createElement('div');
            confirmDialog.style.position = 'absolute';
            confirmDialog.style.top = '50%';
            confirmDialog.style.left = '50%';
            confirmDialog.style.transform = 'translate(-50%, -50%)';
            confirmDialog.style.backgroundColor = 'rgba(20, 20, 30, 0.95)';
            confirmDialog.style.border = '2px solid #666';
            confirmDialog.style.borderRadius = '5px';
            confirmDialog.style.padding = '20px';
            confirmDialog.style.zIndex = '1003';
            confirmDialog.style.width = '400px';
            confirmDialog.style.textAlign = 'center';
            
            const message = document.createElement('p');
            message.textContent = `A spell with ID "${formData.id}" already exists. Do you want to overwrite it?`;
            message.style.marginBottom = '20px';
            
            const buttonContainer = document.createElement('div');
            buttonContainer.style.display = 'flex';
            buttonContainer.style.justifyContent = 'space-around';
            
            const confirmBtn = document.createElement('button');
            confirmBtn.textContent = 'Overwrite';
            confirmBtn.style.padding = '8px 16px';
            confirmBtn.style.backgroundColor = '#2a6';
            confirmBtn.style.border = 'none';
            confirmBtn.style.borderRadius = '3px';
            confirmBtn.style.color = '#fff';
            confirmBtn.style.cursor = 'pointer';
            
            const cancelBtn = document.createElement('button');
            cancelBtn.textContent = 'Cancel';
            cancelBtn.style.padding = '8px 16px';
            cancelBtn.style.backgroundColor = '#a62';
            cancelBtn.style.border = 'none';
            cancelBtn.style.borderRadius = '3px';
            cancelBtn.style.color = '#fff';
            cancelBtn.style.cursor = 'pointer';
            
            buttonContainer.appendChild(cancelBtn);
            buttonContainer.appendChild(confirmBtn);
            
            confirmDialog.appendChild(message);
            confirmDialog.appendChild(buttonContainer);
            
            document.body.appendChild(confirmDialog);
            
            return new Promise(resolve => {
                confirmBtn.addEventListener('click', () => {
                    document.body.removeChild(confirmDialog);
                    resolve(true);
                });
                
                cancelBtn.addEventListener('click', () => {
                    document.body.removeChild(confirmDialog);
                    resolve(false);
                });
            }).then(result => {
                if (!result) return false;
                return this.finalizeSpellCreation(formData, learnSpell, form);
            });
        }
        
        return this.finalizeSpellCreation(formData, learnSpell, form);
    }
    
    finalizeSpellCreation(formData, learnSpell, form) {
        const factory = this.entityFactory || window.game?.entityFactory;
        
        if (factory) {
            // Add to spellbook templates
            factory.spellbookTemplates[formData.id] = formData;
            console.log(`Created spell template: ${formData.id}`);
            
            if (learnSpell) {
                const player = gameState.player;
                if (player && player.hasComponent('SpellsComponent')) {
                    // Create the spell object from the template
                    const spell = {
                        id: formData.spellId,
                        name: formData.spellName,
                        element: formData.element,
                        manaCost: formData.manaCost,
                        baseDamage: formData.baseDamage || 0,
                        range: formData.range,
                        aoeRadius: formData.aoeRadius || 0,
                        duration: formData.duration || 0,
                        turnCost: formData.turnCost || 1,
                        effects: formData.effects || [],
                        tags: formData.tags || [],
                        description: formData.description
                    };
                    
                    // Learn the spell directly
                    player.getComponent('SpellsComponent').learnSpell(formData.spellId, spell);
                    gameState.addMessage(`Learned spell: ${formData.spellName}`);
                    console.log(`Player learned spell: ${formData.spellId}`);
                    
                    // Add in-game notification
                    gameState.addMessage(`Spell "${formData.spellName}" has been added to your spellbook!`, "important");
                    
                    // Alternatively, create a spellbook item
                    /*
                    const item = factory.createSpellbook(
                        formData.id, 
                        player.position.x, 
                        player.position.y
                    );
                    
                    if (item) {
                        gameState.addEntity(item);
                        gameState.addMessage(`Created spellbook: ${formData.name}`);
                        console.log(`Spawned spellbook: ${formData.id}`);
                        
                        // Add in-game notification
                        gameState.addMessage(`Spellbook "${formData.name}" created and placed at your location!`, "important");
                    }
                    */
                    
                    // Close the creator UI
                    eventBus.emit('hideCreator');
                } else {
                    gameState.addMessage(`Error: Player not found or doesn't have spell capability!`, "error");
                }
            } else {
                // Add success message to game logs
                gameState.addMessage(`Spell "${formData.spellName}" created successfully!`, "important");
            }
            return true;
        } else {
            const errorMsg = document.createElement('div');
            errorMsg.style.color = '#ff5555';
            errorMsg.style.marginBottom = '10px';
            errorMsg.style.padding = '5px';
            errorMsg.style.border = '1px solid #ff0000';
            errorMsg.style.backgroundColor = 'rgba(255, 0, 0, 0.1)';
            errorMsg.textContent = 'Error: EntityFactory not found! Please reload the game.';
            
            if (form.firstChild) form.insertBefore(errorMsg, form.firstChild);
            else form.appendChild(errorMsg);
            
            setTimeout(() => {
                if (errorMsg.parentNode) errorMsg.parentNode.removeChild(errorMsg);
            }, 5000);
            
            console.error('EntityFactory not found when creating spell');
            return false;
        }
    }
}

export default new SpellCreator();
