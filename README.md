# CloudZilla

A cross-platform desktop application for managing files across multiple cloud storage services.

## Features

- **Multi-cloud support**: Connect to Dropbox, Google Drive, and OneDrive
- **Unified interface**: Browse and manage all your cloud files in one place
- **File transfers**: Copy and move files between different cloud services
- **Progress tracking**: Real-time transfer progress with speed and ETA
- **Bilingual**: English and Traditional Chinese (zh-TW) support

## Quick Start

```bash
# 1. Clone and install
git clone https://github.com/meowhoo/cloudzilla.git
cd cloudzilla
npm install

# 2. Run the app
npm start
```

## First Time Setup

After launching the app:

1. Click **"Add Site"** in the sidebar
2. Select your cloud provider (Google Drive, Dropbox, or OneDrive)
3. Follow the OAuth authentication flow
4. Your cloud storage will appear in the sidebar

## Screenshots

<!-- TODO: Add screenshots -->

## Prerequisites

- Node.js 18+
- npm 9+
- Windows (macOS / Linux planned)

## Tech Stack

- **Framework**: Electron 28
- **Frontend**: React 18 + TypeScript
- **Cloud Backend**: rclone (bundled)
- **Bundler**: Webpack (via Electron Forge)
- **i18n**: react-i18next

## Project Structure

```
cloudzilla/
├── packages/
│   └── gui/                 # Electron app
│       ├── src/
│       │   ├── main/        # Main process (Node.js)
│       │   ├── renderer/    # React frontend
│       │   └── preload/     # Preload scripts
│       └── resources/
│           └── bin/         # rclone binary
├── package.json
└── README.md
```

## Development

```bash
# Run in development mode
npm start

# Lint code
npm run lint

# Fix lint errors
npm run lint:fix

# Clean build artifacts
npm run clean
```

## Building

```bash
# Package the app
cd packages/gui
npm run package

# Create distributable
npm run make
```

## License

MIT
