// Firebase Data Structure Migration Utilities
// Helps optimize existing room structures without breaking compatibility

/**
 * Optimize room structure for better performance
 * @param {string} roomId - Room ID to optimize
 */
function optimizeRoomStructure(roomId) {
    if (!database || !roomId) return Promise.resolve();
    
    return database.ref(`rooms/${roomId}`).once('value').then(snapshot => {
        const roomData = snapshot.val();
        if (!roomData) return;
        
        const optimizations = {};
        
        // Consolidate game settings if scattered
        if (roomData.gameSettings) {
            optimizations['settings/rules'] = {
                winningScore: roomData.gameSettings.winningScore || 10000,
                minimumScore: roomData.gameSettings.minimumScore || 500,
                threeOnesValue: roomData.gameSettings.threeOnesValue || 1000,
                lastUpdated: Date.now()
            };
        }
        
        // Add room metadata if missing
        if (!roomData.metadata) {
            optimizations['metadata'] = {
                version: '2.0',
                optimizedAt: Date.now(),
                lastActivity: Date.now()
            };
        }
        
        // Apply optimizations if any
        if (Object.keys(optimizations).length > 0) {
            return database.ref(`rooms/${roomId}`).update(optimizations);
        }
    });
}

/**
 * Migrate to improved player data structure
 * @param {string} roomId - Room ID
 */
function migratePlayerStructure(roomId) {
    if (!database || !roomId) return Promise.resolve();
    
    return database.ref(`rooms/${roomId}/players`).once('value').then(snapshot => {
        const players = snapshot.val();
        if (!players) return;
        
        const migrations = {};
        
        Object.keys(players).forEach(playerId => {
            const player = players[playerId];
            
            // Only migrate if not already in new structure
            if (!player.profile && (player.name || player.score !== undefined)) {
                migrations[`players/${playerId}/profile`] = {
                    name: player.name,
                    joinedAt: player.joinedAt || Date.now(),
                    isHost: player.isHost || false
                };
                
                migrations[`players/${playerId}/game`] = {
                    score: player.score || 0,
                    state: player.state || 'waiting',
                    lastAction: player.stateTimestamp || Date.now()
                };
                
                migrations[`players/${playerId}/connection`] = {
                    isConnected: player.isConnected !== false,
                    lastSeen: player.lastConnectionUpdate || Date.now(),
                    sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
                };
                
                // Clean up old fields (mark for deletion)
                ['name', 'joinedAt', 'isHost', 'score', 'state', 'stateTimestamp', 'isConnected', 'lastConnectionUpdate'].forEach(field => {
                    if (player[field] !== undefined) {
                        migrations[`players/${playerId}/${field}`] = null;
                    }
                });
            }
        });
        
        if (Object.keys(migrations).length > 0) {
            console.log(`🔄 Migrating player structure for ${Object.keys(migrations).length} fields`);
            return database.ref(`rooms/${roomId}`).update(migrations);
        }
    });
}

/**
 * Add activity tracking to room for cloud function cleanup optimization
 * @param {string} roomId - Room ID
 */
function addActivityTracking(roomId) {
    if (!database || !roomId) return;
    
    // Update activity timestamp when players take actions
    const updateActivity = () => {
        database.ref(`rooms/${roomId}/metadata/lastActivity`).set(Date.now());
    };
    
    // Monitor key activity indicators
    const activityPaths = [
        'players',
        'gameState',
        'diceResults'
    ];
    
    const listeners = [];
    
    activityPaths.forEach(path => {
        const ref = database.ref(`rooms/${roomId}/${path}`);
        const listener = ref.on('value', updateActivity);
        listeners.push({ ref, listener, path });
    });
    
    return listeners;
}

/**
 * Check if room needs optimization
 * @param {string} roomId - Room ID to check
 */
function checkOptimizationNeeded(roomId) {
    if (!database || !roomId) return Promise.resolve(false);
    
    return database.ref(`rooms/${roomId}`).once('value').then(snapshot => {
        const roomData = snapshot.val();
        if (!roomData) return false;
        
        // Check if room is using old structure
        const needsOptimization = 
            !roomData.metadata || 
            !roomData.metadata.version ||
            (roomData.players && Object.values(roomData.players).some(p => !p.profile));
        
        return needsOptimization;
    });
}

// Export migration functions
window.optimizeRoomStructure = optimizeRoomStructure;
window.migratePlayerStructure = migratePlayerStructure;
window.addActivityTracking = addActivityTracking;
window.checkOptimizationNeeded = checkOptimizationNeeded;
