const fs = require('fs');
const path = require('path');

const AUTH_TOKEN = 'Basic YmVya2UuYWx0aXBhcm1ha0B1c2VpbnNpZGVyLmNvbTpBVEFUVDN4RmZHRjBDaWlkVldqdlhHY3RYdW9aSF8wY1J5SHhYcnYwdlBadGp4d3p1Z2FZSVpnNVRWcUZjV0ppRFZSNXowQUpxd0FkbWVmMlV6ekc2Wkd4SkhKblJmMHVQYzE5VVhSeV91X1dhek4zWUgweXJOMEVjUVkyaDN6R29NaUctMzk0SWdZTlNzcXRrRENPUm5RVE9EN3BrcEFueUdSeHk1TktucFBVajNLLW9ZQ1NBc1k9NEUwRkQ3Qjg=';
const BASE_URL = 'https://winsider.atlassian.net/rest/api/3/search/jql';
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const BASE_POINTS = [1, 2, 3, 5];

const getCurrentMonth = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const monthName = MONTH_NAMES[month];
  const key = monthName.toLowerCase() + year;
  
  return {
    key,
    start: `${year}-${String(month + 1).padStart(2, '0')}-01`,
    end: `${year}-${String(month + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
    name: `${monthName} ${year}`
  };
};

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

const analyzeStoryPointDistribution = (issues) => {
  const distribution = {};
  
  issues.forEach(issue => {
    const currentSP = issue.fields?.customfield_10008;
    
    if (currentSP === null || currentSP === undefined) {
      distribution['null'] = (distribution['null'] || 0) + 1;
    } else {
      const spValue = String(currentSP);
      distribution[spValue] = (distribution[spValue] || 0) + 1;
    }
  });
  
  return distribution;
};

const analyzeCurrentMonth = async () => {
  const currentMonth = getCurrentMonth();
  
  console.log(`\n📊 Fetching current month: ${currentMonth.name}`);
  console.log(`Period: ${currentMonth.start} to ${currentMonth.end}\n`);
  
  const issues = await fetchAllPages(currentMonth.start, currentMonth.end);
  
  console.log(`\nTotal issues fetched: ${issues.length}\n`);
  
  const changes = analyzeStoryPointChanges(issues);
  const distribution = analyzeStoryPointDistribution(issues);
  
  const byBaseAndTarget = BASE_POINTS.reduce((acc, base) => {
    acc[base] = {};
    changes.filter(c => c.from === base).forEach(c => {
      acc[base][c.to] = (acc[base][c.to] || 0) + 1;
    });
    return acc;
  }, {});
  
  const keys = changes.map(c => ({ key: c.key, from: c.from, to: c.to }));
  
  const monthData = {
    name: currentMonth.name,
    totalIssues: issues.length,
    totalChanges: changes.length,
    byBaseAndTarget,
    distribution,
    keys
  };
  
  const dataPath = path.join(__dirname, 'story-point-all-updates-data.json');
  let allData = {};
  
  if (fs.existsSync(dataPath)) {
    allData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  }
  
  allData[currentMonth.key] = monthData;
  
  fs.writeFileSync(dataPath, JSON.stringify(allData, null, 2));
  
  console.log(`✅ Current month data updated in story-point-all-updates-data.json`);
  console.log(`   Month: ${currentMonth.name}`);
  console.log(`   Total Issues: ${issues.length}`);
  console.log(`   Total Changes: ${changes.length}`);
};

analyzeCurrentMonth().catch(console.error);
