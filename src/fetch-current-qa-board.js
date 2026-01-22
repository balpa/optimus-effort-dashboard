const { updateCurrentMonth } = require('./services/data-updater');

updateCurrentMonth('qa-board').catch(console.error);
