"use client";

import { useEffect, useState } from "react";

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://carcat.org"
).replace(/\/$/, "");

const REACTION_ICONS = {
  "like-of": "❤️",
  "repost-of": "🔄",
  "bookmark-of": "🔖",
};

const RESPONSE_ICONS = {
  "in-reply-to": "💬",
  "mention-of": "🔗",
};

const formatDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
      })
    : null;

// Fetches webmentions for a wiki note from webmention.io.
// Queries both "/wiki/slug/" and "/wiki/slug" since people share either form.
export function useWebmentions(slug) {
  const [mentions, setMentions] = useState(null);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    const path = `${SITE_URL}/wiki/${slug}`;
    const params = new URLSearchParams({ "per-page": "200", "sort-dir": "up" });
    params.append("target[]", `${path}/`);
    params.append("target[]", path);

    fetch(`https://webmention.io/api/mentions.jf2?${params}`)
      .then((res) => (res.ok ? res.json() : { children: [] }))
      .then((data) => !cancelled && setMentions(data.children || []))
      .catch(() => !cancelled && setMentions([]));

    return () => {
      cancelled = true;
    };
  }, [slug]);

  return mentions;
}

function Avatar({ author }) {
  const name = author?.name || "Someone";
  return author?.photo ? (
    <img
      className="mention-avatar"
      src={author.photo}
      alt={name}
      title={name}
      loading="lazy"
      width={24}
      height={24}
    />
  ) : (
    <span className="mention-avatar mention-avatar-blank" title={name}>
      ?
    </span>
  );
}

export default function Mentions({ mentions }) {
  if (!mentions?.length) return null;

  const reactions = mentions.filter((m) => REACTION_ICONS[m["wm-property"]]);
  const responses = mentions.filter((m) => RESPONSE_ICONS[m["wm-property"]]);
  if (!reactions.length && !responses.length) return null;

  return (
    <>
      <h3>Mentions</h3>

      {responses.length > 0 && (
        <div className="mentions-group">
          <h4>Responses</h4>
          <ul className="mention-responses">
            {responses.map((m) => (
              <li key={m["wm-id"]}>
                <Avatar author={m.author} />
                <span aria-hidden="true">{RESPONSE_ICONS[m["wm-property"]]}</span>
                <a href={m.url} target="_blank" rel="noopener noreferrer">
                  {m.author?.name || m.url}
                </a>
                <span className="mention-date">
                  {formatDate(m.published || m["wm-received"])}
                </span>
                {m.content?.text && (
                  <p className="mention-content">
                    {m.content.text.length > 280
                      ? `${m.content.text.slice(0, 280)}…`
                      : m.content.text}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {reactions.length > 0 && (
        <div className="mentions-group">
          <h4>Reactions</h4>
          <div className="mention-reactions">
            {reactions.map((m) => (
              <a
                key={m["wm-id"]}
                href={m.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mention-reaction"
                title={`${m.author?.name || "Someone"} ${
                  m["wm-property"] === "like-of"
                    ? "liked"
                    : m["wm-property"] === "repost-of"
                      ? "reposted"
                      : "bookmarked"
                } this`}
              >
                <Avatar author={m.author} />
                <span aria-hidden="true">{REACTION_ICONS[m["wm-property"]]}</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
