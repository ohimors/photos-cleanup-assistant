# Google Photos Cleaner

A Chrome extension that helps you select Google Photos by type, date range, and orientation for bulk cleanup.

**This extension does NOT delete photos.** It selects photos matching your criteria, then you manually choose what to do with them (Delete, Download, Add to Album).

## Installation (Development)

1. Clone this repository
2. Open `chrome://extensions` in Chrome
3. Enable "Developer mode" (top right)
4. Click "Load unpacked" and select the project folder

## Usage

1. Go to [Google Photos](https://photos.google.com)
2. Click the blue "Cleaner" button in the header
3. Set your filters:
   - **File type**: Photos, Videos, RAW
   - **Date range**: From/To dates
   - **Orientation**: Landscape, Portrait, Square
4. Click "Start Selection"
5. Watch as photos are automatically selected
6. When done, use Google Photos' built-in actions (Delete, Download, etc.)

## Features

- **In-page overlay**: Never leave Google Photos
- **Multiple filters**: Combine type, date, and orientation
- **Progress tracking**: See selection count in real-time
- **Stop anytime**: Cancel selection and keep what's selected
- **Remembers settings**: Your last filter settings are saved

## Privacy

- All processing happens locally in your browser
- No data is sent to external servers
- No Google account credentials are accessed
- See [PRIVACY.md](PRIVACY.md) for full details

## Limitations

- DOM selectors may break if Google updates their UI
- RAW file detection is limited
- Orientation detection requires image to be loaded

## License

MIT
