"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";

import {
  GameCanvas,
  setInputAction,
  type GameSnapshot,
} from "./game/GameCanvas";
import type { InputState } from "./game/simulation";
import {
  DEFAULT_PREFS,
  loadPrefs,
  savePrefs,
  updateRecords,
  type GamePrefs,
} from "./game/storage";

type Screen = "intro" | "playing" | "paused" | "finished";

const formatTime = (value: number) => {
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  const hundredths = Math.floor((value % 1) * 100);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(hundredths).padStart(2, "0")}`;
};

export default function Home() {
  const [screen, setScreen] = useState<Screen>("intro");
  const [snapshot, setSnapshot] = useState<GameSnapshot>({
    stars: 0,
    time: 0,
    mode: "playing",
  });
  const [result, setResult] = useState<GameSnapshot | null>(null);
  const [prefs, setPrefs] = useState<GamePrefs>(DEFAULT_PREFS);
  const [restartToken, setRestartToken] = useState(0);
  const touchInputRef = useRef<InputState>({ left: false, right: false, jump: false });

  useEffect(() => {
    const frameId = requestAnimationFrame(() => setPrefs(loadPrefs()));
    return () => cancelAnimationFrame(frameId);
  }, []);

  const begin = () => {
    touchInputRef.current = { left: false, right: false, jump: false };
    setResult(null);
    setRestartToken((token) => token + 1);
    setScreen("playing");
  };

  const togglePause = () => {
    setScreen((current) => {
      if (current === "playing") return "paused";
      if (current === "paused") return "playing";
      return current;
    });
  };

  const finish = (finalSnapshot: GameSnapshot) => {
    const nextPrefs = updateRecords(prefs, finalSnapshot.time, finalSnapshot.stars);
    setPrefs(nextPrefs);
    savePrefs(nextPrefs);
    setResult(finalSnapshot);
    setScreen("finished");
  };

  const toggleSound = () => {
    setPrefs((current) => {
      const next = { ...current, sound: !current.sound };
      savePrefs(next);
      return next;
    });
  };

  const toggleScreenShake = () => {
    setPrefs((current) => {
      const next = { ...current, screenShake: !current.screenShake };
      savePrefs(next);
      return next;
    });
  };

  const setTouch = (
    key: "left" | "right" | "jump",
    pressed: boolean,
    event: PointerEvent<HTMLButtonElement>,
  ) => {
    event.preventDefault();
    if (pressed) event.currentTarget.setPointerCapture(event.pointerId);
    setInputAction(touchInputRef.current, key, pressed);
  };

  const bestTime = prefs.bestTime === null ? "—" : formatTime(prefs.bestTime);

  return (
    <main className="game-shell">
      <div className="game-stage" aria-live="off">
        <GameCanvas
          running={screen === "playing" || screen === "paused"}
          paused={screen === "paused"}
          restartToken={restartToken}
          soundEnabled={prefs.sound}
          screenShakeEnabled={prefs.screenShake}
          touchInputRef={touchInputRef}
          onSnapshot={setSnapshot}
          onFinish={finish}
          onPauseRequest={togglePause}
          onRestartRequest={begin}
        />
      </div>

      {screen !== "intro" ? (
        <header className="game-hud" aria-label="游戏状态">
          <div className="hud-stat hud-stars" aria-label={`已收集 ${snapshot.stars} 枚星辉`}>
            <span className="star-mark" aria-hidden="true">✦</span>
            <strong>{snapshot.stars} / 12</strong>
          </div>
          <time className="hud-time" aria-label={`游戏时间 ${formatTime(snapshot.time)}`}>
            {formatTime(snapshot.time)}
          </time>
          <div className="hud-actions">
            <button
              className="icon-button sound-button"
              type="button"
              onClick={toggleSound}
              aria-label={prefs.sound ? "关闭音效" : "开启音效"}
              aria-pressed={prefs.sound}
            >
              <span aria-hidden="true">{prefs.sound ? "音" : "静"}</span>
            </button>
            <button
              className="icon-button shake-button"
              type="button"
              onClick={toggleScreenShake}
              aria-label={prefs.screenShake ? "关闭画面震动" : "开启画面震动"}
              aria-pressed={prefs.screenShake}
            >
              <span aria-hidden="true">{prefs.screenShake ? "震" : "稳"}</span>
            </button>
            <button
              className="icon-button"
              type="button"
              onClick={togglePause}
              aria-label={screen === "paused" ? "继续游戏" : "暂停游戏"}
            >
              <span className={screen === "paused" ? "play-glyph" : "pause-glyph"} aria-hidden="true">
                {screen === "paused" ? <i /> : <><i /><i /></>}
              </span>
            </button>
          </div>
        </header>
      ) : null}

      {screen === "intro" ? (
        <section className="intro-layer" aria-labelledby="game-title">
          <div className="intro-card">
            <h1 id="game-title">暮光跃境</h1>
            <p className="english-title">TWILIGHT LEAP</p>
            <p className="mission">收集星辉，穿过余烬王庭，抵达星门。</p>
            <button className="primary-button" type="button" onClick={begin}>
              开始旅程
            </button>
            <div className="control-guide" aria-label="操作说明">
              <span><kbd>A</kbd><kbd>D</kbd> / 方向键移动</span>
              <span><kbd>W</kbd><kbd>空格</kbd> 跳跃 · 再按二段跳</span>
              <span>贴墙下落，按跳跃键蹬墙跳</span>
            </div>
            <p className="originality-note">原创角色与场景 · 手机和电脑均可游玩</p>
          </div>
        </section>
      ) : null}

      {screen === "paused" ? (
        <section className="modal-layer" aria-labelledby="pause-title">
          <div className="modal-card pause-card">
            <h2 id="pause-title">旅途暂歇</h2>
            <p>星火不会熄灭，准备好就继续。</p>
            <div className="modal-actions">
              <button className="primary-button" type="button" onClick={togglePause}>
                继续游戏
              </button>
              <button className="secondary-button" type="button" onClick={begin}>
                重新开始
              </button>
              <button
                className="secondary-button pause-sound-button"
                type="button"
                onClick={toggleSound}
                aria-label={prefs.sound ? "关闭音效" : "开启音效"}
                aria-pressed={prefs.sound}
              >
                音效：{prefs.sound ? "开启" : "关闭"}
              </button>
              <button
                className="secondary-button pause-shake-button"
                type="button"
                onClick={toggleScreenShake}
                aria-label={prefs.screenShake ? "关闭画面震动" : "开启画面震动"}
                aria-pressed={prefs.screenShake}
              >
                画面震动：{prefs.screenShake ? "开启" : "关闭"}
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {screen === "finished" && result ? (
        <section className="modal-layer finish-layer" aria-labelledby="finish-title">
          <div className="modal-card finish-card">
            <div className="finish-star" aria-hidden="true">✦</div>
            <h2 id="finish-title">星门已启</h2>
            <p>余烬王庭的光再次沿着旧城墙流动。</p>
            <dl className="result-grid">
              <div><dt>本次时间</dt><dd>{formatTime(result.time)}</dd></div>
              <div><dt>星辉收集</dt><dd>{result.stars} / 12</dd></div>
              <div><dt>最佳时间</dt><dd>{bestTime}</dd></div>
              <div><dt>最高收集</dt><dd>{prefs.bestStars} / 12</dd></div>
            </dl>
            <button className="primary-button" type="button" onClick={begin}>
              再次挑战
            </button>
          </div>
        </section>
      ) : null}

      {screen === "playing" ? <div className="touch-controls" aria-label="触屏操作">
        <div className="touch-move">
          <button
            type="button"
            className="touch-button direction-left"
            aria-label="向左移动"
            onPointerDown={(event) => setTouch("left", true, event)}
            onPointerUp={(event) => setTouch("left", false, event)}
            onPointerCancel={(event) => setTouch("left", false, event)}
          ><span aria-hidden="true" /></button>
          <button
            type="button"
            className="touch-button direction-right"
            aria-label="向右移动"
            onPointerDown={(event) => setTouch("right", true, event)}
            onPointerUp={(event) => setTouch("right", false, event)}
            onPointerCancel={(event) => setTouch("right", false, event)}
          ><span aria-hidden="true" /></button>
        </div>
        <button
          type="button"
          className="touch-button jump-button"
          aria-label="跳跃、二段跳或蹬墙跳"
          onPointerDown={(event) => setTouch("jump", true, event)}
          onPointerUp={(event) => setTouch("jump", false, event)}
          onPointerCancel={(event) => setTouch("jump", false, event)}
        ><span aria-hidden="true" /></button>
      </div> : null}

      <p className="portrait-tip">横屏游玩，视野更开阔</p>
    </main>
  );
}
