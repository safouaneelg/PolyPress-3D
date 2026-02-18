# PolyPress 3D Viewer

PolyPress is a web-based 3D and point-cloud viewer built with React, Vite, and Three.js.

## Supported Formats

- `GLB`
- `GLTF`
- `OBJ`
- `PCD`
- `PLY`
- `XYZ`

## Features

- Drag-and-load style file import from local disk
- Interactive orbit camera controls
- Model statistics (format, size, geometry complexity, materials, textures, animations)
- Scene controls (wireframe, auto-rotate, animation playback, skeleton, point size)
- GLB export with optional Draco geometry compression and KTX2 texture compression

## Tech Stack

- React + TypeScript
- Vite
- three.js
- `@react-three/fiber`
- `@react-three/drei`

## Getting Started

### Prerequisites

- Node.js 18+ (LTS recommended)
- npm

### Install

```bash
npm install
```

### Run Development Server

```bash
npm run dev
```

The app runs on `http://localhost:3000`.

### Build for Production

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## Project Structure

- `App.tsx` - application layout, UI state, panels, modals
- `components/ThreeViewer.tsx` - Three.js scene, loaders, metadata extraction, export logic
- `types.ts` - shared TypeScript types
- `vite.config.ts` - Vite configuration

## Notes

- No API keys are required.
- Models are processed client-side in the browser.

## License

This project is licensed under the PolyPress Non-Commercial License.

- Allowed: personal, academic, and research use
- Not allowed: commercial use, resale, or paid distribution

See `LICENCE` for full terms.
