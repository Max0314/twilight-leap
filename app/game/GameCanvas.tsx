"use client";

import {
  useEffect,
  useRef,
  type MutableRefObject,
} from "react";

import { createAudioController, type AudioController } from "./audio";
import { LEVEL } from "./level";
import {
  renderGame,
  type VisualBurst,
} from "./renderer";
import {
  createGame,
  setPaused,
  stepGame,
  type GameEvent,
  type GameState,
  type InputState,
} from "./simulation";

export type GameSnapshot = {
  stars: number;
  time: number;
  mode: GameState["mode"];
};

type GameCanvasProps = {
  running: boolean;
  paused: boolean;
  restartToken: number;
  soundEnabled: boolean;
  touchInputRef: MutableRefObject<InputState>;
  onSnapshot(snapshot: GameSnapshot): void;
  onFinish(snapshot: GameSnapshot): void;
  onPauseRequest(): void;
  onRestartRequest(): void;
};

const FIXED_STEP = 1 / 60;
const MAX_CATCHUP_STEPS = 5;

export const clearInputState = (input: InputState) => {
  input.left = false;
  input.right = false;
  input.jump = false;
  input.jumpQueued = false;
};

export const setInputAction = (
  input: InputState,
  key: "left" | "right" | "jump",
  pressed: boolean,
) => {
  if (key === "jump" && pressed && !input.jump) input.jumpQueued = true;
  input[key] = pressed;
};

export const readInputFrame = (
  keyboard: InputState,
  touch: InputState,
): InputState => {
  const jumpPressed = Boolean(keyboard.jumpQueued || touch.jumpQueued);
  const input = {
    left: keyboard.left || touch.left,
    right: keyboard.right || touch.right,
    jump: keyboard.jump || touch.jump,
    jumpPressed,
  };
  keyboard.jumpQueued = false;
  touch.jumpQueued = false;
  return input;
};

export const shouldActivateShortcut = (
  code: string,
  pressed: boolean,
  repeat: boolean,
) => pressed && !repeat && (code === "Escape" || code === "KeyR");

export const shouldRequestFocusPause = (running: boolean, paused: boolean) =>
  running && !paused;

const eventPosition = (event: GameEvent, state: GameState) => {
  if (event.type === "star") {
    const star = LEVEL.stars.find((item) => item.id === event.id);
    if (star) return star;
  }
  if (event.type === "checkpoint") {
    const checkpoint = LEVEL.checkpoints[0];
    return { x: checkpoint.x + checkpoint.width / 2, y: checkpoint.y };
  }
  if (event.type === "finish") {
    return {
      x: LEVEL.finish.x + LEVEL.finish.width / 2,
      y: LEVEL.finish.y + LEVEL.finish.height / 2,
    };
  }
  return {
    x: state.player.x + state.player.width / 2,
    y: state.player.y + state.player.height / 2,
  };
};

export function GameCanvas({
  running,
  paused,
  restartToken,
  soundEnabled,
  touchInputRef,
  onSnapshot,
  onFinish,
  onPauseRequest,
  onRestartRequest,
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef(createGame(LEVEL));
  const keyboardRef = useRef<InputState>({ left: false, right: false, jump: false });
  const atlasRef = useRef<HTMLImageElement | null>(null);
  const audioRef = useRef<AudioController | null>(null);
  const burstsRef = useRef<VisualBurst[]>([]);
  const burstIdRef = useRef(0);
  const finishedRef = useRef(false);
  const runningRef = useRef(running);
  const pausedRef = useRef(paused);
  const soundRef = useRef(soundEnabled);
  const callbacksRef = useRef({
    onSnapshot,
    onFinish,
    onPauseRequest,
    onRestartRequest,
  });

  useEffect(() => {
    runningRef.current = running;
    pausedRef.current = paused;
    soundRef.current = soundEnabled;
    callbacksRef.current = {
      onSnapshot,
      onFinish,
      onPauseRequest,
      onRestartRequest,
    };
  }, [
    onFinish,
    onPauseRequest,
    onRestartRequest,
    onSnapshot,
    paused,
    running,
    soundEnabled,
  ]);

  useEffect(() => {
    stateRef.current = createGame(LEVEL);
    burstsRef.current = [];
    finishedRef.current = false;
    clearInputState(keyboardRef.current);
    clearInputState(touchInputRef.current);
    callbacksRef.current.onSnapshot({ stars: 0, time: 0, mode: "playing" });
  }, [restartToken, touchInputRef]);

  useEffect(() => {
    stateRef.current = setPaused(stateRef.current, paused);
    if (paused) {
      clearInputState(keyboardRef.current);
      clearInputState(touchInputRef.current);
    }
  }, [paused, touchInputRef]);

  useEffect(() => {
    audioRef.current?.setEnabled(soundEnabled);
  }, [soundEnabled]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) return;

    const audio = createAudioController();
    audio.setEnabled(soundRef.current);
    audioRef.current = audio;

    const atlas = new Image();
    atlas.decoding = "async";
    atlas.src = "/assets/twilight-leap-atlas.png";
    atlasRef.current = atlas;
    const handleAtlasError = () => {
      if (atlasRef.current === atlas) atlasRef.current = null;
    };
    atlas.addEventListener("error", handleAtlasError);

    const mediaReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mediaCoarse = window.matchMedia("(pointer: coarse)");
    const lowQuality = mediaCoarse.matches || (navigator.hardwareConcurrency ?? 8) <= 4;
    let reducedMotion = mediaReducedMotion.matches;
    let frameId = 0;
    let previousTime = performance.now();
    let accumulator = 0;
    let lastSnapshotAt = 0;

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      const maxDpr = mediaCoarse.matches ? 1.5 : 2;
      const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
      const width = Math.max(1, Math.round(bounds.width * dpr));
      const height = Math.max(1, Math.round(bounds.height * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
    };

    const setKey = (event: KeyboardEvent, pressed: boolean) => {
      const code = event.code;
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "Space"].includes(code)) {
        event.preventDefault();
      }
      if (code === "ArrowLeft" || code === "KeyA") {
        setInputAction(keyboardRef.current, "left", pressed);
      }
      if (code === "ArrowRight" || code === "KeyD") {
        setInputAction(keyboardRef.current, "right", pressed);
      }
      if (code === "ArrowUp" || code === "KeyW" || code === "Space") {
        setInputAction(keyboardRef.current, "jump", pressed);
      }
      if (!shouldActivateShortcut(code, pressed, event.repeat)) {
        if (pressed) void audio.resume();
        return;
      }
      if (code === "Escape" && runningRef.current) callbacksRef.current.onPauseRequest();
      if (code === "KeyR") callbacksRef.current.onRestartRequest();
      void audio.resume();
    };

    const handleKeyDown = (event: KeyboardEvent) => setKey(event, true);
    const handleKeyUp = (event: KeyboardEvent) => setKey(event, false);
    const clearHeldInput = () => {
      clearInputState(keyboardRef.current);
      clearInputState(touchInputRef.current);
    };
    const handleBlur = () => {
      clearHeldInput();
      if (shouldRequestFocusPause(runningRef.current, pausedRef.current)) {
        pausedRef.current = true;
        callbacksRef.current.onPauseRequest();
      }
    };
    const handleVisibility = () => {
      if (document.hidden) {
        handleBlur();
      }
    };
    const handleReducedMotion = (event: MediaQueryListEvent) => {
      reducedMotion = event.matches;
    };
    const handlePointer = () => void audio.resume();

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    window.addEventListener("keydown", handleKeyDown, { passive: false });
    window.addEventListener("keyup", handleKeyUp, { passive: false });
    window.addEventListener("resize", resize, { passive: true });
    window.addEventListener("blur", handleBlur);
    window.addEventListener("pointerdown", handlePointer, { passive: true });
    document.addEventListener("visibilitychange", handleVisibility);
    mediaReducedMotion.addEventListener("change", handleReducedMotion);
    resize();

    const frame = (now: number) => {
      const elapsedSeconds = Math.min(0.1, Math.max(0, (now - previousTime) / 1_000));
      previousTime = now;

      if (runningRef.current && !pausedRef.current) {
        accumulator += elapsedSeconds;
        let steps = 0;

        while (accumulator >= FIXED_STEP && steps < MAX_CATCHUP_STEPS) {
          const keyboard = keyboardRef.current;
          const touch = touchInputRef.current;
          const input = readInputFrame(keyboard, touch);
          const result = stepGame(stateRef.current, input, FIXED_STEP, LEVEL);
          stateRef.current = result.state;

          for (const event of result.events) {
            audio.play(event);
            const point = eventPosition(event, result.state);
            burstsRef.current.push({
              id: burstIdRef.current++,
              type: event.type,
              x: point.x,
              y: point.y,
              age: 0,
            });
            if (event.type === "finish" && !finishedRef.current) {
              finishedRef.current = true;
              callbacksRef.current.onFinish({
                stars: result.state.collected.length,
                time: result.state.elapsed,
                mode: result.state.mode,
              });
            }
          }

          accumulator -= FIXED_STEP;
          steps += 1;
        }

        if (steps === MAX_CATCHUP_STEPS) accumulator = 0;
      }

      burstsRef.current = burstsRef.current
        .map((burst) => ({ ...burst, age: burst.age + elapsedSeconds }))
        .filter((burst) => burst.age < 0.7);

      const bounds = canvas.getBoundingClientRect();
      const dpr = canvas.width / Math.max(1, bounds.width);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      renderGame(context, stateRef.current, LEVEL, {
        width: bounds.width,
        height: bounds.height,
        dpr,
        reducedMotion,
        lowQuality,
        time: now / 1_000,
        atlas: atlasRef.current,
        bursts: burstsRef.current,
      });

      if (now - lastSnapshotAt > 100) {
        lastSnapshotAt = now;
        callbacksRef.current.onSnapshot({
          stars: stateRef.current.collected.length,
          time: stateRef.current.elapsed,
          mode: stateRef.current.mode,
        });
      }
      frameId = requestAnimationFrame(frame);
    };

    frameId = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("resize", resize);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("pointerdown", handlePointer);
      document.removeEventListener("visibilitychange", handleVisibility);
      mediaReducedMotion.removeEventListener("change", handleReducedMotion);
      atlas.removeEventListener("error", handleAtlasError);
      audio.dispose();
      audioRef.current = null;
    };
  }, [touchInputRef]);

  return (
    <canvas
      ref={canvasRef}
      className="game-canvas"
      aria-label="暮光跃境游戏画面"
      data-testid="game-canvas"
    />
  );
}
