import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DoorOpen, Megaphone, Palette, Plus, Settings, Share2, SmilePlus, Users
} from "lucide-react";
import * as api from "../api";
import { EMOJIS } from "../constants";
import {
  formatCountdown, nextQueuedSong, nextQueuePosition, timestampMs, trackDisplay
} from "../utils";
import Player from "./Player";
import Queue from "./Queue";
import AddMusic from "./AddMusic";
import {
  PeoplePanel, ProfileEditor, SettingsPanel, SharePanel, ShoutComposer
} from "./Panels";
import { Avatar, FloatingReactions, ShoutBanner, TicketCode } from "./ui";

export default function Room({ auth, session, deviceId, now, showToast, onOpenThemes }) {
  const { user } = auth;
  const {
    activeRoomId, room, songs, members, messages, reactions, shouts, playback,
    isAdmin, isPlayerDevice, nowPlayingSong, upcomingSongs, playedSongs, leave
  } = session;

  const [openPanel, setOpenPanel] = useState("");
  const [floatingItems, setFloatingItems] = useState([]);
  const [activeShout, setActiveShout] = useState(null);
  const baselineRef = useRef({ ready: false, reactionIds: new Set(), shoutIds: new Set() });

  const selfMember = members.find((member) => member.id === user.uid) || null;
  const nickname = selfMember?.name || auth.nickname || "Guest";

  const cooldownRemainingMs = useMemo(() => {
    if (!room?.cooldownEnabled || isAdmin) return 0;
    const lastAdded = timestampMs(selfMember?.lastAddedAt);
    if (!lastAdded) return 0;
    return Math.max(0, lastAdded + (room.cooldownMs || 180000) - now);
  }, [room, isAdmin, selfMember, now]);

  /* Party layer: animate only reactions/shouts that arrive after we join. */
  useEffect(() => {
    const baseline = baselineRef.current;
    if (!baseline.ready) {
      reactions.forEach((r) => baseline.reactionIds.add(r.id));
      shouts.forEach((s) => baseline.shoutIds.add(s.id));
      baseline.ready = true;
      return;
    }
    for (const reaction of reactions) {
      if (baseline.reactionIds.has(reaction.id)) continue;
      baseline.reactionIds.add(reaction.id);
      if (room?.floatingReactionsEnabled === false) continue;
      const item = {
        id: reaction.id,
        emoji: reaction.emoji,
        name: reaction.name || "",
        left: 8 + Math.random() * 84,
        sway: (Math.random() - 0.5) * 60
      };
      setFloatingItems((current) => [...current.slice(-14), item]);
      window.setTimeout(() => {
        setFloatingItems((current) => current.filter((existing) => existing.id !== item.id));
      }, 3200);
    }
    for (const shout of shouts) {
      if (baseline.shoutIds.has(shout.id)) continue;
      baseline.shoutIds.add(shout.id);
      if (room?.roomShoutsEnabled === false) continue;
      setActiveShout(shout);
      window.setTimeout(() => {
        setActiveShout((current) => (current?.id === shout.id ? null : current));
      }, 6000);
    }
  }, [reactions, shouts, room]);

  /* Kicked out or room closed → back to the lobby. */
  useEffect(() => {
    if (room?.closed) {
      showToast("The host closed this room.");
      leave();
    }
  }, [room?.closed, leave, showToast]);

  /* ---------- playback actions ---------- */

  const playNext = useCallback(async () => {
    if (!isAdmin) return showToast("Only hosts control playback.");
    if (!isPlayerDevice) {
      return api.sendPlaybackCommand(activeRoomId, user.uid, deviceId, "next");
    }
    const next = nextQueuedSong(songs, room?.nowPlayingId);
    if (next) {
      await api.setNowPlaying(activeRoomId, user.uid, next.id, {
        playbackSongId: next.id, playbackSeconds: 0, playbackState: "playing"
      });
    } else {
      await api.setNowPlaying(activeRoomId, user.uid, null, {
        playbackSongId: null, playbackSeconds: 0, playbackState: "stopped"
      });
    }
  }, [isAdmin, isPlayerDevice, activeRoomId, user, deviceId, songs, room, showToast]);

  const playNextRef = useRef(playNext);
  playNextRef.current = playNext;

  /* Remote "next" command lands on the player device via the playback doc. */
  const handledNextRef = useRef("");
  useEffect(() => {
    if (!isPlayerDevice || !playback) return;
    const { playbackCommand, playbackCommandId, playbackCommandAt } = playback;
    if (playbackCommand !== "next" || !playbackCommandId) return;
    if (playbackCommandId === handledNextRef.current || playbackCommandId.startsWith(deviceId)) return;
    const at = timestampMs(playbackCommandAt);
    if (at && Date.now() - at > 8000) return;
    handledNextRef.current = playbackCommandId;
    playNextRef.current();
  }, [isPlayerDevice, playback, deviceId]);

  const lastSyncRef = useRef(0);
  const actions = useMemo(() => ({
    playNext,
    togglePlay: () => {
      if (!isAdmin || !nowPlayingSong) return showToast("Choose a track first.");
      const playing = playback?.playbackState === "playing";
      const base = Math.max(0, Number(playback?.playbackSeconds) || 0);
      const updatedAt = timestampMs(playback?.playbackUpdatedAt);
      const seconds = playing && updatedAt ? base + Math.max(0, (Date.now() - updatedAt) / 1000) : base;
      api.sendPlaybackCommand(activeRoomId, user.uid, deviceId, playing ? "pause" : "play", {
        playbackSongId: nowPlayingSong.id,
        playbackSeconds: Math.floor(seconds),
        playbackState: playing ? "paused" : "playing"
      });
    },
    restart: () => {
      if (!isAdmin || !room?.nowPlayingId) return;
      api.sendPlaybackCommand(activeRoomId, user.uid, deviceId, "restart", {
        playbackSongId: room.nowPlayingId, playbackSeconds: 0, playbackState: "playing"
      });
    },
    setVolume: (value) => api.updateRoomSettings(activeRoomId, { roomVolume: value }).catch(() => undefined),
    syncPlayback: (songId, seconds, state) => {
      if (songId !== room?.nowPlayingId) return;
      const nowMs = Date.now();
      if (state === "playing" && nowMs - lastSyncRef.current < 1500) return;
      lastSyncRef.current = nowMs;
      api.writePlayback(activeRoomId, user.uid, {
        playbackSongId: songId, playbackSeconds: seconds, playbackState: state
      }).catch(() => undefined);
    },
    handleUnavailable: async (song, errorCode) => {
      if (!song) return;
      const code = Number(errorCode);
      if ([100, 101, 150].includes(code)) {
        const reason = code === 100 ? "The video was removed or made private." : "Embedding is blocked by the video owner.";
        await api.markSongUnavailable(activeRoomId, song.id, reason).catch(() => undefined);
        showToast(`${trackDisplay(song).title} can't play here — skipping.`);
      } else {
        showToast("Playback hiccup — skipping to the next track.");
      }
      window.setTimeout(() => playNextRef.current(), 1500);
    }
  }), [playNext, isAdmin, nowPlayingSong, playback, activeRoomId, user, deviceId, room, showToast]);

  /* ---------- queue actions ---------- */

  const queueActions = useMemo(() => ({
    playNow: (songId) => {
      if (!isAdmin) return showToast("Only hosts control playback.");
      api.setNowPlaying(activeRoomId, user.uid, songId, {
        playbackSongId: songId, playbackSeconds: 0, playbackState: "playing",
        playbackCommand: isPlayerDevice ? "" : "select",
        playbackCommandId: `${deviceId}-${Date.now()}`
      });
    },
    moveSong: (song, direction) => {
      const ordered = [...songs].sort((a, b) => (a.position || 0) - (b.position || 0));
      const index = ordered.findIndex((item) => item.id === song.id);
      const swapWith = ordered[index + direction];
      if (!swapWith || swapWith.id === room?.nowPlayingId) return;
      api.swapSongPositions(activeRoomId, song, swapWith).catch(() => showToast("Couldn't reorder. Try again."));
    },
    removeSong: (song) => {
      if (!isAdmin && song.addedByUid !== user.uid) return;
      api.removeSong(activeRoomId, song.id).catch(() => showToast("Couldn't remove that track."));
    },
    clearQueue: () => api.clearQueue(activeRoomId, songs, user.uid).then(() => showToast("Queue cleared.")),
    reactToSong: (songId, emoji) =>
      api.toggleSongEmoji(activeRoomId, songId, user.uid, emoji).catch(() => undefined),
    sendSongMessage: (songId, text) =>
      api.sendSongMessage(activeRoomId, user.uid, nickname, selfMember?.avatarId || "", songId, text).catch(() => undefined)
  }), [isAdmin, isPlayerDevice, activeRoomId, user, deviceId, songs, room, nickname, selfMember, showToast]);

  /* ---------- people / settings actions ---------- */

  const peopleActions = useMemo(() => ({
    isPlayerDevice,
    promote: (member) => api.promoteMember(activeRoomId, user.uid, member.id).then(() => showToast(`${member.name || "Member"} is now a host.`)),
    demote: (member) => {
      const activeAdmins = Object.keys(room?.adminUids || {}).filter((uid) => members.some((m) => m.id === uid));
      if (activeAdmins.length <= 1) return showToast("A room needs at least one host.");
      api.demoteMember(activeRoomId, user.uid, nickname, member.id, room?.adminUid === member.id);
    },
    remove: (member) => {
      if (!window.confirm(`Remove ${member.name || "this guest"} from the room?`)) return;
      api.removeMember(activeRoomId, member, { uid: user.uid, name: nickname }, deviceId, room)
        .then(() => showToast(`${member.name || "Member"} was removed.`));
    },
    takeOverPlayer: () => api.takeOverPlayer(activeRoomId, user.uid, nickname, deviceId)
      .then(() => showToast("This device is now the party speaker."))
  }), [isPlayerDevice, activeRoomId, user, room, members, nickname, deviceId, showToast]);

  const settingsActions = useMemo(() => ({
    updateSettings: (settings) => api.updateRoomSettings(activeRoomId, settings).catch(() => showToast("Couldn't save that setting.")),
    clearQueue: queueActions.clearQueue,
    closeRoom: () => api.closeRoom(activeRoomId)
  }), [activeRoomId, queueActions, showToast]);

  async function saveProfile({ name, avatarId }) {
    const roomFields = {};
    if (room?.adminUid === user.uid) roomFields.adminName = name;
    if (room?.activeDjUid === user.uid) roomFields.activeDjName = name;
    await api.updateMemberProfile(activeRoomId, user.uid, { name, avatarId }, roomFields);
    auth.setNickname(name);
    setOpenPanel("");
    showToast("Profile updated.");
  }

  async function addTrack(track) {
    try {
      const makeNowPlaying = !nowPlayingSong;
      await api.addSong({
        roomId: activeRoomId,
        user,
        nickname,
        track,
        position: nextQueuePosition(songs),
        makeNowPlaying,
        startPlayback: makeNowPlaying && isAdmin
      });
      showToast(makeNowPlaying ? `Now playing: ${track.title}` : `Queued: ${track.title}`);
      return true;
    } catch (error) {
      showToast(error?.code === "permission-denied"
        ? "Couldn't add that — check cooldown or room rules."
        : "Couldn't add that track. Try again.");
      return false;
    }
  }

  if (!room) return null;

  return (
    <div className="room">
      <FloatingReactions items={floatingItems} />
      <ShoutBanner shout={activeShout} />

      <header className="room-header">
        <TicketCode code={room.id} onClick={() => setOpenPanel("share")} />
        <div className="room-header-info">
          {room.tagline && <p className="room-tagline">{room.tagline}</p>}
          <button className="room-people" onClick={() => setOpenPanel("people")} type="button">
            <span className="face-pile">
              {members.slice(0, 4).map((member) => (
                <Avatar key={member.id} member={member} size="xs" name={member.name} />
              ))}
            </span>
            <Users aria-hidden="true" /> {members.length}
          </button>
        </div>
        <div className="room-header-actions">
          <button className="icon-button" onClick={() => setOpenPanel("share")} title="Invite people" type="button">
            <Share2 aria-hidden="true" />
          </button>
          <button className="icon-button" onClick={onOpenThemes} title="Change look" type="button">
            <Palette aria-hidden="true" />
          </button>
          {isAdmin && (
            <button className="icon-button" onClick={() => setOpenPanel("settings")} title="Room settings" type="button">
              <Settings aria-hidden="true" />
            </button>
          )}
          <button
            className="icon-button"
            onClick={() => { if (window.confirm("Leave this room?")) leave(); }}
            title="Leave room"
            type="button"
          >
            <DoorOpen aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="room-body">
        <Player
          room={room}
          playback={playback}
          nowPlayingSong={nowPlayingSong}
          upcomingCount={upcomingSongs.length}
          isAdmin={isAdmin}
          isPlayerDevice={isPlayerDevice}
          user={user}
          deviceId={deviceId}
          now={now}
          actions={actions}
          showToast={showToast}
        />
        <Queue
          upcomingSongs={upcomingSongs}
          playedSongs={playedSongs}
          nowPlayingId={room.nowPlayingId}
          messages={messages}
          user={user}
          isAdmin={isAdmin}
          actions={queueActions}
          showToast={showToast}
        />
      </div>

      <nav className="party-bar">
        <button className="party-action" onClick={() => setOpenPanel("add")} type="button">
          <Plus aria-hidden="true" /> Add music
        </button>
        {room.floatingReactionsEnabled !== false && (
          <div className="party-reactions" role="group" aria-label="Send a reaction">
            {EMOJIS.slice(0, 4).map((emoji) => (
              <button
                key={emoji}
                className="party-emoji"
                onClick={() => api.sendReaction(activeRoomId, user.uid, nickname, emoji).catch(() => undefined)}
                type="button"
                aria-label={`React ${emoji}`}
              >
                {emoji}
              </button>
            ))}
            <button className="party-emoji" onClick={() => setOpenPanel("reactions")} type="button" aria-label="More reactions">
              <SmilePlus aria-hidden="true" />
            </button>
          </div>
        )}
        {room.roomShoutsEnabled !== false && (
          <button className="party-action party-action-ghost" onClick={() => setOpenPanel("shout")} type="button">
            <Megaphone aria-hidden="true" /> Shout
          </button>
        )}
      </nav>

      {cooldownRemainingMs > 0 && (
        <p className="cooldown-strip" role="status">
          Next add in {formatCountdown(cooldownRemainingMs)}
        </p>
      )}

      {openPanel === "add" && (
        <AddMusic
          room={room}
          isAdmin={isAdmin}
          cooldownRemainingMs={cooldownRemainingMs}
          onAdd={addTrack}
          onClose={() => setOpenPanel("")}
          showToast={showToast}
        />
      )}
      {openPanel === "people" && (
        <PeoplePanel
          room={room}
          members={members}
          user={user}
          isAdmin={isAdmin}
          actions={peopleActions}
          onEditProfile={() => setOpenPanel("profile")}
          onClose={() => setOpenPanel("")}
        />
      )}
      {openPanel === "profile" && (
        <ProfileEditor member={selfMember} onSave={saveProfile} onClose={() => setOpenPanel("")} showToast={showToast} />
      )}
      {openPanel === "settings" && isAdmin && (
        <SettingsPanel room={room} songs={songs} actions={settingsActions} onClose={() => setOpenPanel("")} showToast={showToast} />
      )}
      {openPanel === "share" && (
        <SharePanel roomId={room.id} onClose={() => setOpenPanel("")} showToast={showToast} />
      )}
      {openPanel === "shout" && (
        <ShoutComposer
          onSend={(text) => api.sendShout(activeRoomId, user.uid, nickname, selfMember?.avatarId || "", text).catch(() => undefined)}
          onClose={() => setOpenPanel("")}
          showToast={showToast}
        />
      )}
      {openPanel === "reactions" && (
        <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setOpenPanel(""); }}>
          <section className="modal">
            <div className="emoji-grid">
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  className="emoji-button"
                  onClick={() => {
                    api.sendReaction(activeRoomId, user.uid, nickname, emoji).catch(() => undefined);
                    setOpenPanel("");
                  }}
                  type="button"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
