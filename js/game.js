// Ensure diceModels is defined at the very top of the file
const diceModels = [];

// Material system variables - load from saved preferences
const savedPreferences = loadMaterialPreferences();
let currentDiceMaterial = savedPreferences.dice;
let currentFloorMaterial = savedPreferences.floor;
let currentBackgroundMaterial = savedPreferences.background || 'white';

// Turn-based system variables
let myPlayerId = null;
let isInMultiplayerRoom = false;

// Make myPlayerId globally accessible for WebRTC integration
window.myPlayerId = myPlayerId;

// Use a div container for dice results images
const diceResultsContainer = document.getElementById('dice-results-container');
if (!diceResultsContainer) {
    throw new Error('Dice results container element not found. Ensure the div element exists in the HTML with the correct ID.');
}

// Dice selection and locking state
let currentDiceResults = [];
let selectedDiceIndices = [];
let lockedDiceIndices = [];
let availableDiceCount = 6;

// Ensure arrays are always properly initialized
function ensureArraysInitialized() {
    if (!Array.isArray(currentDiceResults)) currentDiceResults = [];
    if (!Array.isArray(selectedDiceIndices)) selectedDiceIndices = [];
    if (!Array.isArray(lockedDiceIndices)) lockedDiceIndices = [];
}

// Safe includes function to prevent undefined errors
function safeIncludes(array, value) {
    return Array.isArray(array) ? array.includes(value) : false;
}

// Initialize arrays immediately
ensureArraysInitialized();

// Store locked dice state for each player (for spectating functionality)
let playerLockedDiceStates = {};
let playerLockedDiceValues = {}; // Store actual dice values for locked dice
// Make it accessible globally for debugging
window.playerLockedDiceStates = playerLockedDiceStates;

// Define utility function early to ensure it's available
window.clearAllDiceLockedStyling = function() {
    // console.log('🧹 Clearing all locked dice styling from display (early definition)');
    
    const diceResultsContainer = document.getElementById('dice-results-container');
    if (!diceResultsContainer) return;
    
    // Find all dice images and remove locked classes/styling
    const allDiceImages = diceResultsContainer.querySelectorAll('img');
    allDiceImages.forEach(diceImage => {
        // Remove CSS classes
        diceImage.classList.remove('locked');
        diceImage.classList.remove('selected-by-other');
        diceImage.classList.remove('selected');
        
        // Force remove CSS properties that might be applied by the locked class
        diceImage.style.removeProperty('opacity');
        diceImage.style.removeProperty('filter');
        diceImage.style.removeProperty('cursor');
        diceImage.style.removeProperty('background-color');
        diceImage.style.removeProperty('animation');
        
        // Reset border and box-shadow to default dice styling
        diceImage.style.border = '2px solid #ddd';
        diceImage.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
        
        // Reset any locked-specific styling
        if (diceImage.title && diceImage.title.includes('LOCKED')) {
            // Remove "LOCKED" from title and reset to basic title
            const value = diceImage.dataset.diceValue || diceImage.alt.match(/\d+/)?.[0];
            const index = diceImage.dataset.diceIndex || 0;
            diceImage.title = `Dice ${parseInt(index) + 1} (value: ${value})`;
        }
    });
    
    // console.log('🧹 Cleared locked styling from all dice images (early definition)');
};

// Clear locked dice styling for a specific player
window.clearPlayerLockedDiceStyling = function(playerId) {
    console.log(`🧹 [PLAYER CLEAR DEBUG] Clearing locked dice styling for player: ${playerId}`);
    
    const diceResultsContainer = document.getElementById('dice-results-container');
    if (!diceResultsContainer) {
        console.log(`🧹 [PLAYER CLEAR DEBUG] No dice results container found`);
        return;
    }
    
    // Find dice images for the specific player and remove locked classes/styling
    const playerDiceImages = diceResultsContainer.querySelectorAll(`img[alt*="${playerId}"]`);
    console.log(`🧹 [PLAYER CLEAR DEBUG] Found ${playerDiceImages.length} dice images for ${playerId}`);
    
    playerDiceImages.forEach((diceImage, index) => {
        // Remove CSS classes
        diceImage.classList.remove('locked');
        diceImage.classList.remove('selected-by-other');
        diceImage.classList.remove('selected');
        
        // Force remove CSS properties that might be applied by the locked class
        diceImage.style.removeProperty('opacity');
        diceImage.style.removeProperty('filter');
        diceImage.style.removeProperty('cursor');
        diceImage.style.removeProperty('background-color');
        diceImage.style.removeProperty('animation');
        
        // Reset border and box-shadow to default dice styling
        diceImage.style.border = '2px solid #ddd';
        diceImage.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
        
        // Reset any locked-specific styling in title
        if (diceImage.title && diceImage.title.includes('LOCKED')) {
            const value = diceImage.dataset.diceValue || diceImage.alt.match(/\d+/)?.[0];
            diceImage.title = `${playerId}'s dice ${index + 1} (value: ${value})`;
        }
        
        console.log(`🧹 [PLAYER CLEAR DEBUG] Cleared locked styling for ${playerId}'s dice ${index}`);
    });
    
    console.log(`🧹 [PLAYER CLEAR DEBUG] Completed clearing locked dice styling for ${playerId}`);
};

// Initialize Three.js scene
const scene = new THREE.Scene();
// The following perspectiveCamera uses the following properties: fov, aspect, near, far
const camera = new THREE.PerspectiveCamera(50, 500 / 500, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('dice-canvas'), antialias: true });
renderer.setSize(500, 500);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// Set the background color of the scene to white
renderer.setClearColor(0xffffff);

// Add lighting to the scene
const ambientLight = new THREE.AmbientLight(0x404040, 0.4); // Soft white light
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
directionalLight.position.set(10, 10, 5);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
directionalLight.shadow.camera.near = 0.1;
directionalLight.shadow.camera.far = 50;
directionalLight.shadow.camera.left = -20;
directionalLight.shadow.camera.right = 20;
directionalLight.shadow.camera.top = 20;
directionalLight.shadow.camera.bottom = -20;
scene.add(directionalLight);

// Add a second directional light from another angle for better illumination
const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.6);
directionalLight2.position.set(-5, 8, -5);
scene.add(directionalLight2);

// Fixed camera setup - optimal view for dice game
function setupDefaultCamera() {
    // Position camera for an optimal top-down angled view
    // This provides a good perspective of the dice while maintaining readability
    camera.position.set(0, 18, 0); // Slightly behind and above for better view
    camera.lookAt(0, 0, 0); // Look at center of dice area
}

// Set initial camera position
setupDefaultCamera();

// Apply saved background material preference
if (currentBackgroundMaterial !== 'white') {
    changeBackgroundMaterial(currentBackgroundMaterial);
}

// Get the dice canvas element for WebGL rendering
const diceCanvas = document.getElementById('dice-canvas');

// Turn-based system functions
function canPlayerAct(playerId = myPlayerId) {
    if (!isInMultiplayerRoom) return true; // Single player mode - always allow
    
    // FIXED: For Firebase state management, rely primarily on Firebase turn state
    // This ensures consistency across all clients, especially with 3+ players
    if (typeof currentRoomId !== 'undefined' && currentRoomId && typeof currentPlayerId !== 'undefined' && currentPlayerId) {
        // Use Firebase current turn player as the primary source of truth
        if (typeof window.firebaseCurrentTurnPlayer !== 'undefined') {
            return window.firebaseCurrentTurnPlayer === playerId;
        }
        
        // Fallback to isPlayerTurn function if Firebase state not yet available
        return isPlayerTurn(playerId);
    }
    
    // Fallback to original turn system for non-Firebase scenarios
    return isPlayerTurn(playerId);
}

function updateGameControlsState() {
    // console.log('🎮 === updateGameControlsState() START ===');
    
    const rollButton = document.getElementById('roll-dice');
    const bankPointsButton = document.getElementById('bank-points');
    const materialsButton = document.getElementById('materials-button');
    const diceSelectionControls = document.getElementById('dice-selection-controls');
    const diceCanvas = document.getElementById('dice-canvas');
    const diceResultsContainer = document.getElementById('dice-results-container');
    
    const canAct = canPlayerAct();
    const hasPendingPoints = typeof getPendingPoints === 'function' ? getPendingPoints() > 0 : false;
    
    // Find the dice rolling container (the card containing roll button)
    const diceRollingContainer = rollButton ? rollButton.closest('.card') : null;
    
    // console.log('🎮 Control state info:', {
    //     myPlayerId,
    //     isInMultiplayerRoom,
    //     canAct,
    //     hasPendingPoints,
    //     currentTurn: typeof getCurrentTurn === 'function' ? getCurrentTurn() : 'function not available',
    //     elementsFound: {
    //         rollButton: !!rollButton,
    //         bankPointsButton: !!bankPointsButton,
    //         materialsButton: !!materialsButton,
    //         diceSelectionControls: !!diceSelectionControls,
    //         diceCanvas: !!diceCanvas,
    //         diceResultsContainer: !!diceResultsContainer,
    //         energySliderContainer: !!energySliderContainer,
    //         diceRollingContainer: !!diceRollingContainer
    //     }
    // });
    
    // Note: Dice canvas visibility is now controlled by Firebase state manager based on player state
    // The showDiceRollingUI/hideDiceRollingUI functions handle dice canvas display
    
    // Always keep dice results container visible for showing other players' results
    if (diceResultsContainer) {
        // console.log('🎮 Setting dice results container to visible');
        diceResultsContainer.style.display = 'flex';
    }
    
    // Show/hide dice rolling container based on turn
    if (diceRollingContainer) {
        if (canAct) {
            // console.log('🎮 Showing dice rolling container (player can act)');
            diceRollingContainer.style.display = 'block';
        } else {
            // console.log('🎮 Hiding dice rolling container (not player\'s turn)');
            diceRollingContainer.style.display = 'none';
        }
    }
    
    // Show waiting message if it's not your turn and in multiplayer mode
    const isMyTurn = typeof isPlayerTurn === 'function' ? isPlayerTurn(myPlayerId) : true;
    if (!isMyTurn && isInMultiplayerRoom) {
        // console.log('🎮 Not my turn and in multiplayer - showing waiting message');
        // console.log('🎮 Debug: myPlayerId =', myPlayerId, 'isMyTurn =', isMyTurn);
        showWaitingForTurnMessage();
    } else if (isMyTurn && isInMultiplayerRoom) {
        // console.log('🎮 It is my turn - ensuring waiting message is not shown');
        // If it's my turn and the dice results container only has waiting message, clear it
        const diceResultsContainer = document.getElementById('dice-results-container');
        if (diceResultsContainer && diceResultsContainer.textContent.includes('Waiting for other player')) {
            diceResultsContainer.innerHTML = '<p class="text-muted">Click "Roll" to start your turn</p>';
        }
    }
    
    // Enable/disable materials button based on turn
    if (materialsButton) {
        const newDisabled = !canAct;
        // console.log(`🎮 Setting materials button disabled: ${materialsButton.disabled} → ${newDisabled}`);
        materialsButton.disabled = newDisabled;
    }
    
    // Enable/disable roll button based on turn AND whether they need to lock dice first
    if (rollButton) {
        const newDisabled = !canAct || hasRolledThisTurn || isRolling;
        // console.log('🎮 Roll button state check:', {
        //     canAct,
        //     hasRolledThisTurn,
        //     isRolling,
        //     newDisabled,
        //     currentText: rollButton.textContent
        // });
        rollButton.disabled = newDisabled;
        
        // Update button text to indicate current state
        if (isRolling && canAct) {
            rollButton.textContent = 'Rolling...';
            // console.log('🎮 Setting button to: Rolling...');
        } else if (hasRolledThisTurn && canAct) {
            rollButton.textContent = 'Lock Dice First';
            // console.log('🎮 Setting button to: Lock Dice First');
        } else if (canAct) {
            rollButton.textContent = 'Roll';
            // console.log('🎮 Setting button to: Roll');
        }
    }
    
    // Show/hide dice selection controls based on turn AND whether there are dice to select
    if (diceSelectionControls) {
        ensureArraysInitialized(); // Ensure arrays are properly initialized
        const hasDiceDisplayed = currentDiceResults && currentDiceResults.length > 0;
        const hasSelectableDice = hasDiceDisplayed && currentDiceResults.some((_, index) => !safeIncludes(lockedDiceIndices, index));
        const shouldShowControls = canAct && hasSelectableDice;
        
        if (shouldShowControls) {
            diceSelectionControls.style.display = 'block';
            // Update selection controls based on current selection state
            updateSelectionControls();
            // Show instruction text when controls are visible
            updateInstructionTextVisibility(true);
        } else {
            diceSelectionControls.style.display = 'none';
            // Hide instruction text when controls are hidden
            updateInstructionTextVisibility(false);
        }
    }
    
    // Show/hide and enable bank points button
    if (bankPointsButton) {
        let newDisabled = !canAct;
        const newDisplay = (canAct && hasPendingPoints) ? 'inline-block' : 'none';
        
        // Disable bank button if player has rolled but hasn't locked any dice yet
        if (hasRolledThisTurn) {
            newDisabled = true;
        }
        
        if (hasPendingPoints) {
            const currentPending = getPendingPoints();
            
            // Check minimum score requirement for players with 0 points
            const currentPlayerId = (typeof getCurrentTurn === 'function') ? getCurrentTurn() : myPlayerId;
            const currentPlayerScore = (typeof getPlayerScore === 'function') ? getPlayerScore(currentPlayerId) : 0;
            const gameSettings = (typeof getGameSettings === 'function') ? getGameSettings() : { minimumScore: 500 };
            const minimumRequired = gameSettings.minimumScore || 500;
            
            if (currentPlayerScore === 0 && currentPending < minimumRequired) {
                newDisabled = true;
                bankPointsButton.textContent = `Need ${minimumRequired - currentPending} More Points (${currentPending}/${minimumRequired})`;
                bankPointsButton.classList.add('btn-secondary');
                bankPointsButton.classList.remove('btn-warning');
            } else if (hasRolledThisTurn) {
                // Player has rolled but not locked dice yet
                bankPointsButton.textContent = 'Lock Dice First to Bank';
                bankPointsButton.classList.add('btn-secondary');
                bankPointsButton.classList.remove('btn-warning');
            } else {
                bankPointsButton.textContent = `Bank ${currentPending} Points & End Turn`;
                bankPointsButton.classList.add('btn-warning');
                bankPointsButton.classList.remove('btn-secondary');
            }
            
            // console.log(`🎮 💰 BANK BUTTON: Updating text with ${currentPending} pending points`);
        }
        
        // console.log(`🎮 Setting bank button - disabled: ${bankPointsButton.disabled} → ${newDisabled}, display: ${bankPointsButton.style.display} → ${newDisplay}`);
        bankPointsButton.disabled = newDisabled;
        bankPointsButton.style.display = newDisplay;
    }
    
    // console.log('🎮 === updateGameControlsState() END ===');
    // Note: Turn display is now handled by updateTurnDisplay() in the player list
    // No need for separate turn indicator element
}

// Dice rolling logic
const rollDiceButton = document.getElementById('roll-dice');

// Ensure diceCanvas is properly initialized for WebGL rendering only
if (!diceCanvas) {
    throw new Error('Dice canvas element not found. Ensure the canvas element exists in the HTML with the correct ID.');
}

// Function to simulate dice roll
function rollDice() {
    // Ensure arrays are initialized before use
    ensureArraysInitialized();
    
    // Check if player can act
    if (!canPlayerAct()) {
        // console.log('Cannot roll dice - not your turn!');
        return;
    }
    
    const diceResults = [];
    
    // Generate results for all 6 dice positions
    for (let i = 0; i < 6; i++) {
        if (safeIncludes(lockedDiceIndices, i)) {
            // Keep the previous result for locked dice
            diceResults.push(currentDiceResults[i] || 1);
        } else {
            // Generate new result for available dice
            const result = Math.floor(Math.random() * 6) + 1;
            diceResults.push(result);
        }
    }
    
    return diceResults;
}

// Function to render the scene
function renderScene() {
    renderer.render(scene, camera);
}

// Function to display dice results as images
function displayDiceResults(results) {
    // Store current results
    currentDiceResults = results;
    
    // Clear previous results
    diceResultsContainer.innerHTML = '';
    
    // Defensive: Clear any potentially stale locked dice styling from the container
    // This ensures we start with a clean slate
    const existingImages = diceResultsContainer.querySelectorAll('img');
    existingImages.forEach(img => {
        img.classList.remove('locked', 'selected-by-other', 'selected', 'rolling');
    });

    results.forEach((result, index) => {
        // Create an image element for each dice result
        const diceImage = document.createElement('img');
        diceImage.src = `assets/dice${result}.png`;
        diceImage.alt = `Dice ${index + 1}: ${result}`;
        diceImage.style.width = '60px';
        diceImage.style.height = '60px';
        diceImage.style.margin = '2px';
        diceImage.style.border = '2px solid #ddd';
        diceImage.style.borderRadius = '8px';
        diceImage.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
        
        // Add data attributes for tracking
        diceImage.dataset.diceIndex = index;
        diceImage.dataset.diceValue = result;
        
        // Check if this dice is locked
        ensureArraysInitialized(); // Ensure arrays are initialized
        const isLocked = safeIncludes(lockedDiceIndices, index);
        
        if (isLocked) {
            // Apply locked styling
            diceImage.classList.add('locked');
            diceImage.title = `Dice ${index + 1} is locked (value: ${result})`;
        } else {
            // Check if dice is currently rolling
            if (isRolling) {
                diceImage.classList.add('rolling');
                diceImage.title = `Dice ${index + 1} is rolling (current: ${result})`;
            } else {
                diceImage.title = `Click to select dice ${index + 1} (value: ${result})`;
                // Add click handler for selection (only for unlocked, settled dice)
                diceImage.addEventListener('click', () => {
                    if (canPlayerAct()) {
                        toggleDiceSelection(index, diceImage);
                    } else {
                        // console.log('Cannot select dice - not your turn!');
                    }
                });
                
                // Apply selection state if already selected
                if (safeIncludes(selectedDiceIndices, index)) {
                    diceImage.classList.add('selected');
                }
            }
        }
        
        // Add error handling for missing images
        diceImage.onerror = function() {
            this.style.display = 'none';
            // console.warn(`Could not load dice image: assets/dice${result}.png`);
        };
        
        diceResultsContainer.appendChild(diceImage);
    });
    
    // Show/hide selection controls based on whether there are unlocked dice to select AND if it's the player's turn
    const selectionControls = document.getElementById('dice-selection-controls');
    if (selectionControls) {
        ensureArraysInitialized(); // Ensure arrays are initialized
        const hasSelectableDice = results.some((_, index) => !safeIncludes(lockedDiceIndices, index));
        const canAct = canPlayerAct();
        selectionControls.style.display = (hasSelectableDice && canAct) ? 'block' : 'none';
        
        // Show/hide instruction text based on whether there are dice to select
        updateInstructionTextVisibility(hasSelectableDice && canAct);
    }
    
    // Update selection control states based on current selection
    updateSelectionControls();
}

// Function to display other players' dice results
function displayOtherPlayerResults(playerId, diceResults) {
    // console.log(`🎲 [displayOtherPlayerResults] Called for ${playerId} with results:`, diceResults);
    // console.log(`🎲 [displayOtherPlayerResults] Current stored locked states:`, JSON.stringify(playerLockedDiceStates));
    
    // Don't interrupt our own rolling animation
    if (isRolling && (playerId === myPlayerId || playerId === window.myPlayerId)) {
        // console.log(`🎲 [displayOtherPlayerResults] Skipping - currently rolling for same player`);
        return;
    }
    
    const diceResultsContainer = document.getElementById('dice-results-container');
    if (!diceResultsContainer) return;
    
    // Clear the container and show the other player's results
    diceResultsContainer.innerHTML = '';
    
    // Add a header showing whose turn it is
    const header = document.createElement('div');
    header.className = 'w-100 text-center mb-2';
    header.innerHTML = `<strong>${playerId}'s Roll:</strong>`;
    diceResultsContainer.appendChild(header);
    
    // Create a container for the dice images
    const diceContainer = document.createElement('div');
    diceContainer.className = 'd-flex justify-content-center align-items-center flex-wrap gap-2';
    
    diceResults.forEach((result, index) => {
        const diceImage = document.createElement('img');
        diceImage.src = `assets/dice${result}.png`;
        diceImage.alt = `${playerId}'s Dice ${index + 1}: ${result}`;
        diceImage.style.width = '60px';
        diceImage.style.height = '60px';
        diceImage.style.margin = '5px';
        diceImage.style.border = '2px solid #6c757d'; // Gray border to show it's not interactive
        diceImage.style.borderRadius = '8px';
        diceImage.style.opacity = '0.8'; // Slightly transparent to show it's not your turn
        diceImage.title = `${playerId}'s dice ${index + 1} (value: ${result})`;
        
        // Check if this dice is locked for this player and apply red glow
        const playerLockedDice = playerLockedDiceStates[playerId] || [];
        if (safeIncludes(playerLockedDice, index)) {
            diceImage.classList.add('locked');
            diceImage.title = `${playerId}'s dice ${index + 1} (value: ${result}) - LOCKED`;
        }
        
        // Add error handling for missing images
        diceImage.onerror = function() {
            this.style.display = 'none';
            // console.warn(`Could not load dice image: assets/dice${result}.png`);
        };
        
        diceContainer.appendChild(diceImage);
    });
    
    diceResultsContainer.appendChild(diceContainer);
    
    // console.log(`🎲 [displayOtherPlayerResults] Displayed dice results for ${playerId} with locked dice:`, playerLockedDiceStates[playerId] || []);
    
    // Hide dice selection controls when showing other player's results (not interactive)
    const diceSelectionControls = document.getElementById('dice-selection-controls');
    if (diceSelectionControls) {
        diceSelectionControls.style.display = 'none';
    }
    
    // Hide instruction text when showing other player's results
    updateInstructionTextVisibility(false);
}

// Function to display other players' dice selections (updates existing dice with selection indicators)
function displayOtherPlayerDiceSelections(data) {
    const { playerId, selectedDiceIndices, diceResults } = data;
    
    // Ensure arrays are properly initialized and validate incoming data
    ensureArraysInitialized();
    const validSelectedDiceIndices = Array.isArray(selectedDiceIndices) ? selectedDiceIndices : [];
    
    // console.log(`🎯 Displaying dice selections from ${playerId}:`, validSelectedDiceIndices);
    // console.log(`🎯 Current locked dice for ${playerId}:`, playerLockedDiceStates[playerId] || []);
    
    // Only show selection indicators if the dice results are currently displayed for this player
    const diceResultsContainer = document.getElementById('dice-results-container');
    if (!diceResultsContainer) return;
    
    // Check if we're currently showing this player's results
    const header = diceResultsContainer.querySelector('div strong');
    if (!header || !header.textContent.includes(playerId)) {
        // console.log(`🎯 Not currently showing ${playerId}'s results, skipping selection display`);
        return;
    }
    
    // Find all dice images and update their selection indicators
    const diceImages = diceResultsContainer.querySelectorAll('img[alt*="' + playerId + '"]');
    diceImages.forEach((diceImage, index) => {
        // Remove any existing selection indicators, but preserve locked indicators
        diceImage.classList.remove('selected-by-other');
        
        // Check if this dice is locked (preserve locked styling)
        const playerLockedDice = playerLockedDiceStates[playerId] || [];
        const isLocked = safeIncludes(playerLockedDice, index);
        
        if (isLocked) {
            // Keep locked styling and don't override it
            diceImage.classList.add('locked');
            diceImage.title = `${playerId}'s dice ${index + 1} (value: ${diceResults[index]}) - LOCKED`;
        } else {
            // Clear any inline selection styling first for non-locked dice
            diceImage.style.border = '';
            diceImage.style.boxShadow = '';
            
            // Add selection indicator if this dice is selected
            if (safeIncludes(validSelectedDiceIndices, index)) {
                diceImage.classList.add('selected-by-other');
                diceImage.title = `${playerId}'s dice ${index + 1} (value: ${diceResults[index]}) - SELECTED`;
                // console.log(`🎯 Applied selection styling to dice ${index} for ${playerId}`);
            } else {
                diceImage.title = `${playerId}'s dice ${index + 1} (value: ${diceResults[index]})`;
                // console.log(`🎯 Cleared selection styling from dice ${index} for ${playerId}`);
            }
        }
    });
}

// Global flag to temporarily disable locked dice styling
window.lockedDiceStylingDisabled = false;

// Function to display other players' locked dice (updates existing dice with locked indicators)
function displayOtherPlayerLockedDice(data) {
    console.log('🔒 [DISPLAY DEBUG] displayOtherPlayerLockedDice called with data:', {
        fullData: data,
        playerId: data?.playerId,
        lockedDiceIndices: data?.lockedDiceIndices,
        diceResults: data?.diceResults,
        timestamp: new Date().toISOString()
    });
    
    // Check if locked dice styling is temporarily disabled
    if (window.lockedDiceStylingDisabled) {
        console.log('🔒 [DISPLAY DEBUG] Locked dice styling is temporarily disabled, skipping');
        return;
    }
    
    const { playerId, lockedDiceIndices, diceResults } = data;
    
    console.log('🔒 [DISPLAY DEBUG] Processing locked dice for player:', {
        playerId: playerId,
        rawLockedDiceIndices: lockedDiceIndices,
        isArray: Array.isArray(lockedDiceIndices),
        diceResults: diceResults,
        diceResultsIsArray: Array.isArray(diceResults),
        diceResultsLength: diceResults?.length
    });
    
    // Ensure arrays are properly initialized and validate incoming data
    ensureArraysInitialized();
    const validLockedDiceIndices = Array.isArray(lockedDiceIndices) ? lockedDiceIndices : [];
    
    console.log('🔒 [DISPLAY DEBUG] State before processing:', {
        validLockedDiceIndices: validLockedDiceIndices,
        currentPlayerLockedDiceStates: JSON.stringify(playerLockedDiceStates),
        windowPlayerLockedDiceStates: JSON.stringify(window.playerLockedDiceStates),
        playerLockedDiceValues: JSON.stringify(playerLockedDiceValues)
    });
    
    // Store the locked dice state for this player
    playerLockedDiceStates[playerId] = validLockedDiceIndices;
    window.playerLockedDiceStates = playerLockedDiceStates;
    
    // Store the dice values for locked dice
    if (diceResults && Array.isArray(diceResults)) {
        if (!playerLockedDiceValues[playerId]) {
            playerLockedDiceValues[playerId] = {};
        }
        validLockedDiceIndices.forEach(index => {
            if (diceResults[index]) {
                playerLockedDiceValues[playerId][index] = diceResults[index];
            }
        });
        window.playerLockedDiceValues = playerLockedDiceValues;
        console.log('🔒 [DISPLAY DEBUG] Stored dice values for player:', {
            playerId: playerId,
            storedValues: playerLockedDiceValues[playerId],
            validIndices: validLockedDiceIndices
        });
    }
    
    console.log('🔒 [DISPLAY DEBUG] State after storing:', {
        playerLockedDiceStates: JSON.stringify(playerLockedDiceStates),
        windowPlayerLockedDiceStates: JSON.stringify(window.playerLockedDiceStates),
        playerLockedDiceValues: JSON.stringify(playerLockedDiceValues)
    });
    
    // Only show locked indicators if the dice results are currently displayed for this player
    const diceResultsContainer = document.getElementById('dice-results-container');
    if (!diceResultsContainer) {
        console.log('🔒 [DISPLAY DEBUG] No dice results container found');
        return;
    }
    
    // Check if we're currently showing this player's results
    const header = diceResultsContainer.querySelector('div strong');
    console.log('🔒 [DISPLAY DEBUG] Checking if currently showing player results:', {
        headerExists: !!header,
        headerText: header?.textContent,
        targetPlayerId: playerId,
        headerIncludesPlayer: header?.textContent?.includes(playerId)
    });
    
    if (!header || !header.textContent.includes(playerId)) {
        console.log('🔒 [DISPLAY DEBUG] Not currently showing player results, storing state for future:', {
            playerId: playerId,
            headerText: header?.textContent,
            reason: !header ? 'No header found' : 'Header does not include player ID'
        });
        return;
    }
    
    console.log('🔒 [DISPLAY DEBUG] Currently showing player results, applying locked styling:', {
        playerId: playerId,
        headerText: header.textContent
    });
    
    // Find all dice images and update their locked indicators
    const diceImages = diceResultsContainer.querySelectorAll('img[alt*="' + playerId + '"]');
    console.log('🔒 [DISPLAY DEBUG] Found dice images for styling:', {
        playerId: playerId,
        diceImagesCount: diceImages.length,
        selector: 'img[alt*="' + playerId + '"]'
    });
    
    diceImages.forEach((diceImage, index) => {
        // Remove any existing locked indicators first
        diceImage.classList.remove('locked');
        
        const isLocked = safeIncludes(validLockedDiceIndices, index);
        const diceValue = diceResults?.[index];
        
        console.log('🔒 [DISPLAY DEBUG] Processing dice image:', {
            playerId: playerId,
            diceIndex: index,
            isLocked: isLocked,
            diceValue: diceValue,
            validLockedDiceIndices: validLockedDiceIndices
        });
        
        // Add locked indicator if this dice is locked
        if (isLocked) {
            diceImage.classList.add('locked');
            diceImage.title = `${playerId}'s dice ${index + 1} (value: ${diceValue}) - LOCKED`;
            console.log('🔒 [DISPLAY DEBUG] Applied locked styling to dice:', {
                playerId: playerId,
                diceIndex: index,
                diceValue: diceValue,
                title: diceImage.title
            });
        } else {
            diceImage.title = `${playerId}'s dice ${index + 1} (value: ${diceValue})`;
        }
    });
    
    console.log('🔒 [DISPLAY DEBUG] Completed locked dice display processing for:', {
        playerId: playerId,
        processedDiceCount: diceImages.length,
        finalPlayerStates: JSON.stringify(playerLockedDiceStates)
    });
}

// Make the function globally accessible
window.displayOtherPlayerLockedDice = displayOtherPlayerLockedDice;

// Function to show waiting message when not your turn
function showWaitingForTurnMessage() {
    const diceResultsContainer = document.getElementById('dice-results-container');
    if (!diceResultsContainer) return;
    
    // Clear the container and show waiting message
    diceResultsContainer.innerHTML = '';
    
    const waitingMessage = document.createElement('div');
    waitingMessage.className = 'w-100 text-center text-muted';
    waitingMessage.innerHTML = '<em>Waiting for other player to roll...</em>';
    diceResultsContainer.appendChild(waitingMessage);
    
    // Hide dice selection controls when waiting
    const diceSelectionControls = document.getElementById('dice-selection-controls');
    if (diceSelectionControls) {
        diceSelectionControls.style.display = 'none';
    }
    
    // Hide instruction text when waiting
    updateInstructionTextVisibility(false);
}

// Dice selection functions
function toggleDiceSelection(diceIndex, imageElement) {
    // Ensure arrays are initialized before use
    ensureArraysInitialized();
    
    // Prevent selection of locked dice or dice that are currently rolling
    if (safeIncludes(lockedDiceIndices, diceIndex) || isRolling) {
        return;
    }
    
    const isSelected = safeIncludes(selectedDiceIndices, diceIndex);
    
    if (isSelected) {
        // Deselect dice
        selectedDiceIndices = selectedDiceIndices.filter(index => index !== diceIndex);
        imageElement.classList.remove('selected');
    } else {
        // Select dice
        selectedDiceIndices.push(diceIndex);
        imageElement.classList.add('selected');
    }
    
    // Broadcast dice selection to other players in multiplayer mode
    if (isInMultiplayerRoom && typeof broadcastDiceSelection === 'function' && myPlayerId) {
        broadcastDiceSelection(myPlayerId, selectedDiceIndices, currentDiceResults);
    }
    
    updateSelectionControls();
}

function updateSelectionControls() {
    const lockButton = document.getElementById('lock-selected-dice');
    const clearButton = document.getElementById('clear-selection');
    
    const hasSelection = selectedDiceIndices.length > 0;
    
    // Update lock button
    if (lockButton) {
        if (!hasSelection) {
            lockButton.disabled = true;
            lockButton.textContent = 'Lock Selected Dice';
            lockButton.className = 'btn btn-secondary me-2'; // Grey out when disabled
        } else {
            // Calculate potential points for selected dice using comprehensive scoring
            const selectedDiceValues = selectedDiceIndices.map(index => currentDiceResults[index]);
            const scoreResult = calculateSelectedDiceScore(selectedDiceValues);
            
            // Check if selection is valid (all dice contribute to score)
            const canLockSelection = scoreResult.isValid;
            
            lockButton.disabled = !canLockSelection;
            
            if (canLockSelection) {
                lockButton.className = 'btn btn-success me-2'; // Green when valid
                lockButton.textContent = `Lock ${selectedDiceIndices.length} Dice (${scoreResult.points} pts)`;
            } else {
                lockButton.className = 'btn btn-danger me-2'; // Red when invalid
                
                if (scoreResult.points === 0) {
                    lockButton.textContent = `Lock ${selectedDiceIndices.length} Dice (No Points)`;
                } else {
                    lockButton.textContent = `Lock ${selectedDiceIndices.length} Dice (Some Don't Score)`;
                }
            }
        }
    }
    
    // Update clear button
    if (clearButton) {
        clearButton.disabled = !hasSelection;
        if (!hasSelection) {
            clearButton.className = 'btn btn-secondary me-2'; // Already grey, but ensure it's the disabled style
        } else {
            clearButton.className = 'btn btn-secondary me-2'; // Keep secondary style but enabled
        }
    }
}

function updateInstructionTextVisibility(showInstructions) {
    const instructionDiv = document.querySelector('#dice-selection-controls .mt-2');
    if (instructionDiv) {
        instructionDiv.style.display = showInstructions ? 'block' : 'none';
    }
}

function lockSelectedDice() {
    if (!canPlayerAct()) {
        // console.log('Cannot lock dice - not your turn!');
        return;
    }
    
    if (selectedDiceIndices.length === 0) {
        showGameAlert('⚠️ Please select at least one dice to lock', 'warning');
        return;
    }
    
    // Calculate points for selected dice using comprehensive scoring
    const selectedDiceValues = selectedDiceIndices.map(index => currentDiceResults[index]);
    const scoreResult = calculateSelectedDiceScore(selectedDiceValues);
    
    // Prevent locking dice unless ALL selected dice contribute to the score
    if (!scoreResult.isValid) {
        if (scoreResult.points === 0) {
            showGameAlert(`❌ You can only lock dice that score points<br><small>Selected dice: ${scoreResult.description || 'No scoring combination'}</small>`, 'danger');
        } else {
            showGameAlert(`❌ All selected dice must contribute to the score<br><small>Some of your selected dice don't score points</small>`, 'danger');
        }
        return;
    }
    
    // Add points to pending score
    if (typeof addPendingPoints === 'function') {
        addPendingPoints(scoreResult.points, scoreResult.description);
    }
    // console.log(`Locked dice scored ${scoreResult.points} points: ${scoreResult.description}`);
    
    // Add selected dice to locked dice
    lockedDiceIndices.push(...selectedDiceIndices);
    
    // Move locked dice out of the 3D playing area
    selectedDiceIndices.forEach(index => {
        const body = diceBodies[index];
        const dice = diceModels[index];
        
        // Stop physics movement
        body.velocity.set(0, 0, 0);
        body.angularVelocity.set(0, 0, 0);
        
        // Move to a position far away from the play area
        body.position.set(1000 + index, 1000, 1000);
        dice.visible = false;
    });
    
    // Update available dice count
    availableDiceCount = 6 - lockedDiceIndices.length;
    
    // Clear selection
    selectedDiceIndices = [];
    
    // Re-enable roll button after locking dice
    const rollButton = document.getElementById('roll-dice');
    if (rollButton && hasRolledThisTurn) {
        rollButton.disabled = false;
        hasRolledThisTurn = false; // Reset the flag
        // console.log('🎲 Roll button re-enabled after locking dice - hasRolledThisTurn = false');
    }
    
    // Broadcast locked dice state to other players in multiplayer mode
    if (isInMultiplayerRoom && typeof broadcastLockedDice === 'function' && myPlayerId) {
        // console.log('🔒 Broadcasting locked dice:', myPlayerId, lockedDiceIndices, currentDiceResults);
        broadcastLockedDice(myPlayerId, lockedDiceIndices, currentDiceResults);
        // Also store the state locally for consistency
        playerLockedDiceStates[myPlayerId] = lockedDiceIndices;
    } else {
        // console.log('🔒 Not broadcasting locked dice - conditions not met:', {
        //     isInMultiplayerRoom,
        //     hasBroadcastFunction: typeof broadcastLockedDice === 'function',
        //     myPlayerId
        // });
    }
    
    // Re-display results without locked dice
    displayDiceResults(currentDiceResults);
    
    // Update UI to reflect locked state
    updateGameState();
    updateGameControlsState();
    
    // console.log(`Locked dice at indices: ${lockedDiceIndices}, Remaining dice: ${availableDiceCount}`);
}

function clearDiceSelection() {
    if (!canPlayerAct()) {
        // console.log('Cannot clear selection - not your turn!');
        return;
    }
    
    selectedDiceIndices = [];
    // Re-display to clear visual selection
    displayDiceResults(currentDiceResults);
    updateSelectionControls();
}

// Note: clearAllDiceLockedStyling is already defined globally at the top of the file
// Removed duplicate const declaration to prevent shadowing

// Reset all dice for a new turn (both visual and physical)
// This function has been removed - resetLockedDice() now handles all reset functionality

// End turn function
function endPlayerTurn() {
    if (!canPlayerAct()) {
        return;
    }
    
    // Save current player's material preferences
    // if (isInMultiplayerRoom && myPlayerId) {
    //     savePlayerMaterialPreferences(myPlayerId, currentDiceMaterial, currentFloorMaterial);
    // }
    
    // Reset dice state for next player - use reset locked dice function
    console.log('Ending turn, resetting locked dice and clearing selections');
    resetLockedDice();
    
    // Update game state to ensure Firebase synchronization (same as admin button)
    updateGameState();
    
    // Clear any pending points for the next player
    if (typeof clearPendingPoints === 'function') {
        clearPendingPoints();
    }
    
    // Clear dice display
    diceResultsContainer.innerHTML = '<p class="text-muted">Waiting for next player...</p>';
    
    // Hide dice selection controls when no dice are displayed
    const diceSelectionControls = document.getElementById('dice-selection-controls');
    if (diceSelectionControls) {
        diceSelectionControls.style.display = 'none';
    }
    
    // Hide instruction text when no dice are displayed
    updateInstructionTextVisibility(false);
    
    // Update selection controls to reflect reset state
    updateSelectionControls();
    
    // Advance to next turn
    const nextPlayer = nextTurn();
    updateGameControlsState();
    
    // console.log(`Turn ended. Next player: ${nextPlayer}`);
    
    // Broadcast turn change to other players if in multiplayer
    if (isInMultiplayerRoom) {
        if (typeof broadcastTurnChange === 'function') {
            broadcastTurnChange(nextPlayer);
        } else {
            // console.warn('broadcastTurnChange function not available');
        }
    }
}

// Integration with multiplayer system
function initializeMultiplayerMode(roomId, playerId, playerList) {
    myPlayerId = playerId;
    window.myPlayerId = playerId; // Keep window variable in sync
    isInMultiplayerRoom = true;
    
    // Initialize turn system with all players - preserve current turn and pending points
    initializeTurnSystem(playerList, true, true);
    
    // Load this player's material preferences
    const preferences = getPlayerMaterialPreferences(myPlayerId);
    if (preferences.dice !== 'default' || preferences.floor !== 'grass' || preferences.background !== 'white') {
        changeDiceMaterial(preferences.dice);
        changeFloorMaterial(preferences.floor);
        changeBackgroundMaterial(preferences.background || 'white');
    }
    
    updateGameControlsState();
    
    // console.log(`Multiplayer mode initialized for room ${roomId}, player: ${myPlayerId}`);
    // console.log(`Players in room: ${playerList.join(', ')}`);
}

function exitMultiplayerMode() {
    isInMultiplayerRoom = false;
    myPlayerId = 'Player1';
    window.myPlayerId = 'Player1'; // Keep window variable in sync
    
    // Reset to single player mode
    initializeTurnSystem([myPlayerId], false);
    updateGameControlsState();
    
    // console.log('Exited multiplayer mode, returned to single player');
}

function resetLockedDice() {
    // Restore locked dice to the 3D playing area
    lockedDiceIndices.forEach(index => {
        const body = diceBodies[index];
        const dice = diceModels[index];
        
        // Reset position within the box dimensions, accounting for dice size
        const safeArea = wallLength - wallThickness - 1.0; // Account for dice size
        body.position.set(
            (Math.random() - 0.5) * safeArea,
            1.0,
            (Math.random() - 0.5) * safeArea
        );
        
        // Reset rotation
        body.quaternion.setFromEuler(
            Math.random() * Math.PI * 2,
            Math.random() * Math.PI * 2,
            Math.random() * Math.PI * 2
        );
        
        // Make dice visible again
        dice.visible = true;
    });
    
    lockedDiceIndices = [];
    selectedDiceIndices = [];
    availableDiceCount = 6;
    hasRolledThisTurn = false; // Reset roll state for new turn
    // console.log('🎲 resetLockedDice() - hasRolledThisTurn = false');
    
    // Broadcast that all dice are now unlocked to other players in multiplayer mode
    if (isInMultiplayerRoom && typeof broadcastLockedDice === 'function' && myPlayerId) {
        broadcastLockedDice(myPlayerId, [], []); // Empty arrays indicate no locked dice
        // Also clear the stored state for this player
        playerLockedDiceStates[myPlayerId] = [];
    }
    
    // Reset roll button
    const rollButton = document.getElementById('roll-dice');
    if (rollButton) {
        rollButton.textContent = 'Roll';
        rollButton.disabled = false; // Enable for new turn
    }
    
    // Update selection controls to reflect empty selection
    updateSelectionControls();
    
    // Clear dice results display
    if (diceResultsContainer) {
        diceResultsContainer.innerHTML = '';
        // Hide instruction text when dice display is cleared
        updateInstructionTextVisibility(false);
    }
    
    // Hide selection controls
    const selectionControls = document.getElementById('dice-selection-controls');
    if (selectionControls) {
        selectionControls.style.display = 'none';
    }
}

function updateGameState() {
    // Update roll button text to show remaining dice
    const rollButton = document.getElementById('roll-dice');
    if (rollButton) {
        if (availableDiceCount > 0) {
            rollButton.textContent = 'Roll';
            rollButton.disabled = false;
        } else {
            // Hot dice scenario - all 6 dice are locked!
            // console.log('🔥 HOT DICE! All 6 dice are locked - resetting and allowing player to continue');
            
            // Show hot dice message
            showHotDiceMessage();
            
            // Reset all locked dice after a brief delay to let the message show
            setTimeout(() => {
                resetLockedDice();
                
                // Keep the roll button enabled so player can continue
                if (rollButton) {
                    rollButton.textContent = 'Roll';
                    rollButton.disabled = false;
                }
            }, 100); // Small delay to ensure UI updates properly
        }
    }
}

// Function to show hot dice message
function showHotDiceMessage() {
    const hotDiceMessage = document.getElementById('hot-dice-message');
    if (hotDiceMessage) {
        const playerName = myPlayerId || window.myPlayerId || 'Player';
        hotDiceMessage.innerHTML = `🔥 ${playerName} has hot dice! 🔥<br><small>All 6 dice scored - roll again!</small>`;
        hotDiceMessage.style.display = 'block';
        
        // Hide the message after 3 seconds
        setTimeout(() => {
            hotDiceMessage.style.display = 'none';
        }, 3000);
        
        // Broadcast hot dice event to other players in multiplayer mode
        if (isInMultiplayerRoom && typeof broadcastHotDice === 'function' && myPlayerId) {
            // console.log('🔥 Calling broadcastHotDice for:', myPlayerId);
            broadcastHotDice(myPlayerId);
        } else {
            // console.log('🔥 Not broadcasting hot dice:', {
            //     isInMultiplayerRoom,
            //     broadcastHotDiceExists: typeof broadcastHotDice === 'function',
            //     myPlayerId
            // });
        }
        
        // console.log(`🔥 Hot dice message displayed for ${playerName}`);
    }
}

// Function to show hot dice message for spectators
function showSpectatorHotDiceMessage(playerId) {
    // console.log('🔥 showSpectatorHotDiceMessage called for:', playerId);
    const hotDiceMessage = document.getElementById('hot-dice-message');
    // console.log('🔥 hotDiceMessage element:', hotDiceMessage);
    
    if (hotDiceMessage) {
        const playerName = playerId || 'Player';
        hotDiceMessage.innerHTML = `🔥 ${playerName} has hot dice! 🔥<br><small>All 6 dice scored - rolling again!</small>`;
        hotDiceMessage.style.display = 'block';
        
        // console.log('🔥 Spectator hot dice message displayed:', hotDiceMessage.innerHTML);
        
        // Hide the message after 3 seconds
        setTimeout(() => {
            hotDiceMessage.style.display = 'none';
            // console.log('🔥 Spectator hot dice message hidden');
        }, 3000);
        
        // console.log(`🔥 Spectator hot dice message displayed for ${playerName}`);
    } else {
        console.error('🔥 ERROR: hot-dice-message element not found for spectator!');
    }
}

// Function to show general game alerts
function showGameAlert(message, type = 'warning', duration = 3000) {
    const gameAlert = document.getElementById('game-alert');
    if (gameAlert) {
        // Remove existing alert type classes
        gameAlert.className = 'alert fw-bold text-center';
        // Add the new alert type class
        gameAlert.classList.add(`alert-${type}`);
        
        gameAlert.innerHTML = message;
        gameAlert.style.display = 'block';
        
        // Only hide the message after specified duration if duration > 0
        // Duration of 0 means the alert should stay visible (persistent)
        if (duration > 0) {
            setTimeout(() => {
                gameAlert.style.display = 'none';
            }, duration);
        }
    }
}

// Function to handle farkle turn ending
function handleFarkleEndTurn() {
    // console.log('🎲 Handling farkle turn end');
    
    // Restore button states for next player
    const rollButton = document.getElementById('roll-dice');
    const bankButton = document.getElementById('bank-points');
    
    if (rollButton) {
        rollButton.style.display = 'inline-block';
        rollButton.disabled = false;
        rollButton.textContent = 'Roll';
        hasRolledThisTurn = false; // Reset roll state
        // console.log('🎲 Roll button restored after farkle - hasRolledThisTurn = false');
    }
    
    if (bankButton) {
        bankButton.disabled = false;
        // Bank button visibility will be handled by updateGameControlsState()
        // console.log('🎲 Bank button enabled');
    }
    
    // Reset all dice for the next player
    resetLockedDice();
    
    // End the turn properly through Firebase state management if available
    if (isInMultiplayerRoom && typeof endMyTurn === 'function') {
        // console.log('🎲 Farkle - ending turn through Firebase state manager');
        endMyTurn();
        // Update game controls immediately after ending turn
        setTimeout(() => {
            updateGameControlsState();
        }, 100);
    } else if (typeof nextTurn === 'function') {
        // Fallback to local turn management
        const nextPlayer = nextTurn();
        // console.log('🎲 Farkle - turn passing to:', nextPlayer);
        updateGameControlsState();
        
        // Broadcast turn change in multiplayer
        if (isInMultiplayerRoom && typeof broadcastTurnChange === 'function') {
            broadcastTurnChange(nextPlayer);
        }
    }
}

// Function to show farkle message
function showFarkleMessage() {
    // console.log('🎲 showFarkleMessage() called');
    const farkleMessage = document.getElementById('farkle-message');
    // console.log('🎲 farkleMessage element:', farkleMessage);
    
    if (farkleMessage) {
        farkleMessage.innerHTML = `🎲 FARKLE! 💥<br><small>No scoring dice - all pending points lost!</small><br><button id="farkle-end-turn" class="btn btn-danger btn-sm mt-2">End Turn Now</button>`;
        farkleMessage.style.display = 'block';
        
        // console.log('🎲 Farkle message displayed, innerHTML:', farkleMessage.innerHTML);
        // console.log('🎲 Farkle message display style:', farkleMessage.style.display);
        
        // Hide roll button and disable bank button immediately
        const rollButton = document.getElementById('roll-dice');
        const bankButton = document.getElementById('bank-points');
        
        if (rollButton) {
            rollButton.style.display = 'none';
            // console.log('🎲 Roll button hidden');
        }
        
        if (bankButton) {
            bankButton.disabled = true;
            bankButton.style.display = 'none';
            // console.log('🎲 Bank button disabled and hidden');
        }
        
        // Broadcast farkle alert to other players in multiplayer mode
        if (isInMultiplayerRoom && typeof broadcastFarkleAlert === 'function' && myPlayerId) {
            // console.log('💥 Calling broadcastFarkleAlert for:', myPlayerId);
            broadcastFarkleAlert(myPlayerId);
        } else {
            // console.log('💥 Not broadcasting farkle alert:', {
            //     isInMultiplayerRoom,
            //     broadcastFarkleAlertExists: typeof broadcastFarkleAlert === 'function',
            //     myPlayerId
            // });
        }
        
        // Add event listener to the end turn button
        const endTurnButton = document.getElementById('farkle-end-turn');
        // console.log('🎲 End turn button:', endTurnButton);
        if (endTurnButton) {
            endTurnButton.addEventListener('click', () => {
                // console.log('🎲 User clicked End Turn Now button');
                // Clear any existing timeout
                const timeoutId = farkleMessage.dataset.hideTimeout;
                if (timeoutId) {
                    clearTimeout(parseInt(timeoutId));
                }
                // Hide the farkle message immediately
                farkleMessage.style.display = 'none';
                // End the player's turn
                handleFarkleEndTurn();
            });
        }
        
        // Hide the message after 5 seconds if user doesn't click the button
        const hideTimeout = setTimeout(() => {
            if (farkleMessage.style.display !== 'none') {
                // console.log('🎲 Farkle message timeout - auto-ending turn');
                farkleMessage.style.display = 'none';
                // Automatically end turn after timeout
                handleFarkleEndTurn();
            }
        }, 5000);
        
        // Store the timeout ID so we can clear it if the button is clicked
        farkleMessage.dataset.hideTimeout = hideTimeout.toString();
    } else {
        console.error('🎲 ERROR: farkle-message element not found!');
    }
}

// Function to show farkle message for spectators
function showSpectatorFarkleMessage(playerId) {
    // console.log('💥 showSpectatorFarkleMessage() called for:', playerId);
    const farkleMessage = document.getElementById('farkle-message');
    // console.log('💥 farkleMessage element:', farkleMessage);
    
    if (farkleMessage) {
        const playerName = playerId || 'Player';
        farkleMessage.innerHTML = `💥 ${playerName} FARKLED! 💥<br><small>No scoring dice - turn ended!</small>`;
        farkleMessage.style.display = 'block';
        
        // console.log('💥 Spectator farkle message displayed:', farkleMessage.innerHTML);
        
        // Hide the message after 3 seconds for spectators
        setTimeout(() => {
            farkleMessage.style.display = 'none';
            // console.log('💥 Spectator farkle message hidden');
        }, 3000);
        
        // console.log(`💥 Spectator farkle message displayed for ${playerName}`);
    } else {
        console.error('💥 ERROR: farkle-message element not found for spectator!');
    }
}

// Load textures for dice faces
const diceTextures = [
    new THREE.TextureLoader().load('assets/dice1.png'),
    new THREE.TextureLoader().load('assets/dice2.png'),
    new THREE.TextureLoader().load('assets/dice3.png'),
    new THREE.TextureLoader().load('assets/dice4.png'),
    new THREE.TextureLoader().load('assets/dice5.png'),
    new THREE.TextureLoader().load('assets/dice6.png')
];
// Source: https://game-icons.net/1x1/delapouite/dice-six-faces-five.html#download

// Create materials for each face of the dice
const diceMaterials = diceTextures.map(texture => new THREE.MeshLambertMaterial({ map: texture }));

// Material creation functions
function createDiceMaterial(materialType) {
    const baseMaterials = diceTextures.map(texture => new THREE.MeshLambertMaterial({ map: texture }));
    const config = getDiceMaterialProperties(materialType);
    
    return baseMaterials.map(mat => {
        const material = mat.clone();
        material.color.setHex(config.color);
        if (config.shininess !== undefined) {
            material.shininess = config.shininess;
        }
        if (config.transparent) {
            material.transparent = config.transparent;
            material.opacity = config.opacity;
        }
        return material;
    });
}

function createFloorMaterial(materialType) {
    const config = getFloorMaterialProperties(materialType);
    const material = new THREE.MeshLambertMaterial({ 
        color: config.color, 
        side: THREE.DoubleSide 
    });
    
    // Apply roughness if supported
    if (config.roughness !== undefined) {
        material.roughness = config.roughness;
    }
    
    return material;
}

// Function to create physics material for dice based on material type
function createDicePhysicsMaterial(materialType) {
    const config = getDiceMaterialProperties(materialType);
    const physicsMaterial = new CANNON.Material('diceMaterial_' + materialType);
    
    physicsMaterial.restitution = config.restitution;
    physicsMaterial.friction = config.friction;
    
    return physicsMaterial;
}

// Function to create physics material for floor based on material type
function createFloorPhysicsMaterial(materialType) {
    const config = getFloorMaterialProperties(materialType);
    const physicsMaterial = new CANNON.Material('floorMaterial_' + materialType);
    
    physicsMaterial.restitution = config.restitution;
    physicsMaterial.friction = config.friction;
    
    return physicsMaterial;
}

// Scale down dice geometry by 35%
const diceScale = 0.65;
const diceGeometry = new THREE.BoxGeometry(diceScale, diceScale, diceScale);

for (let i = 0; i < 6; i++) {
    // Create a separate material array for each dice using the current material
    const diceMatArray = createDiceMaterial(currentDiceMaterial);
    const dice = new THREE.Mesh(diceGeometry, diceMatArray);
    dice.position.set(i - 2.5, 2, 0); // Spread dice horizontally and lift them up
    dice.castShadow = true;
    dice.receiveShadow = true;
    scene.add(dice);
    diceModels.push(dice);
}

// Update 3D dice positions and rotations based on results
function updateDice3D(results) {
    results.forEach((result, index) => {
        const dice = diceModels[index];
        dice.rotation.x = Math.random() * Math.PI * 2; // Randomize rotation
        dice.rotation.y = Math.random() * Math.PI * 2;
        dice.rotation.z = Math.random() * Math.PI * 2;
        dice.position.y = result * 0.2; // Adjust height based on result
    });
}

// Import Cannon.js for physics simulation
const world = new CANNON.World();
world.gravity.set(0, -29.82, 0); // Set gravity

// Set restitution (bounciness) for dice and walls
let diceMaterial = createDicePhysicsMaterial(currentDiceMaterial);
let currentFloorPhysicsMaterial = createFloorPhysicsMaterial(currentFloorMaterial);

// Rename Cannon.js wall material to avoid conflicts
const cannonWallMaterial = new CANNON.Material('wallMaterial');
cannonWallMaterial.restitution = MaterialConfig.wallMaterial.restitution;
cannonWallMaterial.friction = MaterialConfig.wallMaterial.friction;

// Create contact material to handle interactions between dice and walls
let diceWallContactMaterial = new CANNON.ContactMaterial(diceMaterial, cannonWallMaterial, {
    restitution: (diceMaterial.restitution + cannonWallMaterial.restitution) / 2,
    friction: (diceMaterial.friction + cannonWallMaterial.friction) / 2
});
world.addContactMaterial(diceWallContactMaterial);

// Create contact material for dice-floor interactions
let diceFloorContactMaterial = new CANNON.ContactMaterial(diceMaterial, currentFloorPhysicsMaterial, {
    restitution: (diceMaterial.restitution + currentFloorPhysicsMaterial.restitution) / 2,
    friction: (diceMaterial.friction + currentFloorPhysicsMaterial.friction) / 2
});
world.addContactMaterial(diceFloorContactMaterial);

// Store references to contact materials for later updates
let contactMaterials = {
    diceWall: diceWallContactMaterial,
    diceFloor: diceFloorContactMaterial
};

// Create a ground plane
const groundBody = new CANNON.Body({ mass: 0, material: currentFloorPhysicsMaterial });
const groundShape = new CANNON.Plane();
groundBody.addShape(groundShape);
groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
world.addBody(groundBody);

// Define wall dimensions once
const wallThickness = 1.0; // Increased thickness for better collision
const wallHeight = 5; // Updated height for taller walls
const wallLength = 16; // Increased from 10 to 16 for larger play area

// Create dice physics bodies and shapes
const diceBodies = [];
const diceShapes = new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5));

for (let i = 0; i < 6; i++) {
    const diceBody = new CANNON.Body({ mass: 1 });
    diceBody.addShape(diceShapes);
    diceBody.material = diceMaterial;

    // Apply material-specific properties
    const config = getDiceMaterialProperties(currentDiceMaterial);
    diceBody.linearDamping = config.linearDamping;
    diceBody.angularDamping = config.angularDamping;
    
    // Adjust mass based on density
    diceBody.mass = config.density;
    diceBody.updateMassProperties();

    // Randomize position within the box dimensions, accounting for dice size
    // Dice are 1x1x1 units, so we need to keep them at least 0.5 units from walls
    const safeArea = wallLength - wallThickness - 1.0; // Account for dice size
    diceBody.position.set(
        (Math.random() - 0.5) * safeArea, // X position within the safe area
        1.0,                              // Y position well above the floor
        (Math.random() - 0.5) * safeArea  // Z position within the safe area
    );

    // Randomize rotation
    diceBody.quaternion.setFromEuler(
        Math.random() * Math.PI * 2, // Random X rotation
        Math.random() * Math.PI * 2, // Random Y rotation
        Math.random() * Math.PI * 2  // Random Z rotation
    );

    diceBody.angularVelocity.set(Math.random(), Math.random(), Math.random()); // Random spin
    world.addBody(diceBody);
    diceBodies.push(diceBody);
}

// Create a visible floor for the dice area
const floorGeometry = new THREE.PlaneGeometry(wallLength, wallLength);
let floorMaterial = createFloorMaterial(currentFloorMaterial);
const floor = new THREE.Mesh(floorGeometry, floorMaterial);
floor.rotation.x = -Math.PI / 2; // Rotate to lie flat
floor.receiveShadow = true;
scene.add(floor);

// Create visible walls for the dice area
const wallMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 }); // Brown walls

// Store wall references for material updates
const walls = [];

// Radius for corner curves
const cornerRadius = 0.3;

// Correct wall creation logic to avoid extra walls
const wallGeometries = [
    new THREE.BoxGeometry(wallLength, wallHeight, wallThickness), // Back wall
    new THREE.BoxGeometry(wallThickness, wallHeight, wallLength), // Left wall
    new THREE.BoxGeometry(wallThickness, wallHeight, wallLength)  // Right wall
];

const wallPositions = [
    { x: 0, y: wallHeight / 2, z: -wallLength / 2 }, // Back wall
    { x: -wallLength / 2, y: wallHeight / 2, z: 0 }, // Left wall
    { x: wallLength / 2, y: wallHeight / 2, z: 0 }   // Right wall
];

wallGeometries.forEach((geometry, index) => {
    const wall = new THREE.Mesh(geometry, wallMaterial);
    wall.position.set(wallPositions[index].x, wallPositions[index].y, wallPositions[index].z);
    scene.add(wall);
    walls.push(wall); // Store reference for later updates
});

// Create curved corners between walls and floor
// Corner curves along the bottom edges of walls
const cornerGeometry = new THREE.CylinderGeometry(cornerRadius, cornerRadius, wallLength, 16);

// Back wall bottom corner
const backCorner = new THREE.Mesh(cornerGeometry, wallMaterial);
backCorner.rotation.z = Math.PI / 2; // Rotate to lie along the floor edge
backCorner.position.set(0, cornerRadius, -wallLength / 2 + wallThickness / 2);
backCorner.visible = false; // Make invisible
scene.add(backCorner);

// Left wall bottom corner
const leftCorner = new THREE.Mesh(cornerGeometry, wallMaterial);
leftCorner.rotation.x = Math.PI / 2; // Rotate to lie along the floor edge
leftCorner.position.set(-wallLength / 2 + wallThickness / 2, cornerRadius, 0);
leftCorner.visible = false; // Make invisible
scene.add(leftCorner);

// Right wall bottom corner
const rightCorner = new THREE.Mesh(cornerGeometry, wallMaterial);
rightCorner.rotation.x = Math.PI / 2; // Rotate to lie along the floor edge
rightCorner.position.set(wallLength / 2 - wallThickness / 2, cornerRadius, 0);
rightCorner.visible = false; // Make invisible
scene.add(rightCorner);

// Create small cylindrical corners where walls meet each other
const verticalCornerGeometry = new THREE.CylinderGeometry(cornerRadius, cornerRadius, wallHeight, 16);

// Back-left vertical corner
const backLeftCorner = new THREE.Mesh(verticalCornerGeometry, wallMaterial);
backLeftCorner.position.set(-wallLength / 2 + wallThickness / 2, wallHeight / 2, -wallLength / 2 + wallThickness / 2);
backLeftCorner.visible = false; // Make invisible
scene.add(backLeftCorner);

// Back-right vertical corner
const backRightCorner = new THREE.Mesh(verticalCornerGeometry, wallMaterial);
backRightCorner.position.set(wallLength / 2 - wallThickness / 2, wallHeight / 2, -wallLength / 2 + wallThickness / 2);
backRightCorner.visible = false; // Make invisible
scene.add(backRightCorner);

// Update Cannon.js walls to match the corrected area
// Back wall
const backWallBody = new CANNON.Body({ mass: 0, material: cannonWallMaterial });
const backWallShape = new CANNON.Box(new CANNON.Vec3(wallLength / 2, wallHeight / 2, wallThickness / 2));
backWallBody.addShape(backWallShape);
backWallBody.position.set(0, wallHeight / 2, -wallLength / 2);
world.addBody(backWallBody);

// Left wall
const leftWallBody = new CANNON.Body({ mass: 0, material: cannonWallMaterial });
const leftWallShape = new CANNON.Box(new CANNON.Vec3(wallThickness / 2, wallHeight / 2, wallLength / 2));
leftWallBody.addShape(leftWallShape);
leftWallBody.position.set(-wallLength / 2, wallHeight / 2, 0);
world.addBody(leftWallBody);

// Right wall
const rightWallBody = new CANNON.Body({ mass: 0, material: cannonWallMaterial });
const rightWallShape = new CANNON.Box(new CANNON.Vec3(wallThickness / 2, wallHeight / 2, wallLength / 2));
rightWallBody.addShape(rightWallShape);
rightWallBody.position.set(wallLength / 2, wallHeight / 2, 0);
world.addBody(rightWallBody);

// Add physics bodies for curved corners
// Bottom corner curves (cylindrical collision shapes)
const cornerShape = new CANNON.Cylinder(cornerRadius, cornerRadius, wallLength, 16);

// Back wall bottom corner physics
const backCornerBody = new CANNON.Body({ mass: 0, material: cannonWallMaterial });
backCornerBody.addShape(cornerShape);
backCornerBody.position.set(0, cornerRadius, -wallLength / 2 + wallThickness / 2);
// Rotate to match visual orientation
const quaternion1 = new CANNON.Quaternion();
quaternion1.setFromEuler(0, 0, Math.PI / 2);
backCornerBody.quaternion = quaternion1;
world.addBody(backCornerBody);

// Left wall bottom corner physics
const leftCornerBody = new CANNON.Body({ mass: 0, material: cannonWallMaterial });
leftCornerBody.addShape(cornerShape);
leftCornerBody.position.set(-wallLength / 2 + wallThickness / 2, cornerRadius, 0);
// Rotate to match visual orientation
const quaternion2 = new CANNON.Quaternion();
quaternion2.setFromEuler(Math.PI / 2, 0, 0);
leftCornerBody.quaternion = quaternion2;
world.addBody(leftCornerBody);

// Right wall bottom corner physics
const rightCornerBody = new CANNON.Body({ mass: 0, material: cannonWallMaterial });
rightCornerBody.addShape(cornerShape);
rightCornerBody.position.set(wallLength / 2 - wallThickness / 2, cornerRadius, 0);
// Rotate to match visual orientation
const quaternion3 = new CANNON.Quaternion();
quaternion3.setFromEuler(Math.PI / 2, 0, 0);
rightCornerBody.quaternion = quaternion3;
world.addBody(rightCornerBody);

// Vertical corner physics bodies
const verticalCornerShape = new CANNON.Cylinder(cornerRadius, cornerRadius, wallHeight, 16);

// Back-left vertical corner physics
const backLeftCornerBody = new CANNON.Body({ mass: 0, material: cannonWallMaterial });
backLeftCornerBody.addShape(verticalCornerShape);
backLeftCornerBody.position.set(-wallLength / 2 + wallThickness / 2, wallHeight / 2, -wallLength / 2 + wallThickness / 2);
world.addBody(backLeftCornerBody);

// Back-right vertical corner physics
const backRightCornerBody = new CANNON.Body({ mass: 0, material: cannonWallMaterial });
backRightCornerBody.addShape(verticalCornerShape);
backRightCornerBody.position.set(wallLength / 2 - wallThickness / 2, wallHeight / 2, -wallLength / 2 + wallThickness / 2);
world.addBody(backRightCornerBody);

// Add the camera-side wall back with a transparent material
const transparentWallMaterial = new THREE.MeshBasicMaterial({ color: 0x8B4513, transparent: true, opacity: 0 }); // Semi-transparent brown

const frontWallGeometry = new THREE.BoxGeometry(wallLength, wallHeight, wallThickness);
const frontWall = new THREE.Mesh(frontWallGeometry, transparentWallMaterial);
frontWall.position.set(0, wallHeight / 2, wallLength / 2); // Position for the front wall
scene.add(frontWall);
walls.push(frontWall); // Store reference for later updates

// Add curved corner for the front wall bottom edge
const frontCorner = new THREE.Mesh(cornerGeometry, wallMaterial);
frontCorner.rotation.z = Math.PI / 2; // Rotate to lie along the floor edge
frontCorner.position.set(0, cornerRadius, wallLength / 2 - wallThickness / 2);
frontCorner.visible = false; // Make invisible
scene.add(frontCorner);

// Add vertical corners for the front wall
const frontLeftCorner = new THREE.Mesh(verticalCornerGeometry, wallMaterial);
frontLeftCorner.position.set(-wallLength / 2 + wallThickness / 2, wallHeight / 2, wallLength / 2 - wallThickness / 2);
frontLeftCorner.visible = false; // Make invisible
scene.add(frontLeftCorner);

const frontRightCorner = new THREE.Mesh(verticalCornerGeometry, wallMaterial);
frontRightCorner.position.set(wallLength / 2 - wallThickness / 2, wallHeight / 2, wallLength / 2 - wallThickness / 2);
frontRightCorner.visible = false; // Make invisible
scene.add(frontRightCorner);

// Add the front wall to Cannon.js physics
const frontWallBody = new CANNON.Body({ mass: 0, material: cannonWallMaterial });
const frontWallShape = new CANNON.Box(new CANNON.Vec3(wallLength / 2, wallHeight / 2, wallThickness / 2));
frontWallBody.addShape(frontWallShape);
frontWallBody.position.set(0, wallHeight / 2, wallLength / 2);
world.addBody(frontWallBody);

// Add physics for front wall corners
// Front wall bottom corner physics
const frontCornerBody = new CANNON.Body({ mass: 0, material: cannonWallMaterial });
frontCornerBody.addShape(cornerShape);
frontCornerBody.position.set(0, cornerRadius, wallLength / 2 - wallThickness / 2);
// Rotate to match visual orientation
const quaternion4 = new CANNON.Quaternion();
quaternion4.setFromEuler(0, 0, Math.PI / 2);
frontCornerBody.quaternion = quaternion4;
world.addBody(frontCornerBody);

// Front-left vertical corner physics
const frontLeftCornerBody = new CANNON.Body({ mass: 0, material: cannonWallMaterial });
frontLeftCornerBody.addShape(verticalCornerShape);
frontLeftCornerBody.position.set(-wallLength / 2 + wallThickness / 2, wallHeight / 2, wallLength / 2 - wallThickness / 2);
world.addBody(frontLeftCornerBody);

// Front-right vertical corner physics
const frontRightCornerBody = new CANNON.Body({ mass: 0, material: cannonWallMaterial });
frontRightCornerBody.addShape(verticalCornerShape);
frontRightCornerBody.position.set(wallLength / 2 - wallThickness / 2, wallHeight / 2, wallLength / 2 - wallThickness / 2);
world.addBody(frontRightCornerBody);

// Camera system now uses fixed positioning - camera control sliders removed

// Map dice face-up results to dice values
function getDiceResult(quaternion) {
    const upVector = new THREE.Vector3(0, 1, 0);
    
    // Three.js BoxGeometry face order: [+X, -X, +Y, -Y, +Z, -Z]
    // We need to map these to dice faces 1-6 based on material array order
    const directions = [
        new THREE.Vector3(1, 0, 0),   // +X face (right) - dice face 1
        new THREE.Vector3(-1, 0, 0),  // -X face (left) - dice face 2  
        new THREE.Vector3(0, 1, 0),   // +Y face (top) - dice face 3
        new THREE.Vector3(0, -1, 0),  // -Y face (bottom) - dice face 4
        new THREE.Vector3(0, 0, 1),   // +Z face (front) - dice face 5
        new THREE.Vector3(0, 0, -1)   // -Z face (back) - dice face 6
    ];

    let maxDot = -Infinity;
    let result = 1;
    let debugInfo = [];

    directions.forEach((direction, index) => {
        const worldDirection = direction.clone().applyQuaternion(quaternion);
        const dot = worldDirection.dot(upVector);
        debugInfo.push(`Face ${index + 1}: ${dot.toFixed(3)}`);
        if (dot > maxDot) {
            maxDot = dot;
            result = index + 1; // Material index corresponds to dice face value
        }
    });

    // Uncomment this line to debug face detection
    // console.log(`Dice result: ${result}, Face dots: ${debugInfo.join(', ')}`);

    return result;
}

// Dice settlement detection variables
let isRolling = false;
let lastDicePositions = [];
let settlementCheckInterval = null;
let rollingAnimationInterval = null;
let otherPlayerAnimationInterval = null;
let settlementStartTime = null;
let isSettled = false;
let hasRolledThisTurn = false; // Track if player has rolled without locking dice
const SETTLEMENT_DELAY = 50; // 0.05 seconds - much faster settlement for quick gameplay

// Dice rolling animation variables
let rollingAnimationFrame = 0;
const ROLLING_ANIMATION_SPEED = 150; // milliseconds between frame changes

// Track other players' rolling states
let otherPlayersRolling = new Set();

// Make animation tracking variables globally accessible
window.otherPlayersRolling = otherPlayersRolling;
window.otherPlayerAnimationInterval = null; // Initialize as null

// Function to check if dice have settled
function checkDiceSettlement() {
    let hasSettled = true;
    const settlementThreshold = 0.15; // Balanced threshold for good settling detection
    const velocityThreshold = 0.15; // Balanced threshold for good settling detection
    
    diceBodies.forEach((body, index) => {
        if (safeIncludes(lockedDiceIndices, index)) return; // Skip locked dice
        
        const angularSpeed = body.angularVelocity.length();
        const linearSpeed = body.velocity.length();
        
        // Check if dice has significant movement or velocity
        if (angularSpeed > velocityThreshold || linearSpeed > velocityThreshold) {
            hasSettled = false;
            return;
        }
        
        // Check if dice position has changed significantly since last check
        if (lastDicePositions[index]) {
            const distance = body.position.distanceTo(lastDicePositions[index]);
            if (distance > settlementThreshold) {
                hasSettled = false;
            }
        }
    });
    
    // Update positions for next check
    diceBodies.forEach((body, index) => {
        if (!safeIncludes(lockedDiceIndices, index)) {
            lastDicePositions[index] = body.position.clone();
        }
    });
    
    return hasSettled;
}

// Function to display rolling dice animation
function displayRollingDiceAnimation() {
    // Cycle through dice faces for rolling animation
    rollingAnimationFrame++;
    const currentDiceValue = (rollingAnimationFrame % 6) + 1;
    
    // Check if we need to create the initial container and images
    let diceContainer = diceResultsContainer.querySelector('.dice-container');
    if (!diceContainer) {
        // Create container only once
        diceResultsContainer.innerHTML = '';
        diceContainer = document.createElement('div');
        diceContainer.className = 'd-flex justify-content-center align-items-center flex-wrap gap-2 dice-container';
        
        // Create all 6 dice images once
        for (let index = 0; index < 6; index++) {
            const diceImage = document.createElement('img');
            diceImage.style.width = '60px';
            diceImage.style.height = '60px';
            diceImage.style.margin = '2px';
            diceImage.style.border = '2px solid #ddd';
            diceImage.style.borderRadius = '8px';
            diceImage.style.cursor = 'default';
            diceImage.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
            diceImage.dataset.diceIndex = index;
            
            // Add error handling for missing images
            diceImage.onerror = function() {
                this.style.display = 'none';
                console.warn(`Could not load dice image: ${this.src}`);
            };
            
            diceContainer.appendChild(diceImage);
        }
        
        diceResultsContainer.appendChild(diceContainer);
    }
    
    // Update existing dice images
    const diceImages = diceContainer.querySelectorAll('img');
    diceImages.forEach((diceImage, index) => {
        const offsetValue = ((currentDiceValue + index) % 6) + 1;
        
        if (safeIncludes(lockedDiceIndices, index)) {
            // Show locked dice with their actual values and locked styling
            const lockedValue = currentDiceResults[index] || 1;
            diceImage.src = `assets/dice${lockedValue}.png`;
            diceImage.alt = `Locked Dice ${index + 1}: ${lockedValue}`;
            diceImage.className = 'locked'; // Reset classes
            diceImage.title = `Dice ${index + 1} is locked (value: ${lockedValue})`;
        } else {
            // Show cycling animation for dice being rolled
            diceImage.src = `assets/dice${offsetValue}.png`;
            diceImage.alt = `Rolling Dice ${index + 1}: ${offsetValue}`;
            diceImage.className = 'rolling'; // Reset classes
            diceImage.title = `Dice ${index + 1} is rolling`;
        }
        
        // Update data attributes
        diceImage.dataset.diceValue = safeIncludes(lockedDiceIndices, index) ? 
            (currentDiceResults[index] || 1) : offsetValue;
    });
}

// Function to display rolling animation for other players
function displayOtherPlayerRollingAnimation(playerId) {
    // Only log once per player when animation starts, not every frame
    if (!this.loggedPlayers) this.loggedPlayers = new Set();
    if (!this.loggedPlayers.has(playerId)) {
        // console.log(`🎲 [displayOtherPlayerRollingAnimation] Starting animation for player: ${playerId}`);
        this.loggedPlayers.add(playerId);
    }
    
    // Don't interrupt our own rolling animation
    if (isRolling && (playerId === myPlayerId || playerId === window.myPlayerId)) {
        return;
    }
    
    const diceResultsContainer = document.getElementById('dice-results-container');
    if (!diceResultsContainer) return;
    
    // Create a cycling animation similar to our own, but offset differently
    const animationFrame = Math.floor(Date.now() / 150) % 6; // Use time-based animation
    
    // Check if we need to create the initial container and images for this player
    let header = diceResultsContainer.querySelector('.player-header');
    let diceContainer = diceResultsContainer.querySelector('.dice-container');
    
    if (!header || !header.textContent.includes(playerId) || !diceContainer) {
        // Create container only once per player
        diceResultsContainer.innerHTML = '';
        
        // Add a header showing whose turn it is
        header = document.createElement('div');
        header.className = 'w-100 text-center mb-2 player-header';
        header.innerHTML = `<strong>${playerId} is rolling...</strong>`;
        diceResultsContainer.appendChild(header);
        
        // Create dice container
        diceContainer = document.createElement('div');
        diceContainer.className = 'd-flex justify-content-center align-items-center flex-wrap gap-2 dice-container';
        
        // Get locked dice for this player
        const playerLockedDice = playerLockedDiceStates[playerId] || [];
        
        // Create all 6 dice images once
        for (let index = 0; index < 6; index++) {
            const diceImage = document.createElement('img');
            diceImage.style.width = '60px';
            diceImage.style.height = '60px';
            diceImage.style.margin = '2px';
            diceImage.style.border = '2px solid #6c757d'; // Gray border to show it's not interactive
            diceImage.style.borderRadius = '8px';
            diceImage.style.opacity = '0.8'; // Slightly transparent to show it's not your turn
            diceImage.style.cursor = 'default';
            diceImage.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
            diceImage.dataset.diceIndex = index;
            
            // Add error handling for missing images
            diceImage.onerror = function() {
                this.style.display = 'none';
                console.warn(`Could not load dice image: ${this.src}`);
            };
            
            diceContainer.appendChild(diceImage);
        }
        
        diceResultsContainer.appendChild(diceContainer);
    }
    
    // Update existing dice images
    const diceImages = diceContainer.querySelectorAll('img');
    const playerLockedDice = playerLockedDiceStates[playerId] || [];
    // Only log locked dice state once per player, not every animation frame
    if (!this.loggedLockedDice) this.loggedLockedDice = new Set();
    if (!this.loggedLockedDice.has(playerId)) {
        // console.log(`🎲 [displayOtherPlayerRollingAnimation] Player ${playerId} locked dice:`, playerLockedDice);
        this.loggedLockedDice.add(playerId);
    }
    
    diceImages.forEach((diceImage, index) => {
        if (safeIncludes(playerLockedDice, index)) {
            // Show locked dice with their actual values if available
            const playerDiceValues = playerLockedDiceValues[playerId] || {};
            const lockedValue = playerDiceValues[index] || 1; // Use stored value or default to 1
            diceImage.src = `assets/dice${lockedValue}.png`;
            diceImage.alt = `${playerId}'s Locked Dice ${index + 1}: ${lockedValue}`;
            diceImage.className = 'locked'; // Reset classes
            diceImage.title = `${playerId}'s dice ${index + 1} is locked (value: ${lockedValue})`;
        } else {
            // Show cycling animation for dice being rolled
            // Offset each dice by its index so they don't all show the same face
            const offsetValue = ((animationFrame + index * 2) % 6) + 1; // Different offset for other players
            diceImage.src = `assets/dice${offsetValue}.png`;
            diceImage.alt = `${playerId}'s Rolling Dice ${index + 1}: ${offsetValue}`;
            diceImage.className = 'rolling'; // Reset classes
            diceImage.title = `${playerId}'s dice ${index + 1} is rolling`;
        }
    });
}

// Make the function globally accessible
window.displayOtherPlayerRollingAnimation = displayOtherPlayerRollingAnimation;

// Function to continuously update dice results
function updateDiceResults() {
    if (!isRolling) return;
    
    // Check if dice have settled (animation is handled by separate interval)
    const currentlySettled = checkDiceSettlement();
    
    if (currentlySettled && !isSettled) {
        // Dice just settled - start the timer
        isSettled = true;
        settlementStartTime = Date.now();
        // console.log('Dice settled. Starting 2-second timer...');
    } else if (!currentlySettled && isSettled) {
        // Dice started moving again - reset the timer
        isSettled = false;
        settlementStartTime = null;
        // console.log('Dice moving again. Timer reset.');
    }
    
    // Check if settlement delay has passed
    if (isSettled && settlementStartTime && (Date.now() - settlementStartTime >= SETTLEMENT_DELAY)) {
        // Settlement delay completed - show final results
        isRolling = false;
        if (settlementCheckInterval) {
            clearInterval(settlementCheckInterval);
            settlementCheckInterval = null;
        }
        if (rollingAnimationInterval) {
            clearInterval(rollingAnimationInterval);
            rollingAnimationInterval = null;
        }
        
        // Reset settlement tracking
        isSettled = false;
        settlementStartTime = null;
        
        // Reset damping back to normal material values
        diceBodies.forEach((body, index) => {
            if (!safeIncludes(lockedDiceIndices, index)) {
                const config = getDiceMaterialProperties(currentDiceMaterial);
                body.linearDamping = config.linearDamping;
                body.angularDamping = config.angularDamping;
            }
        });
        
        // Reset button text and keep it disabled until dice are locked
        rollDiceButton.textContent = 'Lock Dice First';
        rollDiceButton.disabled = true; // Keep disabled until player locks dice
        hasRolledThisTurn = true; // Mark that player has rolled after dice settle
        // console.log('🎲 Dice settled - setting hasRolledThisTurn = true');
        
        // Show final results
        const results = diceBodies.map((body, index) => {
            if (safeIncludes(lockedDiceIndices, index)) {
                // Keep the previous result for locked dice, default to 1 if undefined
                return currentDiceResults[index] || 1;
            } else {
                // Calculate new result for unlocked dice
                return getDiceResult(body.quaternion);
            }
        });
        displayDiceResults(results);
        
        // Check for Farkle (only on dice that were actually rolled this turn)
        const rolledDiceIndices = [];
        const rolledDiceValues = [];
        
        for (let i = 0; i < 6; i++) {
            if (!safeIncludes(lockedDiceIndices, i)) {
                rolledDiceIndices.push(i);
                rolledDiceValues.push(results[i]);
            }
        }
        
        // Only check for Farkle if we actually rolled some dice AND it's still our turn
        if (rolledDiceValues.length > 0) {
            const isFarkleResult = isFarkle(rolledDiceValues);
            
            if (isFarkleResult) {
                // Check if it's still our turn before processing Farkle
                const isMyTurn = typeof canPlayerAct === 'function' ? canPlayerAct() : true;
                if (!isMyTurn) {
                    // console.log('🎲 Farkle detected but no longer our turn - skipping Farkle processing');
                    return; // Don't process Farkle if it's no longer our turn
                }
                
                // It's a Farkle! Clear pending points and show farkle message
                setTimeout(() => {
                    // Double-check it's still our turn before executing Farkle logic
                    const stillMyTurn = typeof canPlayerAct === 'function' ? canPlayerAct() : true;
                    if (!stillMyTurn) {
                        // console.log('🎲 Turn changed during Farkle timeout - cancelling Farkle processing');
                        return;
                    }
                    
                    // Show farkle message in UI instead of popup (this will handle turn ending)
                    showFarkleMessage();
                    
                    // Note: Roll button hiding is now handled by showFarkleMessage() function
                    
                    // Clear pending points immediately
                    if (typeof clearPendingPoints === 'function') {
                        clearPendingPoints();
                    }
                    
                    // Handle Farkle with persistent state management
                    if (typeof handlePlayerFarkle === 'function' && myPlayerId) {
                        handlePlayerFarkle(myPlayerId);
                    } else if (typeof showFarkleIndicator === 'function' && myPlayerId) {
                        // Fallback to old method
                        showFarkleIndicator(myPlayerId);
                    }
                    
                    // Note: Turn ending is now handled by showFarkleMessage() function
                    // Either when user clicks "End Turn Now" or after 5 second timeout
                }, 500); // Small delay to show the dice first
            }
        }
        
        // Broadcast dice results to other players if in multiplayer room
        if (isInMultiplayerRoom && typeof broadcastDiceResults === 'function' && myPlayerId) {
            // console.log('🎲 Broadcasting final dice results:', results);
            broadcastDiceResults(myPlayerId, results);
        } else {
            // console.log('🎲 Not broadcasting dice results - conditions not met:', {
            //     isInMultiplayerRoom,
            //     hasBroadcastFunction: typeof broadcastDiceResults === 'function',
            //     myPlayerId,
            //     results
            // });
        }
        
        // console.log('Settlement delay completed. Final results:', results);
    }
}

// Event listener for roll dice button
if (rollDiceButton) {
    rollDiceButton.addEventListener('click', () => {
        // console.log('🎲 Roll dice button clicked!');
        // console.log('🎲 Debug info:', {
        //     myPlayerId: myPlayerId,
        //     isInMultiplayerRoom: isInMultiplayerRoom,
        //     firebaseCurrentTurnPlayer: window.firebaseCurrentTurnPlayer,
        //     canPlayerActResult: canPlayerAct()
        // });
        
        // Check if player can act first
        if (!canPlayerAct()) {
            // console.log('Cannot roll dice - not your turn!');
            return;
        }
        
        // Don't allow rolling if already rolling or if already rolled this turn
        if (isRolling || hasRolledThisTurn) {
            return;
        }
        
        // console.log('🎲 Player can act - proceeding with dice roll');
    
    // Set Firebase state to rolling when starting to roll
    if (typeof startMyTurn === 'function') {
        startMyTurn();
    }
    
    // Broadcast rolling start to other players for spectator animation
    if (isInMultiplayerRoom && typeof broadcastRollingStart === 'function' && myPlayerId) {
        console.log('🎲 Broadcasting rolling start for player:', myPlayerId);
        broadcastRollingStart(myPlayerId);
    } else {
        console.log('🎲 Not broadcasting rolling start - conditions not met:', {
            isInMultiplayerRoom,
            hasBroadcastFunction: typeof broadcastRollingStart === 'function',
            myPlayerId
        });
    }
    
    const energy = 12; // Fixed energy value

    // Start rolling state and reset settlement tracking
    isRolling = true;
    isSettled = false;
    settlementStartTime = null;
    lastDicePositions = []; // Reset position tracking
    rollingAnimationFrame = 0; // Reset animation frame
    rollDiceButton.textContent = 'Rolling...';
    rollDiceButton.disabled = true; // Disable immediately when rolling starts
    
    // Clear any existing intervals
    if (settlementCheckInterval) {
        clearInterval(settlementCheckInterval);
    }
    if (rollingAnimationInterval) {
        clearInterval(rollingAnimationInterval);
    }

    // Show rolling animation immediately
    displayRollingDiceAnimation();

    // Start continuous result updates and animations
    settlementCheckInterval = setInterval(updateDiceResults, 50); // Check settlement more frequently for faster response
    rollingAnimationInterval = setInterval(displayRollingDiceAnimation, ROLLING_ANIMATION_SPEED); // Animate every 150ms

    // Reset dice positions to random locations within the box before rolling
    diceBodies.forEach((body, index) => {
        if (!safeIncludes(lockedDiceIndices, index)) {
            // Reset to random position within the safe area
            const safeArea = wallLength - wallThickness - 1.0; // Account for dice size
            body.position.set(
                (Math.random() - 0.5) * safeArea, // Random X position within the safe area
                1.0 + Math.random() * 2.0,        // Random Y position between 1 and 3 units high
                (Math.random() - 0.5) * safeArea  // Random Z position within the safe area
            );

            // Reset rotation to random orientation
            body.quaternion.setFromEuler(
                Math.random() * Math.PI * 2, // Random X rotation
                Math.random() * Math.PI * 2, // Random Y rotation
                Math.random() * Math.PI * 2  // Random Z rotation
            );

            // Clear any existing velocity
            body.velocity.set(0, 0, 0);
            body.angularVelocity.set(0, 0, 0);
        }
    });

    // Apply random forces to dice bodies based on energy (only to unlocked dice)
    diceBodies.forEach((body, index) => {
        if (!safeIncludes(lockedDiceIndices, index)) {
            // Moderate damping for natural but faster settling
            body.linearDamping = 0.01; // Moderate damping for good balance
            body.angularDamping = 0.01; // Moderate damping for good balance
            
            body.velocity.set(
                (Math.random() - 0.5) * energy,
                Math.random() * energy,
                (Math.random() - 0.5) * energy
            );
            body.angularVelocity.set(
                (Math.random() - 0.5) * energy * 2,
                (Math.random() - 0.5) * energy * 2,
                (Math.random() - 0.5) * energy * 2
            );
        }
    });

    // Start continuous result updates
    settlementCheckInterval = setInterval(updateDiceResults, 50); // Check more frequently for faster response
    
    // console.log('Dice rolling with energy:', energy);
});
} else {
    // console.error('Roll dice button not found in DOM');
}

// Camera system now uses fixed positioning - camera control UI removed

// Declare resetDiceButton at the top of the file to ensure it is accessible
let resetDiceButton;

// Ensure the reset dice button is initialized after the DOM content is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    // Initialize arrays to ensure they are always defined
    ensureArraysInitialized();
    
    resetDiceButton = document.getElementById('reset-dice');
    if (resetDiceButton) {
        // The reset button is already in the correct place in the HTML controls section
        
        resetDiceButton.addEventListener('click', () => {
            diceBodies.forEach((body, index) => {
                // Only reset unlocked dice
                if (!safeIncludes(lockedDiceIndices, index)) {
                    // Reset position within the box dimensions, accounting for dice size
                    const safeArea = wallLength - wallThickness - 1.0; // Account for dice size
                    body.position.set(
                        (Math.random() - 0.5) * safeArea, // X position within the safe area
                        1.0,                              // Y position well above the floor
                        (Math.random() - 0.5) * safeArea  // Z position within the safe area
                    );

                    // Reset rotation
                    body.quaternion.setFromEuler(
                        Math.random() * Math.PI * 2, // Random X rotation
                        Math.random() * Math.PI * 2, // Random Y rotation
                        Math.random() * Math.PI * 2  // Random Z rotation
                    );
                }
            });
            
            // Use the global showAdminStatus function from firebase-admin.js
            if (typeof showAdminStatus === 'function') {
                showAdminStatus('reset-dice', '✅ Dice positions have been reset');
            }
        });
    }
    
    // Toggle 3D dice view visibility
    const toggle3DViewButton = document.getElementById('toggle-3d-view');
    if (toggle3DViewButton) {
        let diceViewVisible = false; // Start hidden
        
        toggle3DViewButton.addEventListener('click', () => {
            const diceCanvas = document.getElementById('dice-canvas');
            if (diceCanvas) {
                diceViewVisible = !diceViewVisible;
                
                if (diceViewVisible) {
                    diceCanvas.style.display = 'block';
                    toggle3DViewButton.textContent = 'Hide 3D Dice View';
                    toggle3DViewButton.className = 'btn btn-warning me-2';
                    
                    // Small delay to ensure canvas is visible before WebGL operations
                    setTimeout(() => {
                        // Ensure renderer is properly sized when canvas becomes visible
                        renderer.setSize(500, 500);
                        
                        // Ensure camera is positioned correctly
                        setupDefaultCamera();
                        
                        // Force a render to make sure the scene is displayed
                        renderScene();
                    }, 10);
                    
                    // console.log('🎲 3D dice view shown via admin toggle');
                } else {
                    diceCanvas.style.display = 'none';
                    toggle3DViewButton.textContent = 'Show 3D Dice View';
                    toggle3DViewButton.className = 'btn btn-info me-2';
                    // console.log('🎲 3D dice view hidden via admin toggle');
                }
            }
        });
    }
    
    // Add event listener for reset locked dice button
    const resetLockedDiceButton = document.getElementById('reset-locked-dice');
    if (resetLockedDiceButton) {
        resetLockedDiceButton.addEventListener('click', () => {
            // Show confirmation message first
            if (typeof showAdminStatus === 'function') {
                showAdminStatus('reset-locked-dice', 'Click again to confirm resetting locked dice', false, 5000);
            }
            
            // Add temporary click handler for confirmation
            const confirmHandler = () => {
                resetLockedDice();
                updateGameState();
                if (typeof showAdminStatus === 'function') {
                    showAdminStatus('reset-locked-dice', '✅ Locked dice have been reset');
                }
                
                // Remove the confirmation handler
                resetLockedDiceButton.removeEventListener('click', confirmHandler);
            };
            
            // Add the confirmation handler
            resetLockedDiceButton.addEventListener('click', confirmHandler);
            
            // Remove the confirmation handler after 5 seconds
            setTimeout(() => {
                resetLockedDiceButton.removeEventListener('click', confirmHandler);
            }, 5000);
        });
    }
    
    // Add event listener for pass turn test button
    const passTurnTestButton = document.getElementById('pass-turn-test');
    if (passTurnTestButton) {
        passTurnTestButton.addEventListener('click', () => {
            // console.log('🔄 PASS TURN TEST BUTTON CLICKED');
            // console.log('📊 Current game state:', {
            //     myPlayerId,
            //     isInMultiplayerRoom,
            //     canAct: canPlayerAct(),
            //     currentTurn: typeof getCurrentTurn === 'function' ? getCurrentTurn() : 'function not available'
            // });
            
            if (typeof nextTurn === 'function') {
                // console.log('⏭️ Calling nextTurn()...');
                const nextPlayer = nextTurn();
                // console.log('✅ nextTurn() returned:', nextPlayer);
                
                // console.log('🔄 Calling updateGameControlsState()...');
                updateGameControlsState();
                
                // console.log('📡 Broadcasting turn change...');
                if (isInMultiplayerRoom && typeof broadcastTurnChange === 'function') {
                    broadcastTurnChange(nextPlayer);
                    // console.log('✅ broadcastTurnChange() called with:', nextPlayer);
                    if (typeof showAdminStatus === 'function') {
                        showAdminStatus('pass-turn-test', '✅ Turn passed successfully');
                    }
                } else {
                    // console.warn('❌ Not in multiplayer room or broadcastTurnChange not available');
                    if (typeof showAdminStatus === 'function') {
                        showAdminStatus('pass-turn-test', 'Turn passed (single player mode)', true);
                    }
                }
            } else {
                // console.error('❌ nextTurn function not available');
                if (typeof showAdminStatus === 'function') {
                    showAdminStatus('pass-turn-test', 'Error: nextTurn function not available', false);
                }
            }
        });
    }
    
    // Add event listener for test win condition button
    const testWinConditionButton = document.getElementById('test-win-condition');
    if (testWinConditionButton) {
        testWinConditionButton.addEventListener('click', () => {
            // Get current player - use myPlayerId for the actual player, not the turn system player
            let currentPlayer;
            if (typeof window.myPlayerId !== 'undefined' && window.myPlayerId) {
                currentPlayer = window.myPlayerId;
            } else if (typeof myPlayerId !== 'undefined' && myPlayerId) {
                currentPlayer = myPlayerId;
            } else if (typeof getCurrentTurn === 'function') {
                currentPlayer = getCurrentTurn();
            } else {
                currentPlayer = 'Player1'; // Fallback
            }
            
            // Get winning score from settings
            const gameSettings = (typeof getGameSettings === 'function') ? getGameSettings() : { winningScore: 10000 };
            const winningScore = gameSettings.winningScore || 10000;
            
            // Set current player's score to winning score
            if (typeof playerScores !== 'undefined' && playerScores) {
                playerScores[currentPlayer] = winningScore;
                
                // Update score display
                if (typeof updateScoreDisplay === 'function') {
                    updateScoreDisplay();
                }
                
                // Trigger win condition check
                if (typeof checkWinCondition === 'function') {
                    checkWinCondition(currentPlayer, winningScore);
                    showAdminStatus('test-win-condition', `✅ Win condition triggered for ${currentPlayer} with ${winningScore} points`);
                } else {
                    showAdminStatus('test-win-condition', 'Error: checkWinCondition function not available', false);
                }
            } else {
                showAdminStatus('test-win-condition', 'Error: playerScores not available', false);
            }
        });
    }
    

});

// Update dice bodies to use the dice material
diceBodies.forEach(body => {
    body.material = diceMaterial;
});

// Add a ceiling to contain the dice
const ceilingBody = new CANNON.Body({ mass: 0, material: cannonWallMaterial });
const ceilingShape = new CANNON.Plane();
ceilingBody.addShape(ceilingShape);
ceilingBody.position.set(0, wallHeight, 0); // Position the ceiling at the top of the walls
ceilingBody.quaternion.setFromEuler(Math.PI / 2, 0, 0); // Face downward
world.addBody(ceilingBody);

// Ensure the front wall is properly added to the physics world
if (!world.bodies.includes(frontWallBody)) {
    world.addBody(frontWallBody);
}

// Verify restitution and friction settings for dice and walls
diceBodies.forEach(body => {
    body.material = diceMaterial;
    body.linearDamping = 0.1; // Reduce sliding
    body.angularDamping = 0.1; // Reduce spinning
});

// Remove the ceiling of the box
// Commenting out the ceiling creation code
/*
const ceilingBody = new CANNON.Body({ mass: 0 });
const ceilingShape = new CANNON.Plane();
ceilingBody.addShape(ceilingShape);
ceilingBody.position.set(0, wallHeight, 0); // Position the ceiling at the top of the walls
ceilingBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0); // Align the ceiling horizontally
world.addBody(ceilingBody);
*/

// Update the animation loop to ensure proper physics simulation
function animate() {
    requestAnimationFrame(animate);

    // Step the physics world - use moderate acceleration for natural but faster settling
    if (isRolling) {
        // During rolling, run physics faster but not too fast to maintain natural movement
        for (let i = 0; i < 3; i++) {
            world.step(1 / 180); // Moderate timestep acceleration for natural movement
        }
    } else {
        // Normal physics rate when not rolling
        world.step(1 / 60);
    }

    // Sync Three.js dice with Cannon.js bodies (only for unlocked dice)
    diceBodies.forEach((body, index) => {
        const dice = diceModels[index];
        if (safeIncludes(lockedDiceIndices, index)) {
            // Hide locked dice by moving them far away and making them invisible
            dice.visible = false;
            body.position.set(1000, 1000, 1000); // Move physics body far away
        } else {
            // Show unlocked dice and sync with physics
            dice.visible = true;
            dice.position.copy(body.position);
            dice.quaternion.copy(body.quaternion);
        }
    });

    renderer.render(scene, camera);
}

// Event listeners for dice selection controls
document.addEventListener('DOMContentLoaded', () => {
    // Initialize arrays to ensure they are always defined
    ensureArraysInitialized();
    
    const lockButton = document.getElementById('lock-selected-dice');
    const clearButton = document.getElementById('clear-selection');
    const bankPointsButton = document.getElementById('bank-points');
    
    if (lockButton) {
        lockButton.addEventListener('click', lockSelectedDice);
    }
    
    if (clearButton) {
        clearButton.addEventListener('click', clearDiceSelection);
    }
    
    if (bankPointsButton) {
        bankPointsButton.addEventListener('click', () => {
            if (!canPlayerAct()) {
                return;
            }
            
            if (typeof bankPendingPoints === 'function') {
                const bankedAmount = bankPendingPoints();
                
                if (bankedAmount > 0) {
                    // End the turn after banking points - bypass the canPlayerAct check
                    // since we already confirmed the player can act before banking
                    
                    // Reset dice state for next player - use reset locked dice function
                    resetLockedDice();
                    
                    // Update game state to ensure Firebase synchronization (same as admin button)
                    updateGameState();
                    
                    // Clear any pending points for the next player
                    if (typeof clearPendingPoints === 'function') {
                        clearPendingPoints();
                    }
                    
                    // Clear dice display
                    const diceResultsContainer = document.getElementById('dice-results-container');
                    if (diceResultsContainer) {
                        diceResultsContainer.innerHTML = '<p class="text-muted">Waiting for next player...</p>';
                    }
                    
                    // Hide dice selection controls when no dice are displayed
                    const diceSelectionControls = document.getElementById('dice-selection-controls');
                    if (diceSelectionControls) {
                        diceSelectionControls.style.display = 'none';
                    }
                    
                    // Hide instruction text when no dice are displayed
                    updateInstructionTextVisibility(false);
                    
                    // Update selection controls to reflect reset state
                    updateSelectionControls();
                    
                    // Advance to next turn
                    const nextPlayer = nextTurn();
                    updateGameControlsState();
                    
                    // Broadcast turn change to other players if in multiplayer
                    if (isInMultiplayerRoom && typeof broadcastTurnChange === 'function') {
                        broadcastTurnChange(nextPlayer);
                    }
                }
            }
        });
    }
    
    // Initialize selection controls
    updateSelectionControls();
    
    // Initialize turn system (single player by default)
    myPlayerId = 'Player1'; // This would be set by the multiplayer system
    window.myPlayerId = 'Player1'; // Keep window variable in sync
    initializeTurnSystem([myPlayerId], false);
    updateGameControlsState();
    
    // Materials modal event handlers
    initializeMaterialsModal();
});

// Materials modal functionality
function initializeMaterialsModal() {
    // Add event listener for when modal is shown
    const materialsModal = document.getElementById('materialsModal');
    if (materialsModal) {
        materialsModal.addEventListener('show.bs.modal', function() {
            updateModalSelections();
        });
    }
    
    // Handle preset selection
    document.querySelectorAll('.preset-option').forEach(button => {
        button.addEventListener('click', function() {
            const presetName = this.dataset.preset;
            const preset = applyMaterialPreset(presetName);
            
            if (preset) {
                // Update visual selection for dice material
                document.querySelectorAll('.material-option[data-type="dice"]').forEach(btn => {
                    btn.classList.remove('active');
                    if (btn.dataset.material === preset.dice) {
                        btn.classList.add('active');
                    }
                });
                
                // Update visual selection for floor material
                document.querySelectorAll('.material-option[data-type="floor"]').forEach(btn => {
                    btn.classList.remove('active');
                    if (btn.dataset.material === preset.floor) {
                        btn.classList.add('active');
                    }
                });
                
                // Show preset info
                // console.log(`Applied preset: ${preset.name} - ${preset.description}`);
            }
        });
    });
    
    // Handle material option selection
    document.querySelectorAll('.material-option').forEach(button => {
        button.addEventListener('click', function() {
            const materialType = this.dataset.type;
            const materialName = this.dataset.material;
            
            // Remove active class from ALL materials of the same type (both rows)
            const allMaterialsOfType = document.querySelectorAll('.material-option[data-type="' + materialType + '"]');
            allMaterialsOfType.forEach(sibling => sibling.classList.remove('active'));
            
            // Add active class to clicked button
            this.classList.add('active');
        });
    });
    
    // Handle apply changes button
    const applyButton = document.getElementById('apply-materials');
    if (applyButton) {
        applyButton.addEventListener('click', function() {
            // Get selected materials
            const selectedDiceMaterial = document.querySelector('.material-option[data-type="dice"].active').dataset.material;
            const selectedFloorMaterial = document.querySelector('.material-option[data-type="floor"].active').dataset.material;
            
            // Apply changes
            changeDiceMaterial(selectedDiceMaterial);
            changeFloorMaterial(selectedFloorMaterial);
            
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('materialsModal'));
            if (modal) {
                modal.hide();
            }
        });
    }
    
    // Handle clear preferences button
    const clearButton = document.getElementById('clear-preferences');
    if (clearButton) {
        clearButton.addEventListener('click', function() {
            if (confirm('Are you sure you want to clear your saved material preferences?')) {
                clearMaterialPreferences();
                
                // Reset to defaults
                changeDiceMaterial('default');
                changeFloorMaterial('grass');
                
                // Update modal selections
                updateModalSelections();
                
                // console.log('Material preferences cleared and reset to defaults');
            }
        });
    }
}

// Function to update modal selections based on current materials
function updateModalSelections() {
    // Clear all active states first
    document.querySelectorAll('.material-option').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Set active state for current dice material
    const currentDiceButton = document.querySelector(`[data-material="${currentDiceMaterial}"][data-type="dice"]`);
    if (currentDiceButton) {
        currentDiceButton.classList.add('active');
    }
    
    // Set active state for current floor material
    const currentFloorButton = document.querySelector(`[data-material="${currentFloorMaterial}"][data-type="floor"]`);
    if (currentFloorButton) {
        currentFloorButton.classList.add('active');
    }
    
    // Show preference info in console
    if (hasSavedPreferences()) {
        const age = getPreferenceAge();
        // console.log(`Loaded saved material preferences (${age} days old): Dice=${currentDiceMaterial}, Floor=${currentFloorMaterial}`);
    }
}

// Function to change dice material
function changeDiceMaterial(materialType) {
    currentDiceMaterial = materialType;
    const newMaterials = createDiceMaterial(materialType);
    const config = getDiceMaterialProperties(materialType);
    
    // Update visual materials
    diceModels.forEach(dice => {
        dice.material = newMaterials;
    });
    
    // Update physics materials
    const newPhysicsMaterial = createDicePhysicsMaterial(materialType);
    diceBodies.forEach(body => {
        body.material = newPhysicsMaterial;
        body.linearDamping = config.linearDamping;
        body.angularDamping = config.angularDamping;
        body.mass = config.density;
        body.updateMassProperties();
    });
    
    // Update contact material properties directly
    contactMaterials.diceWall.restitution = (newPhysicsMaterial.restitution + cannonWallMaterial.restitution) / 2;
    contactMaterials.diceWall.friction = (newPhysicsMaterial.friction + cannonWallMaterial.friction) / 2;
    
    contactMaterials.diceFloor.restitution = (newPhysicsMaterial.restitution + currentFloorPhysicsMaterial.restitution) / 2;
    contactMaterials.diceFloor.friction = (newPhysicsMaterial.friction + currentFloorPhysicsMaterial.friction) / 2;
    
    diceMaterial = newPhysicsMaterial;
    
    // Save preferences - use player-specific storage in multiplayer mode
    if (isInMultiplayerRoom && myPlayerId) {
        savePlayerMaterialPreferences(myPlayerId, currentDiceMaterial, currentFloorMaterial, currentBackgroundMaterial);
    } else {
        saveMaterialPreferences(currentDiceMaterial, currentFloorMaterial, currentBackgroundMaterial);
    }
    
    // console.log(`Dice material changed to: ${materialType} (bounce: ${config.restitution}, friction: ${config.friction})`);
}

// Function to change floor material
function changeFloorMaterial(materialType) {
    currentFloorMaterial = materialType;
    const newMaterial = createFloorMaterial(materialType);
    const config = getFloorMaterialProperties(materialType);
    
    // Update visual material
    floor.material = newMaterial;
    
    // Update wall colors to complement the floor
    const wallColor = config.wallColor || 0x8B4513; // Default to brown if no wall color specified
    walls.forEach((wall, index) => {
        if (index === 3) { // Front wall (transparent)
            wall.material.color.setHex(wallColor);
        } else { // Regular walls
            wall.material.color.setHex(wallColor);
        }
    });
    
    // Update physics material
    const newFloorPhysicsMaterial = createFloorPhysicsMaterial(materialType);
    groundBody.material = newFloorPhysicsMaterial;
    
    // Update contact material properties directly
    contactMaterials.diceFloor.restitution = (diceMaterial.restitution + newFloorPhysicsMaterial.restitution) / 2;
    contactMaterials.diceFloor.friction = (diceMaterial.friction + newFloorPhysicsMaterial.friction) / 2;
    
    currentFloorPhysicsMaterial = newFloorPhysicsMaterial;
    
    // Save preferences - use player-specific storage in multiplayer mode
    if (isInMultiplayerRoom && myPlayerId) {
        savePlayerMaterialPreferences(myPlayerId, currentDiceMaterial, currentFloorMaterial, currentBackgroundMaterial);
    } else {
        saveMaterialPreferences(currentDiceMaterial, currentFloorMaterial, currentBackgroundMaterial);
    }
    
    // console.log(`Floor material changed to: ${materialType} (bounce: ${config.restitution}, friction: ${config.friction})`);
    // console.log(`Wall color updated to complement floor: #${wallColor.toString(16).padStart(6, '0').toUpperCase()}`);
}

// Function to change background material
function changeBackgroundMaterial(materialType) {
    currentBackgroundMaterial = materialType;
    const config = getBackgroundMaterialProperties(materialType);
    
    // Update the renderer's clear color (background)
    renderer.setClearColor(config.color);
    
    // Save preferences - use player-specific storage in multiplayer mode
    if (isInMultiplayerRoom && myPlayerId) {
        savePlayerMaterialPreferences(myPlayerId, currentDiceMaterial, currentFloorMaterial, currentBackgroundMaterial);
    } else {
        saveMaterialPreferences(currentDiceMaterial, currentFloorMaterial, currentBackgroundMaterial);
    }
    
    // console.log(`Background changed to: ${materialType} (color: #${config.color.toString(16).padStart(6, '0').toUpperCase()})`);
}

// WebRTC callback function to handle received dice results from other players
function onDiceResultsReceived(data) {
    const { playerId, diceResults } = data;
    // console.log(`Received dice results from ${playerId}:`, diceResults);
    
    // Only display other players' results if it's not your turn
    if (playerId !== myPlayerId) {
        displayOtherPlayerResults(playerId, diceResults);
    }
}

// Make spectator message functions globally accessible for Firebase listeners
window.showSpectatorHotDiceMessage = showSpectatorHotDiceMessage;
window.showSpectatorFarkleMessage = showSpectatorFarkleMessage;

    // Mobile hamburger menu functionality
    const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    if (mobileMenuToggle) {
        mobileMenuToggle.addEventListener('click', function() {
            // Toggle the 'show' class on all mobile-collapsible sections
            const collapsibleSections = document.querySelectorAll('.mobile-collapsible');
            const hamburgerIcon = this.querySelector('.hamburger-icon');
            
            // Check if any section is currently visible
            const isAnyVisible = Array.from(collapsibleSections).some(section => 
                section.classList.contains('show')
            );
            
            // Toggle all sections
            collapsibleSections.forEach(section => {
                if (isAnyVisible) {
                    section.classList.remove('show');
                } else {
                    section.classList.add('show');
                }
            });
            
            // Toggle hamburger icon animation
            if (hamburgerIcon) {
                if (isAnyVisible) {
                    hamburgerIcon.classList.remove('active');
                } else {
                    hamburgerIcon.classList.add('active');
                }
            }
        });
    }

// Reinitialize the animation loop
animate();
