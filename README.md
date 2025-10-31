# Transition Studio

A modern, professional video transition editor built with React and WebGL shaders. Create stunning video transitions with real-time preview and export capabilities.

## Features

- 🎨 **27+ Color-Coded Transitions** - Each effect has a unique color for easy identification
- 🎯 **Per-Clip-Pair Control** - Apply different transitions between specific clips
- 🎬 **Multi-Video Support** - Upload and combine multiple video clips with drag & drop
- ⚡ **WebGL Performance** - Hardware-accelerated transitions with 60fps preview
- 🖼️ **Real-time Preview** - See transitions instantly with Web Worker rendering
- 📊 **Visual Timeline** - Color-coded timeline shows all transitions at a glance
- 💾 **Quality Export Options** - High (30fps), Medium (24fps), or Low (15fps)
- 🎛️ **Professional Layout** - Side-by-side design with accessible controls
- 📱 **Responsive Design** - Horizontal layout maintained across all screen sizes

## Technology Stack

- **React 18** - Modern React with hooks
- **Vite** - Fast build tool and dev server
- **Web Workers** - Off-main-thread WebGL rendering
- **OffscreenCanvas** - Hardware-accelerated canvas rendering in workers
- **WebGL/WebGL2** - GPU-accelerated shader-based transitions
- **MediaRecorder API** - Video export functionality

## Installation

1. Navigate to the project directory:
```bash
cd video-transitions-react
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser and navigate to the URL shown in the terminal (typically `http://localhost:5173`)

## Usage

### 1. Upload Videos
- Click the upload area or drag and drop video files
- Supports multiple video formats (MP4, WebM, etc.)
- Add as many clips as you need

### 2. Arrange Clips
- View all your clips in the sidebar
- Use ↑ and ↓ buttons to reorder clips
- Remove clips with the ✕ button

### 3. Apply Transitions
- Select a transition effect from the dropdown (with color indicator)
- Choose transition duration (0.5-3 seconds)
- Select where to apply:
  - **All Clip Pairs** - Apply same transition to all clips
  - **Between Clip 1 & 2** - Apply to specific clip pairs (NEW!)
  - **Start of First Clip** - Opening transition
  - **End of Last Clip** - Closing transition
- Click "Apply Transition"
- See color-coded transitions in the timeline

### 4. Preview
- Click the play button to preview your video
- Use the timeline slider to scrub through
- See real-time FPS counter

### 5. Export
- Select export quality (High, Medium, or Low)
- Click "Export Video"
- Wait for processing (progress bar shows status)
- Video downloads automatically when complete

## Available Transitions

### Basic Transitions
- **Fade** - Simple opacity crossfade
- **Dissolve** - Random dissolve with noise

### Wipe Transitions
- **Wipe Left/Right/Up/Down** - Directional wipes
- **Circle Wipe** - Circular reveal
- **Diamond Wipe** - Diamond-shaped reveal

### Slide Transitions
- **Slide Left/Right/Up/Down** - Sliding motion

### Zoom & Scale
- **Zoom In/Out** - Zoom effects
- **Scale & Rotate** - Combined scaling and rotation

### WebGL Shader Effects
- **Pixelate** - Pixel dissolution
- **Blur Transition** - Smooth blur crossfade
- **Glitch** - Digital glitch with RGB split
- **Ripple** - Water ripple distortion
- **Swirl** - Spiral swirl effect
- **Kaleidoscope** - Kaleidoscope mirror effect
- **Dreamy** - Soft dreamy blur with glow
- **Page Curl** - Page turning effect with shadow
- **Directional Warp** - Wavy directional distortion
- **Mosaic** - Animated mosaic tiles
- **Radial Blur** - Radial zoom blur
- **Crosshatch** - Crosshatch pattern fade

## Browser Compatibility

### Recommended Browsers
- **Chrome 94+** - Full support with OffscreenCanvas
- **Edge 94+** - Full support with OffscreenCanvas
- **Firefox 105+** - Full support with OffscreenCanvas
- **Safari 16.4+** - Full support with OffscreenCanvas

### Fallback Support
- Older browsers automatically fall back to 2D canvas rendering
- WebGL transitions still work, but may not use Web Workers
- Performance may be reduced on older browsers

## Project Structure

```
video-transitions-react/
├── src/
│   ├── components/
│   │   ├── ClipsList.jsx          # Video clips sidebar
│   │   ├── ControlsPanel.jsx      # Transition controls with color indicators
│   │   ├── PlaybackControls.jsx   # Play/pause and timeline
│   │   ├── Timeline.jsx           # Color-coded visual timeline
│   │   ├── VideoPreview.jsx       # WebGL canvas preview with worker
│   │   └── VideoUpload.jsx        # Drag & drop file upload
│   ├── workers/
│   │   └── webgl-renderer.worker.js  # WebGL rendering in Web Worker
│   ├── utils/
│   │   ├── webgl-renderer-main.js    # Main thread WebGL renderer
│   │   └── transitionColors.js       # Color mapping for transitions
│   ├── App.jsx                    # Main application logic
│   ├── App.css                    # Modern dark theme with CSS variables
│   └── main.jsx                   # Entry point
├── index.html
├── package.json
├── vite.config.js
└── README.md
```

## Performance Optimization

- **Web Workers** - All WebGL rendering happens off the main thread
- **OffscreenCanvas** - Hardware-accelerated rendering without blocking UI
- **RequestAnimationFrame** - Smooth 60fps playback
- **Efficient State Management** - Minimal re-renders with React hooks
- **ImageBitmap** - Fast video frame transfer to workers

## Build for Production

```bash
npm run build
```

The production-ready files will be in the `dist` directory.

## Troubleshooting

### Videos not loading
- Ensure videos are in a supported format (MP4, WebM)
- Check browser console for error messages
- Try shorter video files for testing

### Poor performance
- Close other browser tabs
- Use Chrome/Edge for best performance
- Reduce video resolution or duration
- Lower export quality setting

### Export fails
- Check if MediaRecorder API is supported
- Ensure sufficient disk space
- Try a different video codec (automatic selection)

### OffscreenCanvas not working
- Update to latest browser version
- App automatically falls back to 2D rendering
- Performance may be reduced but functionality remains

## Contributing

Feel free to submit issues and enhancement requests!

## License

MIT License - feel free to use this project for any purpose.

## Credits

Based on the professional transitions guide and WebGL shader implementations. Built with React and modern web technologies.

---

Made with ❤️ using React, WebGL, and Web Workers
