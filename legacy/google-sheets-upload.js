const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const GOOGLE_CREDENTIALS_PATH = path.join(__dirname, 'google-credentials.json');
const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE';

const createFormatRequests = (sheetId, monthlyStats, sortedTargets) => [
  {
    repeatCell: {
      range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
      cell: {
        userEnteredFormat: {
          backgroundColor: { red: 0.1, green: 0.2, blue: 0.4 },
          textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true, fontSize: 14 },
          horizontalAlignment: 'CENTER',
        },
      },
      fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
    },
  },
  {
    repeatCell: {
      range: { sheetId, startRowIndex: 1, endRowIndex: 2 },
      cell: {
        userEnteredFormat: {
          backgroundColor: { red: 0.95, green: 0.95, blue: 0.95 },
          textFormat: { fontSize: 10, italic: true },
        },
      },
      fields: 'userEnteredFormat(backgroundColor,textFormat)',
    },
  },
  {
    repeatCell: {
      range: { sheetId, startRowIndex: 3, endRowIndex: 4 },
      cell: {
        userEnteredFormat: {
          backgroundColor: { red: 0.2, green: 0.5, blue: 0.3 },
          textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true },
          horizontalAlignment: 'CENTER',
        },
      },
      fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
    },
  },
  {
    repeatCell: {
      range: { sheetId, startRowIndex: 4 + Object.keys(monthlyStats).length, endRowIndex: 5 + Object.keys(monthlyStats).length },
      cell: {
        userEnteredFormat: {
          backgroundColor: { red: 1, green: 0.8, blue: 0.4 },
          textFormat: { bold: true },
        },
      },
      fields: 'userEnteredFormat(backgroundColor,textFormat)',
    },
  },
  {
    repeatCell: {
      range: { sheetId, startRowIndex: 4, startColumnIndex: 1, endColumnIndex: 3 + sortedTargets.length },
      cell: {
        userEnteredFormat: {
          numberFormat: { type: 'NUMBER', pattern: '#,##0' },
          horizontalAlignment: 'CENTER',
        },
      },
      fields: 'userEnteredFormat(numberFormat,horizontalAlignment)',
    },
  },
  { updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 1 }, properties: { pixelSize: 150 }, fields: 'pixelSize' } },
  { updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 1, endIndex: 2 }, properties: { pixelSize: 100 }, fields: 'pixelSize' } },
  { updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 2, endIndex: 3 }, properties: { pixelSize: 100 }, fields: 'pixelSize' } },
  { updateDimensionProperties: { range: { sheetId, dimension: 'ROWS', startIndex: 0, endIndex: 1 }, properties: { pixelSize: 35 }, fields: 'pixelSize' } },
];

const ensureSheetExists = async (sheets, sheetName) => {
  try {
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const sheet = spreadsheet.data.sheets?.find(s => s.properties?.title === sheetName);
    
    if (!sheet) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests: [{ addSheet: { properties: { title: sheetName } } }],
        },
      });
    } else {
      await sheets.spreadsheets.values.clear({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetName}!A1:ZZ`,
      });
    }
  } catch (error) {
    console.error(`Error with sheet ${sheetName}:`, error.message);
  }
};

const getSheetId = async (sheets, sheetName) => {
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  return spreadsheet.data.sheets?.find(s => s.properties?.title === sheetName)?.properties?.sheetId;
};

const createSummarySheet = async (sheets, monthlyStats, sortedTargets) => {
  const sheetName = 'Summary';
  await ensureSheetExists(sheets, sheetName);
  
  const values = [
    ['STORY POINT CHANGES ANALYSIS (2 → HIGHER)'],
    [`Generated: ${new Date().toISOString()}`],
    [],
    ['Month', 'Total Issues', 'Total Changes', ...sortedTargets.map(t => `2→${t}`)]
  ];
  
  for (const [, stats] of Object.entries(monthlyStats)) {
    values.push([
      stats.name,
      stats.totalIssues,
      stats.totalChanges,
      ...sortedTargets.map(target => stats.byTarget[target] || 0)
    ]);
  }
  
  const grandTotalIssues = Object.values(monthlyStats).reduce((sum, s) => sum + s.totalIssues, 0);
  const grandTotalChanges = Object.values(monthlyStats).reduce((sum, s) => sum + s.totalChanges, 0);
  const grandTotalByTarget = Object.values(monthlyStats).reduce((acc, stats) => {
    Object.entries(stats.byTarget).forEach(([target, count]) => {
      acc[target] = (acc[target] || 0) + count;
    });
    return acc;
  }, {});
  
  values.push(['TOTAL', grandTotalIssues, grandTotalChanges, ...sortedTargets.map(target => grandTotalByTarget[target] || 0)]);
  
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A1`,
    valueInputOption: 'RAW',
    requestBody: { values },
  });
  
  const sheetId = await getSheetId(sheets, sheetName);
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { requests: createFormatRequests(sheetId, monthlyStats, sortedTargets) },
  });
};

const createDetailedSheet = async (sheets, monthlyStats, sortedTargets) => {
  const sheetName = 'Detailed Breakdown';
  await ensureSheetExists(sheets, sheetName);
  
  const values = [['DETAILED MONTHLY BREAKDOWN'], []];
  
  for (const [, stats] of Object.entries(monthlyStats)) {
    values.push([stats.name, '', '', '']);
    values.push(['Target SP', 'Count', 'Percentage', 'Issues']);
    
    sortedTargets.forEach(target => {
      const count = stats.byTarget[target] || 0;
      if (count > 0) {
        const percentage = stats.totalChanges > 0 ? (count / stats.totalChanges * 100).toFixed(1) : 0;
        const issues = stats.keys.filter(k => k.to === target).map(k => k.key).join(', ');
        values.push([`2 → ${target}`, count, `${percentage}%`, issues]);
      }
    });
    
    values.push(['Total', stats.totalChanges, '100%', '']);
    values.push([], []);
  }
  
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A1`,
    valueInputOption: 'RAW',
    requestBody: { values },
  });
  
  const sheetId = await getSheetId(sheets, sheetName);
  const requests = [
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.1, green: 0.2, blue: 0.4 },
            textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true, fontSize: 14 },
            horizontalAlignment: 'CENTER',
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
      },
    },
    { updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 1 }, properties: { pixelSize: 120 }, fields: 'pixelSize' } },
    { updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 1, endIndex: 2 }, properties: { pixelSize: 80 }, fields: 'pixelSize' } },
    { updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 2, endIndex: 3 }, properties: { pixelSize: 100 }, fields: 'pixelSize' } },
    { updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 3, endIndex: 4 }, properties: { pixelSize: 800 }, fields: 'pixelSize' } },
  ];
  
  let currentRow = 2;
  for (const [, stats] of Object.entries(monthlyStats)) {
    requests.push(
      {
        repeatCell: {
          range: { sheetId, startRowIndex: currentRow, endRowIndex: currentRow + 1 },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 0.4, green: 0.6, blue: 0.8 },
              textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true, fontSize: 12 },
            },
          },
          fields: 'userEnteredFormat(backgroundColor,textFormat)',
        },
      },
      {
        repeatCell: {
          range: { sheetId, startRowIndex: currentRow + 1, endRowIndex: currentRow + 2 },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 0.2, green: 0.5, blue: 0.3 },
              textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true },
              horizontalAlignment: 'CENTER',
            },
          },
          fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
        },
      }
    );
    
    const rowCount = sortedTargets.filter(t => stats.byTarget[t] > 0).length;
    
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: currentRow + 2 + rowCount, endRowIndex: currentRow + 3 + rowCount },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.9, green: 0.9, blue: 0.7 },
            textFormat: { bold: true },
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat)',
      },
    });
    
    currentRow += 4 + rowCount + 2;
  }
  
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { requests },
  });
};

const createIssueKeysSheet = async (sheets, monthlyStats) => {
  const sheetName = 'Issue Keys';
  await ensureSheetExists(sheets, sheetName);
  
  const values = [['ALL AFFECTED ISSUE KEYS (2 → HIGHER)'], []];
  
  for (const [, stats] of Object.entries(monthlyStats)) {
    if (stats.keys.length > 0) {
      values.push([stats.name]);
      
      const keysByTarget = stats.keys.reduce((acc, { key, to }) => {
        (acc[to] = acc[to] || []).push(key);
        return acc;
      }, {});
      
      Object.keys(keysByTarget).sort((a, b) => parseFloat(a) - parseFloat(b)).forEach(target => {
        values.push([`2 → ${target}`, keysByTarget[target].join(', ')]);
      });
      
      values.push([]);
    }
  }
  
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A1`,
    valueInputOption: 'RAW',
    requestBody: { values },
  });
  
  const sheetId = await getSheetId(sheets, sheetName);
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [
        {
          repeatCell: {
            range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.1, green: 0.2, blue: 0.4 },
                textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true, fontSize: 14 },
                horizontalAlignment: 'CENTER',
              },
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
          },
        },
        { updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 1 }, properties: { pixelSize: 150 }, fields: 'pixelSize' } },
        { updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 1, endIndex: 2 }, properties: { pixelSize: 1000 }, fields: 'pixelSize' } },
      ],
    },
  });
};

const uploadToGoogleSheets = async (monthlyStats, sortedTargets) => {
  if (!fs.existsSync(GOOGLE_CREDENTIALS_PATH)) {
    throw new Error(`Google credentials file not found at: ${GOOGLE_CREDENTIALS_PATH}`);
  }

  if (SPREADSHEET_ID === 'YOUR_SPREADSHEET_ID_HERE') {
    throw new Error('Please set your SPREADSHEET_ID in the script');
  }

  const credentials = JSON.parse(fs.readFileSync(GOOGLE_CREDENTIALS_PATH, 'utf8'));
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  await createSummarySheet(sheets, monthlyStats, sortedTargets);
  await createDetailedSheet(sheets, monthlyStats, sortedTargets);
  await createIssueKeysSheet(sheets, monthlyStats);
};

const main = async () => {
  const jsonPath = path.join(__dirname, 'story-point-2-to-higher-data.json');
  
  if (!fs.existsSync(jsonPath)) {
    console.error('Error: story-point-2-to-higher-data.json not found.');
    console.log('Please run script.js first to generate the data.');
    process.exit(1);
  }

  const monthlyStats = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const allTargets = [...new Set(Object.values(monthlyStats).flatMap(stats => Object.keys(stats.byTarget || {})))];
  const sortedTargets = allTargets.sort((a, b) => parseFloat(a) - parseFloat(b));

  try {
    console.log('Uploading to Google Sheets...');
    await uploadToGoogleSheets(monthlyStats, sortedTargets);
    console.log('✓ Data uploaded to Google Sheets (3 sheets created: Summary, Detailed Breakdown, Issue Keys)');
  } catch (error) {
    console.error('✗ Failed to upload to Google Sheets:', error.message);
    console.log('  Make sure you have set up google-credentials.json and SPREADSHEET_ID');
  }
};

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { uploadToGoogleSheets };
