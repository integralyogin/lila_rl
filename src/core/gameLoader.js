/**
 * GameLoader - Handles loading game data from JSON files
 */
class GameLoader {
    /**
     * Load all game data from JSON files
     * @returns {Promise<Object>} The loaded game data
     */
    async loadGameData() {
        console.log("Loading game data...");
        
        // Show loading message
        const messageElement = document.getElementById('message-log');
        if (messageElement) {
            messageElement.innerHTML = '<div class="message message-important">Loading game data...</div>';
        }
        
        // Initialize default empty data container
        const gameData = {
            dungeonConfig: null,
            playerData: null,
            monsters: null,
            items: null,
            townData: null,
            spellbooks: null
        };
        
        try {
            // Define files to load with their paths
            const files = [
                { path: 'maps/dungeon.json', prop: 'dungeonConfig' },
                { path: 'player.json', prop: 'playerData' },
                { path: 'monsters.json', prop: 'monsters' },
                { path: 'items.json', prop: 'items' },
                { path: 'maps/town.json', prop: 'townData' },
                { path: 'spellbooks.json', prop: 'spellbooks' }
            ];
            
            // Load each file with parallel fetches
            const promises = files.map(file => fetch(`data/${file.path}`).then(res => 
                res.ok ? 
                    res.json().then(data => ({ prop: file.prop, data })) : 
                    Promise.reject(`Failed to load ${file.path}: ${res.status}`)
            ));
            
            // Get results and handle any errors
            const results = await Promise.allSettled(promises);
            
            // Process results
            results.forEach((result) => {
                if (result.status === 'fulfilled') {
                    gameData[result.value.prop] = result.value.data;
                } else {
                    console.error(`Error loading: ${result.reason}`);
                    // Missing data will be handled by the entity factory
                }
            });
            
            return gameData;
        } catch (error) {
            console.error("Error loading game data:", error);
            // Return the empty gameData object with nulls
            return gameData;
        }
    }
}

export default GameLoader;