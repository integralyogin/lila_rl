/**
 * MapLoader - Handles loading and caching map data
 */
class MapLoader {
    constructor() {
        // Map cache to store preloaded maps
        this.mapCache = new Map();
    }
    
    /**
     * Load a map from the data/maps directory
     * @param {string} mapName - Name of the map (without .json extension)
     * @returns {Promise<Object|null>} - The map data or null if loading failed
     */
    async loadMapData(mapName) {
        try {
            // Check if the map is already in cache
            if (this.mapCache.has(mapName)) {
                console.log(`Using cached map data for ${mapName}`);
                return this.mapCache.get(mapName);
            }
            
            // Make sure the mapName has no path traversal
            const safeName = mapName.replace(/[^a-z0-9_-]/gi, '');
            if (safeName !== mapName) {
                console.error(`Invalid map name: ${mapName}`);
                return null;
            }
            
            // Load the map data
            const response = await fetch(`data/maps/${safeName}.json`);
            if (!response.ok) {
                throw new Error(`Failed to load map: ${response.status}`);
            }
            
            const mapData = await response.json();
            
            // Cache the map data
            this.mapCache.set(mapName, mapData);
            
            return mapData;
        } catch (error) {
            console.error(`Error loading map ${mapName}:`, error);
            return null;
        }
    }
    
    /**
     * Preload commonly used maps into the cache to improve performance
     * @returns {Promise<void>}
     */
    async preloadMaps() {
        console.log("Preloading maps...");
        
        // List of maps to preload
        const mapsToPreload = ['town', 'dungeon', 'forest', 'hills', 'test_map'];
        
        // Load maps in parallel
        const promises = mapsToPreload.map(mapName => this.loadMapData(mapName));
        
        try {
            await Promise.allSettled(promises);
            console.log("Maps preloaded successfully");
        } catch (error) {
            console.error("Error preloading maps:", error);
        }
    }
}

export default MapLoader;