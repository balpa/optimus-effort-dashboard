#!/usr/bin/env node
/**
 * Data Update Script
 * Runs every Monday, Wednesday, and Friday to fetch and analyze latest Jira data
 * Tracks both increases and decreases for all effort values
 */

const { execSync } = require('child_process');

const getCurrentDay = () => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[new Date().getDay()];
};

console.log('🚀 Starting data update...');
console.log(`📅 Day: ${getCurrentDay()}`);
console.log(`⏰ Timestamp: ${new Date().toISOString()}`);

try {
  // Story Points (Dev Mode) - Both directions
  console.log('\n' + '='.repeat(60));
  console.log('📊 DEV MODE: Story Points Analysis');
  console.log('='.repeat(60));
  
  console.log('\n📈 Analyzing all story point data (increases & decreases)...');
  execSync('node src/analyze-all.js', { stdio: 'inherit' });
  
  // QA Efforts (QA Mode) - Both directions
  console.log('\n' + '='.repeat(60));
  console.log('🔍 QA MODE: QA Task Efforts Analysis');
  console.log('='.repeat(60));
  
  console.log('\n📊 Analyzing all QA effort data (increases & decreases)...');
  execSync('node src/analyze-all-qa.js', { stdio: 'inherit' });
  
  // QA Board (QA Board Mode) - Both directions
  console.log('\n' + '='.repeat(60));
  console.log('📋 QA BOARD MODE: Board Task QA Efforts Analysis');
  console.log('='.repeat(60));
  
  console.log('\n📈 Analyzing all QA board data (increases & decreases)...');
  execSync('node src/analyze-all-qa-board.js', { stdio: 'inherit' });
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ Data update completed successfully!');
  console.log('='.repeat(60));
  console.log(`\n📊 Summary:`);
  console.log(`  - Story Points: ✓ (up & down)`);
  console.log(`  - QA Efforts: ✓ (up & down)`);
  console.log(`  - QA Board: ✓ (up & down)`);
  console.log(`\n✨ Finished at: ${new Date().toISOString()}`);
  console.log(`🔄 Next update: Monday, Wednesday, or Friday at 09:00 UTC\n`);
  
  process.exit(0);
} catch (error) {
  console.error('\n❌ Error during data update:', error.message);
  process.exit(1);
}
