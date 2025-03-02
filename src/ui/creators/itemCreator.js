// ui/creators/itemCreator.js
import gameState from '../../core/gameState.js';
import eventBus from '../../core/eventEmitter.js';

class ItemCreator {
    constructor() {
        this.entityFactory = null;
        this.show = this.show.bind(this);
        this.createItemTemplate = this.createItemTemplate.bind(this);
        this.finalizeItemCreation = this.finalizeItemCreation.bind(this);
        this.updateItemPreview = this.updateItemPreview.bind(this);
    }
    
    setEntityFactory(factory) {
        this.entityFactory = factory;
    }
    
    show(container, entityFactory) {
        if (entityFactory && !this.entityFactory) {
            this.entityFactory = entityFactory;
        }
        
        const form = document.createElement('div');
        form.className = 'item-creator-form';
        
        // Header
        const header = document.createElement('h3');
        header.textContent = 'Create New Item';
        header.style.color = '#99ccff';
        header.style.marginBottom = '15px';
        form.appendChild(header);
        
        // Add item selector section - New Addition
        this.addItemSelector(form);
        
        // Create inputs for basic properties
        const fields = [
            { name: 'id', label: 'ID', placeholder: 'unique_item_id', required: true },
            { name: 'name', label: 'Name', placeholder: 'Item Name', required: true },
            { name: 'char', label: 'Character', placeholder: '/', required: true },
            { name: 'color', label: 'Color', placeholder: '#aaa', required: true, type: 'color' },
            { name: 'type', label: 'Type', type: 'select', options: ['weapon', 'armor', 'potion', 'shield', 'charm', 'gold'], required: true },
            { name: 'slot', label: 'Equipment Slot', type: 'select', options: ['hand', 'head', 'chest', 'feet', 'neck', 'none'], condition: 'type', conditionValues: ['weapon', 'armor', 'shield', 'charm'] },
            { name: 'twoHanded', label: 'Two-Handed', type: 'checkbox', condition: 'type', conditionValues: ['weapon'] },
            { name: 'effect', label: 'Effect', placeholder: 'healing', condition: 'type', conditionValues: ['potion'] },
            { name: 'power', label: 'Power', type: 'number', placeholder: '5', condition: 'type', conditionValues: ['potion'] },
            { name: 'limbDamage', label: 'Limb Damage', type: 'number', placeholder: '2', condition: 'type', conditionValues: ['weapon'] },
            { name: 'limbProtection', label: 'Limb Protection', type: 'number', placeholder: '1', condition: 'type', conditionValues: ['armor', 'shield'] },
            { name: 'value', label: 'Value (Gold)', type: 'number', placeholder: '30', required: true }
        ];
        
        // Create form fields
        const fieldContainer = document.createElement('div');
        fieldContainer.className = 'form-fields';
        fieldContainer.style.display = 'grid';
        fieldContainer.style.gridTemplateColumns = 'auto 1fr';
        fieldContainer.style.gap = '10px';
        fieldContainer.style.alignItems = 'center';
        
        fields.forEach(field => {
            const label = document.createElement('label');
            label.textContent = field.label + (field.required ? ' *' : '');
            label.style.fontWeight = 'bold';
            
            let input;
            if (field.type === 'select') {
                input = document.createElement('select');
                input.name = field.name;
                input.id = field.name; // Add ID for easier selection
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
                input.id = field.name; // Add ID for easier selection
            } else {
                input = document.createElement('input');
                input.type = field.type || 'text';
                input.name = field.name;
                input.id = field.name; // Add ID for easier selection
                input.placeholder = field.placeholder || '';
                input.required = field.required;
                if (field.type === 'number') input.min = 0;
            }
            
            input.style.padding = '5px';
            input.style.backgroundColor = 'rgba(40, 40, 60, 0.7)';
            input.style.border = '1px solid #555';
            input.style.borderRadius = '3px';
            input.style.color = '#fff';
            
            if (field.condition) {
                input.dataset.condition = field.condition;
                input.dataset.conditionValues = field.conditionValues.join(',');
                label.dataset.condition = field.condition;
                label.dataset.conditionValues = field.conditionValues.join(',');
                
                const typeSelect = fieldContainer.querySelector('select[name="type"]');
                if (typeSelect && !field.conditionValues.includes(typeSelect.value)) {
                    label.style.display = 'none';
                    input.style.display = 'none';
                }
            }
            
            fieldContainer.appendChild(label);
            fieldContainer.appendChild(input);
        });
        
        form.appendChild(fieldContainer);
        
        // Add stat modifiers section for equipment
        const statModifiersSection = document.createElement('div');
        statModifiersSection.className = 'stat-modifiers-section';
        statModifiersSection.style.marginTop = '20px';
        statModifiersSection.dataset.condition = 'type';
        statModifiersSection.dataset.conditionValues = 'weapon,armor,shield,charm';
        
        const statHeader = document.createElement('h4');
        statHeader.textContent = 'Stat Modifiers';
        statHeader.style.color = '#99dd99';
        statHeader.style.marginBottom = '10px';
        statModifiersSection.appendChild(statHeader);
        
        const statContainer = document.createElement('div');
        statContainer.style.display = 'grid';
        statContainer.style.gridTemplateColumns = 'auto 1fr';
        statContainer.style.gap = '10px';
        statContainer.style.alignItems = 'center';
        
        const statFields = [
            { name: 'strength', label: 'Strength' },
            { name: 'defense', label: 'Defense' },
            { name: 'dexterity', label: 'Dexterity' },
            { name: 'intelligence', label: 'Intelligence' },
            { name: 'toughness', label: 'Toughness' },
            { name: 'perception', label: 'Perception' },
            { name: 'wisdom', label: 'Wisdom' },
            { name: 'charisma', label: 'Charisma' },
            { name: 'speed', label: 'Speed' }
        ];
        
        statFields.forEach(stat => {
            const label = document.createElement('label');
            label.textContent = stat.label;
            
            const input = document.createElement('input');
            input.type = 'number';
            input.name = `statModifier_${stat.name}`;
            input.id = `statModifier_${stat.name}`; // Add ID for easier selection
            input.placeholder = '0';
            input.min = -10;
            input.max = 10;
            input.value = '';
            input.style.padding = '5px';
            input.style.backgroundColor = 'rgba(40, 40, 60, 0.7)';
            input.style.border = '1px solid #555';
            input.style.borderRadius = '3px';
            input.style.color = '#fff';
            
            statContainer.appendChild(label);
            statContainer.appendChild(input);
        });
        
        statModifiersSection.appendChild(statContainer);
        form.appendChild(statModifiersSection);
        
        // Add preview section
        const previewSection = document.createElement('div');
        previewSection.className = 'item-preview-section';
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
        previewTextarea.id = 'item-json-preview';
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
            this.updateItemPreview(form);
        });
        
        const createButton = document.createElement('button');
        createButton.textContent = 'Create Item';
        createButton.style.padding = '8px 16px';
        createButton.style.backgroundColor = '#2a6';
        createButton.style.border = 'none';
        createButton.style.borderRadius = '3px';
        createButton.style.color = '#fff';
        createButton.style.cursor = 'pointer';
        createButton.addEventListener('click', () => this.createItemTemplate(form));
        
        const spawnButton = document.createElement('button');
        spawnButton.textContent = 'Create & Spawn';
        spawnButton.style.padding = '8px 16px';
        spawnButton.style.backgroundColor = '#26a';
        spawnButton.style.border = 'none';
        spawnButton.style.borderRadius = '3px';
        spawnButton.style.color = '#fff';
        spawnButton.style.cursor = 'pointer';
        spawnButton.addEventListener('click', () => {
            const result = this.createItemTemplate(form, true);
            if (!result) return;
            setTimeout(() => eventBus.emit('hideCreator'), 200);
        });
        
        buttonContainer.appendChild(resetButton);
        buttonContainer.appendChild(createButton);
        buttonContainer.appendChild(spawnButton);
        form.appendChild(buttonContainer);
        
        // Add event listeners for conditional fields
        const typeSelect = form.querySelector('select[name="type"]');
        if (typeSelect) {
            typeSelect.addEventListener('change', () => {
                const value = typeSelect.value;
                form.querySelectorAll('[data-condition="type"]').forEach(el => {
                    const validValues = el.dataset.conditionValues.split(',');
                    el.style.display = validValues.includes(value) ? '' : 'none';
                });
                this.updateItemPreview(form);
            });
        }
        
        // Add event listeners to update preview
        form.querySelectorAll('input, select').forEach(input => {
            input.addEventListener('input', () => this.updateItemPreview(form));
            input.addEventListener('change', () => this.updateItemPreview(form));
        });
        
        container.appendChild(form);
        this.updateItemPreview(form);
    }
    
    // New method to add item selector
    addItemSelector(form) {
        // Create container for item selector
        const section = document.createElement('div');
        section.style.marginBottom = '20px';
        section.style.padding = '10px';
        section.style.backgroundColor = 'rgba(40, 60, 90, 0.2)';
        section.style.border = '1px solid #447788';
        section.style.borderRadius = '5px';
        
        // Create label
        const label = document.createElement('label');
        label.textContent = 'Load existing item:';
        label.style.fontWeight = 'bold';
        label.style.display = 'block';
        label.style.marginBottom = '5px';
        
        // Create dropdown
        const select = document.createElement('select');
        select.id = 'item-selector';
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
        defaultOption.textContent = '-- Select an item --';
        select.appendChild(defaultOption);
        
        // Get items from different possible sources
        const items = this.getItemTemplates();
        
        if (items) {
            // Sort items alphabetically
            const sortedItems = Object.entries(items)
                .map(([id, item]) => ({ id, name: item.name || id }))
                .sort((a, b) => a.name.localeCompare(b.name));
            
            // Add item options to dropdown
            sortedItems.forEach(({ id, name }) => {
                const option = document.createElement('option');
                option.value = id;
                option.textContent = name;
                select.appendChild(option);
            });
        }
        
        // Create load button
        const loadBtn = document.createElement('button');
        loadBtn.textContent = 'Load Item';
        loadBtn.style.width = '100%';
        loadBtn.style.padding = '8px';
        loadBtn.style.margin = '5px 0';
        loadBtn.style.backgroundColor = '#5577cc';
        loadBtn.style.color = '#fff';
        loadBtn.style.border = 'none';
        loadBtn.style.borderRadius = '3px';
        loadBtn.style.cursor = 'pointer';
        
        // Load button click handler
        loadBtn.addEventListener('click', () => {
            const itemId = select.value;
            if (!itemId) {
                alert('Please select an item to load');
                return;
            }
            
            const item = items[itemId];
            if (item) {
                this.populateForm(form, item);
            } else {
                alert('Error: Could not find the selected item');
            }
        });
        
        // Create duplicate button
        const dupBtn = document.createElement('button');
        dupBtn.textContent = 'Duplicate & Modify';
        dupBtn.style.width = '100%';
        dupBtn.style.padding = '8px';
        dupBtn.style.margin = '5px 0';
        dupBtn.style.backgroundColor = '#557799';
        dupBtn.style.color = '#fff';
        dupBtn.style.border = 'none';
        dupBtn.style.borderRadius = '3px';
        dupBtn.style.cursor = 'pointer';
        
        // Duplicate button click handler
        dupBtn.addEventListener('click', () => {
            const itemId = select.value;
            if (!itemId) {
                alert('Please select an item to duplicate');
                return;
            }
            
            const item = items[itemId];
            if (item) {
                // Create duplicate with modified ID
                const duplicate = JSON.parse(JSON.stringify(item));
                duplicate.id = `${item.id}_copy`;
                duplicate.name = `${item.name} (Copy)`;
                
                // Populate form with duplicate
                this.populateForm(form, duplicate);
            } else {
                alert('Error: Could not find the selected item');
            }
        });
        
        // Add elements to container
        section.appendChild(label);
        section.appendChild(select);
        section.appendChild(loadBtn);
        section.appendChild(dupBtn);
        form.appendChild(section);
    }
    
    // New method to populate form with item data
    populateForm(form, itemData) {
        console.log('Loading item data:', itemData);
        
        // Reset form first
        form.querySelectorAll('input, select').forEach(input => {
            if (input.type === 'checkbox') input.checked = false;
            else input.value = '';
        });
        
        // Set basic fields
        Object.entries(itemData).forEach(([key, value]) => {
            const input = form.querySelector(`#${key}`);
            if (input) {
                if (input.type === 'checkbox') {
                    input.checked = !!value;
                } else {
                    input.value = value;
                }
            }
        });
        
        // Set stat modifiers if they exist
        if (itemData.statModifiers) {
            Object.entries(itemData.statModifiers).forEach(([stat, value]) => {
                const input = form.querySelector(`#statModifier_${stat}`);
                if (input) {
                    input.value = value;
                }
            });
        }
        
        // Show/hide conditional fields
        const typeSelect = form.querySelector('select[name="type"]');
        if (typeSelect) {
            const value = typeSelect.value;
            form.querySelectorAll('[data-condition="type"]').forEach(el => {
                const validValues = el.dataset.conditionValues.split(',');
                el.style.display = validValues.includes(value) ? '' : 'none';
            });
        }
        
        // Update preview
        this.updateItemPreview(form);
    }
    
    // New method to get item templates
    getItemTemplates() {
        // Try to get items from entityFactory
        if (this.entityFactory && this.entityFactory.itemTemplates) {
            return this.entityFactory.itemTemplates;
        }
        
        // Try to get from window.game
        if (window.game && window.game.entityFactory && window.game.entityFactory.itemTemplates) {
            return window.game.entityFactory.itemTemplates;
        }
        
        // Try to get from gameState
        if (gameState.data && gameState.data.items) {
            const templates = {};
            gameState.data.items.forEach(item => {
                templates[item.id] = item;
            });
            return templates;
        }
        
        console.warn('Could not find any item templates');
        return null;
    }
    
    updateItemPreview(form) {
        const formData = {};
        
        // Get basic fields
        form.querySelectorAll('input, select').forEach(input => {
            if (input.name.startsWith('statModifier_')) return;
            if (input.id === 'item-selector') return;
            
            if (input.type === 'checkbox') formData[input.name] = input.checked;
            else if (input.type === 'number' && input.value) formData[input.name] = parseFloat(input.value);
            else if (input.value) formData[input.name] = input.value;
        });
        
        // Add stat modifiers if applicable for equipment
        const equipmentTypes = ['weapon', 'armor', 'shield', 'charm'];
        if (equipmentTypes.includes(formData.type)) {
            formData.statModifiers = {};
            form.querySelectorAll('input[name^="statModifier_"]').forEach(input => {
                if (input.value) {
                    const statName = input.name.replace('statModifier_', '');
                    formData.statModifiers[statName] = parseFloat(input.value);
                }
            });
            
            if (Object.keys(formData.statModifiers).length === 0) {
                delete formData.statModifiers;
            }
        }
        
        // Format JSON with indentation
        const jsonString = JSON.stringify(formData, null, 2);
        
        // Update preview
        const previewTextarea = form.querySelector('#item-json-preview');
        if (previewTextarea) previewTextarea.value = jsonString;
    }
    
    createItemTemplate(form, spawnItem = false) {
        const formData = {};
        
        // Get basic fields
        form.querySelectorAll('input, select').forEach(input => {
            if (input.name.startsWith('statModifier_')) return;
            if (input.id === 'item-selector') return;
            
            if (input.type === 'checkbox') formData[input.name] = input.checked;
            else if (input.type === 'number' && input.value) formData[input.name] = parseFloat(input.value);
            else if (input.value) formData[input.name] = input.value;
        });
        
        // Validate required fields
        const requiredFields = ['id', 'name', 'char', 'color', 'type', 'value'];
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
        
        // Add stat modifiers if applicable for equipment
        const equipmentTypes = ['weapon', 'armor', 'shield', 'charm'];
        if (equipmentTypes.includes(formData.type)) {
            formData.statModifiers = {};
            
            form.querySelectorAll('input[name^="statModifier_"]').forEach(input => {
                if (input.value) {
                    const statName = input.name.replace('statModifier_', '');
                    formData.statModifiers[statName] = parseFloat(input.value);
                }
            });
            
            if (Object.keys(formData.statModifiers).length === 0) {
                delete formData.statModifiers;
            }
        }
        
        // Check if item ID already exists
        const factory = this.entityFactory || window.game?.entityFactory;
        if (factory?.itemTemplates[formData.id]) {
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
            message.textContent = `An item with ID "${formData.id}" already exists. Do you want to overwrite it?`;
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
                return this.finalizeItemCreation(formData, spawnItem, form);
            });
        }
        
        return this.finalizeItemCreation(formData, spawnItem, form);
    }
    
    finalizeItemCreation(formData, spawnItem, form) {
        const factory = this.entityFactory || window.game?.entityFactory;
        
        if (factory) {
            factory.itemTemplates[formData.id] = formData;
            console.log(`Created item template: ${formData.id}`);
            
            if (spawnItem) {
                const player = gameState.player;
                if (player) {
                    const item = factory.createItem(
                        formData.id, 
                        player.position.x, 
                        player.position.y
                    );
                    
                    if (item) {
                        gameState.addEntity(item);
                        gameState.addMessage(`Created item: ${formData.name}`);
                        console.log(`Spawned item: ${formData.id}`);
                        gameState.addMessage(`Item "${formData.name}" created and placed at your location!`, "important");
                        eventBus.emit('hideCreator');
                    }
                }
            } else {
                gameState.addMessage(`Item template "${formData.name}" created successfully!`, "important");
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
            
            console.error('EntityFactory not found when creating item');
            return false;
        }
    }
}

export default new ItemCreator();
