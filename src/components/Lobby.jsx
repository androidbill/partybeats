import React, { useState } from "react";
import { LogOut, Music2, Palette, Sparkles, Users } from "lucide-react";
import { nicknameFor, normalizeRoomId } from "../utils";
import { AppMark } from "./ui";

export default function Lobby({
  auth, session, rememberedRoom, onOpenThemes
}) {
  const { user, nickname, setNickname, signInGoogle, signInGuest, signOut } = auth;
  const [code, setCode] = useState("");

  async function joinWithCode(event) {
    event.preventDefault();
    let joiningUser = user;
    if (!joiningUser) joiningUser = await signInGuest(nickname);
    if (!joiningUser) return;
    session.join(code, { joiningUser });
  }

  async function hostRoom() {
    let hostUser = user;
    if (!hostUser || hostUser.isAnonymous) {
      hostUser = await signInGoogle();
      if (!hostUser) return;
    }
    session.create();
  }

  return (
    <main className="lobby">
      <div className="lobby-lights" aria-hidden="true" />

      <header className="lobby-top">
        <AppMark size="sm" />
        <div className="lobby-top-actions">
          <button className="icon-button" onClick={onOpenThemes} title="Change look" type="button">
            <Palette aria-hidden="true" />
          </button>
          {user && (
            <button className="icon-button" onClick={signOut} title="Sign out" type="button">
              <LogOut aria-hidden="true" />
            </button>
          )}
        </div>
      </header>

      <section className="lobby-hero">
        <p className="lobby-eyebrow"><Sparkles aria-hidden="true" /> One queue. Everyone's music.</p>
        <h1>
          Tonight,<br />everybody's <em>the DJ.</em>
        </h1>
        <p className="lobby-sub">
          Start a room, share the code, and every guest queues tracks from their own phone —
          the music plays on one speaker, in sync, no app installs.
        </p>
      </section>

      <section className="lobby-card">
        {user ? (
          <div className="lobby-identity">
            <span>Partying as</span>
            <input
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              placeholder="Your party name"
              maxLength={30}
              aria-label="Nickname"
            />
          </div>
        ) : (
          <input
            className="lobby-nickname"
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            placeholder="Your party name"
            maxLength={30}
            aria-label="Nickname"
          />
        )}

        <form className="lobby-join" onSubmit={joinWithCode}>
          <input
            className="lobby-code"
            value={code}
            onChange={(event) => setCode(normalizeRoomId(event.target.value))}
            placeholder="VIBE123"
            maxLength={7}
            aria-label="Room code"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
          />
          <button className="primary-button" type="submit" disabled={session.joining}>
            <Users aria-hidden="true" /> {session.joining ? "Joining…" : "Join the party"}
          </button>
        </form>

        {rememberedRoom && (
          <button className="chip lobby-rejoin" onClick={() => session.join(rememberedRoom)} type="button">
            ↻ Rejoin {rememberedRoom}
          </button>
        )}

        <div className="lobby-divider"><span>or</span></div>

        <button className="secondary-button lobby-host" onClick={hostRoom} disabled={session.creating} type="button">
          <Music2 aria-hidden="true" />
          {session.creating ? "Setting the stage…" : "Host a room"}
        </button>
        <p className="muted lobby-host-note">
          Hosting uses Google sign-in so your room stays yours.
          {user && !user.isAnonymous ? ` Signed in as ${nicknameFor(user)}.` : ""}
        </p>
      </section>

      <footer className="lobby-steps">
        <div><b>Host</b><span>Create a room and plug into the speaker</span></div>
        <div><b>Share</b><span>Guests scan the QR or type the code</span></div>
        <div><b>Play</b><span>Everyone queues, reacts, and shouts along</span></div>
      </footer>
    </main>
  );
}
