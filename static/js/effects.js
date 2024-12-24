class Effects {
    constructor(audioEngine) {
        this.audioEngine = audioEngine;
        this.activeEffects = new Map(); // channelId -> effects array
    }

    initializeChannel(channelId) {
        if (!this.activeEffects.has(channelId)) {
            this.activeEffects.set(channelId, []);
        }
    }

    addEchoEffect(channelId, delayTime = 0.5, feedback = 0.5) {
        this.initializeChannel(channelId);
        const echo = this.audioEngine.createEchoEffect(delayTime, feedback);
        this.activeEffects.get(channelId).push({
            type: 'echo',
            node: echo,
            params: { delayTime, feedback }
        });
        this.audioEngine.addEffect(channelId, echo);
        return echo;
    }

    addPitchEffect(channelId, pitchRatio = 1.0) {
        this.initializeChannel(channelId);
        const pitch = this.audioEngine.createPitchEffect(pitchRatio);
        this.activeEffects.get(channelId).push({
            type: 'pitch',
            node: pitch,
            params: { pitchRatio }
        });
        this.audioEngine.addEffect(channelId, pitch);
        return pitch;
    }

    addReverbEffect(channelId, duration = 2, decay = 0.5) {
        this.initializeChannel(channelId);
        const reverb = this.audioEngine.createReverbEffect(duration, decay);
        this.activeEffects.get(channelId).push({
            type: 'reverb',
            node: reverb,
            params: { duration, decay }
        });
        this.audioEngine.addEffect(channelId, reverb);
        return reverb;
    }

    removeEffect(channelId, effectNode) {
        const effects = this.activeEffects.get(channelId);
        if (!effects) return;

        const index = effects.findIndex(effect => effect.node === effectNode);
        if (index > -1) {
            effects.splice(index, 1);
            this.audioEngine.removeEffect(channelId, effectNode);
        }
    }

    removeAllEffects(channelId) {
        const effects = this.activeEffects.get(channelId);
        if (!effects) return;

        effects.forEach(effect => {
            this.audioEngine.removeEffect(channelId, effect.node);
        });
        effects.length = 0;
    }

    updateEffectParams(channelId, effectNode, params) {
        const effects = this.activeEffects.get(channelId);
        if (!effects) return;

        const effect = effects.find(e => e.node === effectNode);
        if (!effect) return;

        switch (effect.type) {
            case 'echo':
                if (params.delayTime !== undefined) {
                    effect.node.delayTime.value = params.delayTime;
                }
                if (params.feedback !== undefined) {
                    effect.node.feedback.gain.value = params.feedback;
                }
                break;

            case 'pitch':
                if (params.pitchRatio !== undefined) {
                    effect.params.pitchRatio = params.pitchRatio;
                    // Re-create pitch effect with new ratio
                    this.removeEffect(channelId, effect.node);
                    this.addPitchEffect(channelId, params.pitchRatio);
                }
                break;

            case 'reverb':
                if (params.duration !== undefined || params.decay !== undefined) {
                    const duration = params.duration ?? effect.params.duration;
                    const decay = params.decay ?? effect.params.decay;
                    // Re-create reverb with new parameters
                    this.removeEffect(channelId, effect.node);
                    this.addReverbEffect(channelId, duration, decay);
                }
                break;
        }
    }

    getActiveEffects(channelId) {
        return this.activeEffects.get(channelId) || [];
    }
} 