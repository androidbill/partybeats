import React, { useMemo, useState } from "react";
import {
  ArrowDown, ArrowUp, History, MessageCircle, Play, Smile, Trash2
} from "lucide-react";
import { EMOJIS } from "../constants";
import { formatDuration, trackDisplay } from "../utils";
import { Avatar } from "./ui";

const QUICK_EMOJIS = EMOJIS.slice(0, 8);

export default function Queue({
  upcomingSongs, playedSongs, nowPlayingId, messages, user, isAdmin,
  actions, showToast
}) {
  const [openSongId, setOpenSongId] = useState("");
  const [emojiSongId, setEmojiSongId] = useState("");
  const [drafts, setDrafts] = useState({});
  const [historyOpen, setHistoryOpen] = useState(false);

  const messagesBySong = useMemo(() => {
    const map = {};
    for (const message of messages) {
      if (!message.songId) continue;
      (map[message.songId] ||= []).push(message);
    }
    return map;
  }, [messages]);

  function sendMessage(song) {
    const text = (drafts[song.id] || "").trim().slice(0, 160);
    if (!text) return;
    actions.sendSongMessage(song.id, text);
    setDrafts((current) => ({ ...current, [song.id]: "" }));
  }

  function renderSong(song, index) {
    const display = trackDisplay(song);
    const songMessages = messagesBySong[song.id] || [];
    const reactions = Object.values(song.emojiByUser || {}).filter(Boolean);
    const reactionCounts = reactions.reduce((acc, emoji) => {
      acc[emoji] = (acc[emoji] || 0) + 1;
      return acc;
    }, {});
    const myEmoji = song.emojiByUser?.[user.uid] || "";
    const isOpen = openSongId === song.id;
    const canRemove = isAdmin || song.addedByUid === user.uid;

    return (
      <li key={song.id} className={song.unavailable ? "song is-unavailable" : "song"}>
        <div className="song-row">
          {typeof index === "number" && <span className="song-index">{index + 1}</span>}
          <img className="song-thumb" src={song.thumbnail} alt="" loading="lazy" />
          <button className="song-main" onClick={() => setOpenSongId(isOpen ? "" : song.id)} type="button">
            <strong>{display.title}</strong>
            <span>
              {display.artist}
              {song.durationSeconds ? ` · ${formatDuration(song.durationSeconds)}` : ""}
              {song.unavailable ? " · unavailable" : ""}
            </span>
            <small className="song-added-by">
              <Avatar member={{ uid: song.addedByUid, avatarId: "" }} size="xs" name={song.addedByName} />
              {song.addedByName || "Guest"}
            </small>
          </button>
          <div className="song-badges">
            {Object.entries(reactionCounts).slice(0, 3).map(([emoji, count]) => (
              <span key={emoji} className="reaction-pill">{emoji}{count > 1 ? ` ${count}` : ""}</span>
            ))}
            {songMessages.length > 0 && (
              <span className="reaction-pill"><MessageCircle aria-hidden="true" /> {songMessages.length}</span>
            )}
          </div>
        </div>

        {isOpen && (
          <div className="song-tools">
            <div className="song-actions">
              <button
                className={emojiSongId === song.id ? "chip is-active" : "chip"}
                onClick={() => setEmojiSongId(emojiSongId === song.id ? "" : song.id)}
                type="button"
              >
                <Smile aria-hidden="true" /> React
              </button>
              {isAdmin && !song.unavailable && (
                <button className="chip" onClick={() => actions.playNow(song.id)} type="button">
                  <Play aria-hidden="true" /> Play now
                </button>
              )}
              {isAdmin && typeof index === "number" && (
                <>
                  <button className="chip" onClick={() => actions.moveSong(song, -1)} disabled={index === 0} type="button" aria-label="Move up">
                    <ArrowUp aria-hidden="true" />
                  </button>
                  <button className="chip" onClick={() => actions.moveSong(song, 1)} type="button" aria-label="Move down">
                    <ArrowDown aria-hidden="true" />
                  </button>
                </>
              )}
              {canRemove && (
                <button
                  className="chip chip-danger"
                  onClick={() => { actions.removeSong(song); setOpenSongId(""); }}
                  type="button"
                >
                  <Trash2 aria-hidden="true" /> Remove
                </button>
              )}
            </div>

            {emojiSongId === song.id && (
              <div className="emoji-row">
                {QUICK_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    className={myEmoji === emoji ? "emoji-button is-active" : "emoji-button"}
                    onClick={() => actions.reactToSong(song.id, myEmoji === emoji ? "" : emoji)}
                    type="button"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}

            <div className="song-chat">
              {songMessages.map((message) => (
                <p key={message.id} className="song-message">
                  <Avatar avatarId={message.avatarId} size="xs" name={message.name} />
                  <strong>{message.name}</strong>
                  <span>{message.text}</span>
                </p>
              ))}
              <form
                className="song-chat-form"
                onSubmit={(event) => { event.preventDefault(); sendMessage(song); }}
              >
                <input
                  value={drafts[song.id] || ""}
                  onChange={(event) => setDrafts((current) => ({ ...current, [song.id]: event.target.value }))}
                  placeholder="Say something about this track…"
                  maxLength={160}
                />
                <button className="chip" type="submit">Send</button>
              </form>
            </div>
          </div>
        )}
      </li>
    );
  }

  return (
    <section className="queue">
      <header className="queue-head">
        <h3>Up next <span className="count-pill">{upcomingSongs.length}</span></h3>
        {isAdmin && upcomingSongs.length > 0 && (
          <button
            className="chip chip-danger"
            type="button"
            onClick={() => {
              if (window.confirm("Clear the entire queue for everyone?")) actions.clearQueue();
              else showToast("Queue kept.");
            }}
          >
            <Trash2 aria-hidden="true" /> Clear
          </button>
        )}
      </header>

      {upcomingSongs.length === 0 ? (
        <div className="queue-empty">
          <p>Nothing queued yet.</p>
          <span>Tap <strong>Add music</strong> and the next banger appears here for everyone.</span>
        </div>
      ) : (
        <ol className="song-list">
          {upcomingSongs.map((song, index) => renderSong(song, index))}
        </ol>
      )}

      {playedSongs.length > 0 && (
        <div className="history">
          <button className="chip" onClick={() => setHistoryOpen((open) => !open)} type="button">
            <History aria-hidden="true" /> Played earlier ({playedSongs.length})
          </button>
          {historyOpen && (
            <ul className="song-list song-list-history">
              {[...playedSongs].reverse().map((song) => renderSong(song))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
