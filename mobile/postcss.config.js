// No CSS in the mobile app. Shadows the web app's root postcss.config.js
// so vitest/vite never tries to load tailwindcss here.
module.exports = { plugins: [] };
