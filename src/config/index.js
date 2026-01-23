require('dotenv').config();

module.exports = {
  jira: {
    authToken: process.env.JIRA_AUTH_TOKEN,
    baseUrl: process.env.JIRA_BASE_URL || 'https://winsider.atlassian.net/rest/api/3/search/jql',
    project: process.env.JIRA_PROJECT || 'OPT',
    statuses: ['Done', 'UAT PARTNER', 'UAT REPORTER'],
    modes: {
      dev: {
        issueTypes: ['Web Service (OPT)', 'Experiment (OPT)', 'Personalization (OPT)'],
        customFieldId: 'customfield_10008',
        fieldName: 'Story Points',
        basePoints: [1, 2, 3, 5, 8, 13, 17, 21, 34]
      },
      qa: {
        issueTypes: ['QA (OPT)'],
        customFieldId: 'customfield_14664',
        fieldName: 'QA Efforts',
        basePoints: [1, 2, 3, 5, 8, 13, 17, 21, 34]
      },
      'qa-board': {
        issueTypes: ['Web Service (OPT)', 'Experiment (OPT)', 'Personalization (OPT)'],
        customFieldId: 'customfield_14664',
        fieldName: 'QA Efforts',
        basePoints: [1, 2, 3, 5, 8, 13, 17, 21, 34]
      }
    }
  },
  
  dashboard: {
    port: parseInt(process.env.DASHBOARD_PORT) || 3001,
    legacyPort: parseInt(process.env.DASHBOARD_LEGACY_PORT) || 3000
  },
  
  analysis: {
    basePoints: [1, 2, 3, 5, 8, 13, 17, 21, 34],
    storyPointCategories: ['1', '2', '3', '5', '8', '13+'],
    startDate: '2025-03-01'
  },
  
  google: {
    credentialsPath: process.env.GOOGLE_CREDENTIALS_PATH || './google-credentials.json'
  },
  
  paths: {
    data: './data',
    // Dev mode paths
    devDataUp: './data/story-point-all-updates-up-data.json',
    devReportUp: './data/story-point-all-updates-up-report.txt',
    devDataDown: './data/story-point-all-updates-down-data.json',
    devReportDown: './data/story-point-all-updates-down-report.txt',
    // QA mode paths
    qaDataUp: './data/qa-efforts-all-updates-up-data.json',
    qaReportUp: './data/qa-efforts-all-updates-up-report.txt',
    qaDataDown: './data/qa-efforts-all-updates-down-data.json',
    qaReportDown: './data/qa-efforts-all-updates-down-report.txt',
    // QA Board mode paths
    qaBoardDataUp: './data/qa-board-all-updates-up-data.json',
    qaBoardReportUp: './data/qa-board-all-updates-up-report.txt',
    qaBoardDataDown: './data/qa-board-all-updates-down-data.json',
    qaBoardReportDown: './data/qa-board-all-updates-down-report.txt',
    // Legacy paths (backward compatibility)
    devData: './data/story-point-all-updates-up-data.json',
    devReport: './data/story-point-all-updates-up-report.txt',
    qaData: './data/qa-efforts-all-updates-up-data.json',
    qaReport: './data/qa-efforts-all-updates-up-report.txt',
    qaBoardData: './data/qa-board-all-updates-up-data.json',
    qaBoardReport: './data/qa-board-all-updates-up-report.txt',
    allUpdatesData: './data/story-point-all-updates-up-data.json',
    allUpdatesReport: './data/story-point-all-updates-up-report.txt',
    legacyData: './data/story-point-2-to-higher-data.json',
    legacyReport: './data/story-point-2-to-higher-report.txt'
  }
};
