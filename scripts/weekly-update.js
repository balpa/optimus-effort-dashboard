#!/usr/bin/env node
/**
 * Weekly Data Update Script
 * Runs every Monday to fetch and analyze latest Jira data
 */

const { execSync } = require('child_process');

console.log('🚀 Starting weekly data update...');
console.log(`📅 Timestamp: ${new Date().toISOString()}`);

try {
  // Fetch current month data for story points
  console.log('\n📊 Fetching current month story point data...');
  execSync('node src/fetch-current.js', { stdio: 'inherit' });
  
  // Analyze all story point data
  console.log('\n📈 Analyzing story point data...');
  execSync('node src/analyze-all.js', { stdio: 'inherit' });
  
  // Fetch current month data for QA efforts
  console.log('\n🔍 Fetching current month QA effort data...');
  execSync('node src/fetch-current-qa.js', { stdio: 'inherit' });
  
  // Analyze all QA effort data
  console.log('\n📊 Analyzing QA effort data...');
  execSync('node src/analyze-all-qa.js', { stdio: 'inherit' });
  
  console.log('\n✅ Weekly data update completed successfully!');
  console.log(`✨ Finished at: ${new Date().toISOString()}`);
  
  process.exit(0);
} catch (error) {
  console.error('\n❌ Error during weekly update:', error.message);
  process.exit(1);
}
