const config = require('../config');

const buildJQL = (startDate, endDate, mode = 'dev') => {
  const { project, statuses, modes } = config.jira;
  const modeConfig = modes[mode];
  
  if (!modeConfig) {
    throw new Error(`Invalid mode: ${mode}. Valid modes are: ${Object.keys(modes).join(', ')}`);
  }
  
  const types = modeConfig.issueTypes.map(t => `"${t}"`).join(', ');
  const stats = statuses.map(s => `"${s}"`).join(', ');
  
  return `created >= "${startDate}" AND project = ${project} AND type IN (${types}) AND status IN (${stats}) AND created <= "${endDate}"`;
};

const fetchAllPages = async (startDate, endDate, mode = 'dev') => {
  const { modes } = config.jira;
  const modeConfig = modes[mode];
  
  if (!modeConfig) {
    throw new Error(`Invalid mode: ${mode}. Valid modes are: ${Object.keys(modes).join(', ')}`);
  }
  
  const jql = buildJQL(startDate, endDate, mode);
  const customFieldId = modeConfig.customFieldId;
  const allIssues = [];
  let nextPageToken = null;
  let pageCount = 0;

  do {
    pageCount++;
    const url = `${config.jira.baseUrl}?jql=${encodeURIComponent(jql)}&fields=${customFieldId}&expand=changelog&maxResults=100${nextPageToken ? `&nextPageToken=${encodeURIComponent(nextPageToken)}` : ''}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': config.jira.authToken,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    if (data.issues?.length > 0) {
      allIssues.push(...data.issues);
    }

    if (data.isLast) break;
    
    nextPageToken = data.nextPageToken;
  } while (nextPageToken);

  return allIssues;
};

module.exports = {
  buildJQL,
  fetchAllPages
};
