const firebaseConfig = {
  apiKey: "AIzaSyAVEq6zfCKEPJtslSz8Jg7Aw9XtTeVzf58",
  authDomain: "fark-8fc62.firebaseapp.com",
  databaseURL: "https://fark-8fc62-default-rtdb.firebaseio.com",
  projectId: "fark-8fc62",
  storageBucket: "fark-8fc62.firebasestorage.app",
  messagingSenderId: "589413345531",
  appId: "1:589413345531:web:89f76f6e6ec49ecc32a85e",
  measurementId: "G-DDRBC3DVXM"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Test Firebase connection
const testButton = document.getElementById('test-firebase');
testButton.addEventListener('click', () => {
    const testRef = database.ref('test');
    testRef.set({
        message: 'Firebase is working!'
    }).then(() => {
        alert('Data written to Firebase successfully!');
    }).catch((error) => {
        console.error('Error writing to Firebase:', error);
        alert('Failed to write to Firebase. Check the console for details.');
    });
});

// Reference to the players in the Firebase database
const playersRef = database.ref('players');

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

    snapshot.forEach(childSnapshot => {
        const playerData = childSnapshot.val();
        if (playerData && playerData.name && playerData.score !== undefined) {
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
            
            const playerNameContainer = document.createElement('div');
            playerNameContainer.className = 'd-flex align-items-center';
            playerNameContainer.appendChild(playerNameSpan);
            playerNameContainer.appendChild(turnIndicator);

            const scoreBadge = document.createElement('span');
            scoreBadge.className = 'badge bg-primary rounded-pill';
            scoreBadge.textContent = playerData.score;

            listItem.appendChild(playerNameContainer);
            listItem.appendChild(scoreBadge);
            firebasePlayerList.appendChild(listItem);
        }
    });
}

// Listen for changes in the players data
playersRef.on('value', updatePlayerList);

// Admin functions
const clearRoomButton = document.getElementById('clear-room');
const resetScoresButton = document.getElementById('reset-scores');
const clearDatabaseButton = document.getElementById('clear-database');

// Clear current room
clearRoomButton.addEventListener('click', () => {
    const roomName = document.getElementById('room-name').value.trim();
    if (!roomName) {
        alert('Please enter a room name first.');
        return;
    }

    if (confirm(`Are you sure you want to clear all players from room "${roomName}"?`)) {
        const roomRef = database.ref(`rooms/${roomName}/players`);
        roomRef.remove().then(() => {
            alert(`Room "${roomName}" has been cleared.`);
        }).catch((error) => {
            console.error('Error clearing room:', error);
            alert('Failed to clear the room. Check the console for details.');
        });
    }
});

// Reset all scores in current room
resetScoresButton.addEventListener('click', () => {
    const roomName = document.getElementById('room-name').value.trim();
    if (!roomName) {
        alert('Please enter a room name first.');
        return;
    }

    if (confirm(`Are you sure you want to reset all scores in room "${roomName}"?`)) {
        const roomPlayersRef = database.ref(`rooms/${roomName}/players`);
        roomPlayersRef.once('value', (snapshot) => {
            const players = snapshot.val();
            if (players) {
                const updates = {};
                for (const playerId in players) {
                    updates[`${playerId}/score`] = 0;
                }
                roomPlayersRef.update(updates).then(() => {
                    alert(`All scores in room "${roomName}" have been reset to 0.`);
                }).catch((error) => {
                    console.error('Error resetting scores:', error);
                    alert('Failed to reset scores. Check the console for details.');
                });
            } else {
                alert('No players found in this room.');
            }
        });
    }
});

// Clear entire database
clearDatabaseButton.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear ALL rooms from the database? This action cannot be undone!')) {
        if (confirm('This will permanently delete all room data. Are you absolutely sure?')) {
            const roomsRef = database.ref('rooms');
            roomsRef.remove().then(() => {
                alert('All rooms have been cleared from the database.');
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
                alert('Failed to clear the database. Check the console for details.');
            });
        }
    }
});
