// ui/creatorUI.js
import gameState from '../core/gameState.js';
import eventBus from '../core/eventEmitter.js';
import EntityFactory from '../entities/entityFactory.js';

class CreatorUI {
    constructor() {
        this.uiElement = null;
        this.visible = false;
        this.entityFactory = null; // Will be assigned later
        this.previousGameMode = 'exploration'; // Default fallback
        
        // Bind methods
        this.show = this.show.bind(this);
        this.hide = this.hide.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.createItemTemplate = this.createItemTemplate.bind(this);
        this.finalizeItemCreation = this.finalizeItemCreation.bind(this);
        this.updateItemPreview = this.updateItemPreview.bind(this);
        
        // Create UI
        this.createUI();
        
        // Register events
        eventBus.on('showCreator', this.show);
        eventBus.on('hideCreator', this.hide);
        eventBus.on('creatorClosed', () => {
            this.visible = false;
            gameState.gameMode = 'exploration';
            console.log('Creator mode force reset to exploration');
        });
    }
    
    createUI() {
        if (this.uiElement) return;
        
        this.uiElement = document.createElement('div');
        this.uiElement.id = 'creator-ui';
        this.uiElement.className = 'creator-ui';
        this.uiElement.style.position = 'fixed';
        this.uiElement.style.top = '50%';
        this.uiElement.style.left = '50%';
        this.uiElement.style.transform = 'translate(-50%, -50%)';
        this.uiElement.style.width = '700px';
        this.uiElement.style.maxHeight = '80vh';
        this.uiElement.style.backgroundColor = 'rgba(20, 20, 30, 0.95)';
        this.uiElement.style.border = '2px solid #666';
        this.uiElement.style.borderRadius = '5px';
        this.uiElement.style.padding = '10px';
        this.uiElement.style.zIndex = '1002'; // Higher than dataViewer
        this.uiElement.style.display = 'none';
        this.uiElement.style.color = '#ddd';
        this.uiElement.style.fontFamily = 'monospace';
        this.uiElement.style.overflow = 'auto';
        this.uiElement.style.boxShadow = '0 0 20px rgba(0, 0, 0, 0.5)';
        
        document.body.appendChild(this.uiElement);
    }
    
    show() {
        // Save previous game mode and set to creator mode
        this.previousGameMode = gameState.gameMode;
        gameState.gameMode = 'creator';
        gameState.creatorMode = true;
        
        // Add keyboard event listener
        document.addEventListener('keydown', this.handleKeyDown);
        
        // Set editing flag for input fields
        window.isEditingEntityData = true;
        
        // Populate UI
        this.populateUI();
        
        // Show the UI
        this.uiElement.style.display = 'block';
        this.visible = true;
        
        console.log('Creator UI opened, game mode set to:', gameState.gameMode);
    }
    
    hide() {
        if (this.uiElement) {
            this.uiElement.style.display = 'none';
        }
        
        console.log('Previous game mode before reset:', this.previousGameMode);
        
        // Make sure we're going back to exploration mode
        this.previousGameMode = this.previousGameMode || 'exploration';
        
        // Force game mode back to exploration
        gameState.gameMode = 'exploration';
        gameState.creatorMode = false;
        
        // Remove keyboard event listener
        document.removeEventListener('keydown', this.handleKeyDown);
        
        // Reset editing flag
        window.isEditingEntityData = false;
        
        this.visible = false;
        
        // Force focus back to game container
        const gameContainer = document.getElementById('game-container');
        if (gameContainer) {
            gameContainer.focus();
        }
        
        // Timeout to ensure game state is reset after other operations complete
        setTimeout(() => {
            if (gameState.gameMode !== 'exploration') {
                console.log('Forcing game mode reset to exploration');
                gameState.gameMode = 'exploration';
                eventBus.emit('fovUpdated'); // Trigger a render update
            }
        }, 50);
        
        // Emit event to make sure game state is properly reset
        eventBus.emit('creatorClosed');
        
        console.log('Creator UI closed, game mode set to:', gameState.gameMode);
    }
    
    handleKeyDown(event) {
        if (event.key === 'Escape') {
            this.hide();
        }
    }
    
    populateUI() {
        // Clear previous content
        this.uiElement.innerHTML = '';
        
        // Create header
        const header = document.createElement('div');
        header.className = 'creator-header';
        header.style.borderBottom = '1px solid #666';
        header.style.marginBottom = '10px';
        header.style.paddingBottom = '10px';
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';
        
        const title = document.createElement('h2');
        title.textContent = 'Creator Mode';
        title.style.margin = '0';
        title.style.color = '#fff';
        
        const closeButton = document.createElement('button');
        closeButton.textContent = '×';
        closeButton.style.background = 'none';
        closeButton.style.border = 'none';
        closeButton.style.color = '#fff';
        closeButton.style.fontSize = '24px';
        closeButton.style.cursor = 'pointer';
        closeButton.style.padding = '0 5px';
        closeButton.addEventListener('click', this.hide);
        
        header.appendChild(title);
        header.appendChild(closeButton);
        this.uiElement.appendChild(header);
        
        // Create tab buttons
        const tabs = document.createElement('div');
        tabs.className = 'creator-tabs';
        tabs.style.display = 'flex';
        tabs.style.marginBottom = '15px';
        tabs.style.borderBottom = '1px solid #444';
        
        // Define tabs
        const tabItems = [
            { id: 'items', label: 'Create Item' },
            { id: 'monsters', label: 'Create Monster' },
            { id: 'spells', label: 'Create Spell' },
            { id: 'tiles', label: 'Edit Tile' }
        ];
        
        // Create tab buttons
        tabItems.forEach(tab => {
            const tabButton = document.createElement('button');
            tabButton.className = 'creator-tab';
            tabButton.textContent = tab.label;
            tabButton.style.padding = '8px 16px';
            tabButton.style.margin = '0 5px';
            tabButton.style.backgroundColor = 'rgba(40, 40, 50, 0.7)';
            tabButton.style.border = 'none';
            tabButton.style.borderBottom = '2px solid transparent';
            tabButton.style.color = '#ccc';
            tabButton.style.cursor = 'pointer';
            
            tabButton.addEventListener('click', () => {
                // Remove active class from all tabs
                tabs.querySelectorAll('.creator-tab').forEach(btn => {
                    btn.style.backgroundColor = 'rgba(40, 40, 50, 0.7)';
                    btn.style.borderBottom = '2px solid transparent';
                    btn.style.color = '#ccc';
                });
                
                // Set this tab as active
                tabButton.style.backgroundColor = 'rgba(60, 60, 80, 0.7)';
                tabButton.style.borderBottom = '2px solid #77aaff';
                tabButton.style.color = '#fff';
                
                // Show appropriate content
                this.showTabContent(tab.id);
            });
            
            tabs.appendChild(tabButton);
        });
        
        this.uiElement.appendChild(tabs);
        
        // Create content container
        const contentContainer = document.createElement('div');
        contentContainer.id = 'creator-content';
        contentContainer.style.padding = '10px';
        this.uiElement.appendChild(contentContainer);
        
        // Default to items tab
        tabs.querySelector('.creator-tab').click();
    }
    
    showTabContent(tabId) {
        const contentContainer = document.getElementById('creator-content');
        contentContainer.innerHTML = '';
        
        switch(tabId) {
            case 'items':
                this.showItemCreator(contentContainer);
                break;
            case 'monsters':
                this.showMonsterCreator(contentContainer);
                break;
            case 'spells':
                this.showSpellCreator(contentContainer);
                break;
            case 'tiles':
                this.showTileEditor(contentContainer);
                break;
        }
    }
    
    showItemCreator(container) {
        // Create a form for item creation
        const form = document.createElement('div');
        form.className = 'item-creator-form';
        
        // Header
        const header = document.createElement('h3');
        header.textContent = 'Create New Item';
        header.style.color = '#99ccff';
        header.style.marginBottom = '15px';
        form.appendChild(header);
        
        // Create inputs for basic properties
        const fields = [
            { name: 'id', label: 'ID', placeholder: 'unique_item_id', required: true },
            { name: 'name', label: 'Name', placeholder: 'Item Name', required: true },
            { name: 'char', label: 'Character', placeholder: '/', required: true },
            { name: 'color', label: 'Color', placeholder: '#aaa', required: true, type: 'color' },
            { 
                name: 'type', 
                label: 'Type', 
                type: 'select', 
                options: ['weapon', 'armor', 'potion', 'shield', 'charm', 'gold'],
                required: true 
            },
            { 
                name: 'slot', 
                label: 'Equipment Slot', 
                type: 'select', 
                options: ['hand', 'head', 'chest', 'feet', 'neck', 'none'],
                condition: 'type', 
                conditionValues: ['weapon', 'armor', 'shield', 'charm'] 
            },
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
                input.required = field.required;
                
                // Add options
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
                
                if (field.type === 'number') {
                    input.min = 0;
                }
            }
            
            input.style.padding = '5px';
            input.style.backgroundColor = 'rgba(40, 40, 60, 0.7)';
            input.style.border = '1px solid #555';
            input.style.borderRadius = '3px';
            input.style.color = '#fff';
            
            // Add data attributes for conditional display
            if (field.condition) {
                input.dataset.condition = field.condition;
                input.dataset.conditionValues = field.conditionValues.join(',');
                label.dataset.condition = field.condition;
                label.dataset.conditionValues = field.conditionValues.join(',');
                
                // Initially hide if doesn't match condition
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
            // Create item and spawn it
            const result = this.createItemTemplate(form, true);
            
            // If creation failed, stay in creator mode
            if (!result) return;
            
            // Extra safeguard: ensure we exit creator mode properly
            setTimeout(() => {
                if (this.visible || gameState.gameMode === 'creator') {
                    console.log('Force closing creator UI after spawn');
                    this.hide();
                    gameState.gameMode = 'exploration';
                    eventBus.emit('fovUpdated');
                }
            }, 200);
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
                if (input.type === 'checkbox') {
                    input.checked = false;
                } else {
                    input.value = '';
                }
            });
            // Update preview
            this.updateItemPreview(form);
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
                
                // Handle conditionally shown fields
                form.querySelectorAll('[data-condition="type"]').forEach(el => {
                    const validValues = el.dataset.conditionValues.split(',');
                    if (validValues.includes(value)) {
                        el.style.display = '';
                    } else {
                        el.style.display = 'none';
                    }
                });
                
                // Update preview
                this.updateItemPreview(form);
            });
        }
        
        // Add event listeners to update preview
        form.querySelectorAll('input, select').forEach(input => {
            input.addEventListener('input', () => {
                this.updateItemPreview(form);
            });
            
            input.addEventListener('change', () => {
                this.updateItemPreview(form);
            });
        });
        
        container.appendChild(form);
        
        // Initial preview update
        this.updateItemPreview(form);
    }
    
    updateItemPreview(form) {
        // Collect form data
        const formData = {};
        
        // Get basic fields
        form.querySelectorAll('input, select').forEach(input => {
            if (input.name.startsWith('statModifier_')) {
                return; // We'll handle stat modifiers separately
            }
            
            if (input.type === 'checkbox') {
                formData[input.name] = input.checked;
            } else if (input.type === 'number' && input.value) {
                formData[input.name] = parseFloat(input.value);
            } else if (input.value) {
                formData[input.name] = input.value;
            }
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
            
            // Remove statModifiers if empty
            if (Object.keys(formData.statModifiers).length === 0) {
                delete formData.statModifiers;
            }
        }
        
        // Format JSON with indentation
        const jsonString = JSON.stringify(formData, null, 2);
        
        // Update preview
        const previewTextarea = form.querySelector('#item-json-preview');
        if (previewTextarea) {
            previewTextarea.value = jsonString;
        }
    }
    
    createItemTemplate(form, spawnItem = false) {
        // Collect form data
        const formData = {};
        
        // Get basic fields
        form.querySelectorAll('input, select').forEach(input => {
            if (input.name.startsWith('statModifier_')) {
                return; // We'll handle stat modifiers separately
            }
            
            if (input.type === 'checkbox') {
                formData[input.name] = input.checked;
            } else if (input.type === 'number' && input.value) {
                formData[input.name] = parseFloat(input.value);
            } else if (input.value) {
                formData[input.name] = input.value;
            }
        });
        
        // Validate required fields
        const requiredFields = ['id', 'name', 'char', 'color', 'type', 'value'];
        const missingFields = requiredFields.filter(field => !formData[field]);
        
        if (missingFields.length > 0) {
            // Use console error instead of alert
            console.error(`Missing required fields: ${missingFields.join(', ')}`);
            
            // Add an error message to a form element instead of alert
            const errorMsg = document.createElement('div');
            errorMsg.style.color = '#ff5555';
            errorMsg.style.marginBottom = '10px';
            errorMsg.style.padding = '5px';
            errorMsg.style.border = '1px solid #ff0000';
            errorMsg.style.backgroundColor = 'rgba(255, 0, 0, 0.1)';
            errorMsg.textContent = `Missing required fields: ${missingFields.join(', ')}`;
            
            // Insert at the top of the form
            if (form.firstChild) {
                form.insertBefore(errorMsg, form.firstChild);
            } else {
                form.appendChild(errorMsg);
            }
            
            // Auto-remove after 5 seconds
            setTimeout(() => {
                if (errorMsg.parentNode) {
                    errorMsg.parentNode.removeChild(errorMsg);
                }
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
            
            // Remove statModifiers if empty
            if (Object.keys(formData.statModifiers).length === 0) {
                delete formData.statModifiers;
            }
        }
        
        // Check if item ID already exists
        if (window.game?.entityFactory?.itemTemplates[formData.id]) {
            // Create confirmation dialog in the UI instead of using confirm()
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
            
            // Return a promise that will be resolved when the user makes a choice
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
                if (!result) {
                    return false;
                }
                // Continue with the function if the user confirmed
                return this.finalizeItemCreation(formData, spawnItem, form);
            });
        }
        
        // If no confirmation needed, continue directly
        return this.finalizeItemCreation(formData, spawnItem, form);
    }
    
    // Extracted method to finalize the item creation process
    finalizeItemCreation(formData, spawnItem, form) {
        // Add to item templates
        if (window.game?.entityFactory) {
            // Add to templates
            window.game.entityFactory.itemTemplates[formData.id] = formData;
            
            console.log(`Created item template: ${formData.id}`);
            
            // Spawn item if requested
            if (spawnItem) {
                const player = gameState.player;
                if (player) {
                    const item = window.game.entityFactory.createItem(
                        formData.id, 
                        player.position.x, 
                        player.position.y
                    );
                    
                    if (item) {
                        // Add the entity to the game state
                        gameState.addEntity(item);
                        gameState.addMessage(`Created item: ${formData.name}`);
                        console.log(`Spawned item: ${formData.id}`);
                        
                        // Add in-game notification instead of alert
                        gameState.addMessage(`Item "${formData.name}" created and placed at your location!`, "important");
                        
                        // Close the creator UI after spawning
                        this.hide();
                    }
                }
            } else {
                // Add success message to game logs instead of alert
                gameState.addMessage(`Item template "${formData.name}" created successfully!`, "important");
            }
            return true;
        } else if (this.entityFactory) {
            // Try using the local entityFactory reference if the global one isn't available
            this.entityFactory.itemTemplates[formData.id] = formData;
            
            console.log(`Created item template: ${formData.id}`);
            
            // Spawn item if requested
            if (spawnItem) {
                const player = gameState.player;
                if (player) {
                    const item = this.entityFactory.createItem(
                        formData.id, 
                        player.position.x, 
                        player.position.y
                    );
                    
                    if (item) {
                        gameState.addEntity(item);
                        gameState.addMessage(`Created item: ${formData.name}`);
                        console.log(`Spawned item: ${formData.id}`);
                        
                        // Add in-game notification
                        gameState.addMessage(`Item "${formData.name}" created and placed at your location!`, "important");
                        
                        // Close the creator UI
                        this.hide();
                    }
                }
            } else {
                // Add success message to game logs instead of alert  
                gameState.addMessage(`Item template "${formData.name}" created successfully!`, "important");
            }
            return true;
        } else {
            // Create an error message in the form instead of an alert
            const errorMsg = document.createElement('div');
            errorMsg.style.color = '#ff5555';
            errorMsg.style.marginBottom = '10px';
            errorMsg.style.padding = '5px';
            errorMsg.style.border = '1px solid #ff0000';
            errorMsg.style.backgroundColor = 'rgba(255, 0, 0, 0.1)';
            errorMsg.textContent = 'Error: EntityFactory not found! Please reload the game.';
            
            // Insert at the top of the form
            if (form.firstChild) {
                form.insertBefore(errorMsg, form.firstChild);
            } else {
                form.appendChild(errorMsg);
            }
            
            // Auto-remove after 5 seconds
            setTimeout(() => {
                if (errorMsg.parentNode) {
                    errorMsg.parentNode.removeChild(errorMsg);
                }
            }, 5000);
            
            console.error('EntityFactory not found when creating item');
            return false;
        }
    }
    
    // Placeholder for other creator tabs
    showMonsterCreator(container) {
        const message = document.createElement('p');
        message.textContent = 'Monster creator coming soon...';
        container.appendChild(message);
    }
    
    showSpellCreator(container) {
        const message = document.createElement('p');
        message.textContent = 'Spell creator coming soon...';
        container.appendChild(message);
    }
    
    showTileEditor(container) {
        const message = document.createElement('p');
        message.textContent = 'Tile editor coming soon... For now, you can right-click on a tile and select "View Data" to edit it.';
        container.appendChild(message);
    }
    
    // Method to set the entity factory reference
    setEntityFactory(factory) {
        this.entityFactory = factory;
    }
}

// Export singleton instance
export default new CreatorUI();
