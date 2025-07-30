// Simplified WebRTC for dice results and material changes only
// Firebase handles all game state coordination, WebRTC just for direct peer communication

const peerConnections = {};
const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

// Generate a unique ID for this player
const myId = Math.random().toString(36).substring(2, 15);

// Host management
let isHost = false;
let hostId = null;
let roomId = null;

// Send signaling data to Firebase
function sendSignalingData(data) {
    if (!roomId || !database) return;
    
    const serializedData = { ...data };
    if (data.offer) {
        serializedData.offer = { type: data.offer.type, sdp: data.offer.sdp };
    }
    if (data.answer) {
        serializedData.answer = { type: data.answer.type, sdp: data.answer.sdp };
    }
    if (data.candidate) {
        serializedData.candidate = {
            candidate: data.candidate.candidate,
            sdpMid: data.candidate.sdpMid,
            sdpMLineIndex: data.candidate.sdpMLineIndex
        };
    }
    
    database.ref(`rooms/${roomId}/signaling`).push(serializedData);
}

// Set up signaling listener
function setupSignaling() {
    if (!roomId || !database) return;
    
    const roomRef = database.ref(`rooms/${roomId}`);
    const signalingRef = database.ref(`rooms/${roomId}/signaling`);
    
    // Listen for host changes
    roomRef.child('hostId').on('value', (snapshot) => {
        const newHostId = snapshot.val();
        if (newHostId && newHostId !== hostId) {
            hostId = newHostId;
            isHost = (newHostId === myId);
        }
    });
    
    // Listen for signaling data
    signalingRef.on('child_added', (snapshot) => {
        const data = snapshot.val();
        if (!data || data.sender === myId) return;
        
        if (data.type === 'offer') {
            handleOffer(data);
        } else if (data.type === 'answer' && peerConnections[data.sender]) {
            handleAnswer(data);
        } else if (data.type === 'ice-candidate' && peerConnections[data.sender]) {
            handleIceCandidate(data);
        }
    });
}

// Handle WebRTC offer
function handleOffer(data) {
    if (!data.offer?.type || !data.offer?.sdp) return;
    
    if (!peerConnections[data.sender]) {
        peerConnections[data.sender] = createPeerConnection(data.sender);
    }
    
    const peerConnection = peerConnections[data.sender];
    
    peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer))
        .then(() => peerConnection.createAnswer())
        .then((answer) => peerConnection.setLocalDescription(answer))
        .then(() => {
            sendSignalingData({
                type: 'answer',
                sender: myId,
                target: data.sender,
                answer: peerConnection.localDescription
            });
        })
        .catch(error => console.error('Error handling offer:', error));
}

// Handle WebRTC answer
function handleAnswer(data) {
    if (!data.answer?.type || !data.answer?.sdp) return;
    
    peerConnections[data.sender].setRemoteDescription(new RTCSessionDescription(data.answer))
        .catch(error => console.error('Error handling answer:', error));
}

// Handle ICE candidate
function handleIceCandidate(data) {
    if (!data.candidate) return;
    
    peerConnections[data.sender].addIceCandidate(new RTCIceCandidate(data.candidate))
        .catch(error => console.error('Error adding ICE candidate:', error));
}

// Create a new WebRTC peer connection
function createPeerConnection(targetId) {
    const peerConnection = new RTCPeerConnection(configuration);
    
    // Create data channel for outgoing messages
    const dataChannel = peerConnection.createDataChannel('gameMessages', { ordered: true });
    dataChannel.onopen = () => console.log(`Data channel opened with ${targetId}`);
    dataChannel.onmessage = (e) => handleReceivedMessage(e.data, targetId);
    peerConnection.dataChannel = dataChannel;

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            sendSignalingData({
                type: 'ice-candidate',
                sender: myId,
                target: targetId,
                candidate: event.candidate
            });
        }
    };

    // Handle incoming data channel
    peerConnection.ondatachannel = (event) => {
        const channel = event.channel;
        channel.onmessage = (e) => handleReceivedMessage(e.data, targetId);
        peerConnection.incomingDataChannel = channel;
    };

    // Simple connection state handling
    peerConnection.onconnectionstatechange = () => {
        if (peerConnection.connectionState === 'failed') {
            setTimeout(() => {
                delete peerConnections[targetId];
                if (isHost) initiateConnection(targetId);
            }, 1000);
        }
    };

    return peerConnection;
}

// Initiate WebRTC connection
function initiateConnection(targetId) {
    if (peerConnections[targetId]) return;
    
    const peerConnection = createPeerConnection(targetId);
    peerConnections[targetId] = peerConnection;
    
    peerConnection.createOffer()
        .then(offer => peerConnection.setLocalDescription(offer))
        .then(() => {
            sendSignalingData({
                type: 'offer',
                sender: myId,
                target: targetId,
                offer: peerConnection.localDescription
            });
        })
        .catch(error => console.error('Error creating offer:', error));
}

// Message handling for WebRTC data channels (simplified for Firebase state management)
function handleReceivedMessage(messageData, fromPeerId = null) {
    try {
        const data = JSON.parse(messageData);
        
        switch (data.type) {
            case 'material_change':
                if (typeof onMaterialChangeReceived === 'function') {
                    onMaterialChangeReceived({
                        playerId: data.playerId,
                        diceType: data.diceType,
                        floorType: data.floorType
                    });
                }
                break;
            case 'dice_results':
                if (typeof onDiceResultsReceived === 'function') {
                    onDiceResultsReceived({
                        playerId: data.playerId,
                        diceResults: data.diceResults
                    });
                }
                break;
        }
    } catch (error) {
        console.error('Error parsing message:', error);
    }
}

// Send message to all connected peers
function sendToAllPeers(messageData) {
    if (isHost) {
        // Host sends to all clients
        for (const peerId in peerConnections) {
            const connection = peerConnections[peerId];
            if (connection?.connectionState === 'connected' && 
                connection.dataChannel?.readyState === 'open') {
                try {
                    connection.dataChannel.send(messageData);
                } catch (error) {
                    console.error(`Error sending to ${peerId}:`, error);
                }
            }
        }
    } else {
        // Client sends to host
        if (hostId && peerConnections[hostId]) {
            const connection = peerConnections[hostId];
            if (connection?.connectionState === 'connected') {
                const channel = connection.dataChannel?.readyState === 'open' ? 
                    connection.dataChannel : connection.incomingDataChannel;
                if (channel?.readyState === 'open') {
                    try {
                        channel.send(messageData);
                    } catch (error) {
                        console.error('Error sending to host:', error);
                    }
                }
            }
        }
    }
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
        const playerRef = roomRef.child(`players/${myId}`);

        // Check for host status and duplicate names
        roomRef.once('value', (roomSnapshot) => {
            const roomData = roomSnapshot.val();
            const players = roomData?.players || {};
            
            // Determine host status
            if (!roomData || Object.keys(players).length === 0) {
                isHost = true;
                hostId = myId;
            } else {
                const existingHostId = roomData.hostId;
                if (existingHostId && players[existingHostId]) {
                    isHost = (existingHostId === myId);
                    hostId = existingHostId;
                } else {
                    isHost = true;
                    hostId = myId;
                }
            }
            
            // Check for duplicate names
            for (const id in players) {
                if (id !== myId && players[id].name === playerName) {
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
            roomUpdates[`players/${myId}`] = { 
                name: playerName, 
                score: players?.[myId]?.score || 0,
                isHost: isHost,
                state: 'waiting',
                joinedAt: Date.now()
            };
            
            if (isHost) {
                roomUpdates['hostId'] = myId;
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
                        
                        const hostBadge = document.createElement('span');
                        hostBadge.className = 'host-badge ms-1';
                        hostBadge.textContent = '👑';
                        hostBadge.title = 'Room Host';
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
                    
                    // Clean up old peer connections
                    for (const peerId in peerConnections) {
                        if (!currentPlayerIds.includes(peerId)) {
                            const connection = peerConnections[peerId];
                            if (connection.dataChannel) connection.dataChannel.close();
                            if (connection.incomingDataChannel) connection.incomingDataChannel.close();
                            connection.close();
                            delete peerConnections[peerId];
                        }
                    }
                    
                    // Initialize multiplayer turn system
                    if (typeof onRoomJoined === 'function' && playerNames.length > 0) {
                        onRoomJoined(roomId, playerNames);
                    }
                    
                    // Establish WebRTC connections
                    if (isHost) {
                        for (const id in players) {
                            if (id !== myId && !peerConnections[id]) {
                                initiateConnection(id);
                            }
                        }
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
            if (!roomId) return;

            const roomRef = database.ref(`rooms/${roomId}`);
            const playerRef = roomRef.child(`players/${myId}`);

            playerRef.remove().then(() => {
                // Clean up connections
                for (const peerId in peerConnections) {
                    const connection = peerConnections[peerId];
                    if (connection.dataChannel) connection.dataChannel.close();
                    if (connection.incomingDataChannel) connection.incomingDataChannel.close();
                    connection.close();
                }
                Object.keys(peerConnections).forEach(key => delete peerConnections[key]);

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

// Load player data on page load
window.addEventListener('load', loadPlayerData);

// Clean up on page unload
window.addEventListener('beforeunload', () => {
    if (roomId) {
        const playerRef = database.ref(`rooms/${roomId}/players/${myId}`);
        playerRef.remove();
    }
});
