// Base component class - all components should extend this
export class Component {
    constructor() {
        this.entity = null;
    }
}

// Position component - for entities that exist on the map
export class PositionComponent extends Component {
    constructor(x = 0, y = 0) {
        super();
        this.x = x;
        this.y = y;
    }
    
    moveTo(x, y) {
        this.x = x;
        this.y = y;
    }
    
    moveBy(dx, dy) {
        this.x += dx;
        this.y += dy;
    }
}

// Renderable component - for entities that can be seen
export class RenderableComponent extends Component {
    constructor(char = '?', color = '#fff', background = null, priority = 0) {
        super();
        this.char = char;
        this.color = color;
        this.background = background;
        this.priority = priority; // Higher priority renders on top
    }
}

// BlocksMovement component - for entities that block movement
export class BlocksMovementComponent extends Component {
    constructor() {
        super();
    }
}