import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowDown,
  ArrowUp,
  Crown,
  DoorOpen,
  Download,
  ExternalLink,
  Info,
  LogIn,
  LogOut,
  MessageCircle,
  MoreVertical,
  Music2,
  Play,
  Plus,
  QrCode,
  Search,
  Share2,
  SlidersHorizontal,
  SkipForward,
  Trash2,
  UserRound,
  Wand2,
  X
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
const DEFAULT_COOLDOWN_MS = 3 * 60 * 1000;
const DEFAULT_CROSSFADE_SECONDS = 5;
const YOUTUBE_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;
const APP_VERSION = "2026.05.28.01";

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

function adminMapFor(room) {
  return {
    ...(room?.adminUid ? { [room.adminUid]: true } : {}),
    ...(room?.adminUids || {})
  };
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
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [emojiSongId, setEmojiSongId] = useState("");
  const [messageSongId, setMessageSongId] = useState("");
  const [messageDraft, setMessageDraft] = useState("");

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
      const nextRoom = snap.exists() ? { id: snap.id, ...snap.data() } : null;
      if (nextRoom?.closed) {
        setToast("Room closed because the last admin left.");
        clearRoomState();
        return;
      }
      setRoom(nextRoom);
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

  const roomAdminUids = adminMapFor(room);
  const isRoomAdminId = (uid) => Boolean(uid && roomAdminUids[uid]);
  const isAdmin = Boolean(user && isRoomAdminId(user.uid));
  const cooldownEnabled = room?.cooldownEnabled !== false;
  const cooldownMinutes = Math.min(
    30,
    Math.max(1, Number(room?.cooldownMinutes) || Math.round((Number(room?.cooldownMs) || DEFAULT_COOLDOWN_MS) / 60000))
  );
  const cooldownMs = cooldownMinutes * 60 * 1000;
  const crossfadeEnabled = room?.crossfadeEnabled !== false;
  const crossfadeSeconds = Math.min(30, Math.max(1, Number(room?.crossfadeSeconds) || DEFAULT_CROSSFADE_SECONDS));
  const memberRecord = members.find((member) => member.id === user?.uid);
  const cooldownUntil = cooldownEnabled && memberRecord?.lastAddedAt?.toMillis ? memberRecord.lastAddedAt.toMillis() + cooldownMs : 0;
  const cooldownRemaining = Math.max(0, cooldownUntil - Date.now());
  const canAddSong = isAdmin || cooldownRemaining === 0;
  const nowPlayingSong = songs.find((song) => song.id === room?.nowPlayingId) || null;

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
      adminUids: { [user.uid]: true },
      adminName: nicknameFor(user),
      createdAt: serverTimestamp(),
      closed: false,
      cooldownEnabled: true,
      cooldownMinutes: 3,
      cooldownMs: DEFAULT_COOLDOWN_MS,
      crossfadeEnabled: true,
      crossfadeSeconds: DEFAULT_CROSSFADE_SECONDS,
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
    if (roomSnap.data().closed) {
      setToast("That room has been closed.");
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

    const videoId = selectedVideo?.videoId;
    if (!videoId) {
      setToast("Choose a YouTube search result.");
      return;
    }
    if (!canAddSong) {
      setToast(`Non-admins have a ${cooldownMinutes} minute song cooldown.`);
      return;
    }

    const title = selectedVideo?.title || "YouTube track";
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
      messages: [],
      createdAt: serverTimestamp()
    });
    batch.set(doc(db, "rooms", activeRoomId, "members", user.uid), { lastAddedAt: serverTimestamp() }, { merge: true });
    await batch.commit();
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

  async function promoteMember(member) {
    if (!isAdmin || !member || member.isAnonymous) return;
    await updateDoc(doc(db, "rooms", activeRoomId), {
      [`adminUids.${user.uid}`]: true,
      [`adminUids.${member.id}`]: true
    });
    setToast(`${member.name || "Member"} is now an admin.`);
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

  async function sendSongMessage(song) {
    const text = messageDraft.trim().slice(0, 90);
    if (!user || !activeRoomId || !text) return;
    const senderName = nicknameFor(user, nickname.trim() || "Someone").slice(0, 30);
    const nextMessages = [
      ...(song.messages || []),
      {
        uid: user.uid,
        name: senderName,
        text,
        at: Date.now()
      }
    ].slice(-4);
    await updateDoc(doc(db, "rooms", activeRoomId, "songs", song.id), {
      messages: nextMessages
    });
    setMessageDraft("");
    setMessageSongId("");
    setEmojiSongId("");
  }

  function clearRoomState() {
    setActiveRoomId("");
    setRoom(null);
    setSongs([]);
    setMembers([]);
    setMenuOpen(false);
    setAboutOpen(false);
    setSettingsOpen(false);
    setEmojiSongId("");
    setMessageSongId("");
    setMessageDraft("");
    window.history.replaceState({}, "", window.location.pathname);
  }

  async function updateCooldownEnabled(enabled) {
    if (!isAdmin || !activeRoomId) return;
    await updateDoc(doc(db, "rooms", activeRoomId), { cooldownEnabled: enabled });
  }

  async function updateCooldownMinutes(minutes) {
    if (!isAdmin || !activeRoomId) return;
    const cleanMinutes = Math.min(30, Math.max(1, Number(minutes) || 1));
    await updateDoc(doc(db, "rooms", activeRoomId), {
      cooldownMinutes: cleanMinutes,
      cooldownMs: cleanMinutes * 60 * 1000
    });
  }

  async function updateCrossfadeEnabled(enabled) {
    if (!isAdmin || !activeRoomId) return;
    await updateDoc(doc(db, "rooms", activeRoomId), { crossfadeEnabled: enabled });
  }

  async function updateCrossfadeSeconds(seconds) {
    if (!isAdmin || !activeRoomId) return;
    const cleanSeconds = Math.min(30, Math.max(1, Number(seconds) || DEFAULT_CROSSFADE_SECONDS));
    await updateDoc(doc(db, "rooms", activeRoomId), { crossfadeSeconds: cleanSeconds });
  }

  async function leaveRoom() {
    const leavingRoomId = activeRoomId;
    const leavingUser = user;

    if (leavingRoomId && leavingUser) {
      const batch = writeBatch(db);
      if (isAdmin) {
        const remainingAdmins = members.filter((member) => member.id !== leavingUser.uid && isRoomAdminId(member.id));
        if (remainingAdmins.length === 0) {
          batch.update(doc(db, "rooms", leavingRoomId), {
            closed: true,
            closedAt: serverTimestamp(),
            closedByUid: leavingUser.uid,
            [`adminUids.${leavingUser.uid}`]: deleteField()
          });
        } else {
          batch.update(doc(db, "rooms", leavingRoomId), {
            [`adminUids.${leavingUser.uid}`]: deleteField(),
            adminUid: remainingAdmins[0].id,
            adminName: remainingAdmins[0].name || "Google user"
          });
        }
      }
      batch.delete(doc(db, "rooms", leavingRoomId, "members", leavingUser.uid));
      await batch.commit();
    }

    clearRoomState();
  }

  async function handleSignOut() {
    await leaveRoom();
    await signOut(auth);
  }

  async function shareRoom() {
    if (!activeRoomId) return;
    const shareUrl = `${window.location.origin}${window.location.pathname}?room=${activeRoomId}`;
    const shareData = {
      title: "Join my PartyBeats room",
      text: `Join PartyBeats room ${activeRoomId}`,
      url: shareUrl
    };
    setMenuOpen(false);
    if (navigator.share) {
      await navigator.share(shareData).catch(() => undefined);
      return;
    }
    await navigator.clipboard?.writeText(`${shareData.text}\n${shareUrl}`);
    setToast("Room link copied.");
  }

  async function exportPlaylist() {
    setMenuOpen(false);
    if (!songs.length) {
      setToast("There are no songs to export yet.");
      return;
    }
    const lines = [
      "PartyBeats Playlist",
      `Room: ${activeRoomId}`,
      `Exported: ${new Date().toLocaleString()}`,
      "",
      ...songs.flatMap((song, index) => {
        return [
          `${index + 1}. ${song.artist || "YouTube"} - ${song.title || "Untitled"}`,
          song.link ? `   Link: ${song.link}` : "",
          ""
        ].filter(Boolean);
      })
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `partybeats-${activeRoomId || "playlist"}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setToast("Playlist exported.");
  }

  if (!firebaseReady) {
    return <SetupMissing />;
  }

  if (!activeRoomId || !room) {
    return (
      <main className="app-shell landing-shell">
        <section className="landing-hero">
          <div className="brand-mark">
            <Music2 aria-hidden="true" />
            <span>PartyBeats</span>
          </div>
          <div className="landing-copy">
            <h1>PartyBeats</h1>
            <p>Start a room, pass around the code, and let everyone build the music queue from their phone.</p>
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

          <div className="room-card">
            <h2>Start or Join</h2>
            <p className="muted">Google users can create rooms. Guests can join with a nickname.</p>
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
        </section>

        {toast && (
          <button className="toast" onClick={() => setToast("")}>
            {toast}
          </button>
        )}
      </main>
    );
  }

  return (
    <main className="app-shell room-app">
      <header className="app-topbar">
        <div className="topbar-brand">
          <div className="brand-dot">
            <Music2 aria-hidden="true" />
          </div>
          <div>
            <strong>PartyBeats</strong>
            <span>{activeRoomId}</span>
          </div>
        </div>

        <div className="topbar-actions">
          <div className="session-chip">
            <span>{user.isAnonymous ? "Guest" : "Google"}</span>
            <strong>{nicknameFor(user, nickname)}</strong>
          </div>
          <div className="menu-wrap">
            <button className="icon-button" onClick={() => setMenuOpen((open) => !open)} title="Menu">
              <MoreVertical aria-hidden="true" />
            </button>
            {menuOpen && (
              <div className="overflow-menu">
                <button onClick={() => { setAboutOpen(true); setMenuOpen(false); }}>
                  <Info aria-hidden="true" />
                  About
                </button>
                <button onClick={() => { setSettingsOpen(true); setMenuOpen(false); }}>
                  <SlidersHorizontal aria-hidden="true" />
                  Settings
                </button>
                <button onClick={shareRoom}>
                  <Share2 aria-hidden="true" />
                  Share
                </button>
                <button onClick={exportPlaylist}>
                  <Download aria-hidden="true" />
                  Export
                </button>
                <button onClick={leaveRoom}>
                  <DoorOpen aria-hidden="true" />
                  Leave Room
                </button>
                <button onClick={handleSignOut}>
                  <LogOut aria-hidden="true" />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <section className="now-playing-card">
        <div>
          <span>{isAdmin ? "Admin player" : "Now playing"}</span>
          <h1>{nowPlayingSong?.title || "Nothing playing yet"}</h1>
          <p>{nowPlayingSong ? `${nowPlayingSong.artist || "YouTube"} · added by ${nowPlayingSong.addedByName || "Guest"}` : "The room owner starts playback from their phone."}</p>
        </div>
        {isAdmin && (
          <>
            <YouTubePlayer
              song={nowPlayingSong}
              onEnded={playNextSong}
              onCrossfade={playNextSong}
              crossfadeEnabled={crossfadeEnabled}
              crossfadeSeconds={crossfadeSeconds}
            />
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
          </>
        )}
      </section>

      <section className="add-panel">
        <form className="youtube-search" onSubmit={searchYouTube}>
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={YOUTUBE_API_KEY ? "Search YouTube" : "Add VITE_YOUTUBE_API_KEY"}
          />
          <button className="primary-action" disabled={!YOUTUBE_API_KEY || searching}>
            <Search aria-hidden="true" />
            {searching ? "..." : "Search"}
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

        <p className="cooldown-note">
          {isAdmin
            ? `Admin controls are enabled. Cooldown is ${cooldownEnabled ? `${cooldownMinutes} min` : "off"}.`
            : !cooldownEnabled
              ? "Cooldown is off."
              : canAddSong
                ? "You can add a song now."
                : `Next add in ${Math.ceil(cooldownRemaining / 1000)}s.`}
        </p>
      </section>

      <section className="queue-panel">
        <div className="queue-header">
          <div>
            <h2>Playlist</h2>
            <p className="muted">Hold a track to react.</p>
          </div>
          <strong>{songs.length}</strong>
        </div>

        <div className="song-list">
          {songs.length === 0 ? (
            <div className="empty-state">
              <Music2 aria-hidden="true" />
              <strong>No songs yet</strong>
              <span>Drop the first track and set the tone.</span>
            </div>
          ) : (
            songs.map((song, index) => {
              const emojiCounts = EMOJIS.map((emoji) => ({
                emoji,
                count: Object.values(song.emojiByUser || {}).filter((value) => value === emoji).length
              })).filter((item) => item.count > 0);
              return (
                <article
                  className={[
                    "song-row",
                    song.id === room.nowPlayingId ? "is-playing" : "",
                    emojiSongId === song.id ? "is-reacting" : ""
                  ].filter(Boolean).join(" ")}
                  key={song.id}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    setMessageSongId("");
                    setEmojiSongId(song.id);
                  }}
                  onPointerDown={(event) => {
                    const timer = window.setTimeout(() => {
                      setMessageSongId("");
                      setEmojiSongId(song.id);
                    }, 520);
                    event.currentTarget.dataset.pressTimer = String(timer);
                  }}
                  onPointerUp={(event) => window.clearTimeout(Number(event.currentTarget.dataset.pressTimer))}
                  onPointerLeave={(event) => window.clearTimeout(Number(event.currentTarget.dataset.pressTimer))}
                >
                  <button className="song-main" onClick={() => isAdmin && setNowPlaying(song.id)} type="button">
                    <span className="song-index">{index + 1}</span>
                    <span className="track-line">
                      <b>{song.artist || "YouTube"}</b>
                      <strong>{song.title}</strong>
                    </span>
                    <span className="uploaded-by">Uploaded by {song.addedByName || "Guest"}</span>
                  </button>

                  <div className="reaction-strip">
                    {emojiCounts.length > 0 && (
                      <span className="emoji-summary">
                        {emojiCounts.map(({ emoji, count }) => `${emoji}${count}`).join(" ")}
                      </span>
                    )}
                    {(song.messages || []).map((item, messageIndex) => (
                      <span className="song-message" key={`${item.uid || "guest"}-${item.at || messageIndex}`}>
                        <b>{item.name || "Guest"}:</b> {item.text}
                      </span>
                    ))}
                  </div>

                  {isAdmin && (
                    <div className="admin-actions" onPointerDown={(event) => event.stopPropagation()}>
                      <button className="icon-button" onClick={() => moveSong(song, -1)} title="Move up" disabled={index === 0}>
                        <ArrowUp aria-hidden="true" />
                      </button>
                      <button className="icon-button" onClick={() => moveSong(song, 1)} title="Move down" disabled={index === songs.length - 1}>
                        <ArrowDown aria-hidden="true" />
                      </button>
                      <button className="icon-button" onClick={() => setNowPlaying(song.id)} title="Play">
                        <Play aria-hidden="true" />
                      </button>
                      <button className="icon-button danger" onClick={() => removeSong(song.id)} title="Remove song">
                        <Trash2 aria-hidden="true" />
                      </button>
                    </div>
                  )}

                  {emojiSongId === song.id && (
                    <div className="emoji-popover" onClick={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>
                      {EMOJIS.map((emoji) => (
                        <button
                          className={song.emojiByUser?.[user.uid] === emoji ? "selected" : ""}
                          key={emoji}
                          onClick={() => {
                            reactToSong(song, emoji);
                            setEmojiSongId("");
                          }}
                          type="button"
                        >
                          {emoji}
                        </button>
                      ))}
                      <button
                        className={messageSongId === song.id ? "selected" : ""}
                        onClick={() => setMessageSongId(song.id)}
                        type="button"
                        title="Send message"
                      >
                        <MessageCircle aria-hidden="true" />
                      </button>
                      {messageSongId === song.id && (
                        <form className="reaction-message" onSubmit={(event) => { event.preventDefault(); sendSongMessage(song); }}>
                          <input
                            value={messageDraft}
                            onChange={(event) => setMessageDraft(event.target.value.slice(0, 90))}
                            placeholder="90 character message"
                            maxLength={90}
                          />
                          <button className="mini-action" type="submit" disabled={!messageDraft.trim()}>
                            Send
                          </button>
                        </form>
                      )}
                    </div>
                  )}
                </article>
              );
            })
          )}
        </div>
      </section>

      {emojiSongId && (
        <button
          className="emoji-dismiss-layer"
          aria-label="Close reactions"
          onClick={() => {
            setEmojiSongId("");
            setMessageSongId("");
            setMessageDraft("");
          }}
          type="button"
        />
      )}

      {isAdmin && (
        <section className="people-panel">
          <h2>People</h2>
          {members.map((member) => (
            <div className="member-row" key={member.id}>
              <UserRound aria-hidden="true" />
              <div>
                <strong>{member.name}</strong>
                <span>{member.isAnonymous ? "Guest" : "Google"}</span>
              </div>
              {isRoomAdminId(member.id) ? (
                <Crown aria-label="Admin" />
              ) : (
                <button className="mini-action" onClick={() => promoteMember(member)} disabled={member.isAnonymous}>
                  Make Admin
                </button>
              )}
            </div>
          ))}
        </section>
      )}

      {aboutOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <section className="about-modal">
            <div className="modal-header">
              <h2>About</h2>
              <button className="icon-button" onClick={() => setAboutOpen(false)} title="Close">
                <X aria-hidden="true" />
              </button>
            </div>
            <div className="about-grid">
              <div>
                <span>Room ID</span>
                <strong>{activeRoomId}</strong>
              </div>
              <div>
                <span>People</span>
                <strong>{members.length}</strong>
              </div>
              <div>
                <span>Version</span>
                <strong>{APP_VERSION}</strong>
              </div>
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
          </section>
        </div>
      )}

      {settingsOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <section className="about-modal settings-modal">
            <div className="modal-header">
              <h2>Settings</h2>
              <button className="icon-button" onClick={() => setSettingsOpen(false)} title="Close">
                <X aria-hidden="true" />
              </button>
            </div>
            <div className="setting-row">
              <div>
                <strong>Cooldown</strong>
                <span>{cooldownEnabled ? `${cooldownMinutes} minutes between guest adds` : "Guests can add songs anytime"}</span>
              </div>
              <button
                className={cooldownEnabled ? "toggle-button is-on" : "toggle-button"}
                onClick={() => updateCooldownEnabled(!cooldownEnabled)}
                disabled={!isAdmin}
                type="button"
              >
                {cooldownEnabled ? "On" : "Off"}
              </button>
            </div>
            <div className="cooldown-controls">
              <button className="icon-button" onClick={() => updateCooldownMinutes(cooldownMinutes - 1)} disabled={!isAdmin || !cooldownEnabled || cooldownMinutes <= 1}>
                -
              </button>
              <input
                type="range"
                min="1"
                max="30"
                value={cooldownMinutes}
                onChange={(event) => updateCooldownMinutes(event.target.value)}
                disabled={!isAdmin || !cooldownEnabled}
              />
              <button className="icon-button" onClick={() => updateCooldownMinutes(cooldownMinutes + 1)} disabled={!isAdmin || !cooldownEnabled || cooldownMinutes >= 30}>
                +
              </button>
            </div>
            <div className="setting-row">
              <div>
                <strong>Crossfade</strong>
                <span>{crossfadeEnabled ? `Start next song ${crossfadeSeconds} seconds early` : "Next song starts after the current one ends"}</span>
              </div>
              <button
                className={crossfadeEnabled ? "toggle-button is-on" : "toggle-button"}
                onClick={() => updateCrossfadeEnabled(!crossfadeEnabled)}
                disabled={!isAdmin}
                type="button"
              >
                {crossfadeEnabled ? "On" : "Off"}
              </button>
            </div>
            <div className="cooldown-controls">
              <button className="icon-button" onClick={() => updateCrossfadeSeconds(crossfadeSeconds - 1)} disabled={!isAdmin || !crossfadeEnabled || crossfadeSeconds <= 1}>
                -
              </button>
              <input
                type="range"
                min="1"
                max="30"
                value={crossfadeSeconds}
                onChange={(event) => updateCrossfadeSeconds(event.target.value)}
                disabled={!isAdmin || !crossfadeEnabled}
              />
              <button className="icon-button" onClick={() => updateCrossfadeSeconds(crossfadeSeconds + 1)} disabled={!isAdmin || !crossfadeEnabled || crossfadeSeconds >= 30}>
                +
              </button>
            </div>
            {!isAdmin && <p className="muted">Only admins can change room settings.</p>}
          </section>
        </div>
      )}

      {toast && (
        <button className="toast" onClick={() => setToast("")}>
          {toast}
        </button>
      )}
    </main>
  );
}

function YouTubePlayer({ song, onEnded, onCrossfade, crossfadeEnabled, crossfadeSeconds }) {
  const containerId = useRef(`yt-player-${Math.random().toString(36).slice(2)}`);
  const playerRef = useRef(null);
  const playerTimerRef = useRef(null);
  const endedRef = useRef(onEnded);
  const crossfadeRef = useRef(onCrossfade);
  const crossfadeTriggeredRef = useRef(false);

  useEffect(() => {
    endedRef.current = onEnded;
  }, [onEnded]);

  useEffect(() => {
    crossfadeRef.current = onCrossfade;
  }, [onCrossfade]);

  useEffect(() => {
    let cancelled = false;

    async function loadPlayer() {
      if (!song?.videoId) return;
      await loadYouTubeIframeApi();
      if (cancelled) return;

      if (playerRef.current?.destroy) {
        playerRef.current.destroy();
      }
      if (playerTimerRef.current) {
        window.clearInterval(playerTimerRef.current);
      }
      crossfadeTriggeredRef.current = false;

      playerRef.current = new window.YT.Player(containerId.current, {
        videoId: song.videoId,
        playerVars: {
          autoplay: 1,
          controls: 1,
          rel: 0
        },
        events: {
          onReady: (event) => {
            event.target.setVolume?.(100);
          },
          onStateChange: (event) => {
            if (event.data === window.YT.PlayerState.PLAYING) {
              event.target.setVolume?.(100);
              if (playerTimerRef.current) {
                window.clearInterval(playerTimerRef.current);
              }
              playerTimerRef.current = window.setInterval(() => {
                if (!crossfadeEnabled || !crossfadeSeconds || !event.target.getDuration || !event.target.getCurrentTime) {
                  return;
                }
                const duration = event.target.getDuration();
                const current = event.target.getCurrentTime();
                const remaining = duration - current;
                if (
                  crossfadeEnabled
                  && crossfadeSeconds
                  && duration
                  && remaining <= crossfadeSeconds
                  && !crossfadeTriggeredRef.current
                ) {
                  crossfadeTriggeredRef.current = true;
                  crossfadeRef.current?.();
                }
              }, 400);
            }
            if (event.data === window.YT.PlayerState.PAUSED && playerTimerRef.current) {
              window.clearInterval(playerTimerRef.current);
            }
            if (event.data === window.YT.PlayerState.ENDED) {
              if (playerTimerRef.current) {
                window.clearInterval(playerTimerRef.current);
              }
              endedRef.current?.();
            }
          }
        }
      });
    }

    loadPlayer();

    return () => {
      cancelled = true;
      if (playerTimerRef.current) {
        window.clearInterval(playerTimerRef.current);
      }
    };
  }, [song?.videoId, crossfadeEnabled, crossfadeSeconds]);

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
