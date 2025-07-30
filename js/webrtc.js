// Minimal WebRTC for room management only
// Firebase handles all game communication (dice results, material changes, game state)

// Host management
let isHost = false;
let hostId = null;
let roomId = null;

// Basic Firebase signaling for host management
function setupSignaling() {
    if (!roomId || !database) return;
    
    const roomRef = database.ref(`rooms/${roomId}`);
    
    // Listen for host changes
    roomRef.child('hostId').on('value', (snapshot) => {
        const newHostId = snapshot.val();
        if (newHostId && newHostId !== hostId) {
            hostId = newHostId;
            isHost = (newHostId === window.myPlayerId); // Compare with player name
        }
    });
}

// Player setup and room management
const roomNameInput = document.getElementById('room-name');
const playerNameInput = document.getElementById('player-name');
const joinRoomButton = document.getElementById('join-room');
const playerListContainer = document.getElementById('player-list');
const webrtcPlayerList = playerListContainer?.querySelector('ul');

// Enable the join room button only if both fields have text
function updateJoinButtonState() {
    if (!joinRoomButton || !roomNameInput || !playerNameInput) return;
    const roomName = roomNameInput.value.trim();
    const playerName = playerNameInput.value.trim();
    joinRoomButton.disabled = !(roomName && playerName);
}

if (roomNameInput) roomNameInput.addEventListener('input', updateJoinButtonState);
if (playerNameInput) playerNameInput.addEventListener('input', updateJoinButtonState);

if (joinRoomButton) {
    joinRoomButton.addEventListener('click', () => {
        const roomName = roomNameInput.value.trim();
        const playerName = playerNameInput.value.trim();

        if (!roomName || !playerName) {
            alert('Please enter both a room name and your name.');
            return;
        }
        
        if (!database) {
            alert('Database connection error. Please refresh the page.');
            return;
        }

        roomId = roomName;
        setupSignaling();
        savePlayerData(roomName, playerName);

        const roomRef = database.ref(`rooms/${roomId}`);
        const playerRef = roomRef.child(`players/${playerName}`); // Use player name as ID

        // Check for host status and duplicate names
        roomRef.once('value', (roomSnapshot) => {
            const roomData = roomSnapshot.val();
            const players = roomData?.players || {};
            
            // Determine host status
            if (!roomData || Object.keys(players).length === 0) {
                isHost = true;
                hostId = playerName; // Use player name as host ID
            } else {
                const existingHostId = roomData.hostId;
                if (existingHostId && players[existingHostId]) {
                    isHost = (existingHostId === playerName);
                    hostId = existingHostId;
                } else {
                    isHost = true;
                    hostId = playerName; // Use player name as host ID
                }
            }
            
            // Check for duplicate names
            for (const id in players) {
                if (id !== playerName && players[id].name === playerName) {
                    const nameError = document.getElementById('name-error');
                    if (nameError) {
                        nameError.textContent = 'This name is already in use. Please choose a different name.';
                        nameError.style.display = 'block';
                    }
                    return;
                }
            }

            // Clear any previous error message
            const nameError = document.getElementById('name-error');
            if (nameError) nameError.style.display = 'none';

            // Add player to room
            const roomUpdates = {};
            roomUpdates[`players/${playerName}`] = { 
                name: playerName, 
                score: players?.[playerName]?.score || 0,
                isHost: isHost,
                state: 'waiting',
                joinedAt: Date.now()
            };
            
            if (isHost) {
                roomUpdates['hostId'] = playerName; // Use player name as host ID
            }
            
            roomRef.update(roomUpdates).then(() => {
                // Set myPlayerId for the game system
                if (typeof window !== 'undefined') {
                    window.myPlayerId = playerName;
                }
                
                // Initialize Firebase state manager
                if (typeof initializeFirebaseStateManager === 'function') {
                    const success = initializeFirebaseStateManager(roomId, playerName, playerName);
                    if (success && isHost) {
                        setTimeout(() => {
                            const gameStateRef = database.ref(`rooms/${roomId}/gameState`);
                            gameStateRef.once('value', (snapshot) => {
                                if (!snapshot.exists()) {
                                    gameStateRef.set({
                                        currentTurn: playerName,
                                        turnStartTime: Date.now(),
                                        gamePhase: 'active',
                                        createdAt: Date.now()
                                    });
                                    
                                    if (typeof setPlayerState === 'function') {
                                        setPlayerState('rolling');
                                    }
                                }
                            });
                        }, 1000);
                    }
                }
            }).catch((error) => {
                console.error('Error adding player:', error);
            });

            hideInputsShowDisplay(roomName, playerName);
            createLeaveRoomButton();

            // Listen for player list changes
            roomRef.child('players').on('value', (snapshot) => {
                const players = snapshot.val();
                if (webrtcPlayerList) {
                    webrtcPlayerList.innerHTML = '';
                    const playerNames = [];
                    const currentPlayerIds = [];
                    
                    for (const id in players) {
                        currentPlayerIds.push(id);
                        
                        const li = document.createElement('li');
                        li.className = 'list-group-item d-flex justify-content-between align-items-center';
                        li.setAttribute('data-player-name', players[id].name);
                        
                        const playerNameSpan = document.createElement('span');
                        playerNameSpan.textContent = players[id].name;
                        
                        const turnIndicator = document.createElement('span');
                        turnIndicator.className = 'turn-indicator badge bg-success ms-2';
                        turnIndicator.textContent = '●';
                        turnIndicator.style.display = 'none';
                        
                        const hostBadge = document.createElement('span');
                        hostBadge.className = 'host-badge badge bg-warning text-dark ms-1';
                        hostBadge.textContent = '👑 HOST';
                        hostBadge.style.display = players[id].isHost ? 'inline' : 'none';
                        
                        const playerNameContainer = document.createElement('div');
                        playerNameContainer.className = 'd-flex align-items-center';
                        playerNameContainer.appendChild(playerNameSpan);
                        playerNameContainer.appendChild(turnIndicator);
                        playerNameContainer.appendChild(hostBadge);
                        
                        const scoreBadge = document.createElement('span');
                        scoreBadge.className = 'badge bg-primary rounded-pill';
                        scoreBadge.textContent = players[id].score || 0;
                        
                        li.appendChild(playerNameContainer);
                        li.appendChild(scoreBadge);
                        webrtcPlayerList.appendChild(li);
                        
                        playerNames.push(players[id].name);
                    }
                    
                    // Initialize multiplayer turn system
                    if (typeof onRoomJoined === 'function' && playerNames.length > 0) {
                        onRoomJoined(roomId, playerName, playerNames);
                    }
                }
            });
        });

        playerRef.onDisconnect().remove();
    });
    
    updateJoinButtonState();
}

// Create and manage the leave room button
let leaveRoomButton = null;

function createLeaveRoomButton() {
    if (!leaveRoomButton) {
        leaveRoomButton = document.createElement('button');
        leaveRoomButton.id = 'leave-room';
        leaveRoomButton.textContent = 'Leave Room';
        leaveRoomButton.className = 'btn btn-danger w-100';
        leaveRoomButton.style.marginTop = '10px';

        leaveRoomButton.addEventListener('click', () => {
            if (!roomId || !window.myPlayerId) return;

            const roomRef = database.ref(`rooms/${roomId}`);
            const playerRef = roomRef.child(`players/${window.myPlayerId}`); // Use player name

            playerRef.remove().then(() => {
                // Reset state
                roomId = null;
                isHost = false;
                hostId = null;
                
                showInputsHideDisplay();
                hideLeaveRoomButton();
                
                if (typeof exitMultiplayerMode === 'function') {
                    exitMultiplayerMode();
                }
            }).catch((error) => {
                console.error('Error leaving room:', error);
            });
        });

        const playerListContainer = document.getElementById('player-list');
        if (playerListContainer) {
            playerListContainer.appendChild(leaveRoomButton);
        }
    }
}

function hideLeaveRoomButton() {
    if (leaveRoomButton && leaveRoomButton.parentNode) {
        leaveRoomButton.parentNode.removeChild(leaveRoomButton);
        leaveRoomButton = null;
    }
}

// Save/load player data
function savePlayerData(roomName, playerName) {
    localStorage.setItem('roomName', roomName);
    localStorage.setItem('playerName', playerName);
}

function loadPlayerData() {
    const roomName = localStorage.getItem('roomName');
    const playerName = localStorage.getItem('playerName');
    if (roomName && playerName && roomNameInput && playerNameInput) {
        roomNameInput.value = roomName;
        playerNameInput.value = playerName;
        updateJoinButtonState();
        
        setTimeout(() => {
            if (joinRoomButton && !joinRoomButton.disabled) {
                joinRoomButton.click();
            }
        }, 1000);
    }
}

// Helper functions to manage input/display visibility
function hideInputsShowDisplay(roomName, playerName) {
    const elements = {
        roomNameInput: document.getElementById('room-name'),
        playerNameInput: document.getElementById('player-name'),
        joinRoomButton: document.getElementById('join-room'),
        currentRoomName: document.getElementById('current-room-name'),
        currentPlayerName: document.getElementById('current-player-name'),
        roomPlayerInfo: document.getElementById('room-player-info')
    };

    if (elements.roomNameInput) elements.roomNameInput.style.display = 'none';
    if (elements.playerNameInput) elements.playerNameInput.style.display = 'none';
    if (elements.joinRoomButton) elements.joinRoomButton.style.display = 'none';
    if (elements.currentRoomName) elements.currentRoomName.textContent = roomName;
    if (elements.currentPlayerName) elements.currentPlayerName.textContent = playerName;
    if (elements.roomPlayerInfo) elements.roomPlayerInfo.style.display = 'block';
}

function showInputsHideDisplay() {
    const elements = {
        roomNameInput: document.getElementById('room-name'),
        playerNameInput: document.getElementById('player-name'),
        joinRoomButton: document.getElementById('join-room'),
        roomPlayerInfo: document.getElementById('room-player-info')
    };

    if (elements.roomNameInput) elements.roomNameInput.style.display = 'block';
    if (elements.playerNameInput) elements.playerNameInput.style.display = 'block';
    if (elements.joinRoomButton) elements.joinRoomButton.style.display = 'block';
    if (elements.roomPlayerInfo) elements.roomPlayerInfo.style.display = 'none';
}

// Load player data on page load
window.addEventListener('load', loadPlayerData);

// Clean up on page unload
window.addEventListener('beforeunload', () => {
    if (roomId && window.myPlayerId) {
        const playerRef = database.ref(`rooms/${roomId}/players/${window.myPlayerId}`);
        playerRef.remove();
    }
});
