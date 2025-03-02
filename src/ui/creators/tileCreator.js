// ui/creators/tileCreator.js
import gameState from '../../core/gameState.js';
import eventBus from '../../core/eventEmitter.js';
import tileManager from '../../world/tileManager.js';

class TileCreator {
    constructor() {
        this.show = this.show.bind(this);
        this.createTileTemplate = this.createTileTemplate.bind(this);
        this.updateTilePreview = this.updateTilePreview.bind(this);
    }
    
    async show(container) {
        if (!tileManager.initialized) {
            await tileManager.initialize();
        }
        
        const form = document.createElement('div');
        form.className = 'tile-creator-form';
        
        const header = document.createElement('h3');
        header.textContent = 'Create/Edit Tile';
        header.style.color = '#99aacc';
        header.style.marginBottom = '15px';
        form.appendChild(header);
        
        this.addTileSelector(form);
        
        const fields = [
            { name: 'id', label: 'ID', placeholder: 'unique_tile_id', required: true },
            { name: 'name', label: 'Name', placeholder: 'Tile Name', required: true },
            { name: 'char', label: 'Character', placeholder: '#', required: true },
            { name: 'color', label: 'Color', placeholder: '#aaaaaa', required: true, type: 'color' },
            { name: 'blocked', label: 'Blocks Movement', type: 'checkbox' },
            { name: 'blocksSight', label: 'Blocks Sight', type: 'checkbox' },
            { name: 'interactive', label: 'Is Interactive', type: 'checkbox' },
            { name: 'actionName', label: 'Action Name', placeholder: 'use', condition: 'interactive', conditionValues: ['true'] },
            { name: 'description', label: 'Description', placeholder: 'Describe the tile...', required: true, type: 'textarea' },
            { name: 'movementCost', label: 'Movement Cost', type: 'number', placeholder: '1.0' }
        ];
        
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
            if (field.type === 'textarea') {
                input = document.createElement('textarea');
                input.name = field.name;
                input.id = field.name;
                input.placeholder = field.placeholder || '';
                input.required = field.required;
                input.rows = 3;
            } else if (field.type === 'checkbox') {
                input = document.createElement('input');
                input.type = 'checkbox';
                input.name = field.name;
                input.id = field.name;
            } else {
                input = document.createElement('input');
                input.type = field.type || 'text';
                input.name = field.name;
                input.id = field.name;
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
                
                const conditionEl = form.querySelector(`#${field.condition}`);
                if (conditionEl && !field.conditionValues.includes(conditionEl.checked.toString())) {
                    label.style.display = 'none';
                    input.style.display = 'none';
                }
            }
            
            fieldContainer.appendChild(label);
            fieldContainer.appendChild(input);
            
            input.addEventListener('input', () => this.updateTilePreview(form));
            input.addEventListener('change', () => {
                this.updateTilePreview(form);
                
                if (input.id === 'interactive') {
                    const conditionalFields = form.querySelectorAll(`[data-condition="interactive"]`);
                    conditionalFields.forEach(el => {
                        const validValues = el.dataset.conditionValues.split(',');
                        el.style.display = validValues.includes(input.checked.toString()) ? '' : 'none';
                    });
                }
            });
        });
        
        form.appendChild(fieldContainer);
        
        this.addStatesSection(form);
        
        const previewSection = document.createElement('div');
        previewSection.className = 'tile-preview-section';
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
        previewTextarea.id = 'tile-json-preview';
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
            form.querySelectorAll('input, select, textarea').forEach(input => {
                if (input.type === 'checkbox') input.checked = false;
                else input.value = '';
            });
            this.updateTilePreview(form);
        });
        
        const createButton = document.createElement('button');
        createButton.textContent = 'Save Tile';
        createButton.style.padding = '8px 16px';
        createButton.style.backgroundColor = '#2a6';
        createButton.style.border = 'none';
        createButton.style.borderRadius = '3px';
        createButton.style.color = '#fff';
        createButton.style.cursor = 'pointer';
        createButton.addEventListener('click', () => this.createTileTemplate(form));
        
        buttonContainer.appendChild(resetButton);
        buttonContainer.appendChild(createButton);
        form.appendChild(buttonContainer);
        
        container.appendChild(form);
        this.updateTilePreview(form);
    }
    
    addTileSelector(form) {
        const section = document.createElement('div');
        section.style.marginBottom = '20px';
        section.style.padding = '10px';
        section.style.backgroundColor = 'rgba(40, 50, 90, 0.2)';
        section.style.border = '1px solid #556688';
        section.style.borderRadius = '5px';
        
        const label = document.createElement('label');
        label.textContent = 'Load existing tile:';
        label.style.fontWeight = 'bold';
        label.style.display = 'block';
        label.style.marginBottom = '5px';
        
        const select = document.createElement('select');
        select.id = 'tile-selector';
        select.style.width = '100%';
        select.style.padding = '8px';
        select.style.margin = '5px 0';
        select.style.backgroundColor = 'rgba(40, 40, 60, 0.7)';
        select.style.color = '#fff';
        select.style.border = '1px solid #555';
        select.style.borderRadius = '3px';
        
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = '-- Select a tile --';
        select.appendChild(defaultOption);
        
        if (tileManager.initialized) {
            const tileIds = Array.from(tileManager.tilesByName.keys()).sort();
            
            tileIds.forEach(id => {
                const tile = tileManager.getTileById(id);
                if (tile) {
                    const option = document.createElement('option');
                    option.value = id;
                    option.textContent = tile.name || id;
                    select.appendChild(option);
                }
            });
        }
        
        const buttonGroup = document.createElement('div');
        buttonGroup.style.display = 'grid';
        buttonGroup.style.gridTemplateColumns = '1fr 1fr';
        buttonGroup.style.gap = '5px';
        buttonGroup.style.marginTop = '5px';
        
        const newBtn = document.createElement('button');
        newBtn.textContent = 'Create New Tile';
        newBtn.style.padding = '8px';
        newBtn.style.backgroundColor = '#22aa66';
        newBtn.style.color = '#fff';
        newBtn.style.border = 'none';
        newBtn.style.borderRadius = '3px';
        newBtn.style.cursor = 'pointer';
        
        newBtn.addEventListener('click', () => {
            this.createNewTile(form);
        });
        
        const loadBtn = document.createElement('button');
        loadBtn.textContent = 'Load Tile';
        loadBtn.style.padding = '8px';
        loadBtn.style.backgroundColor = '#5577cc';
        loadBtn.style.color = '#fff';
        loadBtn.style.border = 'none';
        loadBtn.style.borderRadius = '3px';
        loadBtn.style.cursor = 'pointer';
        
        loadBtn.addEventListener('click', () => {
            const tileId = select.value;
            if (!tileId) {
                alert('Please select a tile to load');
                return;
            }
            
            const tile = tileManager.getTileById(tileId);
            if (tile) {
                this.populateForm(form, tile);
            } else {
                alert('Error: Could not find the selected tile');
            }
        });
        
        const dupBtn = document.createElement('button');
        dupBtn.textContent = 'Duplicate Tile';
        dupBtn.style.padding = '8px';
        dupBtn.style.backgroundColor = '#557799';
        dupBtn.style.color = '#fff';
        dupBtn.style.border = 'none';
        dupBtn.style.borderRadius = '3px';
        dupBtn.style.cursor = 'pointer';
        
        dupBtn.addEventListener('click', () => {
            const tileId = select.value;
            if (!tileId) {
                alert('Please select a tile to duplicate');
                return;
            }
            
            const tile = tileManager.getTileById(tileId);
            if (tile) {
                const duplicate = JSON.parse(JSON.stringify(tile));
                duplicate.id = `${tile.id}_copy`;
                duplicate.name = `${tile.name} (Copy)`;
                
                this.populateForm(form, duplicate);
            } else {
                alert('Error: Could not find the selected tile');
            }
        });
        
        buttonGroup.appendChild(loadBtn);
        buttonGroup.appendChild(dupBtn);
        
        section.appendChild(label);
        section.appendChild(select);
        section.appendChild(buttonGroup);
        section.appendChild(newBtn);
        form.appendChild(section);
    }
    
    createNewTile(form) {
        const nextTypeId = this.getNextTypeId();
        
        const newTile = {
            id: "new_tile_" + nextTypeId,
            typeId: nextTypeId,
            name: "New Tile",
            char: "?",
            color: "#66ccff",
            blocked: false,
            blocksSight: false,
            interactive: false,
            description: "A new tile type. Edit its properties and save it."
        };
        
        this.populateForm(form, newTile);
        gameState.addMessage("Created a new tile template. Edit its properties and click 'Save Tile' when done.", "important");
    }
    
    getNextTypeId() {
        if (!tileManager.tileDefinitions || tileManager.tileDefinitions.size === 0) {
            return 100; // Start at a high number to avoid conflicts
        }
        
        const maxTypeId = Array.from(tileManager.tileDefinitions.keys())
            .reduce((max, current) => Math.max(max, parseInt(current)), 0);
        return maxTypeId + 1;
    }
    
    addStatesSection(form) {
        const statesSection = document.createElement('div');
        statesSection.id = 'states-section';
        statesSection.className = 'states-section';
        statesSection.style.marginTop = '20px';
        statesSection.style.padding = '10px';
        statesSection.style.backgroundColor = 'rgba(40, 55, 60, 0.3)';
        statesSection.style.border = '1px solid #557788';
        statesSection.style.borderRadius = '5px';
        
        const statesHeader = document.createElement('h4');
        statesHeader.textContent = 'Tile States';
        statesHeader.style.marginBottom = '10px';
        statesHeader.style.color = '#77ccee';
        
        const hasStatesContainer = document.createElement('div');
        
        const hasStatesCheckbox = document.createElement('input');
        hasStatesCheckbox.type = 'checkbox';
        hasStatesCheckbox.id = 'hasStates';
        hasStatesCheckbox.name = 'hasStates';
        
        const hasStatesLabel = document.createElement('label');
        hasStatesLabel.htmlFor = 'hasStates';
        hasStatesLabel.textContent = 'This tile has multiple states';
        hasStatesLabel.style.marginLeft = '5px';
        
        hasStatesContainer.appendChild(hasStatesCheckbox);
        hasStatesContainer.appendChild(hasStatesLabel);
        
        const statesContainer = document.createElement('div');
        statesContainer.id = 'states-container';
        statesContainer.style.marginTop = '10px';
        statesContainer.style.display = 'none';
        
        const openState = {
            id: 'open',
            name: 'Open',
            char: "'",
            blocked: false,
            blocksSight: false
        };
        
        const closedState = {
            id: 'closed', 
            name: 'Closed',
            char: '+',
            blocked: true,
            blocksSight: true
        };
        
        const states = [openState, closedState];
        
        states.forEach((state, index) => {
            const stateBox = document.createElement('div');
            stateBox.style.border = '1px solid #556';
            stateBox.style.padding = '10px';
            stateBox.style.marginBottom = '10px';
            stateBox.style.borderRadius = '5px';
            
            const stateHeader = document.createElement('h5');
            stateHeader.textContent = `State ${index + 1}: ${state.name}`;
            stateHeader.style.marginBottom = '8px';
            stateBox.appendChild(stateHeader);
            
            const stateProps = [
                { name: `state${index}_id`, label: 'ID', value: state.id },
                { name: `state${index}_name`, label: 'Name', value: state.name },
                { name: `state${index}_char`, label: 'Character', value: state.char }
            ];
            
            const stateGrid = document.createElement('div');
            stateGrid.style.display = 'grid';
            stateGrid.style.gridTemplateColumns = 'auto 1fr';
            stateGrid.style.gap = '5px';
            
            stateProps.forEach(prop => {
                const propLabel = document.createElement('label');
                propLabel.textContent = prop.label;
                propLabel.style.fontWeight = 'bold';
                
                const propInput = document.createElement('input');
                propInput.type = 'text';
                propInput.name = prop.name;
                propInput.id = prop.name;
                propInput.value = prop.value;
                propInput.style.padding = '3px';
                propInput.style.backgroundColor = 'rgba(40, 40, 60, 0.7)';
                propInput.style.border = '1px solid #555';
                propInput.style.borderRadius = '3px';
                propInput.style.color = '#fff';
                
                propInput.addEventListener('input', () => this.updateTilePreview(form));
                
                stateGrid.appendChild(propLabel);
                stateGrid.appendChild(propInput);
            });
            
            const propCheckboxes = [
                { name: `state${index}_blocked`, label: 'Blocks Movement', checked: state.blocked },
                { name: `state${index}_blocksSight`, label: 'Blocks Sight', checked: state.blocksSight }
            ];
            
            propCheckboxes.forEach(prop => {
                const checkContainer = document.createElement('div');
                checkContainer.style.gridColumn = '1 / 3';
                checkContainer.style.marginTop = '5px';
                
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.name = prop.name;
                checkbox.id = prop.name;
                checkbox.checked = prop.checked;
                
                const checkLabel = document.createElement('label');
                checkLabel.htmlFor = prop.name;
                checkLabel.textContent = prop.label;
                checkLabel.style.marginLeft = '5px';
                
                checkbox.addEventListener('change', () => this.updateTilePreview(form));
                
                checkContainer.appendChild(checkbox);
                checkContainer.appendChild(checkLabel);
                stateGrid.appendChild(checkContainer);
            });
            
            stateBox.appendChild(stateGrid);
            statesContainer.appendChild(stateBox);
        });
        
        hasStatesCheckbox.addEventListener('change', () => {
            statesContainer.style.display = hasStatesCheckbox.checked ? 'block' : 'none';
            this.updateTilePreview(form);
        });
        
        statesSection.appendChild(statesHeader);
        statesSection.appendChild(hasStatesContainer);
        statesSection.appendChild(statesContainer);
        form.appendChild(statesSection);
    }
    
    populateForm(form, tileData) {
        console.log('Loading tile data:', tileData);
        
        form.querySelectorAll('input, select, textarea').forEach(input => {
            if (input.type === 'checkbox') input.checked = false;
            else input.value = '';
        });
        
        Object.entries(tileData).forEach(([key, value]) => {
            if (key !== 'states' && typeof value !== 'object') {
                const input = form.querySelector(`[id="${key}"]`);
                if (input) {
                    if (input.type === 'checkbox') {
                        input.checked = !!value;
                    } else {
                        input.value = value;
                    }
                }
            }
        });
        
        if (tileData.states && tileData.states.length > 0) {
            const hasStatesCheckbox = form.querySelector('#hasStates');
            if (hasStatesCheckbox) {
                hasStatesCheckbox.checked = true;
                
                const statesContainer = form.querySelector('#states-container');
                if (statesContainer) statesContainer.style.display = 'block';
                
                tileData.states.forEach((state, index) => {
                    const idInput = form.querySelector(`[id="state${index}_id"]`);
                    const nameInput = form.querySelector(`[id="state${index}_name"]`);
                    const charInput = form.querySelector(`[id="state${index}_char"]`);
                    
                    if (idInput) idInput.value = state.id;
                    if (nameInput) nameInput.value = state.name;
                    if (charInput) charInput.value = state.char;
                    
                    if (form.querySelector(`[id="state${index}_blocked"]`)) {
                        form.querySelector(`[id="state${index}_blocked"]`).checked = !!state.blocked;
                    }
                    if (form.querySelector(`[id="state${index}_blocksSight"]`)) {
                        form.querySelector(`[id="state${index}_blocksSight"]`).checked = !!state.blocksSight;
                    }
                });
            }
        }
        
        if (tileData.interactive) {
            const conditionalFields = form.querySelectorAll(`[data-condition="interactive"]`);
            conditionalFields.forEach(el => {
                const validValues = el.dataset.conditionValues.split(',');
                el.style.display = validValues.includes('true') ? '' : 'none';
            });
        }
        
        this.updateTilePreview(form);
    }
    
    updateTilePreview(form) {
        const formData = this.getFormData(form);
        const jsonString = JSON.stringify(formData, null, 2);
        
        const previewTextarea = form.querySelector('#tile-json-preview');
        if (previewTextarea) previewTextarea.value = jsonString;
    }
    
    getFormData(form) {
        const formData = {};
        
        form.querySelectorAll('input:not([id^="state"]), textarea, select').forEach(input => {
            if (input.id === 'tile-selector' || input.id === 'hasStates') return;
            
            if (input.type === 'checkbox') {
                formData[input.name] = input.checked;
            } else if (input.type === 'number' && input.value) {
                formData[input.name] = parseFloat(input.value);
            } else if (input.value) {
                formData[input.name] = input.value;
            }
        });
        
        const hasStates = form.querySelector('#hasStates')?.checked;
        if (hasStates) {
            formData.states = [];
            
            for (let i = 0; i < 2; i++) {
                const stateId = form.querySelector(`[id="state${i}_id"]`)?.value;
                const stateName = form.querySelector(`[id="state${i}_name"]`)?.value;
                const stateChar = form.querySelector(`[id="state${i}_char"]`)?.value;
                const stateBlocked = form.querySelector(`[id="state${i}_blocked"]`)?.checked;
                const stateBlocksSight = form.querySelector(`[id="state${i}_blocksSight"]`)?.checked;
                
                if (stateId && stateName && stateChar !== undefined) {
                    formData.states.push({
                        id: stateId,
                        name: stateName,
                        char: stateChar,
                        blocked: stateBlocked,
                        blocksSight: stateBlocksSight
                    });
                }
            }
        }
        
        if (formData.movementCost) {
            formData.movementCost = parseFloat(formData.movementCost);
        }
        
        ['blocked', 'blocksSight', 'interactive'].forEach(prop => {
            if (formData[prop] === undefined) {
                formData[prop] = false;
            }
        });
        
        return formData;
    }
    
    createTileTemplate(form) {
        const formData = this.getFormData(form);
        
        const requiredFields = ['id', 'name', 'char', 'color', 'description'];
        const missingFields = requiredFields.filter(field => !formData[field]);
        
        if (missingFields.length > 0) {
            alert(`Missing required fields: ${missingFields.join(', ')}`);
            return false;
        }
        
        const existingTile = tileManager.getTileById(formData.id);
        const isUpdate = existingTile !== null;
        
        if (isUpdate) {
            if (!confirm(`A tile with ID "${formData.id}" already exists. Overwrite it?`)) {
                return false;
            }
            
            formData.typeId = existingTile.typeId;
        } else {
            const maxTypeId = Array.from(tileManager.tileDefinitions.keys())
                .reduce((max, current) => Math.max(max, parseInt(current)), 0);
            formData.typeId = maxTypeId + 1;
        }
        
        try {
            console.log('Saving tile with typeId:', formData.typeId, 'and id:', formData.id);
            
            tileManager.tileDefinitions.set(formData.typeId, formData);
            tileManager.tilesByName.set(formData.id, formData);
            
            console.log(`Tile data saved: typeId=${formData.typeId}, id=${formData.id}`);
            console.log('Current tiles in manager:', Array.from(tileManager.tilesByName.keys()));
            
            const actionText = isUpdate ? 'updated' : 'created';
            gameState.addMessage(`Tile "${formData.name}" ${actionText} successfully!`, "important");
            
            return true;
        } catch (error) {
            console.error('Error saving tile:', error);
            alert(`Error saving tile: ${error.message}`);
            return false;
        }
    }
}

export default new TileCreator();
