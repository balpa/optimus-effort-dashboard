// Local development server
const app = require('./dashboard-app');
const config = require('./config');
const { updateCurrentMonth } = require('./services/data-updater');

const startServer = async () => {
  try {
    await updateCurrentMonth('dev', false);
    await updateCurrentMonth('qa', false);
    await updateCurrentMonth('qa-board', false);
  } catch (error) {
    console.error('Error updating current month:', error.message);
  }

  app.listen(config.dashboard.port, () => {
    console.log(`Dashboard running at http://localhost:${config.dashboard.port}`);
    console.log(`Default mode: DEV (Story Points)`);
    console.log(`Switch to QA mode: http://localhost:${config.dashboard.port}/?mode=qa`);
    console.log(`Switch to QA Board mode: http://localhost:${config.dashboard.port}/?mode=qa-board`);
  });
};

startServer();
