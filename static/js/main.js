document.addEventListener('DOMContentLoaded', () => {
    // Make audioEngine globally accessible
    window.audioEngine = new AudioEngine();
    const waveformUI = new WaveformUI();
    const effects = new Effects(window.audioEngine);

    // Create channels container
    const channelsContainer = document.querySelector('.channels-container');

    // Create loop platform BEFORE channels
    const loopPlatform = document.createElement('div');
    loopPlatform.className = 'loop-platform';
    loopPlatform.innerHTML = `
        <div class="platform-header">
            <h2>Loop Platform</h2>
            <div class="platform-controls">
                <button class="btn-platform-play" disabled title="Play All">
                    <i class="fas fa-play"></i>
                </button>
                <button class="btn-platform-stop" disabled title="Stop All">
                    <i class="fas fa-stop"></i>
                </button>
            </div>
        </div>
        <div class="platform-tracks"></div>
    `;
    channelsContainer.parentNode.insertBefore(loopPlatform, channelsContainer);

    const platformTracks = loopPlatform.querySelector('.platform-tracks');
    const platformPlay = loopPlatform.querySelector('.btn-platform-play');
    const platformStop = loopPlatform.querySelector('.btn-platform-stop');
    
    // Track which channels are in the platform
    const platformChannels = new Set();
    let isPlatformPlaying = false;

    // Add updatePlatformButtons function
    function updatePlatformButtons() {
        platformPlay.disabled = platformChannels.size === 0;
        platformStop.disabled = !isPlatformPlaying;
    }

    // Create platform track with drag functionality
    function createPlatformTrack(channelId) {
        const trackElement = document.createElement('div');
        trackElement.id = `platform-track-${channelId}`;
        trackElement.className = 'platform-track';
        trackElement.draggable = true;
        
        // Add data attributes for drag handling
        trackElement.dataset.channelId = channelId;
        trackElement.dataset.offset = '0'; // Audio sync offset in seconds
        
        trackElement.innerHTML = `
            <div class="track-handle">
                <i class="fas fa-grip-vertical"></i>
            </div>
            <div class="track-info">Channel ${channelId + 1}</div>
            <div class="track-waveform"></div>
            <div class="track-controls">
                <div class="track-offset">
                    <button class="btn-offset-left" title="Move Earlier">
                        <i class="fas fa-chevron-left"></i>
                    </button>
                    <span class="offset-value">0s</span>
                    <button class="btn-offset-right" title="Move Later">
                        <i class="fas fa-chevron-right"></i>
                    </button>
                </div>
                <button class="btn-remove-track">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        // Add drag event listeners for reordering
        trackElement.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', channelId);
            trackElement.classList.add('dragging');
        });

        trackElement.addEventListener('dragend', () => {
            trackElement.classList.remove('dragging');
        });

        // Audio sync controls
        const offsetLeft = trackElement.querySelector('.btn-offset-left');
        const offsetRight = trackElement.querySelector('.btn-offset-right');
        const offsetValue = trackElement.querySelector('.offset-value');
        let currentOffset = 0;

        offsetLeft.addEventListener('click', () => {
            currentOffset = Math.max(currentOffset - 0.1, -5); // Minimum -5 seconds
            updateOffset();
        });

        offsetRight.addEventListener('click', () => {
            currentOffset = Math.min(currentOffset + 0.1, 5); // Maximum 5 seconds
            updateOffset();
        });

        function updateOffset() {
            trackElement.dataset.offset = currentOffset;
            offsetValue.textContent = `${currentOffset.toFixed(1)}s`;
            
            // If platform is playing, restart with new offset
            if (isPlatformPlaying) {
                window.audioEngine.stopChannel(channelId);
                setTimeout(() => {
                    window.audioEngine.playChannel(channelId);
                }, currentOffset * 1000);
            }
        }

        // Remove track functionality
        trackElement.querySelector('.btn-remove-track').addEventListener('click', () => {
            platformChannels.delete(channelId);
            const channel = document.querySelector(`#channel-${channelId}`);
            const addToPlatformBtn = channel.querySelector('.btn-add-to-platform');
            addToPlatformBtn.classList.remove('active');
            addToPlatformBtn.title = 'Add to Platform';
            trackElement.remove();
            updatePlatformButtons();
        });

        return trackElement;
    }

    // Add platform tracks container drag events
    platformTracks.addEventListener('dragover', (e) => {
        e.preventDefault();
        const draggingTrack = document.querySelector('.platform-track.dragging');
        if (!draggingTrack) return;

        const siblings = [...platformTracks.querySelectorAll('.platform-track:not(.dragging)')];
        const nextSibling = siblings.find(sibling => {
            const rect = sibling.getBoundingClientRect();
            const offset = e.clientY - rect.top - rect.height / 2;
            return offset < 0;
        });

        platformTracks.insertBefore(draggingTrack, nextSibling);
    });

    // Create channel elements
    for (let i = 0; i < 5; i++) {
        const channelElement = createChannelElement(i);
        channelsContainer.appendChild(channelElement);
        setupChannelControls(i, channelElement);
    }

    // Setup global controls
    setupGlobalControls();

    function createChannelElement(channelId) {
        const channel = document.createElement('div');
        channel.id = `channel-${channelId}`;
        channel.className = 'channel';
        
        channel.innerHTML = `
            <div class="channel-header">
                <h2>Channel ${channelId + 1}</h2>
                <select class="input-device">
                    <option value="">Select Input</option>
                </select>
            </div>
            <div class="waveform-container"></div>
            <div class="controls">
                <button class="btn-record" title="Record">
                    <i class="fas fa-circle"></i>
                </button>
                <button class="btn-play" disabled title="Play">
                    <i class="fas fa-play"></i>
                </button>
                <button class="btn-loop" disabled title="Loop">
                    <i class="fas fa-sync"></i>
                </button>
                <button class="btn-restart" disabled title="Restart">
                    <i class="fas fa-redo"></i>
                </button>
                <button class="btn-add-to-platform" disabled title="Add to Platform">
                    <i class="fas fa-plus-circle"></i>
                </button>
                <input type="range" class="volume-slider" min="0" max="1" step="0.1" value="1" title="Volume">
                <button class="btn-trim" disabled title="Trim">
                    <i class="fas fa-cut"></i>
                </button>
                <div class="fx-container">
                    <button class="btn-fx" title="Add Effect">
                        <i class="fas fa-magic"></i>
                    </button>
                    <div class="fx-dropdown">
                        <div class="fx-option" data-effect="echo">
                            <i class="fas fa-wave-square"></i>
                            Echo
                        </div>
                        <div class="fx-option" data-effect="pitch">
                            <i class="fas fa-music"></i>
                            Pitch Shift
                        </div>
                        <div class="fx-option" data-effect="reverb">
                            <i class="fas fa-church"></i>
                            Reverb
                        </div>
                    </div>
                </div>
                <button class="btn-delete" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
            <div class="trim-controls" style="display: none;">
                <input type="range" class="trim-start" min="0" max="100" value="0">
                <input type="range" class="trim-end" min="0" max="100" value="100">
                <button class="btn-apply-trim">
                    <i class="fas fa-check"></i>
                </button>
                <button class="btn-cancel-trim">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="effect-controls"></div>
        `;
        
        return channel;
    }

    function setupChannelControls(channelId, channelElement) {
        const inputSelect = channelElement.querySelector('.input-device');
        const recordBtn = channelElement.querySelector('.btn-record');
        const playBtn = channelElement.querySelector('.btn-play');
        const restartBtn = channelElement.querySelector('.btn-restart');
        const volumeSlider = channelElement.querySelector('.volume-slider');
        const trimBtn = channelElement.querySelector('.btn-trim');
        const loopBtn = channelElement.querySelector('.btn-loop');
        const fxContainer = channelElement.querySelector('.fx-container');
        const fxBtn = fxContainer.querySelector('.btn-fx');
        const fxDropdown = fxContainer.querySelector('.fx-dropdown');
        const fxOptions = fxContainer.querySelectorAll('.fx-option');
        const deleteBtn = channelElement.querySelector('.btn-delete');
        const trimControls = channelElement.querySelector('.trim-controls');
        const effectControls = channelElement.querySelector('.effect-controls');
        const addToPlatformBtn = channelElement.querySelector('.btn-add-to-platform');

        // Populate input devices
        navigator.mediaDevices.enumerateDevices()
            .then(devices => {
                devices.filter(device => device.kind === 'audioinput')
                    .forEach(device => {
                        const option = document.createElement('option');
                        option.value = device.deviceId;
                        option.text = device.label || `Microphone ${inputSelect.options.length}`;
                        inputSelect.appendChild(option);
                    });
            });

        // Recording controls with proper state management
        let isRecording = false;
        recordBtn.addEventListener('click', async () => {
            if (!isRecording) {
                try {
                    // Reset recording state before starting new recording
                    window.audioEngine.cleanup(channelId);
                    channelElement.querySelector('.waveform-container').innerHTML = '';
                    
                    await window.audioEngine.startRecording(channelId, inputSelect.value);
                    recordBtn.classList.add('recording');
                    channelElement.classList.add('active'); // Add RGB effect
                    recordBtn.innerHTML = '<i class="fas fa-stop"></i>';
                    recordBtn.title = 'Stop';
                    playBtn.disabled = true;
                    loopBtn.disabled = true;
                    isRecording = true;
                } catch (error) {
                    console.error('Recording failed:', error);
                    // Reset state on error
                    isRecording = false;
                    recordBtn.classList.remove('recording');
                    channelElement.classList.remove('active');
                }
            } else {
                window.audioEngine.stopRecording(channelId);
                recordBtn.classList.remove('recording');
                channelElement.classList.remove('active');
                recordBtn.innerHTML = '<i class="fas fa-circle"></i>';
                recordBtn.title = 'Record';
                playBtn.disabled = false;
                loopBtn.disabled = false;
                trimBtn.disabled = false;
                restartBtn.disabled = false;
                isRecording = false;
            }
        });

        // Play/Pause with RGB effect
        let playDebounceTimeout;
        playBtn.addEventListener('click', () => {
            if (playDebounceTimeout) return;
            
            playDebounceTimeout = setTimeout(() => {
                playDebounceTimeout = null;
            }, 200);

            if (playBtn.classList.contains('playing')) {
                window.audioEngine.stopChannel(channelId);
                playBtn.innerHTML = '<i class="fas fa-play"></i>';
                playBtn.classList.remove('playing');
                channelElement.classList.remove('active'); // Remove RGB effect
                playBtn.title = 'Play';
            } else {
                window.audioEngine.playChannel(channelId);
                playBtn.innerHTML = '<i class="fas fa-pause"></i>';
                playBtn.classList.add('playing');
                channelElement.classList.add('active'); // Add RGB effect
                playBtn.title = 'Pause';
            }
        });

        // Restart button with debounce
        let restartDebounceTimeout;
        restartBtn.addEventListener('click', () => {
            if (restartDebounceTimeout) return;
            
            restartDebounceTimeout = setTimeout(() => {
                restartDebounceTimeout = null;
            }, 200);

            window.audioEngine.stopChannel(channelId);
            window.audioEngine.playChannel(channelId);
            if (!playBtn.classList.contains('playing')) {
                playBtn.innerHTML = '<i class="fas fa-pause"></i>';
                playBtn.classList.add('playing');
            }
        });

        // Volume control
        volumeSlider.addEventListener('input', () => {
            window.audioEngine.setVolume(channelId, volumeSlider.value);
        });

        // Trim controls
        let activeTrimOverlay = null;
        
        trimBtn.addEventListener('click', () => {
            if (activeTrimOverlay) {
                // If trim is already active, deactivate it
                activeTrimOverlay.remove();
                activeTrimOverlay = null;
                trimControls.style.display = 'none';
                trimBtn.classList.remove('active');
                return;
            }

            trimBtn.classList.add('active');
            const waveformContainer = channelElement.querySelector('.waveform-container');
            const trimOverlay = document.createElement('div');
            trimOverlay.className = 'trim-overlay active';
            
            const leftHandle = document.createElement('div');
            leftHandle.className = 'trim-handle left';
            
            const rightHandle = document.createElement('div');
            rightHandle.className = 'trim-handle right';
            
            const trimRegion = document.createElement('div');
            trimRegion.className = 'trim-region';
            
            trimOverlay.appendChild(leftHandle);
            trimOverlay.appendChild(rightHandle);
            trimOverlay.appendChild(trimRegion);
            waveformContainer.appendChild(trimOverlay);
            
            activeTrimOverlay = trimOverlay;
            
            let startPos = 0;
            let endPos = 100;
            
            // Update trim region visually
            const updateTrimRegion = () => {
                trimRegion.style.left = `${startPos}%`;
                trimRegion.style.width = `${endPos - startPos}%`;
                trimStart.value = startPos;
                trimEnd.value = endPos;
            };
            
            // Initialize trim region
            updateTrimRegion();
            
            // Handle dragging
            const handleDrag = (handle, isLeft) => {
                let isDragging = false;
                let startX;
                let startLeft;
                
                handle.addEventListener('mousedown', (e) => {
                    isDragging = true;
                    startX = e.clientX;
                    startLeft = isLeft ? startPos : endPos;
                    document.body.style.cursor = 'ew-resize';
                });
                
                document.addEventListener('mousemove', (e) => {
                    if (!isDragging) return;
                    
                    const dx = e.clientX - startX;
                    const containerWidth = waveformContainer.offsetWidth;
                    const newPos = Math.max(0, Math.min(100, startLeft + (dx / containerWidth * 100)));
                    
                    if (isLeft) {
                        startPos = Math.min(newPos, endPos - 1);
                        handle.style.left = `${startPos}%`;
                    } else {
                        endPos = Math.max(newPos, startPos + 1);
                        handle.style.left = `${endPos}%`;
                    }
                    
                    updateTrimRegion();
                });
                
                document.addEventListener('mouseup', () => {
                    isDragging = false;
                    document.body.style.cursor = '';
                });
            };
            
            handleDrag(leftHandle, true);
            handleDrag(rightHandle, false);
            
            // Show trim controls
            trimControls.style.display = 'block';
        });

        const applyTrimBtn = trimControls.querySelector('.btn-apply-trim');
        const cancelTrimBtn = trimControls.querySelector('.btn-cancel-trim');
        const trimStart = trimControls.querySelector('.trim-start');
        const trimEnd = trimControls.querySelector('.trim-end');

        applyTrimBtn.addEventListener('click', () => {
            const channel = window.audioEngine.channels[channelId];
            if (!channel.buffer) return;

            const duration = channel.buffer.duration;
            const startTime = (trimStart.value / 100) * duration;
            const endTime = (trimEnd.value / 100) * duration;

            window.audioEngine.trimBuffer(channelId, startTime, endTime);
            
            if (activeTrimOverlay) {
                activeTrimOverlay.remove();
                activeTrimOverlay = null;
            }
            trimControls.style.display = 'none';
            trimBtn.classList.remove('active');
        });

        cancelTrimBtn.addEventListener('click', () => {
            if (activeTrimOverlay) {
                activeTrimOverlay.remove();
                activeTrimOverlay = null;
            }
            trimControls.style.display = 'none';
            trimBtn.classList.remove('active');
        });

        // Loop button
        let isLooping = false;
        loopBtn.addEventListener('click', () => {
            isLooping = !isLooping;
            loopBtn.classList.toggle('active', isLooping);
            window.audioEngine.setLooping(channelId, isLooping);
        });

        // FX dropdown with improved handling
        fxBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const wasOpen = fxDropdown.classList.contains('show');
            
            // Close all other dropdowns first
            document.querySelectorAll('.fx-dropdown.show').forEach(dropdown => {
                if (dropdown !== fxDropdown) {
                    dropdown.classList.remove('show');
                }
            });
            
            fxDropdown.classList.toggle('show', !wasOpen);
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!fxContainer.contains(e.target)) {
                fxDropdown.classList.remove('show');
            }
        });

        // Effect options with improved handling
        fxOptions.forEach(option => {
            option.addEventListener('click', () => {
                const effectType = option.dataset.effect;
                let effect;

                try {
                    switch (effectType) {
                        case 'echo':
                            effect = window.audioEngine.createEchoEffect();
                            window.audioEngine.addEffect(channelId, effect);
                            createEchoControls(channelId, effect, effectControls);
                            break;
                        case 'pitch':
                            effect = window.audioEngine.createPitchEffect();
                            window.audioEngine.addEffect(channelId, effect);
                            createPitchControls(channelId, effect, effectControls);
                            break;
                        case 'reverb':
                            effect = window.audioEngine.createReverbEffect();
                            window.audioEngine.addEffect(channelId, effect);
                            createReverbControls(channelId, effect, effectControls);
                            break;
                    }
                } catch (error) {
                    console.error('Failed to add effect:', error);
                }

                fxDropdown.classList.remove('show');
            });
        });

        // Enable "Add to Platform" button when channel has recorded audio
        document.addEventListener('waveformUpdate', (e) => {
            if (e.detail.channelId === channelId) {
                addToPlatformBtn.disabled = false;
            }
        });

        // Add to Platform functionality
        addToPlatformBtn.addEventListener('click', () => {
            const isInPlatform = platformChannels.has(channelId);
            
            if (isInPlatform) {
                // Remove from platform
                platformChannels.delete(channelId);
                addToPlatformBtn.classList.remove('active');
                addToPlatformBtn.title = 'Add to Platform';
                const trackElement = platformTracks.querySelector(`#platform-track-${channelId}`);
                if (trackElement) {
                    trackElement.remove();
                }
            } else {
                // Add to platform
                platformChannels.add(channelId);
                addToPlatformBtn.classList.add('active');
                addToPlatformBtn.title = 'Remove from Platform';
                
                // Create and add platform track
                const trackElement = createPlatformTrack(channelId);
                platformTracks.appendChild(trackElement);
            }
            
            updatePlatformButtons();
        });

        // Delete functionality with proper cleanup
        deleteBtn.addEventListener('click', () => {
            // Stop any ongoing playback
            window.audioEngine.stopChannel(channelId);
            
            // Remove from platform if present
            if (platformChannels.has(channelId)) {
                platformChannels.delete(channelId);
                const trackElement = platformTracks.querySelector(`#platform-track-${channelId}`);
                if (trackElement) {
                    trackElement.remove();
                }
                updatePlatformButtons();
            }
            
            // Full cleanup of audio engine state
            window.audioEngine.cleanup(channelId);
            
            // Reset channel UI
            channelElement.querySelector('.waveform-container').innerHTML = '';
            channelElement.querySelector('.effect-controls').innerHTML = '';
            
            // Reset all controls and states
            playBtn.disabled = true;
            playBtn.innerHTML = '<i class="fas fa-play"></i>';
            playBtn.classList.remove('playing');
            loopBtn.disabled = true;
            loopBtn.classList.remove('active');
            trimBtn.disabled = true;
            restartBtn.disabled = true;
            addToPlatformBtn.disabled = true;
            addToPlatformBtn.classList.remove('active');
            
            // Reset recording state completely
            isRecording = false;
            recordBtn.classList.remove('recording');
            recordBtn.innerHTML = '<i class="fas fa-circle"></i>';
            recordBtn.title = 'Record';
            
            // Hide trim controls
            trimControls.style.display = 'none';
            
            // Reset volume
            volumeSlider.value = 1;
            window.audioEngine.setVolume(channelId, 1);
            
            // Remove all classes that might affect state
            channelElement.classList.remove('active', 'recording', 'playing');
            
            // Add delete animation
            channelElement.classList.add('deleted');
            setTimeout(() => {
                channelElement.classList.remove('deleted');
            }, 1000);
        });
    }

    function createEchoControls(channelId, effect, container) {
        const controls = document.createElement('div');
        controls.className = 'effect-params';
        controls.innerHTML = `
            <h3><i class="fas fa-wave-square"></i> Echo</h3>
            <label>Delay Time: <input type="range" class="echo-delay" min="0.1" max="1" step="0.1" value="0.5"></label>
            <label>Feedback: <input type="range" class="echo-feedback" min="0" max="0.9" step="0.1" value="0.5"></label>
            <button class="btn-remove-effect">
                <i class="fas fa-trash"></i>
            </button>
        `;

        const delayInput = controls.querySelector('.echo-delay');
        const feedbackInput = controls.querySelector('.echo-feedback');
        const removeBtn = controls.querySelector('.btn-remove-effect');

        delayInput.addEventListener('input', () => {
            effects.updateEffectParams(channelId, effect, {
                delayTime: parseFloat(delayInput.value)
            });
        });

        feedbackInput.addEventListener('input', () => {
            effects.updateEffectParams(channelId, effect, {
                feedback: parseFloat(feedbackInput.value)
            });
        });

        removeBtn.addEventListener('click', () => {
            effects.removeEffect(channelId, effect);
            controls.remove();
        });

        container.appendChild(controls);
    }

    function createPitchControls(channelId, effect, container) {
        const controls = document.createElement('div');
        controls.className = 'effect-params';
        controls.innerHTML = `
            <h3><i class="fas fa-music"></i> Pitch Shift</h3>
            <label>Pitch Ratio: <input type="range" class="pitch-ratio" min="0.5" max="2" step="0.1" value="1.0"></label>
            <button class="btn-remove-effect">
                <i class="fas fa-trash"></i>
            </button>
        `;

        const ratioInput = controls.querySelector('.pitch-ratio');
        const removeBtn = controls.querySelector('.btn-remove-effect');

        ratioInput.addEventListener('input', () => {
            effects.updateEffectParams(channelId, effect, {
                pitchRatio: parseFloat(ratioInput.value)
            });
        });

        removeBtn.addEventListener('click', () => {
            effects.removeEffect(channelId, effect);
            controls.remove();
        });

        container.appendChild(controls);
    }

    function createReverbControls(channelId, effect, container) {
        const controls = document.createElement('div');
        controls.className = 'effect-params';
        controls.innerHTML = `
            <h3><i class="fas fa-church"></i> Reverb</h3>
            <label>Duration: <input type="range" class="reverb-duration" min="0.1" max="5" step="0.1" value="2"></label>
            <label>Decay: <input type="range" class="reverb-decay" min="0.1" max="0.9" step="0.1" value="0.5"></label>
            <button class="btn-remove-effect">
                <i class="fas fa-trash"></i>
            </button>
        `;

        const durationInput = controls.querySelector('.reverb-duration');
        const decayInput = controls.querySelector('.reverb-decay');
        const removeBtn = controls.querySelector('.btn-remove-effect');

        durationInput.addEventListener('input', () => {
            effects.updateEffectParams(channelId, effect, {
                duration: parseFloat(durationInput.value)
            });
        });

        decayInput.addEventListener('input', () => {
            effects.updateEffectParams(channelId, effect, {
                decay: parseFloat(decayInput.value)
            });
        });

        removeBtn.addEventListener('click', () => {
            effects.removeEffect(channelId, effect);
            controls.remove();
        });

        container.appendChild(controls);
    }

    function setupGlobalControls() {
        const globalRecord = document.getElementById('globalRecord');
        const globalPlay = document.getElementById('globalPlay');
        let isRecording = false;
        let globalRecorder = null;
        let globalChunks = [];

        globalRecord.addEventListener('click', async () => {
            if (!isRecording) {
                const ctx = window.audioEngine.audioContext;
                const destination = ctx.createMediaStreamDestination();
                
                // Connect all active channels to the destination
                window.audioEngine.channels.forEach(channel => {
                    if (channel.source && channel.isPlaying) {
                        channel.gainNode.connect(destination);
                    }
                });

                globalRecorder = new MediaRecorder(destination.stream);
                globalChunks = [];

                globalRecorder.ondataavailable = e => globalChunks.push(e.data);
                globalRecorder.onstop = async () => {
                    const blob = new Blob(globalChunks, { type: 'audio/webm' });
                    const arrayBuffer = await blob.arrayBuffer();
                    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
                    
                    window.audioEngine.globalMix = {
                        buffer: audioBuffer,
                        source: null
                    };

                    globalPlay.disabled = false;
                };

                globalRecorder.start();
                globalRecord.classList.add('recording');
                globalRecord.innerHTML = '<i class="fas fa-stop"></i>';
                isRecording = true;
            } else {
                if (globalRecorder && globalRecorder.state === 'recording') {
                    globalRecorder.stop();
                    globalRecord.classList.remove('recording');
                    globalRecord.innerHTML = '<i class="fas fa-circle"></i>';
                    isRecording = false;
                }
            }
        });

        globalPlay.addEventListener('click', () => {
            if (!window.audioEngine.globalMix || !window.audioEngine.globalMix.buffer) return;

            if (globalPlay.classList.contains('playing')) {
                if (window.audioEngine.globalMix.source) {
                    window.audioEngine.globalMix.source.stop();
                    window.audioEngine.globalMix.source = null;
                }
                globalPlay.innerHTML = '<i class="fas fa-play"></i>';
                globalPlay.classList.remove('playing');
            } else {
                const source = window.audioEngine.audioContext.createBufferSource();
                source.buffer = window.audioEngine.globalMix.buffer;
                source.connect(window.audioEngine.audioContext.destination);
                source.start(0);
                window.audioEngine.globalMix.source = source;
                globalPlay.innerHTML = '<i class="fas fa-pause"></i>';
                globalPlay.classList.add('playing');

                source.onended = () => {
                    globalPlay.innerHTML = '<i class="fas fa-play"></i>';
                    globalPlay.classList.remove('playing');
                    window.audioEngine.globalMix.source = null;
                };
            }
        });
    }

    // Platform playback with RGB effects
    platformPlay.addEventListener('click', () => {
        if (isPlatformPlaying) {
            // Stop all platform channels
            platformChannels.forEach(channelId => {
                window.audioEngine.stopChannel(channelId);
                const channel = document.querySelector(`#channel-${channelId}`);
                const playBtn = channel.querySelector('.btn-play');
                playBtn.innerHTML = '<i class="fas fa-play"></i>';
                playBtn.classList.remove('playing');
                channel.classList.remove('active');
            });
            platformPlay.innerHTML = '<i class="fas fa-play"></i>';
            isPlatformPlaying = false;
        } else {
            // Start all platform channels with their offsets
            platformChannels.forEach(channelId => {
                const trackElement = platformTracks.querySelector(`#platform-track-${channelId}`);
                const offset = parseFloat(trackElement.dataset.offset) || 0;
                const channel = document.querySelector(`#channel-${channelId}`);
                
                window.audioEngine.setLooping(channelId, true);
                
                setTimeout(() => {
                    window.audioEngine.playChannel(channelId);
                    const playBtn = channel.querySelector('.btn-play');
                    playBtn.innerHTML = '<i class="fas fa-pause"></i>';
                    playBtn.classList.add('playing');
                    channel.classList.add('active');
                }, offset * 1000);
            });
            platformPlay.innerHTML = '<i class="fas fa-pause"></i>';
            isPlatformPlaying = true;
        }
        updatePlatformButtons();
    });

    platformStop.addEventListener('click', () => {
        platformChannels.forEach(channelId => {
            window.audioEngine.stopChannel(channelId);
            const channel = document.querySelector(`#channel-${channelId}`);
            const playBtn = channel.querySelector('.btn-play');
            playBtn.innerHTML = '<i class="fas fa-play"></i>';
            playBtn.classList.remove('playing');
        });
        platformPlay.innerHTML = '<i class="fas fa-play"></i>';
        isPlatformPlaying = false;
        updatePlatformButtons();
    });
}); 