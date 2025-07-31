/**
 * Integration layer for the new Dice Styling Manager
 * This file replaces the complex styling logic in game.js with simple calls to the styling manager
 */

// Integration functions to replace existing complex styling logic

/**
 * Initialize dice styling for the game
 */
function initializeDiceStyling(currentPlayerId, isMultiplayer = false) {
    window.diceStylingManager.initialize(currentPlayerId, isMultiplayer);
    
    // Set up multiplayer sync callbacks
    if (isMultiplayer) {
        window.diceStylingManager.setCallbacks(
            // Selection change callback
            (playerId, selectedIndices) => {
                if (typeof broadcastDiceSelection === 'function') {
                    broadcastDiceSelection(playerId, selectedIndices, currentDiceResults);
                }
            },
            // Lock change callback
            (playerId, lockedIndices) => {
                if (typeof broadcastLockedDice === 'function') {
                    broadcastLockedDice(playerId, lockedIndices, currentDiceResults);
                }
            }
        );
    }
}

/**
 * Update selection controls visibility and state
 */
function updateSelectionControlsVisibility() {
    const selectionControls = document.getElementById('dice-selection-controls');
    const lockButton = document.getElementById('lock-selected-dice');
    const clearButton = document.getElementById('clear-selection');
    
    if (!selectionControls || !lockButton || !clearButton) return;
    
    const canAct = canPlayerAct();
    const selectedIndices = window.diceStylingManager.getPlayerSelectedDice(myPlayerId);
    const hasSelection = selectedIndices.length > 0;
    const hasSelectableDice = currentDiceResults.length > 0; // Simplified check
    
    // Show/hide controls
    selectionControls.style.display = (hasSelectableDice && canAct) ? 'block' : 'none';
    
    // Update button states
    lockButton.disabled = !hasSelection;
    clearButton.disabled = !hasSelection;
    
    // Update button styling
    if (hasSelection) {
        lockButton.className = 'btn btn-success me-2';
        clearButton.className = 'btn btn-secondary me-2';
        
        // Calculate points for display
        const selectedValues = selectedIndices.map(index => currentDiceResults[index]);
        const scoreResult = calculateSelectedDiceScore(selectedValues);
        
        if (scoreResult.points > 0) {
            lockButton.textContent = `Lock Selected (${scoreResult.points} pts)`;
        } else {
            lockButton.textContent = 'Lock Selected (Invalid)';
            lockButton.className = 'btn btn-warning me-2';
        }
    } else {
        lockButton.textContent = 'Lock Selected Dice';
        lockButton.className = 'btn btn-secondary me-2';
        clearButton.className = 'btn btn-secondary me-2';
    }
    
    // Show/hide instruction text
    const instructionDiv = selectionControls.querySelector('.mt-2');
    if (instructionDiv) {
        instructionDiv.style.display = (hasSelectableDice && canAct) ? 'block' : 'none';
    }
}

// Make functions globally available
window.initializeDiceStyling = initializeDiceStyling;
window.updateSelectionControlsVisibility = updateSelectionControlsVisibility;
