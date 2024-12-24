# BeatBoxo

A modern web-based beatbox looper with multi-channel recording, effects processing, and synchronized playback capabilities.

## Features

- Multi-channel recording and playback
- Real-time waveform visualization
- Audio effects (Echo, Pitch Shift, Reverb)
- Loop platform for synchronized playback
- Drag and drop track arrangement
- Audio synchronization controls
- Volume control per channel
- Trim functionality
- RGB visual feedback

## Technical Architecture

### Core Components

1. **Audio Engine (`audioEngine.js`)**
   - Manages Web Audio API interactions
   - Handles recording, playback, and effects processing
   - Controls audio routing and state management
   ```
   Audio Flow:
   Recording: Input → MediaStreamSource → Analyser → MediaRecorder
   Playback: BufferSource → Effects → Analyser → Gain → Output
   ```

2. **Main Controller (`main.js`)**
   - Manages UI interactions
   - Coordinates between components
   - Handles event management
   ```
   Control Flow:
   User Input → Event Handlers → Audio Engine → UI Updates
   ```

3. **Effects System**
   - Echo: Delay-based effect with feedback
   - Pitch Shift: Real-time pitch modification
   - Reverb: Convolution-based room simulation

### Audio Routing

```
Channel Structure:
┌─────────────────┐
│ Input Stream    │
├─────────────────┤
│ MediaStreamSource│
├─────────────────┤
│ Effects Chain   │
├─────────────────┤
│ Analyser        │
├─────────────────┤
│ Gain Node       │
└─────────────────┘
```

### State Management

Each channel maintains:
- Recording state
- Playback state
- Effect chain
- Buffer management
- Audio routing

## Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/beatboxo.git
   cd beatboxo
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Run the application:
   ```bash
   python app.py
   ```

## Usage

### Recording
1. Select input device
2. Click record button
3. Stop when finished
4. Use trim controls if needed

### Effects
1. Click FX button
2. Select effect type
3. Adjust parameters
4. Remove effect if needed

### Loop Platform
1. Add channels using "+" button
2. Arrange tracks via drag and drop
3. Adjust timing with offset controls
4. Use platform controls for synchronized playback

## Control Connections

### Channel Controls
```
Button Actions:
Record → startRecording() → AudioEngine
Play → playChannel() → AudioEngine
Loop → setLooping() → AudioEngine
Effects → addEffect() → AudioEngine
```

### Platform Controls
```
Track Management:
Add Track → platformChannels.add()
Remove Track → platformChannels.delete()
Drag Track → updateTrackOrder()
```

### Audio Processing
```
Effect Chain:
Input → Effect 1 → Effect 2 → ... → Output
Each effect: createEffect() → addEffect() → reconnectChain()
```

## Development

### File Structure
```
beatboxo/
├── static/
│   ├── js/
│   │   ├── audioEngine.js
│   │   ├── main.js
│   │   └── waveform.js
│   ├── css/
│   │   └── style.css
│   └── img/
├── templates/
│   └── index.html
├── app.py
├── requirements.txt
└── README.md
```

### Adding New Features
1. Update AudioEngine for new audio functionality
2. Add UI elements in main.js
3. Style new elements in style.css
4. Update documentation

## Contributing

1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Create Pull Request

## License

MIT License - see LICENSE file for details 