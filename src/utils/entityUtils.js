import gameState from '../core/gameState.js';

/**
 * Helper function to get an array of entities from the gameState
 * Handles different entity storage formats for compatibility
 * @returns {Array} Array of entities from gameState
 */
export function getEntityArray() {
    let entityArray = [];
    
    if (gameState._entitiesArray) {
        entityArray = gameState._entitiesArray;
    } else if (gameState.entities) {
        if (gameState.entities instanceof Map) {
            entityArray = Array.from(gameState.entities.values());
        } else if (Array.isArray(gameState.entities)) {
            entityArray = gameState.entities;
        }
    }
    
    return entityArray;
}

/**
 * Find entities at a specific position
 * @param {number} x - The x coordinate
 * @param {number} y - The y coordinate 
 * @returns {Array} Array of entities at the specified position
 */
export function getEntitiesAtPosition(x, y) {
    const entityArray = getEntityArray();
    
    return entityArray.filter(entity => 
        entity && 
        entity.position && 
        entity.position.x === x && 
        entity.position.y === y
    );
}

/**
 * Find entities with a specific component
 * @param {string} componentName - The name of the component to search for
 * @returns {Array} Array of entities with the specified component
 */
export function getEntitiesWithComponent(componentName) {
    const entityArray = getEntityArray();
    
    return entityArray.filter(entity => 
        entity && 
        entity.getComponent && 
        entity.getComponent(componentName)
    );
}