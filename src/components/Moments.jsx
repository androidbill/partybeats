import React, { useMemo } from "react";
import { MessageCircle, Music2, Megaphone, PartyPopper, Sparkles } from "lucide-react";
import { relativeTime, timestampMs, trackDisplay } from "../utils";
import { Avatar, Modal } from "./ui";

/*
  The moments feed, rebuilt.

  v1 wrote a separate `moments` document to Firestore for every song add,
  reaction, comment, and shout — doubling the write (and read) traffic of the
  whole app just to power this panel. v3 derives the same timeline from the
  snapshots the room already holds: songs, messages, shouts, reactions, and
  member joins all carry timestamps. Zero extra network traffic, and old rooms'
  `moments` collections are simply ignored.
*/

const MAX_MOMENTS = 40;

export function useMoments({ songs, messages, shouts, reactions, members }) {
  return useMemo(() => {
    const now = Date.now();
    const memberById = new Map(members.map((member) => [member.id, member]));
    const songById = new Map(songs.map((song) => [song.id, song]));
    const items = [];

    for (const song of songs) {
      items.push({
        id: `song-${song.id}`,
        type: "song",
        at: timestampMs(song.createdAt) || now,
        name: song.addedByName || "Someone",
        member: memberById.get(song.addedByUid),
        text: trackDisplay(song).title
      });
    }
    for (const message of messages) {
      const song = songById.get(message.songId);
      items.push({
        id: `msg-${message.id}`,
        type: "comment",
        at: timestampMs(message.createdAt) || now,
        name: message.name || "Someone",
        avatarId: message.avatarId,
        text: message.text,
        detail: song ? trackDisplay(song).title : ""
      });
    }
    for (const shout of shouts) {
      items.push({
        id: `shout-${shout.id}`,
        type: "shout",
        at: timestampMs(shout.createdAt) || now,
        name: shout.name || "Someone",
        avatarId: shout.avatarId,
        text: shout.text
      });
    }
    for (const reaction of reactions) {
      items.push({
        id: `react-${reaction.id}`,
        type: "reaction",
        at: timestampMs(reaction.createdAt) || now,
        name: reaction.name || "Someone",
        member: memberById.get(reaction.uid),
        emoji: reaction.emoji
      });
    }
    for (const member of members) {
      items.push({
        id: `join-${member.id}`,
        type: "join",
        at: timestampMs(member.joinedAt) || now,
        name: member.name || "Someone",
        member
      });
    }

    items.sort((a, b) => b.at - a.at);
    return items.slice(0, MAX_MOMENTS);
  }, [songs, messages, shouts, reactions, members]);
}

const MOMENT_META = {
  song: { icon: Music2, verb: "queued" },
  comment: { icon: MessageCircle, verb: "commented" },
  shout: { icon: Megaphone, verb: "shouted" },
  reaction: { icon: Sparkles, verb: "reacted" },
  join: { icon: PartyPopper, verb: "joined the party" }
};

export function MomentsPanel({ items, now, onClose }) {
  return (
    <Modal title="Moments" subtitle="Everything the room has been up to." onClose={onClose}>
      {items.length === 0 ? (
        <p className="muted">Quiet so far — queue a track and make the first moment.</p>
      ) : (
        <ol className="moment-list">
          {items.map((item) => {
            const meta = MOMENT_META[item.type] || MOMENT_META.join;
            const Icon = meta.icon;
            return (
              <li key={item.id} className={`moment moment-${item.type}`}>
                {item.member
                  ? <Avatar member={item.member} size="sm" name={item.name} />
                  : <Avatar avatarId={item.avatarId} size="sm" name={item.name} />}
                <div className="moment-copy">
                  <p>
                    <strong>{item.name}</strong>{" "}
                    {item.type === "reaction" ? (
                      <>sent <span className="moment-emoji">{item.emoji}</span></>
                    ) : item.type === "join" ? (
                      meta.verb
                    ) : (
                      <>
                        {meta.verb}
                        {item.type === "song" && <> <em>{item.text}</em></>}
                        {item.type === "shout" && <>: “{item.text}”</>}
                        {item.type === "comment" && (
                          <>
                            {item.detail ? <> on <em>{item.detail}</em></> : null}: “{item.text}”
                          </>
                        )}
                      </>
                    )}
                  </p>
                  <time>{relativeTime(item.at, now)}</time>
                </div>
                <Icon className="moment-icon" aria-hidden="true" />
              </li>
            );
          })}
        </ol>
      )}
    </Modal>
  );
}
