#!/usr/bin/env node

const dotenv = require("dotenv");
const chalk = require("chalk");
const { CognitoAuth } = require("./src/cognito-auth.js");
const { SetupFetcher } = require("./src/fetcher.js");
const { DataPackDownloader } = require("./src/downloader.js");
const { SetupSelector } = require("./src/selector.js");
const { PreferencesManager } = require("./src/preferences.js");
const fs = require("fs-extra");

// Load environment variables
dotenv.config();

const BANNER = `
╔═══════════════════════════════════════╗
║           Auto-P1Doks v1.0            ║
║       P1Doks → iRacing Setups         ║
╚═══════════════════════════════════════╝
`;

async function downloadDataPacks() {
  console.log(chalk.bold.cyan(BANNER));

  // Load preferences
  const preferencesManager = new PreferencesManager();
  await preferencesManager.load();

  const selector = new SetupSelector();

  try {
    // Get credentials (from preferences, .env, or prompt)
    let pidoksUsername, pidoksPassword, pidoksRefreshToken, iracingSetupsPath;
    let auth;

    // Try preferences first (for .exe users)
    if (preferencesManager.hasCredentials()) {
      const creds = preferencesManager.getCredentials();
      pidoksUsername = creds.username;
      pidoksRefreshToken = creds.refreshToken;
      iracingSetupsPath = creds.setupsPath;
      console.log(chalk.green("✓ Using saved session"));

      // Try to authenticate with refresh token
      auth = new CognitoAuth(pidoksUsername, null, pidoksRefreshToken);

      try {
        console.log(chalk.blue("🔐 Refreshing authentication..."));
        const tokens = await auth.authenticate();
        console.log(chalk.green("✓ Session refreshed successfully"));

        // Save the new refresh token (it might have been rotated)
        await preferencesManager.saveCredentials(
          pidoksUsername,
          tokens.refreshToken,
          iracingSetupsPath
        );
      } catch (error) {
        if (error.message === 'REFRESH_TOKEN_EXPIRED') {
          console.log(chalk.yellow("\n⚠ Session expired, please sign in again"));

          // Prompt for password
          const passwordPrompt = await selector.promptPassword();
          pidoksPassword = passwordPrompt.password;

          // Re-authenticate with password
          auth = new CognitoAuth(pidoksUsername, pidoksPassword);
          console.log(chalk.blue("🔐 Authenticating with P1Doks..."));
          const tokens = await auth.authenticate();
          console.log(chalk.green("✓ Authentication successful"));

          // Save new refresh token
          await preferencesManager.saveCredentials(
            pidoksUsername,
            tokens.refreshToken,
            iracingSetupsPath
          );
        } else {
          throw error;
        }
      }
    }
    // Fall back to .env (for developers)
    else if (
      process.env.PIDOKS_USERNAME &&
      process.env.PIDOKS_PASSWORD &&
      process.env.IRACING_SETUPS_PATH
    ) {
      pidoksUsername = process.env.PIDOKS_USERNAME;
      pidoksPassword = process.env.PIDOKS_PASSWORD;
      iracingSetupsPath = process.env.IRACING_SETUPS_PATH;
      console.log(chalk.green("✓ Using .env credentials"));

      // Authenticate with password
      auth = new CognitoAuth(pidoksUsername, pidoksPassword);
      console.log(chalk.blue("🔐 Authenticating with P1Doks..."));
      await auth.authenticate();
      console.log(chalk.green("✓ Authentication successful"));
    }
    // Prompt user (first time)
    else {
      console.log(chalk.yellow("\n⚠ No credentials found"));
      const creds = await selector.promptCredentials();
      pidoksUsername = creds.username;
      pidoksPassword = creds.password;
      iracingSetupsPath = creds.setupsPath;

      // Verify path exists
      if (!(await fs.pathExists(iracingSetupsPath))) {
        console.error(chalk.red("\n✗ iRacing setups path does not exist!"));
        console.error(chalk.yellow(`Path: ${iracingSetupsPath}`));
        console.error(chalk.cyan("\nPlease check your path and try again.\n"));
        process.exit(1);
      }

      // Authenticate with password
      auth = new CognitoAuth(pidoksUsername, pidoksPassword);
      console.log(chalk.blue("🔐 Authenticating with P1Doks..."));
      const tokens = await auth.authenticate();
      console.log(chalk.green("✓ Authentication successful"));

      // Save credentials (with refresh token, not password!)
      await preferencesManager.saveCredentials(
        pidoksUsername,
        tokens.refreshToken,
        iracingSetupsPath
      );
      console.log(chalk.green("\n✓ Session saved!"));
    }

    // Initialize components
    const fetcher = new SetupFetcher(auth);
    const downloader = new DataPackDownloader(auth, iracingSetupsPath);

    // Get current week and season
    const currentWeek = await fetcher.getCurrentWeek();
    const currentSeason = fetcher.getCurrentSeason();
    console.log(
      chalk.bold(
        `\n📅 Current iRacing Week: ${currentWeek}, Season: ${currentSeason}\n`
      )
    );

    // Select week (current or next)
    const selectedWeek = await selector.selectWeek(currentWeek);

    // Fetch and select series dynamically from API
    const availableSeries = await fetcher.fetchAvailableSeries(
      selectedWeek,
      currentSeason
    );

    if (availableSeries.length === 0) {
      console.log(
        chalk.yellow("\n⚠ No series found for this week/season. Exiting.")
      );
      return;
    }

    const selectedSeries = await selector.selectSeries(availableSeries);

    // Fetch datapacks for selected series and week
    const dataPackData = await fetcher.fetchDataPacks(
      selectedSeries.name,
      selectedWeek,
      currentSeason
    );

    const selectedDataPacks = await selector.selectCars(
      dataPackData.all,
      selectedSeries.track
    );

    if (selectedDataPacks.length === 0) {
      console.log(chalk.yellow("\n⚠ No cars selected. Exiting."));
      return;
    }

    const confirmed = await selector.confirmDownload(selectedDataPacks.length);

    if (!confirmed) {
      console.log(chalk.yellow("\n⚠ Download cancelled."));
      return;
    }

    const results = await downloader.downloadAndOrganizeDataPacks(
      selectedDataPacks,
      fetcher,
      {
        track: selectedSeries.track,
        series: selectedSeries.name,
        season: currentSeason,
        week: selectedWeek,
        year: new Date().getFullYear()
      }
    );

    console.log(chalk.bold.cyan("\n═════════════════════════════════════"));
    console.log(chalk.bold.green("✓ All done!"));
    console.log(chalk.cyan(`Total datapacks processed: ${results.length}`));
    console.log(
      chalk.cyan(
        `Successfully organized: ${results.filter((r) => r.success).length}`
      )
    );
    console.log(chalk.bold.cyan("═════════════════════════════════════\n"));

    // Wait for user input before closing
    const inquirer = require('inquirer');
    await inquirer.prompt([
      {
        type: 'input',
        name: 'exit',
        message: 'Press Enter to exit...',
        default: ''
      }
    ]);
  } catch (error) {
    // Handle authentication failure
    if (
      error.message.includes("Authentication failed") ||
      error.message === "TOKEN_EXPIRED"
    ) {
      console.error(chalk.red("\n✗ Authentication failed!"));
      console.log(
        chalk.yellow("\nYour credentials may be incorrect or expired.\n")
      );

      // Clear saved credentials
      await preferencesManager.clearCredentials();

      console.log(
        chalk.cyan(
          "💡 Please run the app again and provide valid credentials.\n"
        )
      );

      // Wait before exit
      const inquirer = require('inquirer');
      await inquirer.prompt([
        {
          type: 'input',
          name: 'exit',
          message: 'Press Enter to exit...',
          default: ''
        }
      ]);
      process.exit(1);
    }

    console.error(chalk.red("\n✗ Error:"), error.message);

    // Wait before exit
    const inquirer = require('inquirer');
    await inquirer.prompt([
      {
        type: 'input',
        name: 'exit',
        message: 'Press Enter to exit...',
        default: ''
      }
    ]);
    process.exit(1);
  }
}

async function main() {
  await downloadDataPacks();
}

main();
