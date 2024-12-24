class AudioEngine {
    constructor() {
        this.audioContext = null;
        this.channels = [];
        this.globalMix = null;
        this.setupAudioContext();
    }

    async setupAudioContext() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Create 5 channels with proper isolation
            for (let i = 0; i < 5; i++) {
                this.channels.push({
                    id: i,
                    buffer: null,
                    source: null,
                    gainNode: this.audioContext.createGain(),
                    analyser: this.audioContext.createAnalyser(),
                    isPlaying: false,
                    isLooping: false,
                    mediaRecorder: null,
                    inputStream: null,
                    mediaStreamSource: null,
                    chunks: [],
                    recordingStartTime: 0,
                    cleanupFunctions: [],
                    effects: [],
                    effectChain: null,
                    isRecording: false
                });

                const channel = this.channels[i];
                
                // Configure analyser
                channel.analyser.fftSize = 2048;
                channel.analyser.smoothingTimeConstant = 0.8;
                
                // Initialize gain
                channel.gainNode.gain.value = 1.0;

                // Create effect chain node
                channel.effectChain = this.audioContext.createGain();
            }
        } catch (error) {
            console.error('Error setting up audio context:', error);
        }
    }

    async cleanup(channelId) {
        const channel = this.channels[channelId];
        
        try {
            // Stop any ongoing playback
            if (channel.source) {
                channel.source.stop();
                channel.source.disconnect();
                channel.source = null;
            }

            // Stop and cleanup recording
            if (channel.isRecording) {
                await this.stopRecording(channelId);
            }

            // Disconnect and cleanup input stream
            if (channel.inputStream) {
                channel.inputStream.getTracks().forEach(track => {
                    track.stop();
                    track.enabled = false;
                });
                channel.inputStream = null;
            }

            // Disconnect MediaStreamSource
            if (channel.mediaStreamSource) {
                channel.mediaStreamSource.disconnect();
                channel.mediaStreamSource = null;
            }

            // Disconnect all effects
            channel.effects.forEach(effect => {
                effect.disconnect();
            });
            channel.effects = [];

            // Reset MediaRecorder
            if (channel.mediaRecorder) {
                if (channel.mediaRecorder.state === 'recording') {
                    channel.mediaRecorder.stop();
                }
                channel.mediaRecorder = null;
            }

            // Clear recording data
            channel.chunks = [];
            channel.recordingStartTime = 0;
            channel.isRecording = false;

            // Reset audio routing
            channel.gainNode.disconnect();
            channel.analyser.disconnect();
            channel.effectChain.disconnect();

            // Reinitialize audio nodes
            channel.gainNode = this.audioContext.createGain();
            channel.analyser = this.audioContext.createAnalyser();
            channel.effectChain = this.audioContext.createGain();

            // Reconfigure analyser
            channel.analyser.fftSize = 2048;
            channel.analyser.smoothingTimeConstant = 0.8;

            // Reset gain
            channel.gainNode.gain.value = 1.0;

            // Reset state
            channel.isPlaying = false;
            channel.isLooping = false;
            channel.buffer = null;

            // Run any additional cleanup functions
            while (channel.cleanupFunctions.length > 0) {
                const cleanup = channel.cleanupFunctions.pop();
                try {
                    cleanup();
                } catch (error) {
                    console.error('Error in cleanup function:', error);
                }
            }

            // Trigger garbage collection hint
            if (global.gc) {
                global.gc();
            }

        } catch (error) {
            console.error('Error during cleanup:', error);
            // Even if there's an error, try to reset critical state
            channel.isRecording = false;
            channel.isPlaying = false;
        }
    }

    async startRecording(channelId, deviceId = null) {
        const channel = this.channels[channelId];
        
        try {
            // Ensure clean state before starting
            await this.cleanup(channelId);

            // Get audio input stream with specified constraints
            const constraints = {
                audio: deviceId ? { 
                    deviceId: { exact: deviceId },
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                } : {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                },
                video: false
            };
            
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            channel.inputStream = stream;

            // Create and connect source
            channel.mediaStreamSource = this.audioContext.createMediaStreamSource(stream);
            channel.mediaStreamSource.connect(channel.analyser);
            
            // Create separate stream for recording to prevent feedback
            const mediaStream = new MediaStream();
            stream.getAudioTracks().forEach(track => {
                const clonedTrack = track.clone();
                mediaStream.addTrack(clonedTrack);
            });

            // Setup MediaRecorder with optimal settings
            channel.mediaRecorder = new MediaRecorder(mediaStream, {
                mimeType: 'audio/webm;codecs=opus',
                audioBitsPerSecond: 128000
            });

            channel.mediaRecorder.ondataavailable = async (e) => {
                if (e.data.size > 0) {
                    channel.chunks.push(e.data);
                    
                    // Update waveform visualization
                    if (channel.chunks.length > 0) {
                        const tempBlob = new Blob(channel.chunks, { type: 'audio/webm' });
                        const arrayBuffer = await tempBlob.arrayBuffer();
                        const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
                        
                        document.dispatchEvent(new CustomEvent('waveformUpdate', {
                            detail: { channelId, buffer: audioBuffer }
                        }));
                    }
                }
            };

            channel.mediaRecorder.onstop = async () => {
                if (channel.chunks.length === 0) return;
                
                try {
                    const blob = new Blob(channel.chunks, { type: 'audio/webm' });
                    const arrayBuffer = await blob.arrayBuffer();
                    const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
                    
                    channel.buffer = audioBuffer;
                    
                    document.dispatchEvent(new CustomEvent('waveformUpdate', {
                        detail: { channelId, buffer: audioBuffer }
                    }));
                } catch (error) {
                    console.error('Error processing recording:', error);
                } finally {
                    channel.isRecording = false;
                    // Cleanup recording resources but keep the buffer
                    this.cleanupRecording(channelId);
                }
            };

            // Start recording
            channel.mediaRecorder.start(500); // Update every 500ms
            channel.recordingStartTime = Date.now();
            channel.isRecording = true;

            // Add cleanup function
            channel.cleanupFunctions.push(() => {
                if (channel.mediaStreamSource) {
                    channel.mediaStreamSource.disconnect();
                }
                if (channel.inputStream) {
                    channel.inputStream.getTracks().forEach(track => track.stop());
                }
            });

            document.dispatchEvent(new CustomEvent('recordingStarted', {
                detail: { channelId }
            }));

        } catch (error) {
            console.error('Error starting recording:', error);
            await this.cleanup(channelId);
            throw error;
        }
    }

    cleanupRecording(channelId) {
        const channel = this.channels[channelId];
        
        // Stop and cleanup input stream
        if (channel.inputStream) {
            channel.inputStream.getTracks().forEach(track => {
                track.stop();
                track.enabled = false;
            });
            channel.inputStream = null;
        }

        // Disconnect MediaStreamSource
        if (channel.mediaStreamSource) {
            channel.mediaStreamSource.disconnect();
            channel.mediaStreamSource = null;
        }

        // Reset MediaRecorder
        channel.mediaRecorder = null;
        channel.chunks = [];
        channel.recordingStartTime = 0;
    }

    async stopRecording(channelId) {
        const channel = this.channels[channelId];
        if (channel.mediaRecorder?.state === 'recording') {
            channel.mediaRecorder.stop();
            channel.isRecording = false;
            document.dispatchEvent(new CustomEvent('recordingStopped', {
                detail: { channelId }
            }));
        }
    }

    reconnectEffectChain(channelId) {
        const channel = this.channels[channelId];
        if (!channel.source) return;

        // Disconnect everything
        channel.source.disconnect();
        channel.effects.forEach(effect => effect.disconnect());
        channel.effectChain.disconnect();

        // Reconnect chain: source -> effects -> analyser -> gain -> destination
        let currentNode = channel.source;

        // Connect through effects if any
        if (channel.effects.length > 0) {
            currentNode.connect(channel.effects[0]);
            for (let i = 0; i < channel.effects.length - 1; i++) {
                channel.effects[i].connect(channel.effects[i + 1]);
            }
            currentNode = channel.effects[channel.effects.length - 1];
        }

        // Complete the chain
        currentNode.connect(channel.analyser);
        channel.analyser.connect(channel.gainNode);
        channel.gainNode.connect(this.audioContext.destination);
    }

    addEffect(channelId, effectNode) {
        const channel = this.channels[channelId];
        channel.effects.push(effectNode);
        this.reconnectEffectChain(channelId);
        return effectNode;
    }

    removeEffect(channelId, effectNode) {
        const channel = this.channels[channelId];
        const index = channel.effects.indexOf(effectNode);
        if (index > -1) {
            effectNode.disconnect();
            channel.effects.splice(index, 1);
            this.reconnectEffectChain(channelId);
        }
    }

    playChannel(channelId) {
        const channel = this.channels[channelId];
        if (!channel.buffer) return;

        // Stop any existing playback
        if (channel.source) {
            channel.source.stop();
            channel.source.disconnect();
            channel.source = null;
        }

        try {
            // Create new source
            channel.source = this.audioContext.createBufferSource();
            channel.source.buffer = channel.buffer;
            channel.source.loop = channel.isLooping;

            // Connect through effect chain
            this.reconnectEffectChain(channelId);

            // Start playback
            channel.source.start(0);
            channel.isPlaying = true;

            // Handle playback end
            channel.source.onended = () => {
                if (!channel.isLooping) {
                    channel.isPlaying = false;
                    if (channel.source) {
                        channel.source.disconnect();
                        channel.source = null;
                    }
                    document.dispatchEvent(new CustomEvent('playbackStopped', {
                        detail: { channelId }
                    }));
                }
            };

            document.dispatchEvent(new CustomEvent('playbackStarted', {
                detail: { channelId }
            }));

        } catch (error) {
            console.error('Error playing channel:', error);
            this.cleanup(channelId);
        }
    }

    stopChannel(channelId) {
        const channel = this.channels[channelId];
        if (channel.source) {
            channel.source.stop();
            channel.source.disconnect();
            channel.source = null;
            channel.isPlaying = false;
            document.dispatchEvent(new CustomEvent('playbackStopped', {
                detail: { channelId }
            }));
        }
    }

    setLooping(channelId, shouldLoop) {
        const channel = this.channels[channelId];
        channel.isLooping = shouldLoop;
        if (channel.source) {
            channel.source.loop = shouldLoop;
        }
    }

    setVolume(channelId, value) {
        const channel = this.channels[channelId];
        if (channel.gainNode) {
            channel.gainNode.gain.setValueAtTime(value, this.audioContext.currentTime);
        }
    }

    getAnalyser(channelId) {
        return this.channels[channelId]?.analyser;
    }

    createEchoEffect(delayTime = 0.5, feedback = 0.5) {
        const delay = this.audioContext.createDelay();
        const feedbackGain = this.audioContext.createGain();
        const wetGain = this.audioContext.createGain();
        const dryGain = this.audioContext.createGain();
        
        delay.delayTime.value = delayTime;
        feedbackGain.gain.value = feedback;
        wetGain.gain.value = 0.5;
        dryGain.gain.value = 1;

        // Create effect chain
        delay.connect(feedbackGain);
        feedbackGain.connect(delay);
        delay.connect(wetGain);

        const effectNode = this.audioContext.createGain();
        effectNode.connect(dryGain);
        effectNode.connect(delay);
        dryGain.connect(effectNode);
        wetGain.connect(effectNode);

        effectNode.delayTime = delay.delayTime;
        effectNode.feedback = feedbackGain.gain;
        effectNode.wet = wetGain.gain;
        effectNode.dry = dryGain.gain;

        return effectNode;
    }

    createPitchEffect(pitchRatio = 1.0) {
        const pitchNode = this.audioContext.createGain();
        const bufferSize = 4096;
        const processor = this.audioContext.createScriptProcessor(bufferSize, 1, 1);
        
        let grainSize = bufferSize / 2;
        let lastPosition = 0;
        
        processor.onaudioprocess = (e) => {
            const inputData = e.inputBuffer.getChannelData(0);
            const outputData = e.outputBuffer.getChannelData(0);
            
            for (let i = 0; i < inputData.length; i++) {
                const position = Math.floor(lastPosition);
                const fraction = lastPosition - position;
                
                let before = inputData[position];
                let after = inputData[position + 1] || 0;
                
                outputData[i] = before + fraction * (after - before);
                
                lastPosition += pitchRatio;
                if (lastPosition >= inputData.length) {
                    lastPosition -= inputData.length;
                }
            }
        };

        pitchNode.connect(processor);
        processor.connect(pitchNode);
        pitchNode.ratio = pitchRatio;

        return pitchNode;
    }

    createReverbEffect(duration = 2, decay = 0.5) {
        const convolver = this.audioContext.createConvolver();
        const wetGain = this.audioContext.createGain();
        const dryGain = this.audioContext.createGain();
        
        // Create impulse response
        const rate = this.audioContext.sampleRate;
        const length = rate * duration;
        const impulse = this.audioContext.createBuffer(2, length, rate);
        
        for (let channel = 0; channel < 2; channel++) {
            const channelData = impulse.getChannelData(channel);
            for (let i = 0; i < length; i++) {
                channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
            }
        }
        
        convolver.buffer = impulse;
        wetGain.gain.value = 0.5;
        dryGain.gain.value = 1;

        const effectNode = this.audioContext.createGain();
        effectNode.connect(convolver);
        effectNode.connect(dryGain);
        convolver.connect(wetGain);
        dryGain.connect(effectNode);
        wetGain.connect(effectNode);

        effectNode.wet = wetGain.gain;
        effectNode.dry = dryGain.gain;

        return effectNode;
    }
} 