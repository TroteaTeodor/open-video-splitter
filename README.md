# Open Video Splitter

**Live Demo:** [https://troteateodor.github.io/open-video-splitter/](https://troteateodor.github.io/open-video-splitter/)

**GitHub:** [https://github.com/TroteaTeodor/open-video-splitter](https://github.com/TroteaTeodor/open-video-splitter)

A simple, free, browser-based tool to split videos into segments for Instagram Stories and more.

I was tired of subscription apps for everything that can be done very simply. So I built this.

## Features

- **Instagram Stories preset** - Automatically splits your video into 60-second segments
- **Custom splitting** - Split by interval or at specific timestamps
- **100% client-side** - Your videos never leave your device. All processing happens in your browser
- **No sign-up, no ads, no subscriptions** - Just upload and split
- **Download as ZIP** - Get all your segments in one archive

## How to Use

1. Upload a video (drag & drop or click to browse)
2. Choose a preset or set custom timing
3. Click "Split Video"
4. Download individual segments or all as a ZIP

## Tech Stack

- Vanilla HTML/CSS/JavaScript
- [FFmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm) for video processing
- [JSZip](https://stuk.github.io/jszip/) for creating archives

## License

MIT
