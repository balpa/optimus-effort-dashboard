const path = require('path');

// Vercel serverless function - just re-export the Express app
const dashboard = require('../src/dashboard-app');

module.exports = dashboard;
