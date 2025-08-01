// Welcome Modal Management
// Handles the initial welcome modal for new players joining the game

class WelcomeModal {
    constructor() {
        this.modal = null;
        this.isModalDismissed = false;
        this.currentScreen = 'choice'; // 'choice', 'host', 'join'
        
        // Screen elements
        this.choiceScreen = null;
        this.hostForm = null;
        this.joinForm = null;
        
        // Choice buttons
        this.hostGameBtn = null;
        this.joinGameBtn = null;
        
        // Host form elements
        this.hostRoomNameInput = null;
        this.hostPlayerNameInput = null;
        this.hostButton = null;
        this.hostBackBtn = null;
        this.hostNameError = null;
        
        // Join form elements
        this.joinRoomNameInput = null;
        this.joinPlayerNameInput = null;
        this.joinButton = null;
        this.joinBackBtn = null;
        this.joinNameError = null;
        
        this.initialize();
    }
    
    initialize() {
        // Get modal elements
        this.modal = new bootstrap.Modal(document.getElementById('welcomeModal'), {
            backdrop: 'static',
            keyboard: false
        });
        
        // Get screen elements
        this.choiceScreen = document.getElementById('welcome-choice-screen');
        this.hostForm = document.getElementById('welcome-host-form');
        this.joinForm = document.getElementById('welcome-join-form');
        
        // Get choice buttons
        this.hostGameBtn = document.getElementById('host-game-btn');
        this.joinGameBtn = document.getElementById('join-game-btn');
        
        // Get host form elements
        this.hostRoomNameInput = document.getElementById('welcome-room-name');
        this.hostPlayerNameInput = document.getElementById('welcome-player-name');
        this.hostButton = document.getElementById('welcome-host-room');
        this.hostBackBtn = document.getElementById('welcome-back-btn');
        this.hostNameError = document.getElementById('welcome-name-error');
        
        // Get join form elements
        this.joinRoomNameInput = document.getElementById('welcome-join-room-name');
        this.joinPlayerNameInput = document.getElementById('welcome-join-player-name');
        this.joinButton = document.getElementById('welcome-join-room');
        this.joinBackBtn = document.getElementById('welcome-join-back-btn');
        this.joinNameError = document.getElementById('welcome-join-name-error');
        this.refreshRoomsBtn = document.getElementById('refresh-rooms-btn');
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Show modal on page load unless user has already joined a room
        this.showModalIfNeeded();
    }
    
    setupEventListeners() {
        // Choice button listeners
        if (this.hostGameBtn) {
            this.hostGameBtn.addEventListener('click', () => this.showHostForm());
        }
        
        if (this.joinGameBtn) {
            this.joinGameBtn.addEventListener('click', () => this.showJoinForm());
        }
        
        // Back button listeners
        if (this.hostBackBtn) {
            this.hostBackBtn.addEventListener('click', () => this.showChoiceScreen());
        }
        
        if (this.joinBackBtn) {
            this.joinBackBtn.addEventListener('click', () => this.showChoiceScreen());
        }
        
        // Host form validation
        [this.hostRoomNameInput, this.hostPlayerNameInput].forEach(input => {
            if (input) {
                input.addEventListener('input', () => this.validateHostInputs());
                input.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        this.handleHostRoom();
                    }
                });
            }
        });
        
        // Join form validation
        [this.joinRoomNameInput, this.joinPlayerNameInput].forEach(input => {
            if (input) {
                input.addEventListener('input', () => this.validateJoinInputs());
                input.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        this.handleJoinRoom();
                    }
                });
            }
        });
        
        // Submit button listeners
        if (this.hostButton) {
            this.hostButton.addEventListener('click', () => this.handleHostRoom());
        }
        
        if (this.joinButton) {
            this.joinButton.addEventListener('click', () => this.handleJoinRoom());
        }
        
        // Refresh rooms button listener
        if (this.refreshRoomsBtn) {
            this.refreshRoomsBtn.addEventListener('click', () => this.loadAvailableRooms());
        }
        
        // Load saved values
        this.loadSavedValues();
    }
    
    showChoiceScreen() {
        this.currentScreen = 'choice';
        this.choiceScreen.style.display = 'block';
        this.hostForm.style.display = 'none';
        this.joinForm.style.display = 'none';
    }
    
    showHostForm() {
        this.currentScreen = 'host';
        this.choiceScreen.style.display = 'none';
        this.hostForm.style.display = 'block';
        this.joinForm.style.display = 'none';
        
        // Focus on first input
        if (this.hostRoomNameInput) {
            setTimeout(() => this.hostRoomNameInput.focus(), 100);
        }
        
        this.validateHostInputs();
    }
    
    showJoinForm() {
        this.currentScreen = 'join';
        this.choiceScreen.style.display = 'none';
        this.hostForm.style.display = 'none';
        this.joinForm.style.display = 'block';
        
        // Load available rooms
        this.loadAvailableRooms();
        
        // Focus on player name input since room dropdown will be populated
        if (this.joinPlayerNameInput) {
            setTimeout(() => this.joinPlayerNameInput.focus(), 100);
        }
        
        this.validateJoinInputs();
    }
    
    loadSavedValues() {
        // Load saved room and player names from localStorage
        const savedRoomName = localStorage.getItem('roomName');
        const savedPlayerName = localStorage.getItem('playerName');
        
        // Set values for host form only (join form uses dropdown)
        if (savedRoomName) {
            if (this.hostRoomNameInput) this.hostRoomNameInput.value = savedRoomName;
        }
        
        if (savedPlayerName) {
            if (this.hostPlayerNameInput) this.hostPlayerNameInput.value = savedPlayerName;
            if (this.joinPlayerNameInput) this.joinPlayerNameInput.value = savedPlayerName;
        }
        
        // Also check URL parameters for host form
        const urlParams = new URLSearchParams(window.location.search);
        const roomFromURL = urlParams.get('room');
        
        if (roomFromURL) {
            const decodedRoom = decodeURIComponent(roomFromURL);
            if (this.hostRoomNameInput) this.hostRoomNameInput.value = decodedRoom;
            // Note: For join form, we'll try to select this room in the dropdown when it's loaded
        }
        
        // Validate inputs after loading values
        this.validateHostInputs();
        this.validateJoinInputs();
    }
    
    validateHostInputs() {
        const roomName = this.hostRoomNameInput?.value.trim() || '';
        const playerName = this.hostPlayerNameInput?.value.trim() || '';
        
        const isValid = !!(roomName && playerName);
        
        if (this.hostButton) {
            this.hostButton.disabled = !isValid;
        }
        
        // Clear error message when user types
        if (this.hostNameError) {
            this.hostNameError.style.display = 'none';
        }
        
        return isValid;
    }
    
    validateJoinInputs() {
        const roomName = this.joinRoomNameInput?.value.trim() || '';
        const playerName = this.joinPlayerNameInput?.value.trim() || '';
        
        const isValid = !!(roomName && playerName);
        
        if (this.joinButton) {
            this.joinButton.disabled = !isValid;
        }
        
        // Clear error message when user types
        if (this.joinNameError) {
            this.joinNameError.style.display = 'none';
        }
        
        return isValid;
    }
    
    async loadAvailableRooms() {
        if (!this.joinRoomNameInput) return;
        
        // Wait a moment for Firebase to be ready if needed
        if (typeof database === 'undefined') {
            setTimeout(() => this.loadAvailableRooms(), 500);
            return;
        }
        
        try {
            // Set loading state
            this.joinRoomNameInput.disabled = true;
            this.joinRoomNameInput.innerHTML = '<option value="">Loading available rooms...</option>';
            
            const helpText = document.getElementById('join-room-help-text');
            if (helpText) helpText.textContent = 'Loading available rooms...';
            
            // Disable refresh button temporarily
            if (this.refreshRoomsBtn) this.refreshRoomsBtn.disabled = true;
            
            // Get all rooms from Firebase
            const roomsRef = database.ref('rooms');
            const snapshot = await roomsRef.once('value');
            const rooms = snapshot.val();
            
            // Clear dropdown
            this.joinRoomNameInput.innerHTML = '';
            
            if (!rooms || Object.keys(rooms).length === 0) {
                // No rooms available
                this.joinRoomNameInput.innerHTML = '<option value="">No games available</option>';
                this.joinRoomNameInput.disabled = true;
                if (helpText) helpText.textContent = 'No active games found. Ask someone to host a game first!';
                if (helpText) helpText.className = 'form-text text-warning';
            } else {
                // Add default option
                this.joinRoomNameInput.innerHTML = '<option value="">Select a room to join</option>';
                
                // Get saved room name or URL parameter for pre-selection
                const savedRoomName = localStorage.getItem('roomName');
                const urlParams = new URLSearchParams(window.location.search);
                const roomFromURL = urlParams.get('room');
                const preferredRoom = roomFromURL ? decodeURIComponent(roomFromURL) : savedRoomName;
                
                // Add available rooms
                const roomEntries = Object.entries(rooms);
                let activeRoomsCount = 0;
                let foundPreferredRoom = false;
                
                for (const [roomId, roomData] of roomEntries) {
                    const players = roomData.players || {};
                    const activePlayers = Object.values(players).filter(player => player.isConnected !== false);
                    
                    // Only show rooms with active players
                    if (activePlayers.length > 0) {
                        activeRoomsCount++;
                        // Use the display name if available, otherwise use the room ID
                        const displayName = roomData.displayName || roomId;
                        const playerCount = activePlayers.length;
                        const option = document.createElement('option');
                        option.value = displayName; // Use display name as value
                        option.textContent = `${displayName} (${playerCount} player${playerCount === 1 ? '' : 's'})`;
                        
                        // Check if this is the preferred room
                        if (preferredRoom && (displayName.toLowerCase() === preferredRoom.toLowerCase() || roomId.toLowerCase() === preferredRoom.toLowerCase())) {
                            option.selected = true;
                            foundPreferredRoom = true;
                        }
                        
                        this.joinRoomNameInput.appendChild(option);
                    }
                }
                
                if (activeRoomsCount === 0) {
                    // No active rooms
                    this.joinRoomNameInput.innerHTML = '<option value="">No active games available</option>';
                    this.joinRoomNameInput.disabled = true;
                    if (helpText) helpText.textContent = 'No active games found. Ask someone to host a game first!';
                    if (helpText) helpText.className = 'form-text text-warning';
                } else {
                    // Enable dropdown
                    this.joinRoomNameInput.disabled = false;
                    if (helpText) helpText.textContent = 'Select a room to join';
                    if (helpText) helpText.className = 'form-text';
                    
                    if (foundPreferredRoom && helpText) {
                        helpText.textContent = 'Found your previous room! Select a different one or join this room.';
                    }
                }
            }
            
            // Re-enable refresh button
            if (this.refreshRoomsBtn) this.refreshRoomsBtn.disabled = false;
            
            // Re-validate after loading rooms
            this.validateJoinInputs();
            
        } catch (error) {
            console.error('Error loading available rooms:', error);
            this.joinRoomNameInput.innerHTML = '<option value="">Error loading rooms</option>';
            this.joinRoomNameInput.disabled = true;
            
            // Re-enable refresh button
            if (this.refreshRoomsBtn) this.refreshRoomsBtn.disabled = false;
            
            const helpText = document.getElementById('join-room-help-text');
            if (helpText) {
                helpText.textContent = 'Error loading rooms. Please try refreshing.';
                helpText.className = 'form-text text-danger';
            }
        }
    }

    // For compatibility with existing code
    validateInputs() {
        if (this.currentScreen === 'host') {
            return this.validateHostInputs();
        } else if (this.currentScreen === 'join') {
            return this.validateJoinInputs();
        }
        return false;
    }
    
    showError(message, isJoinForm = false) {
        const errorElement = isJoinForm ? this.joinNameError : this.hostNameError;
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
        }
    }
    
    clearError(isJoinForm = false) {
        const errorElement = isJoinForm ? this.joinNameError : this.hostNameError;
        if (errorElement) {
            errorElement.style.display = 'none';
        }
    }
    
    async handleHostRoom() {
        if (!this.validateHostInputs()) {
            this.showError('Please fill in both room name and your name.');
            return;
        }
        
        const roomName = this.hostRoomNameInput.value.trim();
        const playerName = this.hostPlayerNameInput.value.trim();
        
        await this.processRoomJoin(roomName, playerName, this.hostButton, false);
    }
    
    async handleJoinRoom() {
        if (!this.validateJoinInputs()) {
            this.showError('Please fill in both room name and your name.', true);
            return;
        }
        
        const roomName = this.joinRoomNameInput.value.trim();
        const playerName = this.joinPlayerNameInput.value.trim();
        
        await this.processRoomJoin(roomName, playerName, this.joinButton, true);
    }
    
    async processRoomJoin(roomName, playerName, button, isJoinForm) {
        // Basic validation
        if (roomName.length > 30) {
            this.showError('Room name must be 30 characters or less.', isJoinForm);
            return;
        }
        
        if (playerName.length > 20) {
            this.showError('Player name must be 20 characters or less.', isJoinForm);
            return;
        }
        
        // Check for invalid characters
        const invalidChars = /[<>"/\\&]/;
        if (invalidChars.test(roomName)) {
            this.showError('Room name contains invalid characters.', isJoinForm);
            return;
        }
        
        if (invalidChars.test(playerName)) {
            this.showError('Player name contains invalid characters.', isJoinForm);
            return;
        }
        
        this.clearError(isJoinForm);
        
        try {
            // Update the original input fields for compatibility with existing code
            const originalRoomInput = document.getElementById('room-name');
            const originalPlayerInput = document.getElementById('player-name');
            
            if (originalRoomInput) originalRoomInput.value = roomName;
            if (originalPlayerInput) originalPlayerInput.value = playerName;
            
            // Trigger the existing join room functionality
            if (typeof handleRoomJoinClick === 'function') {
                // Disable the button to prevent multiple clicks
                button.disabled = true;
                const originalText = button.innerHTML;
                button.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Joining...';
                
                // Call the existing join room handler
                try {
                    const result = handleRoomJoinClick();
                    
                    // If it returns a promise, wait for it
                    if (result && typeof result.then === 'function') {
                        await result;
                    }
                    
                    // Note: We don't dismiss here anymore - we wait for the roomJoined event
                    // which will be dispatched by the firebase-room-manager
                    
                } catch (error) {
                    console.error('Error in handleRoomJoinClick:', error);
                    this.showError('Failed to join room. Please try again.', isJoinForm);
                    
                    // Re-enable the button
                    button.disabled = false;
                    button.innerHTML = originalText;
                }
                
            } else {
                this.showError('Game initialization error. Please refresh the page.', isJoinForm);
            }
        } catch (error) {
            console.error('Error joining room:', error);
            this.showError('Failed to join room. Please try again.', isJoinForm);
            
            // Re-enable the button
            button.disabled = false;
            if (isJoinForm) {
                button.innerHTML = '🎯 Join Game';
            } else {
                button.innerHTML = '🏠 Create & Host Game';
            }
        }
    }
    
    showModalIfNeeded() {
        // Always show the modal on page load unless explicitly dismissed in this session
        // Check if the modal was already dismissed in this session
        const wasModalDismissed = sessionStorage.getItem('welcomeModalDismissed');
        
        // Also check if user is clearly already in a room
        const playerListElement = document.querySelector('#player-list ul');
        const hasPlayersInList = playerListElement && playerListElement.children.length > 0;
        
        if (!wasModalDismissed && !hasPlayersInList) {
            // Show the modal after a slight delay to ensure DOM is ready
            setTimeout(() => {
                this.showChoiceScreen();
                this.modal.show();
            }, 100);
        }
    }
    
    dismissModal() {
        if (this.modal && !this.isModalDismissed) {
            this.isModalDismissed = true;
            this.modal.hide();
            
            // Mark modal as dismissed for this session
            sessionStorage.setItem('welcomeModalDismissed', 'true');
        }
    }
    
    // Method to force show modal (for debugging or if user wants to switch rooms)
    forceShow() {
        this.isModalDismissed = false;
        this.showChoiceScreen();
        this.modal.show();
    }
    
    // Method to reset the modal (clears all inputs)
    reset() {
        // Clear all inputs
        if (this.hostRoomNameInput) this.hostRoomNameInput.value = '';
        if (this.hostPlayerNameInput) this.hostPlayerNameInput.value = '';
        if (this.joinRoomNameInput) this.joinRoomNameInput.value = '';
        if (this.joinPlayerNameInput) this.joinPlayerNameInput.value = '';
        
        // Reset buttons
        if (this.hostButton) {
            this.hostButton.disabled = true;
            this.hostButton.innerHTML = '🏠 Create & Host Game';
        }
        if (this.joinButton) {
            this.joinButton.disabled = true;
            this.joinButton.innerHTML = '🎯 Join Game';
        }
        
        // Clear errors
        this.clearError(false);
        this.clearError(true);
        
        // Reset state
        this.isModalDismissed = false;
        this.showChoiceScreen();
        
        // Clear session storage so modal can show again
        sessionStorage.removeItem('welcomeModalDismissed');
    }
    
    // Method to enable modal to show again (for when user leaves room)
    enableModalForNewSession() {
        this.isModalDismissed = false;
        sessionStorage.removeItem('welcomeModalDismissed');
    }
}

// Initialize welcome modal when page loads
let welcomeModal;

document.addEventListener('DOMContentLoaded', () => {
    // Wait for all scripts to load and Firebase to be available
    const initializeWelcomeModal = () => {
        if (typeof bootstrap !== 'undefined' && typeof handleRoomJoinClick === 'function') {
            welcomeModal = new WelcomeModal();
        } else {
            // Retry after a short delay
            setTimeout(initializeWelcomeModal, 100);
        }
    };
    
    initializeWelcomeModal();
});

// Fallback for window load event
window.addEventListener('load', () => {
    if (!welcomeModal && typeof bootstrap !== 'undefined') {
        welcomeModal = new WelcomeModal();
    }
});

// Export for global access
window.WelcomeModal = WelcomeModal;
window.welcomeModal = null; // Will be set when initialized

// Global function to show welcome modal (useful for debugging or switching rooms)
window.showWelcomeModal = function() {
    if (welcomeModal) {
        welcomeModal.enableModalForNewSession();
        welcomeModal.forceShow();
    } else {
        console.warn('Welcome modal not initialized yet');
    }
};

// Make welcome modal accessible globally
Object.defineProperty(window, 'welcomeModal', {
    get: function() {
        return welcomeModal;
    },
    configurable: true
});

// Listen for successful room joins to dismiss the modal
document.addEventListener('roomJoined', () => {
    if (welcomeModal) {
        welcomeModal.dismissModal();
    }
});

// Listen for room join errors to show error message
document.addEventListener('roomJoinError', (event) => {
    if (welcomeModal) {
        const errorMessage = event.detail?.error || 'Failed to join room. Please try again.';
        const isJoinForm = welcomeModal.currentScreen === 'join';
        welcomeModal.showError(errorMessage, isJoinForm);
        
        // Re-enable the appropriate button
        const button = isJoinForm ? welcomeModal.joinButton : welcomeModal.hostButton;
        const originalText = isJoinForm ? '🎯 Join Game' : '🏠 Create & Host Game';
        
        if (button) {
            button.disabled = false;
            button.innerHTML = originalText;
        }
    }
});

// Listen for room left events to show welcome modal again
document.addEventListener('roomLeft', () => {
    if (welcomeModal) {
        welcomeModal.enableModalForNewSession();
        // Small delay to ensure cleanup is complete
        setTimeout(() => {
            welcomeModal.forceShow();
        }, 500);
    }
});

// Also listen for player list updates as an indicator of successful join
const originalUpdatePlayerListUI = window.updatePlayerListUI;
if (typeof originalUpdatePlayerListUI === 'function') {
    window.updatePlayerListUI = function(...args) {
        const result = originalUpdatePlayerListUI.apply(this, args);
        
        // If player list is being updated and we have players, dismiss the modal
        if (welcomeModal && args[0] && Object.keys(args[0]).length > 0) {
            welcomeModal.dismissModal();
        }
        
        return result;
    };
}
