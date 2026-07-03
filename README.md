# BOGUS CLIP

A web application for generating, editing, and burning subtitles into videos with pixel-perfect accuracy.

## Features

- **Auto-transcription**: AI-powered speech-to-text using WhisperX
- **Visual subtitle editor**: Drag-and-drop positioning with real-time preview
- **Custom styling**: Font, size, colors, outline, background, bold/italic/underline
- **Export options**: 
  - Download `.ass` subtitle files
  - Burn subtitles directly into video (hardcoded)
- **1:1 preview accuracy**: What you see is exactly what you get in the final video
- **Undo/Redo**: Full history support for style changes (Ctrl+Z / Ctrl+Shift+Z)
- **Font search**: Filter through system fonts quickly

## Tech Stack

### Frontend
- React 18 + TypeScript
- Vite
- Tailwind CSS
- Axios
- React Router
- Lucide Icons
- IndexedDB (local persistence)

### Backend
- Python 3.10+
- FastAPI
- WhisperX (speech recognition)
- ffmpeg (video processing)
- libass (subtitle rendering)
- PyTorch (CUDA support)

## Installation

### Prerequisites

- Node.js 18+
- Python 3.10+
- ffmpeg installed and in PATH
- NVIDIA GPU with CUDA (recommended for WhisperX)
- Hugging Face token (for speaker diarization)

### Backend Setup

**Windows (PowerShell):**
```bash
cd server

# Run the installation script
.\install.ps1

# Create .env file with your Hugging Face token
echo "HF_TOKEN=your_huggingface_token_here" > .env

# Start server
python server.py
```

**Linux/Mac:**
```bash
cd server

# Make script executable
chmod +x install.sh

# Run the installation script
./install.sh

# Create .env file with your Hugging Face token
echo "HF_TOKEN=your_huggingface_token_here" > .env

# Start server
python server.py
```

The install scripts will:
1. Upgrade pip toolchain
2. Install base requirements (FastAPI, ffmpeg-python, etc.)
3. Remove any incorrect torch versions installed by whisperx
4. Detect NVIDIA GPU and install appropriate PyTorch version:
   - **With GPU**: CUDA 12.1 enabled torch (2.5.1)
   - **Without GPU**: CPU-only torch (2.5.1)

### Frontend Setup

```bash
cd client

# Install dependencies
npm install

# Start dev server
npm run dev
```

## Usage

### 1. Upload Video
- Navigate to the home page
- Click "UPLOAD FILE" or drag a video file
- Supported formats: MP4, MKV, AVI, MOV, WebM

### 2. Transcribe
- Click "TRANSCRIBE" to generate subtitles
- Processing time depends on video length (GPU recommended)
- Subtitles are saved locally in IndexedDB

### 3. Edit Styles
- Choose font, size, colors
- Adjust outline and background
- Drag the preview text to position subtitles
- Use Undo/Redo (Ctrl+Z) to revert changes

### 4. Edit Captions
- Modify subtitle text and timing
- Split words by adding spaces
- Click + to add new caption events
- Click trash icon to delete events
- Spacebar to play/pause video

### 5. Export
- **Export ASS**: Download subtitle file for external use
- **Burn Subs**: Download video with hardcoded subtitles

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/upload` | Upload video file |
| GET | `/exists/:name` | Check if video exists |
| POST | `/transcribe` | Generate subtitles |
| GET | `/get_transcript_waveform/:filename` | Get saved transcript |
| GET | `/get-fonts` | List system fonts |
| GET | `/font/:name` | Download font file |
| POST | `/export-ass` | Generate ASS subtitle file |
| POST | `/burn-subtitles` | Burn subtitles into video |

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Space` | Play/Pause video (Edit Captions) |
| `Ctrl+Z` | Undo style change (Edit Styles) |
| `Ctrl+Shift+Z` | Redo style change (Edit Styles) |

## Project Structure

```
bogus-clip/
├── server/
│   ├── server.py          # FastAPI application
│   ├── ass.py             # ASS subtitle format utilities
│   └── .env               # Environment variables (HF_TOKEN)
├── client/
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── pages/         # Page components
│   │   ├── context/       # React context (state)
│   │   ├── utils/         # Utilities (IndexedDB)
│   │   └── types/         # TypeScript types
│   └── package.json
└── README.md
```

## Known Limitations

1. **Font availability**: Burned subtitles require fonts to be installed on the server machine
2. **Processing time**: Transcription requires GPU for reasonable speeds (~1min video = ~30sec on RTX 3080)
3. **Browser compatibility**: Webkit text stroke rendering varies across browsers (Chrome/Safari best)
4. **ASS rendering**: Background + outline combination has limitations in ASS format

## Troubleshooting

### CUDA Out of Memory
- Reduce batch size in `server.py` (line 57)
- Use smaller video files
- Close other GPU-intensive applications

### Font Not Found
- Ensure font is installed on the server machine
- Restart server after installing new fonts
- Check font name matches exactly (case-sensitive)

### Burn Subtitles Fails
- Verify ffmpeg is installed and in PATH
- Check video codec compatibility (H.264 recommended)
- Ensure `burned/` directory has write permissions

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly (especially 1:1 subtitle rendering)
5. Submit a pull request

## License

MIT License - See LICENSE file for details

## Credits

Developed by someone for everyone

---

**Built with ❤️ using React, FastAPI, and WhisperX**
