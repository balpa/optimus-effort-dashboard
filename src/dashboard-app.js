const express = require('express');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const { updateCurrentMonth } = require('./services/data-updater');
const { escapeHtml } = require('./utils/date');
const { calculateAverageEffort } = require('./services/analyzer');

const app = express();

//TODO: mobile responsive design

const PROJECT_ROOT = path.join(__dirname, '..');

const loadData = (mode = 'dev', direction = 'up') => {
  const jsonPath = mode === 'dev' ? 
    (direction === 'up' ? 
      path.join(PROJECT_ROOT, 'data', 'story-point-all-updates-up-data.json') :
      path.join(PROJECT_ROOT, 'data', 'story-point-all-updates-down-data.json')
    ) : 
    mode === 'qa' ?
    (direction === 'up' ?
      path.join(PROJECT_ROOT, 'data', 'qa-efforts-all-updates-up-data.json') :
      path.join(PROJECT_ROOT, 'data', 'qa-efforts-all-updates-down-data.json')
    ) :
    (direction === 'up' ?
      path.join(PROJECT_ROOT, 'data', 'qa-board-all-updates-up-data.json') :
      path.join(PROJECT_ROOT, 'data', 'qa-board-all-updates-down-data.json')
    );
  
  return fs.existsSync(jsonPath) ? JSON.parse(fs.readFileSync(jsonPath, 'utf8')) : null;
};

const loadTextReport = (mode = 'dev', direction = 'up') => {
  const reportPath = mode === 'dev' ? 
    (direction === 'up' ?
      path.join(PROJECT_ROOT, 'data', 'story-point-all-updates-up-report.txt') :
      path.join(PROJECT_ROOT, 'data', 'story-point-all-updates-down-report.txt')
    ) : 
    mode === 'qa' ?
    (direction === 'up' ?
      path.join(PROJECT_ROOT, 'data', 'qa-efforts-all-updates-up-report.txt') :
      path.join(PROJECT_ROOT, 'data', 'qa-efforts-all-updates-down-report.txt')
    ) :
    (direction === 'up' ?
      path.join(PROJECT_ROOT, 'data', 'qa-board-all-updates-up-report.txt') :
      path.join(PROJECT_ROOT, 'data', 'qa-board-all-updates-down-report.txt')
    );
  return fs.existsSync(reportPath) ? fs.readFileSync(reportPath, 'utf8') : '';
};

app.get('/', (req, res) => {
  const mode = req.query.mode || 'dev';
  const direction = req.query.direction || 'up';
  const modeConfig = config.jira.modes[mode];
  
  if (!modeConfig) {
    return res.send(`<h1>Invalid mode: ${mode}. Valid modes are: dev, qa</h1>`);
  }
  
  const data = loadData(mode, direction);
  
  if (!data) {
    return res.send(`<h1>No data found for ${mode.toUpperCase()} mode with direction: ${direction}. Please run analyze-all${mode === 'qa' ? '-qa' : ''}.js first.</h1>`);
  }


  const selectedBase = req.query.base ? parseInt(req.query.base) : null;
  const months = Object.entries(data).map(([key, value]) => ({ key, ...value }));
  const BASE_POINTS = modeConfig.basePoints || config.analysis.basePoints;
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

  const colors = ['#ff4757', '#00ffff', '#feca57', '#2ed573', '#ff6348', '#1e90ff', '#ff79c6', '#50fa7b', '#ffb86c', '#8be9fd', '#bd93f9', '#ff5555'];
  
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
  <title>${fieldName} Dashboard</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Staatliches&display=swap" rel="stylesheet">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Staatliches', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #1a1a2e;
      background-image: 
        repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px),
        linear-gradient(135deg, #0f0f1e 0%, #1a1a2e 50%, #0f0f1e 100%);
      min-height: 100vh;
      padding: 20px;
      color: #fff;
    }
    
    .container {
      max-width: 1400px;
      margin: 0 auto;
    }
    
    .mode-toggle {
      background: #16213e;
      padding: 15px 30px;
      border-radius: 20px;
      box-shadow: 
        0 0 20px ${mode === 'dev' ? 'rgba(255, 71, 87, 0.5)' : mode === 'qa' ? 'rgba(0, 255, 255, 0.5)' : 'rgba(254, 202, 87, 0.5)'},
        inset 0 0 20px rgba(0,0,0,0.3);
      margin-bottom: 30px;
      display: flex;
      justify-content: center;
      gap: 15px;
      border: 2px solid ${mode === 'dev' ? '#ff4757' : mode === 'qa' ? '#00ffff' : '#feca57'};
    }
    
    .mode-toggle a {
      padding: 12px 30px;
      border-radius: 15px;
      text-decoration: none;
      font-weight: 600;
      transition: all 0.3s ease;
      font-size: 1.2em;
      letter-spacing: 2px;
      text-transform: uppercase;
      font-family: 'Bebas Neue', sans-serif;
    }
    
    .mode-toggle a.active {
      background: ${mode === 'dev' ? '#ff4757' : mode === 'qa' ? '#00ffff' : '#feca57'};
      color: #1a1a2e;
      box-shadow: 
        0 0 30px ${mode === 'dev' ? 'rgba(255, 71, 87, 0.8)' : mode === 'qa' ? 'rgba(0, 255, 255, 0.8)' : 'rgba(254, 202, 87, 0.8)'},
        0 0 60px ${mode === 'dev' ? 'rgba(255, 71, 87, 0.4)' : mode === 'qa' ? 'rgba(0, 255, 255, 0.4)' : 'rgba(254, 202, 87, 0.4)'};
      animation: neonPulse 2s ease-in-out infinite;
    }
    
    @keyframes neonPulse {
      0%, 100% { 
        box-shadow: 
          0 0 20px ${mode === 'dev' ? 'rgba(255, 71, 87, 0.8)' : mode === 'qa' ? 'rgba(0, 255, 255, 0.8)' : 'rgba(254, 202, 87, 0.8)'},
          0 0 40px ${mode === 'dev' ? 'rgba(255, 71, 87, 0.4)' : mode === 'qa' ? 'rgba(0, 255, 255, 0.4)' : 'rgba(254, 202, 87, 0.4)'};
      }
      50% { 
        box-shadow: 
          0 0 30px ${mode === 'dev' ? 'rgba(255, 71, 87, 1)' : mode === 'qa' ? 'rgba(0, 255, 255, 1)' : 'rgba(254, 202, 87, 1)'},
          0 0 60px ${mode === 'dev' ? 'rgba(255, 71, 87, 0.6)' : mode === 'qa' ? 'rgba(0, 255, 255, 0.6)' : 'rgba(254, 202, 87, 0.6)'};
      }
    }
    
    .mode-toggle a:not(.active) {
      background: transparent;
      color: #ffffff80;
      border: 2px solid #ffffff30;
    }
    
    .mode-toggle a:not(.active):hover {
      background: #ffffff10;
      color: #fff;
      border-color: #ffffff60;
      transform: translateY(-2px);
    }
    
    .direction-toggle {
      background: #16213e;
      padding: 15px 30px;
      border-radius: 20px;
      box-shadow: 
        0 0 20px ${mode === 'dev' ? 'rgba(255, 71, 87, 0.5)' : mode === 'qa' ? 'rgba(0, 255, 255, 0.5)' : 'rgba(254, 202, 87, 0.5)'},
        inset 0 0 20px rgba(0,0,0,0.3);
      margin-bottom: 30px;
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 15px;
      border: 2px solid ${mode === 'dev' ? '#ff4757' : mode === 'qa' ? '#00ffff' : '#feca57'};
    }
    
    .direction-toggle span {
      font-size: 1.2em;
      letter-spacing: 2px;
      text-transform: uppercase;
      font-family: 'Bebas Neue', sans-serif;
      color: #feca57;
    }
    
    .direction-toggle a {
      padding: 12px 30px;
      border-radius: 15px;
      text-decoration: none;
      font-weight: 600;
      transition: all 0.3s ease;
      font-size: 1.2em;
      letter-spacing: 2px;
      text-transform: uppercase;
      font-family: 'Bebas Neue', sans-serif;
    }
    
    .direction-toggle a.active {
      background: ${mode === 'dev' ? '#ff4757' : mode === 'qa' ? '#00ffff' : '#feca57'};
      color: #1a1a2e;
      box-shadow: 
        0 0 30px ${mode === 'dev' ? 'rgba(255, 71, 87, 0.8)' : mode === 'qa' ? 'rgba(0, 255, 255, 0.8)' : 'rgba(254, 202, 87, 0.8)'},
        0 0 60px ${mode === 'dev' ? 'rgba(255, 71, 87, 0.4)' : mode === 'qa' ? 'rgba(0, 255, 255, 0.4)' : 'rgba(254, 202, 87, 0.4)'};
    }
    
    .direction-toggle a:not(.active) {
      background: transparent;
      color: #ffffff80;
      border: 2px solid #ffffff30;
    }
    
    .direction-toggle a:not(.active):hover {
      background: #ffffff10;
      color: #fff;
      border-color: #ffffff60;
      transform: translateY(-2px);
    }
    
    .header {
      background: linear-gradient(135deg, #16213e 0%, #0f3460 100%);
      padding: 40px;
      border-radius: 20px;
      box-shadow: 
        0 0 40px ${mode === 'dev' ? 'rgba(255, 71, 87, 0.3)' : mode === 'qa' ? 'rgba(0, 255, 255, 0.3)' : 'rgba(254, 202, 87, 0.3)'},
        inset 0 0 30px rgba(0,0,0,0.3);
      margin-bottom: 30px;
      text-align: center;
      border: 3px solid ${mode === 'dev' ? '#ff4757' : mode === 'qa' ? '#00ffff' : '#feca57'};
      position: relative;
      overflow: hidden;
    }
    
    .header::before {
      content: '';
      position: absolute;
      top: -50%;
      left: -50%;
      width: 200%;
      height: 200%;
      background: linear-gradient(
        45deg,
        transparent,
        ${mode === 'dev' ? 'rgba(255, 71, 87, 0.1)' : mode === 'qa' ? 'rgba(0, 255, 255, 0.1)' : 'rgba(254, 202, 87, 0.1)'},
        transparent
      );
    }
    
    .header h1 {
      color: ${mode === 'dev' ? '#ff4757' : mode === 'qa' ? '#00ffff' : '#feca57'};
      font-size: 3.5em;
      margin-bottom: 15px;
      font-family: 'Bebas Neue', sans-serif;
      letter-spacing: 5px;
      text-transform: uppercase;
      text-shadow: 0 0 10px ${mode === 'dev' ? 'rgba(255, 71, 87, 0.3)' : mode === 'qa' ? 'rgba(0, 255, 255, 0.3)' : 'rgba(254, 202, 87, 0.3)'};
      position: relative;
      z-index: 1;
    }
    
    .header p {
      color: #feca57;
      font-size: 1.3em;
      letter-spacing: 3px;
      text-shadow: none;
      position: relative;
      z-index: 1;
    }
    
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    
    .stat-card {
      background: linear-gradient(135deg, #16213e 0%, #0f3460 100%);
      padding: 25px;
      border-radius: 15px;
      box-shadow: 
        0 0 20px rgba(0,0,0,0.5),
        inset 0 0 20px rgba(0,0,0,0.2);
      text-align: center;
      transition: all 0.3s ease;
      border: 2px solid #ffffff20;
      position: relative;
      overflow: hidden;
    }
    
    .stat-card::before {
      content: '';
      position: absolute;
      top: -2px;
      left: -2px;
      right: -2px;
      bottom: -2px;
      background: linear-gradient(45deg, transparent, rgba(255,255,255,0.1), transparent);
      z-index: -1;
      border-radius: 15px;
    }
    
    .stat-card:hover {
      transform: translateY(-5px);
      box-shadow: 
        0 0 30px rgba(0,0,0,0.7),
        0 0 40px ${mode === 'dev' ? 'rgba(255, 71, 87, 0.3)' : mode === 'qa' ? 'rgba(0, 255, 255, 0.3)' : 'rgba(254, 202, 87, 0.3)'};
      border-color: ${mode === 'dev' ? '#ff4757' : mode === 'qa' ? '#00ffff' : '#feca57'};
    }
    
    .stat-card h3 {
      color: #feca57;
      font-size: 1em;
      text-transform: uppercase;
      letter-spacing: 2px;
      margin-bottom: 15px;
      text-shadow: none;
    }
    
    .stat-card .value {
      color: #fff;
      font-size: 3em;
      font-weight: bold;
      font-family: 'Bebas Neue', sans-serif;
      letter-spacing: 3px;
    }
    
    .stat-card.primary .value { 
      color: ${mode === 'dev' ? '#ff4757' : mode === 'qa' ? '#00ffff' : '#feca57'}; 
      text-shadow: 0 0 5px ${mode === 'dev' ? 'rgba(255, 71, 87, 0.3)' : mode === 'qa' ? 'rgba(0, 255, 255, 0.3)' : 'rgba(254, 202, 87, 0.3)'};
    }
    .stat-card.success .value { 
      color: #2ed573; 
      text-shadow: 0 0 5px rgba(46, 213, 115, 0.3);
    }
    .stat-card.warning .value { 
      color: #ffa502; 
      text-shadow: 0 0 5px rgba(255, 165, 2, 0.3);
    }
    
    .chart-container {
      background: linear-gradient(135deg, #16213e 0%, #0f3460 100%);
      padding: 30px;
      border-radius: 20px;
      box-shadow: 
        0 0 30px rgba(0,0,0,0.5),
        inset 0 0 30px rgba(0,0,0,0.2);
      margin-bottom: 30px;
      position: relative;
      border: 2px solid ${mode === 'dev' ? '#ff4757' : mode === 'qa' ? '#00ffff' : '#feca57'}50;
    }
    
    .chart-title {
      font-size: 2em;
      color: ${mode === 'dev' ? '#ff4757' : mode === 'qa' ? '#00ffff' : '#feca57'};
      margin-bottom: 20px;
      text-align: center;
      font-family: 'Bebas Neue', sans-serif;
      letter-spacing: 4px;
      text-transform: uppercase;
      text-shadow: 0 0 5px ${mode === 'dev' ? 'rgba(255, 71, 87, 0.3)' : mode === 'qa' ? 'rgba(0, 255, 255, 0.3)' : 'rgba(254, 202, 87, 0.3)'};
    }
    
    .data-table {
      background: linear-gradient(135deg, #16213e 0%, #0f3460 100%);
      padding: 20px;
      border-radius: 20px;
      box-shadow: 
        0 0 30px rgba(0,0,0,0.5),
        inset 0 0 30px rgba(0,0,0,0.2);
      margin-bottom: 20px;
      overflow-x: auto;
      border: 2px solid ${mode === 'dev' ? '#ff475750' : '#00ffff50'};
    }
    
    .table-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    
    .table-grid .data-table {
      margin-bottom: 0;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
    }
    
    th, td {
      padding: 10px 12px;
      text-align: left;
      border-bottom: 1px solid #ffffff20;
      font-size: 0.9em;
    }
    
    th {
      background: ${mode === 'dev' ? '#ff4757' : mode === 'qa' ? '#00ffff' : '#feca57'};
      color: #1a1a2e;
      font-weight: 700;
      text-transform: uppercase;
      font-size: 0.85em;
      letter-spacing: 1px;
      position: sticky;
      top: 0;
      font-family: 'Bebas Neue', sans-serif;
    }
    
    td {
      color: #fff;
    }
    
    tr:hover {
      background: rgba(255,255,255,0.05);
    }
    
    .total-row {
      background: rgba(254, 202, 87, 0.2);
      font-weight: bold;
      border-top: 3px solid #feca57;
      border-bottom: 3px solid #feca57;
    }
    
    .total-row td {
      color: #feca57;
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
      border-bottom: 3px solid ${mode === 'dev' ? '#ff4757' : mode === 'qa' ? '#00ffff' : '#feca57'};
      box-shadow: 0 3px 20px ${mode === 'dev' ? 'rgba(255, 71, 87, 0.3)' : mode === 'qa' ? 'rgba(0, 255, 255, 0.3)' : 'rgba(254, 202, 87, 0.3)'};
    }
    
    .tab {
      padding: 15px 30px;
      background: transparent;
      border: 2px solid #ffffff30;
      cursor: pointer;
      font-size: 1.1em;
      font-weight: 700;
      border-radius: 12px 12px 0 0;
      transition: all 0.3s ease;
      color: #ffffff80;
      font-family: 'Bebas Neue', sans-serif;
      letter-spacing: 2px;
      text-transform: uppercase;
    }
    
    .tab:hover {
      background: rgba(255,255,255,0.05);
      color: #fff;
      border-color: #ffffff60;
    }
    
    .tab.active {
      background: ${mode === 'dev' ? '#ff4757' : mode === 'qa' ? '#00ffff' : '#feca57'};
      color: #1a1a2e;
      border-color: ${mode === 'dev' ? '#ff4757' : mode === 'qa' ? '#00ffff' : '#feca57'};
      box-shadow: 
        0 0 20px ${mode === 'dev' ? 'rgba(255, 71, 87, 0.8)' : mode === 'qa' ? 'rgba(0, 255, 255, 0.8)' : 'rgba(254, 202, 87, 0.8)'},
        0 0 40px ${mode === 'dev' ? 'rgba(255, 71, 87, 0.4)' : mode === 'qa' ? 'rgba(0, 255, 255, 0.4)' : 'rgba(254, 202, 87, 0.4)'};
    }
    
    .tab-content {
      display: none;
    }
    
    .tab-content.active {
      display: block;
      animation: neonFadeIn 0.5s ease;
    }
    
    @keyframes neonFadeIn {
      from { 
        opacity: 0; 
        transform: translateY(20px);
        filter: blur(10px);
      }
      to { 
        opacity: 1; 
        transform: translateY(0);
        filter: blur(0);
      }
    }
    
    .month-detail {
      margin-bottom: 30px;
      padding: 25px;
      background: linear-gradient(135deg, #16213e 0%, #0f3460 100%);
      border-radius: 15px;
      border-left: 5px solid ${mode === 'dev' ? '#ff4757' : mode === 'qa' ? '#00ffff' : '#feca57'};
      box-shadow: 
        0 0 20px rgba(0,0,0,0.5),
        inset 0 0 20px rgba(0,0,0,0.2);
    }
    
    .month-detail h3 {
      color: ${mode === 'dev' ? '#ff4757' : mode === 'qa' ? '#00ffff' : '#feca57'};
      margin-bottom: 20px;
      font-size: 1.5em;
      font-family: 'Bebas Neue', sans-serif;
      letter-spacing: 3px;
      text-shadow: 0 0 5px ${mode === 'dev' ? 'rgba(255, 71, 87, 0.3)' : mode === 'qa' ? 'rgba(0, 255, 255, 0.3)' : 'rgba(254, 202, 87, 0.3)'};
    }
    
    .change-group {
      margin-bottom: 20px;
    }
    
    .change-group h4 {
      color: #feca57;
      margin-bottom: 12px;
      font-size: 1.1em;
      letter-spacing: 2px;
    }
    
    .issue-keys {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }
    
    .issue-key {
      background: ${mode === 'dev' ? '#ff4757' : mode === 'qa' ? '#00ffff' : '#feca57'};
      color: #1a1a2e;
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 0.9em;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.3s ease;
      box-shadow: 0 0 10px ${mode === 'dev' ? 'rgba(255, 71, 87, 0.5)' : mode === 'qa' ? 'rgba(0, 255, 255, 0.5)' : 'rgba(254, 202, 87, 0.5)'};
      font-family: 'Bebas Neue', sans-serif;
      letter-spacing: 1px;
    }
    
    .issue-key:hover {
      transform: scale(1.1);
      box-shadow: 
        0 0 20px ${mode === 'dev' ? 'rgba(255, 71, 87, 0.8)' : mode === 'qa' ? 'rgba(0, 255, 255, 0.8)' : 'rgba(254, 202, 87, 0.8)'},
        0 0 40px ${mode === 'dev' ? 'rgba(255, 71, 87, 0.5)' : mode === 'qa' ? 'rgba(0, 255, 255, 0.5)' : 'rgba(254, 202, 87, 0.5)'};
    }

    /* Responsive Design - Tablet */
    @media (max-width: 1024px) {
      .container {
        max-width: 100%;
        padding: 15px;
      }

      h1 {
        font-size: 2.8em;
      }

      .mode-toggle, .direction-toggle {
        gap: 10px;
      }

      .mode-toggle button, .direction-toggle button {
        padding: 12px 24px;
        font-size: 1.1em;
      }

      .stats-container {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    /* Responsive Design - Mobile */
    @media (max-width: 768px) {
      .container {
        padding: 10px;
        margin: 10px;
      }

      h1 {
        font-size: 2em;
        margin-bottom: 20px;
      }

      .mode-toggle, .direction-toggle {
        flex-direction: column;
        gap: 8px;
        margin-bottom: 15px;
      }

      .mode-toggle button, .direction-toggle button {
        width: 100%;
        padding: 12px 20px;
        font-size: 1em;
      }

      .stats-container {
        grid-template-columns: 1fr;
        gap: 10px;
        margin-bottom: 20px;
      }

      .stat-card {
        padding: 15px;
      }

      .stat-value {
        font-size: 2em;
      }

      .stat-label {
        font-size: 0.9em;
      }

      .controls {
        flex-direction: column;
        gap: 10px;
      }

      .controls label {
        width: 100%;
      }

      .controls select {
        width: 100%;
        font-size: 0.9em;
        padding: 8px;
      }

      .chart-container {
        padding: 15px;
        margin-bottom: 15px;
      }

      canvas {
        max-height: 250px !important;
      }

      .issue-key {
        padding: 6px 12px;
        font-size: 0.8em;
      }

      table {
        font-size: 0.85em;
      }

      th, td {
        padding: 8px 4px;
      }
    }

    /* Responsive Design - Small Mobile */
    @media (max-width: 480px) {
      h1 {
        font-size: 1.6em;
      }

      .stat-value {
        font-size: 1.8em;
      }

      .stat-label {
        font-size: 0.8em;
      }

      canvas {
        max-height: 200px !important;
      }

      table {
        font-size: 0.75em;
      }

      th, td {
        padding: 6px 2px;
      }

      .issue-key {
        padding: 4px 8px;
        font-size: 0.7em;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="mode-toggle">
      <a href="/?mode=dev&direction=${direction}${selectedBase !== null ? '&base=' + selectedBase : ''}" class="${mode === 'dev' ? 'active' : ''}">
        DEV (Story Points)
      </a>
      <a href="/?mode=qa&direction=${direction}${selectedBase !== null ? '&base=' + selectedBase : ''}" class="${mode === 'qa' ? 'active' : ''}">
        QA (QA Task)
      </a>
      <a href="/?mode=qa-board&direction=${direction}${selectedBase !== null ? '&base=' + selectedBase : ''}" class="${mode === 'qa-board' ? 'active' : ''}">
        QA (Board Task)
      </a>
    </div>
    
    <div class="direction-toggle">
      <span>Direction:</span>
      <a href="/?mode=${mode}&direction=up${selectedBase !== null ? '&base=' + selectedBase : ''}" class="${direction === 'up' ? 'active' : ''}">
        Increased
      </a>
      <a href="/?mode=${mode}&direction=down${selectedBase !== null ? '&base=' + selectedBase : ''}" class="${direction === 'down' ? 'active' : ''}">
        Decreased
      </a>
    </div>
    
    <div class="header">
      <h1>${fieldName} Update Dashboard</h1>
      <p>Analysis of ${fieldName} ${direction === 'up' ? 'increased' : 'decreased'} from ${BASE_POINTS.join('/')} to ${direction === 'up' ? 'higher' : 'lower'} values (March 2025 - ${filteredMonths[filteredMonths.length - 1]?.name || 'Present'})</p>
      
      <div style="margin-top: 25px; position: relative; z-index: 1;">
        <label style="font-size: 1.1em; color: #feca57; margin-right: 15px; letter-spacing: 2px; text-transform: uppercase; font-family: 'Bebas Neue', sans-serif;">Filter by Base ${fieldName}:</label>
        <select onchange="window.location.href='/?mode=${mode}&direction=${direction}&base='+this.value" style="padding: 12px 25px; font-size: 1.1em; border-radius: 10px; border: 2px solid ${mode === 'dev' ? '#ff4757' : mode === 'qa' ? '#00ffff' : '#feca57'}; background: #16213e; color: ${mode === 'dev' ? '#ff4757' : mode === 'qa' ? '#00ffff' : '#feca57'}; cursor: pointer; font-family: 'Staatliches', sans-serif; letter-spacing: 1px; box-shadow: 0 0 15px ${mode === 'dev' ? 'rgba(255, 71, 87, 0.3)' : mode === 'qa' ? 'rgba(0, 255, 255, 0.3)' : 'rgba(254, 202, 87, 0.3)'}; transition: all 0.3s ease;" onmouseover="this.style.boxShadow='0 0 25px ${mode === 'dev' ? 'rgba(255, 71, 87, 0.6)' : mode === 'qa' ? 'rgba(0, 255, 255, 0.6)' : 'rgba(254, 202, 87, 0.6)'}'" onmouseout="this.style.boxShadow='0 0 15px ${mode === 'dev' ? 'rgba(255, 71, 87, 0.3)' : mode === 'qa' ? 'rgba(0, 255, 255, 0.3)' : 'rgba(254, 202, 87, 0.3)'}'">
          <option value="" style="background: #16213e; color: #fff;">All (${BASE_POINTS.join(', ')})</option>
          ${BASE_POINTS.map(bp => `<option value="${bp}" ${selectedBase === bp ? 'selected' : ''} style="background: #16213e; color: #fff;">From ${bp}</option>`).join('\n          ')}
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
      <button class="tab active" onclick="showTab('overview', event)">Overview</button>
      <button class="tab" onclick="showTab('distribution', event)">Distribution</button>
      <button class="tab" onclick="showTab('averages', event)">Effort Averages</button>
      <button class="tab" onclick="showTab('details', event)">Details</button>
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
        <h2 class="chart-title">Monthly Breakdown & Update Rate Analysis</h2>
        <table>
          <thead>
            <tr>
              <th>Month</th>
              <th>Total Issues</th>
              <th>Total Updates</th>
              <th>Update Rate</th>
              <th>Visualization</th>
              ${sortedTransitions.map(t => `<th>${t}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${filteredMonths.map(month => {
              const updateRate = month.totalIssues > 0 
                ? ((month.totalChanges / month.totalIssues) * 100).toFixed(2) 
                : '0.00';
              const updateRateNum = parseFloat(updateRate);
              const rateColor = updateRateNum < 10 ? '#2ed573' : updateRateNum < 20 ? '#feca57' : '#ff4757';
              const barWidth = Math.min(updateRateNum * 5, 100);
              return `
              <tr>
                <td><strong>${month.name}</strong></td>
                <td>${month.totalIssues.toLocaleString()}</td>
                <td>${month.totalChanges}</td>
                <td><strong style="color: ${rateColor}; text-shadow: 0 0 5px ${rateColor}80;">${updateRate}%</strong></td>
                <td>
                  <div style="background: rgba(255,255,255,0.1); border-radius: 5px; overflow: hidden; height: 20px; width: 100%; min-width: 120px;">
                    <div style="background: ${rateColor}; height: 100%; width: ${barWidth}%; transition: width 0.3s ease; box-shadow: 0 0 10px ${rateColor}80;"></div>
                  </div>
                </td>
                ${sortedTransitions.map(transition => {
                  const [from, to] = transition.split('→');
                  return `<td>${month.byBaseAndTarget[from]?.[to] || 0}</td>`;
                }).join('')}
              </tr>
            `}).join('')}
            <tr class="total-row">
              <td><strong>TOTAL / AVG</strong></td>
              <td>${grandTotalIssues.toLocaleString()} <span style="font-size: 0.8em; opacity: 0.7;">(avg: ${(grandTotalIssues / filteredMonths.length).toFixed(0)})</span></td>
              <td>${grandTotalChanges} <span style="font-size: 0.8em; opacity: 0.7;">(avg: ${(grandTotalChanges / filteredMonths.length).toFixed(1)})</span></td>
              <td><strong>${((grandTotalChanges / grandTotalIssues) * 100).toFixed(2)}%</strong></td>
              <td>
                <div style="background: rgba(255,255,255,0.1); border-radius: 5px; overflow: hidden; height: 20px; width: 100%; min-width: 120px;">
                  <div style="background: #feca57; height: 100%; width: ${Math.min(((grandTotalChanges / grandTotalIssues) * 100) * 5, 100)}%; transition: width 0.3s ease; box-shadow: 0 0 10px #feca5780;"></div>
                </div>
              </td>
              ${sortedTransitions.map(t => `<td>${grandTotalByTransition[t] || 0}</td>`).join('')}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    
    <div id="distribution" class="tab-content">
      <div class="data-table">
        <h2 class="chart-title">${fieldName} Distribution by Month</h2>
        <p style="text-align: center; color: #feca57; margin-bottom: 20px;">Shows how many tasks have each ${fieldName.toLowerCase()} value in each month</p>
        
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
            <div style="margin-bottom: 40px; padding: 25px; background: linear-gradient(135deg, #16213e 0%, #0f3460 100%); border-radius: 10px; border-left: 4px solid ${mode === 'dev' ? '#ff4757' : mode === 'qa' ? '#00ffff' : '#feca57'}; box-shadow: 0 0 20px rgba(0,0,0,0.5);">
              <h3 style="color: ${mode === 'dev' ? '#ff4757' : mode === 'qa' ? '#00ffff' : '#feca57'}; margin-bottom: 20px; font-size: 1.3em; text-shadow: 0 0 5px ${mode === 'dev' ? 'rgba(255, 71, 87, 0.3)' : mode === 'qa' ? 'rgba(0, 255, 255, 0.3)' : 'rgba(254, 202, 87, 0.3)'}; font-family: 'Bebas Neue', sans-serif; letter-spacing: 2px;">${month.name} - ${month.totalIssues} Total Issues</h3>
              
              <table style="width: 100%; margin-bottom: 0; color: #fff;">
                <thead>
                  <tr>
                    <th style="text-align: left; width: 150px; color: #feca57;">${fieldName}</th>
                    <th style="text-align: center; width: 100px; color: #feca57;">Count</th>
                    <th style="text-align: center; width: 100px; color: #feca57;">Percentage</th>
                    <th style="text-align: left; color: #feca57;">Distribution</th>
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
                        <td><strong style="color: #fff;">${label}</strong></td>
                        <td style="text-align: center; color: #fff;">${count}</td>
                        <td style="text-align: center;"><strong style="color: ${mode === 'dev' ? '#ff4757' : mode === 'qa' ? '#00ffff' : '#feca57'};">${percentage}%</strong></td>
                        <td>
                          <div style="background: rgba(255,255,255,0.1); border-radius: 5px; overflow: hidden; height: 25px; width: 100%; position: relative;">
                            <div style="background: ${mode === 'dev' ? '#ff4757' : mode === 'qa' ? '#00ffff' : '#feca57'}; height: 100%; width: ${barWidth}%; transition: width 0.3s ease; display: flex; align-items: center; padding: 0 10px; box-shadow: 0 0 10px ${mode === 'dev' ? 'rgba(255, 71, 87, 0.5)' : mode === 'qa' ? 'rgba(0, 255, 255, 0.5)' : 'rgba(254, 202, 87, 0.5)'};">
                              <span style="color: white; font-size: 0.85em; font-weight: 600; text-shadow: 0 0 5px rgba(0,0,0,0.5);">${count}</span>
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
        <h2 class="chart-title">${fieldName} Distribution Trends</h2>
        <p style="text-align: center; color: #feca57; margin-bottom: 20px; letter-spacing: 1px;">Comparison across all months</p>
        
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
                  <td>${noSP} <span style="color: rgba(255,255,255,0.5);">(${((noSP/month.totalIssues)*100).toFixed(1)}%)</span></td>
                  <td>${sp1} <span style="color: rgba(255,255,255,0.5);">(${((sp1/month.totalIssues)*100).toFixed(1)}%)</span></td>
                  <td>${sp2} <span style="color: rgba(255,255,255,0.5);">(${((sp2/month.totalIssues)*100).toFixed(1)}%)</span></td>
                  <td>${sp3} <span style="color: rgba(255,255,255,0.5);">(${((sp3/month.totalIssues)*100).toFixed(1)}%)</span></td>
                  <td>${sp5} <span style="color: rgba(255,255,255,0.5);">(${((sp5/month.totalIssues)*100).toFixed(1)}%)</span></td>
                  <td>${sp8} <span style="color: rgba(255,255,255,0.5);">(${((sp8/month.totalIssues)*100).toFixed(1)}%)</span></td>
                  <td>${sp13plus} <span style="color: rgba(255,255,255,0.5);">(${((sp13plus/month.totalIssues)*100).toFixed(1)}%)</span></td>
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
          <h2 class="chart-title">Average Effort Trend</h2>
          <canvas id="averageEffortChart"></canvas>
        </div>
        
        <div class="chart-container">
          <h2 class="chart-title">Effort Distribution Pie</h2>
          <canvas id="effortPieChart"></canvas>
        </div>
      </div>
      
      <div class="data-table">
        <h2 class="chart-title">Effort Metrics by Month</h2>
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
                  <td>${tasksWithSP} <span style="color: rgba(255,255,255,0.5);">(${((tasksWithSP/month.totalIssues)*100).toFixed(1)}%)</span></td>
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
              <td><strong style="color: ${mode === 'dev' ? '#ff4757' : mode === 'qa' ? '#00ffff' : '#feca57'}; font-size: 1.2em; text-shadow: 0 0 5px ${mode === 'dev' ? 'rgba(255, 71, 87, 0.3)' : mode === 'qa' ? 'rgba(0, 255, 255, 0.3)' : 'rgba(254, 202, 87, 0.3)'}">${(
                filteredMonths.reduce((sum, m) => sum + calculateAverageEffort(m), 0) / filteredMonths.filter(m => m.distribution).length
              ).toFixed(2)}</strong></td>
              <td colspan="2"></td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <div class="chart-container">
        <h2 class="chart-title">Stacked Effort Distribution</h2>
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
  </div>
  
  <script>
    function showTab(tabName, event) {
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

// Start server if running locally (not in Vercel)
if (require.main === module) {
  const PORT = config.dashboard.port;
  app.listen(PORT, () => {
    console.log(`\n🚀 Dashboard server is running!`);
    console.log(`📊 Open http://localhost:${PORT} in your browser\n`);
    console.log(`Available modes:`);
    console.log(`  - Dev (Story Points): http://localhost:${PORT}/?mode=dev`);
    console.log(`  - QA (QA Efforts): http://localhost:${PORT}/?mode=qa`);
    console.log(`  - QA Board (QA Efforts): http://localhost:${PORT}/?mode=qa-board\n`);
  });
}
