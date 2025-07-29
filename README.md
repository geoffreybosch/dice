# Farkle Game

This is a web-based implementation of the Farkle dice game with support for up to 6 players using WebRTC for peer-to-peer connections. Firebase is used as the signaling mechanism for WebRTC.

## Firebase Setup

To use Firebase for signaling, follow these steps:

1. Go to [Firebase Console](https://console.firebase.google.com/).
2. Create a new project (or use an existing one).
3. In the project dashboard, navigate to **Build > Realtime Database** and create a database.
   - Choose "Start in test mode" for simplicity (you can configure rules later).
4. Copy the Firebase configuration object from the project settings.
5. Replace the placeholder configuration in `js/firebase-config.js` with your Firebase configuration.
6. Deploy the project to GitHub Pages or another hosting service.

## Running the Game

1. Open the `index.html` file in a browser.
2. Ensure all players are connected to the same Firebase project.
3. Start playing Farkle!

## Features

- 3D dice animations using Three.js.
- Peer-to-peer multiplayer using WebRTC.
- Firebase for signaling.

## Hosting

This project can be hosted for free using GitHub Pages. Simply push the repository to GitHub and enable Pages in the repository settings.
