let firebaseConfig = {};
let database;
let playersRef;

// Load Firebase config from JSON file and initialize
fetch('./firebase-config.json')
  .then(response => {
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  })
  .then(config => {
    firebaseConfig = config;
    // Initialize Firebase
    firebase.initializeApp(firebaseConfig);
    database = firebase.database();
    
    // Initialize Firebase references after database is ready
    initializeFirebaseRefs();
  })
  .catch(error => {
    console.error('Error loading Firebase config:', error);
  });

// Initialize Firebase references and event listeners
function initializeFirebaseRefs() {
  // Reference to the players in the Firebase database
  playersRef = database.ref('players');
  
  // Listen for changes in the players data
  playersRef.on('value', updatePlayerList);
  
  // Initialize event listeners
  initializeEventListeners();
}

// Initialize all event listeners
function initializeEventListeners() {
  // Test Firebase connection
  const testButton = document.getElementById('test-firebase');
  if (testButton) {
    testButton.addEventListener('click', testFirebaseConnection);
  }
  
  // Admin functions
  const clearRoomButton = document.getElementById('clear-room');
  const resetScoresButton = document.getElementById('reset-scores');
  const clearDatabaseButton = document.getElementById('clear-database');
  
  if (clearRoomButton) {
    clearRoomButton.addEventListener('click', handleClearRoom);
  }
  
  if (resetScoresButton) {
    resetScoresButton.addEventListener('click', handleResetScores);
  }
  
  if (clearDatabaseButton) {
    clearDatabaseButton.addEventListener('click', handleClearDatabase);
  }
}

// Test Firebase connection function
function testFirebaseConnection() {
    const testRef = database.ref('test');
    const statusElement = document.getElementById('test-firebase-status');
    
    // Hide the status while testing
    if (statusElement) {
        statusElement.style.display = 'none';
    }
    
    testRef.set({
        message: 'Firebase is working!'
    }).then(() => {
        // Show green checkbox on success
        if (statusElement) {
            statusElement.style.display = 'inline';
            // Hide the checkbox after 3 seconds
            setTimeout(() => {
                statusElement.style.display = 'none';
            }, 3000);
        }
    }).catch((error) => {
        console.error('Error writing to Firebase:', error);
        alert('Failed to write to Firebase. Check the console for details.');
    });
}

// Ensure the player list element exists before updating
function updatePlayerList(snapshot) {
    const playerListContainer = document.getElementById('player-list');
    if (!playerListContainer) {
        console.error('Player list container not found.');
        return;
    }

    const firebasePlayerList = playerListContainer.querySelector('ul');
    if (!firebasePlayerList) {
        console.error('Player list element not found.');
        return;
    }

    firebasePlayerList.innerHTML = ''; // Clear the current list
    
    // Show/hide player list title based on whether there are players
    const playerListTitle = document.getElementById('player-list-title');
    let hasPlayers = false;

    snapshot.forEach(childSnapshot => {
        const playerData = childSnapshot.val();
        if (playerData && playerData.name && playerData.score !== undefined) {
            hasPlayers = true;
            const listItem = document.createElement('li');
            listItem.className = 'list-group-item d-flex justify-content-between align-items-center';
            listItem.setAttribute('data-player-name', playerData.name);
            
            // Create player name with turn indicator (matching WebRTC structure)
            const playerNameSpan = document.createElement('span');
            playerNameSpan.className = 'player-name-text';
            playerNameSpan.textContent = playerData.name;
            
            const turnIndicator = document.createElement('span');
            turnIndicator.className = 'turn-indicator badge bg-success ms-2';
            turnIndicator.textContent = '●';
            turnIndicator.style.display = 'none';
            
            // Create Farkle indicator
            const farkleIndicator = document.createElement('span');
            farkleIndicator.className = 'farkle-indicator ms-2';
            farkleIndicator.textContent = '⚠️';
            farkleIndicator.style.display = 'none';
            farkleIndicator.title = 'This player just Farkled!';
            
            const playerNameContainer = document.createElement('div');
            playerNameContainer.className = 'd-flex align-items-center';
            playerNameContainer.appendChild(playerNameSpan);
            playerNameContainer.appendChild(turnIndicator);
            playerNameContainer.appendChild(farkleIndicator);

            const scoreBadge = document.createElement('span');
            scoreBadge.className = 'badge bg-primary rounded-pill';
            scoreBadge.style.fontSize = '1.4em';
            scoreBadge.textContent = playerData.score;

            listItem.appendChild(playerNameContainer);
            listItem.appendChild(scoreBadge);
            firebasePlayerList.appendChild(listItem);
        }
    });
    
    // Show player list title if there are players
    if (playerListTitle) {
        playerListTitle.style.display = hasPlayers ? 'block' : 'none';
    }
}

// Utility function to show status messages
function showAdminStatus(buttonId, message, isSuccess = true, duration = 3000) {
    const statusElement = document.getElementById(`${buttonId}-status`);
    if (statusElement) {
        statusElement.textContent = message;
        statusElement.className = `mt-2 small ${isSuccess ? 'text-success' : 'text-danger'}`;
        statusElement.style.display = 'block';
        
        setTimeout(() => {
            statusElement.style.display = 'none';
        }, duration);
    }
}

// Clear current room function
function handleClearRoom() {
    const roomName = document.getElementById('room-name').value.trim();
    if (!roomName) {
        showAdminStatus('clear-room', 'Please enter a room name first.', false);
        return;
    }

    // Use lowercase for Firebase operations
    const roomKey = roomName.toLowerCase();

    // Show confirmation message first (with original capitalization)
    showAdminStatus('clear-room', `Click again to confirm clearing room "${roomName}"`, false, 5000);
    
    // Add temporary click handler for confirmation
    const confirmHandler = () => {
        const roomRef = database.ref(`rooms/${roomKey}/players`); // Use lowercase for Firebase
        roomRef.remove().then(() => {
            showAdminStatus('clear-room', `✅ Room "${roomName}" has been cleared.`); // Display original capitalization
        }).catch((error) => {
            console.error('Error clearing room:', error);
            showAdminStatus('clear-room', 'Failed to clear the room. Check console for details.', false);
        });
        
        // Remove the confirmation handler
        const clearRoomButton = document.getElementById('clear-room');
        if (clearRoomButton) {
            clearRoomButton.removeEventListener('click', confirmHandler);
        }
    };
    
    // Add the confirmation handler
    const clearRoomButton = document.getElementById('clear-room');
    if (clearRoomButton) {
        clearRoomButton.addEventListener('click', confirmHandler);
        
        // Remove the confirmation handler after 5 seconds
        setTimeout(() => {
            clearRoomButton.removeEventListener('click', confirmHandler);
        }, 5000);
    }
}

// Reset all scores in current room function
function handleResetScores() {
    const roomName = document.getElementById('room-name').value.trim();
    if (!roomName) {
        showAdminStatus('reset-scores', 'Please enter a room name first.', false);
        return;
    }

    // Use lowercase for Firebase operations
    const roomKey = roomName.toLowerCase();

    // Show confirmation message first (with original capitalization)
    showAdminStatus('reset-scores', `Click again to confirm resetting scores in "${roomName}"`, false, 5000);
    
    // Add temporary click handler for confirmation
    const confirmHandler = () => {
        const roomPlayersRef = database.ref(`rooms/${roomKey}/players`); // Use lowercase for Firebase
        roomPlayersRef.once('value', (snapshot) => {
            const players = snapshot.val();
            if (players) {
                const updates = {};
                for (const playerId in players) {
                    updates[`${playerId}/score`] = 0;
                }
                roomPlayersRef.update(updates).then(() => {
                    showAdminStatus('reset-scores', `✅ All scores in room "${roomName}" have been reset to 0.`); // Display original capitalization
                }).catch((error) => {
                    console.error('Error resetting scores:', error);
                    showAdminStatus('reset-scores', 'Failed to reset scores. Check console for details.', false);
                });
            } else {
                showAdminStatus('reset-scores', 'No players found in this room.', false);
            }
        });
        
        // Remove the confirmation handler
        const resetScoresButton = document.getElementById('reset-scores');
        if (resetScoresButton) {
            resetScoresButton.removeEventListener('click', confirmHandler);
        }
    };
    
    // Add the confirmation handler
    const resetScoresButton = document.getElementById('reset-scores');
    if (resetScoresButton) {
        resetScoresButton.addEventListener('click', confirmHandler);
        
        // Remove the confirmation handler after 5 seconds
        setTimeout(() => {
            resetScoresButton.removeEventListener('click', confirmHandler);
        }, 5000);
    }
}

// Clear entire database function
function handleClearDatabase() {
    // Show first confirmation message
    showAdminStatus('clear-database', 'Click again to confirm clearing ALL rooms (PERMANENT!)', false, 5000);
    
    // Add temporary click handler for first confirmation
    const firstConfirmHandler = () => {
        // Show second confirmation message
        showAdminStatus('clear-database', 'Click one more time to PERMANENTLY delete all room data!', false, 5000);
        
        // Add temporary click handler for final confirmation
        const finalConfirmHandler = () => {
            const roomsRef = database.ref('rooms');
            roomsRef.remove().then(() => {
                showAdminStatus('clear-database', '✅ All rooms have been cleared from the database.');
                // Clear the current player list display
                const playerListContainer = document.getElementById('player-list');
                if (playerListContainer) {
                    const clearPlayerList = playerListContainer.querySelector('ul');
                    if (clearPlayerList) {
                        clearPlayerList.innerHTML = '';
                    }
                }
            }).catch((error) => {
                console.error('Error clearing database:', error);
                showAdminStatus('clear-database', 'Failed to clear the database. Check console for details.', false);
            });
            
            // Remove the final confirmation handler
            const clearDatabaseButton = document.getElementById('clear-database');
            if (clearDatabaseButton) {
                clearDatabaseButton.removeEventListener('click', finalConfirmHandler);
            }
        };
        
        // Add the final confirmation handler
        const clearDatabaseButton = document.getElementById('clear-database');
        if (clearDatabaseButton) {
            clearDatabaseButton.addEventListener('click', finalConfirmHandler);
            
            // Remove the final confirmation handler after 5 seconds
            setTimeout(() => {
                clearDatabaseButton.removeEventListener('click', finalConfirmHandler);
            }, 5000);
        }
        
        // Remove the first confirmation handler
        if (clearDatabaseButton) {
            clearDatabaseButton.removeEventListener('click', firstConfirmHandler);
        }
    };
    
    // Add the first confirmation handler
    const clearDatabaseButton = document.getElementById('clear-database');
    if (clearDatabaseButton) {
        clearDatabaseButton.addEventListener('click', firstConfirmHandler);
        
        // Remove the first confirmation handler after 5 seconds
        setTimeout(() => {
            clearDatabaseButton.removeEventListener('click', firstConfirmHandler);
        }, 5000);
    }
}

// Farkle Indicator Management Functions
/**
 * Show a Farkle warning indicator next to a player's name
 * @param {string} playerNameOrId - The name or ID of the player who Farkled
 */
function showFarkleIndicator(playerNameOrId) {
    // Try both data-player-name and data-player-id selectors
    let playerListItem = document.querySelector(`[data-player-name="${playerNameOrId}"]`);
    if (!playerListItem) {
        playerListItem = document.querySelector(`[data-player-id="${playerNameOrId}"]`);
    }
    
    if (playerListItem) {
        const farkleIndicator = playerListItem.querySelector('.farkle-indicator');
        if (farkleIndicator) {
            farkleIndicator.style.display = 'inline';
            // console.log(`⚠️ Farkle indicator shown for ${playerNameOrId}`);
        } else {
            // console.warn(`⚠️ Farkle indicator element not found for ${playerNameOrId}`);
        }
    } else {
        // console.warn(`⚠️ Player list item not found for ${playerNameOrId}`);
    }
}

/**
 * Hide the Farkle warning indicator for a specific player
 * @param {string} playerNameOrId - The name or ID of the player to clear the indicator for
 */
function hideFarkleIndicator(playerNameOrId) {
    // Try both data-player-name and data-player-id selectors
    let playerListItem = document.querySelector(`[data-player-name="${playerNameOrId}"]`);
    if (!playerListItem) {
        playerListItem = document.querySelector(`[data-player-id="${playerNameOrId}"]`);
    }
    
    if (playerListItem) {
        const farkleIndicator = playerListItem.querySelector('.farkle-indicator');
        if (farkleIndicator) {
            farkleIndicator.style.display = 'none';
            // console.log(`✅ Farkle indicator hidden for ${playerNameOrId}`);
        }
    }
}

/**
 * Clear all Farkle indicators from all players
 */
function clearAllFarkleIndicators() {
    const allFarkleIndicators = document.querySelectorAll('.farkle-indicator');
    allFarkleIndicators.forEach(indicator => {
        indicator.style.display = 'none';
    });
    // console.log('🧹 All Farkle indicators cleared');
}

// Export functions for global access
window.showFarkleIndicator = showFarkleIndicator;
window.hideFarkleIndicator = hideFarkleIndicator;
window.clearAllFarkleIndicators = clearAllFarkleIndicators;
