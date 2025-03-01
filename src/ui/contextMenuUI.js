import gameState from '../core/gameState.js';
import eventBus from '../core/eventEmitter.js';

/**
 * ContextMenuUI - Handles right-click context menus 
 */
class ContextMenuUI {
    constructor() {
        this.menuElement = null;
        this.visible = false;
        this.currentTarget = null;
        
        // Bind methods to this instance
        this.showMenu = this.showMenu.bind(this);
        this.hideMenu = this.hideMenu.bind(this);
        this.handleDocumentClick = this.handleDocumentClick.bind(this);
        
        // Create the menu element
        this.createMenuElement();
        
        // Listen for context menu events
        eventBus.on('showContextMenu', this.showMenu);
        eventBus.on('hideContextMenu', this.hideMenu);
        
        // We'll add the document click handler dynamically to avoid 
        // immediate closing after right-click
    }
    
    /**
     * Handle clicks outside the menu
     * @param {MouseEvent} event - The click event
     */
    handleDocumentClick(event) {
        // If the menu is visible and the click was outside the menu
        if (this.visible && this.menuElement && !this.menuElement.contains(event.target)) {
            console.log("Closing context menu due to outside click");
            this.hideMenu();
        }
    }
    
    /**
     * Create the context menu DOM element
     */
    createMenuElement() {
        if (this.menuElement) return;
        
        this.menuElement = document.createElement('div');
        this.menuElement.id = 'context-menu';
        this.menuElement.className = 'context-menu';
        this.menuElement.style.position = 'absolute';
        this.menuElement.style.zIndex = '1000';
        this.menuElement.style.backgroundColor = 'rgba(30, 30, 40, 0.95)';
        this.menuElement.style.border = '1px solid #666';
        this.menuElement.style.borderRadius = '4px';
        this.menuElement.style.padding = '5px 0';
        this.menuElement.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.5)';
        this.menuElement.style.display = 'none';
        this.menuElement.style.minWidth = '150px';
        
        document.body.appendChild(this.menuElement);
    }
    
    /**
     * Show the context menu
     * @param {Object} options - Menu options
     */
    showMenu(options) {
        // Create or update menu element
        this.createMenuElement();
        
        // Store current target
        this.currentTarget = options.target;
        
        // Set position
        this.menuElement.style.left = `${options.x}px`;
        this.menuElement.style.top = `${options.y}px`;
        
        // Clear previous menu items
        this.menuElement.innerHTML = '';
        
        // Add menu items
        options.items.forEach(item => {
            const menuItem = document.createElement('div');
            menuItem.className = 'context-menu-item';
            menuItem.style.padding = '8px 12px';
            menuItem.style.cursor = 'pointer';
            menuItem.style.transition = 'background-color 0.2s';
            
            // Style for hover
            menuItem.addEventListener('mouseenter', () => {
                menuItem.style.backgroundColor = 'rgba(100, 100, 255, 0.3)';
            });
            
            menuItem.addEventListener('mouseleave', () => {
                menuItem.style.backgroundColor = 'transparent';
            });
            
            // Add key shortcut display
            if (item.key) {
                menuItem.innerHTML = `
                    <span>${item.label}</span>
                    <span style="float: right; opacity: 0.7; font-size: 0.9em;">[${item.key}]</span>
                `;
            } else {
                menuItem.textContent = item.label;
            }
            
            // Add click handler
            menuItem.addEventListener('click', (e) => {
                // Stop propagation to prevent click-outside handler from firing
                e.stopPropagation();
                
                this.hideMenu();
                if (item.action) {
                    item.action(this.currentTarget);
                }
            });
            
            // Add separator if requested
            if (item.separator) {
                const separator = document.createElement('div');
                separator.className = 'context-menu-separator';
                separator.style.height = '1px';
                separator.style.backgroundColor = '#555';
                separator.style.margin = '5px 0';
                this.menuElement.appendChild(separator);
            }
            
            this.menuElement.appendChild(menuItem);
        });
        
        // Make menu visible
        this.menuElement.style.display = 'block';
        this.visible = true;
        
        // Stop any current click outside handler
        document.removeEventListener('click', this.handleDocumentClick);
        
        // Create a special one-time click handler to prevent immediate closing
        // We'll catch the first click event (the right-click that opened the menu)
        const initialClickHandler = (e) => {
            e.stopPropagation();
            // Remove this one-time handler
            document.removeEventListener('click', initialClickHandler, true);
            
            // Add the regular document click handler on the next tick
            setTimeout(() => {
                document.addEventListener('click', this.handleDocumentClick);
            }, 0);
        };
        
        // Capture phase to catch before bubbling
        document.addEventListener('click', initialClickHandler, true);
        
        // Ensure menu stays within viewport
        const rect = this.menuElement.getBoundingClientRect();
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        
        if (rect.right > windowWidth) {
            this.menuElement.style.left = `${windowWidth - rect.width - 5}px`;
        }
        
        if (rect.bottom > windowHeight) {
            this.menuElement.style.top = `${windowHeight - rect.height - 5}px`;
        }
    }
    
    /**
     * Hide the context menu
     */
    hideMenu() {
        if (this.menuElement) {
            this.menuElement.style.display = 'none';
            this.visible = false;
            this.currentTarget = null;
            
            // Remove document click handler
            document.removeEventListener('click', this.handleDocumentClick);
        }
    }
}

// Export singleton instance
export default new ContextMenuUI();