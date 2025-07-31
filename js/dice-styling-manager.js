/**
 * Dice Styling Manager - Simplified and centralized dice visual state management
 * Handles all dice styling for selection, locking, and multiplayer synchronization
 */

class DiceStylingManager {
    constructor() {
        // Dice state tracking
        this.diceStates = new Map(); // Map of diceId -> {state, playerId, value}
        this.playerStates = new Map(); // Map of playerId -> {selectedIndices, lockedIndices}
        
        // State constants
        this.STATES = {
            NORMAL: 'normal',
            SELECTED: 'selected',
            SELECTED_OTHER: 'selected-other',
            LOCKED: 'locked',
            ROLLING: 'rolling'
        };
        
        // CSS classes mapping
        this.CSS_CLASSES = {
            [this.STATES.NORMAL]: [],
            [this.STATES.SELECTED]: ['selected'],
            [this.STATES.SELECTED_OTHER]: ['selected-by-other'],
            [this.STATES.LOCKED]: ['locked'],
            [this.STATES.ROLLING]: ['rolling']
        };
        
        // Current player info
        this.currentPlayerId = null;
        this.isMultiplayer = false;
        
        // Callbacks for multiplayer sync
        this.onSelectionChange = null;
        this.onLockChange = null;
    }
    
    /**
     * Initialize the styling manager
     */
    initialize(currentPlayerId, isMultiplayer = false) {
        this.currentPlayerId = currentPlayerId;
        this.isMultiplayer = isMultiplayer;
        
        // Clear any existing state
        this.reset();
        
        // console.log('🎨 DiceStylingManager initialized for player:', currentPlayerId);
    }
    
    /**
     * Set callbacks for multiplayer synchronization
     */
    setCallbacks(onSelectionChange, onLockChange) {
        this.onSelectionChange = onSelectionChange;
        this.onLockChange = onLockChange;
    }
    
    /**
     * Create or update dice elements with proper styling
     */
    displayDice(containerId, diceResults, playerId = null) {
        const container = document.getElementById(containerId);
        if (!container) {
            // console.error('🎨 Container not found:', containerId);
            return;
        }
        
        const targetPlayerId = playerId || this.currentPlayerId;
        const isCurrentPlayer = targetPlayerId === this.currentPlayerId;
        
        // Clear container
        container.innerHTML = '';
        
        // Add player header if not current player
        if (!isCurrentPlayer) {
            const header = document.createElement('div');
            header.className = 'w-100 text-center mb-2';
            header.innerHTML = `<strong>${targetPlayerId}'s Roll:</strong>`;
            container.appendChild(header);
        }
        
        // Create dice container
        const diceContainer = document.createElement('div');
        diceContainer.className = 'd-flex justify-content-center align-items-center flex-wrap gap-2';
        
        // Create dice images
        diceResults.forEach((value, index) => {
            const diceElement = this.createDiceElement(value, index, targetPlayerId, isCurrentPlayer);
            diceContainer.appendChild(diceElement);
        });
        
        container.appendChild(diceContainer);
        
        // console.log(`🎨 Displayed ${diceResults.length} dice for ${targetPlayerId}`);
    }
    
    /**
     * Create a single dice element with appropriate styling and handlers
     */
    createDiceElement(value, index, playerId, isCurrentPlayer) {
        const img = document.createElement('img');
        img.src = `assets/dice${value}.png`;
        img.alt = `${playerId} dice ${index + 1} (value: ${value})`;
        img.style.cssText = `
            width: 60px;
            height: 60px;
            margin: 2px;
            border: 2px solid #ddd;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            cursor: ${isCurrentPlayer ? 'pointer' : 'default'};
            transition: all 0.2s ease;
        `;
        
        // Set data attributes
        img.dataset.diceIndex = index;
        img.dataset.diceValue = value;
        img.dataset.playerId = playerId;
        
        // Apply current state styling
        const diceId = this.getDiceId(playerId, index);
        const currentState = this.diceStates.get(diceId);
        if (currentState) {
            this.applyDiceState(img, currentState.state);
        }
        
        // Add click handler for current player only
        if (isCurrentPlayer) {
            img.addEventListener('click', () => this.handleDiceClick(index, img));
        }
        
        // Set appropriate title
        this.updateDiceTitle(img, value, index, playerId);
        
        return img;
    }
    
    /**
     * Handle dice click for selection
     */
    handleDiceClick(index, element) {
        const diceId = this.getDiceId(this.currentPlayerId, index);
        const currentState = this.diceStates.get(diceId);
        
        // Can't select locked or rolling dice
        if (currentState && (currentState.state === this.STATES.LOCKED || currentState.state === this.STATES.ROLLING)) {
            // console.log(`🎨 Cannot select dice ${index} - state: ${currentState.state}`);
            return;
        }
        
        // Toggle selection
        const newState = currentState?.state === this.STATES.SELECTED ? this.STATES.NORMAL : this.STATES.SELECTED;
        this.setDiceState(this.currentPlayerId, index, newState);
        
        // Update visual state
        this.applyDiceState(element, newState);
        this.updateDiceTitle(element, element.dataset.diceValue, index, this.currentPlayerId);
        
        // Trigger multiplayer sync if needed
        if (this.isMultiplayer && this.onSelectionChange) {
            const selectedIndices = this.getPlayerSelectedDice(this.currentPlayerId);
            this.onSelectionChange(this.currentPlayerId, selectedIndices);
        }
        
        // console.log(`🎨 Dice ${index} state changed to: ${newState}`);
    }
    
    /**
     * Set dice state for a specific player and index
     */
    setDiceState(playerId, index, state, value = null) {
        const diceId = this.getDiceId(playerId, index);
        this.diceStates.set(diceId, {
            state,
            playerId,
            index,
            value: value || this.diceStates.get(diceId)?.value
        });
        
        // Update player state tracking
        this.updatePlayerState(playerId);
    }
    
    /**
     * Apply visual styling based on dice state
     */
    applyDiceState(element, state) {
        // Clear all state classes
        Object.values(this.CSS_CLASSES).flat().forEach(cls => {
            element.classList.remove(cls);
        });
        
        // Apply new state classes
        const classes = this.CSS_CLASSES[state] || [];
        classes.forEach(cls => element.classList.add(cls));
        
        // Apply state-specific styling overrides if needed
        switch (state) {
            case this.STATES.NORMAL:
                element.style.cursor = 'pointer';
                break;
            case this.STATES.LOCKED:
                element.style.cursor = 'not-allowed';
                break;
            case this.STATES.ROLLING:
                element.style.cursor = 'wait';
                break;
        }
    }
    
    /**
     * Update player state tracking
     */
    updatePlayerState(playerId) {
        const selectedIndices = [];
        const lockedIndices = [];
        
        this.diceStates.forEach((diceState, diceId) => {
            if (diceState.playerId === playerId) {
                if (diceState.state === this.STATES.SELECTED) {
                    selectedIndices.push(diceState.index);
                } else if (diceState.state === this.STATES.LOCKED) {
                    lockedIndices.push(diceState.index);
                }
            }
        });
        
        this.playerStates.set(playerId, { selectedIndices, lockedIndices });
    }
    
    /**
     * Get selected dice indices for a player
     */
    getPlayerSelectedDice(playerId) {
        const playerState = this.playerStates.get(playerId);
        return playerState ? playerState.selectedIndices : [];
    }
    
    /**
     * Get locked dice indices for a player
     */
    getPlayerLockedDice(playerId) {
        const playerState = this.playerStates.get(playerId);
        return playerState ? playerState.lockedIndices : [];
    }
    
    /**
     * Lock selected dice for current player
     */
    lockSelectedDice() {
        const selectedIndices = this.getPlayerSelectedDice(this.currentPlayerId);
        if (selectedIndices.length === 0) {
            // console.log('🎨 No dice selected to lock');
            return false;
        }
        
        // Change selected dice to locked
        selectedIndices.forEach(index => {
            this.setDiceState(this.currentPlayerId, index, this.STATES.LOCKED);
        });
        
        // Update visual display
        this.refreshPlayerDisplay(this.currentPlayerId);
        
        // Trigger multiplayer sync if needed
        if (this.isMultiplayer && this.onLockChange) {
            const lockedIndices = this.getPlayerLockedDice(this.currentPlayerId);
            this.onLockChange(this.currentPlayerId, lockedIndices);
        }
        
        // console.log(`🎨 Locked ${selectedIndices.length} dice for ${this.currentPlayerId}`);
        return true;
    }
    
    /**
     * Clear all selected dice for current player
     */
    clearSelection() {
        const selectedIndices = this.getPlayerSelectedDice(this.currentPlayerId);
        selectedIndices.forEach(index => {
            this.setDiceState(this.currentPlayerId, index, this.STATES.NORMAL);
        });
        
        // Update visual display
        this.refreshPlayerDisplay(this.currentPlayerId);
        
        // Trigger multiplayer sync if needed
        if (this.isMultiplayer && this.onSelectionChange) {
            this.onSelectionChange(this.currentPlayerId, []);
        }
        
        // console.log(`🎨 Cleared selection for ${this.currentPlayerId}`);
    }
    
    /**
     * Update dice states from multiplayer data
     */
    updateFromMultiplayer(playerId, type, indices) {
        if (playerId === this.currentPlayerId) {
            return; // Don't update our own state from multiplayer
        }
        
        // Clear previous states for this player and type
        if (type === 'selection') {
            // Clear previous selections
            this.diceStates.forEach((state, diceId) => {
                if (state.playerId === playerId && state.state === this.STATES.SELECTED_OTHER) {
                    this.diceStates.set(diceId, { ...state, state: this.STATES.NORMAL });
                }
            });
            
            // Apply new selections
            indices.forEach(index => {
                this.setDiceState(playerId, index, this.STATES.SELECTED_OTHER);
            });
        } else if (type === 'lock') {
            // Clear previous locks
            this.diceStates.forEach((state, diceId) => {
                if (state.playerId === playerId && state.state === this.STATES.LOCKED) {
                    this.diceStates.set(diceId, { ...state, state: this.STATES.NORMAL });
                }
            });
            
            // Apply new locks
            indices.forEach(index => {
                this.setDiceState(playerId, index, this.STATES.LOCKED);
            });
        }
        
        // Refresh display if this player is currently shown
        this.refreshPlayerDisplay(playerId);
        
        // console.log(`🎨 Updated ${type} from multiplayer for ${playerId}:`, indices);
    }
    
    /**
     * Refresh visual display for a specific player
     */
    refreshPlayerDisplay(playerId) {
        const container = document.getElementById('dice-results-container');
        if (!container) return;
        
        // Check if this player's dice are currently displayed
        const header = container.querySelector('div strong');
        const isCurrentlyDisplayed = !header || header.textContent.includes(playerId) || playerId === this.currentPlayerId;
        
        if (!isCurrentlyDisplayed) {
            return; // This player's dice aren't currently visible
        }
        
        // Update all dice for this player
        const diceImages = container.querySelectorAll(`img[data-player-id="${playerId}"]`);
        diceImages.forEach(img => {
            const index = parseInt(img.dataset.diceIndex);
            const diceId = this.getDiceId(playerId, index);
            const state = this.diceStates.get(diceId);
            
            if (state) {
                this.applyDiceState(img, state.state);
                this.updateDiceTitle(img, img.dataset.diceValue, index, playerId);
            }
        });
        
        // console.log(`🎨 Refreshed display for ${playerId}`);
    }
    
    /**
     * Reset all dice states (for new turn/game)
     */
    reset() {
        this.diceStates.clear();
        this.playerStates.clear();
        // console.log('🎨 Reset all dice states');
    }
    
    /**
     * Reset states for a specific player
     */
    resetPlayer(playerId) {
        // Remove all dice states for this player
        const toDelete = [];
        this.diceStates.forEach((state, diceId) => {
            if (state.playerId === playerId) {
                toDelete.push(diceId);
            }
        });
        toDelete.forEach(diceId => this.diceStates.delete(diceId));
        
        // Remove player state
        this.playerStates.delete(playerId);
        
        // console.log(`🎨 Reset states for ${playerId}`);
    }
    
    /**
     * Helper to generate unique dice ID
     */
    getDiceId(playerId, index) {
        return `${playerId}_${index}`;
    }
    
    /**
     * Update dice title with current state information
     */
    updateDiceTitle(element, value, index, playerId) {
        const diceId = this.getDiceId(playerId, index);
        const state = this.diceStates.get(diceId);
        
        let title = `${playerId}'s dice ${index + 1} (value: ${value})`;
        
        if (state) {
            switch (state.state) {
                case this.STATES.SELECTED:
                    title += ' - SELECTED';
                    break;
                case this.STATES.SELECTED_OTHER:
                    title += ' - SELECTED';
                    break;
                case this.STATES.LOCKED:
                    title += ' - LOCKED';
                    break;
                case this.STATES.ROLLING:
                    title += ' - ROLLING';
                    break;
            }
        }
        
        element.title = title;
    }
    
    /**
     * Get current state summary for debugging
     */
    getDebugInfo() {
        const info = {
            totalDice: this.diceStates.size,
            players: Array.from(this.playerStates.keys()),
            statesByPlayer: {}
        };
        
        this.playerStates.forEach((state, playerId) => {
            info.statesByPlayer[playerId] = {
                selected: state.selectedIndices,
                locked: state.lockedIndices
            };
        });
        
        return info;
    }
}

// Create global instance
window.diceStylingManager = new DiceStylingManager();

// Export for module usage if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DiceStylingManager;
}
