#!/usr/bin/env node

const dotenv = require('dotenv');
const chalk = require('chalk');
const fs = require('fs-extra');
const { CognitoAuth } = require('./src/cognito-auth.js');
const { SetupFetcher } = require('./src/fetcher.js');

dotenv.config();

// Load iRacing official mappings for reference
const iracingMappings = require('./iracing-cars.json').mappings;

async function generateMappings() {
  console.log(chalk.bold.cyan('\n🔧 P1Doks Car Mapping Generator\n'));

  // Check for credentials
  if (!process.env.PIDOKS_USERNAME || !process.env.PIDOKS_PASSWORD) {
    console.error(chalk.red('Error: PIDOKS_USERNAME and PIDOKS_PASSWORD not found in .env'));
    process.exit(1);
  }

  const auth = new CognitoAuth(process.env.PIDOKS_USERNAME, process.env.PIDOKS_PASSWORD);
  console.log(chalk.blue('Authenticating with P1Doks...'));
  await auth.authenticate();
  console.log(chalk.green('✓ Authenticated\n'));

  const fetcher = new SetupFetcher(auth);

  try {
    // Get current week and season
    const currentWeek = await fetcher.getCurrentWeek();
    const currentSeason = fetcher.getCurrentSeason();
    console.log(chalk.gray(`Using Week ${currentWeek}, Season ${currentSeason}\n`));

    // Fetch all available series
    console.log(chalk.blue('Fetching all series...'));
    const availableSeries = await fetcher.fetchAvailableSeries(currentWeek, currentSeason);
    console.log(chalk.green(`✓ Found ${availableSeries.length} series\n`));

    // Collect all unique cars from all series
    const allCars = new Set();

    console.log(chalk.blue('Fetching cars from all series...\n'));
    for (const series of availableSeries) {
      console.log(chalk.gray(`  Fetching ${series.name}...`));

      try {
        const dataPackData = await fetcher.fetchDataPacks(series.name, currentWeek, currentSeason);

        dataPackData.all.forEach(dp => {
          if (dp.car) {
            allCars.add(dp.car);
          }
        });

        console.log(chalk.gray(`    Found ${dataPackData.all.length} datapacks`));

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (error) {
        console.log(chalk.yellow(`    ⚠ Error fetching ${series.name}: ${error.message}`));
      }
    }

    console.log(chalk.green(`\n✓ Total unique cars found: ${allCars.size}\n`));

    // Build mappings
    console.log(chalk.blue('Building mappings...\n'));
    const mappings = {};
    const unmatchedCars = [];

    for (const pidoksCarName of Array.from(allCars).sort()) {
      // Try to find matching iRacing car
      const match = findBestMatch(pidoksCarName, iracingMappings);

      if (match) {
        mappings[pidoksCarName] = match.folder;
        console.log(chalk.green(`✓ ${pidoksCarName} → ${match.folder}`));
      } else {
        // Fallback: sanitize the car name
        const fallbackFolder = sanitizeCarName(pidoksCarName);
        mappings[pidoksCarName] = fallbackFolder;
        unmatchedCars.push(pidoksCarName);
        console.log(chalk.yellow(`⚠ ${pidoksCarName} → ${fallbackFolder} (no match, using sanitized)`));
      }
    }

    // Save to file
    const output = {
      description: "P1Doks car name to iRacing folder path mappings",
      note: "Keys are car names as they appear in P1Doks API, values are iRacing folder paths",
      lastUpdated: new Date().toISOString().split('T')[0],
      version: "2.0.0",
      generatedFrom: {
        week: currentWeek,
        season: currentSeason,
        seriesCount: availableSeries.length,
        totalCars: allCars.size
      },
      mappings: mappings
    };

    await fs.writeJson('./pidoks-to-iracing.json', output, { spaces: 2 });

    console.log(chalk.bold.green(`\n✓ Mappings saved to pidoks-to-iracing.json`));
    console.log(chalk.cyan(`  Total mappings: ${Object.keys(mappings).length}`));

    if (unmatchedCars.length > 0) {
      console.log(chalk.yellow(`\n⚠ ${unmatchedCars.length} cars had no exact match (using sanitized names):`));
      unmatchedCars.forEach(car => {
        console.log(chalk.gray(`  - ${car}`));
      });
      console.log(chalk.cyan('\nPlease review these mappings and update manually if needed.\n'));
    } else {
      console.log(chalk.green('\n✓ All cars matched successfully!\n'));
    }

  } catch (error) {
    console.error(chalk.red('\n✗ Error:'), error.message);
    process.exit(1);
  }
}

function findBestMatch(pidoksCarName, iracingMappings) {
  const pidoksUpper = pidoksCarName.toUpperCase();

  // Try exact match first
  for (const [iracingName, folder] of Object.entries(iracingMappings)) {
    if (iracingName.toUpperCase() === pidoksUpper) {
      return { name: iracingName, folder };
    }
  }

  // Try partial match - P1Doks name contains iRacing name
  for (const [iracingName, folder] of Object.entries(iracingMappings)) {
    const iracingUpper = iracingName.toUpperCase();
    if (pidoksUpper.includes(iracingUpper) || iracingUpper.includes(pidoksUpper)) {
      return { name: iracingName, folder };
    }
  }

  // Try key word matching for complex names
  const pidoksWords = pidoksUpper.split(/\s+/);
  let bestMatch = null;
  let bestScore = 0;

  for (const [iracingName, folder] of Object.entries(iracingMappings)) {
    const iracingWords = iracingName.toUpperCase().split(/\s+/);
    const commonWords = pidoksWords.filter(w => iracingWords.some(iw => iw.includes(w) || w.includes(iw)));
    const score = commonWords.length;

    if (score > bestScore && score >= 2) { // At least 2 words in common
      bestScore = score;
      bestMatch = { name: iracingName, folder };
    }
  }

  return bestMatch;
}

function sanitizeCarName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '');
}

generateMappings();
