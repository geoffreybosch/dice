// Firebase Room Management
// Handles room creation, joining, leaving, and UI management for multiplayer rooms

// URL parameter utility functions
function getURLParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

function setURLParameter(name, value) {
    const url = new URL(window.location);
    if (value) {
        url.searchParams.set(name, value);
    } else {
        url.searchParams.delete(name);
    }
    window.history.replaceState({}, '', url);
}

// Initialize room name from URL parameter on page load
function initializeRoomFromURL() {
    const roomNameFromURL = getURLParameter('room');
    const roomNameInput = document.getElementById('room-name');
    
    if (roomNameFromURL && roomNameInput) {
        const decodedRoomName = decodeURIComponent(roomNameFromURL);
        // Check if we have a saved room name with different capitalization
        const savedRoomName = localStorage.getItem('roomName');
        
        if (savedRoomName && savedRoomName.toLowerCase() === decodedRoomName.toLowerCase()) {
            // Use the saved capitalization if it matches
            roomNameInput.value = savedRoomName;
        } else {
            // Use the URL version (which should be lowercase)
            roomNameInput.value = decodedRoomName;
        }
        updateJoinButtonState(); // Update button state after setting room name
    }
}

// Host management
let isHost = false;
let hostId = null;
let roomId = null; // This will be the lowercase version for Firebase
let displayRoomName = null; // This will be the original capitalization for display

// Firebase host management
function setupHostManagement() {
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
const roomPlayerList = playerListContainer?.querySelector('ul');

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

        // Store both versions - lowercase for Firebase, original for display
        displayRoomName = roomName;
        roomId = roomName.toLowerCase();
        
        setupHostManagement();
        savePlayerData(roomName, playerName); // Save original capitalization

        const roomRef = database.ref(`rooms/${roomId}`); // Use lowercase for Firebase
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

            // Add player to room, preserving existing data if player is reconnecting
            const existingPlayer = players?.[playerName];
            const roomUpdates = {};
            
            if (existingPlayer) {
                // Player is reconnecting - only update connection status, preserve ALL other data
                console.log(`🔌 Player ${playerName} reconnecting, preserving existing data:`, existingPlayer);
                roomUpdates[`players/${playerName}/isConnected`] = true;
                roomUpdates[`players/${playerName}/lastConnectionUpdate`] = Date.now();
                // Ensure name field is always present (in case it was somehow lost)
                roomUpdates[`players/${playerName}/name`] = playerName;
                // Only update host status if it has changed
                if (existingPlayer.isHost !== isHost) {
                    roomUpdates[`players/${playerName}/isHost`] = isHost;
                }
            } else {
                // New player joining for the first time
                console.log(`🆕 New player ${playerName} joining room`);
                roomUpdates[`players/${playerName}`] = { 
                    name: playerName, 
                    score: 0,
                    isHost: isHost,
                    state: 'waiting',
                    isConnected: true,
                    joinedAt: Date.now(),
                    lastConnectionUpdate: Date.now()
                };
            }
            
            if (isHost) {
                roomUpdates['hostId'] = playerName; // Use player name as host ID
            }
            
            roomRef.update(roomUpdates).then(() => {
                // Update URL to include room parameter for easy sharing (use lowercase for consistency)
                setURLParameter('room', encodeURIComponent(roomId));
                
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

            hideInputsShowDisplay(displayRoomName, playerName); // Use original capitalization for display
            createLeaveRoomButton();

            // Listen for player list changes
            roomRef.child('players').on('value', (snapshot) => {
                const players = snapshot.val();
                if (roomPlayerList) {
                    roomPlayerList.innerHTML = '';
                    const playerNames = [];
                    const currentPlayerIds = [];
                    
                    // Show/hide player list title based on whether there are players
                    const playerListTitle = document.getElementById('player-list-title');
                    const hasPlayers = players && Object.keys(players).length > 0;
                    if (playerListTitle) {
                        playerListTitle.style.display = hasPlayers ? 'block' : 'none';
                    }
                    
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
                        
                        // Create Farkle indicator
                        const farkleIndicator = document.createElement('span');
                        farkleIndicator.className = 'farkle-indicator ms-2';
                        farkleIndicator.textContent = '⚠️';
                        farkleIndicator.style.display = 'none';
                        farkleIndicator.title = 'This player just Farkled!';
                        
                        const hostBadge = document.createElement('span');
                        hostBadge.className = 'host-badge ms-1';
                        hostBadge.textContent = '👑';
                        hostBadge.title = 'Room Host';
                        hostBadge.style.display = players[id].isHost ? 'inline' : 'none';
                        
                        const playerNameContainer = document.createElement('div');
                        playerNameContainer.className = 'd-flex align-items-center';
                        playerNameContainer.appendChild(playerNameSpan);
                        playerNameContainer.appendChild(turnIndicator);
                        playerNameContainer.appendChild(farkleIndicator);
                        playerNameContainer.appendChild(hostBadge);
                        
                        const scoreBadge = document.createElement('span');
                        scoreBadge.className = 'badge bg-primary rounded-pill';
                        scoreBadge.textContent = players[id].score || 0;
                        
                        li.appendChild(playerNameContainer);
                        li.appendChild(scoreBadge);
                        roomPlayerList.appendChild(li);
                        
                        playerNames.push(players[id].name);
                    }
                    
                    // Initialize multiplayer turn system
                    if (typeof onRoomJoined === 'function' && playerNames.length > 0) {
                        onRoomJoined(roomId, playerName, playerNames);
                    }
                }
            });
        });

        // Set up disconnect handling - only mark as disconnected, don't remove player data
        playerRef.child('isConnected').onDisconnect().set(false);
        playerRef.child('lastConnectionUpdate').onDisconnect().set(firebase.database.ServerValue.TIMESTAMP);
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
                displayRoomName = null;
                isHost = false;
                hostId = null;
                
                // Clear room parameter from URL
                setURLParameter('room', null);
                
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
        
        // Don't auto-join - let user manually click join button
        // This allows them to change their name or room name if needed
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
        roomPlayerInfo: document.getElementById('room-player-info'),
        roomNameDisplay: document.getElementById('room-name-display'),
        roomNameText: document.getElementById('room-name-text')
    };

    if (elements.roomNameInput) elements.roomNameInput.style.display = 'none';
    if (elements.playerNameInput) elements.playerNameInput.style.display = 'none';
    if (elements.joinRoomButton) elements.joinRoomButton.style.display = 'none';
    if (elements.currentRoomName) elements.currentRoomName.textContent = roomName;
    if (elements.currentPlayerName) elements.currentPlayerName.textContent = playerName;
    if (elements.roomPlayerInfo) elements.roomPlayerInfo.style.display = 'block';
    
    // Show room name above player list
    if (elements.roomNameDisplay && elements.roomNameText) {
        elements.roomNameText.textContent = roomName;
        elements.roomNameDisplay.style.display = 'block';
    }
}

function showInputsHideDisplay() {
    const elements = {
        roomNameInput: document.getElementById('room-name'),
        playerNameInput: document.getElementById('player-name'),
        joinRoomButton: document.getElementById('join-room'),
        roomPlayerInfo: document.getElementById('room-player-info'),
        roomNameDisplay: document.getElementById('room-name-display')
    };

    if (elements.roomNameInput) elements.roomNameInput.style.display = 'block';
    if (elements.playerNameInput) elements.playerNameInput.style.display = 'block';
    if (elements.joinRoomButton) elements.joinRoomButton.style.display = 'block';
    if (elements.roomPlayerInfo) elements.roomPlayerInfo.style.display = 'none';
    
    // Hide room name above player list
    if (elements.roomNameDisplay) elements.roomNameDisplay.style.display = 'none';
}

// Load player data and initialize room from URL on page load
window.addEventListener('load', () => {
    loadPlayerData();
    initializeRoomFromURL();
});

// Clean up on page unload - only update connection status, don't remove player data
window.addEventListener('beforeunload', () => {
    if (roomId && window.myPlayerId) {
        const playerRef = database.ref(`rooms/${roomId}/players/${window.myPlayerId}`);
        // Only update connection status, preserve all other player data
        playerRef.update({
            isConnected: false,
            lastConnectionUpdate: Date.now()
        });
    }
});

// Export functions for global access
window.getURLParameter = getURLParameter;
window.setURLParameter = setURLParameter;
window.initializeRoomFromURL = initializeRoomFromURL;
window.hideInputsShowDisplay = hideInputsShowDisplay;
window.showInputsHideDisplay = showInputsHideDisplay;
