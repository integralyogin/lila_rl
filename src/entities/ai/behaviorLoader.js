/**
 * BehaviorLoader - Loads behavior definitions from JSON data
 */
import behaviorDefinition from './behaviorDefinition.js';

class BehaviorLoader {
  constructor() {
    this.initialized = false;
    this.behaviorDefinitions = [];
  }

  /**
   * Initialize the behavior loader
   * @param {Function} fetchFunction - Function to fetch JSON data
   */
  async initialize(fetchFunction) {
    try {
      // Load behavior definitions from JSON
      const response = await fetchFunction('./data/behavior_definitions.json');
      this.behaviorDefinitions = await response.json();
      
      // Register behaviors with the behavior definition system
      this.registerBehaviors();
      
      this.initialized = true;
      console.log(`Loaded ${this.behaviorDefinitions.length} behavior definitions`);
      return true;
    } catch (error) {
      console.error('Error loading behavior definitions:', error);
      return false;
    }
  }

  /**
   * Register behaviors with the behavior definition system
   */
  registerBehaviors() {
    for (const behavior of this.behaviorDefinitions) {
      behaviorDefinition.registerBehavior(behavior.id, behavior);
      console.log(`Registered behavior: ${behavior.id}`);
    }
  }
  
  /**
   * Get a behavior definition by ID
   * @param {string} id - Behavior ID
   * @returns {object} Behavior definition or null if not found
   */
  getBehaviorById(id) {
    return this.behaviorDefinitions.find(behavior => behavior.id === id) || null;
  }
  
  /**
   * Map an AI type to a behavior ID
   * This maps from the old system to the new data-driven system
   * @param {string} aiType - AI type from monster definition
   * @returns {string} Behavior ID
   */
  mapAITypeToBehaviorId(aiType) {
    const mapping = {
      'default': 'melee_attacker',
      'ranged': 'ranged_attacker',
      'spellcaster': 'spellcaster',
      'summoner': 'summoner',
      'hydra': 'hydra',
      'stationary': 'stationary_caster'
    };
    
    return mapping[aiType] || 'melee_attacker';
  }
}

// Export singleton
const behaviorLoader = new BehaviorLoader();
export default behaviorLoader;