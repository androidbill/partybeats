import React, { useEffect, useMemo } from "react";
import { X } from "lucide-react";
import { APP_ICON_URL } from "../constants";
import { avatarForId, avatarIdForMember } from "../utils";

export function AppMark({ size = "md" }) {
  return (
    <span className={`app-mark app-mark-${size}`}>
      <img src={APP_ICON_URL} alt="" aria-hidden="true" onError={(e) => { e.currentTarget.style.display = "none"; }} />
      <span className="app-mark-word">Party<em>Beats</em></span>
    </span>
  );
}

/* Signature element: the room code as a glowing marquee ticket stub. */
export function TicketCode({ code, label = "Room code", onClick }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag className="ticket" onClick={onClick} type={onClick ? "button" : undefined} title={onClick ? "Share this room" : undefined}>
      <span className="ticket-label">{label}</span>
      <span className="ticket-code">{code}</span>
      <span className="ticket-bulbs" aria-hidden="true">
        {Array.from({ length: 7 }, (_, i) => <i key={i} style={{ "--bulb": i }} />)}
      </span>
    </Tag>
  );
}

export function Avatar({ member, avatarId, size = "sm", name }) {
  const avatar = avatarForId(member ? avatarIdForMember(member) : avatarId);
  return (
    <span
      className={`avatar avatar-${size}`}
      style={{ "--avatar-a": avatar.colors[0], "--avatar-b": avatar.colors[1] }}
      title={name || avatar.name}
      aria-label={name || avatar.name}
    >
      {avatar.image
        ? <img src={avatar.image} alt="" onError={(e) => { e.currentTarget.replaceWith(document.createTextNode(avatar.icon || "🎧")); }} />
        : avatar.icon}
    </span>
  );
}

export function Modal({ title, subtitle, onClose, children, wide = false }) {
  useEffect(() => {
    const onKey = (event) => { if (event.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <section className={wide ? "modal modal-wide" : "modal"}>
        <header className="modal-head">
          <div>
            <h2>{title}</h2>
            {subtitle && <p className="muted">{subtitle}</p>}
          </div>
          {onClose && (
            <button className="icon-button" onClick={onClose} aria-label="Close" type="button">
              <X aria-hidden="true" />
            </button>
          )}
        </header>
        {children}
      </section>
    </div>
  );
}

export function Toast({ message }) {
  if (!message) return null;
  return <div className="toast" role="status">{message}</div>;
}

export function Equalizer({ paused = false }) {
  return (
    <span className={paused ? "equalizer is-paused" : "equalizer"} aria-hidden="true">
      <i /><i /><i /><i />
    </span>
  );
}

export function Confetti({ burstKey }) {
  const pieces = useMemo(() => Array.from({ length: 42 }, (_, i) => ({
    id: `${burstKey}-${i}`,
    left: Math.random() * 100,
    delay: Math.random() * 0.5,
    hue: [46, 265, 335, 190][i % 4],
    drift: (Math.random() - 0.5) * 240,
    spin: 360 + Math.random() * 540
  })), [burstKey]);
  if (!burstKey) return null;
  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((piece) => (
        <i
          key={piece.id}
          style={{
            left: `${piece.left}%`,
            animationDelay: `${piece.delay}s`,
            "--drift": `${piece.drift}px`,
            "--spin": `${piece.spin}deg`,
            "--confetti-hue": piece.hue
          }}
        />
      ))}
    </div>
  );
}

export function FloatingReactions({ items }) {
  if (!items.length) return null;
  return (
    <div className="floating-reactions" aria-hidden="true">
      {items.map((item) => (
        <span key={item.id} className="floating-reaction" style={{ left: `${item.left}%`, "--sway": `${item.sway}px` }}>
          <b>{item.emoji}</b>
          <small>{item.name}</small>
        </span>
      ))}
    </div>
  );
}

export function ShoutBanner({ shout }) {
  if (!shout) return null;
  return (
    <div className="shout-banner" role="status">
      <Avatar avatarId={shout.avatarId} size="xs" name={shout.name} />
      <strong>{shout.name}</strong>
      <span>{shout.text}</span>
    </div>
  );
}
