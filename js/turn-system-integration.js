// Turn System Integration for Multiplayer Farkle
// This file provides integration between the turn system and WebRTC multiplayer

// Turn-Based System Core Variables
let currentPlayerTurn = null;
let turnSystemPlayerList = [];
let currentPlayerIndex = 0;
let isMultiplayerMode = false;

// Player material preferences storage
const playerMaterialPreferences = {};

// Scoring System Variables
let playerScores = {}; // Banked/permanent scores for each player
let pendingPoints = 0; // Points earned this turn but not yet banked
let currentTurnPoints = []; // Array of point awards this turn for display

// Core Turn System Functions
function initializeTurnSystem(players, isMultiplayer = false, preserveCurrentTurn = false) {
    console.log(`Turn system initialized for ${players.length} players. First turn: ${players[0]}`);
    console.log(`🔧 INIT DEBUG: isMultiplayer=${isMultiplayer}, preserveCurrentTurn=${preserveCurrentTurn}`);
    console.log(`🔧 INIT DEBUG: Current pendingPoints=${pendingPoints}, currentPlayerTurn=${currentPlayerTurn}`);
    
    turnSystemPlayerList = [...players];
    
    if (preserveCurrentTurn && turnSystemPlayerList.includes(currentPlayerTurn)) {
        console.log(`Turn system updated for ${turnSystemPlayerList.length} players. Current turn preserved: ${currentPlayerTurn}`);
    } else {
        // Only reset turn state if not preserving current turn
        currentPlayerIndex = 0;
        currentPlayerTurn = players[0] || null;
        console.log(`Turn system updated for ${turnSystemPlayerList.length} players. Current turn preserved: ${currentPlayerTurn}`);
    }
    
    isMultiplayerMode = isMultiplayer;
    
    // Initialize scoring system
    initializePlayerScores(players);
    
    // Only reset pending points if we're not preserving the current turn
    // This prevents pending points from being lost during Firebase state updates
    if (!preserveCurrentTurn) {
        pendingPoints = 0;
        currentTurnPoints = [];
        console.log('🎮 TURN INIT: Reset pending points (new game/turn)');
    } else {
        console.log('🎮 TURN INIT: Preserving pending points:', pendingPoints);
    }
    
    updateTurnDisplay();
    updatePendingPointsDisplay();
}

function getCurrentPlayer() {
    return currentPlayerTurn;
}

function isPlayerTurn(playerId) {
    return currentPlayerTurn === playerId;
}

function nextTurn() {
    console.log(`🔄 === nextTurn() START ===`);
    console.log(`🔄 Current state - Player: ${currentPlayerTurn}, Index: ${currentPlayerIndex}, Players: [${turnSystemPlayerList.join(', ')}]`);
    
    if (turnSystemPlayerList.length === 0) {
        console.log(`🔄 No players in list, returning null`);
        return null;
    }
    
    // When ending a turn, clear any pending points (they weren't banked)
    if (pendingPoints > 0) {
        console.log(`Turn ended with ${pendingPoints} unbanked points - they are lost`);
        clearPendingPoints();
    }
    
    const oldPlayerIndex = currentPlayerIndex;
    const oldPlayer = currentPlayerTurn;
    
    // Use Firebase state management instead of local turn tracking
    if (typeof endMyTurn === 'function') {
        console.log('🔄 Using Firebase state management to end turn');
        endMyTurn(); // This will trigger Firebase state updates
        return currentPlayerTurn; // Return current player since Firebase will handle the transition
    } else {
        // Fallback to local turn management if Firebase not available
        currentPlayerIndex = (currentPlayerIndex + 1) % turnSystemPlayerList.length;
        currentPlayerTurn = turnSystemPlayerList[currentPlayerIndex];
        
        console.log(`🔄 Turn advanced from ${oldPlayer} (index ${oldPlayerIndex}) to ${currentPlayerTurn} (index ${currentPlayerIndex})`);
        
        updateTurnDisplay();
        updatePendingPointsDisplay();
        
        // Apply the new player's material preferences
        if (isMultiplayerMode) {
            console.log(`🔄 Applying material preferences for ${currentPlayerTurn}`);
            applyPlayerMaterialPreferences(currentPlayerTurn);
        }
    }
    
    console.log(`🔄 === nextTurn() END ===`);
    return currentPlayerTurn;
}

function savePlayerMaterialPreferences(playerId, diceType, floorType) {
    playerMaterialPreferences[playerId] = {
        dice: diceType,
        floor: floorType,
        timestamp: Date.now()
    };
    
    console.log(`Saved material preferences for ${playerId}: Dice=${diceType}, Floor=${floorType}`);
}

function getPlayerMaterialPreferences(playerId) {
    return playerMaterialPreferences[playerId] || {
        dice: 'default',
        floor: 'grass',
        timestamp: null
    };
}

function applyPlayerMaterialPreferences(playerId) {
    const preferences = getPlayerMaterialPreferences(playerId);
    
    // Only apply if this player has different preferences than current
    if (typeof changeDiceMaterial === 'function' && typeof changeFloorMaterial === 'function') {
        changeDiceMaterial(preferences.dice);
        changeFloorMaterial(preferences.floor);
        console.log(`Applied ${playerId}'s material preferences: Dice=${preferences.dice}, Floor=${preferences.floor}`);
    }
}

function updateTurnDisplay() {
    // NOTE: Farkle indicator clearing is now handled by Firebase state manager 
    // in updateTurnIndicators() when a player's turn actually starts
    
    // Update turn indicators in the player list instead of using alert box
    const playerListContainer = document.getElementById('player-list');
    if (playerListContainer && currentPlayerTurn) {
        const playerList = playerListContainer.querySelector('ul');
        if (playerList) {
            const listItems = playerList.querySelectorAll('li');
            listItems.forEach(li => {
                const playerName = li.getAttribute('data-player-name') || li.querySelector('.player-name-text')?.textContent;
                const turnIndicator = li.querySelector('.turn-indicator');
                const listItem = li;
                
                if (playerName === currentPlayerTurn) {
                    // Show turn indicator for current player
                    if (turnIndicator) {
                        turnIndicator.style.display = 'inline';
                    }
                    // Highlight the current player's list item
                    listItem.classList.add('list-group-item-success');
                    listItem.classList.remove('list-group-item-secondary');
                } else {
                    // Hide turn indicator for other players
                    if (turnIndicator) {
                        turnIndicator.style.display = 'none';
                    }
                    // Remove highlight from other players
                    listItem.classList.remove('list-group-item-success');
                    listItem.classList.add('list-group-item-secondary');
                }
            });
        }
    }
    
    // For single player mode, still show the old alert-style display
    if (!isMultiplayerMode) {
        const turnIndicator = document.getElementById('turn-indicator');
        if (turnIndicator && currentPlayerTurn) {
            let displayText = `Current Turn: ${currentPlayerTurn}`;
            
            // Add pending points to display if any
            if (pendingPoints > 0) {
                displayText += ` (Pending: ${pendingPoints} pts)`;
            }
            
            turnIndicator.textContent = displayText;
            turnIndicator.className = 'alert alert-info';
            turnIndicator.style.display = 'block';
        }
    }
}

// Scoring System Functions
function initializePlayerScores(players) {
    // RESET playerScores to only include current players - this prevents stale data
    playerScores = {};
    
    // Initialize scores for current players only
    players.forEach(playerId => {
        playerScores[playerId] = 0;
    });
    
    // If in multiplayer room, fetch existing scores from Firebase
    if (typeof roomId !== 'undefined' && roomId && typeof database !== 'undefined') {
        const roomRef = database.ref(`rooms/${roomId}/players`);
        
        roomRef.once('value', (snapshot) => {
            const firebasePlayers = snapshot.val();
            if (firebasePlayers) {
                // Update local scores with Firebase scores, but ONLY for current players
                for (const id in firebasePlayers) {
                    const playerName = firebasePlayers[id].name;
                    // Only load scores for players currently in the room
                    if (players.includes(playerName) && playerScores[playerName] !== undefined) {
                        playerScores[playerName] = firebasePlayers[id].score || 0;
                    }
                }
                console.log('Player scores loaded from Firebase (current players only):', playerScores);
                updateScoreDisplayUI(); // Update ONLY the UI with loaded scores (no Firebase write)
            }
        }).catch((error) => {
            console.error('Error loading existing scores from Firebase:', error);
        });
    }
    
    console.log('Player scores initialized:', playerScores);
    
    // Update customize button visibility based on host status
    if (typeof updateCustomizeButtonVisibility === 'function') {
        updateCustomizeButtonVisibility();
    }
}

function addPendingPoints(points, description = '') {
    const oldPendingPoints = pendingPoints;
    pendingPoints += points;
    currentTurnPoints.push({
        points: points,
        description: description,
        timestamp: Date.now()
    });
    
    console.log(`🎲 PENDING POINTS DEBUG: Added ${points} points (${description})`);
    console.log(`🎲 Previous pending: ${oldPendingPoints}, New pending: ${pendingPoints}`);
    console.log(`🎲 Current turn points array:`, currentTurnPoints);
    
    updateTurnDisplay();
    updatePendingPointsDisplay();
}

function clearPendingPoints() {
    const lostPoints = pendingPoints;
    pendingPoints = 0;
    currentTurnPoints = [];
    
    console.log(`Cleared ${lostPoints} pending points (farkle)`);
    updateTurnDisplay();
    updatePendingPointsDisplay();
    
    return lostPoints;
}

function bankPendingPoints(playerId = null) {
    console.log('🏛️ === bankPendingPoints() START ===');
    console.log('🏛️ Input playerId:', playerId);
    console.log('🏛️ currentPlayerTurn:', currentPlayerTurn);
    console.log('🏛️ window.myPlayerId:', window.myPlayerId);
    console.log('🏛️ window.currentPlayerId:', window.currentPlayerId);
    console.log('🏛️ 💰 PENDING POINTS AT BANKING START:', pendingPoints);
    console.log('🏛️ 💰 CURRENT TURN POINTS:', currentTurnPoints);
    
    // CRITICAL FIX: Use Firebase currentPlayerId for multiplayer, fallback to currentPlayerTurn
    if (!playerId) {
        if (typeof window.currentPlayerId !== 'undefined' && window.currentPlayerId) {
            playerId = window.currentPlayerId;
            console.log('🏛️ Using window.currentPlayerId as playerId:', playerId);
        } else {
            playerId = currentPlayerTurn;
            console.log('🏛️ Using currentPlayerTurn as playerId:', playerId);
        }
    }
    
    console.log('🏛️ Final playerId for banking:', playerId);
    
    if (pendingPoints <= 0) {
        console.log('No pending points to bank');
        return 0;
    }

    // Mark as critical operation to prevent connection cleanup during banking
    if (typeof startCriticalOperation === 'function') {
        startCriticalOperation();
    }
    
    const currentPendingPoints = pendingPoints; // Store the current pending points
    
    // Function to complete the banking process
    function completeBanking(existingScore = 0) {
        console.log('🏦 === completeBanking() START ===');
        console.log('🏦 Player ID:', playerId);
        console.log('🏦 Existing score from Firebase:', existingScore);
        console.log('🏦 Current pending points:', currentPendingPoints);
        console.log('🏦 Current playerScores state:', playerScores);
        
        // Initialize player's banked score if not exists, or use existing score from Firebase
        if (!(playerId in playerScores)) {
            playerScores[playerId] = existingScore;
            console.log('🏦 Initialized playerScores for', playerId, 'with', existingScore);
        } else {
            console.log('🏦 Player', playerId, 'already in playerScores with score:', playerScores[playerId]);
        }
        
        // Add pending points to player's banked score
        playerScores[playerId] += currentPendingPoints;
        const newScore = playerScores[playerId];
        
        console.log(`🏦 ${playerId} banked ${currentPendingPoints} points. New total: ${newScore} (was ${existingScore})`);
        
        // Clear pending points
        pendingPoints = 0;
        currentTurnPoints = [];
        
        updateTurnDisplay();
        updatePendingPointsDisplay();
        updateScoreDisplay();

        // Use Firebase state management for banking
        if (typeof handlePlayerBanking === 'function') {
            console.log('🔥 Using Firebase state management for banking');
            console.log('🔥 Calling handlePlayerBanking with:', currentPendingPoints, newScore);
            handlePlayerBanking(currentPendingPoints, newScore);
        } else {
            // End critical operation if Firebase not available
            if (typeof endCriticalOperation === 'function') {
                endCriticalOperation();
            }
        }
        
        return currentPendingPoints;
    }
    
    // Check if in multiplayer room and get existing Firebase score
    if (typeof roomId !== 'undefined' && roomId && typeof database !== 'undefined') {
        // Use Firebase state manager's currentRoomId and currentPlayerId if available
        const firebaseRoomId = (typeof currentRoomId !== 'undefined' && currentRoomId) ? currentRoomId : roomId;
        const firebasePlayerId = (typeof currentPlayerId !== 'undefined' && currentPlayerId) ? currentPlayerId : null;
        
        if (firebasePlayerId) {
            // Direct lookup using Firebase player ID
            const playerRef = database.ref(`rooms/${firebaseRoomId}/players/${firebasePlayerId}`);
            
            console.log('🔍 Banking: Direct Firebase lookup');
            console.log('🔍 Room:', firebaseRoomId);
            console.log('🔍 Player ID:', firebasePlayerId);
            console.log('🔍 Firebase path:', `rooms/${firebaseRoomId}/players/${firebasePlayerId}`);
            
            playerRef.once('value', (snapshot) => {
                const player = snapshot.val();
                const existingScore = player ? (player.score || 0) : 0;
                
                console.log('🔥 Found existing score for', firebasePlayerId, ':', existingScore);
                console.log('🔥 Player data:', player);
                completeBanking(existingScore);
            }).catch((error) => {
                console.error('Error fetching existing score:', error);
                // Continue with banking even if Firebase read fails
                completeBanking(0);
            });
        } else {
            // Fallback: search by player name (original logic)
            const roomRef = database.ref(`rooms/${firebaseRoomId}/players`);
            
            roomRef.once('value', (snapshot) => {
                const players = snapshot.val();
                let existingScore = 0;
                
                if (players) {
                    // Find the current player's existing score in Firebase
                    for (const id in players) {
                        if (players[id].name === playerId) {
                            existingScore = players[id].score || 0;
                            console.log(`🔍 Found score by name search for ${playerId}: ${existingScore}`);
                            break;
                        }
                    }
                }
                
                completeBanking(existingScore);
            }).catch((error) => {
                console.error('Error fetching existing score:', error);
                // Continue with banking even if Firebase read fails
                completeBanking(0);
            });
        }
        
        return currentPendingPoints; // Return immediately for async call
    } else {
        // Single player mode or no Firebase - just complete the banking
        return completeBanking(0);
    }
}

function getPendingPoints() {
    return pendingPoints;
}

function getCurrentTurnPoints() {
    return [...currentTurnPoints];
}

function getPlayerScore(playerId) {
    return playerScores[playerId] || 0;
}

function getAllPlayerScores() {
    return { ...playerScores };
}

function updatePendingPointsDisplay() {
    // Create or update pending points display
    let pendingDisplay = document.getElementById('pending-points-display');
    
    if (!pendingDisplay) {
        // Create the display element if it doesn't exist
        pendingDisplay = document.createElement('div');
        pendingDisplay.id = 'pending-points-display';
        pendingDisplay.className = 'alert alert-warning mt-2';
        pendingDisplay.style.display = 'none';
        
        // Insert after turn indicator
        const turnIndicator = document.getElementById('turn-indicator');
        if (turnIndicator && turnIndicator.parentNode) {
            turnIndicator.parentNode.insertBefore(pendingDisplay, turnIndicator.nextSibling);
        }
    }
    
    if (pendingPoints > 0) {
        let displayText = `Pending Points: ${pendingPoints}`;
        
        // Show breakdown of points earned this turn
        if (currentTurnPoints.length > 0) {
            const breakdown = currentTurnPoints.map(entry => 
                `${entry.points}${entry.description ? ` (${entry.description})` : ''}`
            ).join(' + ');
            displayText += `<br><small>This turn: ${breakdown}</small>`;
        }
        
        pendingDisplay.innerHTML = displayText;
        pendingDisplay.style.display = 'block';
    } else {
        pendingDisplay.style.display = 'none';
    }
}

function updateScoreDisplayUI() {
    // Update player scores ONLY in the UI (no Firebase writes)
    console.log('🎯 Updating UI with player scores:', playerScores);
    
    // Update local player list badges (both Firebase and WebRTC)
    const playerListContainer = document.getElementById('player-list');
    if (playerListContainer) {
        const playerList = playerListContainer.querySelector('ul');
        if (playerList) {
            const listItems = playerList.querySelectorAll('li');
            listItems.forEach(li => {
                // Get player name from data attribute or text content
                const playerName = li.getAttribute('data-player-name') || li.querySelector('.player-name-text')?.textContent;
                const scoreBadge = li.querySelector('.badge.bg-primary');
                
                if (scoreBadge && playerName && playerScores[playerName] !== undefined) {
                    scoreBadge.textContent = playerScores[playerName];
                    console.log(`🎯 UI updated for ${playerName}: ${playerScores[playerName]}`);
                }
            });
        }
    }
}

function updateScoreDisplay() {
    // Update player scores in the player list
    console.log('🔄 === updateScoreDisplay() START ===');
    console.log('🔄 Current playerScores:', playerScores);
    
    // First update the UI
    updateScoreDisplayUI();
    
    // Then update Firebase database with new scores for multiplayer rooms
    if (typeof roomId !== 'undefined' && roomId && typeof database !== 'undefined') {
        console.log('🔄 Updating Firebase with local scores...');
        const roomRef = database.ref(`rooms/${roomId}/players`);
        
        // Get current players and update their scores
        roomRef.once('value', (snapshot) => {
            const players = snapshot.val();
            console.log('🔄 Firebase players from DB:', players);
            
            if (players) {
                const updates = {};
                
                for (const playerId in players) {
                    const playerName = players[playerId].name;
                    console.log(`🔄 Processing Firebase player ID: ${playerId}, name: ${playerName}`);
                    
                    if (playerScores[playerName] !== undefined) {
                        console.log(`🔄 Will update ${playerId}/${playerName} score: ${playerScores[playerName]}`);
                        // Set the score in Firebase to match our local playerScores
                        updates[`${playerId}/score`] = playerScores[playerName];
                    } else {
                        console.log(`🔄 Skipping ${playerId}/${playerName} - not in local playerScores`);
                    }
                }
                
                console.log('🔄 Final Firebase updates to apply:', updates);
                
                // Apply all updates at once
                if (Object.keys(updates).length > 0) {
                    roomRef.update(updates).then(() => {
                        console.log('🔄 Firebase scores updated successfully');
                    }).catch((error) => {
                        console.error('🔄 Error updating Firebase scores:', error);
                    });
                } else {
                    console.log('🔄 No Firebase updates needed');
                }
            }
        });
    } else {
        console.log('🔄 No Firebase room found - UI only update');
    }
    
    console.log('🔄 === updateScoreDisplay() END ===');
}

// Integration functions for WebRTC system
function onRoomJoined(roomId, playerId, playerList) {
    console.log(`Room joined: ${roomId}, Player: ${playerId}`);
    
    // Initialize multiplayer turn system
    if (typeof initializeMultiplayerMode === 'function') {
        initializeMultiplayerMode(roomId, playerId, playerList);
    }
}

function onPlayerJoined(playerId, updatedPlayerList) {
    console.log(`Player joined: ${playerId}`);
    
    // Update player list but preserve the current turn
    if (typeof initializeTurnSystem === 'function') {
        initializeTurnSystem(updatedPlayerList, true, true); // Third parameter preserves current turn
        updateGameControlsState();
    }
}

function onPlayerLeft(playerId, updatedPlayerList) {
    console.log(`Player left: ${playerId}`);
    
    // Update player list and reinitialize turn system
    if (typeof initializeTurnSystem === 'function') {
        initializeTurnSystem(updatedPlayerList, true, true); // Preserve current turn and pending points
        updateGameControlsState();
    }
}

function onRoomLeft() {
    console.log('Left multiplayer room');
    
    // Return to single player mode
    if (typeof exitMultiplayerMode === 'function') {
        exitMultiplayerMode();
    }
}

// Message handlers for turn synchronization
function onTurnChangeReceived(data) {
    console.log(`📨 === onTurnChangeReceived() START ===`);
    console.log(`📨 Received data:`, data);
    
    const { currentPlayer, playerList } = data;
    
    console.log(`� Turn change: ${currentPlayerTurn} → ${currentPlayer}`);
    console.log(`📨 My player ID: ${typeof myPlayerId !== 'undefined' ? myPlayerId : 'undefined'}`);
    console.log(`📨 Is multiplayer room: ${typeof isInMultiplayerRoom !== 'undefined' ? isInMultiplayerRoom : 'undefined'}`);
    
    // Update local turn state without advancing (since it was advanced remotely)
    const oldPlayer = currentPlayerTurn;
    currentPlayerTurn = currentPlayer;
    console.log(`✅ Updated current player to: ${currentPlayerTurn}`);
    
    // Update displays and controls
    updateTurnDisplay();
    
    // Call updateGameControlsState if it exists
    if (typeof updateGameControlsState === 'function') {
        updateGameControlsState();
        console.log('✅ Called updateGameControlsState');
        
        // Log the player list state after update
        const playerListContainer = document.getElementById('player-list');
        if (playerListContainer) {
            const activePlayer = playerListContainer.querySelector('.list-group-item-success .player-name-text');
            const activeTurnIndicator = playerListContainer.querySelector('.turn-indicator[style*="inline"]');
            console.log(`🎯 Player list after update: active player="${activePlayer?.textContent || 'none'}", turn indicator visible="${!!activeTurnIndicator}"`);
        } else {
            console.warn('❌ Player list container not found');
        }
    } else {
        console.warn('❌ updateGameControlsState function not available');
    }
    
    // Clear other players' dice results when it becomes your turn
    if (typeof canPlayerAct === 'function' && canPlayerAct() && typeof myPlayerId !== 'undefined' && currentPlayer === myPlayerId) {
        console.log('🎲 It\'s now my turn - clearing dice display');
        const diceResultsContainer = document.getElementById('dice-results-container');
        if (diceResultsContainer) {
            diceResultsContainer.innerHTML = '<p class="text-muted">Click "Roll" to start your turn</p>';
            // Hide dice selection controls when showing turn start message
            const diceSelectionControls = document.getElementById('dice-selection-controls');
            if (diceSelectionControls) {
                diceSelectionControls.style.display = 'none';
            }
            // Hide instruction text when showing turn start message
            if (typeof updateInstructionTextVisibility === 'function') {
                updateInstructionTextVisibility(false);
            }
        }
    } else {
        console.log('⏳ Not my turn yet, waiting...');
    }
    
    // Apply the new player's material preferences
    if (typeof isInMultiplayerRoom !== 'undefined' && isInMultiplayerRoom && typeof applyPlayerMaterialPreferences === 'function') {
        console.log(`📨 Applying material preferences for ${currentPlayer}`);
        applyPlayerMaterialPreferences(currentPlayer);
    }
    
    console.log(`📨 === onTurnChangeReceived() END ===`);
}

function onMaterialChangeReceived(data) {
    const { playerId, diceType, floorType } = data;
    
    console.log(`Received material change from ${playerId}: Dice=${diceType}, Floor=${floorType}`);
    
    // Save the player's preferences
    if (typeof savePlayerMaterialPreferences === 'function') {
        savePlayerMaterialPreferences(playerId, diceType, floorType);
    }
    
    // Apply if it's this player's turn
    if (getCurrentPlayer() === playerId) {
        if (typeof changeDiceMaterial === 'function' && typeof changeFloorMaterial === 'function') {
            changeDiceMaterial(diceType);
            changeFloorMaterial(floorType);
        }
    }
}

// Enhanced broadcasting functions
function broadcastTurnChange(nextPlayerId) {
    // Turn changes are now handled entirely by Firebase state management
    // This function is kept for compatibility but does nothing
    console.log(`📡 Turn change broadcasting handled by Firebase for: ${nextPlayerId}`);
}

function broadcastMaterialChange(playerId, diceType, floorType) {
    // Use Firebase for material change broadcasting
    if (typeof window.broadcastMaterialChange === 'function') {
        window.broadcastMaterialChange(playerId, diceType, floorType);
    } else {
        console.error('❌ Firebase broadcastMaterialChange function not available');
    }
    
    console.log(`Broadcasting material change: ${playerId} -> Dice=${diceType}, Floor=${floorType}`);
}

function onDiceResultsReceived(data) {
    const { playerId, diceResults } = data;
    
    console.log(`Received dice results from ${playerId}:`, diceResults);
    
    // Only show other players' results if it's not our turn
    const isMyTurn = typeof canPlayerAct === 'function' ? canPlayerAct() : false;
    
    if (!isMyTurn && playerId !== (typeof myPlayerId !== 'undefined' ? myPlayerId : null)) {
        // Update the dice display to show the other player's results
        if (typeof displayOtherPlayerResults === 'function') {
            displayOtherPlayerResults(playerId, diceResults);
        } else {
            // Fallback: update the dice results container with a simple display
            const diceResultsContainer = document.getElementById('dice-results-container');
            if (diceResultsContainer) {
                diceResultsContainer.innerHTML = `
                    <div class="alert alert-info w-100 text-center">
                        <strong>${playerId}</strong> rolled: ${diceResults.join(', ')}
                    </div>
                `;
            }
        }
    }
}

// Export functions for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        // Core turn system functions
        initializeTurnSystem,
        getCurrentPlayer,
        isPlayerTurn,
        nextTurn,
        savePlayerMaterialPreferences,
        getPlayerMaterialPreferences,
        applyPlayerMaterialPreferences,
        updateTurnDisplay,
        // Scoring system functions
        initializePlayerScores,
        addPendingPoints,
        clearPendingPoints,
        bankPendingPoints,
        getPendingPoints,
        getCurrentTurnPoints,
        getPlayerScore,
        getAllPlayerScores,
        updatePendingPointsDisplay,
        updateScoreDisplay,
        updateScoreDisplayUI,
        // WebRTC integration functions
        onRoomJoined,
        onPlayerJoined,
        onPlayerLeft,
        onRoomLeft,
        onTurnChangeReceived,
        onMaterialChangeReceived,
        broadcastTurnChange,
        broadcastMaterialChange,
        broadcastDiceResults,
        onDiceResultsReceived
    };
}
