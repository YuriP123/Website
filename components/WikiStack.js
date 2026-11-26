"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Mentions, { useWebmentions } from "./Mentions";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";
// Opens as a pane through handleContentClick, like every /wiki/ link
const STREAM_SLUG = "stream";

const formatDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        timeZone: "UTC",
      })
    : null;

// "/wiki/foo/bar/" -> "foo/bar"
const slugFromHref = (href) =>
  decodeURIComponent(
    href
      .replace(/^\/wiki\//, "")
      .replace(/[?#].*$/, "")
      .replace(/\/$/, ""),
  );

async function fetchNote(slug) {
  const res = await fetch(`${BASE_PATH}/api/wiki/${slug}`);
  if (!res.ok) throw new Error(`Note not found: ${slug}`);
  return res.json();
}

// Backlinks, source, stream link and webmentions for one note.
// Rendered only when at least one of them has something to show.
function Elsewhere({ note }) {
  const mentions = useWebmentions(note.slug);
  const hasStatic = note.backlinks?.length > 0 || note.source || note.planted;
  if (!hasStatic && !mentions?.length) return null;

  return (
    <section className="garden-card garden-elsewhere">
      <h2>Elsewhere</h2>
      {note.backlinks?.length > 0 && (
        <>
          <h3>In my garden</h3>
          <p>Notes that link to this note.</p>
          <ul>
            {note.backlinks.map((b) => (
              <li key={b.slug}>
                <a href={`/wiki/${b.slug}`}>{b.title}</a>
              </li>
            ))}
          </ul>
        </>
      )}
      {note.source && (
        <>
          <h3>Source</h3>
          <p>
            {note.author && <>{note.author}: </>}
            <a href={note.source} target="_blank" rel="noopener noreferrer">
              {note.source}
            </a>
          </p>
        </>
      )}
      {note.planted && (
        <>
          <h3>In the stream</h3>
          <p>
            Planted on {formatDate(note.planted)}. See what else was planted in
            the <a href={`/wiki/${STREAM_SLUG}`}>stream</a>.
          </p>
        </>
      )}
      <Mentions mentions={mentions} />
    </section>
  );
}

export default function WikiStack({ initialNote }) {
  // Open panes, left to right. Each: { slug, title, html, tags, planted, tended, backlinks, loading }
  const [stack, setStack] = useState([initialNote]);
  const [isVisible, setIsVisible] = useState(false);
  const [restored, setRestored] = useState(false);
  const containerRef = useRef(null);
  const router = useRouter();

  // Fade in on mount
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // Reopen panes listed in the URL (?stack=a&stack=b)
  useEffect(() => {
    const slugs = new URLSearchParams(window.location.search).getAll("stack");
    (async () => {
      for (const slug of slugs) {
        if (slug === initialNote.slug) continue;
        try {
          const note = await fetchNote(slug);
          setStack((prev) =>
            prev.some((n) => n.slug === slug) ? prev : [...prev, note],
          );
        } catch {
          // Unpublished or removed note: skip it
        }
      }
      setRestored(true);
    })();
  }, [initialNote.slug]);

  // Keep the URL in sync with the open panes so the stack can be shared
  useEffect(() => {
    if (!restored) return;
    const params = new URLSearchParams();
    stack
      .slice(1)
      .filter((n) => !n.loading)
      .forEach((n) => params.append("stack", n.slug));
    const query = params.toString();
    const url =
      window.location.pathname +
      (query ? `?${query}` : "") +
      window.location.hash;
    window.history.replaceState(window.history.state, "", url);
  }, [stack, restored]);

  // Scroll to the newest pane when one is added
  useEffect(() => {
    containerRef.current?.scrollTo({
      left: containerRef.current.scrollWidth,
      behavior: "smooth",
    });
  }, [stack.length]);

  const addToStack = async (slug) => {
    if (stack.some((n) => n.slug === slug)) {
      document
        .getElementById(`pane-${slug}`)
        ?.scrollIntoView({ behavior: "smooth", inline: "center" });
      return;
    }

    setStack((prev) => [...prev, { slug, loading: true }]);
    try {
      const note = await fetchNote(slug);
      setStack((prev) =>
        prev.map((n) => (n.slug === slug ? { ...note, loading: false } : n)),
      );
    } catch (err) {
      console.error(err);
      setStack((prev) => prev.filter((n) => n.slug !== slug));
    }
  };

  // Internal links open as a new pane instead of navigating
  const handleContentClick = (e) => {
    const link = e.target.closest("a");
    const href = link?.getAttribute("href");
    if (href && href.startsWith("/wiki/") && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      addToStack(slugFromHref(href));
    }
  };

  return (
    <div className={`garden ${isVisible ? "visible" : ""}`}>
      <button
        className="garden-desktop-button"
        onClick={() => router.push("/")}
        title="Back to desktop"
        aria-label="Back to desktop"
      >
        🏠
      </button>

      <div ref={containerRef} className="garden-panes">
        {stack.map((note, index) => (
          <article
            key={note.slug}
            id={`pane-${note.slug}`}
            className="garden-pane"
          >
            <header className="garden-card garden-pane-header">
              <div className="garden-pane-title-row">
                <h1>{note.loading ? "Loading…" : note.title}</h1>
                {index > 0 && (
                  <button
                    className="garden-close"
                    onClick={() =>
                      setStack((s) => s.filter((_, i) => i !== index))
                    }
                    aria-label="Close note"
                  >
                    ×
                  </button>
                )}
              </div>
              {!note.loading && note.author && (
                <div className="garden-author">by {note.author}</div>
              )}
              {!note.loading && (note.planted || note.tended) && (
                <div className="garden-dates">
                  {note.planted && (
                    <span>planted: {formatDate(note.planted)}</span>
                  )}
                  {note.tended && (
                    <span>last tended: {formatDate(note.tended)}</span>
                  )}
                </div>
              )}
            </header>

            {note.loading ? (
              <div className="garden-loading">Fetching knowledge…</div>
            ) : (
              <div
                className="garden-pane-body wiki-prose"
                onClick={handleContentClick}
              >
                <div dangerouslySetInnerHTML={{ __html: note.html }} />

                <Elsewhere note={note} />
              </div>
            )}
          </article>
        ))}

        {/* Spacer for comfortable scrolling */}
        <div className="garden-spacer" />
      </div>
    </div>
  );
}
