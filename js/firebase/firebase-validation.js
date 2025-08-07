// Firebase Data Validation and Integrity
// Ensures data consistency and prevents corruption

/**
 * Validate player data structure
 * @param {Object} playerData - Player data to validate
 */
function validatePlayerData(playerData) {
    const required = ['name', 'score', 'isConnected'];
    const errors = [];
    
    required.forEach(field => {
        if (!(field in playerData)) {
            errors.push(`Missing required field: ${field}`);
        }
    });
    
    if (typeof playerData.score !== 'number' || playerData.score < 0) {
        errors.push('Score must be a non-negative number');
    }
    
    if (typeof playerData.isConnected !== 'boolean') {
        errors.push('isConnected must be a boolean');
    }
    
    if (playerData.name && (typeof playerData.name !== 'string' || playerData.name.length > 50)) {
        errors.push('Name must be a string under 50 characters');
    }
    
    return {
        isValid: errors.length === 0,
        errors
    };
}

/**
 * Validate game state structure
 * @param {Object} gameState - Game state to validate
 */
function validateGameState(gameState) {
    const errors = [];
    
    if (!gameState.currentTurn || typeof gameState.currentTurn !== 'string') {
        errors.push('currentTurn must be a valid player ID');
    }
    
    if (!gameState.turnStartTime || typeof gameState.turnStartTime !== 'number') {
        errors.push('turnStartTime must be a valid timestamp');
    }
    
    const validPhases = ['waiting_for_players', 'active', 'ended'];
    if (gameState.gamePhase && !validPhases.includes(gameState.gamePhase)) {
        errors.push(`gamePhase must be one of: ${validPhases.join(', ')}`);
    }
    
    return {
        isValid: errors.length === 0,
        errors
    };
}

/**
 * Sanitize user input data
 * @param {Object} data - Data to sanitize
 */
function sanitizeData(data) {
    const sanitized = {};
    
    Object.keys(data).forEach(key => {
        let value = data[key];
        
        if (typeof value === 'string') {
            // Remove potentially dangerous characters
            value = value.replace(/[<>\"']/g, '');
            // Limit string length
            value = value.substring(0, 100);
        }
        
        if (typeof value === 'number') {
            // Ensure reasonable number ranges
            value = Math.max(-999999, Math.min(999999, value));
        }
        
        sanitized[key] = value;
    });
    
    return sanitized;
}

/**
 * Check for data corruption and repair if possible
 * @param {string} roomId - Room ID to check
 */
function checkDataIntegrity(roomId) {
    if (!database || !roomId) return Promise.resolve({ isValid: true });
    
    return database.ref(`rooms/${roomId}`).once('value').then(snapshot => {
        const roomData = snapshot.val();
        if (!roomData) return { isValid: false, error: 'Room not found' };
        
        const issues = [];
        
        // Check players data
        if (roomData.players) {
            Object.keys(roomData.players).forEach(playerId => {
                const validation = validatePlayerData(roomData.players[playerId]);
                if (!validation.isValid) {
                    issues.push(`Player ${playerId}: ${validation.errors.join(', ')}`);
                }
            });
        }
        
        // Check game state
        if (roomData.gameState) {
            const validation = validateGameState(roomData.gameState);
            if (!validation.isValid) {
                issues.push(`Game state: ${validation.errors.join(', ')}`);
            }
        }
        
        // Check for orphaned data
        const expectedNodes = ['players', 'gameState', 'hostId', 'settings'];
        Object.keys(roomData).forEach(node => {
            if (!expectedNodes.includes(node) && !node.startsWith('events')) {
                issues.push(`Unexpected data node: ${node}`);
            }
        });
        
        return {
            isValid: issues.length === 0,
            issues,
            roomData
        };
    });
}

/**
 * Repair corrupted room data
 * @param {string} roomId - Room ID to repair
 */
function repairRoomData(roomId) {
    return checkDataIntegrity(roomId).then(result => {
        if (result.isValid) return { repaired: false, message: 'No repairs needed' };
        
        const repairs = {};
        
        // Fix missing game state
        if (!result.roomData.gameState) {
            repairs['gameState'] = {
                currentTurn: null,
                turnStartTime: Date.now(),
                gamePhase: 'waiting_for_players',
                createdAt: Date.now()
            };
        }
        
        // Fix player data
        if (result.roomData.players) {
            Object.keys(result.roomData.players).forEach(playerId => {
                const player = result.roomData.players[playerId];
                if (typeof player.score !== 'number') {
                    repairs[`players/${playerId}/score`] = 0;
                }
                if (typeof player.isConnected !== 'boolean') {
                    repairs[`players/${playerId}/isConnected`] = false;
                }
            });
        }
        
        if (Object.keys(repairs).length > 0) {
            return database.ref(`rooms/${roomId}`).update(repairs).then(() => ({
                repaired: true,
                repairs: Object.keys(repairs),
                message: `Repaired ${Object.keys(repairs).length} issues`
            }));
        }
        
        return { repaired: false, message: 'No automatic repairs available' };
    });
}

// Export validation functions
window.validatePlayerData = validatePlayerData;
window.validateGameState = validateGameState;
window.sanitizeData = sanitizeData;
window.checkDataIntegrity = checkDataIntegrity;
window.repairRoomData = repairRoomData;
