import React, { useEffect, useRef, useState } from "react";
import { ClipboardPaste, Plus, X } from "lucide-react";
import { EXTERNAL_SEARCH_MIN_AWAY_MS, YOUTUBE_API_KEY } from "../constants";
import {
  clearClipboard, disarmExternalSearch, externalSearchArmedAt,
  extractYouTubeVideoId, fetchVideoDetails, formatDuration, trackAddIssue
} from "../utils";

/*
  The return leg of the external-search round-trip.

  Armed by AddMusic when the user opens YouTube / YouTube Music. When the app
  regains focus:
    - Chrome / Edge / Android / PC: read the clipboard silently → valid link →
      add it to the queue automatically, then clear the clipboard.
    - iOS Safari / Firefox: clipboard reads require a user gesture, so a popup
      appears instead — one tap on "Paste link" reads it, shows the song, and
      an Add button finishes the job.
*/
export default function ClipboardCatch({ isAdmin, onAdd, showToast }) {
  const [phase, setPhase] = useState("hidden"); // hidden | ask | nolink | resolving | confirm | adding
  const [track, setTrack] = useState(null);
  const lastHandledRef = useRef("");
  const busyRef = useRef(false);

  async function resolveAndPresent(videoId, { auto }) {
    lastHandledRef.current = videoId;
    disarmExternalSearch();
    setPhase("resolving");
    const details = YOUTUBE_API_KEY
      ? await fetchVideoDetails(videoId)
      : {
          videoId,
          title: "YouTube track",
          channelTitle: "YouTube",
          thumbnail: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
          durationSeconds: null,
          embeddable: true
        };
    const issue = trackAddIssue(details, isAdmin);
    if (issue) {
      setPhase("hidden");
      showToast(issue);
      return;
    }
    if (auto) {
      setPhase("hidden");
      const added = await onAdd(details);
      if (added) clearClipboard();
    } else {
      setTrack(details);
      setPhase("confirm");
    }
  }

  async function handleClipboardText(text, { auto }) {
    const videoId = extractYouTubeVideoId(text);
    if (!videoId || videoId === lastHandledRef.current) {
      if (!auto) setPhase("nolink");
      return;
    }
    await resolveAndPresent(videoId, { auto });
  }

  /* Fires on every return to the app while armed. */
  useEffect(() => {
    async function onReturn() {
      if (document.visibilityState !== "visible") return;
      const armedAt = externalSearchArmedAt();
      if (!armedAt || Date.now() - armedAt < EXTERNAL_SEARCH_MIN_AWAY_MS) return;
      if (busyRef.current || phase === "confirm" || phase === "resolving") return;
      busyRef.current = true;
      try {
        const text = await navigator.clipboard.readText();
        await handleClipboardText(text, { auto: true });
      } catch {
        // Gesture required (iOS Safari, Firefox) → ask with a popup instead.
        setPhase("ask");
      } finally {
        busyRef.current = false;
      }
    }
    document.addEventListener("visibilitychange", onReturn);
    window.addEventListener("focus", onReturn);
    return () => {
      document.removeEventListener("visibilitychange", onReturn);
      window.removeEventListener("focus", onReturn);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  /* The tap that iOS/Firefox need. On iOS this shows the native paste prompt. */
  async function pasteTapped() {
    try {
      const text = await navigator.clipboard.readText();
      await handleClipboardText(text, { auto: false });
    } catch {
      setPhase("nolink");
    }
  }

  async function confirmAdd() {
    if (!track) return;
    setPhase("adding");
    const added = await onAdd(track);
    setPhase("hidden");
    setTrack(null);
    if (added) clearClipboard();
  }

  function dismiss() {
    disarmExternalSearch();
    setTrack(null);
    setPhase("hidden");
  }

  if (phase === "hidden") return null;

  return (
    <aside className="clipboard-catch" role="dialog" aria-label="Add copied song">
      <button className="clipboard-catch-close" onClick={dismiss} aria-label="Dismiss" type="button">
        <X aria-hidden="true" />
      </button>

      {(phase === "ask" || phase === "nolink") && (
        <>
          <p className="clipboard-catch-title">
            {phase === "ask" ? "Back with a song?" : "No YouTube link found yet"}
          </p>
          <p className="clipboard-catch-text">
            {phase === "ask"
              ? "Paste the link you copied and it goes straight into the queue."
              : "Copy a song's share link, then tap paste again."}
          </p>
          <button className="primary-button" onClick={pasteTapped} type="button">
            <ClipboardPaste aria-hidden="true" /> Paste link
          </button>
        </>
      )}

      {phase === "resolving" && <p className="clipboard-catch-text">Checking that link…</p>}

      {(phase === "confirm" || phase === "adding") && track && (
        <div className="clipboard-catch-track">
          <img src={track.thumbnail} alt="" />
          <div className="clipboard-catch-meta">
            <strong>{track.title}</strong>
            <span>
              {track.channelTitle}
              {track.durationSeconds ? ` · ${formatDuration(track.durationSeconds)}` : ""}
            </span>
          </div>
          <button className="primary-button" onClick={confirmAdd} disabled={phase === "adding"} type="button">
            <Plus aria-hidden="true" /> {phase === "adding" ? "Adding…" : "Add to queue"}
          </button>
        </div>
      )}
    </aside>
  );
}
