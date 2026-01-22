const config = require('./config');
const { updateCurrentMonth } = require('./services/data-updater');

updateCurrentMonth('qa').catch(console.error);
