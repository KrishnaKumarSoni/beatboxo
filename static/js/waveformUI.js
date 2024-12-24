class WaveformUI {
    constructor() {
        this.waveforms = new Map();
        this.setupEventListeners();
    }

    setupEventListeners() {
        document.addEventListener('waveformUpdate', (e) => {
            const { channelId, buffer } = e.detail;
            this.drawStaticWaveform(channelId, buffer);
        });

        document.addEventListener('recordingStarted', (e) => {
            const { channelId } = e.detail;
            this.startRecordingAnimation(channelId);
        });

        document.addEventListener('recordingStopped', (e) => {
            const { channelId } = e.detail;
            this.stopAnimation(channelId);
        });

        document.addEventListener('playbackStarted', (e) => {
            const { channelId } = e.detail;
            this.startPlaybackAnimation(channelId);
        });

        document.addEventListener('playbackStopped', (e) => {
            const { channelId } = e.detail;
            this.stopAnimation(channelId);
        });

        window.addEventListener('resize', () => {
            this.waveforms.forEach((waveform, channelId) => {
                if (waveform.buffer) {
                    this.drawStaticWaveform(channelId, waveform.buffer);
                }
            });
        });
    }

    createCanvas(channelId) {
        const container = document.querySelector(`#channel-${channelId} .waveform-container`);
        if (!container) return null;

        container.innerHTML = '';
        const canvas = document.createElement('canvas');
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
        container.appendChild(canvas);

        this.waveforms.set(channelId, {
            canvas,
            context: canvas.getContext('2d'),
            buffer: null,
            animationFrame: null,
            playbackPosition: 0,
            startTime: 0
        });

        return canvas;
    }

    startRecordingAnimation(channelId) {
        const canvas = this.createCanvas(channelId);
        if (!canvas) return;
        
        const waveform = this.waveforms.get(channelId);
        waveform.startTime = Date.now();
        waveform.isRecording = true;
        this.animateRecording(channelId);
    }

    startPlaybackAnimation(channelId) {
        const waveform = this.waveforms.get(channelId);
        if (!waveform || !waveform.buffer) return;

        waveform.playbackPosition = 0;
        waveform.startTime = Date.now();
        waveform.isPlaying = true;
        this.animatePlayback(channelId);
    }

    animateRecording(channelId) {
        const waveform = this.waveforms.get(channelId);
        if (!waveform || !waveform.isRecording) return;

        const { canvas, context } = waveform;
        const { width, height } = canvas;
        const elapsed = (Date.now() - waveform.startTime) / 1000;
        const position = (elapsed % 2) * (width / 2); // 2 seconds to cross half the screen

        // Clear canvas
        context.clearRect(0, 0, width, height);
        
        // Draw background waveform if exists
        if (waveform.buffer) {
            this.drawWaveform(context, waveform.buffer, width, height, '#333333');
        }

        // Draw recording progress line
        context.beginPath();
        context.strokeStyle = '#FF5F1F';
        context.lineWidth = 2;
        context.moveTo(position, 0);
        context.lineTo(position, height);
        context.stroke();

        waveform.animationFrame = requestAnimationFrame(() => this.animateRecording(channelId));
    }

    animatePlayback(channelId) {
        const waveform = this.waveforms.get(channelId);
        if (!waveform || !waveform.isPlaying || !waveform.buffer) return;

        const { canvas, context, buffer } = waveform;
        const { width, height } = canvas;
        const elapsed = (Date.now() - waveform.startTime) / 1000;
        const duration = buffer.duration;
        const position = (elapsed / duration) * width;

        // Clear canvas
        context.clearRect(0, 0, width, height);
        
        // Draw full waveform
        this.drawWaveform(context, buffer, width, height, '#333333');
        
        // Draw played portion
        context.save();
        context.beginPath();
        context.rect(0, 0, position, height);
        context.clip();
        this.drawWaveform(context, buffer, width, height, '#FF5F1F');
        context.restore();

        // Draw playhead
        context.beginPath();
        context.strokeStyle = '#FF5F1F';
        context.lineWidth = 2;
        context.moveTo(position, 0);
        context.lineTo(position, height);
        context.stroke();

        if (elapsed < duration) {
            waveform.animationFrame = requestAnimationFrame(() => this.animatePlayback(channelId));
        } else {
            this.stopAnimation(channelId);
        }
    }

    drawWaveform(context, buffer, width, height, color) {
        const data = buffer.getChannelData(0);
        const step = Math.ceil(data.length / width);
        const amp = height / 2;

        context.beginPath();
        context.strokeStyle = color;
        context.lineWidth = 2;

        for (let i = 0; i < width; i++) {
            let min = 1.0;
            let max = -1.0;
            
            for (let j = 0; j < step; j++) {
                const datum = data[(i * step) + j] || 0;
                if (datum < min) min = datum;
                if (datum > max) max = datum;
            }
            
            const y1 = (1 + min) * amp;
            const y2 = (1 + max) * amp;
            
            context.moveTo(i, y1);
            context.lineTo(i, y2);
        }
        
        context.stroke();
    }

    stopAnimation(channelId) {
        const waveform = this.waveforms.get(channelId);
        if (!waveform) return;

        if (waveform.animationFrame) {
            cancelAnimationFrame(waveform.animationFrame);
            waveform.animationFrame = null;
        }

        waveform.isRecording = false;
        waveform.isPlaying = false;

        if (waveform.buffer) {
            this.drawStaticWaveform(channelId, waveform.buffer);
        }
    }

    drawStaticWaveform(channelId, buffer) {
        const waveform = this.waveforms.get(channelId) || {};
        const canvas = waveform.canvas || this.createCanvas(channelId);
        if (!canvas) return;

        const context = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        
        context.clearRect(0, 0, width, height);
        waveform.buffer = buffer;
        this.drawWaveform(context, buffer, width, height, '#FF5F1F');
    }

    clearWaveform(channelId) {
        const waveform = this.waveforms.get(channelId);
        if (!waveform) return;
        
        if (waveform.animationFrame) {
            cancelAnimationFrame(waveform.animationFrame);
        }
        
        const { canvas, context } = waveform;
        context.clearRect(0, 0, canvas.width, canvas.height);
        this.waveforms.delete(channelId);
    }
} 