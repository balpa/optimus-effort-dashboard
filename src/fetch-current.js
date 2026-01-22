const config = require('./config');
const { updateCurrentMonth } = require('./services/data-updater');

updateCurrentMonth().catch(console.error);
