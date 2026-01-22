const fs = require('fs');
const path = require('path');
const config = require('../config');
const jiraService = require('../services/jira');
const analyzer = require('../services/analyzer');
const { getCurrentMonth } = require('../utils/date');

const updateCurrentMonth = async (mode = 'dev', force = false) => {
  const { modes, paths } = config.jira;
  const modeConfig = modes[mode];
  
  if (!modeConfig) {
    throw new Error(`Invalid mode: ${mode}. Valid modes are: ${Object.keys(modes).join(', ')}`);
  }
  
  const currentMonth = getCurrentMonth();
  const dataPath = mode === 'dev' ? config.paths.devData : 
                   mode === 'qa' ? config.paths.qaData : 
                   config.paths.qaBoardData;
  
  // Check if data was already fetched today (unless force is true)
  if (!force) {
    const resolvedDataPath = path.resolve(dataPath);
    if (fs.existsSync(resolvedDataPath)) {
      const stats = fs.statSync(resolvedDataPath);
      const today = new Date().toDateString();
      const fileDate = new Date(stats.mtime).toDateString();
      
      if (today === fileDate) {
        const allData = JSON.parse(fs.readFileSync(resolvedDataPath, 'utf8'));
        return allData;
      }
    }
  }
  
  const issues = await jiraService.fetchAllPages(currentMonth.start, currentMonth.end, mode);
  
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
  
  return allData;
};

module.exports = { updateCurrentMonth };
