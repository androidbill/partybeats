import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Maximize2, Music2, Pause, Play, RotateCcw, SkipForward, Volume2
} from "lucide-react";
import { PLAYBACK_COMMAND_WINDOW_MS, PLAYBACK_SYNC_INTERVAL_MS } from "../constants";
import { formatDuration, timestampMs, trackDisplay } from "../utils";
import { Equalizer } from "./ui";

function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve();
  if (window.partyBeatsYouTubeApi) return window.partyBeatsYouTubeApi;
  window.partyBeatsYouTubeApi = new Promise((resolve) => {
    window.onYouTubeIframeAPIReady = () => resolve();
    if (!document.querySelector("script[src='https://www.youtube.com/iframe_api']")) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(script);
    }
  });
  return window.partyBeatsYouTubeApi;
}

/* Live playback position derived from the shared playback doc. */
export function usePlaybackPosition(playback, now) {
  return useMemo(() => {
    if (!playback?.playbackSongId) return { seconds: 0, playing: false };
    const base = Math.max(0, Number(playback.playbackSeconds) || 0);
    const playing = playback.playbackState === "playing";
    const updatedAt = timestampMs(playback.playbackUpdatedAt);
    const elapsed = playing && updatedAt ? Math.max(0, (now - updatedAt) / 1000) : 0;
    return { seconds: base + elapsed, playing };
  }, [playback, now]);
}

export default function Player({
  room, playback, nowPlayingSong, upcomingCount, isAdmin, isPlayerDevice,
  user, deviceId, now, actions, showToast
}) {
  const { seconds, playing } = usePlaybackPosition(playback, now);
  const display = nowPlayingSong ? trackDisplay(nowPlayingSong) : null;
  const duration = Number(nowPlayingSong?.durationSeconds) || 0;
  const progress = duration ? Math.min(100, (seconds / duration) * 100) : 0;
  const stageRef = useRef(null);
  const [volumeOpen, setVolumeOpen] = useState(false);

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await stageRef.current?.requestFullscreen();
    } catch {
      showToast("Fullscreen was blocked by the browser.");
    }
  }

  return (
    <section className={playing ? "stage is-live" : "stage"} ref={stageRef}>
      <div className="stage-glow" aria-hidden="true" />
      <div className="stage-media">
        {isPlayerDevice && nowPlayingSong?.videoId ? (
          <YouTubeStage
            key={room.id}
            song={nowPlayingSong}
            playback={playback}
            roomVolume={room.roomVolume}
            user={user}
            deviceId={deviceId}
            actions={actions}
          />
        ) : nowPlayingSong ? (
          <div className="stage-art" style={{ "--art": `url("${nowPlayingSong.thumbnail}")` }}>
            <img src={nowPlayingSong.thumbnail} alt="" />
          </div>
        ) : (
          <div className="stage-empty">
            <Music2 aria-hidden="true" />
            <p>The stage is quiet</p>
            <span>Add the first track and get this party started.</span>
          </div>
        )}
      </div>

      {nowPlayingSong && (
        <div className="stage-meta">
          <div className="stage-titles">
            <span className="stage-eyebrow">
              <Equalizer paused={!playing} />
              {playing ? "Now playing" : "Paused"}
              {!isPlayerDevice && room.activeDjName && <em> · sound on {room.activeDjName}'s device</em>}
            </span>
            <h2>{display.title}</h2>
            <p>{display.artist} · added by {nowPlayingSong.addedByName || "a guest"}</p>
          </div>

          <div className="stage-progress" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
            <div className="stage-progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="stage-times">
            <span>{formatDuration(seconds)}</span>
            <span>{duration ? formatDuration(duration) : "—"}</span>
          </div>

          {isAdmin && (
            <div className="stage-controls">
              <button className="control" onClick={actions.restart} type="button" title="Restart track">
                <RotateCcw aria-hidden="true" />
              </button>
              <button className="control control-primary" onClick={actions.togglePlay} type="button" aria-label={playing ? "Pause" : "Play"}>
                {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
              </button>
              <button className="control" onClick={actions.playNext} type="button" title="Play next track" disabled={!upcomingCount}>
                <SkipForward aria-hidden="true" />
              </button>
              <button
                className={volumeOpen ? "control is-active" : "control"}
                onClick={() => setVolumeOpen((open) => !open)}
                type="button"
                title="Room volume"
              >
                <Volume2 aria-hidden="true" />
              </button>
              {isPlayerDevice && (
                <button className="control" onClick={toggleFullscreen} type="button" title="Fullscreen">
                  <Maximize2 aria-hidden="true" />
                </button>
              )}
            </div>
          )}

          {isAdmin && volumeOpen && (
            <label className="volume-row">
              <span>Volume</span>
              <input
                type="range"
                min="0"
                max="100"
                defaultValue={room.roomVolume ?? 80}
                onChange={(event) => actions.setVolume(Number(event.target.value))}
              />
            </label>
          )}
        </div>
      )}
    </section>
  );
}

/* Only mounted on the active player device. Owns the iframe and the shared clock. */
function YouTubeStage({ song, playback, roomVolume, user, deviceId, actions }) {
  const containerRef = useRef(null);
  const playerRef = useRef(null);
  const readyRef = useRef(false);
  const handledCommandRef = useRef("");
  const loadedVideoRef = useRef("");
  const latest = useRef({ song, playback, actions });
  latest.current = { song, playback, actions };

  // Create the player once.
  useEffect(() => {
    let cancelled = false;
    loadYouTubeApi().then(() => {
      if (cancelled || !containerRef.current) return;
      playerRef.current = new window.YT.Player(containerRef.current, {
        width: "100%",
        height: "100%",
        playerVars: { autoplay: 1, playsinline: 1, rel: 0, controls: 1 },
        events: {
          onReady: () => {
            readyRef.current = true;
            const current = latest.current;
            if (current.song?.videoId) {
              loadedVideoRef.current = current.song.videoId;
              playerRef.current.loadVideoById(current.song.videoId, Number(current.playback?.playbackSeconds) || 0);
            }
          },
          onStateChange: (event) => {
            const current = latest.current;
            const player = playerRef.current;
            if (!player || !current.song) return;
            const time = Math.floor(player.getCurrentTime?.() || 0);
            if (event.data === window.YT.PlayerState.ENDED) {
              current.actions.playNext();
            } else if (event.data === window.YT.PlayerState.PLAYING) {
              current.actions.syncPlayback(current.song.id, time, "playing");
            } else if (event.data === window.YT.PlayerState.PAUSED) {
              current.actions.syncPlayback(current.song.id, time, "paused");
            }
          },
          onError: (event) => {
            latest.current.actions.handleUnavailable(latest.current.song, event.data);
          }
        }
      });
    });
    return () => {
      cancelled = true;
      playerRef.current?.destroy?.();
      playerRef.current = null;
      readyRef.current = false;
    };
  }, []);

  // Load new tracks.
  useEffect(() => {
    if (!readyRef.current || !song?.videoId || loadedVideoRef.current === song.videoId) return;
    loadedVideoRef.current = song.videoId;
    playerRef.current?.loadVideoById(song.videoId, 0);
  }, [song?.videoId]);

  // Apply room volume.
  useEffect(() => {
    if (readyRef.current && typeof roomVolume === "number") {
      playerRef.current?.setVolume?.(Math.max(0, Math.min(100, roomVolume)));
    }
  }, [roomVolume]);

  // Apply remote commands from other admin devices.
  useEffect(() => {
    const command = playback?.playbackCommand;
    const commandId = playback?.playbackCommandId || "";
    if (!command || !commandId || commandId === handledCommandRef.current) return;
    if (commandId.startsWith(deviceId)) { handledCommandRef.current = commandId; return; }
    const at = timestampMs(playback.playbackCommandAt);
    if (at && Date.now() - at > PLAYBACK_COMMAND_WINDOW_MS) return;
    handledCommandRef.current = commandId;
    const player = playerRef.current;
    if (!readyRef.current || !player) return;
    if (command === "play") player.playVideo?.();
    else if (command === "pause") player.pauseVideo?.();
    else if (command === "restart") { player.seekTo?.(0, true); player.playVideo?.(); }
  }, [playback?.playbackCommandId, playback?.playbackCommand, playback?.playbackCommandAt, deviceId]);

  // Heartbeat: keep the shared clock honest while playing.
  useEffect(() => {
    const timer = window.setInterval(() => {
      const player = playerRef.current;
      const current = latest.current;
      if (!readyRef.current || !player || !current.song) return;
      if (player.getPlayerState?.() === window.YT?.PlayerState?.PLAYING) {
        current.actions.syncPlayback(current.song.id, Math.floor(player.getCurrentTime?.() || 0), "playing");
      }
    }, PLAYBACK_SYNC_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="youtube-frame">
      <div ref={containerRef} />
    </div>
  );
}
