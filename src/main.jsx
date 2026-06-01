import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowDown,
  ArrowUp,
  Crown,
  DoorOpen,
  ExternalLink,
  Info,
  LogIn,
  LogOut,
  MessageCircle,
  Moon,
  MoreVertical,
  Music2,
  Pencil,
  Play,
  Plus,
  QrCode,
  Search,
  Share2,
  SlidersHorizontal,
  Sun,
  SkipForward,
  Trash2,
  UserRound,
  UsersRound,
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
const DEFAULT_TRACK_NOTICE_SECONDS = 3;
const DEFAULT_JOIN_NOTICE_SECONDS = 3;
const YOUTUBE_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;
const APP_VERSION = "2026.06.01.05";
const APP_ICON_URL = `${import.meta.env.BASE_URL}partybeats-icon.png`;
const PROFANITY_PATTERNS = [
  /\bass+hole\b/,
  /\bbastard\b/,
  /\bb[i1!|]+tch\b/,
  /\bbull\s*sh[i1!|]+t\b/,
  /\bc+u+n+t+\b/,
  /\bd[i1!|]+ck\b/,
  /\bf+a+c*k+\b/,
  /\bf+u+c*k+\b/,
  /\bf+u+k+\b/,
  /\bf+c+k+\b/,
  /\bf+u+c*k+(er|ing)?\b/,
  /\bmoth(er|a)f+u+c*k+(er)?\b/,
  /\bp[i1!|]+ss\b/,
  /\bsh[i1!|]+t+\b/,
  /\bslut\b/,
  /\bwhore\b/
];

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

function hasProfanity(value) {
  const normalized = value
    .toLowerCase()
    .replace(/[@]/g, "a")
    .replace(/[$]/g, "s")
    .replace(/[0]/g, "o")
    .replace(/[3]/g, "e")
    .replace(/[4]/g, "a")
    .replace(/[5]/g, "s")
    .replace(/[7]/g, "t");
  const compact = normalized.replace(/[^a-z0-9]+/g, "");
  return PROFANITY_PATTERNS.some((pattern) => pattern.test(normalized) || pattern.test(compact));
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

function youtubeMusicSearchUrl(queryText) {
  const query = queryText.trim();
  return query
    ? `https://music.youtube.com/search?q=${encodeURIComponent(query)}`
    : "https://music.youtube.com/";
}

function youtubeThumb(videoId) {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

function extractYouTubeVideoId(value) {
  const rawValue = value.trim();
  if (!rawValue) return "";

  try {
    const url = new URL(rawValue);
    const host = url.hostname.replace(/^www\./, "").replace(/^m\./, "");
    if (host === "youtu.be") {
      return url.pathname.split("/").filter(Boolean)[0] || "";
    }
    if (host === "youtube.com" || host === "music.youtube.com" || host === "youtube-nocookie.com") {
      const watchId = url.searchParams.get("v");
      if (watchId) return watchId;
      const parts = url.pathname.split("/").filter(Boolean);
      const idIndex = parts.findIndex((part) => ["shorts", "embed", "live"].includes(part));
      if (idIndex >= 0) return parts[idIndex + 1] || "";
    }
  } catch {
    const match = rawValue.match(/(?:v=|youtu\.be\/|shorts\/|embed\/|live\/)([A-Za-z0-9_-]{11})/);
    return match?.[1] || "";
  }

  return "";
}

function cleanYouTubeVideoId(videoId) {
  const match = String(videoId || "").match(/^[A-Za-z0-9_-]{11}$/);
  return match ? match[0] : "";
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

function savedTheme() {
  try {
    return localStorage.getItem("partybeats-theme") || "light";
  } catch {
    return "light";
  }
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
  const [youtubeLink, setYoutubeLink] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [emojiSongId, setEmojiSongId] = useState("");
  const [messageSongId, setMessageSongId] = useState("");
  const [messageDraft, setMessageDraft] = useState("");
  const [restoreRoomId, setRestoreRoomId] = useState("");
  const [renameMemberId, setRenameMemberId] = useState("");
  const [renameDraft, setRenameDraft] = useState("");
  const [nowPlayingNotice, setNowPlayingNotice] = useState(null);
  const [joinNotice, setJoinNotice] = useState(null);
  const [effectivePlaybackSettings, setEffectivePlaybackSettings] = useState({
    songId: null,
    crossfadeEnabled: true,
    crossfadeSeconds: DEFAULT_CROSSFADE_SECONDS
  });
  const [theme, setTheme] = useState(savedTheme);
  const previousNowPlayingId = useRef(undefined);
  const previousMemberIds = useRef(undefined);
  const isDarkTheme = theme === "dark";

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
    try {
      localStorage.setItem("partybeats-theme", theme);
    } catch {
      // Theme persistence is a convenience; the toggle still works without storage.
    }
    document.documentElement.dataset.theme = theme;
  }, [theme]);

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

    const handleRoomAccessLost = () => {
      setToast("You were removed from this room.");
      clearRoomState();
    };

    const unsubRoom = onSnapshot(roomRef, (snap) => {
      const nextRoom = snap.exists() ? { id: snap.id, ...snap.data() } : null;
      if (nextRoom?.closed) {
        setToast("Room closed because the last admin left.");
        clearRoomState();
        return;
      }
      setRoom(nextRoom);
    }, handleRoomAccessLost);
    const unsubSongs = onSnapshot(songsRef, (snap) => {
      setSongs(snap.docs.map((item) => ({ id: item.id, ...item.data() })));
    }, handleRoomAccessLost);
    const unsubMembers = onSnapshot(membersRef, (snap) => {
      const nextMembers = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
      if (user?.uid && !nextMembers.some((member) => member.id === user.uid)) {
        handleRoomAccessLost();
        return;
      }
      setMembers(nextMembers);
    }, handleRoomAccessLost);
    return () => {
      unsubRoom();
      unsubSongs();
      unsubMembers();
    };
  }, [activeRoomId, user?.uid]);

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
      setRestoreRoomId(normalized);
    }
  }, []);

  useEffect(() => {
    if (authLoading || !user || !restoreRoomId || activeRoomId === restoreRoomId) return;
    joinRoomById(restoreRoomId, { silent: true })
      .then(() => setRestoreRoomId(""))
      .catch(() => undefined);
  }, [authLoading, user, restoreRoomId, activeRoomId]);

  const roomAdminUids = adminMapFor(room);
  const isRoomAdminId = (uid) => Boolean(uid && roomAdminUids[uid]);
  const isAdmin = Boolean(user && isRoomAdminId(user.uid));
  const activeDjUid = room?.activeDjUid || room?.adminUid || "";
  const activeDjName = room?.activeDjName || room?.adminName || "Room admin";
  const isActiveDj = Boolean(user && activeDjUid === user.uid);
  const cooldownEnabled = room?.cooldownEnabled !== false;
  const cooldownMinutes = Math.min(
    30,
    Math.max(1, Number(room?.cooldownMinutes) || Math.round((Number(room?.cooldownMs) || DEFAULT_COOLDOWN_MS) / 60000))
  );
  const cooldownMs = cooldownMinutes * 60 * 1000;
  const crossfadeEnabled = room?.crossfadeEnabled !== false;
  const crossfadeSeconds = Math.min(30, Math.max(1, Number(room?.crossfadeSeconds) || DEFAULT_CROSSFADE_SECONDS));
  const trackNoticeEnabled = room?.trackNoticeEnabled !== false;
  const trackNoticeSeconds = Math.min(30, Math.max(1, Number(room?.trackNoticeSeconds) || DEFAULT_TRACK_NOTICE_SECONDS));
  const joinNoticeEnabled = room?.joinNoticeEnabled !== false;
  const memberRecord = members.find((member) => member.id === user?.uid);
  const cooldownUntil = cooldownEnabled && memberRecord?.lastAddedAt?.toMillis ? memberRecord.lastAddedAt.toMillis() + cooldownMs : 0;
  const cooldownRemaining = Math.max(0, cooldownUntil - Date.now());
  const canAddSong = isAdmin || cooldownRemaining === 0;
  const nowPlayingSong = songs.find((song) => song.id === room?.nowPlayingId) || null;
  const activeNickname = nickname.trim() || nicknameFor(user, "Guest");
  const memberById = (uid) => members.find((member) => member.id === uid);

  useEffect(() => {
    setEffectivePlaybackSettings((current) => {
      const songId = nowPlayingSong?.id || null;
      if (current.songId === songId) return current;
      return {
        songId,
        crossfadeEnabled,
        crossfadeSeconds
      };
    });
  }, [nowPlayingSong?.id, crossfadeEnabled, crossfadeSeconds]);

  useEffect(() => {
    if (!activeRoomId || !nowPlayingSong?.id) {
      previousNowPlayingId.current = nowPlayingSong?.id || null;
      setNowPlayingNotice(null);
      return undefined;
    }
    if (previousNowPlayingId.current === undefined) {
      previousNowPlayingId.current = nowPlayingSong.id;
      return undefined;
    }
    if (previousNowPlayingId.current === nowPlayingSong.id) {
      return undefined;
    }

    previousNowPlayingId.current = nowPlayingSong.id;
    if (!trackNoticeEnabled) {
      setNowPlayingNotice(null);
      return undefined;
    }
    const uploader = memberById(nowPlayingSong.addedByUid);
    setNowPlayingNotice({
      id: nowPlayingSong.id,
      title: nowPlayingSong.title || "Untitled",
      artist: nowPlayingSong.artist || "YouTube",
      addedBy: uploader?.name || nowPlayingSong.addedByName || "Guest"
    });
    const timer = window.setTimeout(() => setNowPlayingNotice(null), trackNoticeSeconds * 1000);
    return () => window.clearTimeout(timer);
  }, [activeRoomId, nowPlayingSong?.id]);

  useEffect(() => {
    if (!activeRoomId) {
      previousMemberIds.current = undefined;
      setJoinNotice(null);
      return undefined;
    }

    const currentIds = new Set(members.map((member) => member.id));
    if (previousMemberIds.current === undefined) {
      previousMemberIds.current = currentIds;
      return undefined;
    }

    const addedMember = members.find((member) => !previousMemberIds.current.has(member.id));
    previousMemberIds.current = currentIds;
    if (!joinNoticeEnabled || !addedMember) return undefined;

    setJoinNotice({
      id: `${addedMember.id}-${Date.now()}`,
      name: addedMember.name || "Someone"
    });
    const timer = window.setTimeout(() => setJoinNotice(null), DEFAULT_JOIN_NOTICE_SECONDS * 1000);
    return () => window.clearTimeout(timer);
  }, [activeRoomId, members, joinNoticeEnabled]);

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
      adminName: activeNickname,
      activeDjUid: user.uid,
      activeDjName: activeNickname,
      createdAt: serverTimestamp(),
      closed: false,
      cooldownEnabled: true,
      cooldownMinutes: 3,
      cooldownMs: DEFAULT_COOLDOWN_MS,
      crossfadeEnabled: true,
      crossfadeSeconds: DEFAULT_CROSSFADE_SECONDS,
      trackNoticeEnabled: true,
      trackNoticeSeconds: DEFAULT_TRACK_NOTICE_SECONDS,
      joinNoticeEnabled: true,
      nowPlayingId: null
    });
    await joinRoomById(nextId);
  }

  async function joinRoomById(rawId = roomId, options = {}) {
    if (!user) {
      if (!options.silent) setToast("Sign in first.");
      return;
    }
    const nextRoomId = normalizeRoomId(rawId);
    if (!/^[A-Z]{4}\d{3}$/.test(nextRoomId)) {
      if (!options.silent) setToast("Room IDs look like VIBE123.");
      return;
    }

    const roomSnap = await getDoc(doc(db, "rooms", nextRoomId));
    if (!roomSnap.exists()) {
      if (!options.silent) setToast("That room does not exist yet.");
      return;
    }
    if (roomSnap.data().closed) {
      if (!options.silent) setToast("That room has been closed.");
      return;
    }

    await setDoc(
      doc(db, "rooms", nextRoomId, "members", user.uid),
      {
        uid: user.uid,
        name: activeNickname,
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
    const songRef = doc(collection(db, "rooms", activeRoomId, "songs"));
    const batch = writeBatch(db);
    batch.set(songRef, {
      title,
      artist: selectedVideo?.channelTitle || "YouTube",
      link: youtubeWatchUrl(videoId),
      provider: "youtube",
      videoId,
      thumbnail,
      addedByUid: user.uid,
      addedByName: activeNickname,
      addedByIsAnonymous: user.isAnonymous,
      position: nextPosition,
      emojiByUser: {},
      messages: [],
      createdAt: serverTimestamp()
    });
    if (!room?.nowPlayingId) {
      batch.update(doc(db, "rooms", activeRoomId), { nowPlayingId: songRef.id });
    }
    batch.set(doc(db, "rooms", activeRoomId, "members", user.uid), { lastAddedAt: serverTimestamp() }, { merge: true });
    await batch.commit();
    setSearchResults([]);
    setYoutubeLink("");
  }

  async function fetchYouTubeLinkDetails(videoId) {
    try {
      const url = youtubeWatchUrl(videoId);
      const response = await fetch(`https://www.youtube.com/oembed?${new URLSearchParams({ url, format: "json" }).toString()}`);
      if (!response.ok) throw new Error("YouTube details unavailable.");
      const data = await response.json();
      return {
        videoId,
        title: data.title || "YouTube track",
        channelTitle: data.author_name || "YouTube",
        thumbnail: data.thumbnail_url || youtubeThumb(videoId)
      };
    } catch {
      return {
        videoId,
        title: "YouTube track",
        channelTitle: "YouTube",
        thumbnail: youtubeThumb(videoId)
      };
    }
  }

  async function addSongFromLink(event) {
    event.preventDefault();
    const videoId = cleanYouTubeVideoId(extractYouTubeVideoId(youtubeLink));
    if (!videoId) {
      setToast("Paste a valid YouTube or YouTube Music song link.");
      return;
    }
    const selectedVideo = await fetchYouTubeLinkDetails(videoId);
    await addSong(null, selectedVideo);
  }

  function openExternalYouTubeMusicSearch() {
    window.open(youtubeMusicSearchUrl(searchQuery), "_blank", "noopener,noreferrer");
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

  async function clearPlaylist() {
    if (!isAdmin || !activeRoomId || !songs.length) return;
    const confirmed = window.confirm("Clear the entire playlist for this room?");
    if (!confirmed) return;

    const batch = writeBatch(db);
    songs.forEach((song) => {
      batch.delete(doc(db, "rooms", activeRoomId, "songs", song.id));
    });
    batch.update(doc(db, "rooms", activeRoomId), { nowPlayingId: null });
    await batch.commit();
    setNowPlayingNotice(null);
    setToast("Playlist cleared.");
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
    if (!isActiveDj) {
      setToast("Only the Active DJ can control playback.");
      return;
    }
    await updateDoc(doc(db, "rooms", activeRoomId), { nowPlayingId: songId });
  }

  async function takeOverDj() {
    if (!isAdmin || !activeRoomId || !user) return;
    await updateDoc(doc(db, "rooms", activeRoomId), {
      activeDjUid: user.uid,
      activeDjName: activeNickname,
      activeDjAt: serverTimestamp()
    });
    setToast("You are now the Active DJ.");
  }

  async function promoteMember(member) {
    if (!isAdmin || !member || member.isAnonymous) return;
    await updateDoc(doc(db, "rooms", activeRoomId), {
      [`adminUids.${user.uid}`]: true,
      [`adminUids.${member.id}`]: true
    });
    setToast(`${member.name || "Member"} is now an admin.`);
  }

  async function demoteMember(member) {
    if (!isAdmin || !member || member.id === user.uid || !isRoomAdminId(member.id)) return;
    const activeAdminIds = Object.keys(roomAdminUids).filter((uid) => members.some((item) => item.id === uid));
    if (activeAdminIds.length <= 1) {
      setToast("A room needs at least one admin.");
      return;
    }

    const roomUpdate = {
      [`adminUids.${user.uid}`]: true,
      [`adminUids.${member.id}`]: deleteField()
    };
    if (room?.adminUid === member.id) {
      roomUpdate.adminUid = user.uid;
      roomUpdate.adminName = activeNickname;
    }

    await updateDoc(doc(db, "rooms", activeRoomId), roomUpdate);
    setToast(`${member.name || "Member"} is no longer an admin.`);
  }

  async function removeMember(member) {
    if (!isAdmin || !member) return;
    if (member.id === user.uid) {
      await leaveRoom();
      return;
    }

    const batch = writeBatch(db);
    const roomUpdate = {};
    if (isRoomAdminId(member.id)) {
      roomUpdate[`adminUids.${user.uid}`] = true;
      roomUpdate[`adminUids.${member.id}`] = deleteField();
      if (room?.adminUid === member.id) {
        roomUpdate.adminUid = user.uid;
        roomUpdate.adminName = activeNickname;
      }
    }
    if (room?.activeDjUid === member.id) {
      roomUpdate.activeDjUid = user.uid;
      roomUpdate.activeDjName = activeNickname;
    }
    if (Object.keys(roomUpdate).length > 0) {
      batch.update(doc(db, "rooms", activeRoomId), roomUpdate);
    }
    batch.delete(doc(db, "rooms", activeRoomId, "members", member.id));
    await batch.commit();
    setToast(`${member.name || "Member"} was removed from the room.`);
  }

  async function renameMember(member) {
    const nextName = renameDraft.trim().slice(0, 30);
    if (!isAdmin || !member || !nextName) return;
    if (hasProfanity(nextName)) {
      setToast("Nickname blocked for profanity.");
      return;
    }
    await updateDoc(doc(db, "rooms", activeRoomId, "members", member.id), {
      name: nextName
    });
    if (room?.activeDjUid === member.id) {
      await updateDoc(doc(db, "rooms", activeRoomId), { activeDjName: nextName });
    }
    if (member.id === user.uid) {
      setNickname(nextName);
    }
    setRenameMemberId("");
    setRenameDraft("");
    setToast(`${member.name || "Member"} is now ${nextName}.`);
  }

  async function playNextSong() {
    if (!isActiveDj || !activeRoomId) {
      setToast("Only the Active DJ can control playback.");
      return;
    }
    const nextSong = nextQueuedSong(songs, room?.nowPlayingId);
    if (nextSong) {
      await updateDoc(doc(db, "rooms", activeRoomId), { nowPlayingId: nextSong.id });
      return;
    }

    await updateDoc(doc(db, "rooms", activeRoomId), { nowPlayingId: null });
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
    if (hasProfanity(text)) {
      setToast("Message blocked for profanity.");
      return;
    }
    const senderName = activeNickname.slice(0, 30);
    const nextMessages = [
      ...(song.messages || []),
      {
        uid: user.uid,
        name: senderName,
        isAnonymous: user.isAnonymous,
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
    setPeopleOpen(false);
    setSettingsOpen(false);
    setEmojiSongId("");
    setMessageSongId("");
    setMessageDraft("");
    setRenameMemberId("");
    setRenameDraft("");
    setNowPlayingNotice(null);
    setJoinNotice(null);
    previousMemberIds.current = undefined;
    setEffectivePlaybackSettings({
      songId: null,
      crossfadeEnabled: true,
      crossfadeSeconds: DEFAULT_CROSSFADE_SECONDS
    });
    setRestoreRoomId("");
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

  async function updateTrackNoticeEnabled(enabled) {
    if (!isAdmin || !activeRoomId) return;
    await updateDoc(doc(db, "rooms", activeRoomId), { trackNoticeEnabled: enabled });
  }

  async function updateTrackNoticeSeconds(seconds) {
    if (!isAdmin || !activeRoomId) return;
    const cleanSeconds = Math.min(30, Math.max(1, Number(seconds) || DEFAULT_TRACK_NOTICE_SECONDS));
    await updateDoc(doc(db, "rooms", activeRoomId), { trackNoticeSeconds: cleanSeconds });
  }

  async function updateJoinNoticeEnabled(enabled) {
    if (!isAdmin || !activeRoomId) return;
    await updateDoc(doc(db, "rooms", activeRoomId), { joinNoticeEnabled: enabled });
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
            adminName: remainingAdmins[0].name || "Google user",
            ...(room?.activeDjUid === leavingUser.uid
              ? {
                  activeDjUid: remainingAdmins[0].id,
                  activeDjName: remainingAdmins[0].name || "Google user"
                }
              : {})
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
      title: "Join my BP PartyBeats room",
      text: `Join BP PartyBeats room ${activeRoomId}`,
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
      setToast("There are no songs to share yet.");
      return;
    }
    const shareUrl = `${window.location.origin}${window.location.pathname}?room=${activeRoomId}`;
    const lines = [
      "BP PartyBeats Playlist",
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
    const playlistText = lines.join("\n");
    const shareData = {
      title: `BP PartyBeats ${activeRoomId} playlist`,
      text: playlistText,
      url: shareUrl
    };

    if (navigator.share) {
      await navigator.share(shareData).catch(() => undefined);
      return;
    }
    await navigator.clipboard?.writeText(`${playlistText}\n\nJoin: ${shareUrl}`);
    setToast("Playlist copied.");
  }

  if (!firebaseReady) {
    return <SetupMissing />;
  }

  if (!activeRoomId || !room) {
    return (
      <main className="app-shell landing-shell">
        <section className="landing-hero">
          <div className="brand-mark">
            <AppIcon />
            <span>BP PartyBeats</span>
          </div>
          <div className="landing-copy">
            <h1>BP PartyBeats</h1>
            <p>Start a room, pass around the code, and let everyone build the music queue from their phone.</p>
          </div>

          <div className="auth-panel">
            {authLoading ? (
              <div className="muted">Checking session...</div>
            ) : user ? (
              <SignedIn user={user} nickname={nickname} setNickname={setNickname} onSignOut={handleSignOut} />
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
          <p className="landing-version">Version {APP_VERSION}</p>
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
    <main className={`app-shell room-app ${isDarkTheme ? "dark-mode" : "light-mode"}`}>
      <header className="app-topbar">
        <div className="topbar-brand">
          <div className="brand-dot">
            <AppIcon />
          </div>
          <div>
            <strong>BP PartyBeats</strong>
            <span>{activeRoomId}</span>
          </div>
        </div>

        <div className="topbar-actions">
          <button
            className="icon-button theme-toggle"
            onClick={() => setTheme(isDarkTheme ? "light" : "dark")}
            title={isDarkTheme ? "Light mode" : "Dark mode"}
            type="button"
          >
            {isDarkTheme ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
          </button>
          <button
            className="icon-button"
            onClick={() => setPeopleOpen(true)}
            title="People in room"
            type="button"
          >
            <UsersRound aria-hidden="true" />
          </button>
          <div className="session-chip">
            <span>{user.isAnonymous ? "Guest" : "Google"}</span>
            <strong>
              {!user.isAnonymous && <GoogleBadge />}
              {activeNickname}
            </strong>
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
                  <Share2 aria-hidden="true" />
                  Share Playlist
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
          <span>{isActiveDj ? "Active DJ player" : "Now playing"}</span>
          <h1>{nowPlayingSong?.title || "Nothing playing yet"}</h1>
          <p>
            {nowPlayingSong
              ? `${nowPlayingSong.artist || "YouTube"} · added by ${nowPlayingSong.addedByName || "Guest"}`
              : "The Active DJ starts playback from the phone connected to the speaker."}
          </p>
          <p className="dj-note">
            Playing from {activeDjName}
            {isAdmin && !isActiveDj ? " · You can take over if the speaker moves to your phone." : ""}
          </p>
        </div>
        {isActiveDj ? (
          <>
            <YouTubePlayer
              song={nowPlayingSong}
              onEnded={playNextSong}
              onCrossfade={playNextSong}
              crossfadeEnabled={effectivePlaybackSettings.crossfadeEnabled}
              crossfadeSeconds={effectivePlaybackSettings.crossfadeSeconds}
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
        ) : isAdmin ? (
          <div className="player-actions">
            <button className="mini-action" onClick={takeOverDj} type="button">
              <Crown aria-hidden="true" />
              Take Over DJ
            </button>
          </div>
        ) : null}
      </section>

      <section className="add-panel">
        <div className="external-search-panel">
          <div>
            <strong>Search outside the app</strong>
            <span>Open YouTube Music, copy a song link, then paste it here. This avoids YouTube search quota.</span>
          </div>
          <div className="external-search-actions">
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search YouTube Music"
            />
            <button className="mini-action" onClick={openExternalYouTubeMusicSearch} type="button">
              <ExternalLink aria-hidden="true" />
              Open
            </button>
          </div>
        </div>

        <form className="youtube-link-form" onSubmit={addSongFromLink}>
          <input
            value={youtubeLink}
            onChange={(event) => setYoutubeLink(event.target.value)}
            placeholder="Paste YouTube or YouTube Music link"
          />
          <button className="primary-action" disabled={!canAddSong || !youtubeLink.trim()}>
            <Plus aria-hidden="true" />
            Add Link
          </button>
        </form>

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
          <div className="queue-tools">
            {isAdmin && (
              <button className="mini-action danger-action" onClick={clearPlaylist} disabled={!songs.length} type="button">
                <Trash2 aria-hidden="true" />
                Clear
              </button>
            )}
            <strong>{songs.length}</strong>
          </div>
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
              const uploader = memberById(song.addedByUid);
              const uploaderIsGoogle = song.addedByIsAnonymous === false || uploader?.isAnonymous === false;
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
                  <button className="song-main" onClick={() => isActiveDj && setNowPlaying(song.id)} type="button">
                    <span className="song-index">{index + 1}</span>
                    <span className="track-line">
                      <b>{song.artist || "YouTube"}</b>
                      <strong>{song.title}</strong>
                    </span>
                    <span className="uploaded-by">
                      Uploaded by {uploaderIsGoogle && <GoogleBadge />}{uploader?.name || song.addedByName || "Guest"}
                    </span>
                  </button>

                  <div className="reaction-strip">
                    {emojiCounts.length > 0 && (
                      <span className="emoji-summary">
                        {emojiCounts.map(({ emoji, count }) => `${emoji}${count}`).join(" ")}
                      </span>
                    )}
                    {(song.messages || []).slice(-2).map((item, messageIndex) => (
                      <span className="song-message" key={`${item.uid || "guest"}-${item.at || messageIndex}`}>
                        <b>{item.isAnonymous === false && <GoogleBadge />}{item.name || "Guest"}:</b> {item.text}
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
                      {isActiveDj && (
                        <button className="icon-button" onClick={() => setNowPlaying(song.id)} title="Play">
                          <Play aria-hidden="true" />
                        </button>
                      )}
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

      {peopleOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <section className="about-modal people-modal">
            <div className="modal-header">
              <h2>People</h2>
              <button className="icon-button" onClick={() => setPeopleOpen(false)} title="Close">
                <X aria-hidden="true" />
              </button>
            </div>
            <section className="people-panel visible-people">
              {members.map((member) => {
                const memberIsAdmin = isRoomAdminId(member.id);
                const isCurrentUser = member.id === user.uid;
                return (
                  <div className="member-row" key={member.id}>
                    <UserRound aria-hidden="true" />
                    <div>
                      <strong>{member.isAnonymous === false && <GoogleBadge />}{member.name}{isCurrentUser ? " (You)" : ""}</strong>
                      <span>
                        {member.isAnonymous ? "Guest" : "Google"}
                        {memberIsAdmin ? " · Admin" : ""}
                      </span>
                    </div>
                    {memberIsAdmin && <Crown aria-label="Admin" />}
                  </div>
                );
              })}
            </section>
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
            <div className="setting-row">
              <div>
                <strong>Track notifications</strong>
                <span>{trackNoticeEnabled ? `Show now-playing bubble for ${trackNoticeSeconds} seconds` : "Now-playing bubble is off"}</span>
              </div>
              <button
                className={trackNoticeEnabled ? "toggle-button is-on" : "toggle-button"}
                onClick={() => updateTrackNoticeEnabled(!trackNoticeEnabled)}
                disabled={!isAdmin}
                type="button"
              >
                {trackNoticeEnabled ? "On" : "Off"}
              </button>
            </div>
            <div className="cooldown-controls">
              <button className="icon-button" onClick={() => updateTrackNoticeSeconds(trackNoticeSeconds - 1)} disabled={!isAdmin || !trackNoticeEnabled || trackNoticeSeconds <= 1}>
                -
              </button>
              <input
                type="range"
                min="1"
                max="30"
                value={trackNoticeSeconds}
                onChange={(event) => updateTrackNoticeSeconds(event.target.value)}
                disabled={!isAdmin || !trackNoticeEnabled}
              />
              <button className="icon-button" onClick={() => updateTrackNoticeSeconds(trackNoticeSeconds + 1)} disabled={!isAdmin || !trackNoticeEnabled || trackNoticeSeconds >= 30}>
                +
              </button>
            </div>
            <div className="setting-row">
              <div>
                <strong>Join notifications</strong>
                <span>{joinNoticeEnabled ? "Show when someone joins the party" : "Join bubbles are off"}</span>
              </div>
              <button
                className={joinNoticeEnabled ? "toggle-button is-on" : "toggle-button"}
                onClick={() => updateJoinNoticeEnabled(!joinNoticeEnabled)}
                disabled={!isAdmin}
                type="button"
              >
                {joinNoticeEnabled ? "On" : "Off"}
              </button>
            </div>
            {isAdmin && (
              <section className="people-panel settings-people">
                <h2>People</h2>
                {members.map((member) => {
                  const memberIsAdmin = isRoomAdminId(member.id);
                  const isCurrentUser = member.id === user.uid;
                  const isRenaming = renameMemberId === member.id;
                  return (
                    <div className="member-row" key={member.id}>
                      <UserRound aria-hidden="true" />
                      <div>
                        {isRenaming ? (
                          <form className="rename-member-form" onSubmit={(event) => { event.preventDefault(); renameMember(member); }}>
                            <input
                              value={renameDraft}
                              onChange={(event) => setRenameDraft(event.target.value.slice(0, 30))}
                              placeholder="Nickname"
                              maxLength={30}
                              autoFocus
                            />
                            <button className="mini-action" type="submit" disabled={!renameDraft.trim()}>
                              Save
                            </button>
                            <button
                              className="icon-button"
                              onClick={() => {
                                setRenameMemberId("");
                                setRenameDraft("");
                              }}
                              title="Cancel rename"
                              type="button"
                            >
                              <X aria-hidden="true" />
                            </button>
                          </form>
                        ) : (
                          <>
                            <strong>{member.isAnonymous === false && <GoogleBadge />}{member.name}{isCurrentUser ? " (You)" : ""}</strong>
                            <span>
                              {member.isAnonymous ? "Guest" : "Google"}
                              {memberIsAdmin ? " · Admin" : ""}
                            </span>
                          </>
                        )}
                      </div>
                      <div className="member-actions">
                        {!isRenaming && (
                          <button
                            className="icon-button"
                            onClick={() => {
                              setRenameMemberId(member.id);
                              setRenameDraft(member.name || "");
                            }}
                            title="Rename nickname"
                            type="button"
                          >
                            <Pencil aria-hidden="true" />
                          </button>
                        )}
                        {memberIsAdmin ? (
                          <>
                            <Crown aria-label="Admin" />
                            {!isCurrentUser && (
                              <button className="mini-action" onClick={() => demoteMember(member)}>
                                Demote
                              </button>
                            )}
                          </>
                        ) : (
                          <button className="mini-action" onClick={() => promoteMember(member)} disabled={member.isAnonymous}>
                            Make Admin
                          </button>
                        )}
                        {!isCurrentUser && (
                          <button className="icon-button danger" onClick={() => removeMember(member)} title="Remove from room">
                            <Trash2 aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </section>
            )}
            {!isAdmin && <p className="muted">Only admins can change room settings.</p>}
          </section>
        </div>
      )}

      {(joinNotice || nowPlayingNotice) && (
        <div className="notice-stack">
          {joinNotice && (
            <div className="notice-bubble join-bubble" role="status" aria-live="polite">
              <div>
                <span>Party Guest</span>
                <strong>{joinNotice.name} has joined the party</strong>
              </div>
              <button className="mini-action" onClick={() => setJoinNotice(null)} type="button">
                OK
              </button>
            </div>
          )}
          {nowPlayingNotice && (
            <div className="notice-bubble now-playing-bubble" role="status" aria-live="polite">
              <div>
                <span>Now Playing</span>
                <strong>{nowPlayingNotice.artist} · {nowPlayingNotice.title}</strong>
                <p>Added by {nowPlayingNotice.addedBy}</p>
              </div>
              <button className="mini-action" onClick={() => setNowPlayingNotice(null)} type="button">
                OK
              </button>
            </div>
          )}
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

function SignedIn({ user, nickname, setNickname, onSignOut }) {
  return (
    <div className="signed-in">
      <div>
        <span>{user.isAnonymous ? "Guest" : "Google"}</span>
        <strong>
          {!user.isAnonymous && <GoogleBadge />}
          {nickname || nicknameFor(user)}
        </strong>
      </div>
      {!user.isAnonymous && (
        <input
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
          placeholder="Party nickname"
          maxLength={30}
        />
      )}
      <button className="icon-button" onClick={onSignOut} title="Sign out">
        <LogOut aria-hidden="true" />
      </button>
    </div>
  );
}

function GoogleBadge() {
  return (
    <span className="google-badge" aria-label="Google user" title="Google user">
      G
    </span>
  );
}

function AppIcon() {
  return <img className="app-icon" src={APP_ICON_URL} alt="" aria-hidden="true" />;
}

function SetupMissing() {
  return (
    <main className="setup-missing">
      <AppIcon />
      <h1>BP PartyBeats needs Firebase config</h1>
      <p>Copy .env.example to .env.local and fill in the values from your Firebase web app.</p>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
