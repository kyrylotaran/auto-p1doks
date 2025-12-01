# Auto-P1Doks

Automatically download and organize iRacing setups from P1Doks for any series and week.

## Download

**[⬇️ Download auto-p1doks.exe](https://github.com/kyrylotaran/auto-p1doks/releases/latest/download/auto-p1doks.exe)**

Or view all releases: [Releases page](https://github.com/kyrylotaran/auto-p1doks/releases)

## Features

✨ **Multi-Series Support** - Download setups from all available P1Doks series (IMSA, GT Sprint, Ferrari Challenge, Porsche Cup, F4, IndyCar, and more)

📅 **Week Selection** - Choose current week or next week setups

🗺️ **Track Information** - See which track each series is racing at

🏎️ **Smart Car Selection** - Organized by class (GTP, GT3, GT4, LMP2, etc.) with subscription status indicators

📁 **Advanced Organization** - Setups organized by car, year, season, week, track, and series for easy management

🔒 **Secure Authentication** - AWS Cognito with refresh token support (passwords never stored)

🔄 **Dynamic Updates** - Available series fetched from P1Doks API in real-time

💾 **Smart Storage** - Credentials saved to Windows AppData for multi-user support

## Quick Start

### Download Pre-built Executable

Download `auto-p1doks.exe` and run it. That's it!

On first run, you'll be prompted for:
1. Your P1Doks account email and password
2. Path to your iRacing setups folder

Credentials are saved securely in `%LOCALAPPDATA%\auto-p1doks\` with refresh token (password never stored).

## How It Works

1. **Select Week** - Current or Next week
2. **Choose Series** - Pick from all available series with track info
3. **Select Cars** - Choose which cars to download (organized by class)
4. **Confirm** - Review and confirm download
5. **Done!** - Setups automatically organized in iRacing folders

## Folder Organization

Setups are organized in a detailed folder structure for easy management:

```
{car}/p1doks/{year}_S{season}_W{week}_{track}_{series}/
```

Example:
```
porsche963gtp/p1doks/2025_S04_W11_Nurburgring_Grand-Prix-Strecke_IMSA/
```

- **Chronologically sorted** - Newest setups appear at the end
- **Easy to find** - Quickly locate setups for specific tracks and weeks
- **No mixing** - P1Doks setups separate from your own setups

## Supported Series

The app dynamically fetches all available series from P1Doks, including:

- IMSA (GTP, LMP2, GT3)
- GT Sprint / GT3 Fixed
- Ferrari Challenge
- Porsche Cup
- Formula 4
- IndyCar / Super Formula
- Production Car Challenge
- TCR Virtual Challenge
- Prototype Challenge
- ...and more as P1Doks adds them!

## Requirements

- Active P1Doks subscription
- iRacing installed
- Internet connection

## Development

Want to run from source or contribute?

### Prerequisites

- Node.js 18+
- npm

### Setup

```bash
npm install
cp .env.example .env
# Edit .env with your P1Doks email and password
npm start
```

### Building Executables

```bash
npm run build
```

See [BUILD.md](BUILD.md) for details.

## Files

- `index.js` - Main application entry point
- `src/cognito-auth.js` - AWS Cognito authentication with refresh token support (using `amazon-cognito-identity-js`)
- `src/fetcher.js` - P1Doks API data fetching
- `src/downloader.js` - Setup file downloads and organization
- `src/selector.js` - Interactive CLI prompts
- `src/preferences.js` - Secure credential storage in Windows AppData
- `generate-mappings.js` - Helper to update car mappings (dev tool)
- `iracing-cars.json` - Official iRacing car → folder mappings (153 cars)
- `pidoks-to-iracing.json` - P1Doks car → iRacing folder mappings (36 cars)
- `p1doks-logo.ico` - Custom application icon

## Updating Car Mappings

If P1Doks adds new cars:

```bash
node generate-mappings.js
```

This fetches all current P1Doks cars and updates `pidoks-to-iracing.json`.

## License

MIT

## Credits

Setups created by P1Doks team. This tool just automates the download and organization process.
