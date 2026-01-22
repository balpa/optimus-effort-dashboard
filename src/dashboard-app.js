const express = require('express');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const { updateCurrentMonth } = require('./services/data-updater');
const { escapeHtml } = require('./utils/date');
const { calculateAverageEffort } = require('./services/analyzer');

const app = express();

const loadData = (mode = 'dev') => {
  const jsonPath = mode === 'dev' ? 
    path.resolve(config.paths.devData) : 
    path.resolve(config.paths.qaData);
  return fs.existsSync(jsonPath) ? JSON.parse(fs.readFileSync(jsonPath, 'utf8')) : null;
};

const loadTextReport = (mode = 'dev') => {
  const reportPath = mode === 'dev' ? 
    path.resolve(config.paths.devReport) : 
    path.resolve(config.paths.qaReport);
  return fs.existsSync(reportPath) ? fs.readFileSync(reportPath, 'utf8') : '';
};

app.get('/', (req, res) => {
  const mode = req.query.mode || 'dev';
  const modeConfig = config.jira.modes[mode];
  
  if (!modeConfig) {
    return res.send(`<h1>Invalid mode: ${mode}. Valid modes are: dev, qa</h1>`);
  }
  
  const data = loadData(mode);
  
  if (!data) {
    return res.send(`<h1>No data found for ${mode.toUpperCase()} mode. Please run analyze-all${mode === 'qa' ? '-qa' : ''}.js first.</h1>`);
  }


  const selectedBase = req.query.base ? parseInt(req.query.base) : null;
  const months = Object.entries(data).map(([key, value]) => ({ key, ...value }));
  const BASE_POINTS = config.analysis.basePoints;
  const fieldName = modeConfig.fieldName;
  
  const allTransitions = new Set();
  months.forEach(m => {
    BASE_POINTS.forEach(base => {
      if (selectedBase === null || base === selectedBase) {
        Object.keys(m.byBaseAndTarget[base] || {}).forEach(target => {
          allTransitions.add(`${base}→${target}`);
        });
      }
    });
  });
  const sortedTransitions = Array.from(allTransitions).sort((a, b) => {
    const [aFrom, aTo] = a.split('→').map(Number);
    const [bFrom, bTo] = b.split('→').map(Number);
    return aFrom - bFrom || aTo - bTo;
  });

  const chartLabels = months.map(m => m.name);
  
  const filteredMonths = months.map(m => {
    let totalChanges = 0;
    const filteredByBaseAndTarget = {};
    
    BASE_POINTS.forEach(base => {
      if (selectedBase === null || base === selectedBase) {
        filteredByBaseAndTarget[base] = m.byBaseAndTarget[base] || {};
        Object.values(m.byBaseAndTarget[base] || {}).forEach(count => {
          totalChanges += count;
        });
      }
    });
    
    return {
      ...m,
      totalChanges,
      byBaseAndTarget: filteredByBaseAndTarget,
      keys: selectedBase === null 
        ? m.keys 
        : m.keys.filter(k => parseInt(k.from) === selectedBase)
    };
  });
  
  const totalChangesData = filteredMonths.map(m => m.totalChanges);
  const totalIssuesData = filteredMonths.map(m => m.totalIssues);

  const colors = ['#4CAF50', '#2196F3', '#FF9800', '#F44336', '#9C27B0', '#00BCD4', '#FFEB3B', '#795548', '#607D8B', '#E91E63', '#3F51B5', '#009688'];
  
  const transitionDatasets = sortedTransitions.map((transition, index) => {
    const [from, to] = transition.split('→');
    return {
      label: transition,
      data: filteredMonths.map(m => m.byBaseAndTarget[from]?.[to] || 0),
      backgroundColor: colors[index % colors.length],
      borderColor: colors[index % colors.length],
      borderWidth: 2,
      fill: false
    };
  });

  const grandTotalIssues = filteredMonths.reduce((sum, m) => sum + m.totalIssues, 0);
  const grandTotalChanges = filteredMonths.reduce((sum, m) => sum + m.totalChanges, 0);
  
  const grandTotalByTransition = {};
  sortedTransitions.forEach(transition => {
    const [from, to] = transition.split('→');
    grandTotalByTransition[transition] = filteredMonths.reduce((sum, m) => sum + (m.byBaseAndTarget[from]?.[to] || 0), 0);
  });

  const averageEffortData = filteredMonths.map(m => calculateAverageEffort(m));

  const totalEffortByPoint = {};
  filteredMonths.forEach(m => {
    if (!m.distribution) return;
    Object.entries(m.distribution).forEach(([points, count]) => {
      if (points !== 'null') {
        totalEffortByPoint[points] = (totalEffortByPoint[points] || 0) + count;
      }
    });
  });
  
  const pieLabels = Object.keys(totalEffortByPoint).sort((a, b) => parseFloat(a) - parseFloat(b));
  const pieData = pieLabels.map(p => totalEffortByPoint[p]);
  
  const heatmapData = [];
  const spCategories = ['1', '2', '3', '5', '8', '13+'];
  filteredMonths.forEach((month, mIdx) => {
    if (!month.distribution) return;
    spCategories.forEach((sp, spIdx) => {
      let count = 0;
      if (sp === '13+') {
        count = Object.entries(month.distribution)
          .filter(([k]) => k !== 'null' && parseFloat(k) >= 13)
          .reduce((sum, [, v]) => sum + v, 0);
      } else {
        count = month.distribution[sp] || 0;
      }
      if (count > 0) {
        heatmapData.push({ x: mIdx, y: spIdx, v: count });
      }
    });
  });
  
  const maxHeatValue = Math.max(...heatmapData.map(d => d.v), 1);

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${fieldName} Dashboard - ${mode.toUpperCase()} Mode</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, ${mode === 'dev' ? '#667eea 0%, #764ba2 100%' : '#11998e 0%, #38ef7d 100%'});
      min-height: 100vh;
      padding: 20px;
    }
    
    .container {
      max-width: 1400px;
      margin: 0 auto;
    }
    
    .mode-toggle {
      background: white;
      padding: 15px 30px;
      border-radius: 15px;
      box-shadow: 0 5px 15px rgba(0,0,0,0.1);
      margin-bottom: 20px;
      display: flex;
      justify-content: center;
      gap: 15px;
    }
    
    .mode-toggle a {
      padding: 12px 30px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 600;
      transition: all 0.3s ease;
      font-size: 1.1em;
    }
    
    .mode-toggle a.active {
      background: linear-gradient(135deg, ${mode === 'dev' ? '#667eea, #764ba2' : '#11998e, #38ef7d'});
      color: white;
      box-shadow: 0 5px 15px rgba(0,0,0,0.2);
    }
    
    .mode-toggle a:not(.active) {
      background: #f5f5f5;
      color: #666;
    }
    
    .mode-toggle a:not(.active):hover {
      background: #e0e0e0;
      transform: translateY(-2px);
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
    
    .stat-card.primary .value { color: ${mode === 'dev' ? '#667eea' : '#11998e'}; }
    .stat-card.success .value { color: #4CAF50; }
    .stat-card.warning .value { color: #FF9800; }
    
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
    <div class="mode-toggle">
      <a href="/?mode=dev${selectedBase !== null ? '&base=' + selectedBase : ''}" class="${mode === 'dev' ? 'active' : ''}">
        💻 DEV (Story Points)
      </a>
      <a href="/?mode=qa${selectedBase !== null ? '&base=' + selectedBase : ''}" class="${mode === 'qa' ? 'active' : ''}">
        🧪 QA (QA Efforts)
      </a>
    </div>
    
    <div class="header">
      <h1>📊 ${fieldName} Dashboard - ${mode.toUpperCase()} Mode</h1>
      <p>Analysis of ${fieldName} increased from 1/2/3/5 to higher values (March 2025 - ${filteredMonths[filteredMonths.length - 1]?.name || 'Present'})</p>
      
      <div style="margin-top: 20px;">
        <label style="font-size: 1em; color: #666; margin-right: 10px;">Filter by Base ${fieldName}:</label>
        <select onchange="window.location.href='/?mode=${mode}&base='+this.value" style="padding: 10px 20px; font-size: 1em; border-radius: 8px; border: 2px solid ${mode === 'dev' ? '#667eea' : '#11998e'}; background: white; cursor: pointer;">
          <option value="">All (1, 2, 3, 5)</option>
          <option value="1" ${selectedBase === 1 ? 'selected' : ''}>From 1</option>
          <option value="2" ${selectedBase === 2 ? 'selected' : ''}>From 2</option>
          <option value="3" ${selectedBase === 3 ? 'selected' : ''}>From 3</option>
          <option value="5" ${selectedBase === 5 ? 'selected' : ''}>From 5</option>
        </select>
      </div>
    </div>
    
      <div class="stats-grid">
      <div class="stat-card primary">
        <h3>Total Months</h3>
        <div class="value">${filteredMonths.length}</div>
      </div>
      <div class="stat-card success">
        <h3>Total Issues</h3>
        <div class="value">${grandTotalIssues.toLocaleString()}</div>
      </div>
      <div class="stat-card warning">
        <h3>Total Updates${selectedBase !== null ? ` (from ${selectedBase})` : ''}</h3>
        <div class="value">${grandTotalChanges}</div>
      </div>
    </div>
    
    <div class="tabs">
      <button class="tab active" onclick="showTab('overview')">📈 Overview</button>
      <button class="tab" onclick="showTab('distribution')">📊 Distribution</button>
      <button class="tab" onclick="showTab('averages')">📊 Effort Averages</button>
      <button class="tab" onclick="showTab('details')">📋 Details</button>
      <button class="tab" onclick="showTab('report')">📄 Full Report</button>
    </div>
    
    <div id="overview" class="tab-content active">
      <div class="chart-container">
        <h2 class="chart-title">Monthly Trend - Total Updates</h2>
        <canvas id="trendChart"></canvas>
      </div>
      
      <div class="chart-container">
        <h2 class="chart-title">Updates by Transition Type</h2>
        <canvas id="transitionChart"></canvas>
      </div>
      
      <div class="data-table">
        <h2 class="chart-title">Monthly Breakdown</h2>
        <table>
          <thead>
            <tr>
              <th>Month</th>
              <th>Total Issues</th>
              <th>Total Updates</th>
              <th>Update Rate</th>
              ${sortedTransitions.map(t => `<th>${t}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${filteredMonths.map(month => {
              const updateRate = month.totalIssues > 0 
                ? ((month.totalChanges / month.totalIssues) * 100).toFixed(2) 
                : '0.00';
              return `
              <tr>
                <td><strong>${month.name}</strong></td>
                <td>${month.totalIssues.toLocaleString()}</td>
                <td>${month.totalChanges}</td>
                <td><strong>${updateRate}%</strong></td>
                ${sortedTransitions.map(transition => {
                  const [from, to] = transition.split('→');
                  return `<td>${month.byBaseAndTarget[from]?.[to] || 0}</td>`;
                }).join('')}
              </tr>
            `}).join('')}
            <tr class="total-row">
              <td><strong>TOTAL</strong></td>
              <td>${grandTotalIssues.toLocaleString()}</td>
              <td>${grandTotalChanges}</td>
              <td><strong>${((grandTotalChanges / grandTotalIssues) * 100).toFixed(2)}%</strong></td>
              ${sortedTransitions.map(t => `<td>${grandTotalByTransition[t] || 0}</td>`).join('')}
            </tr>
          </tbody>
        </table>
      </div>
      
      <div class="data-table">
        <h2 class="chart-title">📊 Update Rate Analysis</h2>
        <table>
          <thead>
            <tr>
              <th>Month</th>
              <th>Total Issues</th>
              <th>Updated Tasks</th>
              <th>Update Rate</th>
              <th>Visualization</th>
            </tr>
          </thead>
          <tbody>
            ${filteredMonths.map(month => {
              const updateRate = month.totalIssues > 0 
                ? ((month.totalChanges / month.totalIssues) * 100).toFixed(2) 
                : '0.00';
              const barWidth = Math.min(parseFloat(updateRate) * 5, 100);
              return `
              <tr>
                <td><strong>${month.name}</strong></td>
                <td>${month.totalIssues.toLocaleString()}</td>
                <td>${month.totalChanges}</td>
                <td><strong style="color: ${parseFloat(updateRate) > 15 ? '#F44336' : parseFloat(updateRate) > 10 ? '#FF9800' : '#4CAF50'}">${updateRate}%</strong></td>
                <td>
                  <div style="background: #e0e0e0; border-radius: 5px; overflow: hidden; height: 20px; width: 100%;">
                    <div style="background: linear-gradient(90deg, #667eea, #764ba2); height: 100%; width: ${barWidth}%; transition: width 0.3s ease;"></div>
                  </div>
                </td>
              </tr>
            `}).join('')}
            <tr class="total-row">
              <td><strong>AVERAGE</strong></td>
              <td>${(grandTotalIssues / filteredMonths.length).toFixed(0)}</td>
              <td>${(grandTotalChanges / filteredMonths.length).toFixed(1)}</td>
              <td><strong>${((grandTotalChanges / grandTotalIssues) * 100).toFixed(2)}%</strong></td>
              <td>
                <div style="background: #e0e0e0; border-radius: 5px; overflow: hidden; height: 20px; width: 100%;">
                  <div style="background: linear-gradient(90deg, #FF9800, #F44336); height: 100%; width: ${Math.min(((grandTotalChanges / grandTotalIssues) * 100) * 5, 100)}%; transition: width 0.3s ease;"></div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    
    <div id="distribution" class="tab-content">
      <div class="data-table">
        <h2 class="chart-title">📊 ${fieldName} Distribution by Month</h2>
        <p style="text-align: center; color: #666; margin-bottom: 20px;">Shows how many tasks have each ${fieldName.toLowerCase()} value in each month</p>
        
        ${filteredMonths.map(month => {
          if (!month.distribution) return '';
          
          const dist = month.distribution;
          const sortedPoints = Object.keys(dist).sort((a, b) => {
            if (a === 'null') return -1;
            if (b === 'null') return 1;
            return parseFloat(a) - parseFloat(b);
          });
          
          const maxCount = Math.max(...Object.values(dist));
          
          return `
            <div style="margin-bottom: 40px; padding: 25px; background: #f8f9fa; border-radius: 10px; border-left: 4px solid #667eea;">
              <h3 style="color: #333; margin-bottom: 20px; font-size: 1.3em;">${month.name} - ${month.totalIssues} Total Issues</h3>
              
              <table style="width: 100%; margin-bottom: 0;">
                <thead>
                  <tr>
                    <th style="text-align: left; width: 150px;">${fieldName}</th>
                    <th style="text-align: center; width: 100px;">Count</th>
                    <th style="text-align: center; width: 100px;">Percentage</th>
                    <th style="text-align: left;">Distribution</th>
                  </tr>
                </thead>
                <tbody>
                  ${sortedPoints.map(points => {
                    const count = dist[points];
                    const percentage = ((count / month.totalIssues) * 100).toFixed(1);
                    const barWidth = (count / maxCount) * 100;
                    const label = points === 'null' ? `No ${fieldName}` : `${points} points`;
                    
                    return `
                      <tr>
                        <td><strong>${label}</strong></td>
                        <td style="text-align: center;">${count}</td>
                        <td style="text-align: center;"><strong>${percentage}%</strong></td>
                        <td>
                          <div style="background: #e0e0e0; border-radius: 5px; overflow: hidden; height: 25px; width: 100%; position: relative;">
                            <div style="background: linear-gradient(90deg, #667eea, #764ba2); height: 100%; width: ${barWidth}%; transition: width 0.3s ease; display: flex; align-items: center; padding: 0 10px;">
                              <span style="color: white; font-size: 0.85em; font-weight: 600;">${count}</span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          `;
        }).join('')}
      </div>
      
      <div class="data-table">
        <h2 class="chart-title">📈 ${fieldName} Distribution Trends</h2>
        <p style="text-align: center; color: #666; margin-bottom: 20px;">Comparison across all months</p>
        
        <table>
          <thead>
            <tr>
              <th>Month</th>
              <th>Total</th>
              <th>No SP</th>
              <th>1 point</th>
              <th>2 points</th>
              <th>3 points</th>
              <th>5 points</th>
              <th>8 points</th>
              <th>13+ points</th>
            </tr>
          </thead>
          <tbody>
            ${filteredMonths.map(month => {
              if (!month.distribution) return '';
              const dist = month.distribution;
              
              const noSP = dist.null || 0;
              const sp1 = dist['1'] || 0;
              const sp2 = dist['2'] || 0;
              const sp3 = dist['3'] || 0;
              const sp5 = dist['5'] || 0;
              const sp8 = dist['8'] || 0;
              const sp13plus = Object.entries(dist)
                .filter(([k]) => k !== 'null' && parseFloat(k) >= 13)
                .reduce((sum, [, v]) => sum + v, 0);
              
              return `
                <tr>
                  <td><strong>${month.name}</strong></td>
                  <td>${month.totalIssues}</td>
                  <td>${noSP} <span style="color: #999;">(${((noSP/month.totalIssues)*100).toFixed(1)}%)</span></td>
                  <td>${sp1} <span style="color: #999;">(${((sp1/month.totalIssues)*100).toFixed(1)}%)</span></td>
                  <td>${sp2} <span style="color: #999;">(${((sp2/month.totalIssues)*100).toFixed(1)}%)</span></td>
                  <td>${sp3} <span style="color: #999;">(${((sp3/month.totalIssues)*100).toFixed(1)}%)</span></td>
                  <td>${sp5} <span style="color: #999;">(${((sp5/month.totalIssues)*100).toFixed(1)}%)</span></td>
                  <td>${sp8} <span style="color: #999;">(${((sp8/month.totalIssues)*100).toFixed(1)}%)</span></td>
                  <td>${sp13plus} <span style="color: #999;">(${((sp13plus/month.totalIssues)*100).toFixed(1)}%)</span></td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
    
    <div id="averages" class="tab-content">
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px;">
        <div class="chart-container">
          <h2 class="chart-title">📊 Average Effort Trend</h2>
          <canvas id="averageEffortChart"></canvas>
        </div>
        
        <div class="chart-container">
          <h2 class="chart-title">🎯 Effort Distribution Pie</h2>
          <canvas id="effortPieChart"></canvas>
        </div>
      </div>
      
      <div class="data-table">
        <h2 class="chart-title">📈 Effort Metrics by Month</h2>
        <table>
          <thead>
            <tr>
              <th>Month</th>
              <th>Total Tasks</th>
              <th>Tasks with SP</th>
              <th>Average Effort</th>
              <th>Total Effort</th>
              <th>Top ${fieldName}</th>
            </tr>
          </thead>
          <tbody>
            ${filteredMonths.map((month, idx) => {
              if (!month.distribution) return '';
              const dist = month.distribution;
              
              const tasksWithSP = Object.entries(dist)
                .filter(([k]) => k !== 'null')
                .reduce((sum, [, v]) => sum + v, 0);
              const tasksWithoutSP = dist.null || 0;
              
              let totalEffort = 0;
              Object.entries(dist).forEach(([points, count]) => {
                if (points !== 'null') {
                  totalEffort += parseFloat(points) * count;
                }
              });
              
              const avgEffort = tasksWithSP > 0 ? (totalEffort / tasksWithSP).toFixed(2) : '0.00';
              
              const mostCommon = Object.entries(dist)
                .filter(([k]) => k !== 'null')
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3)
                .map(([p, c]) => `${p}SP (${c})`)
                .join(', ');
              
              const avgColor = parseFloat(avgEffort) > 4 ? '#F44336' : parseFloat(avgEffort) > 3 ? '#FF9800' : '#4CAF50';
              
              return `
                <tr>
                  <td><strong>${month.name}</strong></td>
                  <td>${month.totalIssues}</td>
                  <td>${tasksWithSP} <span style="color: #999;">(${((tasksWithSP/month.totalIssues)*100).toFixed(1)}%)</span></td>
                  <td><strong style="color: ${avgColor}; font-size: 1.2em;">${avgEffort}</strong></td>
                  <td>${totalEffort.toLocaleString()} SP</td>
                  <td style="font-size: 0.9em;">${mostCommon}</td>
                </tr>
              `;
            }).join('')}
            <tr class="total-row">
              <td><strong>OVERALL</strong></td>
              <td>${grandTotalIssues.toLocaleString()}</td>
              <td>${filteredMonths.reduce((sum, m) => {
                if (!m.distribution) return sum;
                return sum + Object.entries(m.distribution).filter(([k]) => k !== 'null').reduce((s, [, v]) => s + v, 0);
              }, 0)}</td>
              <td><strong style="color: #667eea; font-size: 1.2em;">${(
                filteredMonths.reduce((sum, m) => sum + calculateAverageEffort(m), 0) / filteredMonths.filter(m => m.distribution).length
              ).toFixed(2)}</strong></td>
              <td colspan="2"></td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <div class="chart-container">
        <h2 class="chart-title">📊 Stacked Effort Distribution</h2>
        <canvas id="effortDistributionChart"></canvas>
      </div>
    </div>
    
    <div id="details" class="tab-content">
      <div class="data-table">
        ${filteredMonths.map(month => {
          if (month.keys.length === 0) return '';
          
          const keysByTransition = {};
          month.keys.forEach(({ key, from, to }) => {
            const transition = `${from}→${to}`;
            if (!keysByTransition[transition]) keysByTransition[transition] = [];
            keysByTransition[transition].push(key);
          });
          
          return `
            <div class="month-detail">
              <h3>${month.name} - ${month.totalChanges} Updates</h3>
              ${Object.keys(keysByTransition).sort((a, b) => {
                const [aFrom, aTo] = a.split('→').map(Number);
                const [bFrom, bTo] = b.split('→').map(Number);
                return aFrom - bFrom || aTo - bTo;
              }).map(transition => `
                <div class="change-group">
                  <h4>${transition} (${keysByTransition[transition].length} issues)</h4>
                  <div class="issue-keys">
                    ${keysByTransition[transition].map(key => 
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
    function showTab(tabName) {
      document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
      
      event.target.classList.add('active');
      document.getElementById(tabName).classList.add('active');
    }
    
    const trendCtx = document.getElementById('trendChart').getContext('2d');
    new Chart(trendCtx, {
      type: 'line',
      data: {
        labels: ${JSON.stringify(chartLabels)},
        datasets: [
          {
            label: 'Total Updates',
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
              text: 'Updates'
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
    
    const transitionCtx = document.getElementById('transitionChart').getContext('2d');
    new Chart(transitionCtx, {
      type: 'bar',
      data: {
        labels: ${JSON.stringify(chartLabels)},
        datasets: ${JSON.stringify(transitionDatasets)}
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
              text: 'Number of Updates'
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
    
    const averageEffortCtx = document.getElementById('averageEffortChart').getContext('2d');
    new Chart(averageEffortCtx, {
      type: 'line',
      data: {
        labels: ${JSON.stringify(chartLabels)},
        datasets: [
          {
            label: 'Average Effort',
            data: ${JSON.stringify(averageEffortData)},
            borderColor: '#667eea',
            backgroundColor: 'rgba(102, 126, 234, 0.3)',
            borderWidth: 4,
            fill: true,
            tension: 0.4,
            pointRadius: 8,
            pointHoverRadius: 12,
            pointBackgroundColor: '#667eea',
            pointBorderColor: '#fff',
            pointBorderWidth: 3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Average ${fieldName}',
              font: { size: 14, weight: 'bold' }
            },
            grid: {
              color: 'rgba(0, 0, 0, 0.05)'
            }
          },
          x: {
            grid: {
              display: false
            }
          }
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: 12,
            titleFont: { size: 14 },
            bodyFont: { size: 13 },
            callbacks: {
              label: function(context) {
                return 'Average: ' + context.parsed.y.toFixed(2) + ' SP';
              }
            }
          }
        }
      }
    });
    
    const effortPieCtx = document.getElementById('effortPieChart').getContext('2d');
    const pieLabels = ${JSON.stringify(pieLabels)};
    const pieData = ${JSON.stringify(pieData)};
    const pieColors = ['#4CAF50', '#2196F3', '#FF9800', '#F44336', '#9C27B0', '#00BCD4', '#FFEB3B', '#795548', '#607D8B', '#E91E63'];
    
    new Chart(effortPieCtx, {
      type: 'doughnut',
      data: {
        labels: pieLabels.map(p => p + ' SP'),
        datasets: [{
          data: pieData,
          backgroundColor: pieColors,
          borderColor: '#fff',
          borderWidth: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              padding: 15,
              font: { size: 12 }
            }
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: 12,
            callbacks: {
              label: function(context) {
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const percentage = ((context.parsed / total) * 100).toFixed(1);
                return context.label + ': ' + context.parsed + ' tasks (' + percentage + '%)';
              }
            }
          }
        }
      }
    });
    
    const effortDistCtx = document.getElementById('effortDistributionChart').getContext('2d');
    new Chart(effortDistCtx, {
      type: 'bar',
      data: {
        labels: ${JSON.stringify(chartLabels)},
        datasets: [
          {
            label: '1 point',
            data: ${JSON.stringify(filteredMonths.map(m => m.distribution?.['1'] || 0))},
            backgroundColor: '#4CAF50',
            borderWidth: 0
          },
          {
            label: '2 points',
            data: ${JSON.stringify(filteredMonths.map(m => m.distribution?.['2'] || 0))},
            backgroundColor: '#2196F3',
            borderWidth: 0
          },
          {
            label: '3 points',
            data: ${JSON.stringify(filteredMonths.map(m => m.distribution?.['3'] || 0))},
            backgroundColor: '#FF9800',
            borderWidth: 0
          },
          {
            label: '5 points',
            data: ${JSON.stringify(filteredMonths.map(m => m.distribution?.['5'] || 0))},
            backgroundColor: '#F44336',
            borderWidth: 0
          },
          {
            label: '8 points',
            data: ${JSON.stringify(filteredMonths.map(m => m.distribution?.['8'] || 0))},
            backgroundColor: '#9C27B0',
            borderWidth: 0
          },
          {
            label: '13+ points',
            data: ${JSON.stringify(filteredMonths.map(m => {
              if (!m.distribution) return 0;
              return Object.entries(m.distribution)
                .filter(([k]) => k !== 'null' && parseFloat(k) >= 13)
                .reduce((sum, [, v]) => sum + v, 0);
            }))},
            backgroundColor: '#607D8B',
            borderWidth: 0
          }
        ]
      },
      options: {
        responsive: true,
        scales: {
          x: {
            stacked: true,
            grid: { display: false }
          },
          y: {
            stacked: true,
            title: {
              display: true,
              text: 'Number of Tasks',
              font: { size: 14, weight: 'bold' }
            },
            grid: {
              color: 'rgba(0, 0, 0, 0.05)'
            }
          }
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              padding: 15,
              font: { size: 12 }
            }
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: 12
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

// Export the Express app for Vercel serverless
module.exports = app;
