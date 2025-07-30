// Firebase-based State Management for Multiplayer Farkle
// This replaces WebRTC peer-to-peer coordination with Firebase real-time state updates

// Player state constants
const PLAYER_STATES = {
    WAITING: 'waiting',       // Player is waiting for their turn
    ROLLING: 'rolling',       // Player is actively taking their turn
    ENDED_TURN: 'ended_turn'  // Player has finished their turn
};

// Firebase State Manager
// This file handles Firebase-based multiplayer state management

// Show dice rolling UI when player is in rolling state
function showDiceRollingUI() {
    console.log('🎲 Showing dice rolling UI - player is rolling');
    
    // NOTE: Farkle indicator clearing is now handled in updateTurnIndicators()
    // This ensures only the current player's indicator is cleared, not the previous player's
    
    // Show roll dice button
    const rollButton = document.getElementById('roll-dice');
    if (rollButton) {
        rollButton.style.display = 'block';
        rollButton.disabled = false;
    }
}

/*
 * Firebase integration for multiplayer game state management
 */

// Game state management variables
let currentRoomId = null;
let currentPlayerId = null;
let currentPlayerName = null;
let gameStateListener = null;
let playersStateListener = null;
let diceResultsListener = null;
let materialChangesListener = null;
let farkleStatesListener = null;

// Persistent Farkle indicator state for all players
let farkleIndicatorStates = {};

// Helper functions for managing Farkle indicator states
function setFarkleIndicatorState(playerId, isVisible) {
    farkleIndicatorStates[playerId] = isVisible;
    console.log(`💾 Farkle indicator state set for ${playerId}: ${isVisible}`);
}

function getFarkleIndicatorState(playerId) {
    return farkleIndicatorStates[playerId] || false;
}

function initializeFarkleStatesForPlayers(players) {
    Object.keys(players).forEach(playerId => {
        if (!(playerId in farkleIndicatorStates)) {
            farkleIndicatorStates[playerId] = false;
        }
    });
    console.log('💾 Farkle indicator states initialized:', farkleIndicatorStates);
}

// Function to be called when a player Farkles
function handlePlayerFarkle(playerId) {
    console.log(`⚠️ Player ${playerId} Farkled - setting persistent state`);
    setFarkleIndicatorState(playerId, true);
    
    // Save Farkle state to Firebase for synchronization across all players
    if (currentRoomId && database) {
        const farkleStateRef = database.ref(`rooms/${currentRoomId}/farkleStates/${playerId}`);
        farkleStateRef.set({
            isFarkled: true,
            timestamp: Date.now()
        }).then(() => {
            console.log(`💾 Farkle state saved to Firebase for ${playerId}`);
        }).catch((error) => {
            console.error(`❌ Error saving Farkle state to Firebase for ${playerId}:`, error);
        });
    }
    
    // Also call the existing showFarkleIndicator function
    if (typeof showFarkleIndicator === 'function') {
        showFarkleIndicator(playerId);
    }
}

// Initialize Firebase state management
function initializeFirebaseStateManager(roomId, playerId, playerName) {
    console.log('🔥 Initializing Firebase State Manager');
    console.log('🔥 Room:', roomId, 'Player:', playerId, 'Name:', playerName);
    
    currentRoomId = roomId;
    currentPlayerId = playerId;
    currentPlayerName = playerName;
    
    if (!database) {
        console.error('❌ Firebase database not initialized');
        return false;
    }
    
    // Set up state listeners
    setupGameStateListener();
    setupPlayersStateListener();
    setupDiceResultsListener();
    setupMaterialChangesListener();
    setupFarkleStatesListener();
    
    // Initialize player state and mark as connected
    setPlayerState(PLAYER_STATES.WAITING);
    markPlayerAsConnected(true);
    
    // Set up automatic disconnection handling
    setupDisconnectionHandling();
    
    return true;
}

// Set up listener for overall game state changes
function setupGameStateListener() {
    if (!currentRoomId) return;
    
    const gameStateRef = database.ref(`rooms/${currentRoomId}/gameState`);
    
    gameStateListener = gameStateRef.on('value', (snapshot) => {
        const gameState = snapshot.val();
        console.log('🔥 Game state updated:', gameState);
        
        if (gameState) {
            handleGameStateChange(gameState);
        }
    });
}

// Set up listener for all players' state changes
function setupPlayersStateListener() {
    if (!currentRoomId) return;
    
    const playersRef = database.ref(`rooms/${currentRoomId}/players`);
    
    playersStateListener = playersRef.on('value', (snapshot) => {
        const players = snapshot.val();
        console.log('🔥 Players state updated:', players);
        
        if (players) {
            handlePlayersStateChange(players);
        }
    });
}

// Handle changes to overall game state
function handleGameStateChange(gameState) {
    const { currentTurn, turnStartTime, gamePhase } = gameState;
    
    console.log('🎮 Game state change:', {
        currentTurn,
        turnStartTime,
        gamePhase,
        isMyTurn: currentTurn === currentPlayerId
    });
    
    // Set the Firebase current turn player for the isPlayerTurn function
    window.firebaseCurrentTurnPlayer = currentTurn;
    console.log('🔥 Set Firebase current turn player to:', currentTurn);
    
    // Update turn indicators in the UI
    updateTurnIndicators(currentTurn);
    
    // Update game controls based on whose turn it is
    if (typeof updateGameControlsState === 'function') {
        console.log('🔥 Calling updateGameControlsState() after Firebase state change');
        updateGameControlsState();
    }
    
    // Show appropriate messages
    if (currentTurn === currentPlayerId) {
        console.log('🎮 It\'s my turn - enabling controls');
        // Hide waiting message if visible
        const waitingMessage = document.getElementById('waiting-message');
        if (waitingMessage) {
            waitingMessage.style.display = 'none';
        }
    } else {
        console.log('🎮 Not my turn - showing waiting message');
        if (typeof showWaitingForTurnMessage === 'function') {
            showWaitingForTurnMessage();
        }
    }
}

// Handle changes to individual player states
function handlePlayersStateChange(players) {
    const playerList = Object.keys(players);
    const currentTurnPlayer = getCurrentTurnPlayer(players);
    const myState = players[currentPlayerId]?.state;
    
    // Initialize Farkle indicator states for all players
    initializeFarkleStatesForPlayers(players);
    
    // Check if it's my turn using multiple methods for reliability
    const firebaseIsMyTurn = window.firebaseCurrentTurnPlayer === currentPlayerId;
    const canActResult = typeof canPlayerAct === 'function' ? canPlayerAct() : false;
    const isMyTurn = firebaseIsMyTurn || canActResult || currentTurnPlayer === currentPlayerId;
    
    console.log('👥 Players state analysis:', {
        totalPlayers: playerList.length,
        currentTurnPlayer,
        myState,
        firebaseCurrentTurnPlayer: window.firebaseCurrentTurnPlayer,
        firebaseIsMyTurn,
        canActResult,
        isMyTurn
    });
    
    // Update player list UI
    updatePlayerListUI(players);
    
    // Show/hide dice rolling UI based on whether it's my turn
    if (isMyTurn) {
        // It's my turn - show the dice rolling UI
        console.log('🎲 Showing dice UI - it\'s my turn');
        showDiceRollingUI();
    } else {
        // Not my turn - hide the dice rolling UI but show waiting message
        console.log('🎲 Not my turn - showing waiting state');
        hideDiceRollingUI();
        
        // Show waiting message if not my turn
        if (currentPlayerId) {
            if (typeof showWaitingForTurnMessage === 'function') {
                showWaitingForTurnMessage();
            }
        }
    }
    
    // Check if we need to advance the turn
    checkAndAdvanceTurn(players);
    
    // Initialize turn system if needed (only for connected players)
    if (typeof initializeTurnSystem === 'function') {
        const connectedPlayers = Object.keys(players).filter(playerId => players[playerId].isConnected !== false);
        const connectedPlayerNames = connectedPlayers.map(id => players[id].name);
        console.log('🔌 Initializing turn system for connected players:', connectedPlayerNames);
        initializeTurnSystem(connectedPlayerNames, true, true);
    }
    
    // Update game controls after player state changes
    if (typeof updateGameControlsState === 'function') {
        console.log('🔥 Calling updateGameControlsState() after player state change');
        updateGameControlsState();
    }
}

// Update the visual player list with state indicators
function updatePlayerListUI(players) {
    const playerListElement = document.querySelector('#player-list ul');
    if (!playerListElement) return;
    
    // Filter to only show connected players
    const connectedPlayers = {};
    Object.keys(players).forEach(playerId => {
        const player = players[playerId];
        // Show player if isConnected is true or undefined (for backward compatibility)
        if (player.isConnected !== false) {
            connectedPlayers[playerId] = player;
        }
    });
    
    console.log('🔌 Filtering players - Total:', Object.keys(players).length, 'Connected:', Object.keys(connectedPlayers).length);
    
    // No need to extract states from DOM - we have persistent state
    console.log('💾 Current Farkle states before recreation:', farkleIndicatorStates);
    
    // Clear existing list
    playerListElement.innerHTML = '';
    
    Object.keys(connectedPlayers).forEach(playerId => {
        const player = connectedPlayers[playerId];
        const li = document.createElement('li');
        li.className = 'list-group-item d-flex justify-content-between align-items-center';
        li.setAttribute('data-player-id', playerId);
        li.setAttribute('data-player-name', player.name);
        
        // Create player name container
        const playerNameContainer = document.createElement('div');
        playerNameContainer.className = 'd-flex align-items-center';
        
        // Player name
        const playerNameSpan = document.createElement('span');
        playerNameSpan.className = 'player-name-text';
        playerNameSpan.textContent = player.name;
        playerNameContainer.appendChild(playerNameSpan);
        
        // State indicator
        const stateIndicator = document.createElement('span');
        stateIndicator.className = 'state-indicator badge ms-2';
        
        switch (player.state) {
            case PLAYER_STATES.ROLLING:
                stateIndicator.classList.add('bg-success');
                stateIndicator.textContent = '🎲 Rolling';
                break;
            case PLAYER_STATES.ENDED_TURN:
                stateIndicator.classList.add('bg-warning', 'text-dark');
                stateIndicator.textContent = '✅ Finished';
                break;
            case PLAYER_STATES.WAITING:
            default:
                stateIndicator.classList.add('bg-secondary');
                stateIndicator.textContent = '⏳ Waiting';
                break;
        }
        playerNameContainer.appendChild(stateIndicator);
        
        // Create Farkle indicator using persistent state
        const farkleIndicator = document.createElement('span');
        farkleIndicator.className = 'farkle-indicator ms-2';
        farkleIndicator.textContent = '⚠️';
        farkleIndicator.title = 'This player just Farkled!';
        
        // Use persistent state to determine visibility
        const shouldShowFarkle = getFarkleIndicatorState(playerId);
        if (shouldShowFarkle) {
            farkleIndicator.style.display = 'inline';
            console.log(`🔄 Restored Farkle indicator for ${playerId} from persistent state`);
        } else {
            farkleIndicator.style.display = 'none';
            console.log(`🚫 No Farkle indicator for ${playerId} (persistent state: false)`);
        }
        playerNameContainer.appendChild(farkleIndicator);
        
        // Host badge
        if (player.isHost) {
            const hostBadge = document.createElement('span');
            hostBadge.className = 'host-badge ms-1';
            hostBadge.textContent = '👑';
            hostBadge.title = 'Room Host';
            playerNameContainer.appendChild(hostBadge);
        }
        
        // Score badge
        const scoreBadge = document.createElement('span');
        scoreBadge.className = 'badge bg-primary rounded-pill';
        scoreBadge.textContent = player.score || 0;
        
        li.appendChild(playerNameContainer);
        li.appendChild(scoreBadge);
        playerListElement.appendChild(li);
    });
}

// Find who should have the current turn based on player states
function getCurrentTurnPlayer(players) {
    // Filter to only consider connected players
    const connectedPlayers = {};
    Object.keys(players).forEach(playerId => {
        const player = players[playerId];
        if (player.isConnected !== false) {
            connectedPlayers[playerId] = player;
        }
    });
    
    // First, check if anyone is currently rolling
    for (const playerId in connectedPlayers) {
        if (connectedPlayers[playerId].state === PLAYER_STATES.ROLLING) {
            return playerId;
        }
    }
    
    // If no one is rolling, find the next player who should go
    // (this handles turn advancement logic)
    const playerIds = Object.keys(connectedPlayers);
    
    // Simple round-robin: find first player in waiting state
    // In a more complex implementation, you'd track turn order
    for (const playerId of playerIds) {
        if (connectedPlayers[playerId].state === PLAYER_STATES.WAITING) {
            return playerId;
        }
    }
    
    // If all connected players are in ended_turn state, let checkAndAdvanceTurn handle it
    if (playerIds.every(id => connectedPlayers[id].state === PLAYER_STATES.ENDED_TURN)) {
        return null; // checkAndAdvanceTurn will handle the new round logic
    }
    
    return null;
}

// Check if turn should advance and do so if needed
function checkAndAdvanceTurn(players) {
    // Filter to only consider connected players
    const connectedPlayers = {};
    Object.keys(players).forEach(playerId => {
        const player = players[playerId];
        if (player.isConnected !== false) {
            connectedPlayers[playerId] = player;
        }
    });
    
    const currentTurnPlayer = getCurrentTurnPlayer(players);
    
    // Check if all connected players are waiting (ready for next turn)
    const connectedPlayerStates = Object.values(connectedPlayers).map(p => p.state);
    const allConnectedPlayersWaiting = connectedPlayerStates.every(state => state === PLAYER_STATES.WAITING);
    const allConnectedPlayersEnded = connectedPlayerStates.every(state => state === PLAYER_STATES.ENDED_TURN);
    const hasMultipleConnectedPlayers = Object.keys(connectedPlayers).length > 1;
    
    console.log('🔄 Turn advancement check:', {
        totalPlayers: Object.keys(players).length,
        connectedPlayers: Object.keys(connectedPlayers).length,
        allConnectedPlayersWaiting,
        allConnectedPlayersEnded,
        hasMultipleConnectedPlayers,
        currentTurnPlayer,
        connectedPlayerStates
    });
    
    // Special case: If all connected players have ended their turn, start a new round
    if (allConnectedPlayersEnded && hasMultipleConnectedPlayers) {
        console.log('🔄 All connected players have ended their turns - starting new round');
        
        // Clear any existing timeout
        if (window.autoTurnTimeout) {
            clearTimeout(window.autoTurnTimeout);
        }
        
        // Set timeout to start new round after 2 seconds
        window.autoTurnTimeout = setTimeout(() => {
            const connectedPlayerIds = Object.keys(connectedPlayers);
            const firstPlayer = connectedPlayerIds[0]; // First connected player in the list
            
            console.log('🎮 Starting new round - first connected player:', firstPlayer);
            
            // Set all connected players to waiting state
            const updates = {};
            connectedPlayerIds.forEach(playerId => {
                updates[`players/${playerId}/state`] = PLAYER_STATES.WAITING;
                updates[`players/${playerId}/stateTimestamp`] = Date.now();
            });
            
            // Set first connected player to rolling state
            updates[`players/${firstPlayer}/state`] = PLAYER_STATES.ROLLING;
            
            // Update game state to set first connected player as current turn
            updates[`gameState/currentTurn`] = firstPlayer;
            updates[`gameState/turnStartTime`] = Date.now();
            
            // Apply all updates to Firebase
            database.ref(`rooms/${currentRoomId}`).update(updates).then(() => {
                console.log('🎮 New round started - first connected player:', firstPlayer);
            });
        }, 2000);
        
        return; // Don't do normal turn advancement
    }
    
    // If all connected players are waiting and we have multiple connected players, auto-start next turn
    if (allConnectedPlayersWaiting && hasMultipleConnectedPlayers) {
        console.log('🕐 All connected players waiting - auto-starting next turn in 2 seconds');
        
        // Clear any existing timeout
        if (window.autoTurnTimeout) {
            clearTimeout(window.autoTurnTimeout);
        }
        
        // Set timeout to start next turn after 2 seconds
        window.autoTurnTimeout = setTimeout(() => {
            // Determine the host among connected players (they go first when all are waiting)
            const connectedHostPlayer = Object.keys(connectedPlayers).find(playerId => connectedPlayers[playerId].isHost);
            const nextPlayer = connectedHostPlayer || Object.keys(connectedPlayers)[0];
            
            console.log('🎮 Auto-starting turn for connected host:', nextPlayer);
            
            // Update game state to set the connected host as current turn
            const gameStateRef = database.ref(`rooms/${currentRoomId}/gameState`);
            gameStateRef.update({
                currentTurn: nextPlayer,
                turnStartTime: Date.now()
            }).then(() => {
                console.log('🎮 Auto-turn started for:', nextPlayer);
                
                // Set the connected host to rolling state
                setPlayerState(PLAYER_STATES.ROLLING, nextPlayer);
            });
        }, 2000);
        
        return; // Don't do normal turn advancement
    }
    
    // Clear auto-turn timeout if not all players are waiting
    if (window.autoTurnTimeout) {
        clearTimeout(window.autoTurnTimeout);
        window.autoTurnTimeout = null;
    }
    
    // Normal turn advancement logic
    const gameStateRef = database.ref(`rooms/${currentRoomId}/gameState`);
    gameStateRef.once('value', (snapshot) => {
        const gameState = snapshot.val() || {};
        const currentGameTurn = gameState.currentTurn;
        
        // If the current turn player is different from what's in game state, update it
        if (currentTurnPlayer && currentTurnPlayer !== currentGameTurn) {
            console.log('🔄 Advancing turn from', currentGameTurn, 'to', currentTurnPlayer);
            
            // Update game state
            const updates = {
                currentTurn: currentTurnPlayer,
                turnStartTime: Date.now()
            };
            
            database.ref(`rooms/${currentRoomId}/gameState`).update(updates).then(() => {
                console.log('🔄 Turn advanced in Firebase, triggering UI update');
                
                // Set the Firebase current turn player
                window.firebaseCurrentTurnPlayer = currentTurnPlayer;
                
                // Trigger UI update
                if (typeof updateGameControlsState === 'function') {
                    updateGameControlsState();
                }
            });
            
            // Set the new current player to rolling state
            setPlayerState(PLAYER_STATES.ROLLING, currentTurnPlayer);
        }
    });
}

// Update turn indicators in the UI
function updateTurnIndicators(currentTurnPlayerId) {
    // Clear Farkle indicator ONLY for the current player whose turn is starting
    // This ensures the player's Farkle indicator clears when THEIR next turn begins
    if (currentTurnPlayerId) {
        console.log(`🔄 Clearing Farkle indicator for ${currentTurnPlayerId} as their turn starts`);
        setFarkleIndicatorState(currentTurnPlayerId, false);
        
        // Clear Farkle state from Firebase
        if (currentRoomId && database) {
            const farkleStateRef = database.ref(`rooms/${currentRoomId}/farkleStates/${currentTurnPlayerId}`);
            farkleStateRef.remove().then(() => {
                console.log(`💾 Farkle state cleared from Firebase for ${currentTurnPlayerId}`);
            }).catch((error) => {
                console.error(`❌ Error clearing Farkle state from Firebase for ${currentTurnPlayerId}:`, error);
            });
        }
        
        // Also update the DOM element if it exists
        if (typeof hideFarkleIndicator === 'function') {
            hideFarkleIndicator(currentTurnPlayerId);
        }
    }
}

// Show dice rolling UI when player is in rolling state
function showDiceRollingUI() {
    console.log('� Showing dice rolling UI - player is rolling');
    
    // Show roll dice button
    const rollButton = document.getElementById('roll-dice');
    if (rollButton) {
        rollButton.style.display = 'block';
        rollButton.disabled = false;
    }
    
    // Show energy slider
    const energySliderContainer = document.getElementById('energy-slider-container');
    if (energySliderContainer) {
        energySliderContainer.style.display = 'block';
    }
    
    // Show dice canvas
    const canvas = document.getElementById('dice-canvas');
    if (canvas) {
        // Keep canvas hidden by default - admin toggle controls visibility
        canvas.style.pointerEvents = 'auto';
        canvas.style.opacity = '1';
    }
    
    // Hide waiting message
    const waitingMessage = document.getElementById('waiting-message');
    if (waitingMessage) {
        waitingMessage.style.display = 'none';
    }
    
    // Update game UI
    if (typeof updateGameControlsState === 'function') {
        updateGameControlsState();
    }
}

// Hide dice rolling UI when player is not in rolling state
function hideDiceRollingUI() {
    console.log('� Hiding dice rolling UI - player not rolling');
    
    // Disable roll dice button but keep it visible (don't hide it completely)
    const rollButton = document.getElementById('roll-dice');
    if (rollButton) {
        rollButton.disabled = true;
        // Don't hide the button - just disable it so players can see it
    }
    
    // Hide energy slider
    const energySliderContainer = document.getElementById('energy-slider-container');
    if (energySliderContainer) {
        energySliderContainer.style.display = 'none';
    }
    
    // Disable dice canvas interaction but keep display controlled by admin toggle
    const canvas = document.getElementById('dice-canvas');
    if (canvas) {
        canvas.style.pointerEvents = 'none';
        canvas.style.opacity = '0.5';
        // Don't change display property - let admin toggle control visibility
    }
    
    // Hide dice selection controls if visible
    const diceSelectionControls = document.getElementById('dice-selection-controls');
    if (diceSelectionControls) {
        diceSelectionControls.style.display = 'none';
    }
    
    // Update game UI
    if (typeof updateGameControlsState === 'function') {
        updateGameControlsState();
    }
}

// Enable player controls for their turn (legacy function - now calls showDiceRollingUI)
function enablePlayerControls() {
    console.log('🎮 Enabling player controls - it\'s my turn!');
    showDiceRollingUI();
}

// Disable player controls when not their turn (legacy function - now calls hideDiceRollingUI)
function disablePlayerControls() {
    console.log('🎮 Disabling player controls - not my turn');
    hideDiceRollingUI();
}

// Set the current player's state
function setPlayerState(state, playerId = null) {
    if (!currentRoomId) {
        console.error('❌ Cannot set player state: no room ID');
        return;
    }
    
    const targetPlayerId = playerId || currentPlayerId;
    if (!targetPlayerId) {
        console.error('❌ Cannot set player state: no player ID');
        return;
    }
    
    console.log(`🔥 Setting player ${targetPlayerId} state to:`, state);
    
    const playerRef = database.ref(`rooms/${currentRoomId}/players/${targetPlayerId}`);
    playerRef.update({
        state: state,
        stateTimestamp: Date.now()
    }).then(() => {
        console.log(`✅ Player state updated to: ${state}`);
    }).catch((error) => {
        console.error('❌ Error updating player state:', error);
    });
}

// Mark player as connected or disconnected
function markPlayerAsConnected(isConnected, playerId = null) {
    if (!currentRoomId) {
        console.error('❌ Cannot update connection status: no room ID');
        return;
    }
    
    const targetPlayerId = playerId || currentPlayerId;
    if (!targetPlayerId) {
        console.error('❌ Cannot update connection status: no player ID');
        return;
    }
    
    console.log(`🔌 Setting player ${targetPlayerId} connection status to:`, isConnected);
    
    const playerRef = database.ref(`rooms/${currentRoomId}/players/${targetPlayerId}`);
    playerRef.update({
        isConnected: isConnected,
        lastConnectionUpdate: Date.now()
    }).then(() => {
        console.log(`✅ Player connection status updated: ${isConnected}`);
    }).catch((error) => {
        console.error('❌ Error updating connection status:', error);
    });
}

// Set up automatic disconnection handling
function setupDisconnectionHandling() {
    // Handle page unload (refresh, close tab, navigate away)
    window.addEventListener('beforeunload', () => {
        console.log('🔌 Page unloading - marking player as disconnected');
        if (currentPlayerId) {
            markPlayerAsConnected(false);
        }
    });
    
    // Handle browser/tab visibility changes
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            console.log('🔌 Page hidden - player may be disconnecting');
        } else {
            console.log('🔌 Page visible - marking player as connected');
            if (currentPlayerId) {
                markPlayerAsConnected(true);
            }
        }
    });
    
    console.log('🔌 Disconnection handling set up');
}

// Start the current player's turn
function startMyTurn() {
    console.log('🎯 Starting my turn');
    setPlayerState(PLAYER_STATES.ROLLING);
    
    // Mark as critical operation
    if (typeof startCriticalOperation === 'function') {
        startCriticalOperation();
    }
}

// End the current player's turn
function endMyTurn() {
    console.log('🎯 Ending my turn');
    setPlayerState(PLAYER_STATES.ENDED_TURN);
    
    // End critical operation
    if (typeof endCriticalOperation === 'function') {
        endCriticalOperation();
    }
    
    // Set all other players back to waiting state (in case they were in ended_turn)
    if (currentRoomId) {
        const playersRef = database.ref(`rooms/${currentRoomId}/players`);
        playersRef.once('value', (snapshot) => {
            const players = snapshot.val() || {};
            
            Object.keys(players).forEach(playerId => {
                if (playerId !== currentPlayerId && players[playerId].state === PLAYER_STATES.ENDED_TURN) {
                    setPlayerState(PLAYER_STATES.WAITING, playerId);
                }
            });
        });
    }
}

// Handle player banking points
function handlePlayerBanking(points, newScore) {
    console.log('💰 Player banking points:', points, 'New score:', newScore);
    console.log('💰 Banking for player:', currentPlayerId, 'in room:', currentRoomId);
    
    // Update score in Firebase
    if (currentRoomId && currentPlayerId) {
        const playerRef = database.ref(`rooms/${currentRoomId}/players/${currentPlayerId}`);
        console.log('💰 Updating Firebase path:', `rooms/${currentRoomId}/players/${currentPlayerId}`);
        
        playerRef.update({
            score: newScore,
            lastBankTime: Date.now()
        }).then(() => {
            console.log('💰 Score updated successfully in Firebase for:', currentPlayerId);
        }).catch((error) => {
            console.error('💰 Error updating score in Firebase:', error);
        });
    } else {
        console.error('💰 Missing currentRoomId or currentPlayerId:', {
            currentRoomId,
            currentPlayerId
        });
    }
    
    // End turn after banking
    endMyTurn();
}

// Set up listener for dice results
function setupDiceResultsListener() {
    if (!currentRoomId) return;
    
    const diceResultsRef = database.ref(`rooms/${currentRoomId}/diceResults`);
    
    diceResultsListener = diceResultsRef.on('child_added', (snapshot) => {
        const diceData = snapshot.val();
        console.log('🎲 Dice results received:', diceData);
        
        if (diceData && diceData.playerId !== currentPlayerId) {
            // Call the existing onDiceResultsReceived function
            if (typeof onDiceResultsReceived === 'function') {
                onDiceResultsReceived({
                    playerId: diceData.playerId,
                    diceResults: diceData.diceResults
                });
            }
        }
    });
}

// Set up listener for material changes
function setupMaterialChangesListener() {
    if (!currentRoomId) return;
    
    const materialChangesRef = database.ref(`rooms/${currentRoomId}/materialChanges`);
    
    materialChangesListener = materialChangesRef.on('child_added', (snapshot) => {
        const materialData = snapshot.val();
        console.log('🎨 Material change received:', materialData);
        
        if (materialData && materialData.playerId !== currentPlayerId) {
            // Call the existing onMaterialChangeReceived function
            if (typeof onMaterialChangeReceived === 'function') {
                onMaterialChangeReceived({
                    playerId: materialData.playerId,
                    diceType: materialData.diceType,
                    floorType: materialData.floorType
                });
            }
        }
    });
}

// Set up listener for Farkle states changes
function setupFarkleStatesListener() {
    if (!currentRoomId) return;
    
    const farkleStatesRef = database.ref(`rooms/${currentRoomId}/farkleStates`);
    
    farkleStatesListener = farkleStatesRef.on('value', (snapshot) => {
        const farkleStates = snapshot.val();
        console.log('⚠️ Farkle states updated from Firebase:', farkleStates);
        
        if (farkleStates) {
            // Update local farkle indicator states from Firebase
            Object.keys(farkleStates).forEach(playerId => {
                const farkleData = farkleStates[playerId];
                if (farkleData && farkleData.isFarkled) {
                    console.log(`⚠️ Syncing Farkle state for ${playerId}: ${farkleData.isFarkled}`);
                    setFarkleIndicatorState(playerId, farkleData.isFarkled);
                    
                    // Update UI if this is for another player
                    if (playerId !== currentPlayerId && typeof showFarkleIndicator === 'function') {
                        showFarkleIndicator(playerId);
                    }
                }
            });
            
            // Trigger UI update to reflect changes
            if (typeof updatePlayerListUI === 'function') {
                // Get current players data and refresh the UI
                const playersRef = database.ref(`rooms/${currentRoomId}/players`);
                playersRef.once('value', (playersSnapshot) => {
                    const players = playersSnapshot.val();
                    if (players) {
                        updatePlayerListUI(players);
                    }
                });
            }
        }
    });
}

// Broadcast dice results via Firebase
function broadcastDiceResults(playerId, diceResults) {
    if (!currentRoomId || !database) return;
    
    console.log(`🎲 Broadcasting dice results via Firebase for ${playerId}:`, diceResults);
    
    const diceResultsRef = database.ref(`rooms/${currentRoomId}/diceResults`);
    diceResultsRef.push({
        playerId: playerId,
        diceResults: diceResults,
        timestamp: Date.now()
    }).then(() => {
        console.log('🎲 Dice results broadcast successfully');
    }).catch((error) => {
        console.error('❌ Error broadcasting dice results:', error);
    });
}

// Broadcast material changes via Firebase
function broadcastMaterialChange(playerId, diceType, floorType) {
    if (!currentRoomId || !database) return;
    
    console.log(`🎨 Broadcasting material change via Firebase for ${playerId}: Dice=${diceType}, Floor=${floorType}`);
    
    const materialChangesRef = database.ref(`rooms/${currentRoomId}/materialChanges`);
    materialChangesRef.push({
        playerId: playerId,
        diceType: diceType,
        floorType: floorType,
        timestamp: Date.now()
    }).then(() => {
        console.log('🎨 Material change broadcast successfully');
    }).catch((error) => {
        console.error('❌ Error broadcasting material change:', error);
    });
}

// Cleanup Firebase listeners
function cleanupFirebaseStateManager() {
    console.log('🔥 Cleaning up Firebase State Manager');
    
    // Mark current player as disconnected before cleaning up
    if (currentPlayerId) {
        markPlayerAsConnected(false);
    }
    
    // Clear auto-turn timeout
    if (window.autoTurnTimeout) {
        clearTimeout(window.autoTurnTimeout);
        window.autoTurnTimeout = null;
    }
    
    // Clear Farkle indicator states
    farkleIndicatorStates = {};
    console.log('💾 Cleared Farkle indicator states');
    
    if (gameStateListener && currentRoomId) {
        database.ref(`rooms/${currentRoomId}/gameState`).off('value', gameStateListener);
        gameStateListener = null;
    }
    
    if (playersStateListener && currentRoomId) {
        database.ref(`rooms/${currentRoomId}/players`).off('value', playersStateListener);
        playersStateListener = null;
    }
    
    if (diceResultsListener && currentRoomId) {
        database.ref(`rooms/${currentRoomId}/diceResults`).off('child_added', diceResultsListener);
        diceResultsListener = null;
    }
    
    if (materialChangesListener && currentRoomId) {
        database.ref(`rooms/${currentRoomId}/materialChanges`).off('child_added', materialChangesListener);
        materialChangesListener = null;
    }
    
    if (farkleStatesListener && currentRoomId) {
        database.ref(`rooms/${currentRoomId}/farkleStates`).off('value', farkleStatesListener);
        farkleStatesListener = null;
    }
    
    currentRoomId = null;
    currentPlayerId = null;
    currentPlayerName = null;
}

// Initialize game state for a new room
function initializeGameState() {
    if (!currentRoomId) return;
    
    console.log('🔥 Initializing game state for room:', currentRoomId);
    
    const gameStateRef = database.ref(`rooms/${currentRoomId}/gameState`);
    gameStateRef.once('value', (snapshot) => {
        if (!snapshot.exists()) {
            // Initialize game state if it doesn't exist
            const initialGameState = {
                currentTurn: null,
                turnStartTime: Date.now(),
                gamePhase: 'waiting_for_players',
                createdAt: Date.now()
            };
            
            gameStateRef.set(initialGameState);
            console.log('🔥 Game state initialized');
        }
    });
}

// Export functions for global use
window.initializeFirebaseStateManager = initializeFirebaseStateManager;
window.setPlayerState = setPlayerState;
window.startMyTurn = startMyTurn;
window.endMyTurn = endMyTurn;
window.handlePlayerBanking = handlePlayerBanking;
window.broadcastDiceResults = broadcastDiceResults;
window.broadcastMaterialChange = broadcastMaterialChange;
window.cleanupFirebaseStateManager = cleanupFirebaseStateManager;
window.handlePlayerFarkle = handlePlayerFarkle;
window.markPlayerAsConnected = markPlayerAsConnected;
window.PLAYER_STATES = PLAYER_STATES;

// Export Firebase state variables for global access
window.getCurrentRoomId = function() { return currentRoomId; };
window.getCurrentPlayerId = function() { return currentPlayerId; };
window.getCurrentPlayerName = function() { return currentPlayerName; };

// Make variables directly accessible as well (for simpler access)
Object.defineProperty(window, 'currentRoomId', {
    get: function() { return currentRoomId; },
    configurable: true
});
Object.defineProperty(window, 'currentPlayerId', {
    get: function() { return currentPlayerId; },
    configurable: true
});
Object.defineProperty(window, 'currentPlayerName', {
    get: function() { return currentPlayerName; },
    configurable: true
});

// Override isPlayerTurn for Firebase state management
window.isPlayerTurnFirebase = function(playerId) {
    console.log('🔥 isPlayerTurnFirebase called with:', {
        playerId,
        firebaseCurrentTurnPlayer: window.firebaseCurrentTurnPlayer,
        comparison: window.firebaseCurrentTurnPlayer === playerId,
        typeOfPlayerId: typeof playerId,
        typeOfFirebasePlayer: typeof window.firebaseCurrentTurnPlayer
    });
    
    // This will be set by the Firebase state manager when game state changes
    if (window.firebaseCurrentTurnPlayer) {
        return window.firebaseCurrentTurnPlayer === playerId;
    }
    // Fallback to original function if available
    if (typeof window.originalIsPlayerTurn === 'function') {
        console.log('🔥 Falling back to original isPlayerTurn function');
        return window.originalIsPlayerTurn(playerId);
    }
    console.log('🔥 No firebase turn player and no original function - returning false');
    return false;
};

// Store original function and override it
if (typeof isPlayerTurn === 'function' && !window.originalIsPlayerTurn) {
    window.originalIsPlayerTurn = isPlayerTurn;
    window.isPlayerTurn = window.isPlayerTurnFirebase;
}

// Export for other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initializeFirebaseStateManager,
        setPlayerState,
        startMyTurn,
        endMyTurn,
        handlePlayerBanking,
        broadcastDiceResults,
        broadcastMaterialChange,
        cleanupFirebaseStateManager,
        PLAYER_STATES
    };
}
