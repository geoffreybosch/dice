// Simplified WebRTC for dice results and material changes only
const peerConnections = {};
const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

// Generate a unique ID for this player
const myId = Math.random().toString(36).substring(2, 15);

// Host management
let isHost = false;
let hostId = null;

// Firebase-based WebRTC signaling
const roomNameInput = document.getElementById('room-name');
let roomId = null;

// Send signaling data to Firebase
function sendSignalingData(data) {
    if (!roomId) {
        console.error('❌ Cannot send signaling data: no room ID set');
        return;
    }
    
    // 🔧 Convert RTCSessionDescription objects to plain objects for Firebase serialization
    const serializedData = { ...data };
    if (data.offer && typeof data.offer === 'object') {
        serializedData.offer = {
            type: data.offer.type,
            sdp: data.offer.sdp
        };
        console.log('🔧 Serialized offer:', { type: serializedData.offer.type, sdpLength: serializedData.offer.sdp?.length });
    }
    if (data.answer && typeof data.answer === 'object') {
        serializedData.answer = {
            type: data.answer.type,
            sdp: data.answer.sdp
        };
        console.log('🔧 Serialized answer:', { type: serializedData.answer.type, sdpLength: serializedData.answer.sdp?.length });
    }
    if (data.candidate && typeof data.candidate === 'object') {
        serializedData.candidate = {
            candidate: data.candidate.candidate,
            sdpMid: data.candidate.sdpMid,
            sdpMLineIndex: data.candidate.sdpMLineIndex,
            usernameFragment: data.candidate.usernameFragment
        };
        console.log('🔧 Serialized ICE candidate:', { 
            hasCandidate: !!serializedData.candidate.candidate,
            sdpMid: serializedData.candidate.sdpMid,
            sdpMLineIndex: serializedData.candidate.sdpMLineIndex 
        });
    }
    
    console.log('�📤 Sending signaling data:', {
        type: serializedData.type,
        sender: serializedData.sender,
        target: serializedData.target,
        hasOffer: !!serializedData.offer,
        hasAnswer: !!serializedData.answer,
        hasCandidate: !!serializedData.candidate,
        offerType: serializedData.offer?.type,
        offerSdpLength: serializedData.offer?.sdp?.length
    });
    
    const roomRef = database.ref(`rooms/${roomId}/signaling`);
    roomRef.push(serializedData).then(() => {
        console.log('📤 Signaling data sent successfully');
    }).catch((error) => {
        console.error('❌ Error sending signaling data:', error);
    });
}

// Set up signaling listener for the current room
function setupSignaling() {
    if (!roomId) {
        console.error('❌ Cannot setup signaling: no room ID set');
        return;
    }
    
    console.log('🔄 Setting up signaling for room:', roomId);
    const roomRef = database.ref(`rooms/${roomId}`);
    const signalingRef = database.ref(`rooms/${roomId}/signaling`);
    
    // Listen for host changes to ensure we always have the correct host ID
    roomRef.child('hostId').on('value', (snapshot) => {
        const newHostId = snapshot.val();
        if (newHostId && newHostId !== hostId) {
            console.log('🎯 Host ID updated:', hostId, '→', newHostId);
            const wasHost = isHost;
            hostId = newHostId;
            isHost = (newHostId === myId);
            
            if (wasHost !== isHost) {
                console.log('🎯 My host status changed:', wasHost ? 'HOST' : 'CLIENT', '→', isHost ? 'HOST' : 'CLIENT');
                
                // Update my player record to reflect host status
                if (roomId) {
                    const playerRef = database.ref(`rooms/${roomId}/players/${myId}`);
                    playerRef.update({ isHost: isHost }).catch(error => {
                        console.error('❌ Error updating host status:', error);
                    });
                }
            }
        }
    });
    
    // Listen for signaling data
    signalingRef.on('child_added', (snapshot) => {
        const data = snapshot.val();
        console.log('📡 Raw signaling data received:', data);
        
        // Validate the signaling data structure
        if (!data || typeof data !== 'object') {
            console.error('❌ Invalid signaling data received:', data);
            return;
        }
        
        if (!data.sender || !data.type) {
            console.error('❌ Signaling data missing required fields:', data);
            return;
        }
        
        console.log('📡 Validated signaling data:', {
            type: data.type,
            sender: data.sender,
            target: data.target,
            hasOffer: !!data.offer,
            hasAnswer: !!data.answer,
            hasCandidate: !!data.candidate
        });
        
        // Ignore our own signaling messages
        if (data.sender === myId) {
            console.log('📡 Ignoring own signaling message');
            return;
        }

        if (data.type === 'offer') {
            console.log('📡 Received offer from', data.sender);
            
            // In host-based model, only accept offers from host if we're not host,
            // or only accept offers if we are host
            if (isHost) {
                console.log('� I am host, accepting offer from client', data.sender);
                handleOffer(data);
            } else if (data.sender === hostId) {
                console.log('📡 I am client, accepting offer from host', data.sender);
                handleOffer(data);
            } else {
                console.log('📡 Ignoring offer from non-host peer', data.sender, '(host is', hostId, ')');
                return;
            }
        } else if (data.type === 'answer' && peerConnections[data.sender]) {
            console.log('📡 Handling answer from', data.sender);
            handleAnswer(data);
        } else if (data.type === 'ice-candidate' && peerConnections[data.sender]) {
            console.log('📡 Handling ICE candidate from', data.sender);
            handleIceCandidate(data);
        }
    });
}

// Handle WebRTC offer
function handleOffer(data) {
    console.log(`🤝 === handleOffer(${data.sender}) START ===`);
    console.log(`🤝 Full data object:`, data);
    console.log(`🤝 Offer data:`, data.offer);
    
    // Validate the offer data
    if (!data.offer) {
        console.error(`❌ No offer data provided from ${data.sender}`);
        return;
    }
    
    if (!data.offer.type || !data.offer.sdp) {
        console.error(`❌ Invalid offer data from ${data.sender}:`, data.offer);
        console.error(`❌ Missing type: ${!data.offer.type}, Missing SDP: ${!data.offer.sdp}`);
        return;
    }
    
    console.log(`🤝 Offer validation passed - type: ${data.offer.type}, SDP length: ${data.offer.sdp.length}`);
    
    // Create peer connection if it doesn't exist, or if we're replacing due to glare condition
    if (!peerConnections[data.sender]) {
        console.log(`🤝 Creating new peer connection for ${data.sender}`);
        const peerConnection = createPeerConnection(data.sender);
        peerConnections[data.sender] = peerConnection;
    } else {
        console.log(`🤝 Using existing peer connection for ${data.sender}`);
    }
    
    const peerConnection = peerConnections[data.sender];
    
    console.log(`🤝 Setting remote description for ${data.sender}...`);
    console.log(`🤝 Creating RTCSessionDescription with:`, {
        type: data.offer.type,
        sdp: data.offer.sdp ? `${data.offer.sdp.substring(0, 100)}...` : 'undefined'
    });
    
    peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer))
        .then(() => {
            console.log(`🤝 Remote description set successfully for ${data.sender}`);
            console.log(`🤝 Creating answer for ${data.sender}...`);
            return peerConnection.createAnswer();
        })
        .then((answer) => {
            console.log(`🤝 Answer created for ${data.sender}:`, {
                type: answer.type,
                sdp: answer.sdp ? `${answer.sdp.substring(0, 100)}...` : 'undefined'
            });
            console.log(`🤝 Setting local description for ${data.sender}...`);
            return peerConnection.setLocalDescription(answer);
        })
        .then(() => {
            console.log(`🤝 Local description set for ${data.sender}`);
            console.log(`🤝 Sending answer to ${data.sender}...`);
            const answerData = {
                type: 'answer',
                sender: myId,
                target: data.sender,
                answer: peerConnection.localDescription
            };
            console.log(`🤝 Answer data to send:`, {
                type: answerData.type,
                sender: answerData.sender,
                target: answerData.target,
                answer: {
                    type: answerData.answer?.type,
                    sdp: answerData.answer?.sdp ? `${answerData.answer.sdp.substring(0, 100)}...` : 'undefined'
                }
            });
            sendSignalingData(answerData);
            console.log(`🤝 Answer sent to ${data.sender} successfully`);
        })
        .catch(error => {
            console.error(`❌ Error handling offer from ${data.sender}:`, error);
            console.error(`❌ Error stack:`, error.stack);
        });
        
    console.log(`🤝 === handleOffer(${data.sender}) END ===`);
}

// Handle WebRTC answer
function handleAnswer(data) {
    console.log(`🤝 Handling answer from ${data.sender}`);
    peerConnections[data.sender].setRemoteDescription(new RTCSessionDescription(data.answer))
        .catch(error => {
            console.error(`🤝 Error handling answer from ${data.sender}:`, error);
        });
}

// Handle ICE candidate
function handleIceCandidate(data) {
    console.log(`🧊 === handleIceCandidate(${data.sender}) START ===`);
    console.log(`🧊 Full data object:`, data);
    console.log(`🧊 Candidate data:`, data.candidate);
    
    // Validate the candidate data
    if (!data.candidate) {
        console.error(`❌ No candidate data provided from ${data.sender}`);
        return;
    }
    
    const candidate = data.candidate;
    
    // Check for required fields
    if (!candidate.candidate && !candidate.sdpMid && !candidate.sdpMLineIndex) {
        console.error(`❌ Invalid ICE candidate from ${data.sender} - missing all required fields:`, candidate);
        return;
    }
    
    // Check for the specific error condition: both sdpMid and sdpMLineIndex are null
    if (candidate.sdpMid === null && candidate.sdpMLineIndex === null) {
        console.error(`❌ Invalid ICE candidate from ${data.sender} - both sdpMid and sdpMLineIndex are null:`, candidate);
        return;
    }
    
    // Log candidate details for debugging
    console.log(`🧊 Candidate validation passed:`, {
        candidate: candidate.candidate ? `${candidate.candidate.substring(0, 50)}...` : 'null',
        sdpMid: candidate.sdpMid,
        sdpMLineIndex: candidate.sdpMLineIndex,
        sdpMLineIndexType: typeof candidate.sdpMLineIndex
    });
    
    console.log(`🧊 Adding ICE candidate from ${data.sender}...`);
    peerConnections[data.sender].addIceCandidate(new RTCIceCandidate(candidate))
        .then(() => {
            console.log(`🧊 ICE candidate added successfully from ${data.sender}`);
        })
        .catch(error => {
            console.error(`🧊 Error adding ICE candidate from ${data.sender}:`, error);
            console.error(`🧊 Error stack:`, error.stack);
            console.error(`🧊 Failed candidate data:`, candidate);
        });
        
    console.log(`🧊 === handleIceCandidate(${data.sender}) END ===`);
}

// Create a new WebRTC peer connection
function createPeerConnection(targetId) {
    console.log(`🔧 Creating peer connection for ${targetId}`);
    const peerConnection = new RTCPeerConnection(configuration);
    peerConnections[targetId] = peerConnection;

    // Create a data channel for outgoing messages
    const dataChannel = peerConnection.createDataChannel('gameMessages', {
        ordered: true
    });
    
    console.log(`🔧 Data channel created for ${targetId}, initial state: ${dataChannel.readyState}`);
    
    dataChannel.onopen = () => {
        console.log(`🎉 Data channel opened with ${targetId}!`);
        console.log(`🔗 Channel state: ${dataChannel.readyState}`);
        // Auto-refresh WebRTC status display if visible
        refreshWebRTCStatusIfVisible();
    };
    
    dataChannel.onclose = () => {
        console.log(`🔗 Data channel closed with ${targetId}`);
        // Auto-refresh WebRTC status display if visible
        refreshWebRTCStatusIfVisible();
    };
    
    dataChannel.onerror = (error) => {
        console.error(`❌ Data channel error with ${targetId}:`, error);
    };
    
    dataChannel.onmessage = (e) => {
        console.log('📩 Message from', targetId, e.data);
        handleReceivedMessage(e.data, targetId);
    };
    
    // Store the data channel reference
    peerConnection.dataChannel = dataChannel;

    peerConnection.onicecandidate = (event) => {
        console.log(`🧊 ICE candidate event for ${targetId}:`, event.candidate ? 'candidate found' : 'gathering complete');
        if (event.candidate) {
            const candidate = event.candidate;
            console.log(`🧊 ICE candidate details for ${targetId}:`, {
                candidate: candidate.candidate ? `${candidate.candidate.substring(0, 50)}...` : 'null',
                sdpMid: candidate.sdpMid,
                sdpMLineIndex: candidate.sdpMLineIndex,
                sdpMLineIndexType: typeof candidate.sdpMLineIndex
            });
            
            // Validate candidate before sending
            if (candidate.sdpMid === null && candidate.sdpMLineIndex === null) {
                console.warn(`⚠️ Skipping invalid ICE candidate for ${targetId} - both sdpMid and sdpMLineIndex are null`);
                return;
            }
            
            console.log(`🧊 Sending valid ICE candidate to ${targetId}`);
            sendSignalingData({
                type: 'ice-candidate',
                sender: myId,
                target: targetId,
                candidate: event.candidate
            });
        } else {
            console.log(`🧊 ICE gathering complete for ${targetId}`);
        }
    };

    // Listen for connection state changes
    peerConnection.onconnectionstatechange = () => {
        console.log(`🔗 Connection state changed for ${targetId}: ${peerConnection.connectionState}`);
        
        // Add timeout detection for stuck connections
        if (peerConnection.connectionState === 'connecting') {
            console.log(`⏱️ Connection with ${targetId} is connecting, setting 30s timeout`);
            setTimeout(() => {
                if (peerConnection.connectionState === 'connecting') {
                    console.warn(`⏰ Connection with ${targetId} stuck in connecting state for 30s`);
                    // Optionally restart the connection
                    console.log(`🔄 Attempting to restart connection with ${targetId}`);
                    // Clean up this connection
                    if (peerConnection.dataChannel) peerConnection.dataChannel.close();
                    if (peerConnection.incomingDataChannel) peerConnection.incomingDataChannel.close();
                    peerConnection.close();
                    delete peerConnections[targetId];
                    // Retry connection after a short delay
                    setTimeout(() => initiateConnection(targetId), 2000);
                }
            }, 30000);
        } else if (peerConnection.connectionState === 'failed') {
            console.error(`❌ Peer connection failed for ${targetId}`);
            // Attempt full reconnection for failed connections
            setTimeout(() => {
                if (peerConnection.connectionState === 'failed' || 
                    peerConnection.connectionState === 'disconnected') {
                    
                    // Don't cleanup during critical operations
                    if (criticalOperationInProgress) {
                        console.log(`� Delaying connection cleanup for ${targetId} due to critical operation`);
                        setTimeout(() => {
                            if (peerConnection.connectionState === 'failed' || 
                                peerConnection.connectionState === 'disconnected') {
                                console.log(`🔄 Delayed reconnection for ${targetId}`);
                                cleanupAndReconnect(targetId, peerConnection);
                            }
                        }, 5000);
                        return;
                    }
                    
                    console.log(`🔄 Full reconnection needed for ${targetId}`);
                    cleanupAndReconnect(targetId, peerConnection);
                }
            }, 1000);
        } else if (peerConnection.connectionState === 'disconnected') {
            console.warn(`⚠️ Peer connection disconnected for ${targetId}, monitoring for reconnection`);
            // Give it some time to potentially reconnect on its own
            setTimeout(() => {
                if (peerConnection.connectionState === 'disconnected') {
                    
                    // Don't cleanup during critical operations
                    if (criticalOperationInProgress) {
                        console.log(`🔒 Delaying disconnection cleanup for ${targetId} due to critical operation`);
                        setTimeout(() => {
                            if (peerConnection.connectionState === 'disconnected') {
                                console.log(`🔄 Delayed reconnection for ${targetId} after disconnect`);
                                cleanupAndReconnect(targetId, peerConnection);
                            }
                        }, 5000);
                        return;
                    }
                    
                    console.log(`🔄 Connection still disconnected after 5s, attempting reconnection to ${targetId}`);
                    cleanupAndReconnect(targetId, peerConnection);
                }
            }, 5000);
        } else if (peerConnection.connectionState === 'connected') {
            console.log(`✅ Peer connection established with ${targetId}`);
        }
        
        refreshWebRTCStatusIfVisible();
    };

    peerConnection.oniceconnectionstatechange = () => {
        console.log(`🧊 ICE connection state changed for ${targetId}: ${peerConnection.iceConnectionState}`);
        
        // Add specific handling for ICE connection failures
        if (peerConnection.iceConnectionState === 'failed') {
            console.error(`❌ ICE connection failed for ${targetId}`);
            // Attempt to restart ICE
            console.log(`🔄 Attempting ICE restart for ${targetId}`);
            peerConnection.restartIce();
        } else if (peerConnection.iceConnectionState === 'disconnected') {
            console.warn(`⚠️ ICE connection disconnected for ${targetId}, attempting reconnection in 3s`);
            // Set a timeout to attempt reconnection if still disconnected
            setTimeout(() => {
                if (peerConnection.iceConnectionState === 'disconnected' || 
                    peerConnection.iceConnectionState === 'failed') {
                    
                    // Don't cleanup during critical operations
                    if (criticalOperationInProgress) {
                        console.log(`� Delaying ICE reconnection for ${targetId} due to critical operation`);
                        setTimeout(() => {
                            if (peerConnection.iceConnectionState === 'disconnected' || 
                                peerConnection.iceConnectionState === 'failed') {
                                console.log(`🔄 Delayed ICE reconnection for ${targetId}`);
                                cleanupAndReconnect(targetId, peerConnection);
                            }
                        }, 5000);
                        return;
                    }
                    
                    console.log(`🔄 Attempting full reconnection to ${targetId}`);
                    cleanupAndReconnect(targetId, peerConnection);
                }
            }, 3000);
        }
        
        refreshWebRTCStatusIfVisible();
    };

    peerConnection.ondatachannel = (event) => {
        const channel = event.channel;
        console.log(`🔗 Incoming data channel from ${targetId}, state: ${channel.readyState}, label: ${channel.label}`);
        
        channel.onopen = () => {
            console.log(`🎉 Incoming data channel opened from ${targetId}!`);
            // Auto-refresh WebRTC status display if visible
            refreshWebRTCStatusIfVisible();
        };
        
        channel.onclose = () => {
            console.log(`🔗 Incoming data channel closed from ${targetId}`);
            // Auto-refresh WebRTC status display if visible
            refreshWebRTCStatusIfVisible();
        };
        
        channel.onerror = (error) => {
            console.error(`❌ Incoming data channel error from ${targetId}:`, error);
        };
        
        channel.onmessage = (e) => {
            console.log('📩 Message from', targetId, e.data);
            handleReceivedMessage(e.data, targetId);
        };
        
        // Store the incoming data channel reference as well
        peerConnection.incomingDataChannel = channel;
    };

    return peerConnection;
}

// Initiate WebRTC connection with another player
function initiateConnection(targetId) {
    console.log(`🤝 === initiateConnection(${targetId}) START ===`);
    
    if (peerConnections[targetId]) {
        console.log(`🤝 Connection with ${targetId} already exists`);
        return;
    }
    
    console.log(`🤝 Creating new peer connection with ${targetId}`);
    const peerConnection = createPeerConnection(targetId);
    peerConnections[targetId] = peerConnection;
    
    // Create offer
    console.log(`🤝 Creating offer for ${targetId}`);
    peerConnection.createOffer()
        .then(offer => {
            console.log(`🤝 Offer created for ${targetId}:`, {
                type: offer.type,
                sdp: offer.sdp ? `${offer.sdp.substring(0, 100)}...` : 'undefined'
            });
            console.log(`🤝 Setting local description for ${targetId}`);
            return peerConnection.setLocalDescription(offer);
        })
        .then(() => {
            console.log(`🤝 Local description set for ${targetId}`);
            console.log(`🤝 Sending offer to ${targetId}`);
            
            const offerData = {
                type: 'offer',
                sender: myId,
                target: targetId,
                offer: peerConnection.localDescription
            };
            
            console.log(`🤝 Offer data to send:`, {
                type: offerData.type,
                sender: offerData.sender,
                target: offerData.target,
                offer: {
                    type: offerData.offer?.type,
                    sdp: offerData.offer?.sdp ? `${offerData.offer.sdp.substring(0, 100)}...` : 'undefined'
                }
            });
            
            sendSignalingData(offerData);
            console.log(`🤝 Offer sent to ${targetId} successfully`);
        })
        .catch(error => {
            console.error(`🤝 Error creating offer for ${targetId}:`, error);
        });
        
    console.log(`🤝 === initiateConnection(${targetId}) END ===`);
}

// Message handling for WebRTC data channels (simplified for Firebase state management)
function handleReceivedMessage(messageData, fromPeerId = null) {
    console.log('📨 === handleReceivedMessage() START ===');
    console.log('📨 Raw message data:', messageData);
    console.log('📨 From peer:', fromPeerId);
    
    try {
        const data = JSON.parse(messageData);
        console.log('📨 Parsed WebRTC message:', data);
        
        // With Firebase state management, we mainly use WebRTC for direct communication
        // Most game state coordination is handled by Firebase now
        switch (data.type) {
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
                console.log('❓ Unknown message type (Firebase handles most state):', data.type);
        }
        
        console.log('📨 === handleReceivedMessage() END ===');
    } catch (error) {
        console.error('❌ Error parsing message:', error, messageData);
        console.log('📨 === handleReceivedMessage() END (ERROR) ===');
    }
}

// Send message to all connected peers via host-based routing with retry logic
function sendToAllPeers(messageData, retryCount = 0, maxRetries = 3) {
    console.log(`📡 === sendToAllPeers() START (attempt ${retryCount + 1}/${maxRetries + 1}) ===`);
    console.log('📡 Message to send:', messageData);
    console.log('📡 Host model: I am', isHost ? 'HOST' : 'CLIENT');
    
    if (!peerConnections) {
        console.error('❌ No peer connections available');
        console.log('📡 === sendToAllPeers() END (NO CONNECTIONS) ===');
        return;
    }
    
    const totalPeers = Object.keys(peerConnections).length;
    console.log(`📊 Total peer connections: ${totalPeers}`);
    
    let messagesSent = 0;
    let failedSends = [];
    
    if (isHost) {
        // Host sends to all connected clients
        console.log('📡 HOST: Sending message to all clients');
        for (const peerId in peerConnections) {
            const connection = peerConnections[peerId];
            console.log(`📋 HOST: Checking client ${peerId}: connectionState=${connection?.connectionState}`);
            
            if (connection && connection.connectionState === 'connected') {
                if (connection.dataChannel && connection.dataChannel.readyState === 'open') {
                    try {
                        connection.dataChannel.send(messageData);
                        console.log(`✅ HOST: Sent message to client ${peerId}`);
                        messagesSent++;
                    } catch (error) {
                        console.error(`❌ HOST: Error sending to client ${peerId}:`, error);
                        failedSends.push(peerId);
                    }
                } else {
                    console.warn(`⚠️ HOST: No open data channel to client ${peerId}`);
                    failedSends.push(peerId);
                }
            } else {
                console.warn(`⚠️ HOST: Client ${peerId} not connected`);
                failedSends.push(peerId);
            }
        }
    } else {
        // Client sends only to host
        console.log('📡 CLIENT: Sending message to host');
        if (hostId && peerConnections[hostId]) {
            const connection = peerConnections[hostId];
            console.log(`📋 CLIENT: Checking host ${hostId}: connectionState=${connection?.connectionState}`);
            
            if (connection && connection.connectionState === 'connected') {
                // Try outgoing channel first (if client initiated), then incoming
                let channelUsed = false;
                
                if (connection.dataChannel && connection.dataChannel.readyState === 'open') {
                    try {
                        connection.dataChannel.send(messageData);
                        console.log(`✅ CLIENT: Sent message to host ${hostId} via outgoing channel`);
                        messagesSent++;
                        channelUsed = true;
                    } catch (error) {
                        console.error(`❌ CLIENT: Error sending to host via outgoing channel:`, error);
                    }
                }
                
                if (!channelUsed && connection.incomingDataChannel && connection.incomingDataChannel.readyState === 'open') {
                    try {
                        connection.incomingDataChannel.send(messageData);
                        console.log(`✅ CLIENT: Sent message to host ${hostId} via incoming channel`);
                        messagesSent++;
                        channelUsed = true;
                    } catch (error) {
                        console.error(`❌ CLIENT: Error sending to host via incoming channel:`, error);
                    }
                }
                
                if (!channelUsed) {
                    console.warn(`⚠️ CLIENT: No open data channels to host ${hostId}`);
                    failedSends.push(hostId);
                }
            } else {
                console.warn(`⚠️ CLIENT: Host ${hostId} not connected`);
                failedSends.push(hostId);
            }
        } else {
            console.warn('⚠️ CLIENT: No connection to host available');
            if (hostId) failedSends.push(hostId);
        }
    }
    
    console.log(`📊 Total messages sent: ${messagesSent}, Failed: ${failedSends.length}`);
    
    // Retry logic for failed sends
    if (failedSends.length > 0 && retryCount < maxRetries) {
        console.log(`🔄 Retrying failed sends in 2 seconds (attempt ${retryCount + 2}/${maxRetries + 1})`);
        setTimeout(() => {
            sendToAllPeers(messageData, retryCount + 1, maxRetries);
        }, 2000);
    } else if (failedSends.length > 0) {
        console.error(`❌ Failed to send message to ${failedSends.length} peers after ${maxRetries + 1} attempts`);
    }
    
    console.log('📡 === sendToAllPeers() END ===');
}

// Debug function to check WebRTC connection status
function debugWebRTCConnections() {
    console.log('🔍 === WebRTC Connection Status ===');
    
    if (!peerConnections) {
        console.log('❌ No peer connections object');
        updateWebRTCStatusDisplay('❌ No peer connections object');
        return;
    }
    
    const peers = Object.keys(peerConnections);
    console.log(`📊 Total peers: ${peers.length}`);
    
    // Get current player info
    const currentPlayerName = document.getElementById('current-player-name')?.textContent || 'Unknown';
    const currentRoomName = document.getElementById('current-room-name')?.textContent || roomId || 'Unknown';
    
    let statusHtml = `<div class="mb-3 p-2 bg-info bg-opacity-10 border border-info rounded">`;
    statusHtml += `<div class="fw-bold text-info">🎮 My Info</div>`;
    statusHtml += `<div class="small">Player: <strong>${currentPlayerName}</strong></div>`;
    statusHtml += `<div class="small">Room: <strong>${currentRoomName}</strong></div>`;
    statusHtml += `<div class="small">Player ID: <code>${myId.substring(0, 8)}...</code></div>`;
    statusHtml += `<div class="small">Status: <strong class="${isHost ? 'text-warning' : 'text-info'}">${isHost ? '👑 HOST' : '📱 CLIENT'}</strong></div>`;
    if (!isHost && hostId) {
        statusHtml += `<div class="small">Host ID: <code>${hostId.substring(0, 8)}...</code></div>`;
    }
    statusHtml += `</div>`;
    
    statusHtml += `<div class="mb-2"><strong>📊 Total peers: ${peers.length}</strong></div>`;
    
    if (peers.length === 0) {
        statusHtml += '<div class="text-warning">⚠️ No WebRTC connections established</div>';
        statusHtml += '<div class="text-muted small mt-2">This could mean:</div>';
        statusHtml += '<ul class="text-muted small mb-0">';
        statusHtml += '<li>Players haven\'t joined yet</li>';
        statusHtml += '<li>Signaling is not working</li>';
        statusHtml += '<li>WebRTC handshake failed</li>';
        statusHtml += '</ul>';
    } else {
        for (const peerId of peers) {
            const connection = peerConnections[peerId];
            console.log(`👤 Peer ${peerId}:`);
            console.log(`  - Connection state: ${connection?.connectionState}`);
            console.log(`  - ICE connection state: ${connection?.iceConnectionState}`);
            console.log(`  - ICE gathering state: ${connection?.iceGatheringState}`);
            console.log(`  - Signaling state: ${connection?.signalingState}`);
            console.log(`  - Outgoing channel: ${connection?.dataChannel?.readyState || 'none'}`);
            console.log(`  - Incoming channel: ${connection?.incomingDataChannel?.readyState || 'none'}`);
            
            const connectionState = connection?.connectionState || 'unknown';
            const iceState = connection?.iceConnectionState || 'unknown';
            const signalingState = connection?.signalingState || 'unknown';
            const outgoingChannel = connection?.dataChannel?.readyState || 'none';
            const incomingChannel = connection?.incomingDataChannel?.readyState || 'none';
            
            // Determine status color
            let statusClass = 'text-success';
            if (connectionState !== 'connected' || (outgoingChannel !== 'open' && incomingChannel !== 'open')) {
                statusClass = 'text-warning';
            }
            if (connectionState === 'failed' || connectionState === 'disconnected') {
                statusClass = 'text-danger';
            }
            
            statusHtml += `<div class="border-start border-3 ps-2 mb-2 ${statusClass.replace('text-', 'border-')}">`;
            statusHtml += `<div class="fw-bold">👤 Peer: ${peerId.substring(0, 8)}...</div>`;
            statusHtml += `<div class="small">Connection: <span class="${statusClass}">${connectionState}</span></div>`;
            statusHtml += `<div class="small">ICE State: <span class="${statusClass}">${iceState}</span></div>`;
            statusHtml += `<div class="small">Signaling: <span class="${statusClass}">${signalingState}</span></div>`;
            statusHtml += `<div class="small">Outgoing Channel: <span class="${outgoingChannel === 'open' ? 'text-success' : 'text-warning'}">${outgoingChannel}</span></div>`;
            statusHtml += `<div class="small">Incoming Channel: <span class="${incomingChannel === 'open' ? 'text-success' : 'text-warning'}">${incomingChannel}</span></div>`;
            statusHtml += `</div>`;
        }
    }
    
    statusHtml += `<div class="text-muted small mt-3">Last updated: ${new Date().toLocaleTimeString()}</div>`;
    
    updateWebRTCStatusDisplay(statusHtml);
    console.log('🔍 === End WebRTC Status ===');
}

// Add a function to diagnose signaling issues
function debugSignaling() {
    console.log('📡 === Signaling Debug ===');
    console.log(`Room ID: ${roomId}`);
    console.log(`My ID: ${myId}`);
    
    if (roomId && database) {
        const signalingRef = database.ref(`rooms/${roomId}/signaling`);
        signalingRef.limitToLast(20).once('value', (snapshot) => {
            const messages = snapshot.val();
            console.log('📡 Recent signaling messages:', messages);
            
            if (messages) {
                const relevantMessages = [];
                const staleMessages = [];
                
                Object.keys(messages).forEach(key => {
                    const msg = messages[key];
                    console.log(`📡 ${key}: ${msg.type} from ${msg.sender} to ${msg.target || 'all'}`);
                    
                    // Check if message is relevant to current session
                    if (msg.sender === myId || msg.target === myId) {
                        relevantMessages.push({key, msg});
                    } else {
                        staleMessages.push({key, msg});
                    }
                });
                
                if (relevantMessages.length > 0) {
                    console.log('📡 Messages relevant to me:', relevantMessages);
                } else {
                    console.log('📡 No messages found relevant to my ID');
                }
                
                if (staleMessages.length > 0) {
                    console.log('📡 Stale messages (not involving me):', staleMessages.length);
                }
                
                // Check for missing answers
                const offersToMe = relevantMessages.filter(m => m.msg.type === 'offer' && m.msg.target === myId);
                const answersFromMe = relevantMessages.filter(m => m.msg.type === 'answer' && m.msg.sender === myId);
                
                console.log(`📡 Offers received by me: ${offersToMe.length}`);
                console.log(`📡 Answers sent by me: ${answersFromMe.length}`);
                
                if (offersToMe.length > answersFromMe.length) {
                    console.warn('⚠️ Missing answers! You received offers but didn\'t send answers back');
                }
            } else {
                console.log('📡 No signaling messages found');
            }
        });
    } else {
        console.log('❌ Cannot debug signaling: missing room ID or database');
    }
}

// Add function to clear stale signaling data
function clearStaleSignaling() {
    console.log('🧹 === Clearing Stale Signaling Data ===');
    
    if (!roomId || !database) {
        console.log('❌ Cannot clear signaling: missing room ID or database');
        return;
    }
    
    const signalingRef = database.ref(`rooms/${roomId}/signaling`);
    
    // Get all signaling messages
    signalingRef.once('value', (snapshot) => {
        const messages = snapshot.val();
        if (!messages) {
            console.log('🧹 No signaling messages to clear');
            return;
        }
        
        const currentTime = Date.now();
        const staleThreshold = 5 * 60 * 1000; // 5 minutes
        let removedCount = 0;
        
        Object.keys(messages).forEach(key => {
            const msg = messages[key];
            const messageTime = parseInt(key.substring(1), 36) || 0; // Firebase push key timestamp
            
            // Remove messages that don't involve current player or are very old
            if ((msg.sender !== myId && msg.target !== myId) || 
                (currentTime - messageTime > staleThreshold)) {
                signalingRef.child(key).remove();
                removedCount++;
                console.log(`🧹 Removed stale message: ${key}`);
            }
        });
        
        console.log(`🧹 Removed ${removedCount} stale signaling messages`);
    });
}

// Update the WebRTC status display in the UI
function updateWebRTCStatusDisplay(content) {
    const statusDisplay = document.getElementById('webrtc-status-display');
    const statusContent = document.getElementById('webrtc-status-content');
    
    if (statusDisplay && statusContent) {
        statusContent.innerHTML = content;
        statusDisplay.style.display = 'block';
    }
}

// Auto-refresh WebRTC status if the display is currently visible
function refreshWebRTCStatusIfVisible() {
    const statusDisplay = document.getElementById('webrtc-status-display');
    if (statusDisplay && statusDisplay.style.display !== 'none') {
        // Small delay to allow connection state to update
        setTimeout(() => {
            debugWebRTCConnections();
        }, 100);
    }
}

// Clean up peer connections for players who are no longer in the room
function cleanupOldPeerConnections(currentPlayerIds) {
    console.log('🧹 Cleaning up old peer connections...');
    console.log('🧹 Current players:', currentPlayerIds);
    console.log('🧹 Existing peer connections:', Object.keys(peerConnections));
    
    const connectionsToRemove = [];
    
    // Find connections to players who are no longer in the room
    for (const peerId in peerConnections) {
        if (!currentPlayerIds.includes(peerId)) {
            connectionsToRemove.push(peerId);
        }
    }
    
    // Close and remove old connections
    for (const peerId of connectionsToRemove) {
        console.log(`🧹 Removing old connection to ${peerId}`);
        const connection = peerConnections[peerId];
        
        if (connection) {
            // Close data channels
            if (connection.dataChannel) {
                connection.dataChannel.close();
            }
            if (connection.incomingDataChannel) {
                connection.incomingDataChannel.close();
            }
            
            // Close peer connection
            connection.close();
        }
        
        // Remove from connections object
        delete peerConnections[peerId];
    }
    
    if (connectionsToRemove.length > 0) {
        console.log(`🧹 Cleaned up ${connectionsToRemove.length} old connections`);
        // Refresh status display if visible
        refreshWebRTCStatusIfVisible();
    } else {
        console.log('🧹 No old connections to clean up');
    }
}

// Make debug functions globally available
window.debugWebRTCConnections = debugWebRTCConnections;
window.debugSignaling = debugSignaling;
window.clearStaleSignaling = clearStaleSignaling;

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
        console.log('Room ID set to:', roomId);
        
        // Set up signaling listener for this room
        setupSignaling();
        
        // Save data to localStorage
    savePlayerData(roomName, playerName);

    // Set the room reference and handle reconnection
    const roomRef = database.ref(`rooms/${roomId}`);
    const playerRef = roomRef.child(`players/${myId}`);
    
    console.log('Player ID:', myId);
    console.log('Checking for duplicate names...');

    // Check for host status and duplicate names
    roomRef.once('value', (roomSnapshot) => {
        console.log('Received room data:', roomSnapshot.val());
        const roomData = roomSnapshot.val();
        const players = roomData?.players || {};
        
        // Determine host status
        if (!roomData || Object.keys(players).length === 0) {
            // First player becomes host
            isHost = true;
            hostId = myId;
            console.log('🎯 I am the first player - becoming host');
        } else {
            // Check if I'm the existing host (e.g., rejoining after refresh)
            const existingHostId = roomData.hostId;
            if (existingHostId && players[existingHostId]) {
                // There's an existing host still in the room
                if (existingHostId === myId) {
                    // I'm rejoining as the existing host
                    isHost = true;
                    hostId = myId;
                    console.log('🎯 Rejoining as existing host');
                } else {
                    // Someone else is host
                    isHost = false;
                    hostId = existingHostId;
                    console.log('🎯 Joining as client, host is:', hostId);
                }
            } else {
                // No valid host exists, make me the host
                isHost = true;
                hostId = myId;
                console.log('🎯 No valid host found, becoming new host');
            }
        }
        
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

        // Add player to room with Firebase state integration
        console.log('Adding player to room...');
        
        // Set room data including host information
        const roomUpdates = {};
        roomUpdates[`players/${myId}`] = { 
            name: playerName, 
            score: players?.[myId]?.score || 0,
            isHost: isHost,
            state: 'waiting', // Initialize with waiting state
            joinedAt: Date.now()
        };
        
        // Always set hostId if this player is the host
        if (isHost) {
            roomUpdates['hostId'] = myId;
            console.log('🎯 Setting hostId in Firebase to:', myId);
        }
        
        roomRef.update(roomUpdates).then(() => {
            console.log('Player added successfully as', isHost ? 'HOST' : 'CLIENT');
            console.log('🎯 Firebase hostId should now be:', isHost ? myId : 'unchanged');
            
            // Set myPlayerId for the game system to use player name
            if (typeof window !== 'undefined') {
                window.myPlayerId = playerName;
                console.log('🎮 Game system myPlayerId set to:', playerName);
            }
            
            // Initialize Firebase state manager with player name as ID
            if (typeof initializeFirebaseStateManager === 'function') {
                const success = initializeFirebaseStateManager(roomId, playerName, playerName);
                if (success) {
                    console.log('🔥 Firebase state manager initialized');
                    
                    // Initialize game state if we're the host
                    if (isHost) {
                        setTimeout(() => {
                            const gameStateRef = database.ref(`rooms/${roomId}/gameState`);
                            gameStateRef.once('value', (snapshot) => {
                                if (!snapshot.exists()) {
                                    console.log('🔥 HOST: Initializing game state');
                                    gameStateRef.set({
                                        currentTurn: playerName, // Host goes first using player name
                                        turnStartTime: Date.now(),
                                        gamePhase: 'active',
                                        createdAt: Date.now()
                                    });
                                    
                                    // Set host to rolling state
                                    if (typeof setPlayerState === 'function') {
                                        setPlayerState('rolling');
                                    }
                                }
                            });
                        }, 1000);
                    }
                } else {
                    console.error('❌ Failed to initialize Firebase state manager');
                }
            }
        }).catch((error) => {
            console.error('Error adding player:', error);
        });

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
                const currentPlayerIds = []; // Track current player IDs for cleanup
                
                for (const id in players) {
                    currentPlayerIds.push(id); // Add to current players list
                    
                    const li = document.createElement('li');
                    li.className = 'list-group-item d-flex justify-content-between align-items-center';
                    li.setAttribute('data-player-name', players[id].name);
                    
                    // Create player name with turn indicator and host badge
                    const playerNameSpan = document.createElement('span');
                    playerNameSpan.className = 'player-name-text';
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
                    
                    // Collect player names for turn system
                    playerNames.push(players[id].name);
                }
                
                // Clean up old peer connections before establishing new ones
                cleanupOldPeerConnections(currentPlayerIds);
                
                // Check if host is still in the room, if not promote someone
                // Get fresh room data to check current hostId
                roomRef.once('value', (roomSnapshot) => {
                    const currentRoomData = roomSnapshot.val();
                    const currentHostId = currentRoomData?.hostId;
                    if (currentHostId && !currentPlayerIds.includes(currentHostId)) {
                        console.log('🎯 Current host has left, need to promote new host');
                        // If I'm the first player in the list, I become the new host
                        if (currentPlayerIds.length > 0 && currentPlayerIds[0] === myId) {
                            console.log('🎯 Promoting myself to host');
                            isHost = true;
                            hostId = myId;
                            
                            // Update Firebase with new host
                            const hostUpdate = {
                                hostId: myId,
                                [`players/${myId}/isHost`]: true
                            };
                            roomRef.update(hostUpdate).then(() => {
                                console.log('🎯 Successfully promoted to host in Firebase');
                            }).catch(error => {
                                console.error('❌ Error promoting to host:', error);
                            });
                        }
                    }
                });
                
                // Initialize multiplayer turn system
                if (typeof onRoomJoined === 'function' && playerNames.length > 0) {
                    onRoomJoined(roomName, playerName, playerNames);
                }
                
                // Initiate WebRTC connections based on host model
                console.log('🔗 Checking for new connections needed...');
                console.log('🎯 Host status: I am', isHost ? 'HOST' : 'CLIENT', '| Host ID:', hostId);
                console.log('🔗 Current players in room:', Object.keys(players));
                console.log('🔗 My ID:', myId);
                console.log('🔗 Existing connections:', Object.keys(peerConnections));
                
                if (isHost) {
                    // As host, initiate connections to all other players
                    for (const playerId in players) {
                        if (playerId !== myId && !peerConnections[playerId]) {
                            console.log(`🔗 HOST: Initiating connection to client ${playerId} (${players[playerId].name})`);
                            console.log(`🔗 HOST: Current connections before initiation:`, Object.keys(peerConnections));
                            
                            // Add a small delay to stagger connections
                            const delay = Math.random() * 500; // 0-500ms random delay
                            console.log(`🔗 HOST: Adding ${delay.toFixed(0)}ms delay before connecting to ${playerId}`);
                            setTimeout(() => {
                                console.log(`🔗 HOST: Delay expired, checking if connection to ${playerId} still needed...`);
                                if (!peerConnections[playerId]) {
                                    console.log(`🔗 HOST: Initiating connection to ${playerId} now`);
                                    initiateConnection(playerId);
                                } else {
                                    console.log(`🔗 HOST: Connection to ${playerId} already exists, skipping`);
                                }
                            }, delay);
                        } else if (playerId !== myId) {
                            console.log(`🔗 HOST: Connection to ${playerId} already exists, skipping initiation`);
                        }
                    }
                    
                    // Log summary of host connection status
                    console.log(`🔗 HOST: Connection summary - Total players: ${Object.keys(players).length}, My connections: ${Object.keys(peerConnections).length}`);
                } else {
                    // As client, only connect to host (host will initiate)
                    if (hostId && hostId !== myId && !peerConnections[hostId]) {
                        console.log(`🔗 CLIENT: Waiting for host ${hostId} to initiate connection`);
                        // Don't initiate - wait for host to connect to us
                    }
                    
                    // Clean up any connections to non-host players
                    for (const playerId in peerConnections) {
                        if (playerId !== hostId) {
                            console.log(`🧹 CLIENT: Cleaning up connection to non-host peer ${playerId}`);
                            const connection = peerConnections[playerId];
                            if (connection) {
                                if (connection.dataChannel) connection.dataChannel.close();
                                if (connection.incomingDataChannel) connection.incomingDataChannel.close();
                                connection.close();
                            }
                            delete peerConnections[playerId];
                        }
                    }
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
            
            // Clean up Firebase state manager
            if (typeof cleanupFirebaseStateManager === 'function') {
                cleanupFirebaseStateManager();
            }
            
            roomId = null; // Reset the room ID
            if (webrtcPlayerList) {
                webrtcPlayerList.innerHTML = ''; // Clear the player list
            }
            
            // Clean up all peer connections when leaving
            console.log('🧹 Cleaning up all peer connections on room leave...');
            for (const peerId in peerConnections) {
                const connection = peerConnections[peerId];
                if (connection) {
                    if (connection.dataChannel) connection.dataChannel.close();
                    if (connection.incomingDataChannel) connection.incomingDataChannel.close();
                    connection.close();
                }
            }
            // Clear the connections object
            Object.keys(peerConnections).forEach(key => delete peerConnections[key]);
            console.log('🧹 All peer connections cleaned up');
            
            // Clear localStorage
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

// Clean up on page unload
window.addEventListener('beforeunload', () => {
    console.log('🧹 Page unloading - cleaning up peer connections...');
    
    // Close all peer connections
    for (const peerId in peerConnections) {
        const connection = peerConnections[peerId];
        if (connection) {
            if (connection.dataChannel) connection.dataChannel.close();
            if (connection.incomingDataChannel) connection.incomingDataChannel.close();
            connection.close();
        }
    }
    
    console.log('🧹 Peer connections cleaned up on page unload');
});
