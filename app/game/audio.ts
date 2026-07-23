import type { GameEvent } from "./simulation";

export type ToneSpec = {
  frequency: number;
  duration: number;
  offset: number;
  gain: number;
  wave: OscillatorType;
  endFrequency?: number;
};

const tone = (
  frequency: number,
  duration: number,
  offset = 0,
  gain = 0.06,
  wave: OscillatorType = "triangle",
  endFrequency?: number,
): ToneSpec => ({ frequency, duration, offset, gain, wave, endFrequency });

export function getToneForEvent(event: GameEvent): ToneSpec[] {
  switch (event.type) {
    case "jump":
      return [tone(420, 0.1, 0, 0.055, "square", 650)];
    case "land":
      return [tone(105, 0.055, 0, 0.04, "triangle", 70)];
    case "stomp":
      return [tone(190, 0.11, 0, 0.07, "square", 320)];
    case "hurt":
      return [tone(115, 0.22, 0, 0.065, "sawtooth", 58)];
    case "checkpoint":
      return [
        tone(523, 0.12, 0),
        tone(784, 0.14, 0.09),
        tone(1_046, 0.18, 0.18),
      ];
    case "finish":
      return [
        tone(523, 0.15, 0, 0.06, "sine"),
        tone(659, 0.15, 0.11, 0.06, "sine"),
        tone(784, 0.16, 0.22, 0.065, "sine"),
        tone(1_046, 0.34, 0.34, 0.075, "sine"),
      ];
    case "star":
      return [
        tone(880, 0.08, 0, 0.045, "sine"),
        tone(1_320, 0.14, 0.065, 0.05, "sine"),
      ];
  }
}

export type AudioController = {
  resume(): Promise<void>;
  setEnabled(enabled: boolean): void;
  play(event: GameEvent): void;
  dispose(): void;
};

export function createAudioController(): AudioController {
  let enabled = true;
  let context: AudioContext | null = null;

  const ensureContext = () => {
    if (context || typeof window === "undefined") return context;
    const AudioContextClass =
      window.AudioContext ??
      (window as typeof window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioContextClass) return null;
    context = new AudioContextClass();
    return context;
  };

  return {
    async resume() {
      if (!enabled) return;
      const active = ensureContext();
      if (active?.state === "suspended") await active.resume();
    },
    setEnabled(nextEnabled) {
      enabled = nextEnabled;
    },
    play(event) {
      if (!enabled) return;
      const active = ensureContext();
      if (!active || active.state !== "running") return;

      for (const spec of getToneForEvent(event)) {
        const start = active.currentTime + spec.offset;
        const end = start + spec.duration;
        const oscillator = active.createOscillator();
        const gain = active.createGain();

        oscillator.type = spec.wave;
        oscillator.frequency.setValueAtTime(spec.frequency, start);
        if (spec.endFrequency) {
          oscillator.frequency.exponentialRampToValueAtTime(spec.endFrequency, end);
        }

        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(spec.gain, start + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, end);
        oscillator.connect(gain);
        gain.connect(active.destination);
        oscillator.start(start);
        oscillator.stop(end + 0.02);
      }
    },
    dispose() {
      const active = context;
      context = null;
      if (active && active.state !== "closed") void active.close();
    },
  };
}
