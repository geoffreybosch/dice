// Turn System Integration for Multiplayer Farkle
// This file provides integration between the turn system and WebRTC multiplayer

// Turn-Based System Core Variables
let currentPlayerTurn = null;
let turnSystemPlayerList = [];
let currentPlayerIndex = 0;
let isMultiplayerMode = false;
let currentRound = 1; // Track the current game round

// Player material preferences storage
const playerMaterialPreferences = {};

// Scoring System Variables
let playerScores = {}; // Banked/permanent scores for each player
let pendingPoints = 0; // Points earned this turn but not yet banked
let currentTurnPoints = []; // Array of point awards this turn for display

// Win Detection Variables
let gameState = 'playing'; // 'playing', 'final_round', 'ended'
let winTriggerPlayer = null; // Player who first reached winning score
let finalRoundTracker = {}; // Tracks which players have had their final turn
let isWinModalShown = false; // Flag to prevent multiple win modals from being shown

// Core Turn System Functions
function initializeTurnSystem(players, isMultiplayer = false, preserveCurrentTurn = false) {
    // console.log(`Turn system initialized for ${players.length} players. First turn: ${players[0]}`);
    // console.log(`🔧 INIT DEBUG: isMultiplayer=${isMultiplayer}, preserveCurrentTurn=${preserveCurrentTurn}`);
    // console.log(`🔧 INIT DEBUG: Current pendingPoints=${pendingPoints}, currentPlayerTurn=${currentPlayerTurn}`);
    
    turnSystemPlayerList = [...players];
    
    if (preserveCurrentTurn && turnSystemPlayerList.includes(currentPlayerTurn)) {
        // console.log(`Turn system updated for ${turnSystemPlayerList.length} players. Current turn preserved: ${currentPlayerTurn}`);
    } else {
        // Only reset turn state if not preserving current turn
        currentPlayerIndex = 0;
        currentPlayerTurn = players[0] || null;
        // console.log(`Turn system updated for ${turnSystemPlayerList.length} players. Current turn preserved: ${currentPlayerTurn}`);
    }
    
    isMultiplayerMode = isMultiplayer;
    
    // Reset game state when starting new game
    if (!preserveCurrentTurn) {
        resetGameState();
    }
    
    // Initialize scoring system
    initializePlayerScores(players);
    
    // Only reset pending points if we're not preserving the current turn
    // This prevents pending points from being lost during Firebase state updates
    if (!preserveCurrentTurn) {
        pendingPoints = 0;
        currentTurnPoints = [];
        // console.log('🎮 TURN INIT: Reset pending points (new game/turn)');
    } else {
        // console.log('🎮 TURN INIT: Preserving pending points:', pendingPoints);
    }
    
    updateTurnDisplay();
    updatePendingPointsDisplay();
    updateRoundDisplay(); // Show round counter when game starts
}

function getCurrentPlayer() {
    return currentPlayerTurn;
}

function isPlayerTurn(playerId) {
    return currentPlayerTurn === playerId;
}

function nextTurn() {
    // console.log(`🔄 === nextTurn() START ===`);
    // console.log(`🔄 Current state - Player: ${currentPlayerTurn}, Index: ${currentPlayerIndex}, Players: [${turnSystemPlayerList.join(', ')}]`);
    
    if (turnSystemPlayerList.length === 0) {
        // console.log(`🔄 No players in list, returning null`);
        return null;
    }
    
    // When ending a turn, clear any pending points (they weren't banked)
    if (pendingPoints > 0) {
        // console.log(`Turn ended with ${pendingPoints} unbanked points - they are lost`);
        clearPendingPoints();
    }
    
    const oldPlayerIndex = currentPlayerIndex;
    const oldPlayer = currentPlayerTurn;
    
    // Check final round progress for the player whose turn is ending
    if (gameState === 'final_round') {
        // console.log(`🔄 In final round, checking progress for ending player: ${oldPlayer}`);
        
        // Only check final round progress if the oldPlayer is actually in the final round tracker
        // This prevents incorrectly marking players as finished when they haven't taken their turn
        if (finalRoundTracker.hasOwnProperty(oldPlayer)) {
            // console.log(`🔄 ${oldPlayer} is in final round tracker - checking their progress`);
            // Note: checkFinalRoundProgress will be called from Firebase state manager (endMyTurn)
            // so we don't need to call it here to avoid double-calling
        } else {
            // console.log(`🔄 ${oldPlayer} is not in final round tracker (probably the winning player) - skipping progress check`);
        }
        
        // If game has ended, don't advance turn
        if (gameState === 'ended') {
            // console.log(`🔄 Game has ended, not advancing turn`);
            return currentPlayerTurn;
        }
    }
    
    // Use Firebase state management instead of local turn tracking
    if (typeof endMyTurn === 'function') {
        // console.log('🔄 Using Firebase state management to end turn');
        endMyTurn(); // This will trigger Firebase state updates
        return currentPlayerTurn; // Return current player since Firebase will handle the transition
    } else {
        // Fallback to local turn management if Firebase not available
        currentPlayerIndex = (currentPlayerIndex + 1) % turnSystemPlayerList.length;
        currentPlayerTurn = turnSystemPlayerList[currentPlayerIndex];
        
        // console.log(`🔄 Turn advanced from ${oldPlayer} (index ${oldPlayerIndex}) to ${currentPlayerTurn} (index ${currentPlayerIndex})`);
        
        updateTurnDisplay();
        updatePendingPointsDisplay();
        
        // Apply the new player's material preferences
        if (isMultiplayerMode) {
            // console.log(`🔄 Applying material preferences for ${currentPlayerTurn}`);
            applyPlayerMaterialPreferences(currentPlayerTurn);
        }
    }
    
    // console.log(`🔄 === nextTurn() END ===`);
    return currentPlayerTurn;
}

function savePlayerMaterialPreferences(playerId, diceType, floorType) {
    playerMaterialPreferences[playerId] = {
        dice: diceType,
        floor: floorType,
        timestamp: Date.now()
    };
    
    // console.log(`Saved material preferences for ${playerId}: Dice=${diceType}, Floor=${floorType}`);
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
        // console.log(`Applied ${playerId}'s material preferences: Dice=${preferences.dice}, Floor=${preferences.floor}`);
    }
}

function updateTurnDisplay() {
    // NOTE: Farkle indicator clearing is now handled by Firebase state manager 
    // in updateTurnIndicators() when a player's turn actually starts
    
    // Check if current player is starting their final turn and show alert
    if (gameState === 'final_round' && currentPlayerTurn && finalRoundTracker.hasOwnProperty(currentPlayerTurn) && !finalRoundTracker[currentPlayerTurn]) {
        // This is the current player's final turn - show them a persistent alert
        if (typeof myPlayerId !== 'undefined' && currentPlayerTurn === myPlayerId) {
            // Show persistent alert for the current player's final turn (no timeout)
            if (typeof showGameAlert === 'function') {
                showGameAlert(
                    `⏳ This is your FINAL TURN! ⏳<br><small>Another player has reached the winning score - make it count!</small>`,
                    'warning',
                    0  // 0 means no timeout - alert stays visible for the entire turn
                );
            }
        }
    }
    
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
                // console.log('Player scores loaded from Firebase (current players only):', playerScores);
                updateScoreDisplayUI(); // Update ONLY the UI with loaded scores (no Firebase write)
            }
        }).catch((error) => {
            // console.error('Error loading existing scores from Firebase:', error);
        });
    }
    
    // console.log('Player scores initialized:', playerScores);
    
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
    
    // console.log(`🎲 PENDING POINTS DEBUG: Added ${points} points (${description})`);
    // console.log(`🎲 Previous pending: ${oldPendingPoints}, New pending: ${pendingPoints}`);
    // console.log(`🎲 Current turn points array:`, currentTurnPoints);
    
    updateTurnDisplay();
    updatePendingPointsDisplay();
}

function clearPendingPoints() {
    const lostPoints = pendingPoints;
    pendingPoints = 0;
    currentTurnPoints = [];
    
    // console.log(`Cleared ${lostPoints} pending points (farkle)`);
    updateTurnDisplay();
    updatePendingPointsDisplay();
    
    return lostPoints;
}

function bankPendingPoints(playerId = null) {
    // console.log('🏛️ === bankPendingPoints() START ===');
    // console.log('🏛️ Input playerId:', playerId);
    // console.log('🏛️ currentPlayerTurn:', currentPlayerTurn);
    // console.log('🏛️ window.myPlayerId:', window.myPlayerId);
    // console.log('🏛️ window.currentPlayerId:', window.currentPlayerId);
    // console.log('🏛️ 💰 PENDING POINTS AT BANKING START:', pendingPoints);
    // console.log('🏛️ 💰 CURRENT TURN POINTS:', currentTurnPoints);
    
    // CRITICAL FIX: Use Firebase currentPlayerId for multiplayer, fallback to currentPlayerTurn
    if (!playerId) {
        if (typeof window.currentPlayerId !== 'undefined' && window.currentPlayerId) {
            playerId = window.currentPlayerId;
            // console.log('🏛️ Using window.currentPlayerId as playerId:', playerId);
        } else {
            playerId = currentPlayerTurn;
            // console.log('🏛️ Using currentPlayerTurn as playerId:', playerId);
        }
    }
    
    // console.log('🏛️ Final playerId for banking:', playerId);
    
    if (pendingPoints <= 0) {
        // console.log('No pending points to bank');
        return 0;
    }

    // Check minimum score requirement for players with 0 points
    const currentPlayerScore = getPlayerScore(playerId);
    const gameSettings = (typeof getGameSettings === 'function') ? getGameSettings() : { minimumScore: 500 };
    const minimumRequired = gameSettings.minimumScore;
    
    if (currentPlayerScore === 0 && pendingPoints < minimumRequired) {
        // Show error message and prevent banking
        if (typeof showGameAlert === 'function') {
            showGameAlert(
                `❌ You need at least ${minimumRequired} points to get "on the board"<br><small>You currently have ${pendingPoints} pending points</small>`, 
                'danger', 
                4000
            );
        }
        return 0;
    }

    // Mark as critical operation to prevent connection cleanup during banking
    if (typeof startCriticalOperation === 'function') {
        startCriticalOperation();
    }
    
    const currentPendingPoints = pendingPoints; // Store the current pending points
    
    // Function to complete the banking process
    function completeBanking(existingScore = 0) {
        // console.log('🏦 === completeBanking() START ===');
        // console.log('🏦 Player ID:', playerId);
        // console.log('🏦 Existing score from Firebase:', existingScore);
        // console.log('🏦 Current pending points:', currentPendingPoints);
        // console.log('🏦 Current playerScores state:', playerScores);
        
        // Initialize player's banked score if not exists, or use existing score from Firebase
        if (!(playerId in playerScores)) {
            playerScores[playerId] = existingScore;
            // console.log('🏦 Initialized playerScores for', playerId, 'with', existingScore);
        } else {
            // console.log('🏦 Player', playerId, 'already in playerScores with score:', playerScores[playerId]);
        }
        
        // Add pending points to player's banked score
        playerScores[playerId] += currentPendingPoints;
        const newScore = playerScores[playerId];
        
        // console.log(`🏦 ${playerId} banked ${currentPendingPoints} points. New total: ${newScore} (was ${existingScore})`);
        
        // Clear pending points
        pendingPoints = 0;
        currentTurnPoints = [];
        
        updateTurnDisplay();
        updatePendingPointsDisplay();
        updateScoreDisplay();

        // Check for winning condition after banking
        checkWinCondition(playerId, newScore);

        // Use Firebase state management for banking
        if (typeof handlePlayerBanking === 'function') {
            // console.log('🔥 Using Firebase state management for banking');
            // console.log('🔥 Calling handlePlayerBanking with:', currentPendingPoints, newScore);
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
            
            // console.log('🔍 Banking: Direct Firebase lookup');
            // console.log('🔍 Room:', firebaseRoomId);
            // console.log('🔍 Player ID:', firebasePlayerId);
            // console.log('🔍 Firebase path:', `rooms/${firebaseRoomId}/players/${firebasePlayerId}`);
            
            playerRef.once('value', (snapshot) => {
                const player = snapshot.val();
                const existingScore = player ? (player.score || 0) : 0;
                
                // console.log('🔥 Found existing score for', firebasePlayerId, ':', existingScore);
                // console.log('🔥 Player data:', player);
                completeBanking(existingScore);
            }).catch((error) => {
                // console.error('Error fetching existing score:', error);
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
                            // console.log(`🔍 Found score by name search for ${playerId}: ${existingScore}`);
                            break;
                        }
                    }
                }
                
                completeBanking(existingScore);
            }).catch((error) => {
                // console.error('Error fetching existing score:', error);
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

// Fetch current scores from Firebase and execute callback with the scores
function fetchCurrentScoresFromFirebase(callback) {
    // Check if in multiplayer room
    if (typeof roomId !== 'undefined' && roomId && typeof database !== 'undefined') {
        // Use Firebase state manager's currentRoomId if available
        const firebaseRoomId = (typeof currentRoomId !== 'undefined' && currentRoomId) ? currentRoomId : roomId;
        const roomRef = database.ref(`rooms/${firebaseRoomId}/players`);
        
        // console.log('🔍 Fetching current scores from Firebase for win modal...');
        
        roomRef.once('value', (snapshot) => {
            const firebasePlayers = snapshot.val();
            const currentScores = {};
            
            if (firebasePlayers) {
                // Extract scores from Firebase data
                for (const id in firebasePlayers) {
                    const playerName = firebasePlayers[id].name;
                    const playerScore = firebasePlayers[id].score || 0;
                    currentScores[playerName] = playerScore;
                    // console.log(`🔍 Firebase score for ${playerName}: ${playerScore}`);
                }
            }
            
            // console.log('🔍 Final scores from Firebase:', currentScores);
            callback(currentScores);
        }).catch((error) => {
            // console.error('🔍 Error fetching scores from Firebase:', error);
            // Fallback to local scores if Firebase fails
            // console.log('🔍 Falling back to local scores:', playerScores);
            callback({ ...playerScores });
        });
    } else {
        // Single player mode or no Firebase - use local scores
        // console.log('🔍 No Firebase available, using local scores:', playerScores);
        callback({ ...playerScores });
    }
}

// Win Detection Functions
function checkWinCondition(playerId, newScore) {
    // Always fetch the latest winning score from a reliable source (not from possibly stale local data)
    let winningScore = 10000;
    if (typeof getGameSettings === 'function') {
        const gameSettings = getGameSettings();
        // If the host has changed the settings, ensure we get the latest value
        if (gameSettings && typeof gameSettings.winningScore === 'number' && gameSettings.winningScore > 0) {
            winningScore = gameSettings.winningScore;
        }
    }
    
    // console.log(`🏆 Checking win condition for ${playerId} with score ${newScore} (winning score: ${winningScore})`);
    
    // Check if this player has reached the winning score
    if (newScore >= winningScore && gameState === 'playing') {
        // console.log(`🏆 ${playerId} has reached the winning score! Entering final round...`);
        
        // Enter final round mode
        gameState = 'final_round';
        winTriggerPlayer = playerId;
        
        // Update global window reference
        if (typeof window !== 'undefined') {
            window.gameState = gameState;
        }
        
        // Initialize final round tracker - all players except the winning player need their final turn
        finalRoundTracker = {};
        turnSystemPlayerList.forEach(player => {
            if (player !== playerId) {
                finalRoundTracker[player] = false; // false = hasn't had final turn yet
            }
        });
        
        // console.log(`🏆 Final round tracker initialized for ${turnSystemPlayerList.length} total players:`);
        // console.log(`🏆   - Winning player: ${playerId} (excluded from tracker)`);
        // console.log(`🏆   - Players needing final turns:`, Object.keys(finalRoundTracker));
        // console.log(`🏆   - finalRoundTracker:`, JSON.stringify(finalRoundTracker));
        
        // Show different alerts for the winning player vs other players
        if (typeof showGameAlert === 'function') {
            // Check if the current client is the player who reached the winning score
            const myPlayerIdValue = (typeof window.myPlayerId !== 'undefined' && window.myPlayerId) || 
                                    (typeof window.currentPlayerId !== 'undefined' && window.currentPlayerId);
            const currentPlayerIdValue = (typeof window.currentPlayerId !== 'undefined' && window.currentPlayerId) ||
                                        (typeof getCurrentPlayer === 'function' && getCurrentPlayer());
            
            // console.log(`🏆 Player ID comparison debug:`);
            // console.log(`🏆   - winning player: "${playerId}"`);
            // console.log(`🏆   - window.myPlayerId: "${window.myPlayerId}"`);
            // console.log(`🏆   - myPlayerId: "${typeof window.myPlayerId !== 'undefined' ? window.myPlayerId : 'undefined'}"`);
            // console.log(`🏆   - currentPlayerId: "${currentPlayerIdValue}"`);
            // console.log(`🏆   - final comparison value: "${myPlayerIdValue}"`);
            
            if (myPlayerIdValue === playerId) {
                // Show congratulatory alert to the player who reached the winning score
                // console.log(`🏆 Showing congratulatory alert to winning player: ${playerId}`);
                showGameAlert(
                    `🎉 Congratulations! You've reached ${winningScore} points! 🎉<br><small>Your turn ends - other players get one final turn</small>`,
                    'success',
                    0  // Persistent alert for the winning player
                );
            } else {
                // Show informational alert to other players
                // console.log(`🏆 Showing informational alert to other player: ${myPlayerIdValue} about winner: ${playerId}`);
                showGameAlert(
                    `🏆 ${playerId} has reached ${winningScore} points!<br><small>Final round - all other players get one more turn</small>`,
                    'warning',
                    6000
                );
            }
        }
        
        // console.log('🏆 Final round tracker initialized:', finalRoundTracker);
        
        // Broadcast game state in multiplayer mode
        if (typeof isInMultiplayerRoom !== 'undefined' && isInMultiplayerRoom && typeof broadcastGameState === 'function') {
            broadcastGameState(gameState, winTriggerPlayer, finalRoundTracker);
        }
        
        // IMPORTANT: End the winning player's turn immediately after reaching the winning score
        // This ensures they don't get to continue playing after winning
        setTimeout(() => {
            // Check if this is the winning player and it's their turn
            const currentTurnPlayer = (typeof getCurrentTurn === 'function') ? getCurrentTurn() : currentPlayerTurn;
            if (currentTurnPlayer === playerId) {
                // console.log(`🏆 Ending ${playerId}'s turn after reaching winning score`);
                
                // Check if this is the current client's turn (they should end their own turn)
                const myPlayerIdValue = (typeof window.myPlayerId !== 'undefined' && window.myPlayerId) || 
                                        (typeof window.currentPlayerId !== 'undefined' && window.currentPlayerId);
                
                // Use Firebase state management if available and this is the current client's turn
                if (typeof isInMultiplayerRoom !== 'undefined' && isInMultiplayerRoom && typeof endMyTurn === 'function' && 
                    myPlayerIdValue === playerId) {
                    // console.log(`🏆 Using Firebase to end ${playerId}'s winning turn (current client)`);
                    endMyTurn();
                } else if (typeof nextTurn === 'function') {
                    // Fallback to local turn management
                    // console.log(`🏆 Using local turn management to end ${playerId}'s winning turn`);
                    nextTurn();
                }
            }
        }, 100); // Small delay to ensure all UI updates complete first
    }
}

function checkFinalRoundProgress(playerId, isTurnEnding = false) {
    if (gameState !== 'final_round') {
        // console.log(`🏆 checkFinalRoundProgress called but gameState is ${gameState}, not final_round - ignoring`);
        return;
    }
    
    // console.log(`🏆 checkFinalRoundProgress called for: ${playerId} (isTurnEnding: ${isTurnEnding})`);
    // console.log(`🏆 Current finalRoundTracker:`, JSON.stringify(finalRoundTracker));
    // console.log(`🏆 winTriggerPlayer: ${winTriggerPlayer}`);
    
    // Validate that the player ID is valid
    if (!playerId || typeof playerId !== 'string') {
        console.error(`🏆 Invalid playerId passed to checkFinalRoundProgress: ${playerId}`);
        return;
    }
    
    // Mark this player as having completed their final turn
    if (finalRoundTracker.hasOwnProperty(playerId)) {
        // If this is called when a turn is ending, always mark as completed
        // Otherwise, only mark as completed if this player is not the current player
        const currentTurnPlayer = (typeof getCurrentTurn === 'function') ? getCurrentTurn() : currentPlayerTurn;
        
        if (!isTurnEnding && currentTurnPlayer === playerId) {
            // console.log(`🏆 ${playerId} is the current player - NOT marking as completed (they're just starting their final turn)`);
            return; // Don't mark as completed if they're the current player and not ending turn
        }
        
        finalRoundTracker[playerId] = true;
        // console.log(`🏆 ${playerId} has completed their final turn`);
        // console.log(`🏆 Updated finalRoundTracker:`, JSON.stringify(finalRoundTracker));
    } else {
        // console.log(`🏆 ${playerId} is not in finalRoundTracker (probably the winning player)`);
    }
    
    // Check if all players have had their final turn
    const trackerValues = Object.values(finalRoundTracker);
    const allPlayersFinished = trackerValues.length > 0 && trackerValues.every(finished => finished);
    
    // console.log(`🏆 Final round check:`);
    // console.log(`🏆   - Players needing final turns: ${Object.keys(finalRoundTracker).length}`);
    // console.log(`🏆   - Tracker values: [${trackerValues.join(', ')}]`);
    // console.log(`🏆   - All players finished: ${allPlayersFinished}`);
    
    if (allPlayersFinished) {
        // console.log('🏆 All players have completed their final turns - ending game');
        endGame();
        
        // Broadcast final game state in multiplayer mode
        if (isInMultiplayerRoom && typeof broadcastGameState === 'function') {
            broadcastGameState(gameState, winTriggerPlayer, finalRoundTracker);
        }
    } else {
        // console.log('🏆 Still waiting for players to complete final turns:', finalRoundTracker);
        
        // Safeguard: Check if we might be stuck in final round due to tracking issues
        // Only check after a reasonable delay to give players time to take their turns
        setTimeout(() => {
            if (gameState === 'final_round') {
                // console.log('🏆 Safeguard check: Still in final round after timeout, checking if all players finished...');
                checkForStuckFinalRound();
            }
        }, 10000); // 10 second delay to allow players time to take their final turns
    }
}

function checkForStuckFinalRound() {
    if (gameState !== 'final_round') return;
    
    // console.log('🏆 Checking for stuck final round condition...');
    
    // Check if all players have actually completed their final turns
    const trackerValues = Object.values(finalRoundTracker);
    const allPlayersFinished = trackerValues.length > 0 && trackerValues.every(finished => finished);
    
    if (allPlayersFinished) {
        // console.log('🏆 Safeguard: All players have completed their final turns - ending game');
        // console.log('🏆 Safeguard: Final round tracker state:', finalRoundTracker);
        
        // End the game since all players have had their final turn
        endGame();
        
        // Broadcast final game state
        if (isInMultiplayerRoom && typeof broadcastGameState === 'function') {
            broadcastGameState('ended', winTriggerPlayer, finalRoundTracker);
        }
    } else {
        // console.log('🏆 Safeguard: Still waiting for players to complete final turns:', finalRoundTracker);
        // console.log('🏆 Safeguard: Not forcing game end - players still need their final turns');
        
        // Only force end if we detect a genuine stuck condition (e.g., player offline)
        // For now, let the normal turn progression continue
        // TODO: Add detection for truly stuck conditions (player offline, etc.)
    }
}

// Debug function to manually check and fix stuck game states
function debugGameState() {
    // console.log('🛠️ === DEBUG GAME STATE ===');
    // console.log('🛠️ gameState:', gameState);
    // console.log('🛠️ winTriggerPlayer:', winTriggerPlayer);
    // console.log('🛠️ finalRoundTracker:', JSON.stringify(finalRoundTracker));
    // console.log('🛠️ Current player scores:', playerScores);
    
    if (gameState === 'final_round') {
        // console.log('🛠️ Game is in final round - checking if it should end...');
        checkForStuckFinalRound();
    } else if (gameState === 'ended') {
        // console.log('🛠️ Game has ended - checking if win modal should show...');
        checkIfGameEndedAndShowModal();
    } else {
        // console.log('🛠️ Game is in playing state');
        
        // Check if any player has reached winning score but game hasn't entered final round
        let winningScore = 10000;
        if (typeof getGameSettings === 'function') {
            const gameSettings = getGameSettings();
            if (gameSettings && typeof gameSettings.winningScore === 'number' && gameSettings.winningScore > 0) {
                winningScore = gameSettings.winningScore;
            }
        }
        
        const playersAtWinningScore = Object.keys(playerScores).filter(player => playerScores[player] >= winningScore);
        
        if (playersAtWinningScore.length > 0) {
            // console.log('🛠️ Found players at winning score but game not in final round:', playersAtWinningScore);
            // console.log('🛠️ This may indicate a win detection bug');
            
            // Force trigger win condition for the first player found
            const winningPlayer = playersAtWinningScore[0];
            // console.log('🛠️ Force triggering win condition for:', winningPlayer);
            checkWinCondition(winningPlayer, playerScores[winningPlayer]);
        }
    }
    
    // console.log('🛠️ === END DEBUG ===');
}

function endGame() {
    gameState = 'ended';
    
    // Update global window reference
    if (typeof window !== 'undefined') {
        window.gameState = gameState;
    }
    
    // Fetch current scores from Firebase before determining winner
    fetchCurrentScoresFromFirebase((scores) => {
        const players = Object.keys(scores);
        
        if (players.length === 0) {
            console.error('🏆 No players found in scores for endGame');
            return;
        }
        
        // Sort players by score (highest first)
        const sortedPlayers = players.sort((a, b) => scores[b] - scores[a]);
        const winner = sortedPlayers[0];
        const winnerScore = scores[winner];
        
        // console.log('🏆 Game ended! Winner:', winner, 'Score:', winnerScore);
        // console.log('🏆 Final standings with Firebase scores:', sortedPlayers.map(p => `${p}: ${scores[p]}`));
        
        // Show win modal with Firebase scores
        showWinModal(winner, winnerScore, sortedPlayers, scores);
    });
}

function showWinModal(winner, winnerScore, sortedPlayers, scores) {
    // Prevent multiple win modals from being shown
    if (isWinModalShown) {
        // console.log('🏆 Win modal already shown, skipping duplicate call');
        return;
    }
    
    const winModal = document.getElementById('winModal');
    if (!winModal) {
        // console.error('🏆 Win modal not found!');
        return;
    }
    
    // console.log('🏆 Showing win modal for winner:', winner);
    isWinModalShown = true; // Set flag to prevent duplicate calls
    
    // Hide any game alerts (final turn, congratulations, etc.) when win modal is shown
    if (typeof hideGameAlertsForNewGame === 'function') {
        hideGameAlertsForNewGame();
    }
    
    // Clean up any existing modal state before showing new one
    cleanupAllModalBackdrops();
    
    // Update winner announcement
    const winnerAnnouncement = document.getElementById('winner-announcement');
    if (winnerAnnouncement) {
        winnerAnnouncement.textContent = `🎉 ${winner} Wins! 🎉`;
    }
    
    // Update winner score
    const winnerScoreElement = document.getElementById('winner-score');
    if (winnerScoreElement) {
        winnerScoreElement.textContent = `Final Score: ${winnerScore.toLocaleString()} points`;
    }
    
    // Update final scores table
    const finalScoresTable = document.getElementById('final-scores-table');
    if (finalScoresTable) {
        finalScoresTable.innerHTML = '';
        
        sortedPlayers.forEach((player, index) => {
            const row = document.createElement('tr');
            const rank = index + 1;
            let rankIcon = '';
            
            switch (rank) {
                case 1: rankIcon = '🥇'; break;
                case 2: rankIcon = '🥈'; break;
                case 3: rankIcon = '🥉'; break;
                default: rankIcon = `${rank}.`; break;
            }
            
            row.innerHTML = `
                <td class="fw-bold">${rankIcon}</td>
                <td class="${rank === 1 ? 'fw-bold text-success' : ''}">${player}</td>
                <td class="${rank === 1 ? 'fw-bold text-success' : ''}">${scores[player].toLocaleString()}</td>
            `;
            
            if (rank === 1) {
                row.classList.add('table-success');
            }
            
            finalScoresTable.appendChild(row);
        });
    }
    
    // Set up modal event handlers
    setupWinModalHandlers();
    
    // Check if modal instance already exists and dispose it first
    let existingModal = bootstrap.Modal.getInstance(winModal);
    if (existingModal) {
        // console.log('🧹 Disposing existing modal instance before creating new one');
        existingModal.dispose();
        cleanupAllModalBackdrops();
    }
    
    // Show the modal with a fresh instance
    const modal = new bootstrap.Modal(winModal);
    modal.show();
}

function setupWinModalHandlers() {
    const leaveGameBtn = document.getElementById('leave-game-btn');
    
    if (leaveGameBtn) {
        leaveGameBtn.onclick = () => {
            // console.log('🚪 Leave Game button clicked');
            leaveMultiplayerGame();
        };
    }
}

function cleanupAllModalBackdrops() {
    // console.log('🧹 Cleaning up all modal backdrops');
    
    // Remove ALL modal backdrops (there might be multiple)
    const allBackdrops = document.querySelectorAll('.modal-backdrop');
    allBackdrops.forEach((backdrop, index) => {
        backdrop.remove();
        // console.log(`🧹 Removed modal backdrop ${index + 1}/${allBackdrops.length}`);
    });
    
    // Restore body state
    document.body.classList.remove('modal-open');
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';
    // console.log('🧹 Restored body state');
}

function cleanupWinModal() {
    // console.log('🧹 Cleaning up win modal and backdrop');
    
    const winModal = bootstrap.Modal.getInstance(document.getElementById('winModal'));
    if (winModal) {
        winModal.hide();
        
        // Ensure backdrop is fully removed after modal is hidden
        document.getElementById('winModal').addEventListener('hidden.bs.modal', function (event) {
            // Remove any lingering backdrops (all of them)
            cleanupAllModalBackdrops();
            // Reset the flag so modal can be shown again
            isWinModalShown = false;
            // console.log('🧹 Completed modal cleanup after hidden event and reset flag');
        }, { once: true });
    } else {
        // Fallback: force remove modal backdrop and restore body state
        // console.log('🧹 Modal instance not found, using fallback cleanup');
        
        const modalElement = document.getElementById('winModal');
        if (modalElement) {
            modalElement.style.display = 'none';
            modalElement.classList.remove('show');
            modalElement.setAttribute('aria-hidden', 'true');
        }
        
        // Remove all lingering backdrops
        cleanupAllModalBackdrops();
        // Reset the flag so modal can be shown again
        isWinModalShown = false;
        // console.log('🧹 Completed fallback modal cleanup and reset flag');
    }
}

function restartMultiplayerGame() {
    // console.log('🔄 === restartMultiplayerGame() START ===');
    
    // Check if we're in a multiplayer room
    if (typeof roomId !== 'undefined' && roomId && typeof database !== 'undefined') {
        const firebaseRoomId = (typeof currentRoomId !== 'undefined' && currentRoomId) ? currentRoomId : roomId;
        const roomRef = database.ref(`rooms/${firebaseRoomId}/players`);
        
        // console.log('🔄 Resetting all player scores in Firebase room:', firebaseRoomId);
        
        // Reset all player scores to 0 in Firebase
        roomRef.once('value', (snapshot) => {
            const players = snapshot.val();
            if (players) {
                const updates = {};
                
                // Reset score for all players in the room
                for (const playerId in players) {
                    updates[`${playerId}/score`] = 0;
                    // console.log(`🔄 Resetting score for player ${playerId}/${players[playerId].name}`);
                }
                
                // Apply all score resets at once
                roomRef.update(updates).then(() => {
                    // console.log('🔄 All player scores reset successfully in Firebase');
                    
                    // Reset local game state
                    resetGameState();
                    
                    // Reset local player scores
                    Object.keys(playerScores).forEach(playerName => {
                        playerScores[playerName] = 0;
                    });
                    
                    // Clear pending points
                    pendingPoints = 0;
                    currentTurnPoints = [];
                    
                    // Update UI
                    updateScoreDisplayUI();
                    updatePendingPointsDisplay();
                    
                    // Reset Firebase game state for the room
                    const gameStateRef = database.ref(`rooms/${firebaseRoomId}/gameState`);
                    gameStateRef.remove().then(() => {
                        // console.log('🔄 Firebase game state cleared');
                    }).catch((error) => {
                        console.warn('🔄 Could not clear Firebase game state:', error);
                    });
                    
                    // Close the win modal properly with a small delay
                    setTimeout(() => {
                        cleanupWinModal();
                        
                        // Show success message after modal is closed
                        setTimeout(() => {
                            if (typeof showGameAlert === 'function') {
                                showGameAlert(
                                    '🔄 Game restarted! All scores have been reset to 0.',
                                    'success',
                                    4000
                                );
                            }
                        }, 500);
                    }, 100);
                    
                    // console.log('🔄 Game restart completed successfully');
                }).catch((error) => {
                    console.error('🔄 Error resetting player scores:', error);
                    if (typeof showGameAlert === 'function') {
                        showGameAlert(
                            '❌ Error restarting game. Please try again.',
                            'danger',
                            4000
                        );
                    }
                });
            } else {
                console.error('🔄 No players found in Firebase room');
            }
        }).catch((error) => {
            console.error('🔄 Error fetching players for restart:', error);
            if (typeof showGameAlert === 'function') {
                showGameAlert(
                    '❌ Error restarting game. Please try again.',
                    'danger',
                    4000
                );
            }
        });
    } else {
        // Single player mode - just reload the page
        // console.log('🔄 Single player mode - reloading page');
        window.location.reload();
    }
    
    // console.log('🔄 === restartMultiplayerGame() END ===');
}

function leaveMultiplayerGame() {
    // console.log('🚪 === leaveMultiplayerGame() START ===');
    
    // Clean up any modal backdrops immediately and reset flag
    cleanupAllModalBackdrops();
    isWinModalShown = false;
    
    // Hide game alerts since we're leaving to start a new game
    if (typeof hideGameAlertsForNewGame === 'function') {
        hideGameAlertsForNewGame();
    }
    
    // Check if we're in a multiplayer room
    if (typeof roomId !== 'undefined' && roomId && typeof database !== 'undefined') {
        const firebaseRoomId = (typeof currentRoomId !== 'undefined' && currentRoomId) ? currentRoomId : roomId;
        const myPlayerIdValue = (typeof window.myPlayerId !== 'undefined' && window.myPlayerId) || 
                                (typeof myPlayerId !== 'undefined' && myPlayerId) ||
                                (typeof window.currentPlayerId !== 'undefined' && window.currentPlayerId);
        
        if (myPlayerIdValue) {
            // console.log(`🚪 Removing player ${myPlayerIdValue} from Firebase room: ${firebaseRoomId}`);
            
            // Check if it's currently this player's turn and end it before leaving
            if (typeof window.firebaseCurrentTurnPlayer !== 'undefined' && 
                window.firebaseCurrentTurnPlayer === myPlayerIdValue &&
                typeof endMyTurn === 'function') {
                // console.log(`🚪 Player ${myPlayerIdValue} is leaving during their turn - ending turn first`);
                endMyTurn();
                
                // Wait a moment for the turn state to propagate before removing from Firebase
                setTimeout(() => {
                    proceedWithRemoval();
                }, 500);
                return;
            }
            
            proceedWithRemoval();
            
            function proceedWithRemoval() {
                // Remove this player from Firebase
                const playerRef = database.ref(`rooms/${firebaseRoomId}/players/${myPlayerIdValue}`);
                
                playerRef.remove().then(() => {
                // console.log('🚪 Player successfully removed from Firebase room');
                
                // Close the win modal properly
                cleanupWinModal();
                
                // Clear local state
                resetGameState();
                playerScores = {};
                pendingPoints = 0;
                currentTurnPoints = [];
                
                // Use Firebase room manager to leave the room if available
                if (typeof leaveRoom === 'function') {
                    // console.log('🚪 Using Firebase room manager to leave room');
                    leaveRoom();
                } else {
                    // Fallback: redirect to welcome page or reload
                    // console.log('🚪 Fallback: reloading page to exit room');
                    window.location.reload();
                }
                
                // console.log('🚪 Successfully left the game');
            }).catch((error) => {
                console.error('🚪 Error removing player from Firebase room:', error);
                if (typeof showGameAlert === 'function') {
                    showGameAlert(
                        '❌ Error leaving game. Please try again.',
                        'danger',
                        4000
                    );
                }
            });
            }
        } else {
            console.error('🚪 No player ID found for leaving game');
            // Fallback: just reload the page
            window.location.reload();
        }
    } else {
        // Single player mode or no Firebase - just reload the page
        // console.log('🚪 Single player mode or no Firebase - reloading page');
        window.location.reload();
    }
    
    // console.log('🚪 === leaveMultiplayerGame() END ===');
}

function resetGameState() {
    // Clean up any modal backdrops before resetting game state
    cleanupAllModalBackdrops();
    
    gameState = 'playing';
    winTriggerPlayer = null;
    finalRoundTracker = {};
    isWinModalShown = false; // Reset the win modal flag
    currentRound = 1; // Reset round counter to 1
    // Update global window reference
    if (typeof window !== 'undefined') {
        window.currentRound = currentRound;
        window.gameState = gameState;
    }
    updateRoundDisplay(); // Update the display
}

// Update game state from external source (e.g., multiplayer sync)
function updateWinGameState(newGameState, newWinTriggerPlayer, newFinalRoundTracker) {
    // console.log('🏆 === updateGameState() CALLED ===');
    // console.log('🏆 Updating game state from external source:', { newGameState, newWinTriggerPlayer, newFinalRoundTracker });
    
    const oldGameState = gameState;
    gameState = newGameState || 'playing';
    winTriggerPlayer = newWinTriggerPlayer || null;
    finalRoundTracker = newFinalRoundTracker || {};
    
    // Update global window reference
    if (typeof window !== 'undefined') {
        window.gameState = gameState;
    }
    
    // console.log(`🏆 updateGameState debug: oldGameState="${oldGameState}", newGameState="${gameState}", winTriggerPlayer="${winTriggerPlayer}"`);
    
    // Check if the current client is NOT the winning player
    const myPlayerIdValue = (typeof window.myPlayerId !== 'undefined' && window.myPlayerId) || 
                           (typeof myPlayerId !== 'undefined' && myPlayerId) ||
                           (typeof window.currentPlayerId !== 'undefined' && window.currentPlayerId) ||
                           (typeof getCurrentPlayerId === 'function' && getCurrentPlayerId());
    
    // console.log(`🏆 Player ID values check:`);
    // console.log(`🏆   - window.myPlayerId: "${window.myPlayerId}"`);
    // console.log(`🏆   - myPlayerId: "${typeof myPlayerId !== 'undefined' ? myPlayerId : 'undefined'}"`);
    // console.log(`🏆   - window.currentPlayerId: "${window.currentPlayerId}"`);
    // console.log(`🏆   - final myPlayerIdValue: "${myPlayerIdValue}"`);
    
    // If entering final round for the first time, show alert to other players
    if (gameState === 'final_round' && oldGameState !== 'final_round' && winTriggerPlayer) {
        // console.log(`🏆 Final round condition MET - showing alert check`);
        // console.log(`🏆 Final round started by ${winTriggerPlayer}, checking if I should show alert:`);
        // console.log(`🏆   - My player ID: "${myPlayerIdValue}"`);
        // console.log(`🏆   - Winning player: "${winTriggerPlayer}"`);
        // console.log(`🏆   - Should show alert: ${myPlayerIdValue !== winTriggerPlayer}`);
        
        if (myPlayerIdValue && myPlayerIdValue !== winTriggerPlayer) {
            // Show alert to other players about the final round
            if (typeof showGameAlert === 'function') {
                // console.log(`🏆 Showing final round alert to other player: ${myPlayerIdValue}`);
                
                // Get winning score for the alert
                const gameSettings = (typeof getGameSettings === 'function') ? getGameSettings() : { winningScore: 10000 };
                const winningScore = gameSettings.winningScore || 10000;
                
                showGameAlert(
                    `🏆 ${winTriggerPlayer} has reached ${winningScore} points!<br><small>Final round - all other players get one more turn</small>`,
                    'warning',
                    6000
                );
            } else {
                console.error(`🏆 showGameAlert function not available!`);
            }
        } else {
            // console.log(`🏆 Not showing alert - either no myPlayerIdValue (${myPlayerIdValue}) or I am the winning player (${winTriggerPlayer})`);
        }
    } else {
        // console.log(`🏆 updateGameState conditions not met:`);
        // console.log(`🏆   - gameState === 'final_round': ${gameState === 'final_round'}`);
        // console.log(`🏆   - oldGameState !== 'final_round': ${oldGameState !== 'final_round'}`);
        // console.log(`🏆   - winTriggerPlayer exists: ${!!winTriggerPlayer}`);
    }
    
    // console.log('🏆 === updateGameState() END ===');
    
    // If game has ended, show win modal (but only if we're not currently taking our turn)
    if (gameState === 'ended') {
        // Check if the current player is in the middle of their turn
        const currentTurnPlayer = (typeof getCurrentTurn === 'function') ? getCurrentTurn() : currentPlayerTurn;
        const myPlayerIdValue = (typeof window.myPlayerId !== 'undefined' && window.myPlayerId) || 
                               (typeof myPlayerId !== 'undefined' && myPlayerId) ||
                               (typeof window.currentPlayerId !== 'undefined' && window.currentPlayerId) ||
                               (typeof getCurrentPlayerId === 'function' && getCurrentPlayerId());
        
        // Special case: If I'm the winning player and the turn has come back to me after the game ended,
        // show the win modal immediately (don't wait for me to "end" my turn since the game is over)
        if (myPlayerIdValue === winTriggerPlayer && myPlayerIdValue === currentTurnPlayer) {
            // console.log(`🏆 Game ended and turn came back to winning player (${myPlayerIdValue}) - showing win modal immediately`);
            // Fetch current scores from Firebase before showing win modal
            fetchCurrentScoresFromFirebase((scores) => {
                const players = Object.keys(scores);
                
                if (players.length > 0) {
                    const sortedPlayers = players.sort((a, b) => scores[b] - scores[a]);
                    const winner = sortedPlayers[0];
                    const winnerScore = scores[winner];
                    
                    // console.log(`🏆 Showing win modal with Firebase scores:`, scores);
                    showWinModal(winner, winnerScore, sortedPlayers, scores);
                } else {
                    console.error('🏆 No players found in scores for win modal');
                }
            });
        }
        // Only show win modal if I'm not the current player (i.e., not in the middle of my turn)
        // This includes the winning player - they should wait for their next turn to see the modal
        else if (myPlayerIdValue !== currentTurnPlayer) {
            // console.log(`🏆 Game ended - showing win modal (I'm not the current player)`);
            // Fetch current scores from Firebase before showing win modal
            fetchCurrentScoresFromFirebase((scores) => {
                const players = Object.keys(scores);
                
                if (players.length > 0) {
                    const sortedPlayers = players.sort((a, b) => scores[b] - scores[a]);
                    const winner = sortedPlayers[0];
                    const winnerScore = scores[winner];
                    
                    // console.log(`🏆 Showing win modal with Firebase scores:`, scores);
                    showWinModal(winner, winnerScore, sortedPlayers, scores);
                } else {
                    console.error('🏆 No players found in scores for win modal');
                }
            });
        } else {
            // console.log(`🏆 Game ended but I'm the current player - will show win modal when my turn ends`);
        }
    }
}

function checkIfGameEndedAndShowModal() {
    // console.log('🏆 checkIfGameEndedAndShowModal called - gameState:', gameState, 'isWinModalShown:', isWinModalShown);
    
    // Prevent duplicate modal calls
    if (isWinModalShown) {
        // console.log('🏆 Win modal already shown, skipping checkIfGameEndedAndShowModal');
        return;
    }
    
    if (gameState === 'ended') {
        // console.log('🏆 Game has ended - showing win modal from checkIfGameEndedAndShowModal');
        
        // Fetch current scores from Firebase before showing win modal
        fetchCurrentScoresFromFirebase((scores) => {
            const players = Object.keys(scores);
            
            if (players.length > 0) {
                const sortedPlayers = players.sort((a, b) => scores[b] - scores[a]);
                const winner = sortedPlayers[0];
                const winnerScore = scores[winner];
                
                // console.log(`🏆 Showing win modal with Firebase scores from checkIfGameEndedAndShowModal:`, scores);
                showWinModal(winner, winnerScore, sortedPlayers, scores);
            } else {
                console.error('🏆 No players found in scores for win modal from checkIfGameEndedAndShowModal');
            }
        });
    } else {
        // console.log('🏆 Game has not ended yet - gameState:', gameState);
    }
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

// Round Counter Functions
function updateRoundDisplay() {
    const roundDisplay = document.getElementById('round-counter-display');
    const roundNumber = document.getElementById('round-number');
    
    if (roundDisplay && roundNumber) {
        roundNumber.textContent = currentRound;
        
        // Show the round counter when there are multiple players
        if (turnSystemPlayerList.length > 1) {
            roundDisplay.style.display = 'block';
        } else {
            roundDisplay.style.display = 'none';
        }
    }
}

function incrementRound() {
    // console.log('🎯 incrementRound() called! Current round:', currentRound);
    currentRound++;
    // console.log(`🎯 Round advanced to: ${currentRound}`);
    // Update global window reference
    if (typeof window !== 'undefined') {
        window.currentRound = currentRound;
    }
    updateRoundDisplay();
}

function updateScoreDisplayUI() {
    // Update player scores ONLY in the UI (no Firebase writes)
    // console.log('🎯 Updating UI with player scores:', playerScores);
    
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
                    // console.log(`🎯 UI updated for ${playerName}: ${playerScores[playerName]}`);
                }
            });
        }
    }
}

function updateScoreDisplay() {
    // Update player scores in the player list
    // console.log('🔄 === updateScoreDisplay() START ===');
    // console.log('🔄 Current playerScores:', playerScores);
    
    // First update the UI
    updateScoreDisplayUI();
    
    // Then update Firebase database with new scores for multiplayer rooms
    if (typeof roomId !== 'undefined' && roomId && typeof database !== 'undefined') {
        // console.log('🔄 Updating Firebase with local scores...');
        const roomRef = database.ref(`rooms/${roomId}/players`);
        
        // Get current players and update their scores
        roomRef.once('value', (snapshot) => {
            const players = snapshot.val();
            // console.log('🔄 Firebase players from DB:', players);
            
            if (players) {
                const updates = {};
                
                for (const playerId in players) {
                    const playerName = players[playerId].name;
                    // console.log(`🔄 Processing Firebase player ID: ${playerId}, name: ${playerName}`);
                    
                    if (playerScores[playerName] !== undefined) {
                        // console.log(`🔄 Will update ${playerId}/${playerName} score: ${playerScores[playerName]}`);
                        // Set the score in Firebase to match our local playerScores
                        updates[`${playerId}/score`] = playerScores[playerName];
                    } else {
                        // console.log(`🔄 Skipping ${playerId}/${playerName} - not in local playerScores`);
                    }
                }
                
                // console.log('🔄 Final Firebase updates to apply:', updates);
                
                // Apply all updates at once
                if (Object.keys(updates).length > 0) {
                    roomRef.update(updates).then(() => {
                        // console.log('🔄 Firebase scores updated successfully');
                    }).catch((error) => {
                        // console.error('🔄 Error updating Firebase scores:', error);
                    });
                } else {
                    // console.log('🔄 No Firebase updates needed');
                }
            }
        });
    } else {
        // console.log('🔄 No Firebase room found - UI only update');
    }
    
    // console.log('🔄 === updateScoreDisplay() END ===');
}

// Integration functions for WebRTC system
function onRoomJoined(roomId, playerId, playerList) {
    // console.log(`Room joined: ${roomId}, Player: ${playerId}`);
    
    // Initialize multiplayer turn system
    if (typeof initializeMultiplayerMode === 'function') {
        initializeMultiplayerMode(roomId, playerId, playerList);
    }
}

function onPlayerJoined(playerId, updatedPlayerList) {
    // console.log(`Player joined: ${playerId}`);
    
    // Update player list but preserve the current turn
    if (typeof initializeTurnSystem === 'function') {
        initializeTurnSystem(updatedPlayerList, true, true); // Third parameter preserves current turn
        updateGameControlsState();
    }
}

function onPlayerLeft(playerId, updatedPlayerList) {
    // console.log(`Player left: ${playerId}`);
    
    // Update player list and reinitialize turn system
    if (typeof initializeTurnSystem === 'function') {
        initializeTurnSystem(updatedPlayerList, true, true); // Preserve current turn and pending points
        updateGameControlsState();
    }
}

function onRoomLeft() {
    // console.log('Left multiplayer room');
    
    // Return to single player mode
    if (typeof exitMultiplayerMode === 'function') {
        exitMultiplayerMode();
    }
}

// Message handlers for turn synchronization
function onTurnChangeReceived(data) {
    // console.log(`📨 === onTurnChangeReceived() START ===`);
    // console.log(`📨 Received data:`, data);
    
    const { currentPlayer, playerList } = data;
    
    // console.log(`� Turn change: ${currentPlayerTurn} → ${currentPlayer}`);
    // console.log(`📨 My player ID: ${typeof myPlayerId !== 'undefined' ? myPlayerId : 'undefined'}`);
    // console.log(`📨 Is multiplayer room: ${typeof isInMultiplayerRoom !== 'undefined' ? isInMultiplayerRoom : 'undefined'}`);
    
    // Update local turn state without advancing (since it was advanced remotely)
    const oldPlayer = currentPlayerTurn;
    currentPlayerTurn = currentPlayer;
    // console.log(`✅ Updated current player to: ${currentPlayerTurn}`);
    
    // Update displays and controls
    updateTurnDisplay();
    
    // Call updateGameControlsState if it exists
    if (typeof updateGameControlsState === 'function') {
        updateGameControlsState();
        // console.log('✅ Called updateGameControlsState');
        
        // Log the player list state after update
        const playerListContainer = document.getElementById('player-list');
        if (playerListContainer) {
            const activePlayer = playerListContainer.querySelector('.list-group-item-success .player-name-text');
            const activeTurnIndicator = playerListContainer.querySelector('.turn-indicator[style*="inline"]');
            // console.log(`🎯 Player list after update: active player="${activePlayer?.textContent || 'none'}", turn indicator visible="${!!activeTurnIndicator}"`);
        } else {
            // console.warn('❌ Player list container not found');
        }
    } else {
        // console.warn('❌ updateGameControlsState function not available');
    }
    
    // Clear other players' dice results when it becomes your turn
    if (typeof canPlayerAct === 'function' && canPlayerAct() && typeof myPlayerId !== 'undefined' && currentPlayer === myPlayerId) {
        // console.log('🎲 It\'s now my turn - clearing dice display');
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
        // console.log('⏳ Not my turn yet, waiting...');
    }
    
    // Apply the new player's material preferences
    if (typeof isInMultiplayerRoom !== 'undefined' && isInMultiplayerRoom && typeof applyPlayerMaterialPreferences === 'function') {
        // console.log(`📨 Applying material preferences for ${currentPlayer}`);
        applyPlayerMaterialPreferences(currentPlayer);
    }
    
    // console.log(`📨 === onTurnChangeReceived() END ===`);
}

function onMaterialChangeReceived(data) {
    const { playerId, diceType, floorType } = data;
    
    // console.log(`Received material change from ${playerId}: Dice=${diceType}, Floor=${floorType}`);
    
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
    // console.log(`📡 Turn change broadcasting handled by Firebase for: ${nextPlayerId}`);
}

function broadcastMaterialChange(playerId, diceType, floorType) {
    // Use Firebase for material change broadcasting
    if (typeof window.broadcastMaterialChange === 'function') {
        window.broadcastMaterialChange(playerId, diceType, floorType);
    } else {
        // console.error('❌ Firebase broadcastMaterialChange function not available');
    }
    
    // console.log(`Broadcasting material change: ${playerId} -> Dice=${diceType}, Floor=${floorType}`);
}

function onDiceResultsReceived(data) {
    const { playerId, diceResults } = data;
    
    // console.log(`🎲 onDiceResultsReceived - Player ${playerId}:`, diceResults);
    
    // Stop rolling animation for this player when they finish rolling
    if (typeof window.otherPlayersRolling !== 'undefined') {
        // console.log('🎲 Stopping rolling animation for player:', playerId);
        window.otherPlayersRolling.delete(playerId);
        
        // Clear logged players when animation stops
        if (typeof displayOtherPlayerRollingAnimation.loggedPlayers !== 'undefined') {
            displayOtherPlayerRollingAnimation.loggedPlayers.delete(playerId);
        }
        if (typeof displayOtherPlayerRollingAnimation.loggedLockedDice !== 'undefined') {
            displayOtherPlayerRollingAnimation.loggedLockedDice.delete(playerId);
        }
        
        // Stop animation interval if no players are rolling
        if (window.otherPlayerAnimationInterval !== null && 
            window.otherPlayersRolling.size === 0) {
            // console.log('🎲 Clearing animation interval - no more rolling players');
            clearInterval(window.otherPlayerAnimationInterval);
            window.otherPlayerAnimationInterval = null;
        }
    }
    
    // Show other players' results if it's not our own roll
    const myId = typeof myPlayerId !== 'undefined' ? myPlayerId : (typeof window.myPlayerId !== 'undefined' ? window.myPlayerId : null);
    
    if (playerId !== myId) {
        // console.log('🎲 Displaying other player results');
        // Update the dice display to show the other player's results
        if (typeof displayOtherPlayerResults === 'function') {
            displayOtherPlayerResults(playerId, diceResults);
        } else {
            // console.log('🎲 displayOtherPlayerResults function not available, using fallback');
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
        fetchCurrentScoresFromFirebase,
        updatePendingPointsDisplay,
        updateScoreDisplay,
        updateScoreDisplayUI,
        updateRoundDisplay,
        incrementRound,
        // Win detection functions
        checkWinCondition,
        checkFinalRoundProgress,
        checkForStuckFinalRound,
        debugGameState,
        endGame,
        showWinModal,
        setupWinModalHandlers,
        cleanupWinModal,
        cleanupAllModalBackdrops,
        restartMultiplayerGame,
        leaveMultiplayerGame,
        resetGameState,
        updateWinGameState,
        checkIfGameEndedAndShowModal,
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

// Browser global assignments
if (typeof window !== 'undefined') {
    window.updateRoundDisplay = updateRoundDisplay;
    window.incrementRound = incrementRound;
    window.currentRound = currentRound; // Make current round globally accessible
    window.gameState = gameState; // Make game state globally accessible
    window.cleanupAllModalBackdrops = cleanupAllModalBackdrops; // Make cleanup function globally accessible
    
    // Clean up modal backdrops on page unload/reload
    window.addEventListener('beforeunload', () => {
        if (typeof cleanupAllModalBackdrops === 'function') {
            cleanupAllModalBackdrops();
        }
    });
}
