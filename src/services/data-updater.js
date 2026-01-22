const fs = require('fs');
const path = require('path');
const config = require('../config');
const jiraService = require('../services/jira');
const analyzer = require('../services/analyzer');
const { getCurrentMonth } = require('../utils/date');

const updateCurrentMonth = async (mode = 'dev') => {
  const { modes, paths } = config.jira;
  const modeConfig = modes[mode];
  
  if (!modeConfig) {
    throw new Error(`Invalid mode: ${mode}. Valid modes are: ${Object.keys(modes).join(', ')}`);
  }
  
  const currentMonth = getCurrentMonth();
  const dataPath = mode === 'dev' ? config.paths.devData : config.paths.qaData;
  
  console.log(`\n📊 Fetching current month (${mode.toUpperCase()} mode): ${currentMonth.name}`);
  console.log(`Period: ${currentMonth.start} to ${currentMonth.end}`);
  console.log(`Field: ${modeConfig.fieldName}\n`);
  
  const issues = await jiraService.fetchAllPages(currentMonth.start, currentMonth.end, mode);
  
  console.log(`\nTotal issues fetched: ${issues.length}\n`);
  
  const changes = analyzer.analyzeEffortChanges(issues, config.analysis.basePoints, mode);
  const distribution = analyzer.analyzeEffortDistribution(issues, mode);
  const byBaseAndTarget = analyzer.groupChangesByBaseAndTarget(changes);
  
  const keys = changes.map(c => ({ key: c.key, from: c.from, to: c.to }));
  
  const monthData = {
    name: currentMonth.name,
    totalIssues: issues.length,
    totalChanges: changes.length,
    byBaseAndTarget,
    distribution,
    keys
  };
  
  const resolvedDataPath = path.resolve(dataPath);
  let allData = {};
  
  if (fs.existsSync(resolvedDataPath)) {
    allData = JSON.parse(fs.readFileSync(resolvedDataPath, 'utf8'));
  }
  
  allData[currentMonth.key] = monthData;
  
  const dataDir = path.dirname(resolvedDataPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  fs.writeFileSync(resolvedDataPath, JSON.stringify(allData, null, 2));
  
  console.log(`✅ Current month data updated in ${path.basename(resolvedDataPath)}`);
  console.log(`   Mode: ${mode.toUpperCase()}`);
  console.log(`   Month: ${currentMonth.name}`);
  console.log(`   Total Issues: ${issues.length}`);
  console.log(`   Total Changes: ${changes.length}`);
  
  return allData;
};

module.exports = { updateCurrentMonth };
