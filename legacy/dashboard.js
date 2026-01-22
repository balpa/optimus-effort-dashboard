const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

const loadData = () => {
  const jsonPath = path.join(__dirname, 'story-point-2-to-higher-data.json');
  return fs.existsSync(jsonPath) ? JSON.parse(fs.readFileSync(jsonPath, 'utf8')) : null;
};

const loadTextReport = () => {
  const reportPath = path.join(__dirname, 'story-point-2-to-higher-report.txt');
  return fs.existsSync(reportPath) ? fs.readFileSync(reportPath, 'utf8') : '';
};

const escapeHtml = (text) => text
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

app.get('/', (req, res) => {
  const data = loadData();
  
  if (!data) {
    return res.send('<h1>No data found. Please run script.js first.</h1>');
  }

  const months = Object.entries(data).map(([key, value]) => ({ key, ...value }));
  const allTargets = [...new Set(months.flatMap(m => Object.keys(m.byTarget || {})))];
  const sortedTargets = allTargets.sort((a, b) => parseFloat(a) - parseFloat(b));

  const chartLabels = months.map(m => m.name);
  const totalChangesData = months.map(m => m.totalChanges);
  const totalIssuesData = months.map(m => m.totalIssues);

  const colors = ['#4CAF50', '#2196F3', '#FF9800', '#F44336', '#9C27B0', '#00BCD4', '#FFEB3B', '#795548', '#607D8B'];
  const targetDatasets = sortedTargets.map((target, index) => ({
    label: `2 → ${target}`,
    data: months.map(m => m.byTarget[target] || 0),
    backgroundColor: colors[index % colors.length],
    borderColor: colors[index % colors.length],
    borderWidth: 2,
    fill: false
  }));

  const grandTotalIssues = months.reduce((sum, m) => sum + m.totalIssues, 0);
  const grandTotalChanges = months.reduce((sum, m) => sum + m.totalChanges, 0);
  const grandTotalByTarget = months.reduce((acc, m) => {
    Object.entries(m.byTarget || {}).forEach(([target, count]) => {
      acc[target] = (acc[target] || 0) + count;
    });
    return acc;
  }, {});

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Story Point Changes Dashboard</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
    }
    
    .container {
      max-width: 1400px;
      margin: 0 auto;
    }
    
    .header {
      background: white;
      padding: 30px;
      border-radius: 15px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.2);
      margin-bottom: 30px;
      text-align: center;
    }
    
    .header h1 {
      color: #333;
      font-size: 2.5em;
      margin-bottom: 10px;
    }
    
    .header p {
      color: #666;
      font-size: 1.1em;
    }
    
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    
    .stat-card {
      background: white;
      padding: 25px;
      border-radius: 15px;
      box-shadow: 0 5px 15px rgba(0,0,0,0.1);
      text-align: center;
      transition: transform 0.3s ease;
    }
    
    .stat-card:hover {
      transform: translateY(-5px);
      box-shadow: 0 10px 25px rgba(0,0,0,0.15);
    }
    
    .stat-card h3 {
      color: #666;
      font-size: 0.9em;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 10px;
    }
    
    .stat-card .value {
      color: #333;
      font-size: 2.5em;
      font-weight: bold;
    }
    
    .stat-card.primary .value { color: #667eea; }
    .stat-card.success .value { color: #4CAF50; }
    .stat-card.warning .value { color: #FF9800; }
    .stat-card.info .value { color: #2196F3; }
    
    .chart-container {
      background: white;
      padding: 30px;
      border-radius: 15px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.2);
      margin-bottom: 30px;
      position: relative;
    }
    
    .chart-title {
      font-size: 1.5em;
      color: #333;
      margin-bottom: 20px;
      text-align: center;
    }
    
    .data-table {
      background: white;
      padding: 30px;
      border-radius: 15px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.2);
      margin-bottom: 30px;
      overflow-x: auto;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
    }
    
    th, td {
      padding: 15px;
      text-align: left;
      border-bottom: 1px solid #eee;
    }
    
    th {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      font-weight: 600;
      text-transform: uppercase;
      font-size: 0.85em;
      letter-spacing: 1px;
      position: sticky;
      top: 0;
    }
    
    tr:hover {
      background: #f5f5f5;
    }
    
    .total-row {
      background: #fff3cd;
      font-weight: bold;
    }
    
    .total-row:hover {
      background: #ffe69c;
    }
    
    .report-viewer {
      background: white;
      padding: 30px;
      border-radius: 15px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.2);
      margin-bottom: 30px;
    }
    
    .report-content {
      background: #f8f9fa;
      padding: 20px;
      border-radius: 10px;
      font-family: 'Courier New', monospace;
      font-size: 0.9em;
      white-space: pre-wrap;
      max-height: 600px;
      overflow-y: auto;
      border: 1px solid #dee2e6;
    }
    
    .tabs {
      display: flex;
      gap: 10px;
      margin-bottom: 20px;
      border-bottom: 2px solid #eee;
    }
    
    .tab {
      padding: 12px 24px;
      background: #f5f5f5;
      border: none;
      cursor: pointer;
      font-size: 1em;
      font-weight: 600;
      border-radius: 8px 8px 0 0;
      transition: all 0.3s ease;
    }
    
    .tab:hover {
      background: #e0e0e0;
    }
    
    .tab.active {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }
    
    .tab-content {
      display: none;
    }
    
    .tab-content.active {
      display: block;
    }
    
    .month-detail {
      margin-bottom: 30px;
      padding: 20px;
      background: #f8f9fa;
      border-radius: 10px;
      border-left: 4px solid #667eea;
    }
    
    .month-detail h3 {
      color: #333;
      margin-bottom: 15px;
      font-size: 1.3em;
    }
    
    .change-group {
      margin-bottom: 15px;
    }
    
    .change-group h4 {
      color: #666;
      margin-bottom: 8px;
      font-size: 1em;
    }
    
    .issue-keys {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    
    .issue-key {
      background: #667eea;
      color: white;
      padding: 5px 12px;
      border-radius: 5px;
      font-size: 0.85em;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    
    .issue-key:hover {
      background: #764ba2;
      transform: scale(1.05);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 Story Point Changes Dashboard</h1>
      <p>Analysis of Story Points changed from 2 to higher values (March 2025 - ${months[months.length - 1]?.name || 'Present'})</p>
    </div>
    
    <div class="stats-grid">
      <div class="stat-card primary">
        <h3>Total Months</h3>
        <div class="value">${months.length}</div>
      </div>
      <div class="stat-card success">
        <h3>Total Issues</h3>
        <div class="value">${grandTotalIssues.toLocaleString()}</div>
      </div>
      <div class="stat-card warning">
        <h3>Total Changes</h3>
        <div class="value">${grandTotalChanges}</div>
      </div>
    </div>
    
    <div class="tabs">
      <button class="tab active" onclick="showTab('overview')">📈 Overview</button>
      <button class="tab" onclick="showTab('details')">📋 Details</button>
      <button class="tab" onclick="showTab('report')">📄 Full Report</button>
    </div>
    
    <div id="overview" class="tab-content active">
      <div class="chart-container">
        <h2 class="chart-title">Monthly Trend - Total Changes</h2>
        <canvas id="trendChart"></canvas>
      </div>
      
      <div class="chart-container">
        <h2 class="chart-title">Changes by Target Story Point</h2>
        <canvas id="targetChart"></canvas>
      </div>
      
      <div class="data-table">
        <h2 class="chart-title">Monthly Breakdown</h2>
        <table>
          <thead>
            <tr>
              <th>Month</th>
              <th>Total Issues</th>
              <th>Total Changes</th>
              <th>Change Rate</th>
              ${sortedTargets.map(t => `<th>2→${t}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${months.map(month => {
              const changeRate = month.totalIssues > 0 
                ? ((month.totalChanges / month.totalIssues) * 100).toFixed(2) 
                : '0.00';
              return `
              <tr>
                <td><strong>${month.name}</strong></td>
                <td>${month.totalIssues.toLocaleString()}</td>
                <td>${month.totalChanges}</td>
                <td><strong>${changeRate}%</strong></td>
                ${sortedTargets.map(t => `<td>${month.byTarget[t] || 0}</td>`).join('')}
              </tr>
            `}).join('')}
            <tr class="total-row">
              <td><strong>TOTAL</strong></td>
              <td>${grandTotalIssues.toLocaleString()}</td>
              <td>${grandTotalChanges}</td>
              <td><strong>${((grandTotalChanges / grandTotalIssues) * 100).toFixed(2)}%</strong></td>
              ${sortedTargets.map(t => `<td>${grandTotalByTarget[t] || 0}</td>`).join('')}
            </tr>
          </tbody>
        </table>
      </div>
      
      <div class="data-table">
        <h2 class="chart-title">📊 Change Rate Analysis</h2>
        <table>
          <thead>
            <tr>
              <th>Month</th>
              <th>Total Issues</th>
              <th>Changed Tasks</th>
              <th>Change Rate</th>
              <th>Visualization</th>
            </tr>
          </thead>
          <tbody>
            ${months.map(month => {
              const changeRate = month.totalIssues > 0 
                ? ((month.totalChanges / month.totalIssues) * 100).toFixed(2) 
                : '0.00';
              const barWidth = Math.min(parseFloat(changeRate) * 10, 100);
              return `
              <tr>
                <td><strong>${month.name}</strong></td>
                <td>${month.totalIssues.toLocaleString()}</td>
                <td>${month.totalChanges}</td>
                <td><strong style="color: ${parseFloat(changeRate) > 5 ? '#F44336' : parseFloat(changeRate) > 2 ? '#FF9800' : '#4CAF50'}">${changeRate}%</strong></td>
                <td>
                  <div style="background: #e0e0e0; border-radius: 5px; overflow: hidden; height: 20px; width: 100%;">
                    <div style="background: linear-gradient(90deg, #667eea, #764ba2); height: 100%; width: ${barWidth}%; transition: width 0.3s ease;"></div>
                  </div>
                </td>
              </tr>
            `}).join('')}
            <tr class="total-row">
              <td><strong>AVERAGE</strong></td>
              <td>${(grandTotalIssues / months.length).toFixed(0)}</td>
              <td>${(grandTotalChanges / months.length).toFixed(1)}</td>
              <td><strong>${((grandTotalChanges / grandTotalIssues) * 100).toFixed(2)}%</strong></td>
              <td>
                <div style="background: #e0e0e0; border-radius: 5px; overflow: hidden; height: 20px; width: 100%;">
                  <div style="background: linear-gradient(90deg, #FF9800, #F44336); height: 100%; width: ${Math.min(((grandTotalChanges / grandTotalIssues) * 100) * 10, 100)}%; transition: width 0.3s ease;"></div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    
    <div id="details" class="tab-content">
      <div class="data-table">
        ${months.map(month => {
          if (month.keys.length === 0) return '';
          
          const keysByTarget = {};
          month.keys.forEach(({ key, to }) => {
            if (!keysByTarget[to]) keysByTarget[to] = [];
            keysByTarget[to].push(key);
          });
          
          return `
            <div class="month-detail">
              <h3>${month.name} - ${month.totalChanges} Changes</h3>
              ${Object.keys(keysByTarget).sort((a, b) => parseFloat(a) - parseFloat(b)).map(target => `
                <div class="change-group">
                  <h4>2 → ${target} (${keysByTarget[target].length} issues)</h4>
                  <div class="issue-keys">
                    ${keysByTarget[target].map(key => 
                      `<span class="issue-key" onclick="window.open('https://winsider.atlassian.net/browse/${key}', '_blank')">${key}</span>`
                    ).join('')}
                  </div>
                </div>
              `).join('')}
            </div>
          `;
        }).join('')}
      </div>
    </div>
    
    <div id="report" class="tab-content">
      <div class="report-viewer">
        <h2 class="chart-title">Full Text Report</h2>
        <div class="report-content">${escapeHtml(loadTextReport())}</div>
      </div>
    </div>
  </div>
  
  <script>
    // Tab switching
    function showTab(tabName) {
      document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
      
      event.target.classList.add('active');
      document.getElementById(tabName).classList.add('active');
    }
    
    // Trend Chart
    const trendCtx = document.getElementById('trendChart').getContext('2d');
    new Chart(trendCtx, {
      type: 'line',
      data: {
        labels: ${JSON.stringify(chartLabels)},
        datasets: [
          {
            label: 'Total Changes',
            data: ${JSON.stringify(totalChangesData)},
            borderColor: '#667eea',
            backgroundColor: 'rgba(102, 126, 234, 0.1)',
            borderWidth: 3,
            fill: true,
            tension: 0.4
          },
          {
            label: 'Total Issues',
            data: ${JSON.stringify(totalIssuesData)},
            borderColor: '#4CAF50',
            backgroundColor: 'rgba(76, 175, 80, 0.1)',
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        scales: {
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            title: {
              display: true,
              text: 'Changes'
            }
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            title: {
              display: true,
              text: 'Issues'
            },
            grid: {
              drawOnChartArea: false,
            },
          },
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
          }
        }
      }
    });
    
    // Target Chart
    const targetCtx = document.getElementById('targetChart').getContext('2d');
    new Chart(targetCtx, {
      type: 'bar',
      data: {
        labels: ${JSON.stringify(chartLabels)},
        datasets: ${JSON.stringify(targetDatasets)}
      },
      options: {
        responsive: true,
        scales: {
          x: {
            stacked: true,
          },
          y: {
            stacked: true,
            title: {
              display: true,
              text: 'Number of Changes'
            }
          }
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
          }
        }
      }
    });
  </script>
</body>
</html>
  `;

  res.send(html);
});

app.listen(PORT, () => {
  console.log(`\n🚀 Dashboard running at http://localhost:${PORT}`);
  console.log(`📊 Open your browser to view the interactive dashboard\n`);
});
