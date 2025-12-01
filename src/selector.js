const inquirer = require('inquirer');
const chalk = require('chalk');

class SetupSelector {
  async selectWeek(currentWeek) {
    const nextWeek = currentWeek === 12 ? 1 : currentWeek + 1;

    const answer = await inquirer.prompt([
      {
        type: 'list',
        name: 'week',
        message: '📅 Select Week:',
        choices: [
          { name: `Current Week (Week ${currentWeek})`, value: currentWeek },
          { name: `Next Week (Week ${nextWeek})`, value: nextWeek }
        ],
        default: currentWeek
      }
    ]);

    return answer.week;
  }

  async selectSeries(availableSeries) {
    // Transform series objects to choice format with track info
    const choices = availableSeries.map(s => ({
      name: `${s.name} ${chalk.gray(`(${s.track})`)}`,
      value: s.name,
      track: s.track
    }));

    const answer = await inquirer.prompt([
      {
        type: 'list',
        name: 'series',
        message: '🏁 Select Racing Series:',
        choices: choices,
        default: choices[0]?.value
      }
    ]);

    // Find the selected series object to return both name and track
    const selectedSeries = availableSeries.find(s => s.name === answer.series);

    return {
      name: answer.series,
      track: selectedSeries?.track
    };
  }

  async selectCars(dataPacks, trackName) {
    // Show track name if provided
    if (trackName) {
      console.log(chalk.bold.cyan(`\n📍 Track: ${trackName}\n`));
    }

    // Group by car class
    const classByDataPack = {};
    dataPacks.forEach(datapack => {
      const carClass = datapack.carClass || 'Other';
      if (!classByDataPack[carClass]) {
        classByDataPack[carClass] = [];
      }
      if (!classByDataPack[carClass].some(dp => dp.car === datapack.car)) {
        classByDataPack[carClass].push(datapack);
      }
    });

    // Build choices with separators
    const choices = [];

    // Define preferred class order (classes not in this list will appear at the end)
    const preferredOrder = ['GTP', 'GT3', 'GT4', 'LMP2', 'LMP3', 'Porsche Cup'];
    const availableClasses = Object.keys(classByDataPack);

    // Sort classes: preferred order first, then alphabetically for others
    const classOrder = [
      ...preferredOrder.filter(c => availableClasses.includes(c)),
      ...availableClasses.filter(c => !preferredOrder.includes(c)).sort()
    ];

    classOrder.forEach(carClass => {
      if (!classByDataPack[carClass] || classByDataPack[carClass].length === 0) return;

      // Add class separator
      choices.push(new inquirer.Separator(chalk.bold.cyan(`\n──────── ${carClass} ────────`)));

      // Add cars in this class
      classByDataPack[carClass].forEach(datapack => {
        const icon = datapack.included ? chalk.green('✓') : chalk.red('✗');

        choices.push({
          name: `${icon} ${datapack.car} - ${datapack.lapTime}`,
          value: datapack.car,
          disabled: !datapack.included ? chalk.red('Not in subscription') : false
        });
      });
    });

    const answer = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'cars',
        message: '🏎️  Select Cars to Download:',
        choices: choices,
        pageSize: 20,
        validate: (input) => {
          if (input.length === 0) {
            return 'Please select at least one car';
          }
          return true;
        }
      }
    ]);

    return dataPacks.filter(dp => answer.cars.includes(dp.car));
  }

  async confirmDownload(count) {
    const answer = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'proceed',
        message: `📥 Ready to download ${count} datapacks. Continue?`,
        default: true
      }
    ]);
    return answer.proceed;
  }

  async promptCredentials() {
    console.log(chalk.bold.cyan('\n🔑 First Time Setup\n'));
    console.log(chalk.gray('You need to provide your P1Doks credentials and iRacing setups path.'));
    console.log(chalk.gray('These will be saved for future use.\n'));

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'username',
        message: '📧 P1Doks Email:',
        validate: (input) => {
          if (!input || !input.includes('@')) {
            return 'Please enter a valid email address';
          }
          return true;
        }
      },
      {
        type: 'password',
        name: 'password',
        message: '🔐 P1Doks Password:',
        validate: (input) => {
          if (!input || input.length < 6) {
            return 'Please enter your password';
          }
          return true;
        }
      },
      {
        type: 'input',
        name: 'setupsPath',
        message: '📁 iRacing Setups Path:',
        default: process.platform === 'win32'
          ? 'C:\\Users\\YourName\\Documents\\iRacing\\setups'
          : '/Users/YourName/Documents/iRacing/setups',
        validate: (input) => {
          if (!input || input.includes('YourName')) {
            return 'Please enter your actual iRacing setups path';
          }
          return true;
        }
      }
    ]);

    return answers;
  }

  async promptPassword() {
    const answer = await inquirer.prompt([
      {
        type: 'password',
        name: 'password',
        message: '🔐 P1Doks Password:',
        validate: (input) => {
          if (!input || input.length < 6) {
            return 'Please enter your password';
          }
          return true;
        }
      }
    ]);

    return answer;
  }
}

module.exports = { SetupSelector };
