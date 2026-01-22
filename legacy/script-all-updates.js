const fs = require('fs');
const path = require('path');

const AUTH_TOKEN = 'Basic YmVya2UuYWx0aXBhcm1ha0B1c2VpbnNpZGVyLmNvbTpBVEFUVDN4RmZHRjBDaWlkVldqdlhHY3RYdW9aSF8wY1J5SHhYcnYwdlBadGp4d3p1Z2FZSVpnNVRWcUZjV0ppRFZSNXowQUpxd0FkbWVmMlV6ekc2Wkd4SkhKblJmMHVQYzE5VVhSeV91X1dhek4zWUgweXJOMEVjUVkyaDN6R29NaUctMzk0SWdZTlNzcXRrRENPUm5RVE9EN3BrcEFueUdSeHk1TktucFBVajNLLW9ZQ1NBc1k9NEUwRkQ3Qjg=';
const BASE_URL = 'https://winsider.atlassian.net/rest/api/3/search/jql';
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const BASE_POINTS = [1, 2, 3, 5];

const generateMonths = () => {
  const months = {};
  const startDate = new Date('2025-03-01');
  const now = new Date();
  let current = new Date(startDate);
  
  while (current <= now) {
    const year = current.getFullYear();
    const month = current.getMonth();
    const monthName = MONTH_NAMES[month];
    const key = monthName.toLowerCase() + year;
    
    const lastDay = year === now.getFullYear() && month === now.getMonth()
      ? now.getDate()
      : new Date(year, month + 1, 0).getDate();
    
    months[key] = {
      start: `${year}-${String(month + 1).padStart(2, '0')}-01`,
      end: `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
      name: `${monthName} ${year}`
    };
    
    current.setMonth(current.getMonth() + 1);
  }
  
  return months;
};

const MONTHS = generateMonths();

const buildJQL = (startDate, endDate) => 
  `created >= "${startDate}" AND project = OPT AND type IN ("Web Service (OPT)", "Experiment (OPT)", "Personalization (OPT)") AND status IN (Done, "UAT PARTNER", "UAT REPORTER") AND created <= "${endDate}"`;

const fetchAllPages = async (startDate, endDate) => {
  const jql = buildJQL(startDate, endDate);
  const allIssues = [];
  let nextPageToken = null;
  let pageCount = 0;

  do {
    pageCount++;
    const url = `${BASE_URL}?jql=${encodeURIComponent(jql)}&fields=customfield_10008&expand=changelog&maxResults=100${nextPageToken ? `&nextPageToken=${encodeURIComponent(nextPageToken)}` : ''}`;

    console.log(`  Fetching page ${pageCount}...`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': AUTH_TOKEN,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`  API Error Response:`, errorText);
      throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log(`  Response keys:`, Object.keys(data));
    console.log(`  Issues count: ${data.issues?.length || 0}`);
    console.log(`  isLast: ${data.isLast}`);
    console.log(`  nextPageToken: ${data.nextPageToken || 'none'}`);
    
    if (data.issues?.length > 0) {
      allIssues.push(...data.issues);
      console.log(`  Total accumulated: ${allIssues.length}`);
    }

    if (data.isLast) break;
    
    nextPageToken = data.nextPageToken;
  } while (nextPageToken);

  return allIssues;
};

const analyzeStoryPointChanges = (issues) => {
  return issues.reduce((acc, issue) => {
    const { key, changelog } = issue;
    
    if (!key?.startsWith('OPT-')) return acc;
    
    changelog?.histories?.forEach(history => {
      history.items?.forEach(item => {
        if (item.fieldId === 'customfield_10008' && item.field === 'Story Points') {
          const fromValue = parseFloat(item.fromString);
          const toValue = parseFloat(item.toString);
          
          if (BASE_POINTS.includes(fromValue) && toValue > fromValue) {
            acc.push({
              key,
              from: item.fromString,
              to: item.toString,
              created: history.created,
              author: history.author?.displayName || 'Unknown'
            });
          }
        }
      });
    });
    
    return acc;
  }, []);
};

const analyzeStoryPointDistribution = (issues) => {
  const distribution = {};
  
  issues.forEach(issue => {
    const storyPoints = issue.fields?.customfield_10008;
    const key = storyPoints !== null && storyPoints !== undefined ? storyPoints.toString() : 'null';
    distribution[key] = (distribution[key] || 0) + 1;
  });
  
  return distribution;
};

const formatResults = (monthName, totalIssues, changes) => {
  const groupedByBase = BASE_POINTS.reduce((acc, base) => {
    acc[base] = changes.filter(c => parseFloat(c.from) === base).reduce((targetAcc, change) => {
      (targetAcc[change.to] = targetAcc[change.to] || []).push(change);
      return targetAcc;
    }, {});
    return acc;
  }, {});

  let output = `\n${'='.repeat(60)}\n${monthName}\n${'='.repeat(60)}\nTotal Issues: ${totalIssues}\n\n`;

  BASE_POINTS.forEach(basePoint => {
    const targets = groupedByBase[basePoint];
    const sortedTargets = Object.keys(targets).sort((a, b) => parseFloat(a) - parseFloat(b));
    
    if (sortedTargets.length > 0) {
      output += `\n--- Changes from ${basePoint} ---\n`;
      sortedTargets.forEach(targetValue => {
        const changesForTarget = targets[targetValue];
        output += `  ${basePoint} → ${targetValue} (${changesForTarget.length} changes)\n`;
        changesForTarget.forEach(({ key, created, author }) => {
          output += `    ${key} | ${created} | ${author}\n`;
        });
      });
    }
  });

  if (changes.length === 0) {
    output += `  No changes found\n`;
  }

  output += `\nSummary for ${monthName}:\n`;
  BASE_POINTS.forEach(basePoint => {
    const targets = groupedByBase[basePoint];
    const totalForBase = Object.values(targets).reduce((sum, arr) => sum + arr.length, 0);
    if (totalForBase > 0) {
      output += `  From ${basePoint}: ${totalForBase}\n`;
      Object.keys(targets).sort((a, b) => parseFloat(a) - parseFloat(b)).forEach(target => {
        output += `    ${basePoint} → ${target}: ${targets[target].length}\n`;
      });
    }
  });
  output += `  Total: ${changes.length}\n`;

  return output;
};

const main = async () => {
  console.log('Story Point Changes Analysis (1/2/3/5 → Higher)\n');
  console.log('Fetching data from Jira API...\n');

  let fullOutput = `STORY POINT CHANGES ANALYSIS REPORT (1/2/3/5 → HIGHER)\nGenerated: ${new Date().toISOString()}\n${'='.repeat(60)}\n`;
  const monthlyStats = {};

  for (const [monthKey, monthData] of Object.entries(MONTHS)) {
    console.log(`\nProcessing ${monthData.name}...`);
    
    try {
      const issues = await fetchAllPages(monthData.start, monthData.end);
      const changes = analyzeStoryPointChanges(issues);
      const distribution = analyzeStoryPointDistribution(issues);
      
      const byBaseAndTarget = BASE_POINTS.reduce((acc, base) => {
        acc[base] = changes.filter(c => parseFloat(c.from) === base).reduce((targetAcc, { to }) => {
          targetAcc[to] = (targetAcc[to] || 0) + 1;
          return targetAcc;
        }, {});
        return acc;
      }, {});

      monthlyStats[monthKey] = {
        name: monthData.name,
        totalIssues: issues.length,
        totalChanges: changes.length,
        byBaseAndTarget,
        distribution,
        keys: changes.map(({ key, from, to }) => ({ key, from, to }))
      };

      fullOutput += formatResults(monthData.name, issues.length, changes);
      
      console.log(`  ✓ ${monthData.name}: ${issues.length} issues, ${changes.length} story point increases`);
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

  fs.writeFileSync(path.join(__dirname, 'story-point-all-updates-report.txt'), fullOutput, 'utf8');
  console.log(`\n\n✓ Report saved to: story-point-all-updates-report.txt`);

  fs.writeFileSync(path.join(__dirname, 'story-point-all-updates-data.json'), JSON.stringify(monthlyStats, null, 2), 'utf8');
  console.log(`✓ JSON data saved to: story-point-all-updates-data.json`);
  
  console.log(`\n💡 Run this script to analyze all story point increases from 1/2/3/5`);
};

main().catch(console.error);
