import { useState } from "react";
import { useTranslation } from "react-i18next";

// Блок приглашения: ссылка, копирование, системный шаринг, мессенджеры и QR-код.
export default function InviteCard({ title, note, url, text }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const eUrl = encodeURIComponent(url);
  const eText = encodeURIComponent(text);
  const msgLinks = [
    { name: "Telegram", icon: "✈️", href: `https://t.me/share/url?url=${eUrl}&text=${eText}` },
    { name: "WhatsApp", icon: "💬", href: `https://wa.me/?text=${eText}%20${eUrl}` },
    { name: "Viber", icon: "📞", href: `viber://forward?text=${eText}%20${eUrl}` },
    { name: "ВКонтакте", icon: "🌐", href: `https://vk.com/share.php?url=${eUrl}&caption=${eText}` },
    { name: "Facebook", icon: "📘", href: `https://www.facebook.com/sharer/sharer.php?u=${eUrl}` },
    { name: "X", icon: "𝕏", href: `https://twitter.com/intent/tweet?url=${eUrl}&text=${eText}` },
  ];

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {}
  }

  async function systemShare() {
    try {
      await navigator.share({ title: "CryptoChess", text, url });
    } catch {
      /* отмена пользователем */
    }
  }

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=${eUrl}`;

  return (
    <div className="invite-card">
      <h3>{title}</h3>
      {note && <p className="muted small">{note}</p>}
      <div className="invite-top">
        <div className="invite-actions">
          <button className="btn btn-primary" onClick={copy}>
            {copied ? t("inviteCopied") : t("inviteCopy")}
          </button>
          {typeof navigator !== "undefined" && navigator.share && (
            <button className="btn btn-ghost" onClick={systemShare}>
              {t("inviteShare")}
            </button>
          )}
          <a className="btn btn-ghost" href={qrUrl} download="cryptochess-qr.png">
            {t("inviteDownloadQr")}
          </a>
        </div>
        <div className="qr">
          <img src={qrUrl} alt="QR" width={100} height={100} />
          <small className="muted">{t("inviteQrNote")}</small>
        </div>
      </div>
      <div className="invite-msgs">
        {msgLinks.map((l) => (
          <a key={l.name} className="msg-btn" href={l.href} target="_blank" rel="noreferrer">
            <span className="msg-ico">{l.icon}</span>
            {l.name}
          </a>
        ))}
      </div>
    </div>
  );
}
