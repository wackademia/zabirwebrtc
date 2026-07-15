// js/turn-config.js
//
// This file is no longer read directly — when the app is running via
// `npm start`, server.js intercepts requests to this exact path and
// generates it dynamically from the METERED_APP_NAME / METERED_API_KEY
// environment variables instead (see server.js's serveTurnConfig()).
//
// This keeps the real secret key out of git entirely. To configure it:
//   - Locally:   put the two variables in a .env file (see .env.example)
//   - On Render: set them under the service's "Environment" tab
//
// This static copy is kept only so the file exists on disk for reference;
// its contents are never actually served while server.js is running.
