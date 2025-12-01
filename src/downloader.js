const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const axios = require('axios');

// Rate limiting delay between downloads (in milliseconds)
const RATE_LIMIT_DELAY_MS = 500;

// Load car mappings from JSON files
// Priority: P1Doks-specific names first, then iRacing official names
const pidoksMappings = require('../pidoks-to-iracing.json').mappings;
const iracingMappings = require('../iracing-cars.json').mappings;

// Merge mappings with P1Doks taking priority
const CAR_FOLDER_MAPPINGS = { ...iracingMappings, ...pidoksMappings };

class DataPackDownloader {
  constructor(authClient, iracingSetupsPath) {
    this.authClient = authClient;
    this.iracingSetupsPath = iracingSetupsPath;
  }

  async downloadSetupFile(file, dataPackId) {
    try {
      const userId = this.authClient.getUserId();

      if (!userId) {
        throw new Error('User ID not available. Please check your authentication token.');
      }

      // Step 1: Get signed URL from P1Doks API
      const signedUrlResponse = await this.authClient.makeAuthenticatedRequest(
        'https://api.p1doks.com/api/files/download/signed-url',
        {
          method: 'POST',
          data: {
            userId: userId,
            dataPackId: dataPackId,
            filename: file.filename,
            filename_disk: file.diskFilename
          }
        }
      );

      const signedUrl = signedUrlResponse.data.url;

      // Step 2: Download file from signed S3 URL (without auth headers - URL is already signed)
      const fileResponse = await axios.get(signedUrl, {
        responseType: 'arraybuffer'
      });

      return {
        filename: file.filename,
        buffer: fileResponse.data,
        type: file.type,
        title: file.title
      };

    } catch (error) {
      console.error(chalk.red(`✗ Failed to download file ${file.filename}: ${error.message}`));
      if (error.response) {
        console.error(chalk.red(`   Status: ${error.response.status}`));
        console.error(chalk.red(`   Data: ${JSON.stringify(error.response.data)}`));
      }
      return null;
    }
  }

  async downloadDataPack(datapack, fetcher) {
    try {
      console.log(chalk.gray(`\nDownloading: ${datapack.car}...`));

      // Get the setup file list for this datapack
      const filesData = await fetcher.getDataPackFiles(datapack.id);
      const filesToDownload = filesData.allFiles;

      console.log(chalk.cyan(`  Found ${filesToDownload.length} setup files (${filesData.dryFiles.length} dry, ${filesData.wetFiles.length} wet)`));

      const downloadedFiles = [];

      for (const file of filesToDownload) {
        const fileData = await this.downloadSetupFile(file, datapack.id);
        if (fileData) {
          downloadedFiles.push(fileData);
          console.log(chalk.green(`  ✓ ${fileData.filename}`));
        }
      }

      return {
        datapack,
        files: downloadedFiles
      };

    } catch (error) {
      console.error(chalk.red(`✗ Failed to download ${datapack.car}: ${error.message}`));
      return null;
    }
  }

  async organizeDataPack(dataPackData, organizePath, context) {
    try {
      const { datapack, files } = dataPackData;

      // Determine the car folder name
      const carFolder = this.getCarFolderName(datapack.car);

      // Create subfolder name: {year}_S{season}_W{week}_{track}_{series}
      // This ordering ensures newest setups (higher year/season/week) appear at the end when sorted
      let subfolderName = 'p1doks';
      if (context) {
        // Sanitize track and series names (remove special chars, spaces)
        const trackName = this.sanitizeFilename(context.track).replace(/\s+/g, '_');
        const seriesName = this.sanitizeFilename(context.series).replace(/\s+/g, '_');
        // Format with leading zeros for proper sorting (S04, W11)
        const season = String(context.season).padStart(2, '0');
        const week = String(context.week).padStart(2, '0');
        subfolderName = `${context.year}_S${season}_W${week}_${trackName}_${seriesName}`;
      }

      // Create folder structure: iRacing/setups/{car}/p1doks/{track_year_season_week_series}/
      const targetDir = path.join(organizePath, carFolder, 'p1doks', subfolderName);
      await fs.ensureDir(targetDir);

      const savedFiles = [];

      for (const file of files) {
        const targetPath = path.join(targetDir, file.filename);
        await fs.writeFile(targetPath, file.buffer);
        savedFiles.push(targetPath);
        console.log(chalk.blue(`  → ${path.relative(organizePath, targetPath)}`));
      }

      return savedFiles;

    } catch (error) {
      console.error(chalk.red(`✗ Failed to organize datapack: ${error.message}`));
      return null;
    }
  }

  async downloadAndOrganizeDataPacks(dataPacks, fetcher, context) {
    console.log(chalk.bold(`\n📥 Starting download of ${dataPacks.length} datapacks...\n`));

    const results = [];

    for (const datapack of dataPacks) {
      if (!datapack.included) {
        console.log(chalk.yellow(`⊘ Skipping ${datapack.car} (not included in subscription)`));
        continue;
      }

      const dataPackData = await this.downloadDataPack(datapack, fetcher);

      if (dataPackData && dataPackData.files.length > 0) {
        const targetPaths = await this.organizeDataPack(dataPackData, this.iracingSetupsPath, context);
        results.push({ datapack, targetPaths, success: !!targetPaths });
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY_MS));
    }

    const successCount = results.filter(r => r.success).length;

    console.log(chalk.bold.green(`\n✓ Download complete!`));
    console.log(chalk.green(`  Successfully downloaded: ${successCount}/${dataPacks.length} datapacks`));

    return results;
  }

  getCarFolderName(carName) {
    // Try exact match first
    if (CAR_FOLDER_MAPPINGS[carName]) {
      return CAR_FOLDER_MAPPINGS[carName];
    }

    // Try fuzzy match
    for (const [key, value] of Object.entries(CAR_FOLDER_MAPPINGS)) {
      if (carName.includes(key) || key.includes(carName)) {
        return value;
      }
    }

    // Fallback: sanitize the car name
    return this.sanitizeFilename(carName).toLowerCase().replace(/\s+/g, '');
  }

  sanitizeFilename(name) {
    return name
      .replace(/[^a-zA-Z0-9\s\-_]/g, '')
      .replace(/\s+/g, '_')
      .trim();
  }
}

module.exports = { DataPackDownloader };
