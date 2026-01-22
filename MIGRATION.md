# Jira Story Point Analysis - Migration Guide

## Version 2.0 Refactoring Summary

This project has been refactored from a collection of scripts into a proper, production-ready application structure.

### What Changed

#### ✅ New Structure
```
src/
├── config/          # Centralized configuration
├── services/        # Business logic (Jira API, analysis, updates)
├── utils/           # Helper functions
├── views/           # Dashboard data preparation
└── [main scripts]   # analyze-all.js, fetch-current.js, dashboard.js
```

#### ✅ Improvements
- **Environment Variables**: Credentials now in `.env` (secure, gitignored)
- **Modular Code**: Separated concerns (API, analysis, UI)
- **Reusable Services**: DRY principles applied
- **Proper Config**: Centralized in `src/config/index.js`
- **Git Safety**: `.gitignore` excludes sensitive data
- **Documentation**: Comprehensive README.md

#### ✅ New Commands
```bash
npm start           # Start dashboard (was: npm run dashboard)
npm run analyze     # Full analysis (was: node script-all-updates.js)
npm run fetch-current  # Update current month only (NEW)
```

### Migration Steps

#### For Existing Users

1. **Update Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

2. **Existing Data**
   - Old data automatically migrated to `data/` directory
   - Legacy files moved to `legacy/` folder
   - No data loss - everything preserved

3. **Start Using**
   ```bash
   npm start   # Dashboard auto-updates current month
   ```

### Legacy Files Location

Old scripts preserved in `legacy/` folder:
- `dashboard.js` (old version)
- `dashboard-all-updates.js` (old version)
- `script.js` (2→higher only)
- `script-all-updates.js` (old all updates)
- `fetch-current-month.js` (old updater)
- `google-sheets-upload.js` (optional feature)

**Note**: These are kept for reference only. Use new `src/` files going forward.

### Configuration Migration

#### Before (Hardcoded)
```javascript
const AUTH_TOKEN = 'Basic ...'; // In every file
const BASE_URL = 'https://...'; // Duplicated
```

#### After (Centralized)
```javascript
// .env file
JIRA_AUTH_TOKEN=Basic ...
JIRA_BASE_URL=https://...

// Usage in code
const config = require('./config');
config.jira.authToken
```

### Key Benefits

1. **Security**: No credentials in code
2. **Maintainability**: One place to update config
3. **Scalability**: Easy to add new features
4. **Professional**: Industry-standard structure
5. **Git-Friendly**: Safe to commit code

### Workflow Comparison

#### Old Way
```bash
node script-all-updates.js          # Full analysis
node dashboard-all-updates.js       # Start dashboard
# Dashboard didn't auto-update current month
```

#### New Way
```bash
npm run analyze      # Full analysis (first time)
npm start            # Dashboard + auto-update current month
```

### Breaking Changes

❌ **Removed**:
- Direct script execution (use npm scripts)
- Hardcoded credentials
- Root-level data files (now in `data/`)

✅ **Required**:
- `.env` file with credentials
- Use npm scripts instead of node commands
- Update import paths if extending code

### Rollback (If Needed)

If you need to use old scripts temporarily:

```bash
# Use legacy files
node legacy/dashboard-all-updates.js
node legacy/script-all-updates.js
```

**Warning**: Legacy files still have hardcoded credentials. Not recommended.

### Next Steps

1. ✅ Delete legacy files after confirming new version works
2. ✅ Add `.env` to your password manager
3. ✅ Review `README.md` for full documentation
4. ✅ Commit changes to version control (`.env` is gitignored)

### Questions?

- Check `README.md` for detailed documentation
- Review `src/config/index.js` for configuration options
- See `.env.example` for required environment variables

---

**Version**: 2.0.0  
**Migration Date**: January 21, 2026  
**Backward Compatibility**: Legacy scripts preserved in `legacy/` folder
