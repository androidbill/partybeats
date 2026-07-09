import React, { useState } from "react";
import { ExternalLink, Link2, Plus, Search } from "lucide-react";
import { SEARCH_PROVIDERS, YOUTUBE_API_KEY } from "../constants";
import {
  armExternalSearch, extractYouTubeVideoId, externalSearchUrl,
  fetchVideoDetails, formatCountdown, formatDuration, savedSearchProvider,
  saveSearchProvider, searchYouTube, trackAddIssue
} from "../utils";
import { Modal } from "./ui";

export default function AddMusic({
  room, isAdmin, cooldownRemainingMs, onAdd, onClose, showToast
}) {
  const inAppSearchEnabled = Boolean(YOUTUBE_API_KEY) && room.internalSearchEnabled !== false;
  const [mode, setMode] = useState("search");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [link, setLink] = useState("");
  const [addingId, setAddingId] = useState("");
  const [provider, setProvider] = useState(savedSearchProvider);
  const [wentExternal, setWentExternal] = useState(false);

  const cooldownActive = !isAdmin && cooldownRemainingMs > 0;
  const providerName = SEARCH_PROVIDERS.find((p) => p.id === provider)?.name || "YouTube Music";

  async function runInAppSearch(event) {
    event?.preventDefault();
    const text = query.trim();
    if (!text) return;
    setSearching(true);
    try {
      setResults(await searchYouTube(text));
    } catch {
      showToast(`In-app search is unavailable — try "Open ${providerName}" instead.`);
    } finally {
      setSearching(false);
    }
  }

  /* The round-trip: open the real app/site with this search, then the
     clipboard catcher grabs whatever link they copy when they come back. */
  function openExternalSearch(event) {
    event?.preventDefault();
    armExternalSearch();
    setWentExternal(true);
    window.open(externalSearchUrl(provider, query.trim()), "_blank", "noopener");
  }

  function pickProvider(id) {
    setProvider(id);
    saveSearchProvider(id);
  }

  async function validateAndAdd(track) {
    if (cooldownActive) {
      showToast(`Cooldown: you can add again in ${formatCountdown(cooldownRemainingMs)}.`);
      return;
    }
    if (addingId) return;
    setAddingId(track.videoId);
    try {
      const details = YOUTUBE_API_KEY ? await fetchVideoDetails(track.videoId) : track;
      const issue = trackAddIssue(details || track, isAdmin);
      if (issue) {
        showToast(issue);
        return;
      }
      const merged = { ...track, ...details };
      const added = await onAdd(merged);
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
    await validateAndAdd({
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
        <button
          className={mode === "search" ? "segment is-active" : "segment"}
          onClick={() => setMode("search")}
          role="tab"
          aria-selected={mode === "search"}
          type="button"
        >
          <Search aria-hidden="true" /> Search
        </button>
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
          <form className="add-form add-form-stacked" onSubmit={inAppSearchEnabled ? runInAppSearch : openExternalSearch}>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Song, artist, or vibe…"
              autoFocus
            />
            <div className="add-form-row">
              <div className="provider-pick">
                {SEARCH_PROVIDERS.map((p) => (
                  <button
                    key={p.id}
                    className={provider === p.id ? "chip is-active" : "chip"}
                    onClick={() => pickProvider(p.id)}
                    type="button"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
              <div className="add-form-buttons">
                <button className="secondary-button" onClick={openExternalSearch} type="button">
                  <ExternalLink aria-hidden="true" /> Open {providerName}
                </button>
                {inAppSearchEnabled && (
                  <button className="primary-button" type="submit" disabled={searching}>
                    <Search aria-hidden="true" /> {searching ? "Searching…" : "Search here"}
                  </button>
                )}
              </div>
            </div>
          </form>

          {wentExternal && (
            <p className="external-hint" role="status">
              Find your song in {providerName}, tap <strong>Share → Copy link</strong>, then
              switch back here — it'll be added to the queue automatically.
            </p>
          )}

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
            {!searching && results.length === 0 && !wentExternal && (
              <li className="result-hint">
                {inAppSearchEnabled
                  ? "Search here, or open the full app for better browsing."
                  : `Type a search and open ${providerName} — copy a link there and it lands in the queue.`}
              </li>
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
            <span className="muted">YouTube and YouTube Music links both work.</span>
            <button className="primary-button" type="submit" disabled={Boolean(addingId)}>
              <Plus aria-hidden="true" /> {addingId ? "Adding…" : "Add to queue"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
