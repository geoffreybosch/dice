# Round Counter Implementation

## Overview

This document describes the implementation of a game round counter for the Farkle multiplayer game. The round counter tracks and displays which round the game is currently in, incrementing each time all players complete their turns and the first player starts again.

## Features Implemented

- **Visual Round Counter**: Displays "🎯 Round: X" in the player list sidebar
- **Automatic Increment**: Rounds increment when the turn cycles back to the first player
- **Multi-player Support**: Only shows for games with 2+ players
- **Game Reset Integration**: Round counter resets to 1 when starting new games
- **Responsive Design**: Matches existing UI styling patterns

## Files Modified

### 1. HTML Structure (`index.html`)

**Location**: Lines 46-48
**Changes**: Added round counter HTML element to the player list area

```html
<div id="round-counter-display" class="round-counter mb-2" style="display: none;">
    <span class="round-label">🎯 Round:</span> <span id="round-number" class="round-number">1</span>
</div>
```

**Placement**: Added between the room name display and the player list, maintaining consistent layout flow.

### 2. CSS Styling (`css/styles.css`)

**Location**: Lines 990-1024
**Changes**: Extended existing room styling patterns to include round counter

```css
#room-name-display, #round-counter-display, #player-list-title, #player-list-title-mobile {
    color: #ffffff !important;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.room-subtitle, .round-counter {
    background: rgba(255, 255, 255, 0.1);
    padding: 0.5rem 0.75rem;
    border-radius: 6px;
    backdrop-filter: blur(10px);
    border-left: 3px solid #007bff;
    transition: all 0.3s ease;
}

.room-label, .round-label {
    font-size: 0.75rem;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.8);
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.room-name, .round-number {
    font-size: 0.9rem;
    font-weight: 600;
    color: #ffffff;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}
```

**Design Approach**: Used existing room display styling as a template to ensure visual consistency.

### 3. Turn System Logic (`js/turn-system-integration.js`)

#### A. Core Variables (Line 9)
**Changes**: Added round tracking variable

```javascript
let currentRound = 1; // Track the current game round
```

#### B. Reset Function (Lines 1084-1088)
**Changes**: Modified `resetGameState()` to reset round counter

```javascript
function resetGameState() {
    gameState = 'playing';
    winTriggerPlayer = null;
    finalRoundTracker = {};
    currentRound = 1; // Reset round counter to 1
    updateRoundDisplay(); // Update the display
}
```

#### C. Display Functions (Lines 1267-1289)
**Changes**: Added round counter display and management functions

```javascript
// Round Counter Functions
function updateRoundDisplay() {
    const roundDisplay = document.getElementById('round-counter-display');
    const roundNumber = document.getElementById('round-number');
    
    if (roundDisplay && roundNumber) {
        roundNumber.textContent = currentRound;
        
        // Show the round counter when there are multiple players
        if (turnSystemPlayerList.length > 1) {
            roundDisplay.style.display = 'block';
        } else {
            roundDisplay.style.display = 'none';
        }
    }
}

function incrementRound() {
    console.log('🎯 incrementRound() called! Current round:', currentRound);
    currentRound++;
    console.log(`🎯 Round advanced to: ${currentRound}`);
    updateRoundDisplay();
}
```

#### D. Initialization (Line 62)
**Changes**: Added round display update to `initializeTurnSystem()`

```javascript
updateRoundDisplay(); // Show round counter when game starts
```

#### E. Exports (Lines 1591-1593, 1618-1619)
**Changes**: Added round functions to module exports and browser globals

```javascript
// In module.exports
updateRoundDisplay,
incrementRound,

// In browser globals
window.updateRoundDisplay = updateRoundDisplay;
window.incrementRound = incrementRound;
```

### 4. Firebase State Manager (`js/firebase-state-manager.js`)

#### A. Main Turn Advancement Logic (Lines 738-773)
**Changes**: Added round detection logic to the primary turn advancement mechanism

```javascript
// Check for round completion before advancing turn
if (currentGameTurn && typeof incrementRound === 'function') {
    // Get the list of connected player IDs to check for round completion
    const connectedPlayerIds = Object.keys(players).filter(playerId => {
        const player = players[playerId];
        return player.isConnected !== false;
    }).sort((a, b) => {
        const playerA = players[a];
        const playerB = players[b];
        
        // Use joinedAt timestamp if both players have it
        if (playerA.joinedAt && playerB.joinedAt) {
            return playerA.joinedAt - playerB.joinedAt;
        }
        
        // If only one has joinedAt, prioritize the one with timestamp
        if (playerA.joinedAt && !playerB.joinedAt) return -1;
        if (!playerA.joinedAt && playerB.joinedAt) return 1;
        
        // Fallback to alphabetical if neither has joinedAt
        return a.localeCompare(b);
    });
    
    if (connectedPlayerIds.length > 1) {
        const currentIndex = connectedPlayerIds.indexOf(currentGameTurn);
        const nextIndex = connectedPlayerIds.indexOf(currentTurnPlayer);
        
        console.log('🎯 Turn advancement check: currentIndex=', currentIndex, 'nextIndex=', nextIndex, 'playerCount=', connectedPlayerIds.length);
        console.log('🎯 Players order:', connectedPlayerIds);
        
        // Check if we've wrapped around to the first player (completed a round)
        if (currentIndex !== -1 && nextIndex === 0 && currentIndex === connectedPlayerIds.length - 1) {
            console.log('🎯 Round completed! Incrementing round counter.');
            incrementRound();
        } else {
            console.log('🎯 Round not completed yet.');
        }
    }
}
```

**Key Logic**: Detects when the turn advances from the last player in the rotation back to the first player, indicating a completed round.

#### B. Debug Logging (Lines 584, 630-632)
**Changes**: Added debugging console logs to track round detection

```javascript
console.log('🔄 All connected players have ended their turns - starting new round');
console.log('🎮 Starting new round - next player in rotation:', firstPlayer);
console.log('🎯 Round check: window.firebaseCurrentTurnPlayer=', window.firebaseCurrentTurnPlayer);
console.log('🎯 Round check: connectedPlayerIds=', connectedPlayerIds);
```

## Technical Implementation Details

### Round Detection Algorithm

The round counter uses a sophisticated detection algorithm that:

1. **Tracks Player Order**: Maintains a consistent player order based on join timestamps
2. **Detects Wraparound**: Identifies when the turn advances from the last player (highest index) to the first player (index 0)
3. **Handles Edge Cases**: Only increments for games with multiple players and valid turn transitions

### Integration Points

The implementation integrates with multiple game systems:

- **Turn System**: Monitors turn advancement to detect round completion
- **Firebase State**: Hooks into the multiplayer turn management system
- **UI System**: Updates display elements reactively
- **Game Reset**: Automatically resets when games restart

### Display Logic

The round counter display has intelligent visibility rules:

- **Hidden**: Single-player games or when no players are present
- **Visible**: Multi-player games with 2+ connected players
- **Styled**: Matches existing UI patterns for consistency

## Testing and Validation

### Manual Testing Performed

1. **Basic Functionality**: Verified round increments when cycling through all players
2. **Multi-player Support**: Tested with 2+ players in different join orders
3. **Game Reset**: Confirmed round resets to 1 when starting new games
4. **UI Integration**: Verified styling matches existing design patterns
5. **Edge Cases**: Tested with player disconnections and reconnections

### Debug Output

The implementation includes comprehensive debug logging:

```
🎯 Turn advancement check: currentIndex= 1 nextIndex= 0 playerCount= 2
🎯 Players order: ['b', 'g']
🎯 Round completed! Incrementing round counter.
🎯 incrementRound() called! Current round: 1
🎯 Round advanced to: 2
```

## Future Enhancements

Potential improvements for the round counter system:

1. **Round History**: Track statistics like longest/shortest rounds
2. **Round-based Scoring**: Implement bonus points for quick rounds
3. **Round Notifications**: Add visual/audio cues for new rounds
4. **Persistence**: Save round data to Firebase for cross-session tracking
5. **Admin Controls**: Add manual round adjustment capabilities

## Code Quality Notes

The implementation follows established patterns in the codebase:

- **Consistent Naming**: Uses existing convention (camelCase, descriptive names)
- **Error Handling**: Includes null checks and graceful degradation
- **Modularity**: Functions are focused and reusable
- **Documentation**: Includes clear comments and debug output
- **Performance**: Minimal computational overhead

This round counter enhancement provides valuable game state information to players while maintaining the existing codebase's architecture and design principles.
