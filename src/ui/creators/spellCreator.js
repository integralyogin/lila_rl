import gameState from '../../core/gameState.js';
import eventBus from '../../core/eventEmitter.js';

class SpellCreator {
    constructor() {
        this.entityFactory = null;
        
        // Spell element options based on your existing spells
        this.elementOptions = [
            'fire', 'ice', 'lightning', 'arcane', 'nature', 
            'radiant', 'life', 'neutral', 'shadow', 'physical'
        ];
        
        // Spell type options based on your spell implementation categories
        this.spellTypeOptions = [
            'bolt', 'aoe', 'aura', 'utility', 'summon', 'transform'
        ];
        
        // Effect options based on your existing spells
        this.effectOptions = [
            { id: 'damage', label: 'Damage' },
            { id: 'heal', label: 'Healing' },
            { id: 'slow', label: 'Slow' },
            { id: 'fear', label: 'Fear' },
            { id: 'stun', label: 'Stun' },
            { id: 'area_effect', label: 'Area Effect' },
            { id: 'chain', label: 'Chain Lightning' },
            { id: 'defense_boost', label: 'Defense Boost' },
            { id: 'damage_over_time', label: 'Damage Over Time' },
            { id: 'light', label: 'Light' },
            { id: 'visibility_boost', label: 'Visibility Boost' },
            { id: 'teleport', label: 'Teleport' },
            { id: 'summon', label: 'Summon' },
            { id: 'transform', label: 'Transform' },
            { id: 'shapeshift', label: 'Shapeshift' }
        ];
        
        // Tag options based on your existing spells
        this.tagOptions = [
            { id: 'attack', label: 'Attack' },
            { id: 'healing', label: 'Healing' },
            { id: 'buff', label: 'Buff' },
            { id: 'debuff', label: 'Debuff' },
            { id: 'fire', label: 'Fire' },
            { id: 'ice', label: 'Ice' },
            { id: 'lightning', label: 'Lightning' },
            { id: 'nature', label: 'Nature' },
            { id: 'arcane', label: 'Arcane' },
            { id: 'radiant', label: 'Radiant' },
            { id: 'light', label: 'Light' },
            { id: 'direct', label: 'Direct' },
            { id: 'area', label: 'Area' },
            { id: 'target', label: 'Target' },
            { id: 'self', label: 'Self' },
            { id: 'utility', label: 'Utility' },
            { id: 'bolt', label: 'Bolt' },
            { id: 'wave', label: 'Wave' },
            { id: 'aura', label: 'Aura' },
            { id: 'persistent', label: 'Persistent' },
            { id: 'impact', label: 'Impact' },
            { id: 'summoning', label: 'Summoning' },
            { id: 'creature', label: 'Creature' },
            { id: 'transformation', label: 'Transformation' },
            { id: 'selection', label: 'Selection' },
            { id: 'teleport', label: 'Teleport' },
            { id: 'chain', label: 'Chain' }
        ];
        
        // Bind methods
        this.show = this.show.bind(this);
        this.createSpellTemplate = this.createSpellTemplate.bind(this);
        this.finalizeSpellCreation = this.finalizeSpellCreation.bind(this);
        this.updateSpellPreview = this.updateSpellPreview.bind(this);
        this.updateFormBasedOnType = this.updateFormBasedOnType.bind(this);
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
        form.style.maxHeight = '70vh';
        form.style.overflowY = 'auto';
        form.style.padding = '10px';
        
        // Header
        const header = document.createElement('h3');
        header.textContent = 'Create New Spell';
        header.style.color = '#bb99ff';
        header.style.marginBottom = '15px';
        form.appendChild(header);
        
        // Spell Type Selector (this will control what fields are shown)
        const spellTypeSection = document.createElement('div');
        spellTypeSection.className = 'spell-type-selector';
        spellTypeSection.style.marginBottom = '20px';
        
        const spellTypeLabel = document.createElement('label');
        spellTypeLabel.textContent = 'Spell Implementation Type: *';
        spellTypeLabel.style.fontWeight = 'bold';
        spellTypeLabel.style.display = 'block';
        spellTypeLabel.style.marginBottom = '5px';
        
        const spellTypeSelect = document.createElement('select');
        spellTypeSelect.name = 'implementationType';
        spellTypeSelect.id = 'implementationType';
        spellTypeSelect.style.padding = '8px';
        spellTypeSelect.style.width = '100%';
        spellTypeSelect.style.backgroundColor = 'rgba(40, 40, 60, 0.7)';
        spellTypeSelect.style.border = '1px solid #555';
        spellTypeSelect.style.borderRadius = '3px';
        spellTypeSelect.style.color = '#fff';
        
        // Add an initial empty option
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = '-- Select Spell Type --';
        spellTypeSelect.appendChild(defaultOption);
        
        // Add spell type options
        this.spellTypeOptions.forEach(type => {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = type.charAt(0).toUpperCase() + type.slice(1);
            spellTypeSelect.appendChild(option);
        });
        
        spellTypeSection.appendChild(spellTypeLabel);
        spellTypeSection.appendChild(spellTypeSelect);
        form.appendChild(spellTypeSection);
        
        // Create inputs for basic properties
        const basicFields = [
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
                options: this.elementOptions, 
                required: true 
            }
        ];
        
        // Create fieldsets for organized form layout
        const basicInfoFieldset = document.createElement('fieldset');
        basicInfoFieldset.style.border = '1px solid #444';
        basicInfoFieldset.style.borderRadius = '5px';
        basicInfoFieldset.style.padding = '15px';
        basicInfoFieldset.style.marginBottom = '20px';
        
        const basicLegend = document.createElement('legend');
        basicLegend.textContent = 'Basic Information';
        basicLegend.style.color = '#bb99ff';
        basicLegend.style.padding = '0 10px';
        basicInfoFieldset.appendChild(basicLegend);
        
        // Create form fields for basic info
        const basicFieldContainer = document.createElement('div');
        basicFieldContainer.className = 'form-fields';
        basicFieldContainer.style.display = 'grid';
        basicFieldContainer.style.gridTemplateColumns = 'auto 1fr';
        basicFieldContainer.style.gap = '10px';
        basicFieldContainer.style.alignItems = 'center';
        
        basicFields.forEach(field => {
            if (field.type === 'hidden') {
                const hiddenInput = document.createElement('input');
                hiddenInput.type = 'hidden';
                hiddenInput.name = field.name;
                hiddenInput.value = field.value || '';
                basicFieldContainer.appendChild(hiddenInput);
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
            } else {
                input = document.createElement('input');
                input.type = field.type || 'text';
                input.name = field.name;
                input.placeholder = field.placeholder || '';
                input.required = field.required;
            }
            
            input.style.padding = '5px';
            input.style.backgroundColor = 'rgba(40, 40, 60, 0.7)';
            input.style.border = '1px solid #555';
            input.style.borderRadius = '3px';
            input.style.color = '#fff';
            
            basicFieldContainer.appendChild(label);
            basicFieldContainer.appendChild(input);
        });
        
        basicInfoFieldset.appendChild(basicFieldContainer);
        form.appendChild(basicInfoFieldset);
        
        // Mechanics section
        const mechanicsFieldset = document.createElement('fieldset');
        mechanicsFieldset.style.border = '1px solid #444';
        mechanicsFieldset.style.borderRadius = '5px';
        mechanicsFieldset.style.padding = '15px';
        mechanicsFieldset.style.marginBottom = '20px';
        
        const mechanicsLegend = document.createElement('legend');
        mechanicsLegend.textContent = 'Spell Mechanics';
        mechanicsLegend.style.color = '#bb99ff';
        mechanicsLegend.style.padding = '0 10px';
        mechanicsFieldset.appendChild(mechanicsLegend);
        
        // Create mechanics fields container
        const mechanicsContainer = document.createElement('div');
        mechanicsContainer.className = 'form-fields';
        mechanicsContainer.style.display = 'grid';
        mechanicsContainer.style.gridTemplateColumns = 'auto 1fr';
        mechanicsContainer.style.gap = '10px';
        mechanicsContainer.style.alignItems = 'center';
        
        // Common mechanics fields
        const mechanicsFields = [
            { name: 'manaCost', label: 'Mana Cost', type: 'number', placeholder: '10', required: true },
            { name: 'price', label: 'Value (Gold)', type: 'number', placeholder: '100', required: true }
        ];
        
        // Add common mechanics fields
        mechanicsFields.forEach(field => {
            const label = document.createElement('label');
            label.textContent = field.label + (field.required ? ' *' : '');
            label.style.fontWeight = 'bold';
            
            const input = document.createElement('input');
            input.type = field.type || 'text';
            input.name = field.name;
            input.placeholder = field.placeholder || '';
            input.required = field.required;
            if (field.type === 'number') input.min = 0;
            
            input.style.padding = '5px';
            input.style.backgroundColor = 'rgba(40, 40, 60, 0.7)';
            input.style.border = '1px solid #555';
            input.style.borderRadius = '3px';
            input.style.color = '#fff';
            
            mechanicsContainer.appendChild(label);
            mechanicsContainer.appendChild(input);
        });
        
        // Type-specific mechanics fields
        const boltFields = [
            { name: 'baseDamage', label: 'Base Damage', type: 'number', placeholder: '8' },
            { name: 'range', label: 'Range', type: 'number', placeholder: '6' },
            { name: 'intelligenceScale', label: 'Intelligence Scaling', type: 'number', placeholder: '0.5', step: '0.1' }
        ];
        
        const aoeFields = [
            { name: 'baseDamage', label: 'Base Damage', type: 'number', placeholder: '12' },
            { name: 'range', label: 'Range', type: 'number', placeholder: '5' },
            { name: 'aoeRadius', label: 'AoE Radius', type: 'number', placeholder: '2' }
        ];
        
        const auraFields = [
            { name: 'baseDamage', label: 'Base Damage', type: 'number', placeholder: '4' },
            { name: 'range', label: 'Range', type: 'number', placeholder: '1' },
            { name: 'aoeRadius', label: 'Aura Radius', type: 'number', placeholder: '2' },
            { name: 'duration', label: 'Duration (turns)', type: 'number', placeholder: '10' },
            { name: 'turnCost', label: 'Mana per Turn', type: 'number', placeholder: '0.1', step: '0.1' }
        ];
        
        const utilityFields = [
            { name: 'range', label: 'Range', type: 'number', placeholder: '0' },
            { name: 'duration', label: 'Duration (turns)', type: 'number', placeholder: '20' }
        ];
        
        const summonFields = [
            { name: 'range', label: 'Range', type: 'number', placeholder: '3' },
            { name: 'duration', label: 'Duration (turns)', type: 'number', placeholder: '25' },
            { name: 'summonCreatureType', label: 'Creature Type', placeholder: 'hydra' },
            { name: 'summonCreatureName', label: 'Creature Name', placeholder: 'Summoned Hydra' },
            { name: 'summonHp', label: 'Creature HP', type: 'number', placeholder: '25' },
            { name: 'summonStationary', label: 'Is Stationary', type: 'checkbox' }
        ];
        
        const transformFields = [
            { name: 'duration', label: 'Transform Duration', type: 'number', placeholder: '20' }
        ];
        
        // Add type-specific fields (hidden by default)
        const typeSpecificContainers = {};
        
        [
            { type: 'bolt', fields: boltFields },
            { type: 'aoe', fields: aoeFields },
            { type: 'aura', fields: auraFields },
            { type: 'utility', fields: utilityFields },
            { type: 'summon', fields: summonFields },
            { type: 'transform', fields: transformFields }
        ].forEach(({ type, fields }) => {
            const container = document.createElement('div');
            container.id = `${type}-fields`;
            container.className = 'type-specific-fields';
            container.style.display = 'none';
            
            fields.forEach(field => {
                const label = document.createElement('label');
                label.textContent = field.label + (field.required ? ' *' : '');
                label.style.fontWeight = 'bold';
                label.dataset.spellType = type;
                
                let input;
                if (field.type === 'checkbox') {
                    input = document.createElement('input');
                    input.type = 'checkbox';
                    input.name = field.name;
                } else {
                    input = document.createElement('input');
                    input.type = field.type || 'text';
                    input.name = field.name;
                    input.placeholder = field.placeholder || '';
                    if (field.type === 'number') {
                        input.min = 0;
                        if (field.step) input.step = field.step;
                    }
                }
                
                input.dataset.spellType = type;
                input.style.padding = '5px';
                input.style.backgroundColor = 'rgba(40, 40, 60, 0.7)';
                input.style.border = '1px solid #555';
                input.style.borderRadius = '3px';
                input.style.color = '#fff';
                
                container.appendChild(label);
                container.appendChild(input);
            });
            
            container.style.display = 'grid';
            container.style.gridTemplateColumns = 'auto 1fr';
            container.style.gap = '10px';
            container.style.alignItems = 'center';
            
            mechanicsContainer.appendChild(container);
            typeSpecificContainers[type] = container;
        });
        
        mechanicsFieldset.appendChild(mechanicsContainer);
        form.appendChild(mechanicsFieldset);
        
        // Add effects section
        const effectsFieldset = document.createElement('fieldset');
        effectsFieldset.className = 'effects-section';
        effectsFieldset.style.border = '1px solid #444';
        effectsFieldset.style.borderRadius = '5px';
        effectsFieldset.style.padding = '15px';
        effectsFieldset.style.marginBottom = '20px';
        
        const effectsLegend = document.createElement('legend');
        effectsLegend.textContent = 'Spell Effects';
        effectsLegend.style.color = '#bb99ff';
        effectsLegend.style.padding = '0 10px';
        effectsFieldset.appendChild(effectsLegend);
        
        const effectsContainer = document.createElement('div');
        effectsContainer.style.display = 'grid';
        effectsContainer.style.gridTemplateColumns = 'repeat(3, 1fr)';
        effectsContainer.style.gap = '10px';
        
        this.effectOptions.forEach(effect => {
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
        
        effectsFieldset.appendChild(effectsContainer);
        form.appendChild(effectsFieldset);
        
        // Add tags section
        const tagsFieldset = document.createElement('fieldset');
        tagsFieldset.className = 'tags-section';
        tagsFieldset.style.border = '1px solid #444';
        tagsFieldset.style.borderRadius = '5px';
        tagsFieldset.style.padding = '15px';
        tagsFieldset.style.marginBottom = '20px';
        
        const tagsLegend = document.createElement('legend');
        tagsLegend.textContent = 'Spell Tags';
        tagsLegend.style.color = '#bb99ff';
        tagsLegend.style.padding = '0 10px';
        tagsFieldset.appendChild(tagsLegend);
        
        const tagsContainer = document.createElement('div');
        tagsContainer.style.display = 'grid';
        tagsContainer.style.gridTemplateColumns = 'repeat(3, 1fr)';
        tagsContainer.style.gap = '10px';
        
        this.tagOptions.forEach(tag => {
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
        
        tagsFieldset.appendChild(tagsContainer);
        form.appendChild(tagsFieldset);
        
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
        previewTextarea.style.height = '200px';
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
        
        const learnButton = document.createElement('button');
        learnButton.textContent = 'Create & Learn';
        learnButton.style.padding = '8px 16px';
        learnButton.style.backgroundColor = '#26a';
        learnButton.style.border = 'none';
        learnButton.style.borderRadius = '3px';
        learnButton.style.color = '#fff';
        learnButton.style.cursor = 'pointer';
        learnButton.addEventListener('click', () => {
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
            // Reset spell type selector
            spellTypeSelect.value = '';
            // Hide all type-specific fields
            document.querySelectorAll('.type-specific-fields').forEach(container => {
                container.style.display = 'none';
            });
            this.updateSpellPreview(form);
        });
        
        buttonContainer.appendChild(resetButton);
        buttonContainer.appendChild(createButton);
        buttonContainer.appendChild(learnButton);
        form.appendChild(buttonContainer);
        
        // Add event listener for spell type selector
        spellTypeSelect.addEventListener('change', () => {
            this.updateFormBasedOnType(form, spellTypeSelect.value);
            this.updateSpellPreview(form);
        });
        
        // Add event listeners to update preview
        form.querySelectorAll('input, select').forEach(input => {
            input.addEventListener('input', () => this.updateSpellPreview(form));
            input.addEventListener('change', () => this.updateSpellPreview(form));
        });
        
        container.appendChild(form);
        this.updateSpellPreview(form);
    }
    
    updateFormBasedOnType(form, selectedType) {
        // Hide all type-specific fields first
        form.querySelectorAll('.type-specific-fields').forEach(container => {
            container.style.display = 'none';
        });
        
        // Show fields specific to the selected type
        if (selectedType) {
            const container = form.querySelector(`#${selectedType}-fields`);
            if (container) {
                container.style.display = 'grid';
            }
            
            // Pre-check appropriate effects and tags based on spell type
            switch(selectedType) {
                case 'bolt':
                    this.checkDefaultOptionsForType(form, 'effect', ['damage']);
                    this.checkDefaultOptionsForType(form, 'tag', ['attack', 'direct', 'target', 'bolt']);
                    break;
                case 'aoe':
                    this.checkDefaultOptionsForType(form, 'effect', ['damage', 'area_effect']);
                    this.checkDefaultOptionsForType(form, 'tag', ['attack', 'area', 'target']);
                    break;
                case 'aura':
                    this.checkDefaultOptionsForType(form, 'effect', ['damage', 'area_effect', 'damage_over_time']);
                    this.checkDefaultOptionsForType(form, 'tag', ['attack', 'area', 'self', 'aura', 'persistent']);
                    break;
                case 'utility':
                    this.checkDefaultOptionsForType(form, 'effect', ['heal', 'light', 'teleport']);
                    this.checkDefaultOptionsForType(form, 'tag', ['utility', 'self']);
                    break;
                case 'summon':
                    this.checkDefaultOptionsForType(form, 'effect', ['summon']);
                    this.checkDefaultOptionsForType(form, 'tag', ['summoning', 'creature']);
                    break;
                case 'transform':
                    this.checkDefaultOptionsForType(form, 'effect', ['transform', 'shapeshift']);
                    this.checkDefaultOptionsForType(form, 'tag', ['transformation', 'utility']);
                    break;
            }
        }
    }
    
    checkDefaultOptionsForType(form, group, options) {
        // Uncheck all first
        form.querySelectorAll(`input[name^="${group}_"]`).forEach(checkbox => {
            checkbox.checked = false;
        });
        
        // Check the default options for this type
        options.forEach(option => {
            const checkbox = form.querySelector(`#${group}_${option}`);
            if (checkbox) checkbox.checked = true;
        });
    }
    
    updateSpellPreview(form) {
        const formData = {};
        const spellType = form.querySelector('#implementationType').value;
        
        // Get basic fields
        form.querySelectorAll('input:not([data-spell-type]), select:not([data-spell-type])').forEach(input => {
            if (input.name.startsWith('effect_') || input.name.startsWith('tag_')) return;
            if (input.name === 'implementationType') return;
            
            if (input.type === 'checkbox') formData[input.name] = input.checked;
            else if (input.type === 'number' && input.value) formData[input.name] = parseFloat(input.value);
            else if (input.value) formData[input.name] = input.value;
        });
        
        // Get type-specific fields if a type is selected
        if (spellType) {
            form.querySelectorAll(`[data-spell-type="${spellType}"]`).forEach(input => {
                if (input.tagName.toLowerCase() === 'label') return;
                
                if (input.type === 'checkbox') formData[input.name] = input.checked;
                else if (input.type === 'number' && input.value) formData[input.name] = parseFloat(input.value);
                else if (input.value) formData[input.name] = input.value;
            });
            
            // Handle special cases for summon type
            if (spellType === 'summon' && formData.summonCreatureType) {
                formData.summonData = {
                    creatureType: formData.summonCreatureType,
                    name: formData.summonCreatureName || 'Summoned Creature',
                    duration: formData.duration || 25,
                    isStationary: formData.summonStationary || false,
                    hp: formData.summonHp || 20,
                    intelligenceScaling: {
                        hp: 0.8,
                        strength: 0.4,
                        defense: 0.2,
                        intelligence: 0.5
                    }
                };
                
                // Remove individual summon fields from main object
                delete formData.summonCreatureType;
                delete formData.summonCreatureName;
                delete formData.summonStationary;
                delete formData.summonHp;
            }
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
        
        // Format JSON with indentation
        const jsonString = JSON.stringify(formData, null, 2);
        
        // Update preview
        const previewTextarea = form.querySelector('#spell-json-preview');
        if (previewTextarea) previewTextarea.value = jsonString;
    }
    
    createSpellTemplate(form, learnSpell = false) {
        const formData = {};
        const spellType = form.querySelector('#implementationType').value;
        
        // Validate spell type first
        if (!spellType) {
            this.showError(form, 'Please select a spell implementation type');
            return false;
        }
        
        // Get basic fields
        form.querySelectorAll('input:not([data-spell-type]), select:not([data-spell-type])').forEach(input => {
            if (input.name.startsWith('effect_') || input.name.startsWith('tag_')) return;
            if (input.name === 'implementationType') return;
            
            if (input.type === 'checkbox') formData[input.name] = input.checked;
            else if (input.type === 'number' && input.value) formData[input.name] = parseFloat(input.value);
            else if (input.value) formData[input.name] = input.value;
        });
        
        // Get type-specific fields if a type is selected
        form.querySelectorAll(`[data-spell-type="${spellType}"]`).forEach(input => {
            if (input.tagName.toLowerCase() === 'label') return;
            
            if (input.type === 'checkbox') formData[input.name] = input.checked;
            else if (input.type === 'number' && input.value) formData[input.name] = parseFloat(input.value);
            else if (input.value) formData[input.name] = input.value;
        });
        
        // Validate required fields
        const requiredFields = ['id', 'name', 'char', 'color', 'type', 'spellId', 'spellName', 'element', 'manaCost', 'price'];
        
        // Add type-specific required fields
        if (spellType === 'bolt' || spellType === 'aoe' || spellType === 'aura') {
            requiredFields.push('range');
        }
        
        if (spellType === 'aoe') {
            requiredFields.push('aoeRadius');
        }
        
        if (spellType === 'aura') {
            requiredFields.push('duration', 'aoeRadius', 'turnCost');
        }
        
        if (spellType === 'utility' || spellType === 'transform') {
            requiredFields.push('duration');
        }
        
        if (spellType === 'summon') {
            requiredFields.push('duration', 'summonCreatureType');
        }
        
        const missingFields = requiredFields.filter(field => {
            // Special handling for summon fields which might be nested
            if (field === 'summonCreatureType' && formData.summonData?.creatureType) {
                return false;
            }
            return formData[field] === undefined || formData[field] === '';
        });
        
        if (missingFields.length > 0) {
            this.showError(form, `Missing required fields: ${missingFields.join(', ')}`);
            return false;
        }
        
        // Handle summon data
        if (spellType === 'summon' && formData.summonCreatureType) {
            formData.summonData = {
                creatureType: formData.summonCreatureType,
                name: formData.summonCreatureName || 'Summoned Creature',
                duration: formData.duration || 25,
                isStationary: formData.summonStationary || false,
                hp: formData.summonHp || 20,
                intelligenceScaling: {
                    hp: 0.8,
                    strength: 0.4,
                    defense: 0.2,
                    intelligence: 0.5
                }
            };
            
            // Remove individual summon fields from main object
            delete formData.summonCreatureType;
            delete formData.summonCreatureName;
            delete formData.summonStationary;
            delete formData.summonHp;
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
        } else {
            this.showError(form, 'Please select at least one effect for the spell');
            return false;
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
        } else {
            this.showError(form, 'Please select at least one tag for the spell');
            return false;
        }
        
        // Check if spell ID already exists
        const factory = this.entityFactory || window.game?.entityFactory;
        if (factory?.spellbookTemplates[formData.id]) {
            return this.showConfirmDialog(
                `A spell with ID "${formData.id}" already exists. Do you want to overwrite it?`,
                () => this.finalizeSpellCreation(formData, learnSpell, form)
            );
        }
        
        return this.finalizeSpellCreation(formData, learnSpell, form);
    }
    
    showError(form, message) {
        console.error(message);
        
        const errorMsg = document.createElement('div');
        errorMsg.style.color = '#ff5555';
        errorMsg.style.marginBottom = '10px';
        errorMsg.style.padding = '5px';
        errorMsg.style.border = '1px solid #ff0000';
        errorMsg.style.backgroundColor = 'rgba(255, 0, 0, 0.1)';
        errorMsg.textContent = message;
        
        // Remove any existing error message
        const existingError = form.querySelector('.error-message');
        if (existingError) {
            existingError.remove();
        }
        
        errorMsg.className = 'error-message';
        
        if (form.firstChild) form.insertBefore(errorMsg, form.firstChild);
        else form.appendChild(errorMsg);
        
        // Scroll to top to make error visible
        form.scrollTop = 0;
        
        setTimeout(() => {
            if (errorMsg.parentNode) errorMsg.parentNode.removeChild(errorMsg);
        }, 5000);
        
        return false;
    }
    
    showConfirmDialog(message, confirmCallback) {
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
        
        const messageEl = document.createElement('p');
        messageEl.textContent = message;
        messageEl.style.marginBottom = '20px';
        
        const buttonContainer = document.createElement('div');
        buttonContainer.style.display = 'flex';
        buttonContainer.style.justifyContent = 'space-around';
        
        const confirmBtn = document.createElement('button');
        confirmBtn.textContent = 'Confirm';
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
        
        confirmDialog.appendChild(messageEl);
        confirmDialog.appendChild(buttonContainer);
        
        document.body.appendChild(confirmDialog);
        
        return new Promise(resolve => {
            confirmBtn.addEventListener('click', () => {
                document.body.removeChild(confirmDialog);
                resolve(confirmCallback());
            });
            
            cancelBtn.addEventListener('click', () => {
                document.body.removeChild(confirmDialog);
                resolve(false);
            });
        });
    }
    
    finalizeSpellCreation(formData, learnSpell, form) {
        const factory = this.entityFactory || window.game?.entityFactory;
        
        if (!factory) {
            this.showError(form, 'Error: EntityFactory not found! Please reload the game.');
            console.error('EntityFactory not found when creating spell');
            return false;
        }
        
        // Add to spellbook templates
        factory.spellbookTemplates[formData.id] = formData;
        console.log(`Created spell template: ${formData.id}`, formData);
        
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
                    range: formData.range || 0,
                    aoeRadius: formData.aoeRadius || 0,
                    duration: formData.duration || 0,
                    turnCost: formData.turnCost || 1,
                    effects: formData.effects || [],
                    tags: formData.tags || [],
                    description: formData.description
                };
                
                // Handle special fields based on spell type
                const spellType = form.querySelector('#implementationType').value;
                
                if (spellType === 'bolt') {
                    spell.intelligenceScale = formData.intelligenceScale || 0.5;
                }
                
                if (spellType === 'summon') {
                    spell.summonData = formData.summonData;
                }
                
                // Learn the spell directly
                player.getComponent('SpellsComponent').learnSpell(formData.spellId, spell);
                gameState.addMessage(`Learned spell: ${formData.spellName}`);
                console.log(`Player learned spell: ${formData.spellId}`, spell);
                
                // Add in-game notification
                gameState.addMessage(`Spell "${formData.spellName}" has been added to your spellbook!`, "important");
                
                // Close the creator UI
                eventBus.emit('hideCreator');
            } else {
                gameState.addMessage(`Error: Player not found or doesn't have spell capability!`, "error");
                return false;
            }
        } else {
            // Add success message to game logs
            gameState.addMessage(`Spell "${formData.spellName}" created successfully!`, "important");
        }
        
        // Add the new spell to spell logic registry if appropriate
        this.registerSpellWithLogic(formData, form.querySelector('#implementationType').value);
        
        return true;
    }
    
    // Register spell with the spell logic system based on its type
    registerSpellWithLogic(spellData, spellType) {
        // Try to access the spell logic system
        const spellLogic = window.spellLogic || window.game?.spellLogic;
        if (!spellLogic || !spellLogic.registerSpell) {
            console.log("Couldn't access spell logic system to register spell");
            return;
        }
        
        try {
            const spellId = spellData.spellId;
            
            switch (spellType) {
                case 'bolt':
                    // Use the registerBoltSpell helper method if available
                    if (spellLogic.registerBoltSpell) {
                        const element = spellData.element;
                        const intelligenceScale = spellData.intelligenceScale || 0.5;
                        const deathMessage = `destroyed by ${spellData.spellName.toLowerCase()}`;
                        const missMessage = `burst of ${element} energy`;
                        const hasSlowEffect = spellData.effects.includes('slow');
                        
                        console.log(`Registering bolt spell ${spellId} with system`);
                        spellLogic.registerBoltSpell(
                            spellId, element, intelligenceScale, 
                            deathMessage, missMessage, hasSlowEffect
                        );
                    } else {
                        // Fallback to register a generic implementation
                        this.registerGenericSpell(spellLogic, spellId, spellData, 'bolt');
                    }
                    break;
                
                case 'aoe':
                    // Register an AoE spell implementation
                    this.registerGenericSpell(spellLogic, spellId, spellData, 'aoe');
                    break;
                    
                case 'aura':
                    // Register with the general aura handler
                    if (spellLogic.hasSpell('aura')) {
                        // Link this spell to use the generic aura implementation
                        spellLogic.registerSpell(spellId, {
                            targetType: 'self',
                            cast: function(spell) {
                                return spellLogic.castSpell('aura', spell);
                            }
                        });
                        console.log(`Registered aura spell ${spellId} with generic aura handler`);
                    } else {
                        this.registerGenericSpell(spellLogic, spellId, spellData, 'aura');
                    }
                    break;
                    
                case 'utility':
                    // Register a utility spell
                    this.registerGenericSpell(spellLogic, spellId, spellData, 'utility');
                    break;
                    
                case 'summon':
                    // Register with the general summon handler if available
                    if (spellLogic.hasSpell('summon')) {
                        // Link this spell to use the generic summon implementation
                        spellLogic.registerSpell(spellId, {
                            targetType: 'location',
                            target: function(spell, callback) {
                                gameState.addMessage(`Choose a location to summon your ${spell.spellName}. Press ESC to cancel.`, "important");
                                const targetingSystem = gameState.getSystem('TargetingSystem');
                                if (targetingSystem) {
                                    targetingSystem.startTargeting(spell, callback);
                                }
                            },
                            cast: function(spell, target) {
                                return spellLogic.castSpell('summon', spell, target);
                            }
                        });
                        console.log(`Registered summon spell ${spellId} with generic summon handler`);
                    } else {
                        this.registerGenericSpell(spellLogic, spellId, spellData, 'summon');
                    }
                    break;
                    
                case 'transform':
                    // Register a transform spell
                    this.registerGenericSpell(spellLogic, spellId, spellData, 'transform');
                    break;
                    
                default:
                    // For any other types, register a minimal implementation
                    this.registerGenericSpell(spellLogic, spellId, spellData, spellType);
                    break;
            }
            
            // Verify registration
            if (spellLogic.hasSpell(spellId)) {
                console.log(`Successfully registered spell implementation for ${spellId}`);
            } else {
                console.warn(`Failed to verify spell registration for ${spellId}`);
            }
            
        } catch (error) {
            console.error("Error registering spell with spell logic system:", error);
        }
    }
    
    // Register a generic spell implementation as fallback
    registerGenericSpell(spellLogic, spellId, spellData, type) {
        try {
            let implementation;
            
            // Create different implementations based on spell type
            switch (type) {
                case 'bolt':
                    implementation = {
                        targetType: 'location',
                        target: function(spell, callback) {
                            gameState.addMessage(`Choose a location for your ${spell.spellName} spell. Press ESC to cancel.`, "important");
                            const targetingSystem = gameState.getSystem('TargetingSystem');
                            if (targetingSystem) {
                                targetingSystem.startTargeting(spell, callback);
                            }
                        },
                        cast: function(spell, target) {
                            // Simple implementation that shows messages but doesn't do much
                            const mana = gameState.player.getComponent('ManaComponent');
                            mana.useMana(spell.manaCost);
                            
                            gameState.addMessage(`You cast ${spell.spellName}, but the spell doesn't seem to have a full implementation.`);
                            gameState.addMessage(`This spell was created with the spell creator and needs a custom implementation.`);
                            
                            return true;
                        }
                    };
                    break;
                    
                case 'aoe':
                    // Try to use fireball as a template
                    if (spellLogic.hasSpell('fireball')) {
                        implementation = {
                            targetType: 'location',
                            target: function(spell, callback) {
                                gameState.addMessage(`Choose a location for your ${spell.spellName} spell. Press ESC to cancel.`, "important");
                                const targetingSystem = gameState.getSystem('TargetingSystem');
                                if (targetingSystem) {
                                    targetingSystem.startTargeting(spell, callback);
                                }
                            },
                            cast: function(spell, target) {
                                // Delegate to fireball with this spell's data
                                return spellLogic.getSpellImplementation('fireball').cast.call(spellLogic, spell, target);
                            }
                        };
                    } else {
                        // Generic implementation
                        implementation = this.createGenericImplementation('location');
                    }
                    break;
                    
                case 'aura':
                    implementation = {
                        targetType: 'self',
                        cast: function(spell) {
                            // Simple implementation
                            const mana = gameState.player.getComponent('ManaComponent');
                            mana.useMana(spell.manaCost);
                            
                            gameState.addMessage(`You cast ${spell.spellName}, surrounding yourself with magical energy.`);
                            gameState.addMessage(`This aura spell was created with the spell creator and needs a proper implementation.`);
                            
                            return true;
                        }
                    };
                    break;
                    
                case 'utility':
                    implementation = {
                        targetType: 'self',
                        cast: function(spell) {
                            // Simple implementation
                            const mana = gameState.player.getComponent('ManaComponent');
                            mana.useMana(spell.manaCost);
                            
                            gameState.addMessage(`You cast ${spell.spellName}.`);
                            
                            // Handle healing effect
                            if (spellData.effects && spellData.effects.includes('heal')) {
                                const player = gameState.player;
                                const health = player.getComponent('HealthComponent');
                                
                                if (health) {
                                    const healAmount = spellData.baseDamage || 10;
                                    health.heal(healAmount);
                                    gameState.addMessage(`You heal for ${healAmount} HP.`);
                                }
                            }
                            
                            return true;
                        }
                    };
                    break;
                    
                default:
                    // Most basic implementation
                    implementation = this.createGenericImplementation('self');
                    break;
            }
            
            // Register the implementation
            console.log(`Registering generic ${type} spell implementation for ${spellId}`);
            spellLogic.registerSpell(spellId, implementation);
            
        } catch (error) {
            console.error(`Error creating generic spell implementation for ${spellId}:`, error);
        }
    }
    
    // Create a most basic spell implementation that at least won't crash
    createGenericImplementation(targetType = 'self') {
        return {
            targetType: targetType,
            cast: function(spell, target) {
                // Get mana component and use mana
                const mana = gameState.player.getComponent('ManaComponent');
                mana.useMana(spell.manaCost);
                
                // Display message
                gameState.addMessage(`You cast ${spell.spellName || "the spell"}.`);
                gameState.addMessage("The spell was created using the spell creator and needs a proper implementation.");
                
                return true;
            }
        };
    }
}

export default new SpellCreator();
