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
    // console.log('🎲 Showing dice rolling UI - player is rolling');
    
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
let gameSettingsListener = null;
let diceResultsListener = null;
let rollingStartListener = null;
let diceSelectionsListener = null;
let lockedDiceListener = null;
let materialChangesListener = null;
let farkleStatesListener = null;
let hotDiceListener = null;
let farkleAlertListener = null;

// Persistent Farkle indicator state for all players
let farkleIndicatorStates = {};

// Helper functions for managing Farkle indicator states
function setFarkleIndicatorState(playerId, isVisible) {
    farkleIndicatorStates[playerId] = isVisible;
    // console.log(`💾 Farkle indicator state set for ${playerId}: ${isVisible}`);
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
    // console.log('💾 Farkle indicator states initialized:', farkleIndicatorStates);
}

// Function to be called when a player Farkles
function handlePlayerFarkle(playerId) {
    // console.log(`⚠️ Player ${playerId} Farkled - setting persistent state`);
    setFarkleIndicatorState(playerId, true);
    
    // Save Farkle state to Firebase for synchronization across all players
    if (currentRoomId && database) {
        const farkleStateRef = database.ref(`rooms/${currentRoomId}/farkleStates/${playerId}`);
        farkleStateRef.set({
            isFarkled: true,
            timestamp: Date.now()
        }).then(() => {
            // console.log(`💾 Farkle state saved to Firebase for ${playerId}`);
        }).catch((error) => {
            // console.error(`❌ Error saving Farkle state to Firebase for ${playerId}:`, error);
        });
    }
    
    // Also call the existing showFarkleIndicator function
    if (typeof showFarkleIndicator === 'function') {
        showFarkleIndicator(playerId);
    }
}

// Initialize Firebase state management
function initializeFirebaseStateManager(roomId, playerId, playerName) {
    // console.log('🔥 Initializing Firebase State Manager');
    // console.log('🔥 Room:', roomId, 'Player:', playerId, 'Name:', playerName);
    
    currentRoomId = roomId;
    currentPlayerId = playerId;
    currentPlayerName = playerName;
    
    if (!database) {
        // console.error('❌ Firebase database not initialized');
        // return false;
    }
    
    // Set up state listeners
    setupGameStateListener();
    setupPlayersStateListener();
    setupGameSettingsListener();
    setupDiceResultsListener();
    setupRollingStartListener();
    setupDiceSelectionsListener();
    setupLockedDiceListener();
    setupMaterialChangesListener();
    setupFarkleStatesListener();
    setupHotDiceListener();
    setupFarkleAlertListener();
    
    // Initialize player state and mark as connected
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
        // console.log('🔥 Game state updated:', gameState);
        
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
        // console.log('🔥 Players state updated:', players);
        
        if (players) {
            handlePlayersStateChange(players);
        }
    });
}

// Set up listener for game settings changes
function setupGameSettingsListener() {
    if (!currentRoomId) return;
    
    const gameSettingsRef = database.ref(`rooms/${currentRoomId}/gameSettings`);
    
    gameSettingsListener = gameSettingsRef.on('value', (snapshot) => {
        const gameSettings = snapshot.val();
        // console.log('🎮 Game settings updated:', gameSettings);
        
        if (gameSettings && gameSettings.updatedBy !== currentPlayerId) {
            // Only apply settings if they were updated by another player
            // console.log('🎮 Applying game settings from another player');
            
            // Update game settings using the game-settings.js module
            if (typeof updateGameSettings === 'function') {
                updateGameSettings(gameSettings);
                
                // Check if scoring modal is currently open and update it
                const scoringModal = document.getElementById('scoringModal');
                if (scoringModal && scoringModal.classList.contains('show')) {
                    // console.log('📊 Scoring modal is open - updating display immediately');
                    if (typeof updateScoringGuide === 'function') {
                        updateScoringGuide();
                    }
                }
                
                // console.log(`🎮 Game settings updated by host: Three 1s=${gameSettings.threeOnesRule}, Winning=${gameSettings.winningScore}, Minimum=${gameSettings.minimumScore}`);
            }
        }
    });
}

// Handle changes to overall game state
function handleGameStateChange(gameState) {
    const { currentTurn, turnStartTime, gamePhase, state: winState, winTriggerPlayer, finalRoundTracker } = gameState;
    
    console.log('🎮 Firebase game state change received:', {
        currentTurn,
        turnStartTime,
        gamePhase,
        winState,
        winTriggerPlayer,
        finalRoundTracker,
        isMyTurn: currentTurn === currentPlayerId,
        myPlayerId: currentPlayerId
    });
    
    // Handle win condition state changes
    if (winState && typeof updateWinGameState === 'function') {
        console.log('🎮 Calling updateWinGameState with:', { winState, winTriggerPlayer, finalRoundTracker });
        console.log('🎮 updateWinGameState function type:', typeof updateWinGameState);
        console.log('🎮 updateWinGameState function:', updateWinGameState);
        
        try {
            updateWinGameState(winState, winTriggerPlayer, finalRoundTracker);
            console.log('🎮 updateWinGameState call completed successfully');
        } catch (error) {
            console.error('🎮 ERROR calling updateWinGameState:', error);
            console.error('🎮 Error stack:', error.stack);
        }
    } else if (winState) {
        console.warn('🎮 updateWinGameState function not available!');
        console.warn('🎮 winState:', winState);
        console.warn('🎮 typeof updateWinGameState:', typeof updateWinGameState);
    }
    
    // Capture the previous turn player before updating
    const previousTurnPlayer = window.firebaseCurrentTurnPlayer;
    
    // Set the Firebase current turn player for the isPlayerTurn function
    window.firebaseCurrentTurnPlayer = currentTurn;
    console.log('🔥 [TURN DEBUG] Turn changed from:', previousTurnPlayer, 'to:', currentTurn);
    
    // Clear locked dice state for the previous player when their turn ends
    if (previousTurnPlayer && previousTurnPlayer !== currentTurn && window.playerLockedDiceStates) {
        console.log(`🧹 [TURN DEBUG] Clearing locked dice state for previous player: ${previousTurnPlayer}`);
        delete window.playerLockedDiceStates[previousTurnPlayer];
        
        // Also clear locked dice values for the previous player
        if (window.playerLockedDiceValues && window.playerLockedDiceValues[previousTurnPlayer]) {
            delete window.playerLockedDiceValues[previousTurnPlayer];
        }
        
        // Clear visual styling for the previous player's locked dice
        if (typeof window.clearPlayerLockedDiceStyling === 'function') {
            window.clearPlayerLockedDiceStyling(previousTurnPlayer);
        }
        
        console.log(`🧹 [TURN DEBUG] Remaining player states:`, Object.keys(window.playerLockedDiceStates));
    }
    
    // Update turn indicators in the UI
    updateTurnIndicators(currentTurn);
    
    // Update game controls based on whose turn it is
    if (typeof updateGameControlsState === 'function') {
        // console.log('🔥 Calling updateGameControlsState() after Firebase state change');
        updateGameControlsState();
    }
    
    // Show appropriate messages
    if (currentTurn === currentPlayerId) {
        // console.log('🎮 It\'s my turn - enabling controls');
        // Hide waiting message if visible
        const waitingMessage = document.getElementById('waiting-message');
        if (waitingMessage) {
            waitingMessage.style.display = 'none';
        }
    } else {
        // console.log('🎮 Not my turn - showing waiting message');
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
    
    // Check if current turn player has disconnected and end their turn
    if (window.firebaseCurrentTurnPlayer && players[window.firebaseCurrentTurnPlayer]) {
        const currentTurnPlayerData = players[window.firebaseCurrentTurnPlayer];
        if (currentTurnPlayerData.isConnected === false && 
            currentTurnPlayerData.state === PLAYER_STATES.ROLLING) {
            console.log(`🚪 Player ${window.firebaseCurrentTurnPlayer} disconnected during their turn - ending their turn`);
            
            // Set the disconnected player's state to ended_turn
            setPlayerState(PLAYER_STATES.ENDED_TURN, window.firebaseCurrentTurnPlayer);
            
            // Clear any locked dice for the disconnected player
            // COMMENTED OUT: Preserve locked dice data for game history
            // if (typeof clearAllLockedDiceFromFirebase === 'function') {
            //     clearAllLockedDiceFromFirebase();
            // }
            
            // Show notification about the disconnection
            if (typeof showGameAlert === 'function') {
                showGameAlert(
                    `⚠️ Player ${window.firebaseCurrentTurnPlayer} disconnected during their turn. Turn ended automatically.`,
                    'warning',
                    5000
                );
            }
            
            // The turn will advance automatically via checkAndAdvanceTurn
            return; // Exit early to let the state update propagate
        }
    }
    
    // Initialize Farkle indicator states for all players
    initializeFarkleStatesForPlayers(players);
    
    // FIXED: Use only Firebase turn state for consistency
    // This prevents conflicts when multiple players are involved
    const isMyTurn = window.firebaseCurrentTurnPlayer === currentPlayerId;
    
    // console.log('👥 Players state analysis:', {
    //     totalPlayers: playerList.length,
    //     currentTurnPlayer,
    //     myState,
    //     firebaseCurrentTurnPlayer: window.firebaseCurrentTurnPlayer,
    //     isMyTurn: isMyTurn,
    //     myPlayerId: currentPlayerId
    // });
    
    // Update player list UI
    updatePlayerListUI(players);
    
    // Show/hide dice rolling UI based on whether it's my turn
    if (isMyTurn) {
        // It's my turn - show the dice rolling UI
        // console.log('🎲 Showing dice UI - it\'s my turn');
        showDiceRollingUI();
    } else {
        // Not my turn - hide the dice rolling UI but show waiting message
        // console.log('🎲 Not my turn - showing waiting state');
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
        // console.log('🔌 Initializing turn system for connected players:', connectedPlayerNames);
        initializeTurnSystem(connectedPlayerNames, true, true);
    }
    
    // Update game controls after player state changes
    if (typeof updateGameControlsState === 'function') {
        // console.log('🔥 Calling updateGameControlsState() after player state change');
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
    
    // console.log('🔌 Filtering players - Total:', Object.keys(players).length, 'Connected:', Object.keys(connectedPlayers).length);
    
    // No need to extract states from DOM - we have persistent state
    // console.log('💾 Current Farkle states before recreation:', farkleIndicatorStates);
    
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
                // Note: Rolling animation now starts only when broadcastRollingStart is received
                break;
            case PLAYER_STATES.ENDED_TURN:
                stateIndicator.classList.add('bg-warning', 'text-dark');
                stateIndicator.textContent = '✅ Finished';
                
                // Remove from rolling players set and stop animation if needed
                if (typeof window.otherPlayersRolling !== 'undefined') {
                    window.otherPlayersRolling.delete(playerId);
                    
                    // Stop animation interval if no players are rolling
                    if (window.otherPlayerAnimationInterval !== null && 
                        window.otherPlayersRolling.size === 0) {
                        clearInterval(window.otherPlayerAnimationInterval);
                        window.otherPlayerAnimationInterval = null;
                        
                        // Clear the dice display since no one is rolling anymore
                        if (typeof showWaitingForTurnMessage === 'function') {
                            showWaitingForTurnMessage();
                        }
                    }
                }
                break;
            case PLAYER_STATES.WAITING:
            default:
                stateIndicator.classList.add('bg-secondary');
                stateIndicator.textContent = '⏳ Waiting';
                
                // Remove from rolling players set and stop animation if needed
                if (typeof window.otherPlayersRolling !== 'undefined') {
                    window.otherPlayersRolling.delete(playerId);
                    
                    // Stop animation interval if no players are rolling
                    if (window.otherPlayerAnimationInterval !== null && 
                        window.otherPlayersRolling.size === 0) {
                        clearInterval(window.otherPlayerAnimationInterval);
                        window.otherPlayerAnimationInterval = null;
                        
                        // Clear the dice display since no one is rolling anymore
                        if (typeof showWaitingForTurnMessage === 'function') {
                            showWaitingForTurnMessage();
                        }
                    }
                }
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
            // console.log(`🔄 Restored Farkle indicator for ${playerId} from persistent state`);
        } else {
            farkleIndicator.style.display = 'none';
            // console.log(`🚫 No Farkle indicator for ${playerId} (persistent state: false)`);
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
        scoreBadge.style.fontSize = '1.4em';
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
    // FIXED: Use join order instead of alphabetical sorting for more predictable turn rotation
    // Sort by joinedAt timestamp if available, otherwise fall back to alphabetical
    const playerIds = Object.keys(connectedPlayers).sort((a, b) => {
        const playerA = connectedPlayers[a];
        const playerB = connectedPlayers[b];
        
        // Use joinedAt timestamp if both players have it
        if (playerA.joinedAt && playerB.joinedAt) {
            return playerA.joinedAt - playerB.joinedAt;
        }
        
        // If only one has joinedAt, prioritize the one with timestamp
        if (playerA.joinedAt && !playerB.joinedAt) return -1;
        if (!playerA.joinedAt && playerB.joinedAt) return 1;
        
        // Fallback to alphabetical if neither has joinedAt
        return a.localeCompare(b);
    });
    
    // Check if we can use the cached Firebase current turn to determine next player
    if (window.firebaseCurrentTurnPlayer && playerIds.includes(window.firebaseCurrentTurnPlayer)) {
        // Find the next player in rotation after the current turn player
        const currentIndex = playerIds.indexOf(window.firebaseCurrentTurnPlayer);
        
        // Look for the next player in waiting state, cycling through all players
        for (let i = 1; i <= playerIds.length; i++) {
            const nextIndex = (currentIndex + i) % playerIds.length;
            const nextPlayer = playerIds[nextIndex];
            
            if (connectedPlayers[nextPlayer] && connectedPlayers[nextPlayer].state === PLAYER_STATES.WAITING) {
                return nextPlayer;
            }
        }
    }
    
    // Fallback: find first player in waiting state (in join order)
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
    
    // console.log('🔄 Turn advancement check:', {
    //     totalPlayers: Object.keys(players).length,
    //     connectedPlayers: Object.keys(connectedPlayers).length,
    //     allConnectedPlayersWaiting,
    //     allConnectedPlayersEnded,
    //     hasMultipleConnectedPlayers,
    //     currentTurnPlayer,
    //     connectedPlayerStates
    // });
    
    // Special case: If all connected players have ended their turn, start a new round
    if (allConnectedPlayersEnded && hasMultipleConnectedPlayers) {
        // console.log('🔄 All connected players have ended their turns - starting new round');
        console.log('🔄 All connected players have ended their turns - starting new round');
        
        // Clear any existing timeout
        if (window.autoTurnTimeout) {
            clearTimeout(window.autoTurnTimeout);
        }
        
        // Set timeout to start new round after 2 seconds
        window.autoTurnTimeout = setTimeout(() => {
            // FIXED: Use consistent player ordering (join order, not alphabetical)
            const connectedPlayerIds = Object.keys(connectedPlayers).sort((a, b) => {
                const playerA = connectedPlayers[a];
                const playerB = connectedPlayers[b];
                
                // Use joinedAt timestamp if both players have it
                if (playerA.joinedAt && playerB.joinedAt) {
                    return playerA.joinedAt - playerB.joinedAt;
                }
                
                // If only one has joinedAt, prioritize the one with timestamp
                if (playerA.joinedAt && !playerB.joinedAt) return -1;
                if (!playerA.joinedAt && playerB.joinedAt) return 1;
                
                // Fallback to alphabetical if neither has joinedAt
                return a.localeCompare(b);
            });
            
            let firstPlayer;
            
            // For new rounds, advance to next player in rotation from last round
            if (window.firebaseCurrentTurnPlayer && connectedPlayerIds.includes(window.firebaseCurrentTurnPlayer)) {
                const currentIndex = connectedPlayerIds.indexOf(window.firebaseCurrentTurnPlayer);
                const nextIndex = (currentIndex + 1) % connectedPlayerIds.length;
                firstPlayer = connectedPlayerIds[nextIndex];
                
                // Check if we've completed a round (went back to first player)
                if (nextIndex === 0 && typeof incrementRound === 'function') {
                    // We've completed a full round through all players
                    incrementRound();
                }
            } else {
                // Fallback: use host or first player
                const connectedHostPlayer = connectedPlayerIds.find(playerId => connectedPlayers[playerId].isHost);
                firstPlayer = connectedHostPlayer || connectedPlayerIds[0];
            }
            
            console.log('🎮 Starting new round - next player in rotation:', firstPlayer);
            console.log('🎯 Round check: window.firebaseCurrentTurnPlayer=', window.firebaseCurrentTurnPlayer);
            console.log('🎯 Round check: connectedPlayerIds=', connectedPlayerIds);
            
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
            
            // COMMENTED OUT: Preserve locked dice data for game history
            // Clear all locked dice data for the new round
            // clearAllLockedDiceFromFirebase();
            
            // Apply all updates to Firebase
            database.ref(`rooms/${currentRoomId}`).update(updates).then(() => {
                // console.log('🎮 New round started - first connected player:', firstPlayer);
            });
        }, 2000);
        
        return; // Don't do normal turn advancement
    }
    
    // If all connected players are waiting and we have multiple connected players, auto-start next turn
    if (allConnectedPlayersWaiting && hasMultipleConnectedPlayers) {
        // console.log('🕐 All connected players waiting - auto-starting next turn in 2 seconds');
        
        // Clear any existing timeout
        if (window.autoTurnTimeout) {
            clearTimeout(window.autoTurnTimeout);
        }
        
        // Set timeout to start next turn after 2 seconds
        window.autoTurnTimeout = setTimeout(() => {
            // FIXED: Use consistent player ordering (join order, not alphabetical)
            const connectedPlayerIds = Object.keys(connectedPlayers).sort((a, b) => {
                const playerA = connectedPlayers[a];
                const playerB = connectedPlayers[b];
                
                // Use joinedAt timestamp if both players have it
                if (playerA.joinedAt && playerB.joinedAt) {
                    return playerA.joinedAt - playerB.joinedAt;
                }
                
                // If only one has joinedAt, prioritize the one with timestamp
                if (playerA.joinedAt && !playerB.joinedAt) return -1;
                if (!playerA.joinedAt && playerB.joinedAt) return 1;
                
                // Fallback to alphabetical if neither has joinedAt
                return a.localeCompare(b);
            });
            
            let nextPlayer;
            
            // If we have a previous turn player, advance to next in rotation
            if (window.firebaseCurrentTurnPlayer && connectedPlayerIds.includes(window.firebaseCurrentTurnPlayer)) {
                const currentIndex = connectedPlayerIds.indexOf(window.firebaseCurrentTurnPlayer);
                const nextIndex = (currentIndex + 1) % connectedPlayerIds.length;
                nextPlayer = connectedPlayerIds[nextIndex];
            } else {
                // Fallback: use host or first player
                const connectedHostPlayer = connectedPlayerIds.find(playerId => connectedPlayers[playerId].isHost);
                nextPlayer = connectedHostPlayer || connectedPlayerIds[0];
            }
            
            // console.log('🎮 Auto-starting turn for next player in rotation:', nextPlayer);
            
            // COMMENTED OUT: Preserve locked dice data for game history
            // Clear all locked dice data for the new turn
            // clearAllLockedDiceFromFirebase();
            
            // Update game state to set the connected host as current turn
            const gameStateRef = database.ref(`rooms/${currentRoomId}/gameState`);
            gameStateRef.update({
                currentTurn: nextPlayer,
                turnStartTime: Date.now()
            }).then(() => {
                // console.log('🎮 Auto-turn started for:', nextPlayer);
                
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
            
            // Check for round completion before advancing turn
            if (currentGameTurn && typeof incrementRound === 'function') {
                // Get the list of connected player IDs to check for round completion
                const connectedPlayerIds = Object.keys(players).filter(playerId => {
                    const player = players[playerId];
                    return player.isConnected !== false;
                }).sort((a, b) => {
                    const playerA = players[a];
                    const playerB = players[b];
                    
                    // Use joinedAt timestamp if both players have it
                    if (playerA.joinedAt && playerB.joinedAt) {
                        return playerA.joinedAt - playerB.joinedAt;
                    }
                    
                    // If only one has joinedAt, prioritize the one with timestamp
                    if (playerA.joinedAt && !playerB.joinedAt) return -1;
                    if (!playerA.joinedAt && playerB.joinedAt) return 1;
                    
                    // Fallback to alphabetical if neither has joinedAt
                    return a.localeCompare(b);
                });
                
                if (connectedPlayerIds.length > 1) {
                    const currentIndex = connectedPlayerIds.indexOf(currentGameTurn);
                    const nextIndex = connectedPlayerIds.indexOf(currentTurnPlayer);
                    
                    console.log('🎯 Turn advancement check: currentIndex=', currentIndex, 'nextIndex=', nextIndex, 'playerCount=', connectedPlayerIds.length);
                    console.log('🎯 Players order:', connectedPlayerIds);
                    
                    // Check if we've wrapped around to the first player (completed a round)
                    if (currentIndex !== -1 && nextIndex === 0 && currentIndex === connectedPlayerIds.length - 1) {
                        console.log('🎯 Round completed! Incrementing round counter.');
                        incrementRound();
                    } else {
                        console.log('🎯 Round not completed yet.');
                    }
                }
            }
            
            // Update game state
            const updates = {
                currentTurn: currentTurnPlayer,
                turnStartTime: Date.now()
            };
            
            database.ref(`rooms/${currentRoomId}/gameState`).update(updates).then(() => {
                // console.log('🔄 Turn advanced in Firebase, triggering UI update');
                
                // COMMENTED OUT: Preserve locked dice data for game history
                // Clear all locked dice data for the new turn
                // clearAllLockedDiceFromFirebase();
                
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
        // console.log(`🔄 Clearing Farkle indicator for ${currentTurnPlayerId} as their turn starts`);
        setFarkleIndicatorState(currentTurnPlayerId, false);
        
        // Check if this player is starting their final turn and show alert
        if (typeof gameState !== 'undefined' && gameState === 'final_round' && 
            typeof finalRoundTracker !== 'undefined' && 
            finalRoundTracker.hasOwnProperty(currentTurnPlayerId) && 
            !finalRoundTracker[currentTurnPlayerId] &&
            typeof currentPlayerId !== 'undefined' && currentTurnPlayerId === currentPlayerId) {
            
            // This is the current player's final turn - show them a persistent alert
            if (typeof showGameAlert === 'function') {
                showGameAlert(
                    `⏳ This is your FINAL TURN! ⏳<br><small>Another player has reached the winning score - make it count!</small>`,
                    'warning',
                    0  // 0 means no timeout - alert stays visible for the entire turn
                );
            }
        }
        
        // Clear Farkle state from Firebase
        if (currentRoomId && database) {
            const farkleStateRef = database.ref(`rooms/${currentRoomId}/farkleStates/${currentTurnPlayerId}`);
            farkleStateRef.remove().then(() => {
                // console.log(`💾 Farkle state cleared from Firebase for ${currentTurnPlayerId}`);
            }).catch((error) => {
                // console.error(`❌ Error clearing Farkle state from Firebase for ${currentTurnPlayerId}:`, error);
            });
        }
        
        // Also update the DOM element if it exists
        if (typeof hideFarkleIndicator === 'function') {
            hideFarkleIndicator(currentTurnPlayerId);
        }
        
        // ADDITIONAL: Clear ALL dice states when a new turn starts
        // This provides an extra safety net to ensure all dice styling is cleared
        // console.log(`🧹 Clearing all dice states for new turn (${currentTurnPlayerId})`);
        
        // Temporarily disable locked dice styling to prevent re-application
        window.lockedDiceStylingDisabled = true;
        
        // Clear old locked dice styling (legacy function)
        if (typeof window.clearAllDiceLockedStyling === 'function') {
            window.clearAllDiceLockedStyling();
        }
        
        // Reset the DiceStylingManager completely for the new turn
        if (window.diceStylingManager && typeof window.diceStylingManager.reset === 'function') {
            window.diceStylingManager.reset();
            // console.log(`🧹 Reset DiceStylingManager for new turn`);
        }
        
        // Clear the dice results container to remove previous player's dice
        const diceContainer = document.getElementById('dice-results-container');
        if (diceContainer) {
            diceContainer.innerHTML = '';
            // console.log(`🧹 Cleared dice results container for new turn`);
        }
        
        // Re-initialize the DiceStylingManager for the new current player
        if (window.diceStylingManager && typeof window.diceStylingManager.initialize === 'function') {
            // Re-initialize with the new current player
            const isMultiplayer = typeof currentRoomId !== 'undefined' && currentRoomId !== null;
            window.diceStylingManager.initialize(currentTurnPlayerId, isMultiplayer);
            // console.log(`🧹 Re-initialized DiceStylingManager for new current player: ${currentTurnPlayerId}`);
        }
        
        // Also clear local player locked dice states for the previous player only
        // Note: This is handled earlier in the main game state listener when turns change
        // This is a backup in case the turn change wasn't detected properly
        if (window.playerLockedDiceStates) {
            // Clear all locked dice states as a fallback, but this should rarely be needed
            console.log(`🧹 [TURN DEBUG] Fallback: Clearing all locked dice states for new turn`);
            window.playerLockedDiceStates = {};
            
            if (window.playerLockedDiceValues) {
                window.playerLockedDiceValues = {};
            }
        }
        
        // Re-enable locked dice styling after a short delay
        setTimeout(() => {
            window.lockedDiceStylingDisabled = false;
            // console.log(`🧹 Re-enabled locked dice styling for new turn`);
        }, 1500);
    }
}

// Show dice rolling UI when player is in rolling state
function showDiceRollingUI() {
    // console.log('� Showing dice rolling UI - player is rolling');
    
    // Show roll dice button
    const rollButton = document.getElementById('roll-dice');
    if (rollButton) {
        rollButton.style.display = 'block';
        rollButton.disabled = false;
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
    // console.log('� Hiding dice rolling UI - player not rolling');
    
    // Disable roll dice button but keep it visible (don't hide it completely)
    const rollButton = document.getElementById('roll-dice');
    if (rollButton) {
        rollButton.disabled = true;
        // Don't hide the button - just disable it so players can see it
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
    // console.log('🎮 Enabling player controls - it\'s my turn!');
    showDiceRollingUI();
}

// Disable player controls when not their turn (legacy function - now calls hideDiceRollingUI)
function disablePlayerControls() {
    // console.log('🎮 Disabling player controls - not my turn');
    hideDiceRollingUI();
}

// Set the current player's state
function setPlayerState(state, playerId = null) {
    if (!currentRoomId) {
        // console.error('❌ Cannot set player state: no room ID');
        return;
    }
    
    const targetPlayerId = playerId || currentPlayerId;
    if (!targetPlayerId) {
        // console.error('❌ Cannot set player state: no player ID');
        return;
    }
    
    // console.log(`🔥 Setting player ${targetPlayerId} state to:`, state);
    
    const playerRef = database.ref(`rooms/${currentRoomId}/players/${targetPlayerId}`);
    playerRef.update({
        state: state,
        stateTimestamp: Date.now()
    }).then(() => {
        // console.log(`✅ Player state updated to: ${state}`);
    }).catch((error) => {
        // console.error('❌ Error updating player state:', error);
    });
}

// Mark player as connected or disconnected
function markPlayerAsConnected(isConnected, playerId = null) {
    if (!currentRoomId) {
        // console.error('❌ Cannot update connection status: no room ID');
        return;
    }
    
    const targetPlayerId = playerId || currentPlayerId;
    if (!targetPlayerId) {
        // console.error('❌ Cannot update connection status: no player ID');
        return;
    }
    
    // console.log(`🔌 Setting player ${targetPlayerId} connection status to:`, isConnected);
    
    const playerRef = database.ref(`rooms/${currentRoomId}/players/${targetPlayerId}`);
    playerRef.update({
        isConnected: isConnected,
        lastConnectionUpdate: Date.now()
    }).then(() => {
        // console.log(`✅ Player connection status updated: ${isConnected}`);
    }).catch((error) => {
        // console.error('❌ Error updating connection status:', error);
    });
}

// Set up automatic disconnection handling
function setupDisconnectionHandling() {
    // Handle page unload (refresh, close tab, navigate away)
    window.addEventListener('beforeunload', () => {
        // console.log('🔌 Page unloading - marking player as disconnected');
        if (currentPlayerId) {
            markPlayerAsConnected(false);
        }
    });
    
    // Handle browser/tab visibility changes
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            // console.log('🔌 Page hidden - player may be disconnecting');
        } else {
            // console.log('🔌 Page visible - marking player as connected');
            if (currentPlayerId) {
                markPlayerAsConnected(true);
            }
        }
    });
    
    // console.log('🔌 Disconnection handling set up');
}

// Start the current player's turn
function startMyTurn() {
    // console.log('🎯 Starting my turn');
    setPlayerState(PLAYER_STATES.ROLLING);
    
    // Mark as critical operation
    if (typeof startCriticalOperation === 'function') {
        startCriticalOperation();
    }
}

// End the current player's turn
function endMyTurn() {
    console.log('🎯 endMyTurn() called');
    console.log('🎯 currentPlayerId at start of endMyTurn:', currentPlayerId);
    
    // console.log('🎯 Ending my turn');
    setPlayerState(PLAYER_STATES.ENDED_TURN);
    
    // Check final round progress if we're in final round
    if (typeof checkFinalRoundProgress === 'function' && currentPlayerId) {
        console.log('🏆 Checking final round progress for', currentPlayerId, '(from endMyTurn)');
        checkFinalRoundProgress(currentPlayerId, true); // Pass true to indicate turn is ending
    }
    
    // Check if game has ended and show win modal if needed
    // We need to check this via a function call since gameState might not be in scope
    if (typeof checkIfGameEndedAndShowModal === 'function') {
        console.log('🏆 Calling checkIfGameEndedAndShowModal after turn end');
        checkIfGameEndedAndShowModal();
    } else if (typeof gameState !== 'undefined' && gameState === 'ended') {
        console.log('🏆 Game has ended - checking if we should show win modal after turn end');
        if (typeof showWinModal === 'function' && typeof getAllPlayerScores === 'function') {
            const scores = getAllPlayerScores();
            const players = Object.keys(scores);
            
            if (players.length > 0) {
                const sortedPlayers = players.sort((a, b) => scores[b] - scores[a]);
                const winner = sortedPlayers[0];
                const winnerScore = scores[winner];
                
                console.log('🏆 Showing win modal after turn end');
                showWinModal(winner, winnerScore, sortedPlayers, scores);
            }
        }
    }
    
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
    // console.log('💰 Player banking points:', points, 'New score:', newScore);
    // console.log('💰 Banking for player:', currentPlayerId, 'in room:', currentRoomId);
    
    // Get current player score to check if they're starting from 0
    const currentPlayerScore = (typeof getPlayerScore === 'function') ? getPlayerScore(currentPlayerId) : 0;
    const gameSettings = (typeof getGameSettings === 'function') ? getGameSettings() : gameSettings.minimumScore;
    const minimumRequired = (typeof gameSettings.minimumScore === 'number') ? gameSettings.minimumScore : gameSettings.minimumScore;
    
    console.log(`🔍 Firebase banking validation for ${currentPlayerId}:`);
    console.log(`🔍   - currentPlayerScore: ${currentPlayerScore}`);
    console.log(`🔍   - points: ${points}`);
    console.log(`🔍   - gameSettings:`, gameSettings);
    console.log(`🔍   - minimumRequired: ${minimumRequired}`);
    console.log(`🔍   - validation check: currentPlayerScore === 0 && points < minimumRequired`);
    console.log(`🔍   - will block banking: ${currentPlayerScore === 0 && points < minimumRequired}`);
    
    // Check minimum score requirement for players with 0 points
    if (currentPlayerScore === 0 && points < minimumRequired) {
        // Show error message and prevent banking
        if (typeof showGameAlert === 'function') {
            showGameAlert(
                `❌ You need at least ${minimumRequired} points to get "on the board"<br><small>You currently have ${points} pending points</small>`, 
                'danger', 
                4000
            );
        }
        return; // Don't proceed with banking
    }
    
    // Update score in Firebase
    if (currentRoomId && currentPlayerId) {
        const playerRef = database.ref(`rooms/${currentRoomId}/players/${currentPlayerId}`);
        // console.log('💰 Updating Firebase path:', `rooms/${currentRoomId}/players/${currentPlayerId}`);
        
        playerRef.update({
            score: newScore,
            lastBankTime: Date.now()
        }).then(() => {
            // console.log('💰 Score updated successfully in Firebase for:', currentPlayerId);
        }).catch((error) => {
            // console.error('💰 Error updating score in Firebase:', error);
        });
    } else {
        // console.error('💰 Missing currentRoomId or currentPlayerId:', {
        //     currentRoomId,
        //     currentPlayerId
        // });
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
        // console.log('🎲 Dice results received:', diceData);
        
        if (diceData && diceData.playerId !== currentPlayerId) {
            // console.log(`🎲 Processing dice results from other player ${diceData.playerId}`);
            
            // Stop rolling animation for this player since dice results are now available
            if (typeof window.otherPlayersRolling !== 'undefined') {
                window.otherPlayersRolling.delete(diceData.playerId);
                // console.log(`🎲 Removed ${diceData.playerId} from rolling players - dice results received`);
                
                // Stop animation interval if no players are rolling
                if (window.otherPlayerAnimationInterval !== null && 
                    window.otherPlayersRolling.size === 0) {
                    clearInterval(window.otherPlayerAnimationInterval);
                    window.otherPlayerAnimationInterval = null;
                    // console.log('🎲 Stopped rolling animation - no more players rolling');
                }
            }
            
            // Call the existing onDiceResultsReceived function
            if (typeof onDiceResultsReceived === 'function') {
                onDiceResultsReceived({
                    playerId: diceData.playerId,
                    diceResults: diceData.diceResults
                });
            }
        } else {
            // console.log('🎲 Ignoring dice results - same player or invalid data');
        }
    });
}

// Set up listener for rolling start events
function setupRollingStartListener() {
    if (!currentRoomId) return;
    
    const rollingStartRef = database.ref(`rooms/${currentRoomId}/rollingStart`);
    
    rollingStartListener = rollingStartRef.on('child_added', (snapshot) => {
        const rollingData = snapshot.val();
        // console.log('🎲 Rolling start received:', rollingData);
        
        if (rollingData && rollingData.playerId !== currentPlayerId) {
            // console.log(`🎲 Starting animation for spectator - player ${rollingData.playerId} started rolling`);
            // Start rolling animation for spectators
            if (typeof window.otherPlayersRolling !== 'undefined') {
                window.otherPlayersRolling.add(rollingData.playerId);
                // console.log('🎲 Added to otherPlayersRolling set:', window.otherPlayersRolling);
                
                // Start animation interval if not already running
                if (window.otherPlayerAnimationInterval === null && 
                    window.otherPlayersRolling.size > 0) {
                    // console.log('🎲 Starting animation interval for spectators');
                    window.otherPlayerAnimationInterval = setInterval(() => {
                        if (window.otherPlayersRolling.size > 0 && typeof displayOtherPlayerRollingAnimation === 'function') {
                            // Get the first rolling player
                            const rollingPlayer = Array.from(window.otherPlayersRolling)[0];
                            displayOtherPlayerRollingAnimation(rollingPlayer);
                        }
                    }, 150);
                } else {
                    // console.log('🎲 Animation interval already running or no rolling players');
                }
            }
        } else {
            // console.log('🎲 Ignoring rolling start - same player or invalid data');
        }
    });
}

// Set up listener for dice selections
function setupDiceSelectionsListener() {
    if (!currentRoomId) return;
    
    const diceSelectionsRef = database.ref(`rooms/${currentRoomId}/diceSelections`);
    
    diceSelectionsListener = diceSelectionsRef.on('child_added', (snapshot) => {
        const selectionData = snapshot.val();
        // console.log('🎯 Dice selection received:', selectionData);
        
        if (selectionData && selectionData.playerId !== currentPlayerId) {
            // Call function to display other players' dice selections
            if (typeof displayOtherPlayerDiceSelections === 'function') {
                displayOtherPlayerDiceSelections({
                    playerId: selectionData.playerId,
                    selectedDiceIndices: selectionData.selectedDiceIndices,
                    diceResults: selectionData.diceResults
                });
            }
        }
    });
}

// Set up listener for locked dice changes
function setupLockedDiceListener() {
    if (!currentRoomId) return;
    
    const lockedDiceRef = database.ref(`rooms/${currentRoomId}/lockedDice`);
    
    lockedDiceListener = lockedDiceRef.on('child_added', (snapshot) => {
        try {
            const lockedData = snapshot.val();
            console.log('🔒 [SPECTATOR DEBUG] Raw locked dice received:', {
                snapshotKey: snapshot.key,
                fullData: lockedData,
                timestamp: new Date().toISOString()
            });
            console.log('🔒 [SPECTATOR DEBUG] Current player context:', {
                currentPlayerId: currentPlayerId,
                currentPlayerName: currentPlayerName,
                broadcasterPlayerId: lockedData?.playerId,
                isSpectating: lockedData && lockedData.playerId !== currentPlayerId
            });
            
            if (lockedData && lockedData.playerId !== currentPlayerId) {
                // Get current round number for filtering
                const currentRoundNumber = (typeof window.currentRound !== 'undefined') ? window.currentRound : 1;
                
                console.log('🔒 [SPECTATOR DEBUG] Round filtering check:', {
                    dataRoundNumber: lockedData.roundNumber,
                    currentRoundNumber: currentRoundNumber,
                    roundsMatch: lockedData.roundNumber === currentRoundNumber,
                    windowCurrentRound: window.currentRound,
                    windowCurrentRoundType: typeof window.currentRound
                });
                
                // Only process locked dice from the current round
                if (lockedData.roundNumber === currentRoundNumber) {
                    console.log('🔒 [SPECTATOR DEBUG] Processing locked dice data:', {
                        playerId: lockedData.playerId,
                        roundNumber: lockedData.roundNumber,
                        lockedDiceIndices: lockedData.lockedDiceIndices,
                        diceResults: lockedData.diceResults,
                        timestamp: lockedData.timestamp,
                        formattedTime: new Date(lockedData.timestamp).toLocaleTimeString()
                    });
                    console.log('🔒 [SPECTATOR DEBUG] Current state before processing:', {
                        playerLockedDiceStates: window.playerLockedDiceStates ? JSON.stringify(window.playerLockedDiceStates) : 'undefined',
                        displayFunctionExists: typeof displayOtherPlayerLockedDice === 'function'
                    });
                    
                    // Call function to display other players' locked dice
                    if (typeof displayOtherPlayerLockedDice === 'function') {
                        console.log('🔒 [SPECTATOR DEBUG] Calling displayOtherPlayerLockedDice with data:', {
                            playerId: lockedData.playerId,
                            lockedDiceIndices: lockedData.lockedDiceIndices,
                            diceResults: lockedData.diceResults
                        });
                        displayOtherPlayerLockedDice({
                            playerId: lockedData.playerId,
                            lockedDiceIndices: lockedData.lockedDiceIndices,
                            diceResults: lockedData.diceResults
                        });
                        console.log('🔒 [SPECTATOR DEBUG] displayOtherPlayerLockedDice call completed');
                    } else {
                        console.error('🔒 [SPECTATOR DEBUG] displayOtherPlayerLockedDice function not found!', {
                            functionType: typeof displayOtherPlayerLockedDice,
                            availableDisplayFunctions: Object.keys(window).filter(key => typeof window[key] === 'function' && key.includes('display'))
                        });
                    }
                    
                    console.log('🔒 [SPECTATOR DEBUG] State after processing:', {
                        playerLockedDiceStates: window.playerLockedDiceStates ? JSON.stringify(window.playerLockedDiceStates) : 'undefined'
                    });
                } else {
                    console.log('🔒 [SPECTATOR DEBUG] Ignoring locked dice from different round:', {
                        dataRound: lockedData.roundNumber,
                        currentRound: currentRoundNumber,
                        playerId: lockedData.playerId,
                        reason: 'Round mismatch'
                    });
                }
            } else {
                console.log('🔒 [SPECTATOR DEBUG] Ignoring locked dice event:', {
                    reason: lockedData ? 'From self' : 'Invalid data',
                    lockedData: lockedData,
                    currentPlayerId: currentPlayerId,
                    dataPlayerId: lockedData?.playerId
                });
            }
        } catch (error) {
            console.error('🔒 [SPECTATOR DEBUG] Error in locked dice listener:', {
                error: error.message,
                stack: error.stack,
                snapshotKey: snapshot?.key,
                timestamp: new Date().toISOString()
            });
        }
    });
}

// Set up listener for material changes
function setupMaterialChangesListener() {
    if (!currentRoomId) return;
    
    const materialChangesRef = database.ref(`rooms/${currentRoomId}/materialChanges`);
    
    materialChangesListener = materialChangesRef.on('child_added', (snapshot) => {
        const materialData = snapshot.val();
        // console.log('🎨 Material change received:', materialData);
        
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
        // console.log('⚠️ Farkle states updated from Firebase:', farkleStates);
        
        if (farkleStates) {
            // Update local farkle indicator states from Firebase
            Object.keys(farkleStates).forEach(playerId => {
                const farkleData = farkleStates[playerId];
                if (farkleData && farkleData.isFarkled) {
                    // console.log(`⚠️ Syncing Farkle state for ${playerId}: ${farkleData.isFarkled}`);
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

// Set up listener for hot dice events
function setupHotDiceListener() {
    if (!currentRoomId) return;
    
    const hotDiceRef = database.ref(`rooms/${currentRoomId}/hotDiceEvents`);
    
    hotDiceListener = hotDiceRef.on('child_added', (snapshot) => {
        const hotDiceData = snapshot.val();
        // console.log('🔥 Hot dice listener triggered:', hotDiceData);
        
        if (hotDiceData && hotDiceData.playerId !== currentPlayerId) {
            // console.log('🔥 Hot dice event received for other player:', hotDiceData.playerId);
            // console.log('🔥 Current player ID:', currentPlayerId);
            // console.log('🔥 showSpectatorHotDiceMessage function exists:', typeof showSpectatorHotDiceMessage === 'function');
            // console.log('🔥 window.showSpectatorHotDiceMessage exists:', typeof window.showSpectatorHotDiceMessage === 'function');
            
            // Show hot dice message for spectator
            if (typeof showSpectatorHotDiceMessage === 'function') {
                showSpectatorHotDiceMessage(hotDiceData.playerId);
            } else if (typeof window.showSpectatorHotDiceMessage === 'function') {
                window.showSpectatorHotDiceMessage(hotDiceData.playerId);
            } else {
                console.error('🔥 showSpectatorHotDiceMessage function not found!');
            }
        } else {
            // console.log('🔥 Ignoring hot dice event - same player or invalid data');
        }
    });
}

// Set up listener for farkle alerts
function setupFarkleAlertListener() {
    if (!currentRoomId) return;
    
    const farkleAlertRef = database.ref(`rooms/${currentRoomId}/farkleAlerts`);
    
    farkleAlertListener = farkleAlertRef.on('child_added', (snapshot) => {
        const farkleData = snapshot.val();
        // console.log('💥 Farkle alert listener triggered:', farkleData);
        
        if (farkleData && farkleData.playerId !== currentPlayerId) {
            // console.log('💥 Farkle alert received for other player:', farkleData.playerId);
            // console.log('💥 Current player ID:', currentPlayerId);
            // console.log('💥 showSpectatorFarkleMessage function exists:', typeof showSpectatorFarkleMessage === 'function');
            // console.log('💥 window.showSpectatorFarkleMessage exists:', typeof window.showSpectatorFarkleMessage === 'function');
            
            // Show farkle message for spectator
            if (typeof showSpectatorFarkleMessage === 'function') {
                showSpectatorFarkleMessage(farkleData.playerId);
            } else if (typeof window.showSpectatorFarkleMessage === 'function') {
                window.showSpectatorFarkleMessage(farkleData.playerId);
            } else {
                console.error('💥 showSpectatorFarkleMessage function not found!');
            }
        } else {
            // console.log('💥 Ignoring farkle alert - same player or invalid data');
        }
    });
}

// Broadcast dice results via Firebase
function broadcastDiceResults(playerId, diceResults) {
    if (!currentRoomId || !database) return;
    
    // console.log(`🎲 Broadcasting dice results via Firebase for ${playerId}:`, diceResults);
    
    const diceResultsRef = database.ref(`rooms/${currentRoomId}/diceResults`);
    diceResultsRef.push({
        playerId: playerId,
        diceResults: diceResults,
        timestamp: Date.now()
    }).then(() => {
        // console.log('🎲 Dice results broadcast successfully');
    }).catch((error) => {
        console.error('❌ Error broadcasting dice results:', error);
    });
}

// Broadcast when rolling starts via Firebase
function broadcastRollingStart(playerId) {
    if (!currentRoomId || !database) return;
    
    // console.log(`🎲 Broadcasting rolling start via Firebase for ${playerId}`);
    
    const rollingStartRef = database.ref(`rooms/${currentRoomId}/rollingStart`);
    rollingStartRef.push({
        playerId: playerId,
        timestamp: Date.now()
    }).then(() => {
        // console.log('🎲 Rolling start broadcast successfully');
    }).catch((error) => {
        console.error('❌ Error broadcasting rolling start:', error);
    });
}

// Broadcast dice selection changes via Firebase
function broadcastDiceSelection(playerId, selectedDiceIndices, diceResults) {
    if (!currentRoomId || !database) return;
    
    // console.log(`🎯 Broadcasting dice selection via Firebase for ${playerId}:`, selectedDiceIndices);
    
    const diceSelectionRef = database.ref(`rooms/${currentRoomId}/diceSelections`);
    diceSelectionRef.push({
        playerId: playerId,
        selectedDiceIndices: selectedDiceIndices,
        diceResults: diceResults, // Include current dice results for context
        timestamp: Date.now()
    }).then(() => {
        // console.log('🎯 Dice selection broadcast successfully');
    }).catch((error) => {
        // console.error('❌ Error broadcasting dice selection:', error);
    });
}

// Broadcast locked dice state via Firebase
function broadcastLockedDice(playerId, lockedDiceIndices, diceResults) {
    if (!currentRoomId || !database) return;
    
    // Get current round number for filtering
    const currentRoundNumber = (typeof window.currentRound !== 'undefined') ? window.currentRound : 1;
    
    const dataToSend = {
        playerId: playerId,
        lockedDiceIndices: lockedDiceIndices,
        diceResults: diceResults, // Include current dice results for context
        roundNumber: currentRoundNumber, // Add round number for filtering
        timestamp: Date.now()
    };
    
    console.log('🔒 [BROADCAST DEBUG] Sending locked dice data:', {
        roomId: currentRoomId,
        sendingPlayer: playerId,
        currentRoundNumber: currentRoundNumber,
        lockedDiceIndices: lockedDiceIndices,
        diceResults: diceResults,
        timestamp: dataToSend.timestamp,
        formattedTime: new Date(dataToSend.timestamp).toLocaleTimeString(),
        fullPayload: dataToSend
    });
    
    const lockedDiceRef = database.ref(`rooms/${currentRoomId}/lockedDice`);
    lockedDiceRef.push(dataToSend).then(() => {
        console.log('🔒 [BROADCAST DEBUG] Locked dice broadcast successful:', {
            playerId: playerId,
            indices: lockedDiceIndices,
            round: currentRoundNumber
        });
    }).catch((error) => {
        console.error('❌ [BROADCAST DEBUG] Error broadcasting locked dice:', {
            error: error.message,
            playerId: playerId,
            room: currentRoomId,
            timestamp: new Date().toISOString()
        });
    });
}

// Broadcast material changes via Firebase
function broadcastMaterialChange(playerId, diceType, floorType) {
    if (!currentRoomId || !database) return;
    
    // console.log(`🎨 Broadcasting material change via Firebase for ${playerId}: Dice=${diceType}, Floor=${floorType}`);
    
    const materialChangesRef = database.ref(`rooms/${currentRoomId}/materialChanges`);
    materialChangesRef.push({
        playerId: playerId,
        diceType: diceType,
        floorType: floorType,
        timestamp: Date.now()
    }).then(() => {
        // console.log('🎨 Material change broadcast successfully');
    }).catch((error) => {
        // console.error('❌ Error broadcasting material change:', error);
    });
}

// Broadcast game settings to all players in the room
function broadcastGameSettings(gameSettings) {
    if (!currentRoomId || !database) {
        // console.warn('Cannot broadcast game settings - no room or database connection');
        return;
    }
    
    // console.log('🎮 Broadcasting game settings to all players:', gameSettings);
    
    // Save game settings to Firebase for all players in the room
    const gameSettingsRef = database.ref(`rooms/${currentRoomId}/gameSettings`);
    gameSettingsRef.set({
        ...gameSettings,
        updatedBy: currentPlayerId,
        timestamp: Date.now()
    }).then(() => {
        // console.log('✅ Game settings broadcast successfully');
    }).catch((error) => {
        // console.error('❌ Error broadcasting game settings:', error);
    });
}

// Broadcast game state (win conditions, final round) to all players in the room
function broadcastGameState(gameState, winTriggerPlayer = null, finalRoundTracker = {}) {
    if (!currentRoomId || !database) {
        // console.warn('Cannot broadcast game state - no room or database connection');
        return;
    }
    
    // console.log('🏆 Broadcasting game state to all players:', { gameState, winTriggerPlayer, finalRoundTracker });
    
    database.ref(`rooms/${currentRoomId}/gameState`).set({
        state: gameState,
        winTriggerPlayer: winTriggerPlayer,
        finalRoundTracker: finalRoundTracker,
        updatedBy: currentPlayerId,
        timestamp: Date.now()
    }).then(() => {
        // console.log('✅ Game state broadcast successfully');
    }).catch((error) => {
        // console.error('❌ Error broadcasting game state:', error);
    });
}

// Broadcast hot dice event to all players in the room
function broadcastHotDice(playerId) {
    console.log(`🔥 broadcastHotDice called for ${playerId}, roomId: ${currentRoomId}, database exists: ${!!database}`);
    
    if (!currentRoomId || !database) {
        console.error('🔥 Cannot broadcast hot dice - missing roomId or database');
        return;
    }
    
    // console.log(`🔥 Broadcasting hot dice event via Firebase for ${playerId}`);
    
    const hotDiceRef = database.ref(`rooms/${currentRoomId}/hotDiceEvents`);
    hotDiceRef.push({
        playerId: playerId,
        timestamp: Date.now()
    }).then(() => {
        // console.log('🔥 Hot dice event broadcast successfully');
    }).catch((error) => {
        console.error('❌ Error broadcasting hot dice event:', error);
    });
}

// Broadcast farkle alert to all players in the room
function broadcastFarkleAlert(playerId) {
    // console.log(`💥 broadcastFarkleAlert called for ${playerId}, roomId: ${currentRoomId}, database exists: ${!!database}`);
    
    if (!currentRoomId || !database) {
        console.error('💥 Cannot broadcast farkle alert - missing roomId or database');
        return;
    }
    
    // console.log(`💥 Broadcasting farkle alert via Firebase for ${playerId}`);
    
    const farkleAlertRef = database.ref(`rooms/${currentRoomId}/farkleAlerts`);
    farkleAlertRef.push({
        playerId: playerId,
        timestamp: Date.now()
    }).then(() => {
        // console.log('💥 Farkle alert broadcast successfully');
    }).catch((error) => {
        console.error('❌ Error broadcasting farkle alert:', error);
    });
}

// Reset all scores in the multiplayer room
function resetAllScores() {
    if (!currentRoomId || !database) {
        // console.warn('Cannot reset scores - no room or database connection');
        // Fallback to local reset for single player
        if (typeof initializePlayerScores === 'function') {
            const players = Object.keys(getAllPlayerScores() || {});
            initializePlayerScores(players);
        }
        if (typeof clearPendingPoints === 'function') {
            clearPendingPoints();
        }
        return;
    }
    
    // console.log('🔄 Resetting all scores in multiplayer room');
    
    // Reset all player scores in Firebase
    const playersRef = database.ref(`rooms/${currentRoomId}/players`);
    playersRef.once('value', (snapshot) => {
        const players = snapshot.val();
        if (players) {
            const updates = {};
            for (const playerId in players) {
                updates[`${playerId}/score`] = 0;
            }
            
            playersRef.update(updates).then(() => {
                // console.log('✅ All scores reset successfully in Firebase');
                
                // Also reset local pending points
                if (typeof clearPendingPoints === 'function') {
                    clearPendingPoints();
                }
                
                // Update UI
                if (typeof updateGameControlsState === 'function') {
                    updateGameControlsState();
                }
            }).catch((error) => {
                // console.error('❌ Error resetting scores in Firebase:', error);
            });
        }
    });
}

// Cleanup Firebase listeners
function cleanupFirebaseStateManager() {
    // console.log('🔥 Cleaning up Firebase State Manager');
    
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
    // console.log('💾 Cleared Farkle indicator states');
    
    if (gameStateListener && currentRoomId) {
        database.ref(`rooms/${currentRoomId}/gameState`).off('value', gameStateListener);
        gameStateListener = null;
    }
    
    if (playersStateListener && currentRoomId) {
        database.ref(`rooms/${currentRoomId}/players`).off('value', playersStateListener);
        playersStateListener = null;
    }
    
    if (gameSettingsListener && currentRoomId) {
        database.ref(`rooms/${currentRoomId}/gameSettings`).off('value', gameSettingsListener);
        gameSettingsListener = null;
    }
    
    if (diceResultsListener && currentRoomId) {
        database.ref(`rooms/${currentRoomId}/diceResults`).off('child_added', diceResultsListener);
        diceResultsListener = null;
    }
    
    if (rollingStartListener && currentRoomId) {
        database.ref(`rooms/${currentRoomId}/rollingStart`).off('child_added', rollingStartListener);
        rollingStartListener = null;
    }
    
    if (diceSelectionsListener && currentRoomId) {
        database.ref(`rooms/${currentRoomId}/diceSelections`).off('child_added', diceSelectionsListener);
        diceSelectionsListener = null;
    }
    
    if (lockedDiceListener && currentRoomId) {
        database.ref(`rooms/${currentRoomId}/lockedDice`).off('child_added', lockedDiceListener);
        lockedDiceListener = null;
    }
    
    if (materialChangesListener && currentRoomId) {
        database.ref(`rooms/${currentRoomId}/materialChanges`).off('child_added', materialChangesListener);
        materialChangesListener = null;
    }
    
    if (farkleStatesListener && currentRoomId) {
        database.ref(`rooms/${currentRoomId}/farkleStates`).off('value', farkleStatesListener);
        farkleStatesListener = null;
    }
    
    if (hotDiceListener && currentRoomId) {
        database.ref(`rooms/${currentRoomId}/hotDiceEvents`).off('child_added', hotDiceListener);
        hotDiceListener = null;
    }
    
    if (farkleAlertListener && currentRoomId) {
        database.ref(`rooms/${currentRoomId}/farkleAlerts`).off('child_added', farkleAlertListener);
        farkleAlertListener = null;
    }
    
    currentRoomId = null;
    currentPlayerId = null;
    currentPlayerName = null;
}

// Initialize game state for a new room
function initializeGameState() {
    if (!currentRoomId) return;
    
    // console.log('🔥 Initializing game state for room:', currentRoomId);
    
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
            // console.log('🔥 Game state initialized');
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
window.broadcastRollingStart = broadcastRollingStart;
window.broadcastMaterialChange = broadcastMaterialChange;
window.broadcastGameSettings = broadcastGameSettings;
window.broadcastGameState = broadcastGameState;
window.broadcastHotDice = broadcastHotDice;
window.broadcastFarkleAlert = broadcastFarkleAlert;
window.resetAllScores = resetAllScores;
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
    // console.log('🔥 isPlayerTurnFirebase called with:', {
    //     playerId,
    //     firebaseCurrentTurnPlayer: window.firebaseCurrentTurnPlayer,
    //     comparison: window.firebaseCurrentTurnPlayer === playerId,
    //     typeOfPlayerId: typeof playerId,
    //     typeOfFirebasePlayer: typeof window.firebaseCurrentTurnPlayer
    // });
    
    // FIXED: Add validation to handle undefined/null values properly
    if (!playerId) {
        // console.log('🔥 No playerId provided - returning false');
        return false;
    }
    
    // This will be set by the Firebase state manager when game state changes
    if (window.firebaseCurrentTurnPlayer) {
        return window.firebaseCurrentTurnPlayer === playerId;
    }
    // Fallback to original function if available
    if (typeof window.originalIsPlayerTurn === 'function') {
        // console.log('🔥 Falling back to original isPlayerTurn function');
        return window.originalIsPlayerTurn(playerId);
    }
    // console.log('🔥 No firebase turn player and no original function - returning false');
    return false;
};

// Store original function and override it
if (typeof isPlayerTurn === 'function' && !window.originalIsPlayerTurn) {
    window.originalIsPlayerTurn = isPlayerTurn;
    window.isPlayerTurn = window.isPlayerTurnFirebase;
}

// Function to clear all locked dice data from Firebase
function clearAllLockedDiceFromFirebase() {
    if (!currentRoomId) return;
    
    console.log('🧹 Clearing all locked dice data from Firebase');
    
    // Clear the lockedDice node in Firebase
    const lockedDiceRef = database.ref(`rooms/${currentRoomId}/lockedDice`);
    lockedDiceRef.remove().then(() => {
        console.log('🧹 Successfully cleared all locked dice data from Firebase');
        
        // Also clear local stored states
        if (typeof window.clearAllDiceLockedStyling === 'function') {
            window.clearAllDiceLockedStyling();
        }
        
        // Clear the global playerLockedDiceStates
        if (window.playerLockedDiceStates) {
            window.playerLockedDiceStates = {};
        }
        
    }).catch((error) => {
        // console.error('🧹 Error clearing locked dice data from Firebase:', error);
    });
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
        broadcastRollingStart,
        broadcastMaterialChange,
        broadcastGameSettings,
        broadcastGameState,
        broadcastHotDice,
        broadcastFarkleAlert,
        resetAllScores,
        cleanupFirebaseStateManager,
        clearAllLockedDiceFromFirebase,
        PLAYER_STATES
    };
}

// Make function globally available
window.clearAllLockedDiceFromFirebase = clearAllLockedDiceFromFirebase;
