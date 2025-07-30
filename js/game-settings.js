// Game Settings Management
// This file handles customizable game rules and settings

// Default game settings
const DEFAULT_GAME_SETTINGS = {
    threeOnesRule: 1000,    // Points for three 1s (300 or 1000)
    winningScore: 10000,    // Points needed to win
    minimumScore: 500       // Minimum score to get "on the board"
};

// Current game settings (initialized with defaults)
let currentGameSettings = { ...DEFAULT_GAME_SETTINGS };

/**
 * Initialize game settings system
 */
function initializeGameSettings() {
    // Load settings from localStorage if available
    loadGameSettings();
    
    // Set up event listeners
    setupGameSettingsEventListeners();
    
    // Show/hide customize button based on host status
    updateCustomizeButtonVisibility();
}

/**
 * Load game settings from localStorage
 */
function loadGameSettings() {
    try {
        const saved = localStorage.getItem('farkle_game_settings');
        if (saved) {
            const savedSettings = JSON.parse(saved);
            currentGameSettings = { ...DEFAULT_GAME_SETTINGS, ...savedSettings };
        }
        
        // Apply settings to UI
        applySettingsToUI();
        
        console.log('Game settings loaded:', currentGameSettings);
    } catch (error) {
        console.error('Error loading game settings:', error);
        currentGameSettings = { ...DEFAULT_GAME_SETTINGS };
    }
}

/**
 * Save game settings to localStorage
 */
function saveGameSettings() {
    try {
        localStorage.setItem('farkle_game_settings', JSON.stringify(currentGameSettings));
        console.log('Game settings saved:', currentGameSettings);
    } catch (error) {
        console.error('Error saving game settings:', error);
    }
}

/**
 * Apply current settings to the UI form
 */
function applySettingsToUI() {
    // Set three 1s rule radio button
    const threeOnes300 = document.getElementById('threeOnes300');
    const threeOnes1000 = document.getElementById('threeOnes1000');
    
    if (currentGameSettings.threeOnesRule === 300) {
        if (threeOnes300) threeOnes300.checked = true;
    } else {
        if (threeOnes1000) threeOnes1000.checked = true;
    }
    
    // Set winning score
    const winningScoreSelect = document.getElementById('winningScore');
    if (winningScoreSelect) {
        winningScoreSelect.value = currentGameSettings.winningScore.toString();
    }
    
    // Set minimum score
    const minimumScoreSelect = document.getElementById('minimumScore');
    if (minimumScoreSelect) {
        minimumScoreSelect.value = currentGameSettings.minimumScore.toString();
    }
}

/**
 * Set up event listeners for game settings
 */
function setupGameSettingsEventListeners() {
    const applyButton = document.getElementById('apply-game-settings');
    if (applyButton) {
        applyButton.addEventListener('click', () => {
            if (isGameHost()) {
                applyGameSettings();
            } else {
                alert('Only the host can change game settings.');
            }
        });
    }
}

/**
 * Apply the settings from the modal form
 */
function applyGameSettings() {
    try {
        // Get three 1s rule
        const threeOnes300 = document.getElementById('threeOnes300');
        const threeOnes1000 = document.getElementById('threeOnes1000');
        
        let threeOnesRule = 1000; // default
        if (threeOnes300 && threeOnes300.checked) {
            threeOnesRule = 300;
        } else if (threeOnes1000 && threeOnes1000.checked) {
            threeOnesRule = 1000;
        }
        
        // Get other settings
        const winningScoreSelect = document.getElementById('winningScore');
        const minimumScoreSelect = document.getElementById('minimumScore');
        
        const winningScore = winningScoreSelect ? parseInt(winningScoreSelect.value) : 10000;
        const minimumScore = minimumScoreSelect ? parseInt(minimumScoreSelect.value) : 500;
        
        // Update current settings
        const oldSettings = { ...currentGameSettings };
        currentGameSettings = {
            threeOnesRule,
            winningScore,
            minimumScore
        };
        
        // Save settings
        saveGameSettings();
        
        // Check if settings actually changed
        const settingsChanged = JSON.stringify(oldSettings) !== JSON.stringify(currentGameSettings);
        
        if (settingsChanged) {
            // Show confirmation and reset scores
            const modal = bootstrap.Modal.getInstance(document.getElementById('gameSettingsModal'));
            if (modal) modal.hide();
            
            // Show success message
            setTimeout(() => {
                alert(`Game settings updated!\n\n` +
                      `Three 1s: ${threeOnesRule} points\n` +
                      `Winning Score: ${winningScore.toLocaleString()} points\n` +
                      `Minimum Score: ${minimumScore} points\n\n` +
                      `All scores have been reset.`);
                
                // Reset all scores
                if (typeof resetAllScores === 'function') {
                    resetAllScores();
                }
                
                // Broadcast settings change to other players if in multiplayer
                if (isInMultiplayerRoom && typeof broadcastGameSettings === 'function') {
                    broadcastGameSettings(currentGameSettings);
                }
                
                // Update scoring guide if it's open
                updateScoringGuide();
                
            }, 300);
        } else {
            // No changes made
            const modal = bootstrap.Modal.getInstance(document.getElementById('gameSettingsModal'));
            if (modal) modal.hide();
        }
        
    } catch (error) {
        console.error('Error applying game settings:', error);
        alert('Error applying settings. Please try again.');
    }
}

/**
 * Check if current player is the game host (for room settings)
 */
function isGameHost() {
    // In single player mode, always host
    if (!isInMultiplayerRoom) {
        return true;
    }
    
    // In multiplayer, check if we're the first player or room creator
    // This is a simple implementation - you might want more sophisticated host detection
    const roomName = document.getElementById('room-name')?.value?.trim();
    const playerName = document.getElementById('player-name')?.value?.trim();
    
    // For now, consider the first player alphabetically as host
    // You could implement a more sophisticated system
    if (typeof getAllPlayerScores === 'function') {
        const players = Object.keys(getAllPlayerScores());
        return players.length === 0 || players.sort()[0] === playerName;
    }
    
    return false;
}

/**
 * Update visibility of customize button based on host status
 */
function updateCustomizeButtonVisibility() {
    const customizeButton = document.getElementById('customize-game-button');
    if (customizeButton) {
        if (isGameHost()) {
            customizeButton.style.display = 'block';
        } else {
            customizeButton.style.display = 'none';
        }
    }
}

/**
 * Get current game settings
 */
function getGameSettings() {
    return { ...currentGameSettings };
}

/**
 * Update settings from external source (e.g., multiplayer sync)
 */
function updateGameSettings(newSettings) {
    currentGameSettings = { ...DEFAULT_GAME_SETTINGS, ...newSettings };
    applySettingsToUI();
    saveGameSettings();
    console.log('Game settings updated from external source:', currentGameSettings);
}

/**
 * Reset game settings to defaults
 */
function resetGameSettings() {
    currentGameSettings = { ...DEFAULT_GAME_SETTINGS };
    applySettingsToUI();
    saveGameSettings();
}

/**
 * Get the current three 1s rule value
 */
function getThreeOnesValue() {
    return currentGameSettings.threeOnesRule;
}

/**
 * Update the scoring guide modal to reflect current settings
 */
function updateScoringGuide() {
    // Find the three 1s row in the scoring guide
    const threeOnesRow = document.getElementById('three-ones-row');
    if (threeOnesRow) {
        const pointsCell = threeOnesRow.cells[1]; // Second cell contains the points
        if (pointsCell) {
            pointsCell.innerHTML = `<span class="text-success">${currentGameSettings.threeOnesRule.toLocaleString()} pts</span>`;
        }
    }
}

/**
 * Reset all scores (called when settings change)
 */
function resetAllScores() {
    // Reset local scores
    if (typeof initializePlayerScores === 'function') {
        const players = Object.keys(getAllPlayerScores() || {});
        initializePlayerScores(players);
    }
    
    // Reset pending points
    if (typeof clearPendingPoints === 'function') {
        clearPendingPoints();
    }
    
    // Update displays
    if (typeof updateGameControlsState === 'function') {
        updateGameControlsState();
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initializeGameSettings();
    
    // Update scoring guide when it's opened
    const scoringModal = document.getElementById('scoringModal');
    if (scoringModal) {
        scoringModal.addEventListener('show.bs.modal', () => {
            updateScoringGuide();
        });
    }
});

// Export functions for global access
window.getGameSettings = getGameSettings;
window.updateGameSettings = updateGameSettings;
window.getThreeOnesValue = getThreeOnesValue;
window.isGameHost = isGameHost;
window.updateCustomizeButtonVisibility = updateCustomizeButtonVisibility;
