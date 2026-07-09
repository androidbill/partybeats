import React, { useRef, useState } from "react";
import { ExternalLink, Link2, Plus, Search } from "lucide-react";
import { NON_ADMIN_MAX_SONG_SECONDS, YOUTUBE_API_KEY } from "../constants";
import {
  extractYouTubeVideoId, fetchVideoDetails, formatCountdown,
  formatDuration, searchYouTube
} from "../utils";
import { Modal } from "./ui";

export default function AddMusic({
  room, isAdmin, cooldownRemainingMs, onAdd, onClose, showToast
}) {
  const searchEnabled = Boolean(YOUTUBE_API_KEY) && room.internalSearchEnabled !== false;
  const [mode, setMode] = useState(searchEnabled ? "search" : "link");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [link, setLink] = useState("");
  const [addingId, setAddingId] = useState("");
  const inputRef = useRef(null);

  const cooldownActive = !isAdmin && cooldownRemainingMs > 0;

  async function runSearch(event) {
    event?.preventDefault();
    const text = query.trim();
    if (!text) return;
    setSearching(true);
    try {
      setResults(await searchYouTube(text));
    } catch {
      showToast("Search is unavailable right now. Paste a YouTube link instead.");
      setMode("link");
    } finally {
      setSearching(false);
    }
  }

  async function validateAndAdd(track) {
    if (cooldownActive) {
      showToast(`Cooldown: you can add again in ${formatCountdown(cooldownRemainingMs)}.`);
      return;
    }
    if (addingId) return;
    setAddingId(track.videoId);
    try {
      // Preflight so a broken track never lands in the shared queue.
      const details = YOUTUBE_API_KEY ? await fetchVideoDetails(track.videoId) : track;
      if (!details) {
        showToast("Couldn't verify that track. Try another.");
        return;
      }
      if (details.embeddable === false) {
        showToast("That video can't play inside PartyBeats.");
        return;
      }
      const duration = details.durationSeconds || track.durationSeconds || null;
      if (!isAdmin && !duration) {
        showToast("Couldn't verify the track length. Ask a host to add it.");
        return;
      }
      if (!isAdmin && duration > NON_ADMIN_MAX_SONG_SECONDS) {
        showToast("Only hosts can add tracks longer than 10 minutes.");
        return;
      }
      const added = await onAdd({ ...track, ...details, durationSeconds: duration });
      if (added) onClose();
    } finally {
      setAddingId("");
    }
  }

  async function addFromLink(event) {
    event?.preventDefault();
    const videoId = extractYouTubeVideoId(link);
    if (!videoId) {
      showToast("That doesn't look like a YouTube link.");
      return;
    }
    const details = YOUTUBE_API_KEY ? await fetchVideoDetails(videoId) : null;
    await validateAndAdd(details || {
      videoId,
      title: "YouTube track",
      channelTitle: "YouTube",
      thumbnail: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
      durationSeconds: null,
      embeddable: true
    });
  }

  return (
    <Modal title="Add music" subtitle="Anything you add plays for the whole room." onClose={onClose} wide>
      {cooldownActive && (
        <p className="cooldown-note" role="status">
          Cooldown is on — you can add another track in <strong>{formatCountdown(cooldownRemainingMs)}</strong>.
        </p>
      )}

      <div className="segmented" role="tablist">
        {searchEnabled && (
          <button
            className={mode === "search" ? "segment is-active" : "segment"}
            onClick={() => setMode("search")}
            role="tab"
            aria-selected={mode === "search"}
            type="button"
          >
            <Search aria-hidden="true" /> Search
          </button>
        )}
        <button
          className={mode === "link" ? "segment is-active" : "segment"}
          onClick={() => setMode("link")}
          role="tab"
          aria-selected={mode === "link"}
          type="button"
        >
          <Link2 aria-hidden="true" /> Paste a link
        </button>
      </div>

      {mode === "search" ? (
        <>
          <form className="add-form" onSubmit={runSearch}>
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Song, artist, or vibe…"
              autoFocus
            />
            <button className="primary-button" type="submit" disabled={searching}>
              {searching ? "Searching…" : "Search"}
            </button>
          </form>
          <ul className="result-list">
            {results.map((track) => (
              <li key={track.videoId} className={track.embeddable === false ? "result is-blocked" : "result"}>
                <img src={track.thumbnail} alt="" loading="lazy" />
                <div className="result-main">
                  <strong>{track.title}</strong>
                  <span>
                    {track.channelTitle}
                    {track.durationSeconds ? ` · ${formatDuration(track.durationSeconds)}` : ""}
                    {track.embeddable === false ? " · can't play in rooms" : ""}
                  </span>
                </div>
                <button
                  className="primary-button"
                  onClick={() => validateAndAdd(track)}
                  disabled={Boolean(addingId) || track.embeddable === false}
                  type="button"
                >
                  <Plus aria-hidden="true" />
                  {addingId === track.videoId ? "Adding…" : "Add"}
                </button>
              </li>
            ))}
            {!searching && results.length === 0 && (
              <li className="result-hint">Search YouTube without leaving the party.</li>
            )}
          </ul>
        </>
      ) : (
        <form className="add-form add-form-stacked" onSubmit={addFromLink}>
          <input
            value={link}
            onChange={(event) => setLink(event.target.value)}
            placeholder="https://youtube.com/watch?v=…"
            autoFocus
          />
          <div className="add-form-row">
            <a
              className="chip"
              href={`https://music.youtube.com/search?q=${encodeURIComponent(query || "")}`}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink aria-hidden="true" /> Find it on YouTube Music
            </a>
            <button className="primary-button" type="submit" disabled={Boolean(addingId)}>
              <Plus aria-hidden="true" /> {addingId ? "Adding…" : "Add to queue"}
            </button>
          </div>
          <p className="muted">Copy a share link from YouTube or YouTube Music, paste it here, done.</p>
        </form>
      )}
    </Modal>
  );
}
