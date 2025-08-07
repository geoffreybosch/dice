// Firebase Performance Optimizations
// Implements efficient data querying and management

/**
 * Get game history for building history views
 * @param {string} roomId - Room ID
 * @param {string} eventType - Type of event to query
 * @param {number} limit - Maximum number of events to retrieve (0 = all)
 */
function getGameHistory(roomId, eventType, limit = 0) {
    if (!database || !roomId) return Promise.resolve({});
    
    const ref = database.ref(`rooms/${roomId}/${eventType}`)
        .orderByChild('timestamp');
    
    if (limit > 0) {
        return ref.limitToLast(limit).once('value')
            .then(snapshot => snapshot.val() || {});
    } else {
        return ref.once('value')
            .then(snapshot => snapshot.val() || {});
    }
}

/**
 * Batch update multiple game state changes efficiently
 * @param {string} roomId - Room ID  
 * @param {Object} updates - Object containing all updates to apply
 */
function batchUpdateGameState(roomId, updates) {
    if (!database || !roomId) return Promise.resolve();
    
    // Add timestamp to all updates for tracking
    const timestampedUpdates = {};
    Object.keys(updates).forEach(key => {
        timestampedUpdates[key] = updates[key];
        if (typeof updates[key] === 'object' && updates[key] !== null) {
            timestampedUpdates[key].lastUpdate = Date.now();
        }
    });
    
    const roomRef = database.ref(`rooms/${roomId}`);
    return roomRef.update(timestampedUpdates);
}

/**
 * Subscribe to only essential real-time updates to reduce bandwidth
 * @param {string} roomId - Room ID
 * @param {Function} callback - Callback for updates
 */
function subscribeToEssentialUpdates(roomId, callback) {
    if (!database || !roomId) return;
    
    // Only listen to critical game state changes, not temporary events
    const essentialPaths = [
        'gameState',
        'players'
    ];
    
    const listeners = [];
    
    essentialPaths.forEach(path => {
        const ref = database.ref(`rooms/${roomId}/${path}`);
        const listener = ref.on('value', (snapshot) => {
            callback(path, snapshot.val());
        });
        listeners.push({ ref, listener, path });
    });
    
    return listeners;
}

/**
 * Enhanced event broadcasting for game history tracking
 * @param {string} roomId - Room ID
 * @param {string} eventType - Type of event
 * @param {Object} eventData - Event data to broadcast
 */
function broadcastGameEvent(roomId, eventType, eventData) {
    if (!database || !roomId) return Promise.resolve();
    
    const eventRef = database.ref(`rooms/${roomId}/${eventType}`);
    
    // Add the new event with enhanced metadata for history views
    return eventRef.push({
        ...eventData,
        timestamp: Date.now(),
        gameTime: Date.now(), // For game history chronology
        eventId: database.ref().push().key // Unique event identifier
    });
}

/**
 * Get chronological game timeline for history view
 * @param {string} roomId - Room ID
 * @param {number} fromTimestamp - Start timestamp (optional)
 * @param {number} toTimestamp - End timestamp (optional)
 */
function getGameTimeline(roomId, fromTimestamp = 0, toTimestamp = Date.now()) {
    if (!database || !roomId) return Promise.resolve([]);
    
    const eventTypes = [
        'diceResults',
        'diceSelections', 
        'rollingStart',
        'farkleAlerts',
        'hotDiceEvents',
        'materialChanges'
    ];
    
    const promises = eventTypes.map(eventType => 
        database.ref(`rooms/${roomId}/${eventType}`)
            .orderByChild('timestamp')
            .startAt(fromTimestamp)
            .endAt(toTimestamp)
            .once('value')
            .then(snapshot => {
                const events = snapshot.val() || {};
                return Object.keys(events).map(key => ({
                    ...events[key],
                    eventType,
                    eventKey: key
                }));
            })
    );
    
    return Promise.all(promises).then(eventArrays => {
        // Flatten and sort all events by timestamp
        const allEvents = eventArrays.flat();
        return allEvents.sort((a, b) => a.timestamp - b.timestamp);
    });
}

/**
 * Get player-specific game statistics
 * @param {string} roomId - Room ID
 * @param {string} playerId - Player ID
 */
function getPlayerGameStats(roomId, playerId) {
    if (!database || !roomId || !playerId) return Promise.resolve({});
    
    return getGameTimeline(roomId).then(timeline => {
        const playerEvents = timeline.filter(event => event.playerId === playerId);
        
        const stats = {
            totalRolls: 0,
            totalFarkles: 0,
            totalHotDice: 0,
            rollHistory: [],
            scoreHistory: []
        };
        
        playerEvents.forEach(event => {
            switch(event.eventType) {
                case 'diceResults':
                    stats.totalRolls++;
                    stats.rollHistory.push({
                        timestamp: event.timestamp,
                        dice: event.diceResults
                    });
                    break;
                case 'farkleAlerts':
                    stats.totalFarkles++;
                    break;
                case 'hotDiceEvents':
                    stats.totalHotDice++;
                    break;
            }
        });
        
        return stats;
    });
}

/**
 * Implement connection pooling for multiple rooms
 */
class FirebaseConnectionManager {
    constructor() {
        this.connections = new Map();
        this.maxConnections = 5;
    }
    
    getConnection(roomId) {
        if (this.connections.has(roomId)) {
            return this.connections.get(roomId);
        }
        
        if (this.connections.size >= this.maxConnections) {
            // Remove oldest connection
            const oldestRoom = this.connections.keys().next().value;
            this.closeConnection(oldestRoom);
        }
        
        const connection = this.createConnection(roomId);
        this.connections.set(roomId, connection);
        return connection;
    }
    
    createConnection(roomId) {
        return {
            roomId,
            ref: database.ref(`rooms/${roomId}`),
            listeners: [],
            lastActivity: Date.now()
        };
    }
    
    closeConnection(roomId) {
        const connection = this.connections.get(roomId);
        if (connection) {
            // Clean up listeners
            connection.listeners.forEach(listener => {
                listener.ref.off(listener.event, listener.callback);
            });
            this.connections.delete(roomId);
        }
    }
}

// Export performance utilities (updated for history support)
window.getGameHistory = getGameHistory;
window.batchUpdateGameState = batchUpdateGameState;
window.subscribeToEssentialUpdates = subscribeToEssentialUpdates;
window.broadcastGameEvent = broadcastGameEvent;
window.getGameTimeline = getGameTimeline;
window.getPlayerGameStats = getPlayerGameStats;
window.FirebaseConnectionManager = FirebaseConnectionManager;
