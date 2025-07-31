// Firebase Database Utilities
// Common database references and utility functions

/**
 * Get reference to players in a specific room
 * @param {string} roomId - The room ID (lowercase)
 * @returns {firebase.database.Reference} Players reference
 */
function getRoomPlayersRef(roomId) {
    return database.ref(`rooms/${roomId}/players`);
}

/**
 * Test Firebase connection
 * @returns {Promise} Promise that resolves when test is complete
 */
function testFirebaseConnection() {
    const testRef = database.ref('test');
    return testRef.set({
        message: 'Firebase is working!',
        timestamp: Date.now()
    });
}

// Export functions for global access
window.getRoomPlayersRef = getRoomPlayersRef;
window.testFirebaseConnection = testFirebaseConnection;
