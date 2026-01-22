# Jira Story Point & QA Efforts Analysis Dashboard

Comprehensive analysis and visualization tool for tracking Jira effort changes over time with **dual-mode support** for both Development and QA tasks.

## 📋 Features

- **🔄 Dual Mode Operation**: Switch between DEV (Story Points) and QA (QA Efforts) analysis
- **🎯 Automated Data Fetching**: Pulls Jira issue data via REST API
- **📊 Effort Change Tracking**: Analyzes increases from base points (1, 2, 3, 5)
- **📈 Distribution Analysis**: Shows effort distribution across all tasks
- **🎨 Interactive Dashboard**: Web-based visualization with Chart.js and mode-specific themes
- **⚡ Incremental Updates**: Only fetches current month data on dashboard startup
- **📱 Multiple Views**: Overview, distribution, effort averages, detailed breakdowns
- **🎨 Visual Distinction**: Different color schemes for DEV (purple) and QA (green) modes

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ installed
- Jira account with API access
- Basic authentication token for Jira

### Installation

1. Clone or download this repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Create `.env` file from example:
   ```bash
   cp .env.example .env
   ```

4. Configure your environment variables in `.env`:
   ```
   JIRA_AUTH_TOKEN=your_jira_basic_auth_token
   JIRA_BASE_URL=https://your-domain.atlassian.net/rest/api/3/search/jql
   JIRA_PROJECT=YOUR_PROJECT_KEY
   ```

### Usage

#### 1. Initial Full Analysis (First Time)

Run complete analysis for all months:

**DEV Mode (Story Points)**:
```bash
npm run analyze
```

**QA Mode (QA Efforts)**:
```bash
npm run analyze:qa
```

This will:
- Fetch all issues from March 2025 to present
- Analyze effort changes for the selected mode
- Generate reports in `data/` directory
- Create JSON data files for dashboard

#### 2. Start Dashboard

Launch the interactive dashboard:
```bash
npm start
```

The dashboard will:
- Automatically update current month data for **both DEV and QA modes**
- Start server on port 3001
- Open at http://localhost:3001 (default: DEV mode)

**Access Different Modes**:
- DEV Mode: `http://localhost:3001` or `http://localhost:3001/?mode=dev`
- QA Mode: `http://localhost:3001/?mode=qa`

#### 3. Update Current Month Only

Manually refresh current month data:

**DEV Mode**:
```bash
npm run fetch-current
```

**QA Mode**:
```bash
npm run fetch-current:qa
```

## 🎨 Dashboard Modes

### DEV Mode (Story Points)
- **Issue Types**: Web Service (OPT), Experiment (OPT), Personalization (OPT)
- **Custom Field**: Story Points (customfield_10008)
- **Color Theme**: Purple gradient
- **Toggle Button**: 💻 DEV (Story Points)

### QA Mode (QA Efforts)
- **Issue Types**: QA (OPT)
- **Custom Field**: QA Efforts (customfield_14664)
- **Color Theme**: Green gradient
- **Toggle Button**: 🧪 QA (QA Efforts)

**Switching Modes**: Click the toggle buttons at the top of the dashboard to switch between modes instantly.

## 📁 Project Structure

```
task-efforts/
├── src/
│   ├── config/
│   │   └── index.js           # Dual-mode configuration
│   ├── services/
│   │   ├── jira.js             # Mode-aware Jira API client
│   │   ├── analyzer.js         # Generic effort analysis
│   │   └── data-updater.js     # Mode-aware data updates
│   ├── utils/
│   │   └── date.js             # Date utilities
│   ├── views/
│   │   └── dashboard-data.js   # Dashboard data preparation
│   ├── analyze-all.js          # DEV full analysis script
│   ├── analyze-all-qa.js       # QA full analysis script ⭐ NEW
│   ├── fetch-current.js        # DEV current month update
│   ├── fetch-current-qa.js     # QA current month update ⭐ NEW
│   └── dashboard.js            # Dual-mode dashboard server
├── data/                       # Generated data files (gitignored)
│   ├── story-point-all-updates-data.json      # DEV data
│   ├── story-point-all-updates-report.txt     # DEV report
│   ├── qa-efforts-all-updates-data.json       # QA data ⭐ NEW
│   └── qa-efforts-all-updates-report.txt      # QA report ⭐ NEW
├── .env                        # Environment variables (gitignored)
├── .env.example                # Environment template
├── .gitignore
├── package.json
├── README.md
├── QA_MODE_IMPLEMENTATION.md   # Detailed implementation guide ⭐ NEW
└── README.md
\`\`\`

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| \`JIRA_AUTH_TOKEN\` | Basic auth token for Jira API | Required |
| \`JIRA_BASE_URL\` | Jira REST API base URL | Required |
| \`JIRA_PROJECT\` | Project key to analyze | OPT |
| \`DASHBOARD_PORT\` | Dashboard server port | 3001 |

### Analysis Parameters

Edit \`src/config/index.js\` to customize:

- **Base Points**: Story points to track increases from (default: 1, 2, 3, 5)
- **Start Date**: Beginning of analysis period (default: 2025-03-01)
- **Issue Types**: Jira issue types to include
- **Statuses**: Issue statuses to filter by

## 📊 Dashboard Features

### Overview Tab
- Total issues and changes summary
- Story point change trends over time
- Transition breakdown charts
- Monthly statistics table

### Distribution Tab
- Story point distribution by month
- Percentage breakdown
- Trend comparisons

### Effort Averages Tab
- Average effort trend line chart
- Effort distribution pie chart
- Monthly metrics table
- Stacked distribution chart

### Details Tab
- Month-by-month breakdown
- Individual issue keys by transition type
- Grouped by base→target story points

### Full Report Tab
- Complete text report
- All issue keys
- Detailed statistics

## 🎯 Use Cases

1. **Sprint Planning**: Understand story point estimation patterns
2. **Process Improvement**: Identify frequently re-estimated work
3. **Team Metrics**: Track estimation accuracy over time
4. **Capacity Planning**: Analyze actual vs estimated effort

## 🔄 Workflow

### Daily/Weekly Usage
1. Start dashboard: \`npm start\`
2. Dashboard auto-fetches current month
3. View updated metrics and charts

### Monthly Analysis
1. Run full analysis: \`npm run analyze\`
2. Review generated reports in \`data/\`
3. Archive or export as needed

## 🌐 Ngrok Integration (Optional)

Share dashboard publicly:

1. Install ngrok: \`npm install -g ngrok\`
2. Configure authtoken in \`start-ngrok.sh\`
3. Run: \`npm run ngrok\`

## 🛠️ Development

### Scripts

- \`npm start\` - Start dashboard server
- \`npm run analyze\` - Run full analysis
- \`npm run fetch-current\` - Update current month
- \`npm run ngrok\` - Start ngrok tunnel

### Adding New Features

1. **New Analysis Logic**: Add to \`src/services/analyzer.js\`
2. **API Endpoints**: Modify \`src/services/jira.js\`
3. **Dashboard Views**: Update \`src/dashboard.js\`
4. **Configuration**: Edit \`src/config/index.js\`

## 📝 Data Files

### Generated Files

- **JSON Data** (\`data/story-point-all-updates-data.json\`): 
  - Structured data for dashboard
  - Month-by-month breakdown
  - Distribution and changes

- **Text Report** (\`data/story-point-all-updates-report.txt\`):
  - Human-readable report
  - Complete issue list
  - Summary statistics

### Data Structure

\`\`\`json
{
  "march2025": {
    "name": "March 2025",
    "totalIssues": 742,
    "totalChanges": 93,
    "byBaseAndTarget": {
      "1": { "2": 6, "3": 11 },
      "2": { "3": 4, "5": 1 }
    },
    "distribution": {
      "1": 113,
      "2": 29,
      "3": 348
    },
    "keys": [
      { "key": "OPT-123", "from": 2, "to": 5 }
    ]
  }
}
\`\`\`

## 🔐 Security

- API tokens stored in \`.env\` (gitignored)
- No credentials in source code
- Google credentials file excluded from git
- Data files excluded from version control

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Make changes
4. Test thoroughly
5. Submit pull request

## 📄 License

This project is for internal use. Modify as needed for your organization.

## 🐛 Troubleshooting

### Dashboard shows "No data found"
- Run \`npm run analyze\` first
- Check \`data/\` directory exists
- Verify \`.env\` configuration

### API Errors
- Verify \`JIRA_AUTH_TOKEN\` is valid
- Check network connectivity
- Confirm project key and permissions

### Port Already in Use
- Change \`DASHBOARD_PORT\` in \`.env\`
- Kill existing process: \`lsof -ti:3001 | xargs kill\`

## 📞 Support

For issues or questions, please open an issue on the repository.
