import React, { useEffect, useState } from "react";
import { Check, Copy, Crown, DoorOpen, Share2, Speaker } from "lucide-react";
import { AVATAR_OPTIONS, COLOR_THEMES, EMOJIS } from "../constants";
import { avatarIdForMember, hasProfanity } from "../utils";
import { Avatar, Modal, TicketCode } from "./ui";

/* ---------- People ---------- */

export function PeoplePanel({ room, members, user, isAdmin, actions, onEditProfile, onClose }) {
  return (
    <Modal title={`In the room (${members.length})`} subtitle={room.tagline || undefined} onClose={onClose}>
      <ul className="people-list">
        {members.map((member) => {
          const memberIsAdmin = Boolean(room.adminUids?.[member.id]);
          const isSelf = member.id === user.uid;
          const isSpeaker = room.activeDjUid === member.id;
          return (
            <li key={member.id} className="person">
              <Avatar member={member} size="md" name={member.name} />
              <div className="person-main">
                <strong>
                  {member.name || "Guest"}
                  {isSelf && <em> (you)</em>}
                </strong>
                <span>
                  {memberIsAdmin && <b className="tag tag-host"><Crown aria-hidden="true" /> Host</b>}
                  {isSpeaker && <b className="tag"><Speaker aria-hidden="true" /> Speaker</b>}
                  {member.isAnonymous && <b className="tag">Guest</b>}
                </span>
              </div>
              <div className="person-actions">
                {isSelf && (
                  <button className="chip" onClick={onEditProfile} type="button">Edit</button>
                )}
                {isAdmin && !isSelf && !memberIsAdmin && !member.isAnonymous && (
                  <button className="chip" onClick={() => actions.promote(member)} type="button">Make host</button>
                )}
                {isAdmin && !isSelf && memberIsAdmin && (
                  <button className="chip" onClick={() => actions.demote(member)} type="button">Remove host</button>
                )}
                {isAdmin && !isSelf && (
                  <button className="chip chip-danger" onClick={() => actions.remove(member)} type="button">Remove</button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {isAdmin && !actions.isPlayerDevice && (
        <button className="secondary-button" onClick={actions.takeOverPlayer} type="button">
          <Speaker aria-hidden="true" /> Play the music on this device
        </button>
      )}
    </Modal>
  );
}

/* ---------- Profile ---------- */

export function ProfileEditor({ member, onSave, onClose, showToast }) {
  const [name, setName] = useState(member?.name || "");
  const [avatarId, setAvatarId] = useState(avatarIdForMember(member));

  function save(event) {
    event.preventDefault();
    const cleanName = name.trim().slice(0, 30);
    if (!cleanName) return;
    if (hasProfanity(cleanName)) {
      showToast("That nickname isn't allowed.");
      return;
    }
    onSave({ name: cleanName, avatarId });
  }

  return (
    <Modal title="Your party look" onClose={onClose}>
      <form className="profile-form" onSubmit={save}>
        <label>
          Nickname
          <input value={name} onChange={(event) => setName(event.target.value)} maxLength={30} autoFocus />
        </label>
        <div className="avatar-grid" role="radiogroup" aria-label="Avatar">
          {AVATAR_OPTIONS.map((avatar) => (
            <button
              key={avatar.id}
              className={avatarId === avatar.id ? "avatar-option is-active" : "avatar-option"}
              onClick={() => setAvatarId(avatar.id)}
              role="radio"
              aria-checked={avatarId === avatar.id}
              title={avatar.name}
              type="button"
            >
              <Avatar avatarId={avatar.id} size="md" name={avatar.name} />
            </button>
          ))}
        </div>
        <button className="primary-button" type="submit">Save</button>
      </form>
    </Modal>
  );
}

/* ---------- Settings (hosts) ---------- */

const TOGGLES = [
  { key: "internalSearchEnabled", label: "In-app YouTube search", note: "Guests search without leaving the room" },
  { key: "cooldownEnabled", label: "Add-cooldown for guests", note: "Space out how often each guest can queue" },
  { key: "floatingReactionsEnabled", label: "Floating reactions", note: "Emoji rise over everyone's screen" },
  { key: "roomShoutsEnabled", label: "Shout-outs", note: "Short messages broadcast to the room" }
];

export function SettingsPanel({ room, songs, actions, onClose, showToast }) {
  const [tagline, setTagline] = useState(room.tagline || "");

  function saveTagline(event) {
    event.preventDefault();
    const clean = tagline.trim().slice(0, 60);
    if (hasProfanity(clean)) {
      showToast("That tagline isn't allowed.");
      return;
    }
    actions.updateSettings({ tagline: clean });
    showToast("Tagline saved.");
  }

  return (
    <Modal title="Room settings" subtitle={`Room ${room.id}`} onClose={onClose}>
      <form className="settings-row" onSubmit={saveTagline}>
        <label className="settings-label">
          Room tagline
          <input
            value={tagline}
            onChange={(event) => setTagline(event.target.value)}
            placeholder="Sam's rooftop birthday 🎂"
            maxLength={60}
          />
        </label>
        <button className="chip" type="submit">Save</button>
      </form>

      <ul className="toggle-list">
        {TOGGLES.map((toggle) => (
          <li key={toggle.key}>
            <div>
              <strong>{toggle.label}</strong>
              <span>{toggle.note}</span>
            </div>
            <button
              className={room[toggle.key] !== false && (toggle.key !== "cooldownEnabled" || room.cooldownEnabled) ? "switch is-on" : "switch"}
              onClick={() => actions.updateSettings({ [toggle.key]: toggle.key === "cooldownEnabled" ? !room.cooldownEnabled : room[toggle.key] === false })}
              role="switch"
              aria-checked={toggle.key === "cooldownEnabled" ? Boolean(room.cooldownEnabled) : room[toggle.key] !== false}
              aria-label={toggle.label}
              type="button"
            >
              <i />
            </button>
          </li>
        ))}
        {room.cooldownEnabled && (
          <li>
            <div>
              <strong>Cooldown length</strong>
              <span>Minutes between adds per guest</span>
            </div>
            <select
              value={room.cooldownMinutes || 3}
              onChange={(event) => {
                const minutes = Number(event.target.value);
                actions.updateSettings({ cooldownMinutes: minutes, cooldownMs: minutes * 60 * 1000 });
              }}
            >
              {[1, 2, 3, 5, 10].map((m) => <option key={m} value={m}>{m} min</option>)}
            </select>
          </li>
        )}
      </ul>

      <div className="danger-zone">
        <button
          className="secondary-button"
          onClick={() => {
            if (songs.length && window.confirm("Clear the entire queue for everyone?")) actions.clearQueue();
          }}
          disabled={!songs.length}
          type="button"
        >
          Clear queue
        </button>
        <button
          className="secondary-button danger"
          onClick={() => {
            if (window.confirm("Close this room for everyone? This can't be undone.")) actions.closeRoom();
          }}
          type="button"
        >
          <DoorOpen aria-hidden="true" /> Close room
        </button>
      </div>
    </Modal>
  );
}

/* ---------- Share ---------- */

export function SharePanel({ roomId, onClose, showToast }) {
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const shareUrl = `${window.location.origin}${window.location.pathname}?room=${roomId}`;

  useEffect(() => {
    let cancelled = false;
    import("qrcode")
      .then((QRCode) => QRCode.toDataURL(shareUrl, { margin: 1, width: 480 }))
      .then((url) => { if (!cancelled) setQrDataUrl(url); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [shareUrl]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast(`Share this link: ${shareUrl}`);
    }
  }

  async function nativeShare() {
    if (!navigator.share) return copyLink();
    try {
      await navigator.share({ title: "Join my PartyBeats room", text: `Room code ${roomId}`, url: shareUrl });
    } catch { /* user cancelled */ }
  }

  return (
    <Modal title="Invite the crowd" subtitle="Scan, tap, or type the code — no app needed." onClose={onClose}>
      <div className="share-body">
        {qrDataUrl && <img className="share-qr" src={qrDataUrl} alt={`QR code to join room ${roomId}`} />}
        <TicketCode code={roomId} />
        <div className="share-actions">
          <button className="primary-button" onClick={nativeShare} type="button">
            <Share2 aria-hidden="true" /> Share link
          </button>
          <button className="secondary-button" onClick={copyLink} type="button">
            {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ---------- Themes ---------- */

export function ThemePicker({ currentTheme, onPick, onClose }) {
  return (
    <Modal title="Room look" subtitle="Only changes this device." onClose={onClose}>
      <ul className="theme-list">
        {COLOR_THEMES.map((theme) => (
          <li key={theme.id}>
            <button
              className={currentTheme === theme.id ? "theme-option is-active" : "theme-option"}
              onClick={() => onPick(theme.id)}
              data-theme={theme.id}
              type="button"
            >
              <span className="theme-swatch" aria-hidden="true"><i /><i /><i /></span>
              <span className="theme-name">
                <strong>{theme.name}</strong>
                <small>{theme.note}</small>
              </span>
              {currentTheme === theme.id && <Check aria-hidden="true" />}
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}

/* ---------- Shout composer ---------- */

export function ShoutComposer({ onSend, onClose, showToast }) {
  const [text, setText] = useState("");

  function send(event) {
    event.preventDefault();
    const clean = text.trim().slice(0, 80);
    if (!clean) return;
    if (hasProfanity(clean)) {
      showToast("That shout isn't allowed.");
      return;
    }
    onSend(clean);
    onClose();
  }

  return (
    <Modal title="Shout to the room" subtitle="Everyone sees it for a few seconds." onClose={onClose}>
      <form className="shout-form" onSubmit={send}>
        <input value={text} onChange={(event) => setText(event.target.value)} placeholder="Happy birthday Maya!! 🎉" maxLength={80} autoFocus />
        <div className="emoji-row">
          {EMOJIS.slice(0, 10).map((emoji) => (
            <button key={emoji} className="emoji-button" onClick={() => setText((t) => `${t}${emoji}`)} type="button">{emoji}</button>
          ))}
        </div>
        <button className="primary-button" type="submit">Shout it</button>
      </form>
    </Modal>
  );
}
