# Photos Cleanup Assistant

A Chrome extension that helps you select Google Photos by date range for manual cleanup.

**This extension does NOT delete photos.** It selects photos matching your criteria, then you manually choose what to do with them (Download, Delete, Add to Album).

## Installation (Development)

1. Clone this repository
2. Open `chrome://extensions` in Chrome
3. Enable "Developer mode" (top right)
4. Click "Load unpacked" and select the project folder

## Usage

1. Click the extension icon
2. Click "New Batch"
3. Enter a name and date range
4. Click "Start Selection"
5. Watch as photos are automatically selected
6. When done, manually click Download, Delete, or other actions

## Features

- **Date range selection**: Select all photos within a date range
- **Progress tracking**: See how many photos are selected in real-time
- **Pause/Resume**: Take a break and continue later
- **Batch history**: Keep track of cleanup sessions
- **Adjustable speed**: Configure selection timing in settings

## Privacy

- All processing happens locally in your browser
- No data is sent to external servers
- No Google account credentials are accessed
- See [PRIVACY.md](PRIVACY.md) for full details

## Limitations

- DOM selectors may break if Google updates their UI
- Large batches (2500+ photos) may take several minutes
- Selection requires the Google Photos tab to remain active

## License

MIT
