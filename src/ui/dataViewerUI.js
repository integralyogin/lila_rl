import gameState from '../core/gameState.js';
import eventBus from '../core/eventEmitter.js';

/**
 * DataViewerUI - Handles viewing and editing entity data
 */
class DataViewerUI {
    constructor() {
        this.uiElement = null;
        this.currentEntity = null;
        this.visible = false;
        
        // Initialize editing flag
        window.isEditingEntityData = false;
        
        // Bind methods to this instance
        this.showDataViewer = this.showDataViewer.bind(this);
        this.hideDataViewer = this.hideDataViewer.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        
        // Create UI element
        this.createUI();
        
        // Register event listeners
        eventBus.on('showDataViewer', this.showDataViewer);
        eventBus.on('hideDataViewer', this.hideDataViewer);
    }
    
    /**
     * Create the data viewer UI element
     */
    createUI() {
        if (this.uiElement) return;
        
        this.uiElement = document.createElement('div');
        this.uiElement.id = 'data-viewer-ui';
        this.uiElement.className = 'data-viewer-ui';
        this.uiElement.style.position = 'fixed';
        this.uiElement.style.top = '50%';
        this.uiElement.style.left = '50%';
        this.uiElement.style.transform = 'translate(-50%, -50%)';
        this.uiElement.style.width = '600px';
        this.uiElement.style.maxHeight = '80vh';
        this.uiElement.style.backgroundColor = 'rgba(20, 20, 30, 0.95)';
        this.uiElement.style.border = '2px solid #666';
        this.uiElement.style.borderRadius = '5px';
        this.uiElement.style.padding = '10px';
        this.uiElement.style.zIndex = '1001';
        this.uiElement.style.display = 'none';
        this.uiElement.style.color = '#ddd';
        this.uiElement.style.fontFamily = 'monospace';
        this.uiElement.style.overflow = 'auto';
        this.uiElement.style.boxShadow = '0 0 20px rgba(0, 0, 0, 0.5)';
        
        document.body.appendChild(this.uiElement);
    }
    
    /**
     * Display entity data in the viewer
     * @param {Object} entity - The entity to display
     */
    showDataViewer(entity) {
        if (!entity) return;
        
        this.currentEntity = entity;
        this.createUI();
        
        // Save previous game mode
        this.previousGameMode = gameState.gameMode;
        gameState.gameMode = 'data_viewer';
        
        // Add keyboard event listener
        document.addEventListener('keydown', this.handleKeyDown);
        
        // Populate UI with entity data
        this.populateUIWithEntityData();
        
        // Show the UI
        this.uiElement.style.display = 'block';
        this.visible = true;
    }
    
    /**
     * Hide the data viewer
     */
    hideDataViewer() {
        if (this.uiElement) {
            this.uiElement.style.display = 'none';
        }
        
        // Restore previous game mode
        gameState.gameMode = this.previousGameMode || 'exploration';
        
        // Remove keyboard event listener
        document.removeEventListener('keydown', this.handleKeyDown);
        
        this.visible = false;
        this.currentEntity = null;
    }
    
    /**
     * Handle keyboard events
     * @param {KeyboardEvent} event - The keyboard event
     */
    handleKeyDown(event) {
        if (event.key === 'Escape') {
            this.hideDataViewer();
        }
    }
    
    /**
     * Populate the UI with entity data
     */
    populateUIWithEntityData() {
        if (!this.currentEntity || !this.uiElement) return;
        
        // Clear previous content
        this.uiElement.innerHTML = '';
        
        // Create header
        const header = document.createElement('div');
        header.className = 'data-viewer-header';
        header.style.borderBottom = '1px solid #666';
        header.style.marginBottom = '10px';
        header.style.paddingBottom = '10px';
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';
        
        const title = document.createElement('h2');
        title.textContent = `Entity: ${this.currentEntity.name} (ID: ${this.currentEntity.id})`;
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
        closeButton.addEventListener('click', this.hideDataViewer);
        
        header.appendChild(title);
        header.appendChild(closeButton);
        this.uiElement.appendChild(header);
        
        // Create basic info section
        const basicInfo = document.createElement('div');
        basicInfo.className = 'data-viewer-basic-info';
        basicInfo.style.marginBottom = '15px';
        
        const nameLabel = document.createElement('div');
        nameLabel.textContent = 'Name:';
        nameLabel.style.fontWeight = 'bold';
        nameLabel.style.display = 'inline-block';
        nameLabel.style.width = '80px';
        
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.value = this.currentEntity.name;
        nameInput.style.background = 'rgba(40, 40, 50, 0.8)';
        nameInput.style.color = '#fff';
        nameInput.style.border = '1px solid #666';
        nameInput.style.padding = '4px';
        nameInput.style.borderRadius = '3px';
        nameInput.style.width = '200px';
        nameInput.style.userSelect = 'text';
        nameInput.style.webkitUserSelect = 'text';
        nameInput.style.mozUserSelect = 'text';
        nameInput.style.msUserSelect = 'text';
        nameInput.addEventListener('keydown', (e) => {
            // Allow key events to work normally
            e.stopPropagation();
        });
        
        nameInput.addEventListener('focus', () => {
            // Set a global flag to indicate editing is happening
            window.isEditingEntityData = true;
        });
        
        nameInput.addEventListener('blur', () => {
            // Update entity name and reset global flag
            this.currentEntity.name = nameInput.value;
            window.isEditingEntityData = false;
        });
        
        nameInput.addEventListener('change', () => {
            this.currentEntity.name = nameInput.value;
        });
        
        basicInfo.appendChild(nameLabel);
        basicInfo.appendChild(nameInput);
        this.uiElement.appendChild(basicInfo);
        
        // Create components section
        const componentsSection = document.createElement('div');
        componentsSection.className = 'data-viewer-components';
        
        const componentsHeader = document.createElement('h3');
        componentsHeader.textContent = 'Components';
        componentsHeader.style.borderBottom = '1px solid #555';
        componentsHeader.style.paddingBottom = '5px';
        componentsHeader.style.marginBottom = '10px';
        componentsSection.appendChild(componentsHeader);
        
        // Add instruction text
        const instructionText = document.createElement('div');
        instructionText.style.color = '#aaf';
        instructionText.style.fontStyle = 'italic';
        instructionText.style.fontSize = '12px';
        instructionText.style.marginBottom = '15px';
        instructionText.textContent = 'All fields below are editable. Click on any value to modify it. Changes are saved automatically when you click outside the field.';
        componentsSection.appendChild(instructionText);
        
        // Check for special components
        const hasSpells = this.currentEntity.components.has('SpellsComponent');
        const spellsComponent = hasSpells ? this.currentEntity.components.get('SpellsComponent') : null;
        
        const hasAI = this.currentEntity.components.has('AIComponent');
        const aiComponent = hasAI ? this.currentEntity.components.get('AIComponent') : null;
        
        // If entity has spells, create a special spells section
        // Show AI behavior if entity has one
        if (hasAI && aiComponent) {
            const aiSection = document.createElement('div');
            aiSection.className = 'data-viewer-ai';
            aiSection.style.marginBottom = '20px';
            
            const aiHeader = document.createElement('h3');
            aiHeader.textContent = 'AI Behavior';
            aiHeader.style.borderBottom = '1px solid #55aa77';
            aiHeader.style.paddingBottom = '5px';
            aiHeader.style.marginBottom = '10px';
            aiHeader.style.color = '#99ffbb';
            aiSection.appendChild(aiHeader);
            
            // Create AI info
            const aiInfoBox = document.createElement('div');
            aiInfoBox.className = 'ai-info-box';
            aiInfoBox.style.backgroundColor = 'rgba(30, 60, 40, 0.3)';
            aiInfoBox.style.border = '1px solid #55aa77';
            aiInfoBox.style.borderRadius = '5px';
            aiInfoBox.style.padding = '10px';
            
            // Add AI details
            const faction = document.createElement('div');
            faction.innerHTML = `<strong>Faction:</strong> <span style="color: ${
                aiComponent.faction === 'hostile' ? '#ff5555' : 
                aiComponent.faction === 'ally' ? '#55ff55' : 
                aiComponent.faction === 'neutral' ? '#ffff55' : '#aaaaaa'
            };">${aiComponent.faction || 'none'}</span>`;
            aiInfoBox.appendChild(faction);
            
            // AI behavior details
            if (aiComponent.behavior) {
                const behavior = document.createElement('div');
                behavior.innerHTML = `<strong>Behavior:</strong> ${aiComponent.behavior}`;
                aiInfoBox.appendChild(behavior);
            }
            
            if (aiComponent.aggroRange) {
                const aggroRange = document.createElement('div');
                aggroRange.innerHTML = `<strong>Aggro Range:</strong> ${aiComponent.aggroRange}`;
                aiInfoBox.appendChild(aggroRange);
            }
            
            if (aiComponent.fleeThreshold) {
                const fleeThreshold = document.createElement('div');
                fleeThreshold.innerHTML = `<strong>Flee Threshold:</strong> ${aiComponent.fleeThreshold}% HP`;
                aiInfoBox.appendChild(fleeThreshold);
            }
            
            aiSection.appendChild(aiInfoBox);
            this.uiElement.appendChild(aiSection);
            
            // Add description text for AI editor
            const aiEditorNotice = document.createElement('div');
            aiEditorNotice.style.fontSize = '12px';
            aiEditorNotice.style.color = '#aaf';
            aiEditorNotice.style.fontStyle = 'italic';
            aiEditorNotice.style.marginBottom = '15px';
            aiEditorNotice.textContent = 'AI behavior can be modified in the AIComponent below.';
            aiSection.appendChild(aiEditorNotice);
        }

        // If entity has spells, create a special spells section
        if (hasSpells && spellsComponent && spellsComponent.knownSpells.size > 0) {
            const spellsSection = document.createElement('div');
            spellsSection.className = 'data-viewer-spells';
            spellsSection.style.marginBottom = '20px';
            
            const spellsHeader = document.createElement('h3');
            spellsHeader.textContent = 'Known Spells';
            spellsHeader.style.borderBottom = '1px solid #7755aa';
            spellsHeader.style.paddingBottom = '5px';
            spellsHeader.style.marginBottom = '10px';
            spellsHeader.style.color = '#bb99ff';
            spellsSection.appendChild(spellsHeader);
            
            // Create a table for spells
            const spellsTable = document.createElement('table');
            spellsTable.style.width = '100%';
            spellsTable.style.borderCollapse = 'collapse';
            spellsTable.style.marginBottom = '10px';
            
            // Add table header
            const tableHeader = document.createElement('tr');
            tableHeader.innerHTML = `
                <th style="text-align: left; padding: 5px; border-bottom: 1px solid #555; color: #aaf;">Spell</th>
                <th style="text-align: left; padding: 5px; border-bottom: 1px solid #555; color: #aaf;">Element</th>
                <th style="text-align: center; padding: 5px; border-bottom: 1px solid #555; color: #aaf;">Mana Cost</th>
                <th style="text-align: center; padding: 5px; border-bottom: 1px solid #555; color: #aaf;">Damage</th>
                <th style="text-align: center; padding: 5px; border-bottom: 1px solid #555; color: #aaf;">Range</th>
            `;
            spellsTable.appendChild(tableHeader);
            
            // Add spell rows
            spellsComponent.knownSpells.forEach((spell, spellId) => {
                const spellRow = document.createElement('tr');
                
                // Get element color
                let elementColor = '#fff';
                switch(spell.element) {
                    case 'fire': elementColor = '#ff5500'; break;
                    case 'ice': elementColor = '#00ccff'; break;
                    case 'lightning': elementColor = '#ffcc00'; break;
                    case 'nature': elementColor = '#55cc55'; break;
                    case 'arcane': elementColor = '#cc55cc'; break;
                    default: elementColor = '#fff';
                }
                
                spellRow.innerHTML = `
                    <td style="padding: 5px; border-bottom: 1px solid #333;">${spell.spellName || spellId}</td>
                    <td style="padding: 5px; border-bottom: 1px solid #333; color: ${elementColor};">${spell.element || 'none'}</td>
                    <td style="padding: 5px; border-bottom: 1px solid #333; text-align: center;">${spell.manaCost || 0}</td>
                    <td style="padding: 5px; border-bottom: 1px solid #333; text-align: center;">${spell.baseDamage || 0}</td>
                    <td style="padding: 5px; border-bottom: 1px solid #333; text-align: center;">${spell.range || 1}</td>
                `;
                spellsTable.appendChild(spellRow);
            });
            
            spellsSection.appendChild(spellsTable);
            this.uiElement.appendChild(spellsSection);
            
            // Add description text for spell editor
            const spellEditorNotice = document.createElement('div');
            spellEditorNotice.style.fontSize = '12px';
            spellEditorNotice.style.color = '#aaf';
            spellEditorNotice.style.fontStyle = 'italic';
            spellEditorNotice.style.marginBottom = '15px';
            spellEditorNotice.textContent = 'Spell details can also be modified in the SpellsComponent below.';
            spellsSection.appendChild(spellEditorNotice);
        }

        // Process each component
        const components = this.currentEntity.components;
        components.forEach((component, componentName) => {
            const componentDiv = document.createElement('div');
            componentDiv.className = 'data-viewer-component';
            componentDiv.style.marginBottom = '15px';
            
            const componentHeader = document.createElement('div');
            componentHeader.className = 'data-viewer-component-header';
            componentHeader.textContent = componentName;
            componentHeader.style.fontWeight = 'bold';
            componentHeader.style.backgroundColor = 'rgba(60, 60, 80, 0.5)';
            componentHeader.style.padding = '5px';
            componentHeader.style.borderRadius = '3px';
            componentHeader.style.marginBottom = '5px';
            componentDiv.appendChild(componentHeader);
            
            // Get serializable properties from component
            const propertyContainer = document.createElement('div');
            propertyContainer.className = 'data-viewer-properties';
            propertyContainer.style.marginLeft = '15px';
            
            // Convert component to object and remove circular references
            const componentObj = this.serializeComponent(component);
            const componentJson = JSON.stringify(componentObj, null, 2);
            
            const editor = document.createElement('pre');
            editor.className = 'data-viewer-editor';
            editor.textContent = componentJson;
            editor.contentEditable = 'true';
            editor.style.backgroundColor = 'rgba(30, 30, 40, 0.7)';
            editor.style.padding = '10px';
            editor.style.borderRadius = '3px';
            editor.style.maxHeight = '200px';
            editor.style.overflow = 'auto';
            editor.style.whiteSpace = 'pre-wrap';
            editor.style.fontSize = '12px';
            editor.style.border = '1px solid #555';
            editor.style.userSelect = 'text';
            editor.style.webkitUserSelect = 'text';
            editor.style.mozUserSelect = 'text';
            editor.style.msUserSelect = 'text';
            
            // Override default behavior to ensure editing works properly
            editor.addEventListener('keydown', (e) => {
                // Allow key events to propagate normally
                e.stopPropagation();
            });
            
            // Mark the editor as specifically for editing
            editor.setAttribute('data-editor-type', 'json');
            
            // Add focus event to ensure user can edit
            editor.addEventListener('focus', () => {
                // Ensure selection and editing are enabled when focused
                editor.style.userSelect = 'text';
                editor.style.webkitUserSelect = 'text';
                editor.style.mozUserSelect = 'text';
                editor.style.msUserSelect = 'text';
                // Visual feedback for editing
                editor.style.backgroundColor = 'rgba(40, 50, 70, 0.8)';
                editor.style.boxShadow = 'inset 0 0 5px rgba(100, 150, 255, 0.5)';
                
                // Set a global flag to indicate editing is happening
                window.isEditingEntityData = true;
            });
            
            // Add blur event for saving data and visual feedback
            editor.addEventListener('blur', () => {
                try {
                    const updatedData = JSON.parse(editor.textContent);
                    this.updateComponentFromJson(component, updatedData);
                    editor.style.border = '1px solid #555';
                } catch (e) {
                    console.error("Invalid JSON:", e);
                    editor.style.border = '1px solid #ff5555';
                }
                
                // Reset visual styles
                editor.style.backgroundColor = 'rgba(30, 30, 40, 0.7)';
                editor.style.boxShadow = 'none';
                
                // Reset global editing flag
                window.isEditingEntityData = false;
            });
            
            propertyContainer.appendChild(editor);
            componentDiv.appendChild(propertyContainer);
            componentsSection.appendChild(componentDiv);
        });
        
        this.uiElement.appendChild(componentsSection);
        
        // Add footer with buttons
        const footer = document.createElement('div');
        footer.className = 'data-viewer-footer';
        footer.style.marginTop = '15px';
        footer.style.borderTop = '1px solid #666';
        footer.style.paddingTop = '10px';
        footer.style.display = 'flex';
        footer.style.justifyContent = 'flex-end';
        
        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close';
        closeBtn.style.padding = '5px 15px';
        closeBtn.style.marginLeft = '10px';
        closeBtn.style.backgroundColor = '#333';
        closeBtn.style.color = '#fff';
        closeBtn.style.border = '1px solid #666';
        closeBtn.style.borderRadius = '3px';
        closeBtn.style.cursor = 'pointer';
        closeBtn.addEventListener('click', this.hideDataViewer);
        
        footer.appendChild(closeBtn);
        this.uiElement.appendChild(footer);
    }
    
    /**
     * Serialize a component to JSON-friendly object
     * @param {Object} component - The component to serialize
     * @returns {Object} Serialized component
     */
    serializeComponent(component) {
        const obj = {};
        
        // Walk through properties, skipping entity and functions
        for (const key in component) {
            if (key === 'entity' || typeof component[key] === 'function') {
                continue;
            }
            
            // Handle nested objects
            if (typeof component[key] === 'object' && component[key] !== null) {
                if (component[key] instanceof Map) {
                    // Convert Map to object
                    obj[key] = {};
                    component[key].forEach((value, mapKey) => {
                        if (typeof value !== 'function' && value !== component.entity) {
                            obj[key][mapKey] = value;
                        }
                    });
                } else if (Array.isArray(component[key])) {
                    // Handle arrays
                    obj[key] = component[key].map(item => {
                        if (typeof item === 'object' && item !== null && !(item instanceof Date) && item.id) {
                            // For entity references, just keep id and name
                            return { id: item.id, name: item.name };
                        }
                        return item;
                    });
                } else if (!(component[key] instanceof Date) && component[key].id) {
                    // For entity references, just keep id and name
                    obj[key] = { id: component[key].id, name: component[key].name };
                } else {
                    // For other objects
                    obj[key] = component[key];
                }
            } else {
                // For primitive values
                obj[key] = component[key];
            }
        }
        
        return obj;
    }
    
    /**
     * Update component properties from JSON object
     * @param {Object} component - The component to update
     * @param {Object} data - The new data
     */
    updateComponentFromJson(component, data) {
        // Update simple properties
        for (const key in data) {
            if (key !== 'entity' && typeof component[key] !== 'function') {
                component[key] = data[key];
            }
        }
    }
}

// Export singleton instance
export default new DataViewerUI();