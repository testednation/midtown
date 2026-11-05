/**
 * Procedural Web Audio Engine & Midtown Madness Voice Dispatch for Midtown Madness 3D.
 * 100% Procedural synthesis + Web Speech API with radio bandpass filtering. Zero external file dependencies.
 */

export interface VoiceCallout {
  speaker: 'cabbie' | 'cop' | 'pedestrian' | 'announcer';
  text: string;
}

class SoundManager {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private voiceEnabled: boolean = true;
  
  // Engine audio nodes
  private engineOsc: OscillatorNode | null = null;
  private engineSubOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;

  // Drift / Tire squeal
  private skidNoise: AudioBufferSourceNode | null = null;
  private skidGain: GainNode | null = null;
  private skidFilter: BiquadFilterNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  // Police Siren (dual mode: wail & yelp)
  private sirenOsc: OscillatorNode | null = null;
  private sirenGain: GainNode | null = null;
  private sirenLfo: OscillatorNode | null = null;
  private isSirenActive: boolean = false;
  private sirenMode: 'wail' | 'yelp' = 'wail';

  // Nitro
  private nitroGain: GainNode | null = null;
  private nitroNoise: AudioBufferSourceNode | null = null;

  private isEngineRunning: boolean = false;
  private lastVoiceTime: number = 0;
  private onVoiceCalloutCallback: ((callout: VoiceCallout) => void) | null = null;

  constructor() {
    // Initialized on first interaction
  }

  public init() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.createNoiseBuffer();
    } catch {
      // AudioContext not supported
    }
  }

  public resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setVoiceCallback(cb: (callout: VoiceCallout) => void) {
    this.onVoiceCalloutCallback = cb;
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      if (this.engineGain) this.engineGain.gain.value = 0;
      if (this.skidGain) this.skidGain.gain.value = 0;
      if (this.sirenGain) this.sirenGain.gain.value = 0;
      if (this.nitroGain) this.nitroGain.gain.value = 0;
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    }
    return this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public toggleVoice(): boolean {
    this.voiceEnabled = !this.voiceEnabled;
    if (!this.voiceEnabled && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    return this.voiceEnabled;
  }

  public isVoiceEnabled(): boolean {
    return this.voiceEnabled;
  }

  private createNoiseBuffer() {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
  }

  // -------------------------------------------------------------
  // ENGINE & MECHANICAL SOUNDS
  // -------------------------------------------------------------
  public startEngine(soundType: OscillatorType = 'sawtooth', baseFreq = 80) {
    this.init();
    if (!this.ctx || this.isEngineRunning || this.isMuted) return;

    try {
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = soundType;
      this.engineOsc.frequency.setValueAtTime(baseFreq, this.ctx.currentTime);

      this.engineSubOsc = this.ctx.createOscillator();
      this.engineSubOsc.type = 'triangle';
      this.engineSubOsc.frequency.setValueAtTime(baseFreq * 0.5, this.ctx.currentTime);

      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.setValueAtTime(600, this.ctx.currentTime);
      this.engineFilter.Q.setValueAtTime(3.0, this.ctx.currentTime);

      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.setValueAtTime(0.18, this.ctx.currentTime);

      this.engineOsc.connect(this.engineFilter);
      this.engineSubOsc.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.ctx.destination);

      this.engineOsc.start();
      this.engineSubOsc.start();
      this.isEngineRunning = true;
    } catch {
      // Audio setup fallback
    }
  }

  public updateEngine(rpmRatio: number, throttle: number, speedMph: number, baseFreq = 80, maxFreq = 420) {
    if (!this.ctx || !this.engineOsc || !this.engineSubOsc || !this.engineFilter || !this.engineGain || this.isMuted) return;

    const targetFreq = baseFreq + (maxFreq - baseFreq) * (rpmRatio * 0.82 + (throttle > 0 ? 0.18 : 0));
    const now = this.ctx.currentTime;
    
    this.engineOsc.frequency.setTargetAtTime(targetFreq, now, 0.04);
    this.engineSubOsc.frequency.setTargetAtTime(targetFreq * 0.5, now, 0.04);
    this.engineFilter.frequency.setTargetAtTime(450 + rpmRatio * 1900 + (throttle > 0 ? 450 : 0), now, 0.05);

    const baseVol = 0.12 + (throttle > 0 ? 0.12 : 0.02) + Math.min(speedMph / 160, 1) * 0.08;
    this.engineGain.gain.setTargetAtTime(baseVol, now, 0.05);
  }

  public stopEngine() {
    try {
      if (this.engineOsc) {
        this.engineOsc.stop();
        this.engineOsc.disconnect();
      }
      if (this.engineSubOsc) {
        this.engineSubOsc.stop();
        this.engineSubOsc.disconnect();
      }
      this.isEngineRunning = false;
    } catch {
      // Ignore
    }
  }

  // Exhaust Backfire Pop (pop-pop-bang on high RPM decel)
  public playExhaustBackfire() {
    this.init();
    if (!this.ctx || this.isMuted || !this.noiseBuffer) return;

    try {
      const now = this.ctx.currentTime;
      const count = 1 + Math.floor(Math.random() * 3);

      for (let i = 0; i < count; i++) {
        const offset = i * (0.07 + Math.random() * 0.05);
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.noiseBuffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(450 + Math.random() * 300, now + offset);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.35, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.12);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        noise.start(now + offset);
        noise.stop(now + offset + 0.15);
      }
    } catch {
      // Audio error
    }
  }

  // Turbo Blow-Off Valve (Supercar "Pshhh-tu-tu-tu")
  public playTurboBlowOff() {
    this.init();
    if (!this.ctx || this.isMuted || !this.noiseBuffer) return;

    try {
      const now = this.ctx.currentTime;
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(2800, now);
      filter.frequency.exponentialRampToValueAtTime(900, now + 0.25);
      filter.Q.setValueAtTime(3.5, now);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      noise.start(now);
      noise.stop(now + 0.35);
    } catch {
      // Audio error
    }
  }

  // Air Brakes Release Hiss (Bus / 18-Wheeler Truck "Pssssshhh!")
  public playAirBrakesRelease() {
    this.init();
    if (!this.ctx || this.isMuted || !this.noiseBuffer) return;

    try {
      const now = this.ctx.currentTime;
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(1600, now);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      noise.start(now);
      noise.stop(now + 0.6);
    } catch {
      // Audio error
    }
  }

  // Stunt Jump Suspension Landing Thud
  public playSuspensionLandThud() {
    this.init();
    if (!this.ctx || this.isMuted) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(35, now + 0.35);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.45, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.45);
    } catch {
      // Audio error
    }
  }

  // Drift tire screech
  public setSkidIntensity(intensity: number) {
    if (!this.ctx || this.isMuted || !this.noiseBuffer) return;

    if (intensity <= 0.05) {
      if (this.skidGain) {
        this.skidGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
      }
      return;
    }

    if (!this.skidNoise || !this.skidGain) {
      try {
        this.skidNoise = this.ctx.createBufferSource();
        this.skidNoise.buffer = this.noiseBuffer;
        this.skidNoise.loop = true;

        this.skidFilter = this.ctx.createBiquadFilter();
        this.skidFilter.type = 'bandpass';
        this.skidFilter.frequency.setValueAtTime(1400, this.ctx.currentTime);
        this.skidFilter.Q.setValueAtTime(4.0, this.ctx.currentTime);

        this.skidGain = this.ctx.createGain();
        this.skidGain.gain.setValueAtTime(0, this.ctx.currentTime);

        this.skidNoise.connect(this.skidFilter);
        this.skidFilter.connect(this.skidGain);
        this.skidGain.connect(this.ctx.destination);
        this.skidNoise.start();
      } catch {
        return;
      }
    }

    const volume = Math.min(intensity * 0.32, 0.4);
    this.skidGain.gain.setTargetAtTime(volume, this.ctx.currentTime, 0.04);
  }

  // -------------------------------------------------------------
  // CRASH & DESTRUCTIBLE PROPS AUDIO
  // -------------------------------------------------------------
  public playCrash(impactSpeed = 30) {
    this.init();
    if (!this.ctx || this.isMuted) return;

    try {
      const now = this.ctx.currentTime;
      const intensity = Math.min(Math.max(impactSpeed / 60, 0.2), 1.0);

      // Low end punch thud
      const thud = this.ctx.createOscillator();
      thud.type = 'triangle';
      thud.frequency.setValueAtTime(130 * intensity, now);
      thud.frequency.exponentialRampToValueAtTime(25, now + 0.35);

      const thudGain = this.ctx.createGain();
      thudGain.gain.setValueAtTime(0.55 * intensity, now);
      thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      thud.connect(thudGain);
      thudGain.connect(this.ctx.destination);
      thud.start();
      thud.stop(now + 0.45);

      // Metal crash clatter
      if (this.noiseBuffer) {
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.noiseBuffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(950 + Math.random() * 500, now);
        filter.Q.setValueAtTime(1.8, now);

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.45 * intensity, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(this.ctx.destination);
        noise.start();
        noise.stop(now + 0.4);
      }
    } catch {
      // Audio error
    }
  }

  // Specific Prop Smashes
  public playWoodSplinter() {
    this.init();
    if (!this.ctx || this.isMuted || !this.noiseBuffer) return;

    try {
      const now = this.ctx.currentTime;
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(2200, now);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      noise.start(now);
      noise.stop(now + 0.25);
    } catch {
      // Audio error
    }
  }

  public playGlassShatter() {
    this.init();
    if (!this.ctx || this.isMuted || !this.noiseBuffer) return;

    try {
      const now = this.ctx.currentTime;
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(4200, now);
      filter.Q.setValueAtTime(6.0, now);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      noise.start(now);
      noise.stop(now + 0.45);
    } catch {
      // Audio error
    }
  }

  public playTrashCanClatter() {
    this.init();
    if (!this.ctx || this.isMuted) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(280, now);
      osc.frequency.exponentialRampToValueAtTime(90, now + 0.28);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.35);
    } catch {
      // Audio error
    }
  }

  public playHydrantGeyser() {
    this.init();
    if (!this.ctx || this.isMuted || !this.noiseBuffer) return;

    try {
      const now = this.ctx.currentTime;
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1300, now);
      filter.Q.setValueAtTime(0.8, now);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 2.0);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      noise.start();
      noise.stop(now + 2.0);
    } catch {
      // Audio error
    }
  }

  // -------------------------------------------------------------
  // SIREN & POLICE RADIO SQUELCH
  // -------------------------------------------------------------
  public playRadioSquelch() {
    this.init();
    if (!this.ctx || this.isMuted || !this.noiseBuffer) return;

    try {
      const now = this.ctx.currentTime;
      // 1. Two-tone radio beep chirp
      const beep = this.ctx.createOscillator();
      beep.type = 'sine';
      beep.frequency.setValueAtTime(1050, now);
      beep.frequency.setValueAtTime(840, now + 0.04);

      const beepGain = this.ctx.createGain();
      beepGain.gain.setValueAtTime(0.18, now);
      beepGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      beep.connect(beepGain);
      beepGain.connect(this.ctx.destination);
      beep.start(now);
      beep.stop(now + 0.09);

      // 2. Static squelch burst
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1800, now + 0.08);
      filter.Q.setValueAtTime(3.0, now + 0.08);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.15, now + 0.08);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.ctx.destination);

      noise.start(now + 0.08);
      noise.stop(now + 0.22);
    } catch {
      // Audio error
    }
  }

  public togglePoliceSiren(forceState?: boolean): boolean {
    this.init();
    if (!this.ctx) return false;

    const target = forceState !== undefined ? forceState : !this.isSirenActive;
    if (target === this.isSirenActive) return this.isSirenActive;

    if (!target) {
      if (this.sirenGain) {
        this.sirenGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
      }
      this.isSirenActive = false;
      return false;
    }

    try {
      const now = this.ctx.currentTime;
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'sawtooth';
      this.sirenOsc.frequency.setValueAtTime(780, now);

      this.sirenLfo = this.ctx.createOscillator();
      // Faster LFO for authentic arcade yelp/wail
      const lfoSpeed = this.sirenMode === 'yelp' ? 1.8 : 0.6;
      this.sirenLfo.frequency.setValueAtTime(lfoSpeed, now);

      const lfoGain = this.ctx.createGain();
      lfoGain.gain.setValueAtTime(320, now);

      this.sirenLfo.connect(lfoGain);
      lfoGain.connect(this.sirenOsc.frequency);

      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.setValueAtTime(this.isMuted ? 0 : 0.16, now);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1500, now);

      this.sirenOsc.connect(filter);
      filter.connect(this.sirenGain);
      this.sirenGain.connect(this.ctx.destination);

      this.sirenOsc.start();
      this.sirenLfo.start();
      this.isSirenActive = true;
      return true;
    } catch {
      return false;
    }
  }

  // Switch between Wail and Yelp police siren
  public switchSirenMode(): 'wail' | 'yelp' {
    this.sirenMode = this.sirenMode === 'wail' ? 'yelp' : 'wail';
    if (this.sirenLfo && this.ctx) {
      this.sirenLfo.frequency.setValueAtTime(this.sirenMode === 'yelp' ? 1.8 : 0.6, this.ctx.currentTime);
    }
    return this.sirenMode;
  }

  public playHorn(isBusOrTruck = false) {
    this.init();
    if (!this.ctx || this.isMuted) return;

    try {
      const now = this.ctx.currentTime;
      const duration = 0.45;

      const f1 = isBusOrTruck ? 175 : 375;
      const f2 = isBusOrTruck ? 220 : 470;

      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      osc1.type = isBusOrTruck ? 'sawtooth' : 'triangle';
      osc2.type = isBusOrTruck ? 'sawtooth' : 'triangle';

      osc1.frequency.setValueAtTime(f1, now);
      osc2.frequency.setValueAtTime(f2, now);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.24, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.ctx.destination);

      osc1.start();
      osc2.start();
      osc1.stop(now + duration);
      osc2.stop(now + duration);
    } catch {
      // Audio error
    }
  }

  // -------------------------------------------------------------
  // MIDTOWN MADNESS VOICE CALLOUTS (Cabbie, Cop, Pedestrian)
  // -------------------------------------------------------------
  public triggerVoiceCallout(speaker: 'cabbie' | 'cop' | 'pedestrian' | 'announcer', text?: string) {
    const now = Date.now();
    // Prevent overlapping voice spam (min 2.5s between clips)
    if (now - this.lastVoiceTime < 2400) return;
    this.lastVoiceTime = now;

    const cabbieQuotes = [
      "Hey, I'm drivin' here!",
      "Look out, pal!",
      "Nice blinker, buddy!",
      "Watch the paint job!",
      "Hold on to your coffee!",
      "Check that airtime!",
      "Get outta the street!",
      "You can't catch me, copper!",
    ];

    const copQuotes = [
      "All units, 10-43 reckless driver on Michigan Ave!",
      "Suspect is evading, authorize pit maneuver!",
      "Pull over the vehicle immediately!",
      "Suspect is taking out city property!",
      "Code 4, suspect in custody!",
    ];

    const pedQuotes = [
      "Hey! Watch where you're goin'!",
      "Crazy driver!",
      "Yikes! Watch the curb!",
      "Whoa! Outta the way!",
    ];

    const announcerQuotes = [
      "Checkpoint cleared!",
      "Speed bonus!",
      "Awesome airtime!",
      "New lap record!",
    ];

    let spokenText = text;
    if (!spokenText) {
      if (speaker === 'cabbie') spokenText = cabbieQuotes[Math.floor(Math.random() * cabbieQuotes.length)];
      else if (speaker === 'cop') spokenText = copQuotes[Math.floor(Math.random() * copQuotes.length)];
      else if (speaker === 'pedestrian') spokenText = pedQuotes[Math.floor(Math.random() * pedQuotes.length)];
      else spokenText = announcerQuotes[Math.floor(Math.random() * announcerQuotes.length)];
    }

    if (this.onVoiceCalloutCallback) {
      this.onVoiceCalloutCallback({ speaker, text: spokenText });
    }

    // Play radio squelch before cop lines
    if (speaker === 'cop') {
      this.playRadioSquelch();
    }

    if (!this.voiceEnabled || this.isMuted) return;

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(spokenText);
        utterance.rate = speaker === 'pedestrian' ? 1.35 : speaker === 'cop' ? 1.05 : 1.15;
        utterance.pitch = speaker === 'pedestrian' ? 1.4 : speaker === 'cop' ? 0.9 : 1.1;
        utterance.volume = 0.85;

        // Try to pick an English voice
        const voices = window.speechSynthesis.getVoices();
        const enVoices = voices.filter(v => v.lang.startsWith('en'));
        if (enVoices.length > 0) {
          if (speaker === 'cop' && enVoices.length > 1) {
            utterance.voice = enVoices[1];
          } else {
            utterance.voice = enVoices[0];
          }
        }
        window.speechSynthesis.speak(utterance);
      } catch {
        // Fallback gracefully
      }
    }
  }

  public playCheckpointChime() {
    this.init();
    if (!this.ctx || this.isMuted) return;

    try {
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6 arpeggio
      const now = this.ctx.currentTime;

      notes.forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.07);

        const gain = this.ctx!.createGain();
        gain.gain.setValueAtTime(0.22, now + idx * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.35);

        osc.connect(gain);
        gain.connect(this.ctx!.destination);

        osc.start(now + idx * 0.07);
        osc.stop(now + idx * 0.07 + 0.4);
      });
    } catch {
      // Audio error
    }
  }

  public playVictoryFanfare() {
    this.init();
    if (!this.ctx || this.isMuted) return;

    try {
      const notes = [440, 554.37, 659.25, 880];
      const now = this.ctx.currentTime;
      notes.forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.12);

        const gain = this.ctx!.createGain();
        gain.gain.setValueAtTime(0.28, now + idx * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.6);

        osc.connect(gain);
        gain.connect(this.ctx!.destination);

        osc.start(now + idx * 0.12);
        osc.stop(now + idx * 0.12 + 0.7);
      });
    } catch {
      // Audio error
    }
  }

  public setNitroBoost(active: boolean) {
    if (!this.ctx || this.isMuted || !this.noiseBuffer) return;

    if (!active) {
      if (this.nitroGain) {
        this.nitroGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
      }
      return;
    }

    if (!this.nitroNoise || !this.nitroGain) {
      try {
        this.nitroNoise = this.ctx.createBufferSource();
        this.nitroNoise.buffer = this.noiseBuffer;
        this.nitroNoise.loop = true;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2400, this.ctx.currentTime);

        this.nitroGain = this.ctx.createGain();
        this.nitroGain.gain.setValueAtTime(0.2, this.ctx.currentTime);

        this.nitroNoise.connect(filter);
        filter.connect(this.nitroGain);
        this.nitroGain.connect(this.ctx.destination);
        this.nitroNoise.start();
      } catch {
        return;
      }
    } else {
      this.nitroGain.gain.setTargetAtTime(0.22, this.ctx.currentTime, 0.05);
    }
  }

  public playMenuClick() {
    this.init();
    if (!this.ctx || this.isMuted) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(400, now + 0.06);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(now + 0.07);
    } catch {
      // Audio error
    }
  }
}

export const soundManager = new SoundManager();
