const chalk = require('chalk');

// API pagination limit
const API_FETCH_LIMIT = 100;

class SetupFetcher {
  constructor(authClient) {
    this.authClient = authClient;
    this.apiBaseUrl = 'https://api.p1doks.com';
    this.cachedSeries = null; // Cache series for the session
  }

  async fetchAvailableSeries(week, season = null) {
    // Return cached series if already fetched
    if (this.cachedSeries) {
      return this.cachedSeries;
    }

    const targetSeason = season || this.getCurrentSeason();

    try {
      console.log(chalk.gray('Fetching available series...'));

      // Fetch all data packs for current week/season without series filter
      const response = await this.authClient.makeAuthenticatedRequest(
        `${this.apiBaseUrl}/ql/data-packs`,
        {
          method: 'POST',
          data: {
            limit: API_FETCH_LIMIT,
            offset: 0,
            filters: {
              Week: { _eq: week.toString() },
              Season: { _eq: targetSeason.toString() }
              // No Series filter - get all series
            },
            sort: ['Series']
          }
        }
      );

      const dataPacks = response.data.data_pack || [];

      // Extract unique series with their tracks
      const seriesMap = {};
      dataPacks.forEach(pack => {
        if (pack.Series && pack.Track) {
          // Store first track found for each series (all setups in same series/week use same track)
          if (!seriesMap[pack.Series]) {
            seriesMap[pack.Series] = pack.Track;
          }
        }
      });

      // Convert to array of objects and sort alphabetically
      const availableSeries = Object.keys(seriesMap)
        .sort()
        .map(series => ({
          name: series,
          track: seriesMap[series]
        }));

      // Cache for this session
      this.cachedSeries = availableSeries;

      console.log(chalk.green(`✓ Found ${availableSeries.length} series with setups`));

      return availableSeries;

    } catch (error) {
      console.error(chalk.red('Error fetching available series:'), error.message);
      // Return empty array on error rather than crashing
      return [];
    }
  }

  async getCurrentWeek() {
    // Calculate current iRacing week based on date
    // iRacing weeks start on Tuesday and run in 12-week seasons
    const now = new Date();

    // Find the most recent Tuesday
    const dayOfWeek = now.getDay();
    const daysSinceTuesday = (dayOfWeek + 5) % 7;
    const mostRecentTuesday = new Date(now);
    mostRecentTuesday.setDate(now.getDate() - daysSinceTuesday);
    mostRecentTuesday.setHours(0, 0, 0, 0);

    // ⚠️ MAINTENANCE: Update this date at the start of each season
    // Current reference: Season 4 2025 starts September 10, 2025
    // Find the official iRacing season start dates at: https://www.iracing.com
    const season4Start = new Date('2025-09-10');
    const weeksSinceSeason = Math.floor((mostRecentTuesday - season4Start) / (7 * 24 * 60 * 60 * 1000));
    const weekNumber = (weeksSinceSeason % 12) + 1;

    return weekNumber;
  }

  getCurrentSeason() {
    // Determine current season based on date
    // Each season is approximately 12-13 weeks (~84-91 days)
    const now = new Date();
    const year = now.getFullYear();

    // ⚠️ MAINTENANCE: Update these dates yearly (they change slightly each year)
    // Approximate season start dates for current year
    // Find official dates at: https://www.iracing.com
    const seasons = [
      { season: 1, start: new Date(`${year}-01-07`) },  // ~Early January
      { season: 2, start: new Date(`${year}-04-01`) },  // ~Early April
      { season: 3, start: new Date(`${year}-07-01`) },  // ~Early July
      { season: 4, start: new Date(`${year}-09-10`) }   // ~Mid September
    ];

    // Find current season by checking which season start we've passed
    let currentSeason = 4;
    for (let i = seasons.length - 1; i >= 0; i--) {
      if (now >= seasons[i].start) {
        currentSeason = seasons[i].season;
        break;
      }
    }

    return currentSeason;
  }

  async fetchDataPacks(series, week, season = null) {
    // Default to current season if not specified
    const targetSeason = season || this.getCurrentSeason();

    try {
      console.log(chalk.blue(`\nFetching ${series} datapacks for Week ${week}, Season ${targetSeason}...`));

      // Use the real P1Doks API - POST request with JSON payload
      const response = await this.authClient.makeAuthenticatedRequest(
        `${this.apiBaseUrl}/ql/data-packs`,
        {
          method: 'POST',
          data: {
            limit: API_FETCH_LIMIT,
            offset: 0,
            filters: {
              Week: { _eq: week.toString() },
              Season: { _eq: targetSeason.toString() },
              Series: { _eq: series }
            },
            sort: ['lap_minutes', 'lap_seconds', 'lap_hundredths']
          }
        }
      );

      // Response structure: { data_pack: [...] } - singular, not plural!
      const dataPacksResponse = response.data.data_pack || [];
      console.log(chalk.green(`✓ Found ${dataPacksResponse.length} datapacks`));

      if (dataPacksResponse.length === 0) {
        console.log(chalk.yellow('  No datapacks found for this week/season'));
        return { all: [], byClass: {} };
      }

      // Process the data packs
      const dataPacks = dataPacksResponse.map(pack => {
        const carName = pack.Car || pack.car || pack.title;
        return {
          id: pack.id,
          title: carName,
          car: carName,
          lapTime: pack.lap_time_formatted || pack.lap_time,
          track: pack.Track,
          author: pack.creator,
          included: pack.price === 0 || pack.stripe_product_id?.includes('prod_'),
          carClass: this.determineCarClass(carName, series),
          week: pack.Week,
          season: pack.Season,
          year: pack.Year,
          lapCount: pack.Lap_Count_Achieved
        };
      });

      // Group datapacks by class for display
      const classCounts = {};
      dataPacks.forEach(dp => {
        classCounts[dp.carClass] = (classCounts[dp.carClass] || 0) + 1;
      });

      Object.entries(classCounts).forEach(([className, count]) => {
        console.log(chalk.cyan(`  - ${className} datapacks: ${count}`));
      });

      return {
        all: dataPacks,
        byClass: this.groupByClass(dataPacks)
      };

    } catch (error) {
      console.error(chalk.red('Error fetching datapacks:'), error.message);
      if (error.response) {
        console.error(chalk.red('Response status:'), error.response.status);
        console.error(chalk.red('Response data:'), JSON.stringify(error.response.data, null, 2));
      }
      throw error;
    }
  }

  groupByClass(dataPacks) {
    const grouped = {};
    dataPacks.forEach(datapack => {
      const className = datapack.carClass;
      if (!grouped[className]) {
        grouped[className] = [];
      }
      grouped[className].push(datapack);
    });
    return grouped;
  }

  determineCarClass(carName, series) {
    if (!carName) return 'Other';

    const carUpper = carName.toUpperCase();

    // IMSA-specific classes
    if (series === 'IMSA') {
      const gtpCars = ['GTP', 'PORSCHE 963', 'BMW M HYBRID', 'CADILLAC V-SERIES', 'FERRARI 499P', 'ACURA ARX-06'];
      const gt3Cars = ['GT3', 'LAMBORGHINI', 'FERRARI 296', 'CORVETTE', 'PORSCHE 911', 'BMW M4', 'MERCEDES'];
      const lmp2Cars = ['LMP2', 'DALLARA P217', 'DALLARA LMP2'];

      if (gtpCars.some(car => carUpper.includes(car))) return 'GTP';
      if (gt3Cars.some(car => carUpper.includes(car))) return 'GT3';
      if (lmp2Cars.some(car => carUpper.includes(car))) return 'LMP2';
    }

    // GT-specific classes (for VRS GT Sprint, GT World Challenge, etc.)
    if (series.includes('GT') || series.includes('VRS')) {
      if (carUpper.includes('GT3')) return 'GT3';
      if (carUpper.includes('GT4')) return 'GT4';
    }

    // Porsche Cup
    if (series.includes('Porsche')) {
      if (carUpper.includes('CUP') || carUpper.includes('992')) return 'Porsche Cup';
    }

    // Prototype classes
    if (series.includes('Prototype')) {
      if (carUpper.includes('LMP2')) return 'LMP2';
      if (carUpper.includes('LMP3')) return 'LMP3';
    }

    // Try to extract class from car name as fallback
    if (carUpper.includes('GT3')) return 'GT3';
    if (carUpper.includes('GT4')) return 'GT4';
    if (carUpper.includes('GTP')) return 'GTP';
    if (carUpper.includes('LMP2')) return 'LMP2';
    if (carUpper.includes('LMP3')) return 'LMP3';

    return 'Other';
  }

  async getDataPackFiles(dataPackId) {
    try {
      // Use the consolidated files API endpoint
      const response = await this.authClient.makeAuthenticatedRequest(
        `${this.apiBaseUrl}/ql/data-packs/files/consolidated/${dataPackId}`
      );

      const filesData = response.data;

      // Extract dry and wet setup files
      const dryFiles = filesData.files?.filter(f => f.type === 'dry_files') || [];
      const wetFiles = filesData.files?.filter(f => f.type === 'wet_files') || [];

      return {
        dryFiles: dryFiles.map(f => ({
          filename: f.filename_download,
          diskFilename: f.filename_disk,
          title: f.title,
          type: 'dry'
        })),
        wetFiles: wetFiles.map(f => ({
          filename: f.filename_download,
          diskFilename: f.filename_disk,
          title: f.title,
          type: 'wet'
        })),
        allFiles: [...dryFiles, ...wetFiles].map(f => ({
          filename: f.filename_download,
          diskFilename: f.filename_disk,
          title: f.title,
          type: f.type === 'dry_files' ? 'dry' : 'wet'
        }))
      };
    } catch (error) {
      console.error(chalk.red(`Error fetching datapack files for ${dataPackId}:`), error.message);
      throw error;
    }
  }
}

module.exports = { SetupFetcher };
