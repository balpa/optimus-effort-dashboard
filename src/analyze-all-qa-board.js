const fs = require('fs');
const path = require('path');
const config = require('./config');
const jiraService = require('./services/jira');
const analyzer = require('./services/analyzer');
const { generateMonths } = require('./utils/date');

const main = async () => {
  const mode = 'qa-board';
  const { fieldName } = config.jira.modes[mode];
  const dataPath = config.paths.qaBoardData;
  const reportPath = config.paths.qaBoardReport;
  const BASE_POINTS = config.analysis.basePoints;

  const allMonthsData = {};
  let reportLines = [];
  let totalIssues = 0;
  let totalChanges = 0;

  const months = generateMonths(config.analysis.startDate);
  const MONTHS = Object.entries(months).map(([key, value]) => ({ key, ...value }));

  console.log(`\n🚀 Starting QA Board (${fieldName}) Analysis`);
  console.log(`📅 Period: ${config.analysis.startDate} - Present`);
  console.log(`📊 Total months to analyze: ${MONTHS.length}\n`);

  for (const monthData of MONTHS) {
    console.log(`\n📆 Processing ${monthData.name}...`);
    
    try {
      const issues = await jiraService.fetchAllPages(monthData.start, monthData.end, mode);
      
      const changes = analyzer.analyzeEffortChanges(issues, BASE_POINTS, mode);
      const distribution = analyzer.analyzeEffortDistribution(issues, mode);
      const byBaseAndTarget = analyzer.groupChangesByBaseAndTarget(changes);
      
      const keys = changes.map(c => ({ key: c.key, from: c.from, to: c.to }));
      
      allMonthsData[monthData.key] = {
        name: monthData.name,
        totalIssues: issues.length,
        totalChanges: changes.length,
        byBaseAndTarget,
        distribution,
        keys
      };
      
      totalIssues += issues.length;
      totalChanges += changes.length;

      console.log(`   ✅ Found ${issues.length} issues`);
      console.log(`   📈 ${fieldName} increases: ${changes.length}`);
      console.log(`   📊 Update rate: ${((changes.length / issues.length) * 100).toFixed(2)}%`);
      
      if (changes.length > 0) {
        console.log(`   🔄 Transitions breakdown:`);
        BASE_POINTS.forEach(base => {
          const targets = byBaseAndTarget[base] || {};
          Object.entries(targets).forEach(([target, count]) => {
            console.log(`      ${base} → ${target}: ${count} issues`);
          });
        });
      }

      reportLines.push(`\n${monthData.name}`);
      reportLines.push('-'.repeat(80));
      reportLines.push(`Total Issues: ${issues.length}`);
      reportLines.push(`${fieldName} Increases: ${changes.length}`);
      reportLines.push(`Update Rate: ${((changes.length / issues.length) * 100).toFixed(2)}%`);
      
      if (changes.length > 0) {
        reportLines.push(`\nIncreases by Transition:`);
        BASE_POINTS.forEach(base => {
          const targets = byBaseAndTarget[base] || {};
          Object.entries(targets).forEach(([target, count]) => {
            reportLines.push(`  ${base} → ${target}: ${count} issues`);
          });
        });
      }
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
      reportLines.push(`\n${monthData.name}`);
      reportLines.push('-'.repeat(80));
      reportLines.push(`ERROR: ${error.message}`);
    }
  }

  reportLines.unshift('');
  reportLines.unshift(`Tracking ${fieldName} increases from base points: ${BASE_POINTS.join(', ')}`);
  reportLines.unshift(`Analysis Period: March 2025 - Present`);
  reportLines.unshift('='.repeat(80));
  reportLines.unshift(`${fieldName} ANALYSIS - ALL MONTHS (QA Board Task)`);

  reportLines.push('\n\nSUMMARY - ALL MONTHS');
  reportLines.push('='.repeat(80));
  reportLines.push(`Total Issues Analyzed: ${totalIssues}`);
  reportLines.push(`Total ${fieldName} Increases: ${totalChanges}`);
  reportLines.push(`Overall Update Rate: ${((totalChanges / totalIssues) * 100).toFixed(2)}%`);

  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 SUMMARY - QA BOARD ANALYSIS COMPLETE`);
  console.log(`${'='.repeat(60)}`);
  console.log(`📝 Total Issues Analyzed: ${totalIssues.toLocaleString()}`);
  console.log(`📈 Total ${fieldName} Increases: ${totalChanges.toLocaleString()}`);
  console.log(`📉 Overall Update Rate: ${((totalChanges / totalIssues) * 100).toFixed(2)}%`);
  console.log(`${'='.repeat(60)}\n`);

  const resolvedDataPath = path.resolve(dataPath);
  const dataDir = path.dirname(resolvedDataPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  fs.writeFileSync(resolvedDataPath, JSON.stringify(allMonthsData, null, 2));
  fs.writeFileSync(path.resolve(reportPath), reportLines.join('\n'));

  console.log(`💾 Data saved to: ${path.basename(dataPath)}`);
  console.log(`📄 Report saved to: ${path.basename(reportPath)}\n`);
};

main().catch(console.error);
