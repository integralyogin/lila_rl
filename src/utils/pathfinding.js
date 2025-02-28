// A* pathfinding algorithm for finding optimal paths
export default class Pathfinder {
    constructor(map) {
        this.map = map;
    }

    // Main pathfinding function - returns an array of positions from start to end
    findPath(startX, startY, endX, endY, playerKnowledgeOnly = false) {
        // Check if start or end are out of bounds
        if (!this.map.isInBounds(startX, startY) || !this.map.isInBounds(endX, endY)) {
            return null;
        }

        // Check if the end position is walkable
        if (!this.map.isWalkable(endX, endY)) {
            return null;
        }

        // A* algorithm data structures
        const openSet = [];
        const closedSet = {};
        const cameFrom = {};
        const gScore = {};
        const fScore = {};
        
        // Initialize start node
        const startKey = `${startX},${startY}`;
        gScore[startKey] = 0;
        fScore[startKey] = this.heuristic(startX, startY, endX, endY);
        openSet.push({ x: startX, y: startY, f: fScore[startKey] });
        
        while (openSet.length > 0) {
            // Sort by f-score (inefficient, but straightforward)
            openSet.sort((a, b) => a.f - b.f);
            
            // Get node with lowest f-score
            const current = openSet.shift();
            const currentKey = `${current.x},${current.y}`;
            
            // Check if we reached the destination
            if (current.x === endX && current.y === endY) {
                return this.reconstructPath(cameFrom, current);
            }
            
            // Add to closed set
            closedSet[currentKey] = true;
            
            // Check all 8 adjacent neighbors
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    // Skip the current node
                    if (dx === 0 && dy === 0) continue;
                    
                    const nx = current.x + dx;
                    const ny = current.y + dy;
                    const neighborKey = `${nx},${ny}`;
                    
                    // Skip if already evaluated
                    if (closedSet[neighborKey]) continue;
                    
                    // Skip if out of bounds
                    if (!this.map.isInBounds(nx, ny)) continue;
                    
                    // Skip if not walkable
                    if (!this.map.isWalkable(nx, ny)) continue;
                    
                    // If exploring only known nodes, skip unexplored tiles
                    if (playerKnowledgeOnly) {
                        const tile = this.map.getTile(nx, ny);
                        if (!tile.explored) continue;
                    }
                    
                    // Calculate movement cost (diagonal movement costs more)
                    const isDiagonal = dx !== 0 && dy !== 0;
                    const moveCost = isDiagonal ? 1.41 : 1.0;
                    
                    // Calculate tentative g-score
                    const tentativeG = gScore[currentKey] + moveCost;
                    
                    // Skip if not a better path
                    if (neighborKey in gScore && tentativeG >= gScore[neighborKey]) continue;
                    
                    // This is the best path so far, record it
                    cameFrom[neighborKey] = current;
                    gScore[neighborKey] = tentativeG;
                    fScore[neighborKey] = tentativeG + this.heuristic(nx, ny, endX, endY);
                    
                    // Add to open set if not already there
                    const existingIndex = openSet.findIndex(node => node.x === nx && node.y === ny);
                    if (existingIndex !== -1) {
                        openSet[existingIndex].f = fScore[neighborKey];
                    } else {
                        openSet.push({ x: nx, y: ny, f: fScore[neighborKey] });
                    }
                }
            }
        }
        
        // No path found
        return null;
    }
    
    // Manhattan distance heuristic (plus a small tie-breaker)
    heuristic(x1, y1, x2, y2) {
        const dx = Math.abs(x1 - x2);
        const dy = Math.abs(y1 - y2);
        return dx + dy + 0.001 * (dx * dx + dy * dy);
    }
    
    // Reconstruct the path from the cameFrom map
    reconstructPath(cameFrom, current) {
        const path = [{ x: current.x, y: current.y }];
        let key = `${current.x},${current.y}`;
        
        while (key in cameFrom) {
            current = cameFrom[key];
            path.unshift({ x: current.x, y: current.y });
            key = `${current.x},${current.y}`;
        }
        
        // Remove the starting position (player's position)
        path.shift();
        
        return path;
    }
}