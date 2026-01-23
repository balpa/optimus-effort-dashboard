const fs = require('fs');
const path = require('path');
const config = require('./config');
const jiraService = require('./services/jira');
const analyzer = require('./services/analyzer');
const { generateMonths } = require('./utils/date');

const MODE = 'qa';
const modeConfig = config.jira.modes[MODE];
const fieldName = modeConfig.fieldName;
const BASE_POINTS = modeConfig.basePoints || config.analysis.basePoints;

const formatResults = (monthName, issueCount, changes, direction = 'up') => {
  let output = `\n${'='.repeat(60)}\n${monthName}\n${'='.repeat(60)}\n`;
  output += `Total Issues: ${issueCount}\n`;
  output += `Total ${fieldName} ${direction === 'up' ? 'Increases' : 'Decreases'}: ${changes.length}\n\n`;

  if (changes.length > 0) {
    const grouped = BASE_POINTS.reduce((acc, base) => {
      acc[base] = changes.filter(c => c.from === base);
      return acc;
    }, {});

    BASE_POINTS.forEach(base => {
      const baseChanges = grouped[base];
      if (baseChanges.length > 0) {
        output += `From ${base} points (${baseChanges.length} changes):\n`;
        
        const byTarget = baseChanges.reduce((acc, c) => {
          (acc[c.to] = acc[c.to] || []).push(c.key);
          return acc;
        }, {});

        Object.keys(byTarget).sort((a, b) => parseFloat(a) - parseFloat(b)).forEach(target => {
          output += `  ${base} → ${target}: ${byTarget[target].length} changes\n`;
          output += `    Keys: ${byTarget[target].join(', ')}\n`;
        });
        output += '\n';
      }
    });
  }

  return output;
};

const main = async (direction = 'up') => {
  console.log(`\n📊 Starting comprehensive ${fieldName} analysis (QA mode - ${direction === 'up' ? 'increases' : 'decreases'})...\n`);

  const MONTHS = generateMonths(config.analysis.startDate);
  const monthlyStats = {};
  const basePointsStr = BASE_POINTS.join('/');
  let fullOutput = `${fieldName} Analysis Report (QA tasks - ${basePointsStr}→${direction === 'up' ? 'higher' : 'lower'})\nGenerated: ${new Date().toISOString()}\n`;

  for (const [monthKey, monthData] of Object.entries(MONTHS)) {
    console.log(`\nProcessing ${monthData.name}...`);
    
    try {
      const issues = await jiraService.fetchAllPages(monthData.start, monthData.end, MODE);
      const changes = analyzer.analyzeEffortChanges(issues, BASE_POINTS, MODE, direction);
      const distribution = analyzer.analyzeEffortDistribution(issues, MODE);
      const byBaseAndTarget = analyzer.groupChangesByBaseAndTarget(changes);

      monthlyStats[monthKey] = {
        name: monthData.name,
        totalIssues: issues.length,
        totalChanges: changes.length,
        byBaseAndTarget,
        distribution,
        keys: changes.map(({ key, from, to }) => ({ key, from, to }))
      };

      fullOutput += formatResults(monthData.name, issues.length, changes, direction);
      
      console.log(`  ✓ ${monthData.name}: ${issues.length} issues, ${changes.length} ${fieldName} ${direction === 'up' ? 'increases' : 'decreases'}`);
    } catch (error) {
      console.error(`  ✗ Error processing ${monthData.name}:`, error.message);
      fullOutput += `\n${monthData.name}: ERROR - ${error.message}\n`;
    }
  }

  fullOutput += `\n\n${'='.repeat(60)}\n${fieldName.toUpperCase()} DISTRIBUTION BY MONTH\n${'='.repeat(60)}\n\n`;
  
  Object.entries(monthlyStats).forEach(([monthKey, stats]) => {
    fullOutput += `\n${stats.name}:\n`;
    fullOutput += `  Total Issues: ${stats.totalIssues}\n\n`;
    fullOutput += `  ${fieldName} Distribution:\n`;
    
    const sortedDistribution = Object.entries(stats.distribution).sort((a, b) => {
      const aVal = a[0] === 'null' ? -1 : parseFloat(a[0]);
      const bVal = b[0] === 'null' ? -1 : parseFloat(b[0]);
      return aVal - bVal;
    });
    
    sortedDistribution.forEach(([points, count]) => {
      const percentage = ((count / stats.totalIssues) * 100).toFixed(1);
      fullOutput += `    ${points === 'null' ? `No ${fieldName}` : points + ' points'}: ${count} (${percentage}%)\n`;
    });
    
    fullOutput += `\n  ${fieldName} Changes:\n`;
    fullOutput += `  Total Changes: ${stats.totalChanges}\n`;
    BASE_POINTS.forEach(base => {
      const targets = stats.byBaseAndTarget[base];
      const totalForBase = Object.values(targets).reduce((sum, count) => sum + count, 0);
      if (totalForBase > 0) {
        fullOutput += `  From ${base}: ${totalForBase}\n`;
        Object.keys(targets).sort((a, b) => parseFloat(a) - parseFloat(b)).forEach(target => {
          fullOutput += `    ${base} → ${target}: ${targets[target]}\n`;
        });
      }
    });
    fullOutput += '\n';
  });

  fullOutput += `\n\n${'='.repeat(60)}\nAVERAGE ${fieldName.toUpperCase()} BY MONTH\n${'='.repeat(60)}\n\n`;
  
  Object.entries(monthlyStats).forEach(([monthKey, stats]) => {
    const avgEffort = analyzer.calculateAverageEffort(stats);
    fullOutput += `${stats.name}: ${avgEffort.toFixed(2)}\n`;
  });

  fullOutput += `\n${'='.repeat(60)}\nSUMMARY\n${'='.repeat(60)}\n\n`;
  
  const totalIssues = Object.values(monthlyStats).reduce((sum, m) => sum + m.totalIssues, 0);
  const totalChanges = Object.values(monthlyStats).reduce((sum, m) => sum + m.totalChanges, 0);
  
  fullOutput += `Total Issues Across All Months: ${totalIssues}\n`;
  fullOutput += `Total ${fieldName} Increases: ${totalChanges}\n`;
  fullOutput += `Average ${fieldName} Increase Rate: ${((totalChanges / totalIssues) * 100).toFixed(2)}%\n`;

  const allAverages = Object.values(monthlyStats).map(s => analyzer.calculateAverageEffort(s));
  const overallAvg = allAverages.reduce((sum, avg) => sum + avg, 0) / allAverages.length;
  fullOutput += `Overall Average ${fieldName}: ${overallAvg.toFixed(2)}\n`;

  const dataPath = direction === 'up' 
    ? path.resolve(config.paths.qaDataUp) 
    : path.resolve(config.paths.qaDataDown);
  const reportPath = direction === 'up' 
    ? path.resolve(config.paths.qaReportUp) 
    : path.resolve(config.paths.qaReportDown);

  const dataDir = path.dirname(dataPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  fs.writeFileSync(dataPath, JSON.stringify(monthlyStats, null, 2));
  fs.writeFileSync(reportPath, fullOutput);

  console.log(`\n✅ Analysis complete!`);
  console.log(`   Data saved to: ${path.basename(dataPath)}`);
  console.log(`   Report saved to: ${path.basename(reportPath)}`);
  console.log(`   Total Issues: ${totalIssues}`);
  console.log(`   Total ${fieldName} ${direction === 'up' ? 'Increases' : 'Decreases'}: ${totalChanges}\n`);
};

// Run for both directions
(async () => {
  try {
    await main('up');
    console.log('\n\n' + '='.repeat(80) + '\n');
    await main('down');
  } catch (error) {
    console.error(error);
  }
})();
