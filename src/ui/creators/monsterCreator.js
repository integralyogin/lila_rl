// ui/creators/monsterCreator.js
import gameState from '../../core/gameState.js';
import eventBus from '../../core/eventEmitter.js';

class MonsterCreator {
    constructor() {
        this.entityFactory = null;
        this.monsterTypes = ['humanoid', 'beast', 'undead', 'elemental', 'construct', 'dragon', 'goblinoid', 'magical'];
        this.behaviorTypes = ['default', 'aggressive', 'ranged', 'spellcaster', 'summoner', 'hydra', 'cowardly'];
    }
    
    setEntityFactory(factory) { this.entityFactory = factory; }
    
    show(container, entityFactory) {
        if (entityFactory) this.entityFactory = entityFactory;
        
        const form = document.createElement('div');
        form.className = 'monster-creator-form';
        
        // Header
        const header = document.createElement('h3');
        header.textContent = 'Create Monster';
        header.style.color = '#ff9966';
        form.appendChild(header);
        
        // Add sections
        this.addMonsterSelector(form);
        this.addBasicPropertiesSection(form);
        this.addStatsSection(form);
        this.addAISection(form);
        this.addSpellsSection(form);
        this.addPreviewSection(form);
        this.addActionButtons(form);
        
        container.appendChild(form);
        this.updateMonsterPreview(form);
    }
    
    addMonsterSelector(form) {
        const section = document.createElement('div');
        section.className = 'monster-selector';
        
        // Create dropdown
        const select = document.createElement('select');
        select.id = 'monster-selector';
        
        // Add default option
        select.innerHTML = '<option value="">-- Select a monster --</option>';
        
        // Get monsters from different possible sources
        const monsters = this.getMonsterTemplates();
        
        if (monsters) {
            // Sort monsters alphabetically
            Object.entries(monsters)
                .map(([id, monster]) => ({ id, name: monster.name || id }))
                .sort((a, b) => a.name.localeCompare(b.name))
                .forEach(({ id, name }) => {
                    const option = document.createElement('option');
                    option.value = id;
                    option.textContent = name;
                    select.appendChild(option);
                });
        }
        
        // Create buttons
        const btnContainer = document.createElement('div');
        btnContainer.style.display = 'flex';
        btnContainer.style.gap = '10px';
        btnContainer.style.marginTop = '5px';
        
        const loadBtn = document.createElement('button');
        loadBtn.textContent = 'Load Monster';
        loadBtn.addEventListener('click', () => {
            const monsterId = select.value;
            if (!monsterId) {
                alert('Please select a monster to load');
                return;
            }
            
            const monster = monsters[monsterId];
            if (monster) {
                this.populateForm(form, monster);
            } else {
                alert('Error: Could not find the selected monster');
            }
        });
        
        const dupBtn = document.createElement('button');
        dupBtn.textContent = 'Duplicate & Modify';
        dupBtn.addEventListener('click', () => {
            const monsterId = select.value;
            if (!monsterId) {
                alert('Please select a monster to duplicate');
                return;
            }
            
            const monster = monsters[monsterId];
            if (monster) {
                const duplicate = JSON.parse(JSON.stringify(monster));
                duplicate.id = `${monster.id}_copy`;
                duplicate.name = `${monster.name} (Copy)`;
                this.populateForm(form, duplicate);
            } else {
                alert('Error: Could not find the selected monster');
            }
        });
        
        btnContainer.appendChild(loadBtn);
        btnContainer.appendChild(dupBtn);
        
        section.appendChild(select);
        section.appendChild(btnContainer);
        form.appendChild(section);
    }
    
    addBasicPropertiesSection(form) {
        const fieldset = document.createElement('fieldset');
        fieldset.innerHTML = '<legend>Basic Properties</legend>';
        
        const grid = document.createElement('div');
        grid.style.display = 'grid';
        grid.style.gridTemplateColumns = 'auto 1fr';
        grid.style.gap = '10px';
        
        // Define fields
        const fields = [
            { name: 'id', label: 'ID', placeholder: 'unique_monster_id', required: true },
            { name: 'name', label: 'Name', placeholder: 'Monster Name', required: true },
            { name: 'char', label: 'Character', placeholder: 'M', required: true },
            { name: 'color', label: 'Color', placeholder: '#ff0000', type: 'color', required: true },
            { name: 'type', label: 'Type', type: 'select', options: this.monsterTypes }
        ];
        
        // Create fields
        fields.forEach(field => {
            const label = document.createElement('label');
            label.textContent = field.label + (field.required ? ' *' : '');
            
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
            
            input.addEventListener('input', () => this.updateMonsterPreview(form));
            input.addEventListener('change', () => this.updateMonsterPreview(form));
            
            grid.appendChild(label);
            grid.appendChild(input);
        });
        
        fieldset.appendChild(grid);
        form.appendChild(fieldset);
    }
    
    addStatsSection(form) {
        const fieldset = document.createElement('fieldset');
        fieldset.innerHTML = '<legend>Stats</legend>';
        
        const grid = document.createElement('div');
        grid.style.display = 'grid';
        grid.style.gridTemplateColumns = 'repeat(3, auto 1fr)';
        grid.style.gap = '10px';
        
        // Define primary stats
        const stats = [
            { name: 'hp', label: 'Health', required: true },
            { name: 'mana', label: 'Mana' },
            { name: 'strength', label: 'Strength', required: true },
            { name: 'defense', label: 'Defense', required: true },
            { name: 'dexterity', label: 'Dexterity' },
            { name: 'intelligence', label: 'Intelligence' },
            { name: 'speed', label: 'Speed' },
            { name: 'xp', label: 'XP Value', required: true }
        ];
        
        // Create stat fields
        stats.forEach(stat => {
            const label = document.createElement('label');
            label.textContent = stat.label + (stat.required ? ' *' : '');
            
            const input = document.createElement('input');
            input.type = 'number';
            input.name = stat.name;
            input.id = stat.name;
            input.placeholder = '0';
            input.min = 0;
            
            input.addEventListener('input', () => this.updateMonsterPreview(form));
            
            grid.appendChild(label);
            grid.appendChild(input);
        });
        
        fieldset.appendChild(grid);
        form.appendChild(fieldset);
    }
    
    addAISection(form) {
        const fieldset = document.createElement('fieldset');
        fieldset.innerHTML = '<legend>AI Behavior</legend>';
        
        const container = document.createElement('div');
        
        // Behavior type dropdown
        const behaviorLabel = document.createElement('label');
        behaviorLabel.textContent = 'Behavior Type:';
        
        const behaviorSelect = document.createElement('select');
        behaviorSelect.name = 'behaviorType';
        behaviorSelect.id = 'behaviorType';
        
        this.behaviorTypes.forEach(type => {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = type.charAt(0).toUpperCase() + type.slice(1);
            behaviorSelect.appendChild(option);
        });
        
        container.appendChild(behaviorLabel);
        container.appendChild(behaviorSelect);
        
        // AI parameter grid
        const aiGrid = document.createElement('div');
        aiGrid.style.display = 'grid';
        aiGrid.style.gridTemplateColumns = 'auto 1fr auto 1fr';
        aiGrid.style.gap = '10px';
        aiGrid.style.marginTop = '10px';
        
        // Define AI parameters
        const aiParams = [
            { name: 'preferredMinDist', label: 'Min Distance' },
            { name: 'preferredMaxDist', label: 'Max Distance' },
            { name: 'attackRange', label: 'Attack Range' },
            { name: 'attackCooldown', label: 'Attack Cooldown' }
        ];
        
        // Create AI parameter fields
        aiParams.forEach(param => {
            const label = document.createElement('label');
            label.textContent = param.label;
            
            const input = document.createElement('input');
            input.type = 'number';
            input.name = `ai_${param.name}`;
            input.id = `ai_${param.name}`;
            input.placeholder = '0';
            input.min = 0;
            
            input.addEventListener('input', () => this.updateMonsterPreview(form));
            
            aiGrid.appendChild(label);
            aiGrid.appendChild(input);
        });
        
        // Add checkbox for isHostile
        const flagsContainer = document.createElement('div');
        flagsContainer.style.marginTop = '10px';
        
        const isHostileContainer = document.createElement('div');
        isHostileContainer.style.display = 'inline-block';
        isHostileContainer.style.marginRight = '15px';
        
        const isHostileCheckbox = document.createElement('input');
        isHostileCheckbox.type = 'checkbox';
        isHostileCheckbox.id = 'isHostile';
        isHostileCheckbox.name = 'isHostile';
        isHostileCheckbox.checked = true; // Default to hostile
        
        const isHostileLabel = document.createElement('label');
        isHostileLabel.htmlFor = 'isHostile';
        isHostileLabel.textContent = 'Hostile to Player';
        isHostileLabel.style.marginLeft = '5px';
        
        isHostileContainer.appendChild(isHostileCheckbox);
        isHostileContainer.appendChild(isHostileLabel);
        
        const isNPCContainer = document.createElement('div');
        isNPCContainer.style.display = 'inline-block';
        
        const isNPCCheckbox = document.createElement('input');
        isNPCCheckbox.type = 'checkbox';
        isNPCCheckbox.id = 'isNPC';
        isNPCCheckbox.name = 'isNPC';
        
        const isNPCLabel = document.createElement('label');
        isNPCLabel.htmlFor = 'isNPC';
        isNPCLabel.textContent = 'Is NPC';
        isNPCLabel.style.marginLeft = '5px';
        
        isNPCContainer.appendChild(isNPCCheckbox);
        isNPCContainer.appendChild(isNPCLabel);
        
        flagsContainer.appendChild(isHostileContainer);
        flagsContainer.appendChild(isNPCContainer);
        
        // Add event listeners to update preview
        isHostileCheckbox.addEventListener('change', () => this.updateMonsterPreview(form));
        isNPCCheckbox.addEventListener('change', () => this.updateMonsterPreview(form));
        behaviorSelect.addEventListener('change', () => this.updateMonsterPreview(form));
        
        container.appendChild(aiGrid);
        container.appendChild(flagsContainer);
        
        fieldset.appendChild(container);
        form.appendChild(fieldset);
    }
    
    addSpellsSection(form) {
        const fieldset = document.createElement('fieldset');
        fieldset.innerHTML = '<legend>Spells & Abilities</legend>';
        
        const container = document.createElement('div');
        
        // Checkbox for "Has Magic"
        const hasMagicContainer = document.createElement('div');
        
        const hasMagicCheckbox = document.createElement('input');
        hasMagicCheckbox.type = 'checkbox';
        hasMagicCheckbox.id = 'hasMagic';
        hasMagicCheckbox.name = 'hasMagic';
        
        const hasMagicLabel = document.createElement('label');
        hasMagicLabel.htmlFor = 'hasMagic';
        hasMagicLabel.textContent = 'Monster Can Cast Spells';
        hasMagicLabel.style.marginLeft = '5px';
        
        hasMagicContainer.appendChild(hasMagicCheckbox);
        hasMagicContainer.appendChild(hasMagicLabel);
        container.appendChild(hasMagicContainer);
        
        // Create spell selector
        const spellsContainer = document.createElement('div');
        spellsContainer.id = 'spells-container';
        spellsContainer.style.border = '1px solid #555';
        spellsContainer.style.padding = '10px';
        spellsContainer.style.marginTop = '10px';
        spellsContainer.style.display = 'none'; // Hidden by default
        
        // Get spells from different possible sources
        const spells = this.getSpellTemplates();
        
        if (spells && Object.keys(spells).length > 0) {
            const spellCheckboxes = document.createElement('div');
            spellCheckboxes.style.display = 'grid';
            spellCheckboxes.style.gridTemplateColumns = 'repeat(3, 1fr)';
            spellCheckboxes.style.gap = '5px';
            
            Object.entries(spells)
                .sort((a, b) => {
                    const nameA = a[1].name || a[1].spellName || a[0];
                    const nameB = b[1].name || b[1].spellName || b[0];
                    return nameA.localeCompare(nameB);
                })
                .forEach(([id, spell]) => {
                    const spellBox = document.createElement('div');
                    
                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.id = `spell_${id}`;
                    checkbox.name = `spell_${id}`;
                    checkbox.dataset.spellId = id;
                    
                    const spellLabel = document.createElement('label');
                    spellLabel.htmlFor = `spell_${id}`;
                    spellLabel.textContent = spell.name || spell.spellName || id;
                    spellLabel.style.marginLeft = '5px';
                    
                    spellBox.appendChild(checkbox);
                    spellBox.appendChild(spellLabel);
                    spellCheckboxes.appendChild(spellBox);
                    
                    checkbox.addEventListener('change', () => this.updateMonsterPreview(form));
                });
            
            spellsContainer.appendChild(spellCheckboxes);
        } else {
            spellsContainer.textContent = 'No spells available. Create spells first.';
        }
        
        container.appendChild(spellsContainer);
        
        // Toggle spell container visibility
        hasMagicCheckbox.addEventListener('change', () => {
            spellsContainer.style.display = hasMagicCheckbox.checked ? 'block' : 'none';
            this.updateMonsterPreview(form);
        });
        
        fieldset.appendChild(container);
        form.appendChild(fieldset);
    }
    
    addPreviewSection(form) {
        const previewSection = document.createElement('div');
        previewSection.className = 'monster-preview-section';
        
        const previewHeader = document.createElement('h4');
        previewHeader.textContent = 'Monster Data Preview';
        previewSection.appendChild(previewHeader);
        
        const previewTextarea = document.createElement('textarea');
        previewTextarea.id = 'monster-json-preview';
        previewTextarea.readOnly = true;
        previewTextarea.style.width = '100%';
        previewTextarea.style.height = '150px';
        
        previewSection.appendChild(previewTextarea);
        form.appendChild(previewSection);
    }
    
    addActionButtons(form) {
        const buttonContainer = document.createElement('div');
        buttonContainer.style.display = 'flex';
        buttonContainer.style.gap = '10px';
        buttonContainer.style.marginTop = '15px';
        
        const resetButton = document.createElement('button');
        resetButton.textContent = 'Reset Form';
        resetButton.addEventListener('click', () => {
            form.querySelectorAll('input, select, textarea').forEach(input => {
                if (input.type === 'checkbox') input.checked = false;
                else input.value = '';
            });
            
            // Hide spells container
            const spellsContainer = form.querySelector('#spells-container');
            if (spellsContainer) spellsContainer.style.display = 'none';
            
            this.updateMonsterPreview(form);
        });
        
        const createButton = document.createElement('button');
        createButton.textContent = 'Create Monster';
        createButton.addEventListener('click', () => this.createMonsterTemplate(form));
        
        const spawnButton = document.createElement('button');
        spawnButton.textContent = 'Create & Spawn';
        spawnButton.addEventListener('click', () => {
            const result = this.createMonsterTemplate(form, true);
            if (!result) return;
            setTimeout(() => eventBus.emit('hideCreator'), 200);
        });
        
        buttonContainer.appendChild(resetButton);
        buttonContainer.appendChild(createButton);
        buttonContainer.appendChild(spawnButton);
        form.appendChild(buttonContainer);
    }
    
    populateForm(form, monsterData) {
        console.log('Loading monster data:', monsterData);
        
        // Reset form
        form.querySelectorAll('input, select, textarea').forEach(input => {
            if (input.type === 'checkbox') input.checked = false;
            else input.value = '';
        });
        
        // Set basic fields
        Object.entries(monsterData).forEach(([key, value]) => {
            if (key !== 'ai' && key !== 'spells' && typeof value !== 'object') {
                const input = form.querySelector(`#${key}`);
                if (input) {
                    if (input.type === 'checkbox') {
                        input.checked = !!value;
                    } else {
                        input.value = value;
                    }
                }
            }
        });
        
        // Handle AI settings
        if (monsterData.ai) {
            // Set behavior type
            const behaviorType = monsterData.ai.behaviorType;
            const behaviorSelect = form.querySelector('#behaviorType');
            if (behaviorSelect && behaviorType) {
                const option = Array.from(behaviorSelect.options).find(opt => opt.value === behaviorType);
                if (option) behaviorSelect.value = behaviorType;
            }
            
            // Set other AI fields
            Object.entries(monsterData.ai).forEach(([key, value]) => {
                if (key !== 'behaviorType' && key !== 'spellPriorities') {
                    const input = form.querySelector(`#ai_${key}`);
                    if (input) input.value = value;
                }
            });
        }
        
        // Handle spells
        if (monsterData.spells && monsterData.spells.length > 0) {
            // Check hasMagic checkbox
            const hasMagicCheckbox = form.querySelector('#hasMagic');
            if (hasMagicCheckbox) {
                hasMagicCheckbox.checked = true;
                
                // Show the spells container
                const spellsContainer = form.querySelector('#spells-container');
                if (spellsContainer) spellsContainer.style.display = 'block';
                
                // Check spell checkboxes
                monsterData.spells.forEach(spellId => {
                    const checkbox = form.querySelector(`#spell_${spellId}`);
                    if (checkbox) checkbox.checked = true;
                });
            }
        }
        
        // Handle flags
        if (monsterData.isNPC) {
            const isNPCCheckbox = form.querySelector('#isNPC');
            if (isNPCCheckbox) isNPCCheckbox.checked = true;
        }
        
        if (monsterData.isShopkeeper) {
            const isShopkeeperCheckbox = form.querySelector('#isShopkeeper');
            if (isShopkeeperCheckbox) isShopkeeperCheckbox.checked = true;
        }
        
        // Update preview
        this.updateMonsterPreview(form);
    }
    
    updateMonsterPreview(form) {
        const formData = this.getFormData(form);
        const jsonString = JSON.stringify(formData, null, 2);
        
        // Update preview
        const previewTextarea = form.querySelector('#monster-json-preview');
        if (previewTextarea) previewTextarea.value = jsonString;
    }
    
    getFormData(form) {
        const formData = {};
        
        // Get basic fields
        form.querySelectorAll('input:not([type="checkbox"]):not([id^="ai_"]):not([id^="spell_"]), select:not([id="behaviorType"])').forEach(input => {
            if (input.id === 'monster-selector') return;
            
            if (input.type === 'number' && input.value) {
                formData[input.name] = parseFloat(input.value);
            } else if (input.value) {
                formData[input.name] = input.value;
            }
        });
        
        // Get checkboxes
        form.querySelectorAll('input[type="checkbox"]:not([id^="spell_"]):not([id="hasMagic"])').forEach(input => {
            formData[input.name] = input.checked;
        });
        
        // Add AI data if behavior type is selected
        const behaviorType = form.querySelector('#behaviorType')?.value;
        if (behaviorType) {
            formData.ai = { behaviorType };
            
            // Add other AI fields
            form.querySelectorAll('input[id^="ai_"]').forEach(input => {
                if (input.value) {
                    const key = input.id.replace('ai_', '');
                    formData.ai[key] = input.type === 'number' ? parseFloat(input.value) : input.value;
                }
            });
        }
        
        // Add spells if hasMagic is checked
        const hasMagic = form.querySelector('#hasMagic')?.checked;
        if (hasMagic) {
            formData.spells = [];
            form.querySelectorAll('input[id^="spell_"]:checked').forEach(input => {
                formData.spells.push(input.dataset.spellId);
            });
        }
        
        return formData;
    }
    
    createMonsterTemplate(form, spawnMonster = false) {
        const formData = this.getFormData(form);
        
        // Validate required fields
        const requiredFields = ['id', 'name', 'char', 'color', 'hp', 'strength', 'defense', 'xp'];
        const missingFields = requiredFields.filter(field => !formData[field]);
        
        if (missingFields.length > 0) {
            alert(`Missing required fields: ${missingFields.join(', ')}`);
            return false;
        }
        
        // Check if monster ID already exists
        const factory = this.entityFactory || window.game?.entityFactory;
        if (factory?.monsterTemplates && factory.monsterTemplates[formData.id]) {
            if (!confirm(`A monster with ID "${formData.id}" already exists. Overwrite it?`)) {
                return false;
            }
        }
        
        return this.finalizeMonsterCreation(formData, spawnMonster, form);
    }
    
    finalizeMonsterCreation(formData, spawnMonster, form) {
        const factory = this.entityFactory || window.game?.entityFactory;
        
        if (factory) {
            factory.monsterTemplates[formData.id] = formData;
            console.log(`Created monster template: ${formData.id}`);
            
            if (spawnMonster) {
                const player = gameState.player;
                if (player) {
                    const monster = factory.createMonster(
                        formData.id, 
                        player.position.x + 1, // Spawn next to player
                        player.position.y
                    );
                    
                    if (monster) {
                        gameState.addEntity(monster);
                        gameState.addMessage(`Created monster: ${formData.name}`, "important");
                        eventBus.emit('hideCreator');
                    }
                }
            } else {
                gameState.addMessage(`Monster template "${formData.name}" created successfully!`, "important");
            }
            return true;
        } else {
            alert('Error: EntityFactory not found! Please reload the game.');
            return false;
        }
    }
    
    getMonsterTemplates() {
        // Try to get monsters from entityFactory
        if (this.entityFactory && this.entityFactory.monsterTemplates) {
            return this.entityFactory.monsterTemplates;
        }
        
        // Try to get from window.game
        if (window.game && window.game.entityFactory && window.game.entityFactory.monsterTemplates) {
            return window.game.entityFactory.monsterTemplates;
        }
        
        // Try to get from gameState
        if (gameState.data && gameState.data.monsters) {
            const templates = {};
            gameState.data.monsters.forEach(monster => templates[monster.id] = monster);
            return templates;
        }
        
        console.warn('Could not find any monster templates');
        return null;
    }
    
    getSpellTemplates() {
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
            gameState.data.spellbooks.forEach(spell => templates[spell.id] = spell);
            return templates;
        }
        
        return null;
    }
}

export default new MonsterCreator();
