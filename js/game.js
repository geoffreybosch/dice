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

// Initialize Three.js scene
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, 800 / 500, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('dice-canvas'), antialias: true });
renderer.setSize(800, 500);
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

// Mouse controls for camera
let mouseDown = false;
let mouseX = 0;
let mouseY = 0;
let cameraDistance = 15; // Increased distance for top-down view
let cameraAngleX = Math.PI / 2; // 90 degrees down for top-down view
let cameraAngleY = 0;

// Get the dice canvas for mouse events
const diceCanvas = document.getElementById('dice-canvas');

// Mouse event listeners
diceCanvas.addEventListener('mousedown', (event) => {
    mouseDown = true;
    mouseX = event.clientX;
    mouseY = event.clientY;
});

diceCanvas.addEventListener('mouseup', () => {
    mouseDown = false;
});

diceCanvas.addEventListener('mousemove', (event) => {
    if (!mouseDown) return;
    
    const deltaX = event.clientX - mouseX;
    const deltaY = event.clientY - mouseY;
    
    cameraAngleY += deltaX * 0.01;
    cameraAngleX += deltaY * 0.01;
    
    // Limit vertical rotation to keep camera above the table (top-down bias)
    cameraAngleX = Math.max(Math.PI/4, Math.min(Math.PI/2, cameraAngleX));
    
    mouseX = event.clientX;
    mouseY = event.clientY;
    
    updateCameraPosition();
});

// Mouse wheel for zoom
diceCanvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    cameraDistance += event.deltaY * 0.01;
    cameraDistance = Math.max(5, Math.min(30, cameraDistance));
    updateCameraPosition();
});

// Touch events for mobile
diceCanvas.addEventListener('touchstart', (event) => {
    event.preventDefault();
    if (event.touches.length === 1) {
        mouseDown = true;
        mouseX = event.touches[0].clientX;
        mouseY = event.touches[0].clientY;
    }
});

diceCanvas.addEventListener('touchend', (event) => {
    event.preventDefault();
    mouseDown = false;
});

diceCanvas.addEventListener('touchmove', (event) => {
    event.preventDefault();
    if (!mouseDown || event.touches.length !== 1) return;
    
    const deltaX = event.touches[0].clientX - mouseX;
    const deltaY = event.touches[0].clientY - mouseY;
    
    cameraAngleY += deltaX * 0.01;
    cameraAngleX += deltaY * 0.01;
    
    // Limit vertical rotation to keep camera above the table (top-down bias)
    cameraAngleX = Math.max(Math.PI/4, Math.min(Math.PI/2, cameraAngleX));
    
    mouseX = event.touches[0].clientX;
    mouseY = event.touches[0].clientY;
    
    updateCameraPosition();
});

// Function to update camera position - optimized for top-down view
function updateCameraPosition() {
    // For top-down view, position camera directly above the center
    const x = Math.sin(cameraAngleY) * Math.cos(cameraAngleX) * cameraDistance;
    const y = Math.abs(Math.sin(cameraAngleX)) * cameraDistance; // Ensure Y is always positive (above)
    const z = Math.cos(cameraAngleY) * Math.cos(cameraAngleX) * cameraDistance;
    
    camera.position.set(x, y, z);
    camera.lookAt(0, 0, 0); // Always look at the center of the dice area
}

// Set initial camera position
updateCameraPosition();

// Apply saved background material preference
if (currentBackgroundMaterial !== 'white') {
    changeBackgroundMaterial(currentBackgroundMaterial);
}

// Turn-based system functions
function canPlayerAct(playerId = myPlayerId) {
    if (!isInMultiplayerRoom) return true; // Single player mode - always allow
    return isPlayerTurn(playerId);
}

function updateGameControlsState() {
    const rollButton = document.getElementById('roll-dice');
    const bankPointsButton = document.getElementById('bank-points');
    const materialsButton = document.getElementById('materials-button');
    const diceSelectionControls = document.getElementById('dice-selection-controls');
    
    const canAct = canPlayerAct();
    const hasPendingPoints = typeof getPendingPoints === 'function' ? getPendingPoints() > 0 : false;
    
    // Enable/disable controls based on turn
    if (rollButton) rollButton.disabled = !canAct;
    if (materialsButton) materialsButton.disabled = !canAct;
    
    // Show/hide dice selection controls based on turn AND whether there are dice to select
    if (diceSelectionControls) {
        const hasDiceDisplayed = currentDiceResults && currentDiceResults.length > 0;
        const hasSelectableDice = hasDiceDisplayed && currentDiceResults.some((_, index) => !lockedDiceIndices.includes(index));
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
        bankPointsButton.disabled = !canAct;
        bankPointsButton.style.display = (canAct && hasPendingPoints) ? 'inline-block' : 'none';
        if (hasPendingPoints) {
            bankPointsButton.textContent = `Bank ${getPendingPoints()} Points & End Turn`;
        }
    }
    
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
    // Check if player can act
    if (!canPlayerAct()) {
        console.log('Cannot roll dice - not your turn!');
        return;
    }
    
    const diceResults = [];
    
    // Generate results for all 6 dice positions
    for (let i = 0; i < 6; i++) {
        if (lockedDiceIndices.includes(i)) {
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
        const isLocked = lockedDiceIndices.includes(index);
        
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
                        console.log('Cannot select dice - not your turn!');
                    }
                });
                
                // Apply selection state if already selected
                if (selectedDiceIndices.includes(index)) {
                    diceImage.classList.add('selected');
                }
            }
        }
        
        // Add error handling for missing images
        diceImage.onerror = function() {
            this.style.display = 'none';
            console.warn(`Could not load dice image: assets/dice${result}.png`);
        };
        
        diceResultsContainer.appendChild(diceImage);
    });
    
    // Show/hide selection controls based on whether there are unlocked dice to select AND if it's the player's turn
    const selectionControls = document.getElementById('dice-selection-controls');
    if (selectionControls) {
        const hasSelectableDice = results.some((_, index) => !lockedDiceIndices.includes(index));
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
        
        // Add error handling for missing images
        diceImage.onerror = function() {
            this.style.display = 'none';
            console.warn(`Could not load dice image: assets/dice${result}.png`);
        };
        
        diceContainer.appendChild(diceImage);
    });
    
    diceResultsContainer.appendChild(diceContainer);
    
    // Hide dice selection controls when showing other player's results (not interactive)
    const diceSelectionControls = document.getElementById('dice-selection-controls');
    if (diceSelectionControls) {
        diceSelectionControls.style.display = 'none';
    }
    
    // Hide instruction text when showing other player's results
    updateInstructionTextVisibility(false);
}

// Dice selection functions
function toggleDiceSelection(diceIndex, imageElement) {
    // Prevent selection of locked dice or dice that are currently rolling
    if (lockedDiceIndices.includes(diceIndex) || isRolling) {
        return;
    }
    
    const isSelected = selectedDiceIndices.includes(diceIndex);
    
    if (isSelected) {
        // Deselect dice
        selectedDiceIndices = selectedDiceIndices.filter(index => index !== diceIndex);
        imageElement.classList.remove('selected');
    } else {
        // Select dice
        selectedDiceIndices.push(diceIndex);
        imageElement.classList.add('selected');
    }
    
    updateSelectionControls();
}

function updateSelectionControls() {
    const lockButton = document.getElementById('lock-selected-dice');
    const clearButton = document.getElementById('clear-selection');
    
    const hasSelection = selectedDiceIndices.length > 0;
    
    // Update lock button
    if (lockButton) {
        lockButton.disabled = !hasSelection;
        
        if (!hasSelection) {
            lockButton.textContent = 'Lock Selected Dice';
            lockButton.className = 'btn btn-secondary me-2'; // Grey out when disabled
        } else {
            lockButton.className = 'btn btn-success me-2'; // Green when enabled
            
            // Calculate potential points for selected dice
            let potentialPoints = 0;
            selectedDiceIndices.forEach(index => {
                const diceValue = currentDiceResults[index];
                if (diceValue === 1) {
                    potentialPoints += 100;
                } else if (diceValue === 5) {
                    potentialPoints += 50;
                }
            });
            
            if (potentialPoints > 0) {
                lockButton.textContent = `Lock ${selectedDiceIndices.length} Dice (${potentialPoints} pts)`;
            } else {
                lockButton.textContent = `Lock ${selectedDiceIndices.length} Dice (0 pts)`;
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
        console.log('Cannot lock dice - not your turn!');
        return;
    }
    
    if (selectedDiceIndices.length === 0) {
        alert('Please select at least one dice to lock.');
        return;
    }
    
    // Calculate points for selected dice
    let totalPoints = 0;
    let scoringDetails = [];
    
    selectedDiceIndices.forEach(index => {
        const diceValue = currentDiceResults[index];
        let points = 0;
        
        if (diceValue === 1) {
            points = 100;
            scoringDetails.push(`${points} (1)`);
        } else if (diceValue === 5) {
            points = 50;
            scoringDetails.push(`${points} (5)`);
        }
        
        totalPoints += points;
    });
    
    // Prevent locking dice that don't score any points
    if (totalPoints === 0) {
        alert('You can only lock dice that score points (1s and 5s). Selected dice are worth 0 points.');
        return;
    }
    
    // Add points to pending score
    const description = scoringDetails.join(' + ');
    if (typeof addPendingPoints === 'function') {
        addPendingPoints(totalPoints, description);
    }
    console.log(`Locked dice scored ${totalPoints} points: ${description}`);
    
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
    
    // Re-display results without locked dice
    displayDiceResults(currentDiceResults);
    
    // Update UI to reflect locked state
    updateGameState();
    updateGameControlsState();
    
    console.log(`Locked dice at indices: ${lockedDiceIndices}, Remaining dice: ${availableDiceCount}`);
}

function clearDiceSelection() {
    if (!canPlayerAct()) {
        console.log('Cannot clear selection - not your turn!');
        return;
    }
    
    selectedDiceIndices = [];
    // Re-display to clear visual selection
    displayDiceResults(currentDiceResults);
    updateSelectionControls();
}

// End turn function
function endPlayerTurn() {
    if (!canPlayerAct()) {
        console.log('Cannot end turn - not your turn!');
        return;
    }
    
    // Save current player's material preferences
    if (isInMultiplayerRoom && myPlayerId) {
        savePlayerMaterialPreferences(myPlayerId, currentDiceMaterial, currentFloorMaterial);
    }
    
    // Reset dice state for next player
    selectedDiceIndices = [];
    lockedDiceIndices = [];
    availableDiceCount = 6;
    currentDiceResults = [];
    
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
    
    console.log(`Turn ended. Next player: ${nextPlayer}`);
    
    // Broadcast turn change to other players if in multiplayer
    if (isInMultiplayerRoom) {
        if (typeof broadcastTurnChange === 'function') {
            broadcastTurnChange(nextPlayer);
        } else {
            console.warn('broadcastTurnChange function not available');
        }
    }
}

// Integration with multiplayer system
function initializeMultiplayerMode(roomId, playerId, playerList) {
    myPlayerId = playerId;
    isInMultiplayerRoom = true;
    
    // Initialize turn system with all players
    initializeTurnSystem(playerList, true);
    
    // Load this player's material preferences
    const preferences = getPlayerMaterialPreferences(myPlayerId);
    if (preferences.dice !== 'default' || preferences.floor !== 'grass' || preferences.background !== 'white') {
        changeDiceMaterial(preferences.dice);
        changeFloorMaterial(preferences.floor);
        changeBackgroundMaterial(preferences.background || 'white');
    }
    
    updateGameControlsState();
    
    console.log(`Multiplayer mode initialized for room ${roomId}, player: ${myPlayerId}`);
    console.log(`Players in room: ${playerList.join(', ')}`);
}

function exitMultiplayerMode() {
    isInMultiplayerRoom = false;
    myPlayerId = 'Player1';
    
    // Reset to single player mode
    initializeTurnSystem([myPlayerId], false);
    updateGameControlsState();
    
    console.log('Exited multiplayer mode, returned to single player');
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
    
    // Reset roll button
    const rollButton = document.getElementById('roll-dice');
    if (rollButton) {
        rollButton.textContent = 'Roll Dice';
        rollButton.disabled = false;
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
    
    console.log('All dice have been unlocked and restored to the playing area');
}

function updateGameState() {
    // Update roll button text to show remaining dice
    const rollButton = document.getElementById('roll-dice');
    if (rollButton) {
        if (availableDiceCount > 0) {
            rollButton.textContent = availableDiceCount === 6 ? 'Roll Dice' : `Roll ${availableDiceCount} Dice`;
            rollButton.disabled = false;
        } else {
            rollButton.textContent = 'All Dice Locked';
            rollButton.disabled = true;
        }
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
world.gravity.set(0, -9.82, 0); // Set gravity

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

// Get camera control sliders
const cameraHeightSlider = document.getElementById('camera-height');
const cameraDistanceSlider = document.getElementById('camera-distance');
const cameraAngleSlider = document.getElementById('camera-angle');

// Update camera position and orientation based on slider values
function updateCamera() {
    const height = parseFloat(cameraHeightSlider.value);
    const distance = parseFloat(cameraDistanceSlider.value);
    const angle = parseFloat(cameraAngleSlider.value) * (Math.PI / 180); // Convert to radians

    camera.position.set(
        distance * Math.sin(angle), // X position based on angle
        height,                     // Y position (height)
        distance * Math.cos(angle)  // Z position based on angle
    );
    camera.lookAt(0, 0, 0); // Always look at the center of the dice area
}

// Add event listeners to sliders
cameraHeightSlider.addEventListener('input', updateCamera);
cameraDistanceSlider.addEventListener('input', updateCamera);
cameraAngleSlider.addEventListener('input', updateCamera);

// Don't initialize camera position here - use the mouse-based top-down system instead
// updateCamera();

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
let settlementStartTime = null;
let isSettled = false;
const SETTLEMENT_DELAY = 1000; // 1 second

// Function to check if dice have settled
function checkDiceSettlement() {
    let hasSettled = true;
    const settlementThreshold = 0.01; // Minimum movement to consider settled
    const velocityThreshold = 0.02; // Minimum velocity to consider settled
    
    diceBodies.forEach((body, index) => {
        if (lockedDiceIndices.includes(index)) return; // Skip locked dice
        
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
        if (!lockedDiceIndices.includes(index)) {
            lastDicePositions[index] = body.position.clone();
        }
    });
    
    return hasSettled;
}

// Function to continuously update dice results
function updateDiceResults() {
    if (!isRolling) return;
    
    // Only display results while rolling - don't show final results yet
    if (!isSettled) {
        // Show a rolling message instead of actual results
        diceResultsContainer.innerHTML = '<div class="text-center text-muted"><em>Rolling dice...</em></div>';
    }
    
    // Check if dice have settled
    const currentlySettled = checkDiceSettlement();
    
    if (currentlySettled && !isSettled) {
        // Dice just settled - start the timer
        isSettled = true;
        settlementStartTime = Date.now();
        console.log('Dice settled. Starting 2-second timer...');
    } else if (!currentlySettled && isSettled) {
        // Dice started moving again - reset the timer
        isSettled = false;
        settlementStartTime = null;
        console.log('Dice moving again. Timer reset.');
    }
    
    // Check if settlement delay has passed
    if (isSettled && settlementStartTime && (Date.now() - settlementStartTime >= SETTLEMENT_DELAY)) {
        // Settlement delay completed - show final results
        isRolling = false;
        if (settlementCheckInterval) {
            clearInterval(settlementCheckInterval);
            settlementCheckInterval = null;
        }
        
        // Reset settlement tracking
        isSettled = false;
        settlementStartTime = null;
        
        // Reset button text
        rollDiceButton.textContent = availableDiceCount === 6 ? 'Roll Dice' : `Roll ${availableDiceCount} Dice`;
        
        // Show final results
        const results = diceBodies.map((body, index) => {
            if (lockedDiceIndices.includes(index)) {
                // Keep the previous result for locked dice, default to 1 if undefined
                return currentDiceResults[index] || 1;
            } else {
                // Calculate new result for unlocked dice
                return getDiceResult(body.quaternion);
            }
        });
        displayDiceResults(results);
        
        // Broadcast dice results to other players if in multiplayer room
        if (isInMultiplayerRoom && typeof broadcastDiceResults === 'function' && myPlayerId) {
            broadcastDiceResults(myPlayerId, results);
        }
        
        console.log('Settlement delay completed. Final results:', results);
    }
}

// Get the energy slider element
const energySlider = document.getElementById('energy-slider');

// Event listener for roll dice button
rollDiceButton.addEventListener('click', () => {
    // If currently rolling, stop the rolling state
    if (isRolling) {
        isRolling = false;
        isSettled = false;
        settlementStartTime = null;
        
        if (settlementCheckInterval) {
            clearInterval(settlementCheckInterval);
            settlementCheckInterval = null;
        }
        rollDiceButton.textContent = availableDiceCount === 6 ? 'Roll Dice' : `Roll ${availableDiceCount} Dice`;
        
        // Force update the display to remove rolling class
        const results = diceBodies.map((body, index) => {
            if (lockedDiceIndices.includes(index)) {
                // Keep the previous result for locked dice, default to 1 if undefined
                return currentDiceResults[index] || 1;
            } else {
                // Calculate new result for unlocked dice
                return getDiceResult(body.quaternion);
            }
        });
        displayDiceResults(results);
        
        // Broadcast dice results to other players if in multiplayer room
        if (isInMultiplayerRoom && typeof broadcastDiceResults === 'function' && myPlayerId) {
            broadcastDiceResults(myPlayerId, results);
        }
        
        console.log('Rolling stopped manually. Current results:', results);
        return;
    }
    
    const energy = parseFloat(energySlider.value); // Get energy from slider

    // Start rolling state and reset settlement tracking
    isRolling = true;
    isSettled = false;
    settlementStartTime = null;
    lastDicePositions = []; // Reset position tracking
    rollDiceButton.textContent = 'Stop Rolling';
    
    // Clear any existing settlement check
    if (settlementCheckInterval) {
        clearInterval(settlementCheckInterval);
    }

    // Show rolling message immediately
    diceResultsContainer.innerHTML = '<div class="text-center text-muted"><em>Rolling dice...</em></div>';

    // Reset dice positions to random locations within the box before rolling
    diceBodies.forEach((body, index) => {
        if (!lockedDiceIndices.includes(index)) {
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
        if (!lockedDiceIndices.includes(index)) {
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
    settlementCheckInterval = setInterval(updateDiceResults, 100); // Update every 100ms
    
    console.log('Dice rolling with energy:', energy);
});

// Camera controls are already in the HTML, no need to move them
// The sliders (cameraHeightSlider, cameraDistanceSlider, cameraAngleSlider) are already properly positioned

// Declare resetDiceButton at the top of the file to ensure it is accessible
let resetDiceButton;

// Ensure the reset dice button is initialized after the DOM content is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    resetDiceButton = document.getElementById('reset-dice');
    if (resetDiceButton) {
        // The reset button is already in the correct place in the HTML controls section
        
        resetDiceButton.addEventListener('click', () => {
            diceBodies.forEach((body, index) => {
                // Only reset unlocked dice
                if (!lockedDiceIndices.includes(index)) {
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
        });
    }
    
    // Add event listener for reset locked dice button
    const resetLockedDiceButton = document.getElementById('reset-locked-dice');
    if (resetLockedDiceButton) {
        resetLockedDiceButton.addEventListener('click', () => {
            if (confirm('Reset all locked dice? This will clear your current selections.')) {
                resetLockedDice();
                updateGameState();
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

    // Step the physics world
    world.step(1 / 60);

    // Sync Three.js dice with Cannon.js bodies (only for unlocked dice)
    diceBodies.forEach((body, index) => {
        const dice = diceModels[index];
        if (lockedDiceIndices.includes(index)) {
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
                console.log('Cannot bank points - not your turn!');
                return;
            }
            
            if (typeof bankPendingPoints === 'function') {
                const bankedAmount = bankPendingPoints();
                if (bankedAmount > 0) {
                    console.log(`Banked ${bankedAmount} points successfully`);
                    
                    // End the turn after banking points
                    endPlayerTurn();
                } else {
                    console.log('No pending points to bank');
                }
            }
        });
    }
    
    // Initialize selection controls
    updateSelectionControls();
    
    // Initialize turn system (single player by default)
    myPlayerId = 'Player1'; // This would be set by the multiplayer system
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
                console.log(`Applied preset: ${preset.name} - ${preset.description}`);
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
                
                console.log('Material preferences cleared and reset to defaults');
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
        console.log(`Loaded saved material preferences (${age} days old): Dice=${currentDiceMaterial}, Floor=${currentFloorMaterial}`);
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
    
    console.log(`Dice material changed to: ${materialType} (bounce: ${config.restitution}, friction: ${config.friction})`);
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
    
    console.log(`Floor material changed to: ${materialType} (bounce: ${config.restitution}, friction: ${config.friction})`);
    console.log(`Wall color updated to complement floor: #${wallColor.toString(16).padStart(6, '0').toUpperCase()}`);
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
    
    console.log(`Background changed to: ${materialType} (color: #${config.color.toString(16).padStart(6, '0').toUpperCase()})`);
}

// Reinitialize the animation loop
animate();
