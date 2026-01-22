const config = require('../config');

const analyzeEffortChanges = (issues, basePoints = config.analysis.basePoints, mode = 'dev') => {
  const { modes } = config.jira;
  const modeConfig = modes[mode];
  
  if (!modeConfig) {
    throw new Error(`Invalid mode: ${mode}. Valid modes are: ${Object.keys(modes).join(', ')}`);
  }
  
  const customFieldId = modeConfig.customFieldId;
  const fieldName = modeConfig.fieldName;
  
  return issues.reduce((acc, issue) => {
    const { key, changelog } = issue;
    
    if (!key?.startsWith(`${config.jira.project}-`)) return acc;
    
    changelog?.histories?.forEach(history => {
      history.items?.forEach(item => {
        if (item.fieldId === customFieldId && item.field === fieldName) {
          const fromValue = parseFloat(item.fromString);
          const toValue = parseFloat(item.toString);
          
          if (basePoints.includes(fromValue) && toValue > fromValue) {
            acc.push({
              key,
              from: fromValue,
              to: toValue
            });
          }
        }
      });
    });
    
    return acc;
  }, []);
};

const analyzeEffortDistribution = (issues, mode = 'dev') => {
  const { modes } = config.jira;
  const modeConfig = modes[mode];
  
  if (!modeConfig) {
    throw new Error(`Invalid mode: ${mode}. Valid modes are: ${Object.keys(modes).join(', ')}`);
  }
  
  const customFieldId = modeConfig.customFieldId;
  const distribution = {};
  
  issues.forEach(issue => {
    const currentEffort = issue.fields?.[customFieldId];
    
    if (currentEffort === null || currentEffort === undefined) {
      distribution['null'] = (distribution['null'] || 0) + 1;
    } else {
      const effortValue = String(currentEffort);
      distribution[effortValue] = (distribution[effortValue] || 0) + 1;
    }
  });
  
  return distribution;
};

const groupChangesByBaseAndTarget = (changes, basePoints = config.analysis.basePoints) => {
  return basePoints.reduce((acc, base) => {
    acc[base] = {};
    changes.filter(c => c.from === base).forEach(c => {
      acc[base][c.to] = (acc[base][c.to] || 0) + 1;
    });
    return acc;
  }, {});
};

const calculateAverageEffort = (monthData) => {
  if (!monthData.distribution) return 0;
  
  const dist = monthData.distribution;
  let totalEffort = 0;
  let totalTasks = 0;
  
  Object.entries(dist).forEach(([points, count]) => {
    if (points !== 'null') {
      totalEffort += parseFloat(points) * count;
      totalTasks += count;
    }
  });
  
  return totalTasks > 0 ? totalEffort / totalTasks : 0;
};

// Backward compatibility aliases
const analyzeStoryPointChanges = (issues, basePoints) => analyzeEffortChanges(issues, basePoints, 'dev');
const analyzeStoryPointDistribution = (issues) => analyzeEffortDistribution(issues, 'dev');

module.exports = {
  analyzeEffortChanges,
  analyzeEffortDistribution,
  groupChangesByBaseAndTarget,
  calculateAverageEffort,
  // Backward compatibility exports
  analyzeStoryPointChanges,
  analyzeStoryPointDistribution
};
