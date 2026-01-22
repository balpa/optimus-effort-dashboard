const fs = require('fs');
const path = require('path');

const AUTH_TOKEN = 'Basic YmVya2UuYWx0aXBhcm1ha0B1c2VpbnNpZGVyLmNvbTpBVEFUVDN4RmZHRjBDaWlkVldqdlhHY3RYdW9aSF8wY1J5SHhYcnYwdlBadGp4d3p1Z2FZSVpnNVRWcUZjV0ppRFZSNXowQUpxd0FkbWVmMlV6ekc2Wkd4SkhKblJmMHVQYzE5VVhSeV91X1dhek4zWUgweXJOMEVjUVkyaDN6R29NaUctMzk0SWdZTlNzcXRrRENPUm5RVE9EN3BrcEFueUdSeHk1TktucFBVajNLLW9ZQ1NBc1k9NEUwRkQ3Qjg=';
const BASE_URL = 'https://winsider.atlassian.net/rest/api/3/search/jql';
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

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
        if (item.fieldId === 'customfield_10008' && 
            item.field === 'Story Points' && 
            item.fromString === '2' && 
            parseFloat(item.toString) > 2) {
          acc.push({
            key,
            from: item.fromString,
            to: item.toString,
            created: history.created,
            author: history.author?.displayName || 'Unknown'
          });
        }
      });
    });
    
    return acc;
  }, []);
};

const formatResults = (monthName, totalIssues, changes) => {
  const groupedByTarget = changes.reduce((acc, change) => {
    (acc[change.to] = acc[change.to] || []).push(change);
    return acc;
  }, {});

  const sortedTargets = Object.keys(groupedByTarget).sort((a, b) => parseFloat(a) - parseFloat(b));
  
  let output = `\n${'='.repeat(60)}\n${monthName}\n${'='.repeat(60)}\nTotal Issues: ${totalIssues}\n\n`;

  sortedTargets.forEach(targetValue => {
    const changesForTarget = groupedByTarget[targetValue];
    output += `--- Story Points: 2 → ${targetValue} (${changesForTarget.length} changes) ---\n`;
    changesForTarget.forEach(({ key, created, author }) => {
      output += `  ${key} | ${created} | ${author}\n`;
    });
    output += '\n';
  });

  if (changes.length === 0) {
    output += `  No changes found (2 → higher)\n`;
  }

  output += `\nSummary for ${monthName}:\n`;
  sortedTargets.forEach(targetValue => {
    output += `  2 → ${targetValue}: ${groupedByTarget[targetValue].length}\n`;
  });
  output += `  Total: ${changes.length}\n`;

  return output;
};

const main = async () => {
  console.log('Story Point Changes Analysis (2 → Higher)\n');
  console.log('Fetching data from Jira API...\n');

  let fullOutput = `STORY POINT CHANGES ANALYSIS REPORT (2 → HIGHER)\nGenerated: ${new Date().toISOString()}\n${'='.repeat(60)}\n`;
  const monthlyStats = {};

  for (const [monthKey, monthData] of Object.entries(MONTHS)) {
    console.log(`\nProcessing ${monthData.name}...`);
    
    try {
      const issues = await fetchAllPages(monthData.start, monthData.end);
      const changes = analyzeStoryPointChanges(issues);
      
      const byTarget = changes.reduce((acc, { to }) => {
        acc[to] = (acc[to] || 0) + 1;
        return acc;
      }, {});

      monthlyStats[monthKey] = {
        name: monthData.name,
        totalIssues: issues.length,
        totalChanges: changes.length,
        byTarget,
        keys: changes.map(({ key, to }) => ({ key, to }))
      };

      fullOutput += formatResults(monthData.name, issues.length, changes);
      
      console.log(`  ✓ ${monthData.name}: ${issues.length} issues, ${changes.length} story point changes (2 → higher)`);
    } catch (error) {
      console.error(`  ✗ Error processing ${monthData.name}:`, error.message);
      fullOutput += `\n${monthData.name}: ERROR - ${error.message}\n`;
    }
  }

  const allTargets = [...new Set(Object.values(monthlyStats).flatMap(stats => Object.keys(stats.byTarget || {})))];
  const sortedTargets = allTargets.sort((a, b) => parseFloat(a) - parseFloat(b));

  fullOutput += `\n\n${'='.repeat(60)}\nMONTHLY COMPARISON\n${'='.repeat(60)}\n\n`;
  fullOutput += `Month           | Issues | Total | ${sortedTargets.map(t => `2→${t}`).join(' | ')} | \n`;
  fullOutput += '-'.repeat(15 + 10 + 8 + (sortedTargets.length * 6)) + '\n';

  for (const [monthKey, stats] of Object.entries(monthlyStats)) {
    const name = stats.name.padEnd(15);
    const issues = String(stats.totalIssues).padStart(6);
    const total = String(stats.totalChanges).padStart(5);
    const targets = sortedTargets.map(t => String(stats.byTarget[t] || 0).padStart(3)).join(' | ');
    fullOutput += `${name} | ${issues} | ${total} | ${targets} | \n`;
  }

  const grandTotalIssues = Object.values(monthlyStats).reduce((sum, s) => sum + s.totalIssues, 0);
  const grandTotalChanges = Object.values(monthlyStats).reduce((sum, s) => sum + s.totalChanges, 0);
  const grandTotalByTarget = Object.values(monthlyStats).reduce((acc, stats) => {
    Object.entries(stats.byTarget).forEach(([target, count]) => {
      acc[target] = (acc[target] || 0) + count;
    });
    return acc;
  }, {});

  fullOutput += '-'.repeat(15 + 10 + 8 + (sortedTargets.length * 6)) + '\n';
  const totalTargets = sortedTargets.map(t => String(grandTotalByTarget[t] || 0).padStart(3)).join(' | ');
  fullOutput += `${'TOTAL'.padEnd(15)} | ${String(grandTotalIssues).padStart(6)} | ${String(grandTotalChanges).padStart(5)} | ${totalTargets} | \n`;

  fullOutput += `\n\n${'='.repeat(60)}\nALL AFFECTED ISSUE KEYS (2 → HIGHER)\n${'='.repeat(60)}\n\n`;

  for (const [monthKey, stats] of Object.entries(monthlyStats)) {
    if (stats.keys.length > 0) {
      fullOutput += `${stats.name}:\n`;
      
      const keysByTarget = stats.keys.reduce((acc, { key, to }) => {
        (acc[to] = acc[to] || []).push(key);
        return acc;
      }, {});

      Object.keys(keysByTarget).sort((a, b) => parseFloat(a) - parseFloat(b)).forEach(target => {
        fullOutput += `  2 → ${target}: ${keysByTarget[target].join(', ')}\n`;
      });
      fullOutput += '\n';
    }
  }

  fs.writeFileSync(path.join(__dirname, 'story-point-2-to-higher-report.txt'), fullOutput, 'utf8');
  console.log(`\n\n✓ Report saved to: story-point-2-to-higher-report.txt`);

  fs.writeFileSync(path.join(__dirname, 'story-point-2-to-higher-data.json'), JSON.stringify(monthlyStats, null, 2), 'utf8');
  console.log(`✓ JSON data saved to: story-point-2-to-higher-data.json`);
  
  console.log(`\n💡 To upload to Google Sheets, run: node google-sheets-upload.js`);
  console.log(`💡 To view dashboard, run: npm run dashboard`);
};

main().catch(console.error);
