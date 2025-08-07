// Firebase Database Cleanup Utilities
// Handles automatic cleanup of temporary event data

/**
 * Clean up old events from the database
 * @param {string} roomId - The room ID to clean up
 * @param {number} maxAge - Maximum age in milliseconds (default: 1 hour)
 */
function cleanupOldEvents(roomId, maxAge = 3600000) {
    if (!database || !roomId) return;
    
    const cutoffTime = Date.now() - maxAge;
    const roomRef = database.ref(`rooms/${roomId}`);
    
    // List of event types to clean up
    const eventTypes = [
        'diceResults',
        'diceSelections', 
        'rollingStart',
        'farkleAlerts',
        'hotDiceEvents',
        'materialChanges'
    ];
    
    eventTypes.forEach(eventType => {
        const eventRef = roomRef.child(eventType);
        eventRef.once('value', (snapshot) => {
            const events = snapshot.val();
            if (!events) return;
            
            const updates = {};
            Object.keys(events).forEach(eventId => {
                const event = events[eventId];
                if (event.timestamp && event.timestamp < cutoffTime) {
                    updates[`${eventType}/${eventId}`] = null; // Delete old event
                }
            });
            
            if (Object.keys(updates).length > 0) {
                roomRef.update(updates);
                console.log(`🧹 Cleaned up ${Object.keys(updates).length} old ${eventType} events`);
            }
        });
    });
}

/**
 * Set up automatic cleanup for a room
 * @param {string} roomId - The room ID to monitor
 */
function setupAutomaticCleanup(roomId) {
    // Clean up every 5 minutes with a lighter approach
    const cleanupInterval = setInterval(() => {
        performMaintenanceCleanup(roomId);
    }, 300000); // 5 minutes
    
    // Store interval ID for cleanup
    window.cleanupInterval = cleanupInterval;
    
    console.log(`🧹 Automatic event cleanup enabled for room: ${roomId}`);
}

/**
 * Clean up only the oldest events to prevent database bloat
 * Keeps a reasonable number of recent events for game functionality
 * @param {string} roomId - The room ID to check
 * @param {string} eventType - Type of events to limit
 * @param {number} maxEvents - Maximum number of events to keep (default: 50)
 */
function limitEventHistory(roomId, eventType, maxEvents = 50) {
    if (!database || !roomId) return;
    
    const eventRef = database.ref(`rooms/${roomId}/${eventType}`);
    eventRef.orderByChild('timestamp').once('value', (snapshot) => {
        const events = snapshot.val();
        if (!events) return;
        
        const eventIds = Object.keys(events);
        if (eventIds.length <= maxEvents) return;
        
        // Sort by timestamp and remove oldest events
        const sortedEvents = eventIds
            .map(id => ({ id, timestamp: events[id].timestamp || 0 }))
            .sort((a, b) => a.timestamp - b.timestamp);
        
        const eventsToDelete = sortedEvents.slice(0, eventIds.length - maxEvents);
        
        if (eventsToDelete.length > 0) {
            const updates = {};
            eventsToDelete.forEach(event => {
                updates[`${eventType}/${event.id}`] = null;
            });
            
            database.ref(`rooms/${roomId}`).update(updates);
            console.log(`🧹 Removed ${eventsToDelete.length} old ${eventType} events, keeping ${maxEvents} most recent`);
        }
    });
}

/**
 * Clean up all event types to maintain reasonable database size
 * @param {string} roomId - The room ID to clean up
 */
function performMaintenanceCleanup(roomId) {
    if (!database || !roomId) return;
    
    // Event types with their respective limits
    const eventLimits = {
        'diceResults': 20,      // Keep last 20 dice rolls
        'diceSelections': 15,   // Keep last 15 selections  
        'rollingStart': 15,     // Keep last 15 roll starts
        'farkleAlerts': 10,     // Keep last 10 farkle alerts
        'hotDiceEvents': 10,    // Keep last 10 hot dice events
        'materialChanges': 5    // Keep last 5 material changes
    };
    
    Object.entries(eventLimits).forEach(([eventType, limit]) => {
        limitEventHistory(roomId, eventType, limit);
    });
}

// Export functions
window.cleanupOldEvents = cleanupOldEvents;
window.setupAutomaticCleanup = setupAutomaticCleanup;
window.limitEventHistory = limitEventHistory;
window.performMaintenanceCleanup = performMaintenanceCleanup;
