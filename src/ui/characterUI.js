import gameState from '../core/gameState.js';
import eventBus from '../core/eventEmitter.js';

class CharacterUI {
    constructor() {
        this.visible = false;
        this.characterElement = null;
        
        this.boundHandleKeyDown = this.handleKeyDown.bind(this);
        this.clickOutsideHandler = this.handleClickOutside.bind(this);
        
        this.initialize();
        
        eventBus.on('characterOpened', () => this.open());
        eventBus.on('characterClosed', () => this.close());
        eventBus.on('characterKeyPressed', (key) => this.handleKeyPress(key));
    }
    
    handleClickOutside(event) {
        const characterUI = document.getElementById('character-ui');
        if (!characterUI) return;
        
        if (this.visible && !characterUI.contains(event.target)) {
            this.close();
            gameState.gameMode = 'exploration';
            eventBus.emit('characterClosed');
        }
    }
    
    initialize() {
        if (!document.getElementById('character-ui')) {
            const characterUI = document.createElement('div');
            characterUI.id = 'character-ui';
            characterUI.className = 'character-ui';
            characterUI.style.display = 'none';
            
            const header = document.createElement('div');
            header.className = 'character-header';
            header.style.display = 'flex';
            header.style.justifyContent = 'space-between';
            header.style.alignItems = 'center';
            header.style.padding = '5px 10px';
            
            const title = document.createElement('div');
            title.id = 'character-title';
            title.textContent = 'Character Sheet';
            
            const closeButton = document.createElement('button');
            closeButton.className = 'close-button';
            closeButton.innerHTML = '&times;';
            closeButton.style.background = 'none';
            closeButton.style.border = 'none';
            closeButton.style.color = '#fff';
            closeButton.style.fontSize = '20px';
            closeButton.style.cursor = 'pointer';
            closeButton.style.padding = '0 5px';
            closeButton.style.marginLeft = '10px';
            closeButton.title = 'Close character sheet';
            
            closeButton.addEventListener('mouseenter', () => closeButton.style.color = '#ff9999');
            closeButton.addEventListener('mouseleave', () => closeButton.style.color = '#fff');
            
            closeButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this.close();
                gameState.gameMode = 'exploration';
                eventBus.emit('characterClosed');
            });
            
            header.appendChild(title);
            header.appendChild(closeButton);
            
            const characterContent = document.createElement('div');
            characterContent.className = 'character-content';
            characterContent.id = 'character-content';
            
            const footer = document.createElement('div');
            footer.className = 'character-footer';
            footer.innerHTML = `<div><b>ESC</b> or <b>C</b> Close character sheet</div>`;
            
            characterUI.appendChild(header);
            characterUI.appendChild(characterContent);
            characterUI.appendChild(footer);
            
            const gameContainer = document.getElementById('game-container') || document.body;
            gameContainer.appendChild(characterUI);
            
            this.characterElement = characterContent;
            
            this.addCharacterStyles();
        } else {
            this.characterElement = document.getElementById('character-content');
        }
    }
    
    addCharacterStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .character-ui {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 80%;
                max-width: 800px;
                max-height: 90vh;
                overflow-y: auto;
                background: #222;
                border: 2px solid #666;
                color: #fff;
                padding: 5px;
                display: flex;
                flex-direction: column;
                z-index: 100;
                font-family: monospace;
            }
            .character-header {
                display: flex;
                justify-content: center;
                padding: 3px;
                background: #333;
                margin-bottom: 5px;
                font-weight: bold;
                font-size: 1.2em;
            }
            .character-content {
                padding: 5px;
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 8px;
            }
            .stat-section {
                border: 1px solid #444;
                padding: 5px;
                background: #333;
            }
            .stat-section h3 {
                margin-top: 0;
                margin-bottom: 5px;
                border-bottom: 1px solid #555;
                padding-bottom: 2px;
                font-size: 0.9em;
            }
            .stat-row {
                display: flex;
                justify-content: space-between;
                margin-bottom: 2px;
                font-size: 0.85em;
            }
            .equipment-slot {
                display: flex;
                justify-content: space-between;
                padding: 2px 0;
                font-size: 0.85em;
            }
            .slot-name {
                color: #aaa;
            }
            .slot-empty {
                color: #666;
                font-style: italic;
            }
            .hp-bar, .xp-bar, .mana-bar {
                width: 100%;
                height: 8px;
                background: #444;
                margin-top: 2px;
                position: relative;
            }
            .hp-fill {
                height: 100%;
                background: #a33;
                width: 0%;
            }
            .mana-fill {
                height: 100%;
                background: #33a;
                width: 0%;
            }
            .xp-fill {
                height: 100%;
                background: #3a3;
                width: 0%;
            }
            .stat-value {
                font-weight: bold;
            }
            .character-footer {
                display: flex;
                justify-content: center;
                padding: 3px;
                background: #333;
                margin-top: 5px;
                font-size: 0.8em;
            }
            .attributes-grid {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 5px;
            }
            .full-width {
                grid-column: span 2;
            }
        `;
        document.head.appendChild(style);
    }
    
    open() {
        if (!gameState.player) return;
        
        this.render();
        
        const characterUI = document.getElementById('character-ui');
        if (characterUI) characterUI.style.display = 'flex';
        
        this.visible = true;
        gameState.gameMode = 'character';
        
        document.addEventListener('keydown', this.boundHandleKeyDown);
        
        setTimeout(() => {
            document.addEventListener('click', this.clickOutsideHandler);
        }, 100);
    }
    
    close() {
        const characterUI = document.getElementById('character-ui');
        if (characterUI) characterUI.style.display = 'none';
        
        this.visible = false;
        gameState.gameMode = 'exploration';
        
        document.removeEventListener('keydown', this.boundHandleKeyDown);
        document.removeEventListener('click', this.clickOutsideHandler);
    }
    
    handleKeyDown(event) {
        if (!this.visible) return;
        
        this.handleKeyPress(event.key);
        
        event.preventDefault();
        event.stopPropagation();
    }
    
    handleKeyPress(key) {
        if (key === 'Escape' || key === 'c' || key === 'C') this.close();
    }
    
    render() {
        if (!this.characterElement || !gameState.player) return;
        
        const player = gameState.player;
        const health = player.getComponent('HealthComponent');
        const stats = player.getComponent('StatsComponent');
        const equipment = player.getComponent('EquipmentComponent');
        const mana = player.getComponent('ManaComponent');
        const willpower = player.getComponent('WillpowerComponent');
        const stamina = player.getComponent('StaminaComponent');
        const gold = player.getComponent('GoldComponent');
        const limbs = player.getComponent('LimbComponent');
        
        let contentHTML = '';
        
        contentHTML += `
            <div class="stat-section">
                <h3>Character</h3>
                <div class="stat-row">
                    <span>Name:</span>
                    <span class="stat-value">Player</span>
                </div>
                <div class="stat-row">
                    <span>Level:</span>
                    <span class="stat-value">${stats ? stats.level : 1}</span>
                </div>
                <div class="stat-row">
                    <span>Score:</span>
                    <span class="stat-value">${gameState.score}</span>
                </div>
                <div class="stat-row">
                    <span>Gold:</span>
                    <span class="stat-value">${gold ? gold.amount : 0}</span>
                </div>
                <div class="stat-row">
                    <span>HP:</span>
                    <span class="stat-value">${health ? `${health.hp}/${health.maxHp}` : 'N/A'}</span>
                </div>
                <div class="hp-bar">
                    <div class="hp-fill" style="width: ${health ? Math.floor((health.hp / health.maxHp) * 100) : 0}%"></div>
                </div>
                
                <div class="stat-row" style="margin-top: 4px;">
                    <span>Mana:</span>
                    <span class="stat-value">${mana ? `${mana.mana}/${mana.maxMana}` : 'N/A'}</span>
                </div>
                <div class="mana-bar">
                    <div class="mana-fill" style="width: ${mana ? Math.floor((mana.mana / mana.maxMana) * 100) : 0}%"></div>
                </div>
                
                <div class="stat-row" style="margin-top: 4px;">
                    <span>Willpower:</span>
                    <span class="stat-value">${willpower ? `${willpower.wp}/${willpower.maxWP}` : 'N/A'}</span>
                </div>
                <div class="hp-bar">
                    <div class="hp-fill" style="width: ${willpower ? Math.floor((willpower.wp / willpower.maxWP) * 100) : 0}%; background-color: #a3a;"></div>
                </div>
                
                <div class="stat-row" style="margin-top: 4px;">
                    <span>Stamina:</span>
                    <span class="stat-value">${stamina ? `${stamina.sp}/${stamina.maxSP}` : 'N/A'}</span>
                </div>
                <div class="hp-bar">
                    <div class="hp-fill" style="width: ${stamina ? Math.floor((stamina.sp / stamina.maxSP) * 100) : 0}%; background-color: #aa3;"></div>
                </div>
                
                <div class="stat-row" style="margin-top: 4px;">
                    <span>XP:</span>
                    <span class="stat-value">${stats ? `${stats.xp}/${stats.xpToNext}` : 'N/A'}</span>
                </div>
                <div class="xp-bar">
                    <div class="xp-fill" style="width: ${stats ? Math.floor((stats.xp / stats.xpToNext) * 100) : 0}%"></div>
                </div>
            </div>
        `;
        
        contentHTML += `
            <div class="stat-section">
                <h3>Attributes</h3>
                <div class="attributes-grid">
                    <div class="stat-row">
                        <span>STR:</span>
                        <span class="stat-value">${stats ? stats.strength : 'N/A'}</span>
                    </div>
                    <div class="stat-row">
                        <span>DEX:</span>
                        <span class="stat-value">${stats ? stats.dexterity : 'N/A'}</span>
                    </div>
                    <div class="stat-row">
                        <span>TOU:</span>
                        <span class="stat-value">${stats ? stats.toughness : 'N/A'}</span>
                    </div>
                    <div class="stat-row">
                        <span>PER:</span>
                        <span class="stat-value">${stats ? stats.perception : 'N/A'}</span>
                    </div>
                    <div class="stat-row">
                        <span>INT:</span>
                        <span class="stat-value">${stats ? stats.intelligence : 'N/A'}</span>
                    </div>
                    <div class="stat-row">
                        <span>WIS:</span>
                        <span class="stat-value">${stats ? stats.wisdom : 'N/A'}</span>
                    </div>
                    <div class="stat-row">
                        <span>CHA:</span>
                        <span class="stat-value">${stats ? stats.charisma : 'N/A'}</span>
                    </div>
                    <div class="stat-row">
                        <span>WIL:</span>
                        <span class="stat-value">${stats ? stats.willpower : 'N/A'}</span>
                    </div>
                </div>
            </div>
        `;
        
        let attackBonus = 0;
        let defenseBonus = 0;
        let limbProtection = 0;
        let attackMsg = "";
        
        if (equipment) {
            for (const slotName of Object.keys(equipment.slots)) {
                const item = equipment.slots[slotName];
                if (item && item.hasComponent('EquippableComponent')) {
                    const equippable = item.getComponent('EquippableComponent');
                    
                    if (equippable.statModifiers) {
                        if (equippable.statModifiers.strength) {
                            attackBonus += equippable.statModifiers.strength;
                            attackMsg = ` (+${attackBonus})`;
                        }
                        if (equippable.statModifiers.defense) {
                            defenseBonus += equippable.statModifiers.defense;
                        }
                    }
                    
                    if (equippable.limbProtection) {
                        limbProtection += equippable.limbProtection;
                    }
                }
            }
        }
        
        contentHTML += `
            <div class="stat-section">
                <h3>Combat Stats</h3>
                <div class="attributes-grid">
                    <div class="stat-row">
                        <span>Speed:</span>
                        <span class="stat-value">${stats ? stats.speed : 'N/A'}</span>
                    </div>
                    <div class="stat-row">
                        <span>Accuracy:</span>
                        <span class="stat-value">${stats ? stats.accuracy : 'N/A'}%</span>
                    </div>
                    <div class="stat-row">
                        <span>Attack:</span>
                        <span class="stat-value">${stats ? stats.strength : 'N/A'}${attackMsg}</span>
                    </div>
                    <div class="stat-row">
                        <span>Defense:</span>
                        <span class="stat-value">${stats ? stats.defense : 'N/A'}${defenseBonus > 0 ? ` (+${defenseBonus})` : ''}</span>
                    </div>
                    <div class="stat-row">
                        <span>DV:</span>
                        <span class="stat-value">${stats ? stats.dv : 'N/A'}</span>
                    </div>
                    <div class="stat-row">
                        <span>Limb Protection:</span>
                        <span class="stat-value">${limbProtection}</span>
                    </div>
                    <div class="stat-row">
                        <span>HP Regen:</span>
                        <span class="stat-value">${health ? health.hpRegen : 'N/A'}/t</span>
                    </div>
                    <div class="stat-row">
                        <span>Mana Regen:</span>
                        <span class="stat-value">${mana ? mana.manaRegen : 'N/A'}/t</span>
                    </div>
                </div>
            </div>
        `;
        
        contentHTML += `
            <div class="stat-section">
                <h3>Equipment</h3>`;
                
        const getItemStats = (item) => {
            if (!item) return '';
            
            const equippable = item.getComponent('EquippableComponent');
            if (!equippable) return '';
            
            let statInfo = '';
            
            if (equippable.statModifiers && equippable.statModifiers.strength) {
                statInfo += `<span style="color: #6fc"> +${equippable.statModifiers.strength} ATK</span>`;
            }
            
            if (equippable.statModifiers && equippable.statModifiers.defense) {
                if (statInfo) statInfo += ', ';
                statInfo += `<span style="color: #6cf"> +${equippable.statModifiers.defense} DEF</span>`;
            }
            
            if (equippable.limbProtection) {
                if (statInfo) statInfo += ', ';
                statInfo += `<span style="color: #fc6"> +${equippable.limbProtection} LP</span>`;
            }
            
            if (equippable.limbDamage) {
                if (statInfo) statInfo += ', ';
                statInfo += `<span style="color: #f66"> +${equippable.limbDamage} LD</span>`;
            }
            
            return statInfo ? ` (${statInfo})` : '';
        };
                
        contentHTML += `
                <div class="equipment-slot">
                    <span class="slot-name">Head:</span>
                    <span class="${equipment && equipment.slots.head ? '' : 'slot-empty'}">
                        ${equipment && equipment.slots.head ? 
                            equipment.slots.head.name + getItemStats(equipment.slots.head) : 
                            'Empty'}
                    </span>
                </div>
                <div class="equipment-slot">
                    <span class="slot-name">Chest:</span>
                    <span class="${equipment && equipment.slots.chest ? '' : 'slot-empty'}">
                        ${equipment && equipment.slots.chest ? 
                            equipment.slots.chest.name + getItemStats(equipment.slots.chest) : 
                            'Empty'}
                    </span>
                </div>
                <div class="equipment-slot">
                    <span class="slot-name">Left Hand:</span>
                    <span class="${equipment && equipment.slots.leftHand ? '' : 'slot-empty'}">
                        ${equipment && equipment.slots.leftHand ? 
                            equipment.slots.leftHand.name + getItemStats(equipment.slots.leftHand) : 
                            'Empty'}
                    </span>
                </div>
                <div class="equipment-slot">
                    <span class="slot-name">Right Hand:</span>
                    <span class="${equipment && equipment.slots.rightHand ? '' : 'slot-empty'}">
                        ${equipment && equipment.slots.rightHand ? 
                            equipment.slots.rightHand.name + getItemStats(equipment.slots.rightHand) : 
                            'Empty'}
                    </span>
                </div>
                <div class="equipment-slot">
                    <span class="slot-name">Feet:</span>
                    <span class="${equipment && equipment.slots.feet ? '' : 'slot-empty'}">
                        ${equipment && equipment.slots.feet ? 
                            equipment.slots.feet.name + getItemStats(equipment.slots.feet) : 
                            'Empty'}
                    </span>
                </div>
                <div class="equipment-slot" style="display: none;">
                    <span class="slot-name">Weapon:</span>
                    <span class="${equipment && equipment.slots.weapon ? '' : 'slot-empty'}">
                        ${equipment && equipment.slots.weapon ? equipment.slots.weapon.name : 'Empty'}
                    </span>
                </div>
                <div class="equipment-slot" style="display: none;">
                    <span class="slot-name">Armor:</span>
                    <span class="${equipment && equipment.slots.armor ? '' : 'slot-empty'}">
                        ${equipment && equipment.slots.armor ? equipment.slots.armor.name : 'Empty'}
                    </span>
                </div>
            </div>
        `;
        
        if (limbs) {
            contentHTML += `
                <div class="stat-section">
                    <h3>Limb Health</h3>
            `;
            
            for (const [limbId, limb] of Object.entries(limbs.limbs)) {
                const limbName = limb.name;
                const limbHealth = limb.health;
                let healthColor = '#0f0';
                
                if (limbHealth < 30) {
                    healthColor = '#f00';
                } else if (limbHealth < 60) {
                    healthColor = '#f80';
                } else if (limbHealth < 90) {
                    healthColor = '#ff0';
                }
                
                contentHTML += `
                    <div class="stat-row">
                        <span>${limbName}:</span>
                        <span class="stat-value" style="color: ${healthColor};">${limbHealth}%</span>
                    </div>
                    <div class="hp-bar">
                        <div class="hp-fill" style="width: ${limbHealth}%; background-color: ${healthColor};"></div>
                    </div>
                `;
            }
            
            contentHTML += `</div>`;
        }
        
        this.characterElement.innerHTML = contentHTML;
    }
}

export default CharacterUI;
