// Local development server
const app = require('./dashboard-app');
const config = require('./config');
const { updateCurrentMonth } = require('./services/data-updater');

const startServer = async () => {
  console.log('🔄 Updating current month data...\n');
  try {
    console.log('📊 Updating DEV mode (Story Points)...');
    await updateCurrentMonth('dev');
    console.log('\n🧪 Updating QA mode (QA Efforts)...');
    await updateCurrentMonth('qa');
  } catch (error) {
    console.error('❌ Error updating current month:', error.message);
  }

  app.listen(config.dashboard.port, () => {
    console.log(`\n🚀 Dashboard running at http://localhost:${config.dashboard.port}`);
    console.log(`📊 Default mode: DEV (Story Points)`);
    console.log(`🧪 Switch to QA mode: http://localhost:${config.dashboard.port}/?mode=qa`);
    console.log(`📊 Open your browser to view the interactive dashboard\n`);
  });
};

startServer();
