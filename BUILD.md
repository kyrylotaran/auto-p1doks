# Building Standalone Executable

This guide explains how to build a standalone Windows executable that doesn't require Node.js to be installed on the target PC.

## Prerequisites (Only for Building)

- Node.js 18+ (only needed on the build machine)
- npm (comes with Node.js)

## Build Instructions

### 1. Install Dependencies

```bash
npm install
```

This will install both runtime dependencies and the build tool (`@yao-pkg/pkg`).

### 2. Build Executable

```bash
npm run build
```

Creates: `dist/auto-p1doks.exe`

## Using the Executable

### On Target PC (No Node.js Required!)

1. **Copy `auto-p1doks.exe` to your PC**

2. **Run it:**
   ```
   auto-p1doks.exe
   ```

3. **On first run, you'll be prompted for:**
   - Your P1Doks account email
   - Your P1Doks password
   - Your iRacing setups path

4. **That's it!** Credentials are saved securely and reused next time.
   - Windows: `%LOCALAPPDATA%\auto-p1doks\.preferences.json`
   - Typically: `C:\Users\YourName\AppData\Local\auto-p1doks\.preferences.json`

**No .env file needed!** Everything is handled through interactive prompts.

## Important Notes

- The executable is **self-contained** - it includes Node.js and all dependencies
- File size will be ~50MB (includes Node.js runtime)
- No installation required on the target PC
- No .env file needed - use interactive prompts or create .env for automation
- Runs on Windows without any prerequisites

## Troubleshooting

### Windows: "Windows protected your PC"
- Click "More info" → "Run anyway"
- This happens because the executable isn't signed

## Automation with Executable

You can automate with Windows Task Scheduler:

**Windows Task Scheduler:**
- Program: `C:\path\to\auto-p1doks.exe`
- Arguments: (leave empty for default)
- Start in: `C:\path\to\` (folder containing the .exe)
- Make sure you have a .env file with credentials for automated runs
