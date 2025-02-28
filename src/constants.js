export const GAME_WIDTH = 70;
export const GAME_HEIGHT = 40;
export const CELL_SIZE = 20;

export const COLORS = {
    PLAYER: '#fff',
    WALL: '#666',
    FLOOR: '#333',
    TOWN_FLOOR: '#3a7c50',  // Grassy green
    BUILDING: '#8b4513',    // Brown for buildings
    DUNGEON_ENTRANCE: '#444', // Dark gray for dungeon entrance
    MONSTER: {
        GOBLIN: '#0f0',
        ORC: '#f00'
    },
    ITEM: {
        WEAPON: '#aaa',
        POTION: '#f00',
        SCROLL: '#ff0',
        ARMOR: '#00f'
    },
    UI: {
        TEXT: '#fff',
        BACKGROUND: '#222',
        SELECTED: '#448'
    }
};

export const TILE_TYPES = {
    WALL: 0,
    FLOOR: 1,
    STAIRS_DOWN: 2,
    DOOR: 3,
    TOWN_FLOOR: 4,
    BUILDING: 5,
    DUNGEON_ENTRANCE: 6,
    AREA_EXIT: 7,
    STAIRS_UP: 8
};

export const KEYS = {
    UP: ['ArrowUp', 'k', '8'],
    DOWN: ['ArrowDown', 'j', '2'],
    LEFT: ['ArrowLeft', 'h', '4'],
    RIGHT: ['ArrowRight', 'l', '6'],
    UP_LEFT: ['y', '7'],
    UP_RIGHT: ['u', '9'],
    DOWN_LEFT: ['b', '1'],
    DOWN_RIGHT: ['n', '3'],
    WAIT: ['.', '5'],
    INVENTORY: ['i'],
    CHARACTER: ['c'],
    SPELLBOOK: ['s'],
    PICKUP: ['e', ','],
    DROP: ['d'],
    HELP: ['?'],
    USE_STAIRS: ['>', '<'],
    INTERACT: ['Enter', ' ', 'e']
};