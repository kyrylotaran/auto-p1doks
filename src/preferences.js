const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const os = require('os');

class PreferencesManager {
  constructor() {
    // Use Windows AppData if available, otherwise use current directory
    this.preferencesPath = this.getPreferencesPath();
    this.preferences = null;
  }

  getPreferencesPath() {
    // For Windows, use AppData/Local
    if (process.platform === 'win32') {
      const appDataPath = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
      const appFolder = path.join(appDataPath, 'auto-p1doks');
      return path.join(appFolder, '.preferences.json');
    }

    // For other platforms, use current directory
    return path.join(process.cwd(), '.preferences.json');
  }

  async load() {
    try {
      if (await fs.pathExists(this.preferencesPath)) {
        this.preferences = await fs.readJson(this.preferencesPath);
        return this.preferences;
      }
    } catch (error) {
      console.log(chalk.yellow('Could not load preferences:', error.message));
    }
    return null;
  }

  async saveCredentials(username, refreshToken, setupsPath) {
    try {
      // Ensure the directory exists (important for AppData)
      await fs.ensureDir(path.dirname(this.preferencesPath));

      const data = {
        pidoksUsername: username,
        pidoksRefreshToken: refreshToken,
        iracingSetupsPath: setupsPath
      };
      await fs.writeJson(this.preferencesPath, data, { spaces: 2 });
      this.preferences = data;
      console.log(chalk.gray('\n💾 Credentials saved!'));
      if (process.platform === 'win32') {
        console.log(chalk.gray(`   Location: ${this.preferencesPath}`));
      }
    } catch (error) {
      console.log(chalk.yellow('Could not save credentials:', error.message));
    }
  }

  async clearCredentials() {
    try {
      await fs.remove(this.preferencesPath);
      this.preferences = null;
    } catch (error) {
      // File might not exist, ignore error
    }
  }

  getCredentials() {
    if (!this.preferences) {
      return null;
    }
    return {
      username: this.preferences.pidoksUsername,
      refreshToken: this.preferences.pidoksRefreshToken,
      setupsPath: this.preferences.iracingSetupsPath
    };
  }

  hasCredentials() {
    const creds = this.getCredentials();
    return creds && creds.username && creds.refreshToken && creds.setupsPath;
  }
}

module.exports = { PreferencesManager };
