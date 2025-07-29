// WebRTC signaling and connection management
const players = [];
const peerConnections = {};
const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

// Generate a unique ID for this player
const myId = Math.random().toString(36).substring(2, 15);

// Firebase-based WebRTC signaling
const roomNameInput = document.getElementById('room-name');
let roomId = null; // Change roomId from a constant to a variable to allow reassignment
const roomRef = database.ref(`rooms/${roomId}`);

// Listen for signaling data
roomRef.on('child_added', (snapshot) => {
    const data = snapshot.val();
    if (data.type === 'offer' && !peerConnections[data.sender]) {
        handleOffer(data);
    } else if (data.type === 'answer' && peerConnections[data.sender]) {
        handleAnswer(data);
    } else if (data.type === 'ice-candidate' && peerConnections[data.sender]) {
        handleIceCandidate(data);
    }
});

// Send signaling data to Firebase
function sendSignalingData(data) {
    roomRef.push(data);
}

// Handle WebRTC offer
function handleOffer(data) {
    const peerConnection = createPeerConnection(data.sender);
    peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
    peerConnection.createAnswer().then((answer) => {
        peerConnection.setLocalDescription(answer);
        sendSignalingData({
            type: 'answer',
            sender: myId,
            target: data.sender,
            sdp: answer
        });
    });
}

// Handle WebRTC answer
function handleAnswer(data) {
    peerConnections[data.sender].setRemoteDescription(new RTCSessionDescription(data.sdp));
}

// Handle ICE candidate
function handleIceCandidate(data) {
    peerConnections[data.sender].addIceCandidate(new RTCIceCandidate(data.candidate));
}

// Create a new WebRTC peer connection
function createPeerConnection(targetId) {
    const peerConnection = new RTCPeerConnection(configuration);
    peerConnections[targetId] = peerConnection;

    // Create a data channel for outgoing messages
    const dataChannel = peerConnection.createDataChannel('gameMessages', {
        ordered: true
    });
    
    dataChannel.onopen = () => {
        console.log(`🔗 Data channel opened with ${targetId}`);
        console.log(`🔗 Channel state: ${dataChannel.readyState}`);
    };
    
    dataChannel.onclose = () => {
        console.log(`🔗 Data channel closed with ${targetId}`);
    };
    
    dataChannel.onerror = (error) => {
        console.error(`🔗 Data channel error with ${targetId}:`, error);
    };
    
    dataChannel.onmessage = (e) => {
        console.log('📩 Message from', targetId, e.data);
        handleReceivedMessage(e.data);
    };
    
    // Store the data channel reference
    peerConnection.dataChannel = dataChannel;

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

    peerConnection.ondatachannel = (event) => {
        const channel = event.channel;
        console.log(`🔗 Incoming data channel from ${targetId}, state: ${channel.readyState}`);
        
        channel.onopen = () => {
            console.log(`🔗 Incoming data channel opened from ${targetId}`);
        };
        
        channel.onclose = () => {
            console.log(`🔗 Incoming data channel closed from ${targetId}`);
        };
        
        channel.onerror = (error) => {
            console.error(`🔗 Incoming data channel error from ${targetId}:`, error);
        };
        
        channel.onmessage = (e) => {
            console.log('📩 Message from', targetId, e.data);
            handleReceivedMessage(e.data);
        };
        
        // Store the incoming data channel reference as well
        peerConnection.incomingDataChannel = channel;
    };

    return peerConnection;
}

// Message handling for WebRTC data channels
function handleReceivedMessage(messageData) {
    console.log('📨 === handleReceivedMessage() START ===');
    console.log('📨 Raw message data:', messageData);
    
    try {
        const data = JSON.parse(messageData);
        console.log('📨 Parsed WebRTC message:', data);
        
        switch (data.type) {
            case 'turn_change':
                console.log('🔄 Processing turn_change message for player:', data.currentPlayer);
                if (typeof onTurnChangeReceived === 'function') {
                    console.log('🔄 Calling onTurnChangeReceived...');
                    onTurnChangeReceived({
                        currentPlayer: data.currentPlayer,
                        playerList: Object.keys(peerConnections || {})
                    });
                    console.log('🔄 onTurnChangeReceived call completed');
                } else {
                    console.error('❌ onTurnChangeReceived function not available');
                }
                break;
            case 'material_change':
                console.log('🎨 Processing material_change message');
                if (typeof onMaterialChangeReceived === 'function') {
                    onMaterialChangeReceived({
                        playerId: data.playerId,
                        diceType: data.diceType,
                        floorType: data.floorType
                    });
                } else {
                    console.error('❌ onMaterialChangeReceived function not available');
                }
                break;
            case 'dice_results':
                console.log('🎲 Processing dice_results message');
                if (typeof onDiceResultsReceived === 'function') {
                    onDiceResultsReceived({
                        playerId: data.playerId,
                        diceResults: data.diceResults
                    });
                } else {
                    console.error('❌ onDiceResultsReceived function not available');
                }
                break;
            default:
                console.log('❓ Unknown message type:', data.type);
        }
        
        console.log('📨 === handleReceivedMessage() END ===');
    } catch (error) {
        console.error('❌ Error parsing message:', error, messageData);
        console.log('📨 === handleReceivedMessage() END (ERROR) ===');
    }
}

// Send message to all connected peers
function sendToAllPeers(messageData) {
    console.log('📡 === sendToAllPeers() START ===');
    console.log('📡 Message to send:', messageData);
    
    if (!peerConnections) {
        console.error('❌ No peer connections available');
        console.log('📡 === sendToAllPeers() END (NO CONNECTIONS) ===');
        return;
    }
    
    const totalPeers = Object.keys(peerConnections).length;
    console.log(`📊 Total peer connections: ${totalPeers}`);
    
    let messagesSent = 0;
    
    for (const peerId in peerConnections) {
        const connection = peerConnections[peerId];
        console.log(`📋 Checking peer ${peerId}: connectionState=${connection?.connectionState}`);
        
        if (connection && (connection.connectionState === 'connected' || connection.connectionState === 'connecting')) {
            // Try the outgoing data channel first
            if (connection.dataChannel && connection.dataChannel.readyState === 'open') {
                try {
                    connection.dataChannel.send(messageData);
                    console.log(`✅ Sent message to ${peerId} via outgoing channel`);
                    messagesSent++;
                    continue;
                } catch (error) {
                    console.error(`❌ Error sending message to ${peerId} via outgoing channel:`, error);
                }
            }
            
            // Try the incoming data channel as fallback
            if (connection.incomingDataChannel && connection.incomingDataChannel.readyState === 'open') {
                try {
                    connection.incomingDataChannel.send(messageData);
                    console.log(`✅ Sent message to ${peerId} via incoming channel`);
                    messagesSent++;
                } catch (error) {
                    console.error(`❌ Error sending message to ${peerId} via incoming channel:`, error);
                }
            } else {
                console.warn(`⚠️ No open data channels for ${peerId}. Connection: ${connection.connectionState}, outgoing: ${connection.dataChannel?.readyState}, incoming: ${connection.incomingDataChannel?.readyState}`);
            }
        } else {
            console.warn(`⚠️ Peer ${peerId} not connected. State: ${connection?.connectionState}`);
        }
    }
    
    console.log(`📊 Total messages sent: ${messagesSent} out of ${Object.keys(peerConnections).length} peers`);
    console.log('📡 === sendToAllPeers() END ===');
}

// Debug function to check WebRTC connection status
function debugWebRTCConnections() {
    console.log('🔍 === WebRTC Connection Status ===');
    
    if (!peerConnections) {
        console.log('❌ No peer connections object');
        return;
    }
    
    const peers = Object.keys(peerConnections);
    console.log(`📊 Total peers: ${peers.length}`);
    
    for (const peerId of peers) {
        const connection = peerConnections[peerId];
        console.log(`👤 Peer ${peerId}:`);
        console.log(`  - Connection state: ${connection?.connectionState}`);
        console.log(`  - ICE connection state: ${connection?.iceConnectionState}`);
        console.log(`  - Outgoing channel: ${connection?.dataChannel?.readyState || 'none'}`);
        console.log(`  - Incoming channel: ${connection?.incomingDataChannel?.readyState || 'none'}`);
    }
    
    console.log('🔍 === End WebRTC Status ===');
}

// Make debug function globally available
window.debugWebRTCConnections = debugWebRTCConnections;

// Player setup and room management
const playerNameInput = document.getElementById('player-name');
const joinRoomButton = document.getElementById('join-room');
const playerListContainer = document.getElementById('player-list');
const webrtcPlayerList = playerListContainer ? playerListContainer.querySelector('ul') : null;

// Check if all required elements exist
console.log('DOM element check:', {
    playerNameInput: !!playerNameInput,
    joinRoomButton: !!joinRoomButton,
    roomNameInput: !!roomNameInput,
    playerListContainer: !!playerListContainer,
    webrtcPlayerList: !!webrtcPlayerList
});
if (!playerNameInput) {
    console.error('Player name input not found');
}
if (!joinRoomButton) {
    console.error('Join room button not found');
}
if (!roomNameInput) {
    console.error('Room name input not found');
}

console.log('WebRTC elements check:', {
    playerNameInput: !!playerNameInput,
    joinRoomButton: !!joinRoomButton,
    roomNameInput: !!roomNameInput,
    playerListContainer: !!playerListContainer
});

if (joinRoomButton) {
    joinRoomButton.addEventListener('click', () => {
        console.log('Join room button clicked');
        const roomName = roomNameInput.value.trim();
        const playerName = playerNameInput.value.trim();

        console.log('Room name:', roomName, 'Player name:', playerName);

        if (!roomName || !playerName) {
            alert('Please enter both a room name and your name.');
            return;
        }
        
        // Check Firebase connection
        if (!database) {
            console.error('Firebase database not initialized');
            alert('Database connection error. Please refresh the page.');
            return;
        }

        roomId = roomName; // Set the room ID dynamically
        console.log('Room ID set to:', roomId);    // Save data to localStorage
    savePlayerData(roomName, playerName);

    // Set the room reference and handle reconnection
    const roomRef = database.ref(`rooms/${roomId}`);
    const playerRef = roomRef.child(`players/${myId}`);
    
    console.log('Player ID:', myId);
    console.log('Checking for duplicate names...');

    // Prevent joining a room with the same name as someone else
    roomRef.child('players').once('value', (snapshot) => {
        console.log('Received player data:', snapshot.val());
        const players = snapshot.val();
        
        // Check for duplicate names (excluding the current player ID)
        for (const id in players) {
            console.log('Checking player:', id, players[id]);
            if (id !== myId && players[id].name === playerName) {
                console.log('Duplicate name found!');
                // Show error message under the name field
                const nameError = document.getElementById('name-error');
                if (nameError) {
                    nameError.textContent = 'This name is already in use by another player. Please choose a different name.';
                    nameError.style.display = 'block';
                }
                return; // Exit early if duplicate name found
            }
        }

        console.log('No duplicate name found, proceeding...');
        // Clear any previous error message
        const nameError = document.getElementById('name-error');
        if (nameError) {
            nameError.style.display = 'none';
        }

        // Only proceed if no duplicate name was found
        // Add or update the player in the room
        console.log('Adding player to room...');
        playerRef.set({ name: playerName, score: players?.[myId]?.score || 0 }).then(() => {
            console.log('Player added successfully');
        }).catch((error) => {
            console.error('Error adding player:', error);
        }); // Preserve score if reconnecting

        // Hide input fields and show display elements
        console.log('Hiding inputs and showing display...');
        hideInputsShowDisplay(roomName, playerName);

        // Show the leave room button
        console.log('Creating leave room button...');
        createLeaveRoomButton();

        // Listen for changes to the player list
        roomRef.child('players').on('value', (snapshot) => {
            const players = snapshot.val();
            if (webrtcPlayerList) {
                webrtcPlayerList.innerHTML = '';
                const playerNames = [];
                for (const id in players) {
                    const li = document.createElement('li');
                    li.className = 'list-group-item d-flex justify-content-between align-items-center';
                    li.setAttribute('data-player-name', players[id].name);
                    
                    // Create player name with turn indicator
                    const playerNameSpan = document.createElement('span');
                    playerNameSpan.className = 'player-name-text';
                    playerNameSpan.textContent = players[id].name;
                    
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
                    scoreBadge.textContent = players[id].score || 0;
                    
                    li.appendChild(playerNameContainer);
                    li.appendChild(scoreBadge);
                    webrtcPlayerList.appendChild(li);
                    
                    // Collect player names for turn system
                    playerNames.push(players[id].name);
                }
                
                // Initialize multiplayer turn system
                if (typeof onRoomJoined === 'function' && playerNames.length > 0) {
                    onRoomJoined(roomName, playerName, playerNames);
                }
            }
        });

        // Update scores
        updateScores();
    });

    // Handle disconnection and reconnection
    playerRef.onDisconnect().remove(); // Remove player from room on disconnect
});
}

// Create and manage the leave room button dynamically
let leaveRoomButton = null;

function createLeaveRoomButton() {
    if (!leaveRoomButton) {
        leaveRoomButton = document.createElement('button');
        leaveRoomButton.id = 'leave-room';
        leaveRoomButton.textContent = 'Leave Room';
        leaveRoomButton.className = 'btn btn-danger w-100';
        leaveRoomButton.style.marginTop = '10px';

        // Add event listener
        leaveRoomButton.addEventListener('click', () => {
            if (!roomId) {
                alert('You are not currently in a room.');
                return;
            }

            const roomRef = database.ref(`rooms/${roomId}`);
            const playerRef = roomRef.child(`players/${myId}`);

            // Remove the player from the room
            playerRef.remove().then(() => {
            alert(`You have left the room: ${roomId}`);
            roomId = null; // Reset the room ID
            if (webrtcPlayerList) {
                webrtcPlayerList.innerHTML = ''; // Clear the player list
            }                // Clear localStorage
                localStorage.removeItem('roomName');
                localStorage.removeItem('playerName');
                
                // Reset input fields and show them again
                roomNameInput.value = '';
                playerNameInput.value = '';
                showInputsHideDisplay();
                updateJoinButtonState();

                // Hide the leave room button
                hideLeaveRoomButton();
                
                // Exit multiplayer mode
                if (typeof onRoomLeft === 'function') {
                    onRoomLeft();
                }
            }).catch((error) => {
                console.error('Error leaving the room:', error);
                alert('Failed to leave the room. Check the console for details.');
            });
        });

        // Add to the player list container
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

// Add functionality to save and display player scores
function updateScores() {
    const scoresRef = database.ref(`rooms/${roomId}/players`);
    scoresRef.on('value', (snapshot) => {
        const players = snapshot.val();
        if (players && webrtcPlayerList) {
            // Update existing player list items with new scores
            const listItems = webrtcPlayerList.querySelectorAll('li');
            listItems.forEach(li => {
                const playerName = li.textContent.split(' ')[0]; // Get player name (first part before score)
                const scoreBadge = li.querySelector('.badge');
                
                // Find the player data that matches this list item
                for (const id in players) {
                    if (players[id].name === playerName && scoreBadge) {
                        scoreBadge.textContent = players[id].score || 0;
                        break;
                    }
                }
            });
        }
    });
}

// Enable the join room button only if both fields have text
function updateJoinButtonState() {
    const roomName = roomNameInput.value.trim();
    const playerName = playerNameInput.value.trim();
    joinRoomButton.disabled = !(roomName && playerName);
}

roomNameInput.addEventListener('input', updateJoinButtonState);
playerNameInput.addEventListener('input', updateJoinButtonState);

// Initialize button state
updateJoinButtonState();

// Save room and player name to localStorage
function savePlayerData(roomName, playerName) {
    localStorage.setItem('roomName', roomName);
    localStorage.setItem('playerName', playerName);
}

// Load room and player name from localStorage
function loadPlayerData() {
    const roomName = localStorage.getItem('roomName');
    const playerName = localStorage.getItem('playerName');
    if (roomName && playerName) {
        roomNameInput.value = roomName;
        playerNameInput.value = playerName;
        updateJoinButtonState(); // Ensure the join button is enabled
        joinRoomButton.click();
    }
}

// Helper functions to manage input/display visibility
function hideInputsShowDisplay(roomName, playerName) {
    // Hide input fields
    const roomNameInput = document.getElementById('room-name');
    const playerNameInput = document.getElementById('player-name');
    const joinRoomButton = document.getElementById('join-room');
    
    if (roomNameInput) roomNameInput.style.display = 'none';
    if (playerNameInput) playerNameInput.style.display = 'none';
    if (joinRoomButton) joinRoomButton.style.display = 'none';
    
    // Show display elements
    const roomDisplay = document.getElementById('room-display');
    const playerDisplay = document.getElementById('player-display');
    const currentRoomName = document.getElementById('current-room-name');
    const currentPlayerName = document.getElementById('current-player-name');
    
    if (roomDisplay && currentRoomName) {
        currentRoomName.textContent = roomName;
        roomDisplay.style.display = 'block';
    }
    
    if (playerDisplay && currentPlayerName) {
        currentPlayerName.textContent = playerName;
        playerDisplay.style.display = 'block';
    }
    
    // Show the Player List title
    const playerListTitle = document.getElementById('player-list-title');
    if (playerListTitle) {
        playerListTitle.style.display = 'block';
    }
}

function showInputsHideDisplay() {
    // Show input fields
    const roomNameInput = document.getElementById('room-name');
    const playerNameInput = document.getElementById('player-name');
    const joinRoomButton = document.getElementById('join-room');
    
    if (roomNameInput) roomNameInput.style.display = 'block';
    if (playerNameInput) playerNameInput.style.display = 'block';
    if (joinRoomButton) joinRoomButton.style.display = 'block';
    
    // Hide display elements
    const roomDisplay = document.getElementById('room-display');
    const playerDisplay = document.getElementById('player-display');
    
    if (roomDisplay) roomDisplay.style.display = 'none';
    if (playerDisplay) playerDisplay.style.display = 'none';
    
    // Hide the Player List title
    const playerListTitle = document.getElementById('player-list-title');
    if (playerListTitle) {
        playerListTitle.style.display = 'none';
    }
}

// Load player data on page load
window.addEventListener('load', loadPlayerData);
