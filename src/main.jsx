import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Crown,
  DoorOpen,
  ExternalLink,
  LogIn,
  LogOut,
  Music2,
  Play,
  Plus,
  QrCode,
  Search,
  Shuffle,
  SkipForward,
  Sparkles,
  Trash2,
  UserRound,
  Users,
  Wand2
} from "lucide-react";
import QRCode from "qrcode";
import {
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInAnonymously,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile
} from "firebase/auth";
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch
} from "firebase/firestore";
import { auth, db, firebaseReady } from "./services/firebase";
import "./styles.css";

const ROOM_WORDS = [
  "able",
  "acid",
  "apex",
  "arch",
  "aura",
  "bass",
  "beam",
  "beat",
  "bloom",
  "bolt",
  "brio",
  "club",
  "cord",
  "dash",
  "drum",
  "echo",
  "flux",
  "funk",
  "glow",
  "groove",
  "halo",
  "hype",
  "jazz",
  "kick",
  "lava",
  "loop",
  "lyric",
  "mint",
  "mood",
  "neon",
  "nova",
  "opus",
  "peak",
  "ping",
  "plug",
  "pulse",
  "riff",
  "rise",
  "room",
  "ruby",
  "snap",
  "solo",
  "song",
  "spin",
  "star",
  "sync",
  "tone",
  "vibe",
  "wave",
  "wire"
].filter((word) => word.length === 4);

const EMOJIS = ["🔥", "💃", "🕺", "❤️", "😮", "🚀"];
const COOLDOWN_MS = 3 * 60 * 1000;
const YOUTUBE_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;

function randomRoomId() {
  const word = ROOM_WORDS[Math.floor(Math.random() * ROOM_WORDS.length)];
  const number = Math.floor(100 + Math.random() * 900);
  return `${word}${number}`.toUpperCase();
}

function normalizeRoomId(value) {
  return value.trim().replace(/\s+/g, "").toUpperCase();
}

function nicknameFor(user, fallback = "Guest") {
  return user?.displayName || user?.email?.split("@")[0] || fallback;
}

function authErrorMessage(error) {
  if (error?.code === "auth/unauthorized-domain") {
    return "Add this localhost URL to Firebase Authentication authorized domains.";
  }
  if (error?.code === "auth/operation-not-allowed") {
    return "Enable this sign-in provider in Firebase Authentication.";
  }
  if (error?.code === "auth/popup-closed-by-user") {
    return "Google sign-in was closed before it finished.";
  }
  return error?.message || "Sign-in failed. Check Firebase Authentication setup.";
}

function youtubeIdFromUrl(value) {
  const raw = value.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(raw)) return raw;

  try {
    const url = new URL(raw);
    if (url.hostname.includes("youtu.be")) {
      return url.pathname.replace("/", "").slice(0, 11);
    }
    if (url.hostname.includes("youtube.com")) {
      const fromParam = url.searchParams.get("v");
      if (fromParam) return fromParam.slice(0, 11);
      const shortsMatch = url.pathname.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
      if (shortsMatch) return shortsMatch[1];
      const embedMatch = url.pathname.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
      if (embedMatch) return embedMatch[1];
    }
  } catch {
    return "";
  }

  return "";
}

function youtubeWatchUrl(videoId) {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

function youtubeThumb(videoId) {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

function nextQueuedSong(songs, currentId) {
  if (!songs.length) return null;
  const currentIndex = songs.findIndex((song) => song.id === currentId);
  if (currentIndex < 0) return songs[0];
  return songs[currentIndex + 1] || null;
}

function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [nickname, setNickname] = useState("");
  const [roomId, setRoomId] = useState("");
  const [activeRoomId, setActiveRoomId] = useState("");
  const [room, setRoom] = useState(null);
  const [songs, setSongs] = useState([]);
  const [members, setMembers] = useState([]);
  const [toast, setToast] = useState("");
  const [songForm, setSongForm] = useState({ title: "", url: "" });
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");

  useEffect(() => {
    if (!firebaseReady) {
      setAuthLoading(false);
      return undefined;
    }
    let active = true;

    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthLoading(false);
      setNickname(nicknameFor(nextUser, ""));
    }, (error) => {
      setToast(authErrorMessage(error));
      setAuthLoading(false);
    });

    getRedirectResult(auth)
      .then((result) => {
        if (!active) return;
        if (result?.user) {
          setUser(result.user);
          setAuthLoading(false);
          setNickname(nicknameFor(result.user, ""));
        }
      })
      .catch((error) => {
        if (!active) return;
        setToast(authErrorMessage(error));
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!firebaseReady || !activeRoomId) {
      setRoom(null);
      setSongs([]);
      setMembers([]);
      return undefined;
    }

    const roomRef = doc(db, "rooms", activeRoomId);
    const songsRef = query(collection(db, "rooms", activeRoomId, "songs"), orderBy("position", "asc"));
    const membersRef = query(collection(db, "rooms", activeRoomId, "members"), orderBy("joinedAt", "asc"));

    const unsubRoom = onSnapshot(roomRef, (snap) => {
      setRoom(snap.exists() ? { id: snap.id, ...snap.data() } : null);
    });
    const unsubSongs = onSnapshot(songsRef, (snap) => {
      setSongs(snap.docs.map((item) => ({ id: item.id, ...item.data() })));
    });
    const unsubMembers = onSnapshot(membersRef, (snap) => {
      setMembers(snap.docs.map((item) => ({ id: item.id, ...item.data() })));
    });

    return () => {
      unsubRoom();
      unsubSongs();
      unsubMembers();
    };
  }, [activeRoomId]);

  useEffect(() => {
    if (!activeRoomId) {
      setQrDataUrl("");
      return;
    }
    const shareUrl = `${window.location.origin}${window.location.pathname}?room=${activeRoomId}`;
    QRCode.toDataURL(shareUrl, { margin: 1, width: 180 }).then(setQrDataUrl).catch(() => setQrDataUrl(""));
  }, [activeRoomId]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get("room");
    if (roomParam) {
      const normalized = normalizeRoomId(roomParam);
      setRoomId(normalized);
    }
  }, []);

  const isAdmin = Boolean(user && room?.adminUid === user.uid);
  const memberRecord = members.find((member) => member.id === user?.uid);
  const cooldownUntil = memberRecord?.lastAddedAt?.toMillis ? memberRecord.lastAddedAt.toMillis() + COOLDOWN_MS : 0;
  const cooldownRemaining = Math.max(0, cooldownUntil - Date.now());
  const canAddSong = isAdmin || cooldownRemaining === 0;
  const nowPlayingSong = songs.find((song) => song.id === room?.nowPlayingId) || null;

  const stats = useMemo(
    () => [
      { label: "People", value: members.length, icon: Users },
      { label: "Queued", value: songs.length, icon: Music2 },
      { label: "Room", value: activeRoomId || "----", icon: Sparkles }
    ],
    [members.length, songs.length, activeRoomId]
  );

  async function signInGoogle() {
    if (!firebaseReady) {
      setToast("Add your Firebase config first.");
      return;
    }
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    try {
      const result = await signInWithPopup(auth, provider);
      if (result?.user) {
        setUser(result.user);
        setNickname(nicknameFor(result.user, ""));
      }
    } catch (error) {
      if (["auth/popup-blocked", "auth/popup-closed-by-user", "auth/cancelled-popup-request"].includes(error.code)) {
        await signInWithRedirect(auth, provider);
        return;
      }
      setToast(authErrorMessage(error));
    }
  }

  async function signInNickname() {
    if (!firebaseReady) {
      setToast("Add your Firebase config first.");
      return;
    }
    const cleanName = nickname.trim();
    if (cleanName.length < 2) {
      setToast("Choose a nickname with at least 2 characters.");
      return;
    }
    try {
      const credential = await signInAnonymously(auth);
      await updateProfile(credential.user, { displayName: cleanName });
      setUser(credential.user);
      setNickname(cleanName);
    } catch (error) {
      setToast(authErrorMessage(error));
    }
  }

  async function createRoom() {
    if (!user || user.isAnonymous) {
      setToast("Sign in with Google to create a room.");
      return;
    }

    let nextId = "";
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const candidate = randomRoomId();
      const existing = await getDoc(doc(db, "rooms", candidate));
      if (!existing.exists()) {
        nextId = candidate;
        break;
      }
    }
    if (!nextId) {
      setToast("Could not find a free room ID. Try again.");
      return;
    }

    await setDoc(doc(db, "rooms", nextId), {
      roomId: nextId,
      adminUid: user.uid,
      adminName: nicknameFor(user),
      createdAt: serverTimestamp(),
      nowPlayingId: null
    });
    await joinRoomById(nextId);
  }

  async function joinRoomById(rawId = roomId) {
    if (!user) {
      setToast("Sign in first.");
      return;
    }
    const nextRoomId = normalizeRoomId(rawId);
    if (!/^[A-Z]{4}\d{3}$/.test(nextRoomId)) {
      setToast("Room IDs look like VIBE123.");
      return;
    }

    const roomSnap = await getDoc(doc(db, "rooms", nextRoomId));
    if (!roomSnap.exists()) {
      setToast("That room does not exist yet.");
      return;
    }

    await setDoc(
      doc(db, "rooms", nextRoomId, "members", user.uid),
      {
        uid: user.uid,
        name: nicknameFor(user, nickname.trim() || "Guest"),
        isAnonymous: user.isAnonymous,
        joinedAt: serverTimestamp()
      },
      { merge: true }
    );
    setActiveRoomId(nextRoomId);
    setRoomId(nextRoomId);
    window.history.replaceState({}, "", `${window.location.pathname}?room=${nextRoomId}`);
  }

  async function addSong(event, selectedVideo = null) {
    event?.preventDefault();
    if (!user || !activeRoomId) return;

    const videoId = selectedVideo?.videoId || youtubeIdFromUrl(songForm.url);
    if (!videoId) {
      setToast("Paste a valid YouTube URL or choose a search result.");
      return;
    }
    if (!canAddSong) {
      setToast("Non-admins have a 3 minute song cooldown.");
      return;
    }

    const title = selectedVideo?.title || songForm.title.trim() || "YouTube track";
    const thumbnail = selectedVideo?.thumbnail || youtubeThumb(videoId);
    const nextPosition = songs.reduce((max, song) => Math.max(max, Number(song.position) || 0), 0) + 1;
    const batch = writeBatch(db);
    batch.set(doc(collection(db, "rooms", activeRoomId, "songs")), {
      title,
      artist: selectedVideo?.channelTitle || "YouTube",
      link: youtubeWatchUrl(videoId),
      provider: "youtube",
      videoId,
      thumbnail,
      addedByUid: user.uid,
      addedByName: nicknameFor(user, nickname.trim() || "Guest"),
      position: nextPosition,
      emojiByUser: {},
      createdAt: serverTimestamp()
    });
    batch.set(doc(db, "rooms", activeRoomId, "members", user.uid), { lastAddedAt: serverTimestamp() }, { merge: true });
    await batch.commit();
    setSongForm({ title: "", url: "" });
    setSearchResults([]);
  }

  async function searchYouTube(event) {
    event.preventDefault();
    const queryText = searchQuery.trim();
    if (!queryText) return;
    if (!YOUTUBE_API_KEY) {
      setToast("Add VITE_YOUTUBE_API_KEY to .env.local to search YouTube in the app.");
      return;
    }

    setSearching(true);
    try {
      const params = new URLSearchParams({
        part: "snippet",
        type: "video",
        maxResults: "8",
        videoCategoryId: "10",
        q: queryText,
        key: YOUTUBE_API_KEY
      });
      const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.message || "YouTube search failed.");
      }
      setSearchResults(
        (data.items || []).map((item) => ({
          videoId: item.id.videoId,
          title: item.snippet.title,
          channelTitle: item.snippet.channelTitle,
          thumbnail: item.snippet.thumbnails?.medium?.url || youtubeThumb(item.id.videoId)
        }))
      );
    } catch (error) {
      setToast(error.message || "YouTube search failed.");
    } finally {
      setSearching(false);
    }
  }

  async function removeSong(songId) {
    if (!isAdmin) return;
    await deleteDoc(doc(db, "rooms", activeRoomId, "songs", songId));
  }

  async function moveSong(song, direction) {
    if (!isAdmin) return;
    const currentIndex = songs.findIndex((item) => item.id === song.id);
    const swapWith = songs[currentIndex + direction];
    if (!swapWith) return;
    await Promise.all([
      updateDoc(doc(db, "rooms", activeRoomId, "songs", song.id), { position: swapWith.position }),
      updateDoc(doc(db, "rooms", activeRoomId, "songs", swapWith.id), { position: song.position })
    ]);
  }

  async function setNowPlaying(songId) {
    if (!isAdmin) return;
    await updateDoc(doc(db, "rooms", activeRoomId), { nowPlayingId: songId });
  }

  async function playNextSong() {
    if (!isAdmin || !activeRoomId) return;
    const nextSong = nextQueuedSong(songs, room?.nowPlayingId);
    await updateDoc(doc(db, "rooms", activeRoomId), { nowPlayingId: nextSong?.id || null });
  }

  async function reactToSong(song, emoji) {
    if (!user || !activeRoomId) return;
    const songRef = doc(db, "rooms", activeRoomId, "songs", song.id);
    const path = `emojiByUser.${user.uid}`;
    if (song.emojiByUser?.[user.uid] === emoji) {
      await updateDoc(songRef, { [path]: deleteField() });
      return;
    }
    await updateDoc(songRef, { [path]: emoji });
  }

  async function leaveRoom() {
    setActiveRoomId("");
    setRoom(null);
    setSongs([]);
    setMembers([]);
    window.history.replaceState({}, "", window.location.pathname);
  }

  async function handleSignOut() {
    await signOut(auth);
    await leaveRoom();
  }

  if (!firebaseReady) {
    return <SetupMissing />;
  }

  return (
    <main className="app-shell">
      <section className="hero-band">
        <div className="hero-copy">
          <div className="brand-mark">
            <Music2 aria-hidden="true" />
            <span>PartyBeats</span>
          </div>
          <h1>PartyBeats</h1>
          <p>Fast room codes, shared song queues, host control, and just enough chaos for a good night.</p>
        </div>

        <div className="auth-panel">
          {authLoading ? (
            <div className="muted">Checking session...</div>
          ) : user ? (
            <SignedIn user={user} nickname={nicknameFor(user, nickname)} onSignOut={handleSignOut} />
          ) : (
            <SignedOut
              nickname={nickname}
              setNickname={setNickname}
              onGoogle={signInGoogle}
              onNickname={signInNickname}
            />
          )}
        </div>
      </section>

      <section className="control-band">
        <div className="control-grid">
          <div className="room-card">
            <h2>Start or Join</h2>
            <p className="muted">Google users can create rooms. Nickname guests can join existing rooms.</p>
            <div className="room-actions">
              <button className="primary-action" onClick={createRoom} disabled={!user || user.isAnonymous}>
                <Wand2 aria-hidden="true" />
                Create Room
              </button>
              <div className="join-row">
                <input
                  value={roomId}
                  onChange={(event) => setRoomId(normalizeRoomId(event.target.value))}
                  placeholder="VIBE123"
                  maxLength={7}
                />
                <button onClick={() => joinRoomById()} disabled={!user}>
                  <DoorOpen aria-hidden="true" />
                  Join
                </button>
              </div>
            </div>
          </div>

          {stats.map(({ label, value, icon: Icon }) => (
            <div className="stat-tile" key={label}>
              <Icon aria-hidden="true" />
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      </section>

      {activeRoomId && room ? (
        <section className="room-workspace">
          <aside className="room-sidebar">
            <div className="room-id-block">
              <span>Room ID</span>
              <strong>{activeRoomId}</strong>
              {isAdmin && (
                <div className="admin-pill">
                  <Crown aria-hidden="true" />
                  Admin
                </div>
              )}
            </div>
            {qrDataUrl && (
              <div className="qr-block">
                <img src={qrDataUrl} alt={`Join ${activeRoomId}`} />
                <span>
                  <QrCode aria-hidden="true" />
                  Scan to join
                </span>
              </div>
            )}
            <div className="member-list">
              <h3>People</h3>
              {members.map((member) => (
                <div className="member-row" key={member.id}>
                  <UserRound aria-hidden="true" />
                  <span>{member.name}</span>
                  {member.id === room.adminUid && <Crown aria-label="Admin" />}
                </div>
              ))}
            </div>
            <button className="subtle-action" onClick={leaveRoom}>
              Leave Room
            </button>
          </aside>

          <section className="queue-panel">
            {isAdmin && (
              <div className="player-panel">
                <div className="player-copy">
                  <span>Admin Player</span>
                  <strong>{nowPlayingSong?.title || "Nothing playing"}</strong>
                  <p>{nowPlayingSong ? "Connect this device to the speaker and keep this tab open." : "Choose a song from the queue to start playback."}</p>
                </div>
                <YouTubePlayer song={nowPlayingSong} onEnded={playNextSong} />
                <div className="player-actions">
                  <button className="mini-action" onClick={playNextSong} disabled={!songs.length}>
                    <SkipForward aria-hidden="true" />
                    Next
                  </button>
                  {nowPlayingSong?.link && (
                    <a className="mini-link" href={nowPlayingSong.link} target="_blank" rel="noreferrer">
                      <ExternalLink aria-hidden="true" />
                      YouTube
                    </a>
                  )}
                </div>
              </div>
            )}

            <div className="queue-header">
              <div>
                <h2>Queue</h2>
                <p className="muted">
                  {isAdmin
                    ? "You can reorder, remove, and choose what is playing."
                    : canAddSong
                      ? "Add a track, then your cooldown starts."
                      : `Next add in ${Math.ceil(cooldownRemaining / 1000)}s.`}
                </p>
              </div>
              <button className="icon-button" onClick={() => setRoomId(randomRoomId())} title="Generate sample room code">
                <Shuffle aria-hidden="true" />
              </button>
            </div>

            <form className="youtube-search" onSubmit={searchYouTube}>
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={YOUTUBE_API_KEY ? "Search YouTube for a song" : "Add VITE_YOUTUBE_API_KEY to enable YouTube search"}
              />
              <button className="primary-action" disabled={!YOUTUBE_API_KEY || searching}>
                <Search aria-hidden="true" />
                {searching ? "Searching" : "Search"}
              </button>
            </form>

            {searchResults.length > 0 && (
              <div className="search-results">
                {searchResults.map((result) => (
                  <article className="search-result" key={result.videoId}>
                    <img src={result.thumbnail} alt="" />
                    <div>
                      <strong>{result.title}</strong>
                      <span>{result.channelTitle}</span>
                    </div>
                    <button className="mini-action" onClick={() => addSong(null, result)} disabled={!canAddSong}>
                      <Plus aria-hidden="true" />
                      Add
                    </button>
                  </article>
                ))}
              </div>
            )}

            <form className="song-form" onSubmit={addSong}>
              <input
                value={songForm.title}
                onChange={(event) => setSongForm((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="Optional title"
              />
              <input
                value={songForm.url}
                onChange={(event) => setSongForm((prev) => ({ ...prev, url: event.target.value }))}
                placeholder="Paste YouTube URL"
              />
              <button className="primary-action" disabled={!canAddSong}>
                <Plus aria-hidden="true" />
                Add URL
              </button>
            </form>

            <div className="song-list">
              {songs.length === 0 ? (
                <div className="empty-state">
                  <Music2 aria-hidden="true" />
                  <strong>No songs yet</strong>
                  <span>Drop the first track and set the tone.</span>
                </div>
              ) : (
                songs.map((song, index) => (
                  <article className={song.id === room.nowPlayingId ? "song-row is-playing" : "song-row"} key={song.id}>
                    <div className="song-position">{index + 1}</div>
                    {song.thumbnail && <img className="song-thumb" src={song.thumbnail} alt="" />}
                    <div className="song-main">
                      <div className="song-title-line">
                        <strong>{song.title}</strong>
                        {song.id === room.nowPlayingId && <span>Playing</span>}
                      </div>
                      <p>
                        {song.artist || "Unknown artist"} · added by {song.addedByName || "Guest"}
                      </p>
                      {song.link && (
                        <a href={song.link} target="_blank" rel="noreferrer">
                          Open track
                        </a>
                      )}
                      <div className="emoji-row">
                        {EMOJIS.map((emoji) => {
                          const count = Object.values(song.emojiByUser || {}).filter((value) => value === emoji).length;
                          return (
                            <button
                              className={song.emojiByUser?.[user.uid] === emoji ? "emoji-button selected" : "emoji-button"}
                              key={emoji}
                              onClick={() => reactToSong(song, emoji)}
                              type="button"
                            >
                              <span>{emoji}</span>
                              {count > 0 && <b>{count}</b>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="admin-actions">
                        <button className="icon-button" onClick={() => moveSong(song, -1)} title="Move up" disabled={index === 0}>
                          <ArrowUp aria-hidden="true" />
                        </button>
                        <button
                          className="icon-button"
                          onClick={() => moveSong(song, 1)}
                          title="Move down"
                          disabled={index === songs.length - 1}
                        >
                          <ArrowDown aria-hidden="true" />
                        </button>
                        <button className="mini-action" onClick={() => setNowPlaying(song.id)}>
                          <Play aria-hidden="true" />
                          Play
                        </button>
                        <button className="icon-button danger" onClick={() => removeSong(song.id)} title="Remove song">
                          <Trash2 aria-hidden="true" />
                        </button>
                      </div>
                    )}
                  </article>
                ))
              )}
            </div>
          </section>
        </section>
      ) : (
        <section className="welcome-board">
          <div>
            <AlertCircle aria-hidden="true" />
            <h2>Sign in, then create or join a room.</h2>
          </div>
          <p>Room IDs use a four-letter word plus three numbers, like VIBE123. Hosts manage the queue; guests add songs and react.</p>
        </section>
      )}

      {toast && (
        <button className="toast" onClick={() => setToast("")}>
          {toast}
        </button>
      )}
    </main>
  );
}

function YouTubePlayer({ song, onEnded }) {
  const containerId = useRef(`yt-player-${Math.random().toString(36).slice(2)}`);
  const playerRef = useRef(null);
  const endedRef = useRef(onEnded);

  useEffect(() => {
    endedRef.current = onEnded;
  }, [onEnded]);

  useEffect(() => {
    let cancelled = false;

    async function loadPlayer() {
      if (!song?.videoId) return;
      await loadYouTubeIframeApi();
      if (cancelled) return;

      if (playerRef.current?.destroy) {
        playerRef.current.destroy();
      }

      playerRef.current = new window.YT.Player(containerId.current, {
        videoId: song.videoId,
        playerVars: {
          autoplay: 1,
          controls: 1,
          rel: 0
        },
        events: {
          onStateChange: (event) => {
            if (event.data === window.YT.PlayerState.ENDED) {
              endedRef.current?.();
            }
          }
        }
      });
    }

    loadPlayer();

    return () => {
      cancelled = true;
    };
  }, [song?.videoId]);

  if (!song?.videoId) {
    return (
      <div className="player-empty">
        <Music2 aria-hidden="true" />
      </div>
    );
  }

  return <div className="youtube-frame" id={containerId.current} />;
}

function loadYouTubeIframeApi() {
  if (window.YT?.Player) return Promise.resolve();
  if (window.partyBeatsYouTubeApiPromise) return window.partyBeatsYouTubeApiPromise;

  window.partyBeatsYouTubeApiPromise = new Promise((resolve) => {
    const existing = document.querySelector("script[src='https://www.youtube.com/iframe_api']");
    window.onYouTubeIframeAPIReady = () => resolve();
    if (!existing) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(script);
    }
  });

  return window.partyBeatsYouTubeApiPromise;
}

function SignedOut({ nickname, setNickname, onGoogle, onNickname }) {
  return (
    <div className="signed-out">
      <button className="primary-action" onClick={onGoogle}>
        <LogIn aria-hidden="true" />
        Continue with Google
      </button>
      <div className="nickname-row">
        <input value={nickname} onChange={(event) => setNickname(event.target.value)} placeholder="Nickname" />
        <button onClick={onNickname}>Join as Guest</button>
      </div>
    </div>
  );
}

function SignedIn({ user, nickname, onSignOut }) {
  return (
    <div className="signed-in">
      <div>
        <span>{user.isAnonymous ? "Guest" : "Google"}</span>
        <strong>{nickname}</strong>
      </div>
      <button className="icon-button" onClick={onSignOut} title="Sign out">
        <LogOut aria-hidden="true" />
      </button>
    </div>
  );
}

function SetupMissing() {
  return (
    <main className="setup-missing">
      <Music2 aria-hidden="true" />
      <h1>PartyBeats needs Firebase config</h1>
      <p>Copy .env.example to .env.local and fill in the values from your Firebase web app.</p>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
