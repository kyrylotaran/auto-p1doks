# Auto-P1Doks - Usage Guide

## First Time Setup

### Running the App

Simply double-click or run from command line:

```
auto-p1doks.exe
```

### Initial Configuration

On first run, you'll be prompted for:

1. **P1Doks Email** - Your P1Doks account email address
2. **P1Doks Password** - Your P1Doks account password
3. **iRacing Setups Path** - Usually:
   - Windows: `C:\Users\YourName\Documents\iRacing\setups`

**Credentials Storage:**

- Windows: Saved to `%LOCALAPPDATA%\auto-p1doks\.preferences.json`
- Typically: `C:\Users\YourName\AppData\Local\auto-p1doks\.preferences.json`
- This location keeps your data separate from the executable

## Using the App

### 1. Select Week

Choose which week to download:

- **Current Week** - This week's setups
- **Next Week** - Prepare for next week

### 2. Choose Series

Pick from all available P1Doks series:

```
? 🏁 Select Racing Series:
  IMSA (Nurburgring Grand-Prix-Strecke)
  GT Sprint (Watkins Glen International)
  Ferrari Challenge (Portland International Raceway)
  Porsche Cup (...)
  ...
```

Track names are shown for each series!

### 3. Select Cars

Cars are organized by class (GTP, GT3, GT4, LMP2, etc.):

```
──────── GTP ────────
 ◯ ✓ Porsche 963 GTP - 1:42.091
 ◯ ✓ BMW M Hybrid V8 GTP - 1:42.209

──────── GT3 ────────
 ◯ ✓ Ferrari 296 GT3 - 1:51.947
 ◯ ✓ McLaren 720S GT3 EVO - 1:52.206
```

**Indicators:**

- ✓ Green checkmark - Included in your subscription
- ✗ Red X - Not in subscription (can't download)

**Controls:**

- `Space` - Select/deselect car
- `a` - Toggle all
- `i` - Invert selection
- `Enter` - Confirm

### 4. Confirm Download

Review your selection:

```
? 📥 Ready to download 5 datapacks. Continue? (Y/n)
```

### 5. Download & Organize

Datapacks download and are automatically organized:

```
Downloading: Porsche 963 GTP...
  Found 6 setup files (3 dry, 3 wet)
  ✓ P1Doks_PorscheGTP_NurbGP_R_25S4W11.sto
  ✓ P1Doks_PorscheGTP_NurbGP_Q_25S4W11.sto
  ...
  → porsche963gtp/p1doks/2025_S04_W11_Nurburgring_Grand-Prix-Strecke_IMSA/P1Doks_PorscheGTP_NurbGP_R_25S4W11.sto
```

Files go to correct iRacing folders automatically!

**Folder Structure:**

- Pattern: `{car}/p1doks/{year}_S{season}_W{week}_{track}_{series}/`
- Example: `porsche963gtp/p1doks/2025_S04_W11_Nurburgring_Grand-Prix-Strecke_IMSA/`

## Authentication Issues?

If authentication fails, the app will:

1. Clear saved credentials
2. Ask for your email and password again next run

Simply run the app again and provide your credentials.

## Troubleshooting

### "No credentials found"

Provide your P1Doks account email and password when prompted

### "No series found"

No setups available for selected week/season. Try current week.

### "Not in subscription"

Car marked with ✗ requires P1Doks subscription.

### Wrong iRacing folder

If setups go to wrong folder, report the car name and we'll update mappings.

## Running from Source

Developers can run from source:

```bash
npm install
cp .env.example .env
# Edit .env with PIDOKS_USERNAME, PIDOKS_PASSWORD, and IRACING_SETUPS_PATH
npm start
```

No prompts needed when using `.env`!
