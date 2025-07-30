// Game Settings Management
// This file handles customizable game rules and settings

// Default game settings
const DEFAULT_GAME_SETTINGS = {
    threeOnesRule: 300,    // Points for three 1s (300 or 1000)
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
                showGameSettingsMessage('Only the host can change game settings.', 'error');
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
            
            // Show success message
            showGameSettingsMessage('Game settings updated successfully! All scores have been reset.', 'success');
        } else {
            // No changes made
            const modal = bootstrap.Modal.getInstance(document.getElementById('gameSettingsModal'));
            if (modal) modal.hide();
        }
        
    } catch (error) {
        console.error('Error applying game settings:', error);
        // Show error message under the button instead of alert
        showGameSettingsMessage('Error applying settings. Please try again.', 'error');
    }
}

/**
 * Show a confirmation message under the game settings button
 */
function showGameSettingsMessage(message, type = 'success') {
    // Find or create the message element
    let messageElement = document.getElementById('game-settings-message');
    if (!messageElement) {
        messageElement = document.createElement('div');
        messageElement.id = 'game-settings-message';
        messageElement.style.marginTop = '10px';
        messageElement.style.padding = '8px 12px';
        messageElement.style.borderRadius = '4px';
        messageElement.style.fontSize = '14px';
        messageElement.style.fontWeight = '500';
        messageElement.style.textAlign = 'center';
        
        // Insert after the customize button
        const customizeButton = document.getElementById('customize-game-button');
        if (customizeButton && customizeButton.parentNode) {
            customizeButton.parentNode.insertBefore(messageElement, customizeButton.nextSibling);
        }
    }
    
    // Set message content and styling based on type
    messageElement.textContent = message;
    messageElement.style.display = 'block';
    
    if (type === 'success') {
        messageElement.style.backgroundColor = '#d4edda';
        messageElement.style.color = '#155724';
        messageElement.style.border = '1px solid #c3e6cb';
    } else if (type === 'error') {
        messageElement.style.backgroundColor = '#f8d7da';
        messageElement.style.color = '#721c24';
        messageElement.style.border = '1px solid #f5c6cb';
    }
    
    // Clear any existing timeout
    if (messageElement.hideTimeout) {
        clearTimeout(messageElement.hideTimeout);
    }
    
    // Hide after 4 seconds
    messageElement.hideTimeout = setTimeout(() => {
        messageElement.style.display = 'none';
    }, 4000);
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
    
    // Update scoring guide to reflect new settings
    updateScoringGuide();
    
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
            console.log(`📊 Scoring guide updated: Three 1s now worth ${currentGameSettings.threeOnesRule} points`);
        } else {
            console.warn('📊 Could not find points cell in three 1s row');
        }
    } else {
        console.warn('📊 Could not find three-ones-row element in scoring guide');
    }
    
    // Update goal and entry lines more safely by looking for specific IDs or classes first
    const scoringModal = document.getElementById('scoringModal');
    if (scoringModal) {
        // Try to find elements with specific IDs first
        const goalElement = document.getElementById('game-goal-text');
        const entryElement = document.getElementById('game-entry-text');
        
        if (goalElement) {
            goalElement.textContent = `🎯 Goal: First to ${currentGameSettings.winningScore.toLocaleString()} points wins`;
            console.log(`📊 Goal updated via ID: First to ${currentGameSettings.winningScore.toLocaleString()} points wins`);
        } else {
            // Fallback: search for text within specific container, but be more careful
            const modalBody = scoringModal.querySelector('.modal-body');
            if (modalBody) {
                const textNodes = [];
                const walker = document.createTreeWalker(
                    modalBody,
                    NodeFilter.SHOW_TEXT,
                    null,
                    false
                );
                
                let node;
                while (node = walker.nextNode()) {
                    if (node.textContent.includes('🎯 Goal: First to') && node.textContent.includes('points wins')) {
                        node.textContent = `🎯 Goal: First to ${currentGameSettings.winningScore.toLocaleString()} points wins`;
                        console.log(`📊 Goal updated via text search: First to ${currentGameSettings.winningScore.toLocaleString()} points wins`);
                        break;
                    }
                }
            }
        }
        
        if (entryElement) {
            entryElement.textContent = `🚀 Entry: Need ${currentGameSettings.minimumScore}+ points to get "on the board"`;
            console.log(`📊 Entry updated via ID: Need ${currentGameSettings.minimumScore}+ points to get on the board`);
        } else {
            // Fallback: search for text within specific container
            const modalBody = scoringModal.querySelector('.modal-body');
            if (modalBody) {
                const walker = document.createTreeWalker(
                    modalBody,
                    NodeFilter.SHOW_TEXT,
                    null,
                    false
                );
                
                let node;
                while (node = walker.nextNode()) {
                    if (node.textContent.includes('🚀 Entry: Need') && node.textContent.includes('points to get "on the board"')) {
                        node.textContent = `🚀 Entry: Need ${currentGameSettings.minimumScore}+ points to get "on the board"`;
                        console.log(`📊 Entry updated via text search: Need ${currentGameSettings.minimumScore}+ points to get on the board`);
                        break;
                    }
                }
            }
        }
    } else {
        console.warn('📊 Could not find scoring modal for goal/entry updates');
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
window.updateScoringGuide = updateScoringGuide;
