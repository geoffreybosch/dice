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
function initializeTurnSystem(players, isMultiplayer = false) {
    turnSystemPlayerList = [...players];
    currentPlayerIndex = 0;
    currentPlayerTurn = turnSystemPlayerList[0] || null;
    isMultiplayerMode = isMultiplayer;
    
    // Initialize scoring system
    initializePlayerScores(players);
    pendingPoints = 0;
    currentTurnPoints = [];
    
    console.log(`Turn system initialized for ${turnSystemPlayerList.length} players. First turn: ${currentPlayerTurn}`);
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
    if (turnSystemPlayerList.length === 0) return null;
    
    // When ending a turn, clear any pending points (they weren't banked)
    if (pendingPoints > 0) {
        console.log(`Turn ended with ${pendingPoints} unbanked points - they are lost`);
        clearPendingPoints();
    }
    
    currentPlayerIndex = (currentPlayerIndex + 1) % turnSystemPlayerList.length;
    currentPlayerTurn = turnSystemPlayerList[currentPlayerIndex];
    
    console.log(`Turn advanced to: ${currentPlayerTurn}`);
    updateTurnDisplay();
    updatePendingPointsDisplay();
    
    // Apply the new player's material preferences
    if (isMultiplayerMode) {
        applyPlayerMaterialPreferences(currentPlayerTurn);
    }
    
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
    const turnIndicator = document.getElementById('turn-indicator');
    if (turnIndicator && currentPlayerTurn) {
        let displayText = `Current Turn: ${currentPlayerTurn}`;
        
        // Add pending points to display if any
        if (pendingPoints > 0) {
            displayText += ` (Pending: ${pendingPoints} pts)`;
        }
        
        turnIndicator.textContent = displayText;
        turnIndicator.className = 'alert alert-info';
    }
}

// Scoring System Functions
function initializePlayerScores(players) {
    // Initialize scores for all players
    players.forEach(playerId => {
        if (!(playerId in playerScores)) {
            playerScores[playerId] = 0;
        }
    });
    
    // If in multiplayer room, fetch existing scores from Firebase
    if (typeof roomId !== 'undefined' && roomId && typeof database !== 'undefined') {
        const roomRef = database.ref(`rooms/${roomId}/players`);
        
        roomRef.once('value', (snapshot) => {
            const firebasePlayers = snapshot.val();
            if (firebasePlayers) {
                // Update local scores with Firebase scores
                for (const id in firebasePlayers) {
                    const playerName = firebasePlayers[id].name;
                    if (playerScores[playerName] !== undefined) {
                        playerScores[playerName] = firebasePlayers[id].score || 0;
                    }
                }
                console.log('Player scores loaded from Firebase:', playerScores);
                updateScoreDisplay(); // Update the UI with loaded scores
            }
        }).catch((error) => {
            console.error('Error loading existing scores from Firebase:', error);
        });
    }
    
    console.log('Player scores initialized:', playerScores);
}

function addPendingPoints(points, description = '') {
    pendingPoints += points;
    currentTurnPoints.push({
        points: points,
        description: description,
        timestamp: Date.now()
    });
    
    console.log(`Added ${points} pending points${description ? ` (${description})` : ''}. Total pending: ${pendingPoints}`);
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
    if (!playerId) {
        playerId = currentPlayerTurn;
    }
    
    if (pendingPoints <= 0) {
        console.log('No pending points to bank');
        return 0;
    }
    
    const currentPendingPoints = pendingPoints; // Store the current pending points
    
    // Function to complete the banking process
    function completeBanking(existingScore = 0) {
        // Initialize player's banked score if not exists, or use existing score from Firebase
        if (!(playerId in playerScores)) {
            playerScores[playerId] = existingScore;
        }
        
        // Add pending points to player's banked score
        playerScores[playerId] += currentPendingPoints;
        
        console.log(`${playerId} banked ${currentPendingPoints} points. New total: ${playerScores[playerId]} (was ${existingScore})`);
        
        // Clear pending points
        pendingPoints = 0;
        currentTurnPoints = [];
        
        updateTurnDisplay();
        updatePendingPointsDisplay();
        updateScoreDisplay();
        
        return currentPendingPoints;
    }
    
    // Check if in multiplayer room and get existing Firebase score
    if (typeof roomId !== 'undefined' && roomId && typeof database !== 'undefined') {
        const roomRef = database.ref(`rooms/${roomId}/players`);
        
        roomRef.once('value', (snapshot) => {
            const players = snapshot.val();
            let existingScore = 0;
            
            if (players) {
                // Find the current player's existing score in Firebase
                for (const id in players) {
                    if (players[id].name === playerId) {
                        existingScore = players[id].score || 0;
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

function updateScoreDisplay() {
    // Update player scores in the player list
    console.log('Updated player scores:', playerScores);
    
    // Update local player list badges (both Firebase and WebRTC)
    const playerListContainer = document.getElementById('player-list');
    if (playerListContainer) {
        const playerList = playerListContainer.querySelector('ul');
        if (playerList) {
            const listItems = playerList.querySelectorAll('li');
            listItems.forEach(li => {
                const playerName = li.textContent.split(' ')[0]; // Get player name (first part before score)
                const scoreBadge = li.querySelector('.badge');
                
                if (scoreBadge && playerScores[playerName] !== undefined) {
                    scoreBadge.textContent = playerScores[playerName];
                }
            });
        }
    }
    
    // Update Firebase database with new scores for multiplayer rooms
    if (typeof roomId !== 'undefined' && roomId && typeof database !== 'undefined') {
        const roomRef = database.ref(`rooms/${roomId}/players`);
        
        // Get current players and update their scores
        roomRef.once('value', (snapshot) => {
            const players = snapshot.val();
            if (players) {
                const updates = {};
                
                for (const playerId in players) {
                    const playerName = players[playerId].name;
                    if (playerScores[playerName] !== undefined) {
                        // Set the score in Firebase to match our local playerScores
                        updates[`${playerId}/score`] = playerScores[playerName];
                    }
                }
                
                // Apply all updates at once
                if (Object.keys(updates).length > 0) {
                    roomRef.update(updates).then(() => {
                        console.log('Firebase scores updated successfully');
                    }).catch((error) => {
                        console.error('Error updating Firebase scores:', error);
                    });
                }
            }
        });
    }
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
    
    // Update player list and reinitialize turn system
    if (typeof initializeTurnSystem === 'function') {
        initializeTurnSystem(updatedPlayerList, true);
        updateGameControlsState();
    }
}

function onPlayerLeft(playerId, updatedPlayerList) {
    console.log(`Player left: ${playerId}`);
    
    // Update player list and reinitialize turn system
    if (typeof initializeTurnSystem === 'function') {
        initializeTurnSystem(updatedPlayerList, true);
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
    const { currentPlayer, playerList } = data;
    
    console.log(`🔄 Received turn change: ${currentPlayer}`);
    console.log(`My player ID: ${typeof myPlayerId !== 'undefined' ? myPlayerId : 'undefined'}`);
    console.log(`Previous current player: ${currentPlayerTurn}`);
    console.log(`Is multiplayer room: ${typeof isInMultiplayerRoom !== 'undefined' ? isInMultiplayerRoom : 'undefined'}`);
    
    // Update local turn state without advancing (since it was advanced remotely)
    currentPlayerTurn = currentPlayer;
    console.log(`✅ Updated current player to: ${currentPlayerTurn}`);
    
    // Update displays and controls
    updateTurnDisplay();
    
    // Call updateGameControlsState if it exists
    if (typeof updateGameControlsState === 'function') {
        updateGameControlsState();
        console.log('✅ Called updateGameControlsState');
    } else {
        console.warn('❌ updateGameControlsState function not available');
    }
    
    // Clear other players' dice results when it becomes your turn
    if (typeof canPlayerAct === 'function' && canPlayerAct() && typeof myPlayerId !== 'undefined' && currentPlayer === myPlayerId) {
        console.log('🎲 It\'s now my turn - clearing dice display');
        const diceResultsContainer = document.getElementById('dice-results-container');
        if (diceResultsContainer) {
            diceResultsContainer.innerHTML = '<p class="text-muted">Click "Roll Dice" to start your turn</p>';
        }
    } else {
        console.log('⏳ Not my turn yet, waiting...');
    }
    
    // Apply the new player's material preferences
    if (typeof isInMultiplayerRoom !== 'undefined' && isInMultiplayerRoom && typeof applyPlayerMaterialPreferences === 'function') {
        applyPlayerMaterialPreferences(currentPlayer);
    }
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
    const data = {
        type: 'turn_change',
        currentPlayer: nextPlayerId,
        timestamp: Date.now()
    };
    
    console.log(`Broadcasting turn change to: ${nextPlayerId}`, data);
    
    // Send via WebRTC data channels
    if (typeof sendToAllPeers === 'function') {
        console.log('sendToAllPeers function is available, attempting to send...');
        sendToAllPeers(JSON.stringify(data));
    } else {
        console.error('sendToAllPeers function not available!');
    }
}

function broadcastMaterialChange(playerId, diceType, floorType) {
    const data = {
        type: 'material_change',
        playerId: playerId,
        diceType: diceType,
        floorType: floorType,
        timestamp: Date.now()
    };
    
    // Send via WebRTC data channels
    if (typeof sendToAllPeers === 'function') {
        sendToAllPeers(JSON.stringify(data));
    }
    
    console.log(`Broadcasting material change: ${playerId} -> Dice=${diceType}, Floor=${floorType}`);
}

// Message router for incoming WebRTC messages
function handleIncomingMessage(senderId, messageData) {
    try {
        const data = JSON.parse(messageData);
        
        switch (data.type) {
            case 'turn_change':
                onTurnChangeReceived(data);
                break;
            case 'material_change':
                onMaterialChangeReceived(data);
                break;
            case 'dice_results':
                onDiceResultsReceived(data);
                break;
            default:
                console.log(`Unknown message type: ${data.type}`);
        }
    } catch (error) {
        console.error('Error handling incoming message:', error);
    }
}

function broadcastDiceResults(playerId, diceResults) {
    const data = {
        type: 'dice_results',
        playerId: playerId,
        diceResults: diceResults,
        timestamp: Date.now()
    };
    
    // Send via WebRTC data channels
    if (typeof sendToAllPeers === 'function') {
        sendToAllPeers(JSON.stringify(data));
    }
    
    console.log(`Broadcasting dice results for ${playerId}:`, diceResults);
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
        onDiceResultsReceived,
        handleIncomingMessage
    };
}
