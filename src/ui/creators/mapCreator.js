// ui/creators/mapCreator.js
import gameState from '../../core/gameState.js';
import eventBus from '../../core/eventEmitter.js';
import MapLoader from '../../world/mapLoader.js';

class MapCreator {
    constructor() {
        this.mapLoader = new MapLoader();
        this.availableMaps = [];
        this.currentMap = null;
    }
    
    async show(container) {
        // Create simple form
        const form = document.createElement('div');
        
        // Add header
        const header = document.createElement('h3');
        header.textContent = 'Map Editor';
        header.style.color = '#99ccff';
        header.style.marginBottom = '15px';
        form.appendChild(header);
        
        try {
            // Load available maps
            await this.loadAvailableMaps();
            
            // Map selector section
            const selectorSection = document.createElement('div');
            selectorSection.style.marginBottom = '20px';
            selectorSection.style.padding = '10px';
            selectorSection.style.backgroundColor = 'rgba(40, 60, 90, 0.2)';
            selectorSection.style.border = '1px solid #4477aa';
            
            // Create map select dropdown
            const select = document.createElement('select');
            select.id = 'map-selector';
            select.style.width = '100%';
            select.style.marginBottom = '10px';
            select.style.padding = '8px';
            select.style.backgroundColor = 'rgba(40, 40, 60, 0.7)';
            select.style.color = '#fff';
            select.style.border = '1px solid #555';
            
            // Add default option
            const defaultOption = document.createElement('option');
            defaultOption.value = '';
            defaultOption.textContent = '-- Select a map --';
            select.appendChild(defaultOption);
            
            // Add map options
            this.availableMaps.forEach(mapName => {
                const option = document.createElement('option');
                option.value = mapName;
                option.textContent = mapName;
                select.appendChild(option);
            });
            
            // Add load button
            const loadBtn = document.createElement('button');
            loadBtn.textContent = 'Load Map';
            loadBtn.style.width = '100%';
            loadBtn.style.marginBottom = '5px';
            loadBtn.style.padding = '8px';
            loadBtn.style.backgroundColor = '#5577cc';
            loadBtn.style.color = '#fff';
            loadBtn.style.border = 'none';
            loadBtn.style.borderRadius = '3px';
            loadBtn.style.cursor = 'pointer';
            
            loadBtn.addEventListener('click', async () => {
                const mapName = select.value;
                if (!mapName) {
                    gameState.addMessage("Please select a map to load.", "error");
                    return;
                }
                
                try {
                    await this.loadMap(mapName);
                    this.updateMapEditor(form);
                } catch (error) {
                    console.error(`Error loading map ${mapName}:`, error);
                    gameState.addMessage(`Error loading map: ${error.message}`, "error");
                }
            });
            
            // Add new map button
            const newBtn = document.createElement('button');
            newBtn.textContent = 'Create New Map';
            newBtn.style.width = '100%';
            newBtn.style.padding = '8px';
            newBtn.style.backgroundColor = '#22aa66';
            newBtn.style.color = '#fff';
            newBtn.style.border = 'none';
            newBtn.style.borderRadius = '3px';
            newBtn.style.cursor = 'pointer';
            
            newBtn.addEventListener('click', () => {
                this.createNewMap();
                this.updateMapEditor(form);
            });
            
            selectorSection.appendChild(select);
            selectorSection.appendChild(loadBtn);
            selectorSection.appendChild(newBtn);
            form.appendChild(selectorSection);
            
            // Editor section (initially hidden)
            const editorSection = document.createElement('div');
            editorSection.id = 'map-editor-section';
            editorSection.style.display = 'none';
            form.appendChild(editorSection);
            
            // Add to container
            container.appendChild(form);
            
        } catch (error) {
            console.error("Error initializing Map Creator:", error);
            const errorMsg = document.createElement('p');
            errorMsg.textContent = `Error initializing Map Creator: ${error.message}`;
            errorMsg.style.color = 'red';
            form.appendChild(errorMsg);
            container.appendChild(form);
        }
    }
    
    async loadAvailableMaps() {
        try {
            // Get maps from the server if possible
            const response = await fetch('/games/lila_rl/data/maps/maps_list.json');
            if (response.ok) {
                const data = await response.json();
                this.availableMaps = data.maps || [];
            } else {
                // Fallback to hardcoded list if server doesn't have maps_list.json
                this.availableMaps = [
                    'town',
                    'dungeon',
                    'arena',
                    'orc_camp'
                ];
            }
        } catch (error) {
            console.warn("Could not fetch maps list, using hardcoded list:", error);
            // Fallback to hardcoded list
            this.availableMaps = [
                'town',
                'dungeon',
                'arena',
                'orc_camp'
            ];
        }
    }
    
    async loadMap(mapName) {
        try {
            // Load map data
            const mapData = await this.mapLoader.loadMapData(mapName);
            
            if (!mapData) {
                throw new Error(`Could not load map data for ${mapName}`);
            }
            
            this.currentMap = {
                name: mapName,
                data: mapData
            };
            
            gameState.addMessage(`Map "${mapName}" loaded successfully.`, "important");
            
        } catch (error) {
            console.error(`Error loading map ${mapName}:`, error);
            throw error;
        }
    }
    
    createNewMap() {
        // Create a basic empty map template
        this.currentMap = {
            name: "new_map",
            data: {
                width: 80,
                height: 40,
                roomMinSize: 6,
                roomMaxSize: 12,
                maxRooms: 15,
                spawn_point: {
                    x_offset: 0,
                    y_offset: 0
                },
                exits: [],
                buildings: [],
                npcs: []
            }
        };
        
        gameState.addMessage("Created a new map template.", "important");
    }
    
    updateMapEditor(form) {
        // Get or create editor section
        let editorSection = form.querySelector('#map-editor-section');
        if (!editorSection) {
            editorSection = document.createElement('div');
            editorSection.id = 'map-editor-section';
            form.appendChild(editorSection);
        }
        
        // Clear existing content
        editorSection.innerHTML = '';
        
        if (!this.currentMap) {
            editorSection.style.display = 'none';
            return;
        }
        
        // Show the editor
        editorSection.style.display = 'block';
        editorSection.style.padding = '10px';
        editorSection.style.backgroundColor = 'rgba(40, 50, 70, 0.3)';
        editorSection.style.border = '1px solid #557799';
        editorSection.style.marginBottom = '20px';
        
        // Map header
        const mapHeader = document.createElement('h4');
        mapHeader.textContent = `Editing Map: ${this.currentMap.name}`;
        mapHeader.style.color = '#aaddff';
        mapHeader.style.marginBottom = '15px';
        editorSection.appendChild(mapHeader);
        
        // Add JSON preview
        this.addJsonPreview(editorSection);
        
        // Add save button
        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Save Map';
        saveBtn.style.padding = '8px 16px';
        saveBtn.style.backgroundColor = '#22aa66';
        saveBtn.style.border = 'none';
        saveBtn.style.borderRadius = '3px';
        saveBtn.style.color = '#fff';
        saveBtn.style.cursor = 'pointer';
        saveBtn.style.marginTop = '10px';
        
        saveBtn.addEventListener('click', () => {
            // In a real implementation, this would save the map to the server
            gameState.addMessage(`Map saving will be implemented soon.`, "info");
        });
        
        editorSection.appendChild(saveBtn);
    }
    
    addJsonPreview(container) {
        const previewSection = document.createElement('div');
        previewSection.style.padding = '10px';
        previewSection.style.backgroundColor = 'rgba(30, 30, 40, 0.7)';
        previewSection.style.borderRadius = '3px';
        
        const previewHeader = document.createElement('h5');
        previewHeader.textContent = 'Map JSON Editor';
        previewHeader.style.color = '#ffcc99';
        previewHeader.style.marginBottom = '10px';
        previewSection.appendChild(previewHeader);
        
        // Create editable textarea
        const preview = document.createElement('textarea');
        preview.id = 'map-json-editor';
        preview.style.width = '100%';
        preview.style.height = '400px';
        preview.style.fontFamily = 'monospace';
        preview.style.fontSize = '12px';
        preview.style.padding = '10px';
        preview.style.backgroundColor = 'rgba(30, 30, 40, 0.7)';
        preview.style.color = '#fff';
        preview.style.border = '1px solid #555';
        preview.style.borderRadius = '3px';
        
        // Set content
        if (this.currentMap && this.currentMap.data) {
            preview.value = JSON.stringify(this.currentMap.data, null, 2);
        } else {
            preview.value = '// Map data will appear here';
        }
        
        // Text selection should work in the editor
        preview.addEventListener('click', (event) => {
            event.stopPropagation();
            window.isEditingEntityData = true;
        });
        
        preview.addEventListener('blur', () => {
            window.isEditingEntityData = false;
            
            // Update current map data from editor
            try {
                const jsonValue = preview.value;
                const parsedData = JSON.parse(jsonValue);
                
                if (this.currentMap) {
                    this.currentMap.data = parsedData;
                    gameState.addMessage("Map data updated in editor.", "info");
                }
            } catch (e) {
                gameState.addMessage("Error parsing JSON: " + e.message, "error");
            }
        });
        
        previewSection.appendChild(preview);
        container.appendChild(previewSection);
    }
}

export default new MapCreator();
