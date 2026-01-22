const config = require('../config');
const { escapeHtml } = require('../utils/date');
const { calculateAverageEffort } = require('../services/analyzer');

const generateDashboardHTML = (data, selectedBase = null) => {
  const months = Object.entries(data).map(([key, value]) => ({ key, ...value }));
  const BASE_POINTS = config.analysis.basePoints;
  
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

  return { 
    filteredMonths, 
    chartLabels, 
    transitionDatasets, 
    totalChangesData, 
    totalIssuesData,
    grandTotalIssues, 
    grandTotalChanges, 
    grandTotalByTransition,
    sortedTransitions,
    averageEffortData,
    pieLabels,
    pieData,
    selectedBase,
    BASE_POINTS
  };
};

module.exports = { generateDashboardHTML };
