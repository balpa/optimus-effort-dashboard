const fs = require('fs');
const path = require('path');
const config = require('./config');
const jiraService = require('./services/jira');
const analyzer = require('./services/analyzer');
const { generateMonths } = require('./utils/date');

const MODE = 'dev';
const modeConfig = config.jira.modes[MODE];
const BASE_POINTS = modeConfig.basePoints || config.analysis.basePoints;

const formatResults = (monthName, issueCount, changes, direction = 'up') => {
  let output = `\n${'='.repeat(60)}\n${monthName}\n${'='.repeat(60)}\n`;
  output += `Total Issues: ${issueCount}\n`;
  output += `Total Story Point ${direction === 'up' ? 'Increases' : 'Decreases'}: ${changes.length}\n\n`;

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
  console.log(`\n📊 Starting comprehensive story point analysis (${direction === 'up' ? 'increases' : 'decreases'})...\n`);

  const MONTHS = generateMonths(config.analysis.startDate);
  const monthlyStats = {};
  const basePointsStr = BASE_POINTS.join('/');
  let fullOutput = `Story Point Analysis Report (${basePointsStr}→${direction === 'up' ? 'higher' : 'lower'})\nGenerated: ${new Date().toISOString()}\n`;

  for (const [monthKey, monthData] of Object.entries(MONTHS)) {
    console.log(`\nProcessing ${monthData.name}...`);
    
    try {
      const issues = await jiraService.fetchAllPages(monthData.start, monthData.end);
      const changes = analyzer.analyzeEffortChanges(issues, BASE_POINTS, 'dev', direction);
      const distribution = analyzer.analyzeStoryPointDistribution(issues);
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
      
      console.log(`  ✓ ${monthData.name}: ${issues.length} issues, ${changes.length} story point ${direction === 'up' ? 'increases' : 'decreases'}`);
    } catch (error) {
      console.error(`  ✗ Error processing ${monthData.name}:`, error.message);
      fullOutput += `\n${monthData.name}: ERROR - ${error.message}\n`;
    }
  }

  fullOutput += `\n\n${'='.repeat(60)}\nSTORY POINT DISTRIBUTION BY MONTH\n${'='.repeat(60)}\n\n`;
  
  Object.entries(monthlyStats).forEach(([monthKey, stats]) => {
    fullOutput += `\n${stats.name}:\n`;
    fullOutput += `  Total Issues: ${stats.totalIssues}\n\n`;
    fullOutput += `  Story Point Distribution:\n`;
    
    const sortedDistribution = Object.entries(stats.distribution).sort((a, b) => {
      const aVal = a[0] === 'null' ? -1 : parseFloat(a[0]);
      const bVal = b[0] === 'null' ? -1 : parseFloat(b[0]);
      return aVal - bVal;
    });
    
    sortedDistribution.forEach(([points, count]) => {
      const percentage = ((count / stats.totalIssues) * 100).toFixed(1);
      fullOutput += `    ${points === 'null' ? 'No Story Points' : points + ' points'}: ${count} (${percentage}%)\n`;
    });
    
    fullOutput += `\n  Story Point Changes:\n`;
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
  });

  const grandTotalIssues = Object.values(monthlyStats).reduce((sum, s) => sum + s.totalIssues, 0);
  const grandTotalChanges = Object.values(monthlyStats).reduce((sum, s) => sum + s.totalChanges, 0);

  fullOutput += `\n${'='.repeat(60)}\nGRAND TOTALS\n${'='.repeat(60)}\n`;
  fullOutput += `Total Issues: ${grandTotalIssues}\n`;
  fullOutput += `Total Changes: ${grandTotalChanges}\n`;

  fullOutput += `\n\n${'='.repeat(60)}\nALL AFFECTED ISSUE KEYS\n${'='.repeat(60)}\n\n`;

  for (const [monthKey, stats] of Object.entries(monthlyStats)) {
    if (stats.keys.length > 0) {
      fullOutput += `${stats.name}:\n`;
      
      BASE_POINTS.forEach(base => {
        const keysForBase = stats.keys.filter(({ from }) => parseFloat(from) === base);
        if (keysForBase.length > 0) {
          const keysByTarget = keysForBase.reduce((acc, { key, to }) => {
            (acc[to] = acc[to] || []).push(key);
            return acc;
          }, {});

          fullOutput += `  From ${base}:\n`;
          Object.keys(keysByTarget).sort((a, b) => parseFloat(a) - parseFloat(b)).forEach(target => {
            fullOutput += `    ${base} → ${target}: ${keysByTarget[target].join(', ')}\n`;
          });
        }
      });
      fullOutput += '\n';
    }
  }

  const reportPath = direction === 'up' 
    ? path.resolve(config.paths.devReportUp) 
    : path.resolve(config.paths.devReportDown);
  const dataPath = direction === 'up' 
    ? path.resolve(config.paths.devDataUp) 
    : path.resolve(config.paths.devDataDown);
  
  const dataDir = path.dirname(reportPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  fs.writeFileSync(reportPath, fullOutput, 'utf8');
  console.log(`\n\n✓ Report saved to: ${reportPath}`);

  fs.writeFileSync(dataPath, JSON.stringify(monthlyStats, null, 2), 'utf8');
  console.log(`✓ JSON data saved to: ${dataPath}`);
  
  console.log(`\n💡 Story point ${direction === 'up' ? 'increases' : 'decreases'} from ${config.analysis.basePoints.join('/')}`);
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
