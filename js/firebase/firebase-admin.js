// Firebase Admin Functions
// Administrative functions for managing rooms and database

/**
 * Utility function to show status messages for admin actions
 * @param {string} buttonId - The ID of the button to show status for
 * @param {string} message - The message to display
 * @param {boolean} isSuccess - Whether this is a success or error message
 * @param {number} duration - How long to show the message in milliseconds
 */
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

/**
 * Clear all players from a specific room
 * @param {string} roomName - The room name (original capitalization for display)
 * @param {string} roomKey - The room key (lowercase for Firebase)
 */
function clearRoom(roomName, roomKey) {
    const roomRef = getRoomPlayersRef(roomKey);
    return roomRef.remove().then(() => {
        showAdminStatus('clear-room', `✅ Room "${roomName}" has been cleared.`);
    }).catch((error) => {
        // console.error('Error clearing room:', error);
        showAdminStatus('clear-room', 'Failed to clear the room. Check console for details.', false);
    });
}

/**
 * Reset all scores in a specific room to 0
 * @param {string} roomName - The room name (original capitalization for display)
 * @param {string} roomKey - The room key (lowercase for Firebase)
 */
function resetRoomScores(roomName, roomKey) {
    const roomPlayersRef = getRoomPlayersRef(roomKey);
    return roomPlayersRef.once('value', (snapshot) => {
        const players = snapshot.val();
        if (players) {
            const updates = {};
            for (const playerId in players) {
                updates[`${playerId}/score`] = 0;
            }
            roomPlayersRef.update(updates).then(() => {
                showAdminStatus('reset-scores', `✅ All scores in room "${roomName}" have been reset to 0.`);
            }).catch((error) => {
                // console.error('Error resetting scores:', error);
                showAdminStatus('reset-scores', 'Failed to reset scores. Check console for details.', false);
            });
        } else {
            showAdminStatus('reset-scores', 'No players found in this room.', false);
        }
    });
}

/**
 * Clear the entire Firebase database (all rooms)
 */
function clearEntireDatabase() {
    const roomsRef = database.ref('rooms');
    return roomsRef.remove().then(() => {
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
        // console.error('Error clearing database:', error);
        showAdminStatus('clear-database', 'Failed to clear the database. Check console for details.', false);
    });
}

/**
 * Set up admin panel event listeners
 */
function initializeAdminPanel() {
    const clearRoomButton = document.getElementById('clear-room');
    const resetScoresButton = document.getElementById('reset-scores');
    const clearDatabaseButton = document.getElementById('clear-database');
    const testButton = document.getElementById('test-firebase');

    // Test Firebase connection
    if (testButton) {
        testButton.addEventListener('click', () => {
            const statusElement = document.getElementById('test-firebase-status');
            
            // Hide the status while testing
            if (statusElement) {
                statusElement.style.display = 'none';
            }
            
            testFirebaseConnection().then(() => {
                // Show green checkbox on success
                if (statusElement) {
                    statusElement.style.display = 'inline';
                    // Hide the checkbox after 3 seconds
                    setTimeout(() => {
                        statusElement.style.display = 'none';
                    }, 3000);
                }
            }).catch((error) => {
                // console.error('Error writing to Firebase:', error);
                alert('Failed to write to Firebase. Check the console for details.');
            });
        });
    }

    // Clear current room
    if (clearRoomButton) {
        clearRoomButton.addEventListener('click', () => {
            const roomName = document.getElementById('room-name').value.trim();
            if (!roomName) {
                showAdminStatus('clear-room', 'Please enter a room name first.', false);
                return;
            }

            const roomKey = roomName.toLowerCase();
            showAdminStatus('clear-room', `Click again to confirm clearing room "${roomName}"`, false, 5000);
            
            const confirmHandler = () => {
                clearRoom(roomName, roomKey);
                clearRoomButton.removeEventListener('click', confirmHandler);
            };
            
            clearRoomButton.addEventListener('click', confirmHandler);
            setTimeout(() => {
                clearRoomButton.removeEventListener('click', confirmHandler);
            }, 5000);
        });
    }

    // Reset all scores in current room
    if (resetScoresButton) {
        resetScoresButton.addEventListener('click', () => {
            const roomName = document.getElementById('room-name').value.trim();
            if (!roomName) {
                showAdminStatus('reset-scores', 'Please enter a room name first.', false);
                return;
            }

            const roomKey = roomName.toLowerCase();
            showAdminStatus('reset-scores', `Click again to confirm resetting scores in "${roomName}"`, false, 5000);
            
            const confirmHandler = () => {
                resetRoomScores(roomName, roomKey);
                resetScoresButton.removeEventListener('click', confirmHandler);
            };
            
            resetScoresButton.addEventListener('click', confirmHandler);
            setTimeout(() => {
                resetScoresButton.removeEventListener('click', confirmHandler);
            }, 5000);
        });
    }

    // Clear entire database
    if (clearDatabaseButton) {
        clearDatabaseButton.addEventListener('click', () => {
            showAdminStatus('clear-database', 'Click again to confirm clearing ALL rooms (PERMANENT!)', false, 5000);
            
            const firstConfirmHandler = () => {
                showAdminStatus('clear-database', 'Click one more time to PERMANENTLY delete all room data!', false, 5000);
                
                const finalConfirmHandler = () => {
                    clearEntireDatabase();
                    clearDatabaseButton.removeEventListener('click', finalConfirmHandler);
                };
                
                clearDatabaseButton.addEventListener('click', finalConfirmHandler);
                setTimeout(() => {
                    clearDatabaseButton.removeEventListener('click', finalConfirmHandler);
                }, 5000);
                
                clearDatabaseButton.removeEventListener('click', firstConfirmHandler);
            };
            
            clearDatabaseButton.addEventListener('click', firstConfirmHandler);
            setTimeout(() => {
                clearDatabaseButton.removeEventListener('click', firstConfirmHandler);
            }, 5000);
        });
    }
}

// Initialize admin panel when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeAdminPanel);

// Export functions for global access
window.showAdminStatus = showAdminStatus;
window.clearRoom = clearRoom;
window.resetRoomScores = resetRoomScores;
window.clearEntireDatabase = clearEntireDatabase;
window.initializeAdminPanel = initializeAdminPanel;
