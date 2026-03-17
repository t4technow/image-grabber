# Image Grabber

A Chrome extension that lets you browse, select, and batch download images from any webpage — no DevTools needed.

## Features

- **Visual browser** — See all images on the current page in a masonry grid layout
- **SVG support** — Switch between raster images and SVG icons with tabs
- **Batch download** — Select multiple images and download them as a single ZIP file
- **Smart srcset handling** — Automatically picks the closest resolution from responsive images
- **Dimension display** — Shows width x height and file extension for each image
- **Site-aware naming** — ZIP files are named after the website for easy organization

## How It Works

1. Click the extension icon on any webpage
2. Browse images in the popup — toggle between **Images** and **SVG Icons** tabs
3. Click to select the images you want
4. Hit **Download Selected Images** — get a ZIP with all selected files

## Tech Stack

- **TypeScript** + **React 18**
- **Vite** for building the extension
- **JSZip** for client-side ZIP generation
- **react-masonry-css** for the image grid layout
- **Chrome Extensions Manifest V3**

## Development

```bash
# Install dependencies
yarn install

# Dev mode with hot reload
yarn dev

# Build for production
yarn build
```

Load the built extension in Chrome:
1. Go to `chrome://extensions`
2. Enable Developer Mode
3. Click "Load unpacked" and select the `dist` folder

## Permissions

- `scripting` — To scan page DOM for images
- Host permissions — To access images on any website
