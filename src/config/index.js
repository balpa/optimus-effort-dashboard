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
        customFieldId: 'customfield_10008', // Story Points
        fieldName: 'Story Points'
      },
      qa: {
        issueTypes: ['QA (OPT)'],
        customFieldId: 'customfield_14664', // QA Efforts
        fieldName: 'QA Efforts'
      }
    }
  },
  
  dashboard: {
    port: parseInt(process.env.DASHBOARD_PORT) || 3001,
    legacyPort: parseInt(process.env.DASHBOARD_LEGACY_PORT) || 3000
  },
  
  analysis: {
    basePoints: [1, 2, 3, 5],
    storyPointCategories: ['1', '2', '3', '5', '8', '13+'],
    startDate: '2025-03-01'
  },
  
  google: {
    credentialsPath: process.env.GOOGLE_CREDENTIALS_PATH || './google-credentials.json'
  },
  
  paths: {
    data: './data',
    devData: './data/story-point-all-updates-data.json',
    devReport: './data/story-point-all-updates-report.txt',
    qaData: './data/qa-efforts-all-updates-data.json',
    qaReport: './data/qa-efforts-all-updates-report.txt',
    // Legacy paths (for backward compatibility)
    allUpdatesData: './data/story-point-all-updates-data.json',
    allUpdatesReport: './data/story-point-all-updates-report.txt',
    legacyData: './data/story-point-2-to-higher-data.json',
    legacyReport: './data/story-point-2-to-higher-report.txt'
  }
};
