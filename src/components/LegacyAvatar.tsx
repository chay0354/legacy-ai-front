import { useCallback, useEffect, useRef, useState } from "react";
import type { AvatarData } from "../lib/mapAvatarData";
import { avatarApi } from "../lib/api";
import { normalizeRole, can, ACTIONS, type Role } from "../lib/permissions";
import { authHeaders } from "../lib/api";
import { apiUrl } from "../lib/apiUrl";
import { openLiveCallMic, startLiveCallStt, type LiveCallSttSession } from "../lib/liveCallStt";
import { useAnamLiveCall, LiveCallControls } from "./LiveAvatarCall";
import GallerySection from "./GallerySection";
import StageProgressTrack from "./StageProgressTrack";

const PORTRAIT_LIVE_VIDEO_ID = "legacy-portrait-live-video";

/**
 * Legacy AI — Avatar Dashboard
 * The screen a family member sees after the interviews: the preserved person, their
 * six layers of identity, life timeline, anchor stories, the people who shaped them,
 * their wisdom — and a slide-in "Talk with {name}" chat drawer.
 *
 * All content is data-driven. Pass `data` to render a different person (see the
 * DATA shape below / README-Avatar.md). The chat drawer is demo-wired to canned
 * answers; pass `onAsk(question) => answer | Promise<answer>` to make it real.
 *
 * Props:
 *   data     object   - the avatar's content (defaults to Arthur Bellune sample)
 *   accent   string   - accent color (default "#c06a44")
 *   ambient  boolean  - animations on/off (default true)
 *   onAsk(question)   - async resolver for the chat box (optional)
 */

const C = {
  paper: "#ece3d2", panel: "#f4ecdc", card: "#fbf6ec",
  ink: "#2b241c", ink2: "#6e6253", ink3: "#9a8d79", line: "#ddccb0",
  terra: "#c06a44", umber: "#7a5236", gold: "#b3902f", sage: "#71805c",
};
const serif = "'Newsreader', Georgia, serif";
const sans  = "'Hanken Grotesk', system-ui, sans-serif";
const mono  = "'Spline Sans Mono', ui-monospace, monospace";

/* ----------------------------- sample content ----------------------------- */
const DATA = {
  name: "Arthur Bellune",
  initial: "A",
  lifespan: "1934 — 2021",
  meta: "1934 — 2021 · 87 YEARS · BRADDOCK, PENNSYLVANIA",
  tagline: "A steelworker’s son who could fix almost anything — and spent a lifetime learning that some things you don’t fix, you forgive.",
  preservedPct: 94,
  portraitSrc: null,
  viewer: { initial: "M", name: "Maya", relation: "granddaughter" },
  stages: [
    { label: "Foundation", done: true },
    { label: "Enriched", done: true },
    { label: "Legacy", done: false, current: true },
  ],
  heroStats: [
    { n: "54", label: "years with Eleanor" },
    { n: "3", label: "children, 7 grandchildren" },
    { n: "41", label: "years, one repair shop" },
  ],
  layers: [
    { name: "Personality", count: "tone · humor · 12 phrases", cov: 91, color: "#c06a44",
      desc: "Dry, understated, slow to anger and slower to apologize. The warmth was real — he just kept it in his hands instead of his mouth.",
      detail: ["Humor — deadpan, delivered without smiling", "Speaks plainly; never a long word where a short one works", "Shows love through repair, presence, and showing up", "12 favorite phrases preserved in his own cadence"] },
    { name: "Wisdom", count: "31 lessons preserved", cov: 96, color: "#b3902f",
      desc: "Hard-won advice about work, marriage, money, and the long cost of being right. Most of it he learned the slow way.",
      detail: ["On work: do it when no one is watching", "On marriage: you don’t find the one, you keep deciding", "On money: it never touched the problems that mattered", "On pride: being right cost him twenty years"] },
    { name: "Values", count: "9 core values", cov: 89, color: "#71805c",
      desc: "Your word above everything. Family first, even when it cost him. A quiet, unannounced kind of generosity.",
      detail: ["A man’s word is the whole of his credit", "Family before pride, profit, or being right", "Self-reliance — own your living, owe no one", "Generosity given quietly, never for the credit"] },
    { name: "Relationships", count: "23 people", cov: 84, color: "#9a6a4b",
      desc: "Eleanor at the center of everything. His father Tomas, his estranged brother Walt, and the young men he taught the trade.",
      detail: ["Eleanor — 54 years, the steady center", "Tomas, his father — the trade and the code", "Walt, his brother — twenty years of silence, then peace", "The apprentices he treated like sons"] },
    { name: "Stories", count: "47 stories", cov: 97, color: "#a8503a",
      desc: "The night the mill closed. Borrowing three hundred dollars to open the shop. The decades he didn’t speak to his brother.",
      detail: ["The day the mill closed (1952)", "Meeting Eleanor at a dance he nearly skipped", "Opening Bellune & Sons at 31, sure it was a mistake", "The hospital-bed apology that ended the silence"] },
    { name: "Facts", count: "the timeline", cov: 99, color: "#6b5235",
      desc: "Dates, places, jobs, the houses he lived in — the plain scaffolding the rest of a life hangs on.",
      detail: ["Born 1934, Braddock, Pennsylvania", "Married Eleanor Voss, 1959", "Founded Bellune & Sons Repair, 1965", "Three children, seven grandchildren"] },
  ],
  chapters: [
    { year: "1934", title: "Born above the tools", body: "Born in Braddock, Pennsylvania, in the rooms above his father’s repair bench. Steel ran the town, and the town ran on his father’s hands.", appears: "—" },
    { year: "1943", title: "The summer of the river", body: "He nearly drowned in the Monongahela at nine. He never swam again, and he never quite trusted water — or luck — the same way after.", appears: "The Summer of the River" },
    { year: "1952", title: "The mill closed", body: "He watched his father lose everything when the mill shut its gates. Tomas sat at the kitchen table three days in silence. Arthur decided then that no one would ever hold his living again.", appears: "The Day the Mill Closed" },
    { year: "1958", title: "A church dance", body: "He almost didn’t go. Eleanor was laughing across the room, and it took him four more dances to work up the nerve to say a word.", appears: "He Almost Didn’t Go" },
    { year: "1965", title: "Bellune & Sons", body: "At 31, broke and certain it was a mistake, he borrowed three hundred dollars and opened the shop. “Build something they can’t take,” Sal told him.", appears: "Opening the Shop" },
    { year: "1971", title: "The silence begins", body: "A loan, a sharp word, and a door that stayed shut for twenty years. He was right about the money and wrong about everything that mattered.", appears: "Twenty Years Without My Brother" },
    { year: "1991", title: "The apology", body: "At a hospital bedside he finally said the thing he’d owed for two decades. They had nine good years after that.", appears: "Twenty Years Without My Brother" },
    { year: "2009", title: "He handed over the keys", body: "He retired by handing the shop keys to his grandson, with a single instruction: “Keep it honest. It’ll hold.”", appears: "—" },
  ],
  stories: [
    { tone: "Loss", tc: "#6b5235", tb: "rgba(107,82,53,.12)", title: "The Day the Mill Closed", year: "1952",
      quote: "“My father sat at that table three days and didn’t say a word. I decided then I’d never let another man hold my livelihood.”",
      body: "The gates shut and the town’s spine went with them. It set the course of everything Arthur built afterward.", who: ["TB"] },
    { tone: "Love", tc: "#c06a44", tb: "rgba(192,106,68,.12)", title: "He Almost Didn’t Go", year: "1958",
      quote: "“She was laughing at something across the room and I forgot what I was doing. Took me four more dances to say a word.”",
      body: "A church dance he nearly skipped became fifty-four years. He always said you don’t find the one — you decide, and keep deciding.", who: ["EB"] },
    { tone: "Regret", tc: "#b3902f", tb: "rgba(179,144,47,.14)", title: "Twenty Years Without My Brother", year: "1971",
      quote: "“I was right about the money. I was wrong about everything that mattered. Being right cost me twenty years.”",
      body: "A loan and a sharp word closed a door for two decades. He mended it at a hospital bedside — and never let anyone forget the cost.", who: ["WB"] },
    { tone: "Courage", tc: "#71805c", tb: "rgba(113,128,92,.14)", title: "Opening the Shop", year: "1965",
      quote: "“I borrowed three hundred dollars from a man who’d lost everything, and he told me: build something they can’t take.”",
      body: "Thirty-one, broke, and sure it was a mistake. Bellune & Sons stayed open forty-one years.", who: ["SP", "EB"] },
  ],
  people: [
    { initials: "EB", name: "Eleanor Bellune", relation: "Wife · 54 years", note: "The steady center of every decision he ever made.", inf: 5, color: "#c06a44", ask: 1 },
    { initials: "TB", name: "Tomas Bellune", relation: "Father", note: "Gave him the trade, the toolbox, and the meaning of a man’s word.", inf: 5, color: "#6b5235", ask: 4 },
    { initials: "WB", name: "Walt Bellune", relation: "Brother", note: "Estranged for twenty years; reconciled before the end.", inf: 4, color: "#9a6a4b", ask: 2 },
    { initials: "CB", name: "Carol Bellune", relation: "Daughter", note: "The one who finally got her father to sit down and talk.", inf: 4, color: "#71805c", ask: 4 },
    { initials: "SP", name: "Sal Petrov", relation: "Mentor", note: "The machinist who lent him the first three hundred dollars.", inf: 3, color: "#b3902f", ask: 3 },
  ],
  wisdom: [
    { quote: "Measure twice, cut once — and that goes double for the things you say.", context: "His first rule of the shop, and the last thing he learned to apply to people." },
    { quote: "Most arguments aren’t worth winning. I learned that one about twenty years too late.", context: "On his brother, Walt." },
    { quote: "Money solves the problems you think about. It never once touched the ones that kept me up at night.", context: "After the shop finally turned a profit." },
    { quote: "Do the work when no one is watching. That’s the only time it actually counts.", context: "What he told every apprentice on the first day." },
  ],
  phrases: ["“We’ll make it work.”", "“Your word is everything.”", "“Measure twice.”", "“It’ll hold.”", "“Don’t tell your mother.”", "“Build something they can’t take.”"],
  preservation: {
    stats: [
      { n: "11", label: "sessions" }, { n: "14.5", label: "hours recorded" },
      { n: "47", label: "stories" }, { n: "23", label: "people" }, { n: "31", label: "lessons" },
    ],
    note: "First session March 2017 · last session August 2018 · recorded with Carol & Maya.",
  },
  greeting: "Hello, sweetheart. Pull up a chair. Ask me anything you like — I’ll answer the way I always would have.",
  gallery: [],
  suggestions: [
    { q: "Grandpa, what should I do about my career?", a: "Find the thing you’d still do if nobody paid you — then find a way to get paid for it. And learn to fix what you own. A person who can fix things is never quite helpless." },
    { q: "How did you know Grandma was the one?", a: "She laughed at something across a room and I forgot what I was doing. Fifty-four years and she still does it. You don’t find the one, sweetheart. You decide — and then you keep deciding, every day." },
    { q: "What’s your biggest regret?", a: "Twenty years not speaking to my brother over three hundred dollars. I was right about the money. Don’t you ever be that kind of right. Call your brother. Tonight." },
    { q: "Any advice about money?", a: "Save more than feels comfortable. Spend it on good tools and on people. And never let one man hold your whole living — build something they can’t take from you." },
    { q: "What do you want us to remember?", a: "That I showed up. I was never much for speeches. But I was there, and the work was honest. Keep showing up — that’s most of it, right there." },
  ],
};

const INITIAL_COLOR: Record<string, string> = { EB: "#c06a44", TB: "#6b5235", WB: "#9a6a4b", CB: "#71805c", SP: "#b3902f" };

function useInjectedHead() {
  useEffect(() => {
    const id = "legacy-ai-avatar-head";
    if (!document.getElementById("legacy-ai-avatar-fonts")) {
      const link = document.createElement("link");
      link.id = "legacy-ai-avatar-fonts";
      link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,300;0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400;1,6..72,500&family=Hanken+Grotesk:wght@400;500;600;700&family=Spline+Sans+Mono:wght@400;500&display=swap";
      document.head.appendChild(link);
    }
    let style = document.getElementById(id) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement("style");
      style.id = id;
      document.head.appendChild(style);
    }
    style.textContent = `
      @keyframes la-pulse { 0%,100%{transform:scale(1);opacity:.95} 50%{transform:scale(2.1);opacity:.25} }
      .legacy-avatar ::selection { background:#c06a44; color:#fbf6ec }
      .legacy-avatar a { color:inherit }
      .legacy-timeline-scroll-clip { overflow: hidden; width: 100%; min-width: 0; max-width: 100%; }
      .legacy-timeline-rail {
        min-width: 0;
        max-width: 100%;
        scrollbar-width: none;
        -ms-overflow-style: none;
        scroll-behavior: smooth;
        -webkit-overflow-scrolling: touch;
      }
      .legacy-timeline-rail::-webkit-scrollbar {
        display: none;
        width: 0;
        height: 0;
      }
      .legacy-timeline-nav {
        transition: opacity .2s ease, background .2s ease, border-color .2s ease;
      }
      .legacy-timeline-nav:hover:not(:disabled) {
        background: #fbf6ec !important;
        border-color: #c06a44 !important;
      }
      .legacy-timeline-nav:disabled { opacity: 0; pointer-events: none; }
      .legacy-timeline-thumb {
        transition: width .15s ease, left .08s linear;
      }
    `;
  }, []);
}

type ChapterItem = AvatarData["chapters"][number];

function portraitInitials(name: string) {
  return name.split(/\s+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "?";
}

function PortraitPlaceholder({ name, hint }: { name: string; hint?: string }) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, background: "linear-gradient(165deg, #ebe0cc 0%, #d8c8ae 100%)" }}>
      <div style={{ width: 88, height: 88, borderRadius: "50%", background: "rgba(43,36,28,.12)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: serif, fontSize: 34, color: C.umber }}>
        {portraitInitials(name)}
      </div>
      {hint ? <span style={{ fontFamily: serif, fontStyle: "italic", fontSize: 14, color: C.ink3, textAlign: "center", padding: "0 16px" }}>{hint}</span> : null}
    </div>
  );
}

function ChapterTimelineSlider({
  chapters,
  chapter,
  accent,
  onSelect,
}: {
  chapters: ChapterItem[];
  chapter: number;
  accent: string;
  onSelect: (index: number) => void;
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ active: boolean; startX: number; startScroll: number } | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [thumb, setThumb] = useState({ left: 0, width: 72 });
  const [overflows, setOverflows] = useState(false);

  const syncScroll = useCallback(() => {
    const el = railRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const hasOverflow = scrollWidth > clientWidth + 2;
    setOverflows(hasOverflow);
    setCanScrollLeft(scrollLeft > 6);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 6);
    if (!hasOverflow) {
      setThumb({ left: 0, width: clientWidth });
      return;
    }
    const ratio = clientWidth / scrollWidth;
    const thumbWidth = Math.max(56, Math.round(clientWidth * ratio));
    const maxThumbLeft = clientWidth - thumbWidth;
    const scrollRange = scrollWidth - clientWidth;
    const thumbLeft = scrollRange <= 0 ? 0 : (scrollLeft / scrollRange) * maxThumbLeft;
    setThumb({ left: thumbLeft, width: thumbWidth });
  }, []);

  useEffect(() => {
    const el = railRef.current;
    if (!el) return;
    syncScroll();
    el.addEventListener("scroll", syncScroll, { passive: true });
    const ro = new ResizeObserver(syncScroll);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", syncScroll);
      ro.disconnect();
    };
  }, [chapters.length, syncScroll]);

  const scrollBy = (dir: number) => {
    railRef.current?.scrollBy({ left: dir * 118, behavior: "smooth" });
  };

  const jumpToRatio = (ratio: number) => {
    const el = railRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    el.scrollLeft = Math.max(0, Math.min(max, ratio * max));
  };

  const onTrackPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!trackRef.current || !overflows) return;
    const rect = trackRef.current.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    jumpToRatio(Math.max(0, Math.min(1, ratio)));
  };

  const onThumbPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!overflows) return;
    e.stopPropagation();
    const el = railRef.current;
    if (!el) return;
    dragRef.current = { active: true, startX: e.clientX, startScroll: el.scrollLeft };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onThumbPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const el = railRef.current;
    const track = trackRef.current;
    if (!drag?.active || !el || !track) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    const trackWidth = track.clientWidth - thumb.width;
    if (trackWidth <= 0) return;
    const delta = e.clientX - drag.startX;
    el.scrollLeft = drag.startScroll + (delta / trackWidth) * maxScroll;
  };

  const endThumbDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.active) {
      dragRef.current = null;
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const navBtn: React.CSSProperties = {
    flex: "none",
    alignSelf: "center",
    marginTop: 28,
    zIndex: 3,
    width: 32,
    height: 32,
    borderRadius: "50%",
    border: `1px solid ${C.line}`,
    background: "rgba(251,246,236,.92)",
    color: C.ink2,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 14,
    boxShadow: "0 4px 14px rgba(43,36,28,.1)",
    backdropFilter: "blur(6px)",
  };

  return (
    <div className="legacy-timeline" style={{ width: "100%", maxWidth: "100%", boxSizing: "border-box" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "36px minmax(0, 1fr) 36px",
          alignItems: "start",
          width: "100%",
          maxWidth: "100%",
        }}
      >
        <button
          type="button"
          className="legacy-timeline-nav"
          aria-label="Earlier chapters"
          disabled={!canScrollLeft}
          onClick={() => scrollBy(-1)}
          style={navBtn}
        >
          ‹
        </button>

        <div style={{ position: "relative", minWidth: 0, maxWidth: "100%", overflow: "hidden" }}>
          <div style={{ position: "absolute", left: 0, right: 0, top: 36, height: 1, background: C.line, zIndex: 0 }} />

          {canScrollLeft && (
            <div
              aria-hidden
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 0,
                width: 28,
                zIndex: 2,
                pointerEvents: "none",
                background: `linear-gradient(90deg, ${C.paper} 75%, transparent 100%)`,
              }}
            />
          )}
          {canScrollRight && (
            <div
              aria-hidden
              style={{
                position: "absolute",
                right: 0,
                top: 0,
                bottom: 0,
                width: 28,
                zIndex: 2,
                pointerEvents: "none",
                background: `linear-gradient(270deg, ${C.paper} 75%, transparent 100%)`,
              }}
            />
          )}

          <div className="legacy-timeline-scroll-clip">
            <div
              ref={railRef}
              className="legacy-timeline-rail"
              style={{
                display: "flex",
                justifyContent: "flex-start",
                alignItems: "flex-start",
                gap: 8,
                width: "100%",
                minWidth: 0,
                maxWidth: "100%",
                boxSizing: "border-box",
                overflowX: "auto",
                overflowY: "hidden",
                paddingBottom: 8,
                scrollbarWidth: "none",
                msOverflowStyle: "none",
              } as React.CSSProperties}
            >
              {chapters.map((ch, i) => (
              <button
                key={`${ch.year}-${ch.title}-${i}`}
                type="button"
                onClick={() => onSelect(i)}
                style={{
                  flex: "0 0 110px",
                  width: 110,
                  minWidth: 0,
                  maxWidth: 110,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  cursor: "pointer",
                  padding: "0 2px",
                  border: "none",
                  background: "transparent",
                  font: "inherit",
                  boxSizing: "border-box",
                }}
              >
                <div style={{ fontFamily: mono, fontSize: 12, letterSpacing: ".05em", color: i === chapter ? C.ink : C.ink3, width: "100%", textAlign: "center" }}>{ch.year}</div>
                <div style={{ position: "relative", height: 30, display: "flex", alignItems: "center", justifyContent: "center", width: "100%" }}>
                  <div style={{ position: "absolute", width: 24, height: 24, borderRadius: "50%", background: "rgba(192,106,68,.18)", opacity: i === chapter ? 1 : 0, transition: "opacity .25s ease" }} />
                  <div style={{ width: 11, height: 11, borderRadius: "50%", background: i === chapter ? accent : "#c8b79a", border: `2px solid ${C.paper}`, position: "relative", transition: "background .2s ease" }} />
                </div>
                <div
                  style={{
                    fontFamily: serif,
                    fontSize: 13,
                    lineHeight: 1.22,
                    textAlign: "center",
                    color: i === chapter ? C.ink : C.ink2,
                    width: "100%",
                    overflow: "hidden",
                    display: "-webkit-box",
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: "vertical",
                    wordBreak: "break-word",
                  }}
                >
                  {ch.title}
                </div>
              </button>
            ))}
              <div aria-hidden style={{ flex: "0 0 4px", width: 4, minWidth: 4 }} />
            </div>
          </div>
        </div>

        <button
          type="button"
          className="legacy-timeline-nav"
          aria-label="Later chapters"
          disabled={!canScrollRight}
          onClick={() => scrollBy(1)}
          style={navBtn}
        >
          ›
        </button>
      </div>

      {overflows && (
        <div style={{ marginTop: 10, marginLeft: 36, marginRight: 36, minWidth: 0 }}>
          <div
            ref={trackRef}
            role="scrollbar"
            aria-orientation="horizontal"
            aria-valuemin={0}
            aria-valuemax={100}
            onPointerDown={onTrackPointerDown}
            style={{
              position: "relative",
              height: 6,
              borderRadius: 999,
              background: C.line,
              cursor: "pointer",
            }}
          >
            <div
              className="legacy-timeline-thumb"
              role="presentation"
              onPointerDown={onThumbPointerDown}
              onPointerMove={onThumbPointerMove}
              onPointerUp={endThumbDrag}
              onPointerCancel={endThumbDrag}
              style={{
                position: "absolute",
                top: 0,
                left: thumb.left,
                width: thumb.width,
                height: 6,
                borderRadius: 999,
                background: `linear-gradient(90deg, ${accent}, ${C.gold})`,
                boxShadow: "0 1px 4px rgba(192,106,68,.35)",
                cursor: "grab",
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

interface LegacyAvatarProps {
  data?: AvatarData;
  accent?: string;
  ambient?: boolean;
  onAsk?: ((question: string) => string | Promise<string>) | null;
  /** Creator id for talking-video renders (owner's legacy). */
  talkCreatorId?: string;
  /** When true, plays cloned voice audio for text answers (portrait stays static). */
  enableTalkingVideo?: boolean;
  /** Anam live avatar (face + voice) is provisioned and ready for a real-time call. */
  liveReady?: boolean;
  /** Show the owner-only CTA to open Avatar Studio when no live avatar yet. */
  showCreateAvatar?: boolean;
  onCreateAvatar?: () => void;
  role?: Role | string;
  /** Signed URL for the creator's recorded voice sample (from Avatar Studio / Record voice). */
  voiceSampleUrl?: string | null;
}

type VideoStatus = "idle" | "rendering" | "ready" | "error";

function getSpeechRecognitionAvailable(): boolean {
  if (typeof window === "undefined") return false;
  return "SpeechRecognition" in window || "webkitSpeechRecognition" in window;
}

export default function LegacyAvatar({
  data = DATA as AvatarData,
  accent = C.terra,
  ambient = true,
  onAsk = null,
  talkCreatorId,
  enableTalkingVideo = false,
  liveReady = false,
  showCreateAvatar = false,
  onCreateAvatar,
  role: rawRole = "member",
  voiceSampleUrl = null,
}: LegacyAvatarProps) {
  useInjectedHead();
  const D = data;
  const role = normalizeRole(rawRole) || "member";
  const canChat = can(role, ACTIONS.CHAT_WITH_AVATAR);

  const [layer, setLayer] = useState(0);
  const [chapter, setChapter] = useState(0);
  const [callOpen, setCallOpen] = useState(false);
  const [portraitLive, setPortraitLive] = useState(false);
  const [portraitConnectKey, setPortraitConnectKey] = useState(0);
  const [ask, setAsk] = useState(-1);          // index into suggestions, -1 greeting
  const [custom, setCustom] = useState<{ q: string; a: string } | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);

  // Webcam self-view + speech-to-text handles for the live call.
  const selfVideoRef = useRef<HTMLVideoElement | null>(null);
  const selfStreamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const liveSttRef = useRef<LiveCallSttSession | null>(null);
  const sttErrorRef = useRef<string | null>(null);
  const [callError, setCallError] = useState<string | null>(null);
  const [sttStarting, setSttStarting] = useState(false);

  // Talking video state — kept separate from the text so the conversation never blocks on the render.
  const [videoStatus, setVideoStatus] = useState<VideoStatus>("idle");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoMsg, setVideoMsg] = useState("");
  const renderToken = useRef(0);
  const voiceAudioRef = useRef<HTMLAudioElement | null>(null);
  const voiceSampleRef = useRef<HTMLAudioElement | null>(null);
  const [voiceSamplePlaying, setVoiceSamplePlaying] = useState(false);

  const playClonedVoice = useCallback((audioUrl: string) => {
    voiceAudioRef.current?.pause();
    const a = new Audio(audioUrl);
    voiceAudioRef.current = a;
    void a.play().catch(() => { /* autoplay blocked — user already interacted */ });
  }, []);

  useEffect(() => () => {
    voiceAudioRef.current?.pause();
    voiceSampleRef.current?.pause();
  }, []);

  const toggleHearVoice = useCallback(() => {
    if (!voiceSampleUrl) return;
    if (voiceSamplePlaying) {
      voiceSampleRef.current?.pause();
      setVoiceSamplePlaying(false);
      return;
    }
    voiceAudioRef.current?.pause();
    const audio = voiceSampleRef.current || new Audio(voiceSampleUrl);
    voiceSampleRef.current = audio;
    audio.onended = () => setVoiceSamplePlaying(false);
    void audio.play()
      .then(() => setVoiceSamplePlaying(true))
      .catch(() => setVoiceSamplePlaying(false));
  }, [voiceSampleUrl, voiceSamplePlaying]);

  // Play the answer in the cloned voice (portrait stays static; Live Call shows the face).
  const speakAnswer = (text: string) => {
    if (!enableTalkingVideo || !text) return;
    const token = ++renderToken.current;
    voiceAudioRef.current?.pause();
    setVideoUrl(null);
    setVideoStatus("rendering");
    setVideoMsg("Speaking in your voice…");
    avatarApi.playSpeech(text, talkCreatorId, {
      onAudio: (url) => {
        if (token !== renderToken.current) return;
        playClonedVoice(url);
        setVideoStatus("ready");
        setVideoMsg("");
      },
      onNotice: (notice) => {
        if (token !== renderToken.current) return;
        setVideoStatus("ready");
        setVideoMsg(notice);
      },
    }).catch((e) => {
      if (token !== renderToken.current) return;
      setVideoStatus("error");
      setVideoMsg(e instanceof Error ? e.message : "Could not play voice");
    });
  };

  const send = useCallback(async (override?: string) => {
    const q = (override ?? input).trim();
    if (!q || busy) return;
    setInput("");
    if (onAsk) {
      setBusy(true);
      // Cancel any in-flight render immediately so the new question takes over.
      renderToken.current++;
      setVideoStatus("idle");
      setVideoUrl(null);
      try {
        const a = await onAsk(q);
        const answer = a || "…";
        setCustom({ q, a: answer });
        setAsk(-1);
        speakAnswer(answer);
      } finally { setBusy(false); }
    } else {
      const hit = D.suggestions.find((s) => s.q.toLowerCase() === q.toLowerCase());
      const answer = hit ? hit.a : "That’s a good question. In the full product I’d answer this in his own voice — wire `onAsk` to your model to make it real.";
      setCustom({ q, a: answer });
      setAsk(-1);
      speakAnswer(answer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, busy, onAsk]);

  const stopListening = useCallback(() => {
    liveSttRef.current?.stop();
    liveSttRef.current = null;
    setListening(false);
    setSttStarting(false);
  }, []);

  const toggleListen = useCallback(async () => {
    if (sttStarting) return;

    // Send: stop mic session and submit whatever we heard.
    if (listening) {
      const session = liveSttRef.current;
      const q = (session?.getTranscript() || input).trim();
      session?.stop();
      liveSttRef.current = null;
      setListening(false);
      if (q) {
        setCallError(null);
        void send(q);
      } else if (sttErrorRef.current === "not-allowed" || sttErrorRef.current === "service-not-allowed") {
        setCallError("Microphone access is blocked. Click the lock icon in the address bar → allow Microphone → try again.");
      } else {
        setCallError("No speech detected. Wait for “Mic ready”, speak clearly, then tap Send — or use Type.");
      }
      return;
    }

    if (!getSpeechRecognitionAvailable()) {
      setCallError("Voice input needs Chrome or Edge on desktop. Or tap Type to write your question.");
      return;
    }

    setCallError(null);
    setInput("");
    sttErrorRef.current = null;
    setSttStarting(true);

    try {
      if (!micStreamRef.current?.active) {
        micStreamRef.current?.getTracks().forEach((t) => t.stop());
        micStreamRef.current = await openLiveCallMic();
      }
    } catch {
      setSttStarting(false);
      setCallError("Microphone access denied. Allow the mic in your browser, then tap Speak again — or use Type.");
      return;
    }

    // Brief pause after mic opens — helps SpeechRecognition attach on Windows.
    await new Promise((r) => window.setTimeout(r, 150));

    const session = startLiveCallStt(micStreamRef.current, {
      onPartial: (t) => setInput(t),
      onError: (code) => { sttErrorRef.current = code; },
    });

    setSttStarting(false);
    if (!session) {
      setCallError("Voice input isn't available in this browser. Use Type instead.");
      return;
    }

    liveSttRef.current = session;
    setListening(true);
  }, [sttStarting, listening, input, send]);

  const openCall = (askIdx: number | null = null) => {
    setCallOpen(true);
    setCustom(null);
    if (askIdx != null && D.suggestions[askIdx]) {
      setAsk(-1);
      void send(D.suggestions[askIdx].q);
    } else {
      setAsk(-1);
      speakAnswer(D.greeting);
    }
  };

  const endCall = useCallback(() => {
    setCallOpen(false);
    stopListening();
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
    renderToken.current++;
    voiceAudioRef.current?.pause();
    setVideoStatus("idle");
    setVideoUrl(null);
    setCallError(null);
  }, [stopListening]);

  // Live call: open camera + mic when the call starts so Speak works instantly.
  useEffect(() => {
    if (!callOpen) return;
    let cancelled = false;

    navigator.mediaDevices?.getUserMedia({ video: true, audio: false })
      .then((stream) => {
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        selfStreamRef.current = stream;
        if (selfVideoRef.current) selfVideoRef.current.srcObject = stream;
      })
      .catch(() => { /* no camera — call still works */ });

    openLiveCallMic()
      .then((stream) => {
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        micStreamRef.current = stream;
      })
      .catch(() => { /* user can still tap Speak to retry permission */ });

    return () => {
      cancelled = true;
      selfStreamRef.current?.getTracks().forEach((t) => t.stop());
      selfStreamRef.current = null;
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    };
  }, [callOpen]);

  const al = D.layers[Math.min(layer, Math.max(0, D.layers.length - 1))] ?? D.layers[0];
  const ac = D.chapters[Math.min(chapter, Math.max(0, D.chapters.length - 1))] ?? D.chapters[0] ?? {
    year: '—', title: 'Your legacy', body: '', appears: '—',
  };
  const showQ = ask >= 0 || !!custom;
  const talkQ = custom ? custom.q : ask >= 0 && D.suggestions[ask] ? D.suggestions[ask].q : "";
  const talkA = custom ? custom.a : ask >= 0 && D.suggestions[ask] ? D.suggestions[ask].a : D.greeting;
  const firstName = D.name.split(" ")[0];

  const startPortraitLive = useCallback(() => {
    if (!liveReady) return;
    setPortraitLive(true);
    setPortraitConnectKey((k) => k + 1);
    requestAnimationFrame(() => {
      document.getElementById("portrait-live")?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, [liveReady]);

  const endPortraitLive = useCallback(() => {
    setPortraitConnectKey(0);
    setPortraitLive(false);
  }, []);

  const wrap = { maxWidth: 1180, margin: "0 auto", padding: "54px 40px" };
  const eyebrow = { fontFamily: mono, fontSize: 11, letterSpacing: ".24em", textTransform: "uppercase", color: C.ink3 };
  const h2 = { fontFamily: serif, fontWeight: 500, fontSize: 36, letterSpacing: "-.01em", color: C.ink };

  return (
    <div className="legacy-avatar legacy-page-with-nav" style={{
      minHeight: "100dvh", background: C.paper,
      backgroundImage: "radial-gradient(1100px 560px at 82% -8%, rgba(255,251,242,.7), transparent 60%), radial-gradient(900px 520px at -10% 116%, rgba(122,82,54,.07), transparent 60%)",
      fontFamily: sans, color: C.ink, WebkitFontSmoothing: "antialiased",
      width: "100%", maxWidth: "100vw", overflowX: "clip", boxSizing: "border-box",
    }}>
      {/* NAV */}
      <div style={{ position: "sticky", top: 0, zIndex: 40, backdropFilter: "saturate(1.1) blur(8px)", background: "rgba(236,227,210,.82)", borderBottom: `1px solid ${C.line}` }}>
        <div className="legacy-top-nav-inner" style={{ maxWidth: 1180, margin: "0 auto", padding: "0 40px", height: 66, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <Mark border={C.umber} color={C.umber} />
            <div style={{ fontFamily: serif, fontSize: 21, letterSpacing: ".01em", color: C.ink }}>Legacy AI</div>
          </div>
          <div className="legacy-nav-links" style={{ display: "flex", alignItems: "center", gap: 30, fontSize: 13.5, color: C.ink2 }}>
            <a href="#layers" style={{ textDecoration: "none" }}>Who he was</a>
            <a href="#timeline" style={{ textDecoration: "none" }}>His life</a>
            <a href="#stories" style={{ textDecoration: "none" }}>Stories</a>
            <a href="#gallery" style={{ textDecoration: "none" }}>Gallery</a>
            <a href="#people" style={{ textDecoration: "none" }}>People</a>
            <a href="#wisdom" style={{ textDecoration: "none" }}>Wisdom</a>
          </div>
          <div className="legacy-nav-user-meta" style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <div style={{ width: 30, height: 30, borderRadius: "50%", background: C.sage, color: "#fbf6ec", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: serif, fontSize: 14 }}>{D.viewer.initial}</div>
              <div style={{ fontSize: 12.5, lineHeight: 1.2 }}><div style={{ color: C.ink }}>{D.viewer.name}</div><div style={{ color: C.ink3, fontSize: 11 }}>{D.viewer.relation}</div></div>
            </div>
            <button
              onClick={() => {
                if (showCreateAvatar && !liveReady && onCreateAvatar) onCreateAvatar();
                else if (liveReady) startPortraitLive();
                else if (canChat && onAsk) openCall();
              }}
              style={{ border: "none", cursor: "pointer", background: accent, color: "#fbf6ec", fontFamily: sans, fontWeight: 600, fontSize: 13, padding: "10px 18px", borderRadius: 999, boxShadow: "0 6px 16px rgba(192,106,68,.28)" }}
            >
              {showCreateAvatar && !liveReady ? "Create avatar" : `Talk to ${firstName}`}
            </button>
          </div>
        </div>
      </div>

      {/* HERO */}
      <div className="legacy-section-wrap" style={{ maxWidth: 1180, margin: "0 auto", padding: "64px 40px 40px" }}>
        <div className="legacy-grid-hero-side" style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 60, alignItems: "center" }}>
          <div>
            <PortraitCard
              D={D}
              accent={accent}
              liveReady={liveReady}
              canChat={canChat}
              portraitLive={portraitLive}
              portraitConnectKey={portraitConnectKey}
              talkCreatorId={talkCreatorId}
              showCreateAvatar={showCreateAvatar}
              onCreateAvatar={onCreateAvatar}
              onStartLive={startPortraitLive}
              onTextTalk={() => openCall()}
              onEndLive={endPortraitLive}
            />
          </div>

          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: accent, animation: ambient ? "la-pulse 2.6s ease-in-out infinite" : "none" }} />
              <div style={{ ...eyebrow, letterSpacing: ".24em" }}>Legacy Avatar · alive · {D.preservedPct}% preserved</div>
            </div>
            <h1 className="legacy-hero-h1" style={{ fontFamily: serif, fontWeight: 400, fontSize: 72, lineHeight: 0.96, letterSpacing: "-.02em", margin: 0, color: C.ink }}>{D.name}</h1>
            <div style={{ fontFamily: mono, fontSize: 12.5, letterSpacing: ".1em", color: C.ink3, marginTop: 14 }}>{D.meta}</div>
            <p style={{ fontFamily: serif, fontStyle: "italic", fontWeight: 300, fontSize: 25, lineHeight: 1.4, color: C.ink2, maxWidth: 600, margin: "22px 0 0" }}>{D.tagline}</p>

            {/* stages */}
            <StageProgressTrack stages={D.stages} />

            <div className="legacy-hero-stats" style={{ display: "flex", gap: 40, marginBottom: 30 }}>
              {D.heroStats.map((s) => (
                <div key={s.label}><div style={{ fontFamily: serif, fontSize: 30, color: C.ink }}>{s.n}</div><div style={{ fontSize: 11.5, color: C.ink3, letterSpacing: ".04em" }}>{s.label}</div></div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
              {showCreateAvatar && !liveReady && onCreateAvatar ? (
                <>
                  <button onClick={onCreateAvatar} style={{ border: "none", cursor: "pointer", background: C.ink, color: C.paper, fontFamily: sans, fontWeight: 600, fontSize: 14, padding: "14px 24px", borderRadius: 999, display: "inline-flex", alignItems: "center", gap: 9 }}>
                    <span style={{ fontSize: 15 }}>📷</span> Create your avatar (photo + voice)
                  </button>
                  <p style={{ fontSize: 13, color: C.ink2, margin: 0, maxWidth: 360, lineHeight: 1.5 }}>
                    Record your voice and take a photo — the system builds your live talking avatar automatically.
                  </p>
                </>
              ) : voiceSampleUrl ? (
                <button
                  onClick={toggleHearVoice}
                  style={{ border: "none", cursor: "pointer", background: C.ink, color: C.paper, fontFamily: sans, fontWeight: 600, fontSize: 14, padding: "14px 24px", borderRadius: 999, display: "inline-flex", alignItems: "center", gap: 9 }}
                >
                  <span style={{ fontSize: 15 }}>{voiceSamplePlaying ? "⏸" : "♪"}</span>
                  {voiceSamplePlaying ? "Pause" : `Hear ${firstName}'s voice`}
                </button>
              ) : null}
              {enableTalkingVideo && (
                <button onClick={() => openCall()} style={{ cursor: "pointer", background: "transparent", border: `1px solid ${C.ink}`, color: C.ink, fontFamily: sans, fontWeight: 500, fontSize: 14, padding: "14px 22px", borderRadius: 999, display: "inline-flex", alignItems: "center", gap: 11 }}>
                  <span style={{ display: "inline-flex", alignItems: "flex-end", gap: 2, height: 15 }}>
                    {[6, 13, 9, 15, 7].map((h, i) => <span key={i} style={{ width: 2.5, height: h, background: C.ink, borderRadius: 2 }} />)}
                  </span>
                  Talk (text + video)
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* LAYERS */}
      <div id="layers" className="legacy-section-wrap" style={wrap}>
        <div style={eyebrow}>The six layers of who he was</div>
        <h2 style={{ ...h2, fontSize: 36, lineHeight: 1.06, margin: "12px 0 0" }}>A life read like sediment</h2>
        <p style={{ fontSize: 15, color: C.ink2, lineHeight: 1.55, maxWidth: 600, margin: "12px 0 0" }}>From the plain facts at bedrock up to the warmth at the surface. Each layer is filled in story by story — choose one to see what’s been preserved.</p>
        <div className="legacy-grid-sidebar-right" style={{ display: "grid", gridTemplateColumns: "1fr 384px", gap: 30, marginTop: 36, alignItems: "start" }}>
          <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 5, overflow: "hidden", boxShadow: "0 14px 36px rgba(43,36,28,.07)" }}>
            {D.layers.map((l, i) => (
              <div key={l.name} onClick={() => setLayer(i)} style={{ position: "relative", display: "flex", alignItems: "center", gap: 20, padding: "19px 24px 19px 26px", borderBottom: `1px solid ${C.line}`, cursor: "pointer" }}>
                <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: accent, opacity: i === layer ? 1 : 0 }} />
                <div style={{ fontFamily: serif, fontSize: 22, width: 30, color: i === layer ? accent : C.ink3 }}>{"0" + (i + 1)}</div>
                <div style={{ width: 11, height: 11, borderRadius: 3, flex: "none", background: l.color }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: serif, fontSize: 20, color: C.ink, lineHeight: 1.1 }}>{l.name}</div>
                  <div style={{ fontFamily: mono, fontSize: 11, color: C.ink3, marginTop: 3 }}>{l.count}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
                  <div style={{ width: 150, height: 6, borderRadius: 3, background: "rgba(43,36,28,.09)", overflow: "hidden" }}><div style={{ height: "100%", width: `${l.cov}%`, background: l.color, borderRadius: 3 }} /></div>
                  <div style={{ fontFamily: mono, fontSize: 12, color: C.ink2, width: 34, textAlign: "right" }}>{l.cov}%</div>
                </div>
              </div>
            ))}
            <div style={{ padding: "13px 26px", display: "flex", justifyContent: "space-between", fontFamily: mono, fontSize: 10.5, letterSpacing: ".12em", textTransform: "uppercase", color: C.ink3 }}><span>↑ surface — how he felt</span><span>bedrock — the facts ↓</span></div>
          </div>

          <div style={{ background: C.ink, color: C.paper, borderRadius: 5, padding: 30, boxShadow: "0 14px 36px rgba(43,36,28,.18)" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
              <div style={{ fontFamily: serif, fontSize: 54, lineHeight: 1, color: C.paper }}>{al.cov}%</div>
              <div style={{ fontSize: 12, letterSpacing: ".04em", color: "rgba(245,241,234,.6)" }}>preserved</div>
            </div>
            <div style={{ height: 1, background: "rgba(245,241,234,.16)", margin: "20px 0" }} />
            <h3 style={{ fontFamily: serif, fontWeight: 500, fontSize: 26, margin: 0, color: C.paper }}>{al.name}</h3>
            <p style={{ fontSize: 14.5, lineHeight: 1.6, color: "rgba(245,241,234,.78)", margin: "12px 0 0" }}>{al.desc}</p>
            <div style={{ fontFamily: mono, fontSize: 10.5, letterSpacing: ".16em", textTransform: "uppercase", color: "rgba(245,241,234,.5)", margin: "26px 0 12px" }}>What’s preserved</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
              {al.detail.map((d, i) => <div key={i} style={{ display: "flex", gap: 11, alignItems: "flex-start", fontSize: 14, lineHeight: 1.45, color: "rgba(245,241,234,.86)" }}><span style={{ color: accent, marginTop: 1 }}>—</span><span>{d}</span></div>)}
            </div>
          </div>
        </div>
      </div>

      {/* TIMELINE */}
      <div id="timeline" className="legacy-section-wrap" style={{ ...wrap, overflow: "hidden", boxSizing: "border-box" }}>
        <div style={eyebrow}>His life, chapter by chapter</div>
        <h2 style={{ ...h2, margin: "12px 0 34px" }}>The chapters that shaped him</h2>
        <ChapterTimelineSlider
          chapters={D.chapters}
          chapter={chapter}
          accent={accent}
          onSelect={setChapter}
        />
        <div className="legacy-grid-timeline-detail" style={{ marginTop: 34, background: C.card, border: `1px solid ${C.line}`, borderRadius: 5, padding: "32px 36px", display: "grid", gridTemplateColumns: "120px 1fr", gap: 32, alignItems: "start", boxShadow: "0 14px 36px rgba(43,36,28,.07)" }}>
          <div style={{ fontFamily: serif, fontSize: 46, lineHeight: 1, color: accent }}>{ac.year}</div>
          <div>
            <h3 style={{ fontFamily: serif, fontWeight: 500, fontSize: 25, margin: "0 0 10px", color: C.ink }}>{ac.title}</h3>
            <p style={{ fontSize: 16, lineHeight: 1.62, color: C.ink2, margin: 0, maxWidth: 680 }}>{ac.body}</p>
            <div style={{ marginTop: 18, fontFamily: mono, fontSize: 11, letterSpacing: ".08em", color: C.ink3 }}>APPEARS IN — <span style={{ color: C.umber }}>{ac.appears}</span></div>
          </div>
        </div>
      </div>

      {/* STORIES */}
      <div id="stories" className="legacy-section-wrap" style={wrap}>
        <div style={eyebrow}>The stories he kept coming back to</div>
        <h2 style={{ ...h2, margin: "12px 0 34px" }}>Anchor stories</h2>
        <div className="legacy-grid-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 26 }}>
          {D.stories.map((s) => (
            <div key={s.title} style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 5, padding: "30px 32px", boxShadow: "0 14px 36px rgba(43,36,28,.07)", display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <span style={{ fontFamily: mono, fontSize: 10.5, letterSpacing: ".16em", textTransform: "uppercase", color: s.tc, background: s.tb, padding: "5px 11px", borderRadius: 999 }}>{s.tone}</span>
                <span style={{ fontFamily: mono, fontSize: 12, color: C.ink3 }}>{s.year}</span>
              </div>
              <h3 style={{ fontFamily: serif, fontWeight: 500, fontSize: 25, lineHeight: 1.12, margin: "0 0 14px", color: C.ink }}>{s.title}</h3>
              <p style={{ fontFamily: serif, fontStyle: "italic", fontSize: 18, lineHeight: 1.5, color: C.ink, margin: "0 0 14px" }}>{s.quote}</p>
              <p style={{ fontSize: 14, lineHeight: 1.55, color: C.ink2, margin: "0 0 22px" }}>{s.body}</p>
              <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontFamily: mono, fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: C.ink3, marginRight: 2 }}>In this story</span>
                <div style={{ display: "flex" }}>{s.who.map((w, i) => <span key={i} style={{ width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: serif, fontSize: 13, color: "#fbf6ec", background: INITIAL_COLOR[w] || "#6b5235", marginLeft: i ? -6 : 0, border: `2px solid ${C.card}` }}>{w}</span>)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* GALLERY */}
      <div id="gallery" className="legacy-section-wrap" style={wrap}>
        <div style={eyebrow}>Faces, places, and letters</div>
        <h2 style={{ ...h2, margin: "12px 0 34px" }}>Photo gallery</h2>
        <GallerySection
          role={role}
          items={D.gallery || []}
          showHeader={false}
          readOnly
        />
      </div>

      {/* PEOPLE */}
      <div id="people" className="legacy-section-wrap" style={wrap}>
        <div style={eyebrow}>The people who made him</div>
        <h2 style={{ ...h2, margin: "12px 0 8px" }}>Whoever you ask about, he remembers</h2>
        <p style={{ fontSize: 15, color: C.ink2, margin: "0 0 32px" }}>The people who shaped {D.name.split(" ")[0]}&apos;s life.</p>
        <div className="legacy-grid-people" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 22 }}>
          {D.people.map((p) => (
            <div key={p.name} style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 5, padding: "26px 26px 22px", boxShadow: "0 12px 30px rgba(43,36,28,.06)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
                <div style={{ width: 54, height: 54, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: serif, fontSize: 20, color: "#fbf6ec", flex: "none", background: p.color, boxShadow: "inset 0 -8px 16px rgba(0,0,0,.18)" }}>{p.initials}</div>
                <div>
                  <div style={{ fontFamily: serif, fontSize: 21, color: C.ink, lineHeight: 1.1 }}>{p.name}</div>
                  <div style={{ fontFamily: mono, fontSize: 11, letterSpacing: ".06em", color: C.ink3, marginTop: 3 }}>{p.relation}</div>
                </div>
              </div>
              <p style={{ fontSize: 14, lineHeight: 1.5, color: C.ink2, margin: "16px 0" }}>{p.note}</p>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ fontFamily: mono, fontSize: 9.5, letterSpacing: ".1em", textTransform: "uppercase", color: C.ink3, marginRight: 4 }}>Influence</span>
                {Array.from({ length: 5 }, (_, k) => <span key={k} style={{ width: 6, height: 6, borderRadius: "50%", background: k < p.inf ? p.color : "rgba(43,36,28,.14)" }} />)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* WISDOM */}
      <div id="wisdom" style={{ background: C.ink, marginTop: 40 }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "74px 40px" }}>
          <div style={{ fontFamily: mono, fontSize: 11, letterSpacing: ".24em", textTransform: "uppercase", color: "rgba(245,241,234,.5)" }}>What he wanted you to carry forward</div>
          <h2 style={{ fontFamily: serif, fontWeight: 400, fontSize: 38, letterSpacing: "-.01em", margin: "14px 0 44px", color: C.paper }}>Earned the slow way</h2>
          <div className="legacy-grid-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "46px 60px" }}>
            {D.wisdom.map((w, i) => (
              <div key={i} style={{ position: "relative", paddingLeft: 30 }}>
                <div style={{ position: "absolute", left: 0, top: -6, fontFamily: serif, fontSize: 46, lineHeight: 1, color: C.gold }}>“</div>
                <p style={{ fontFamily: serif, fontWeight: 300, fontStyle: "italic", fontSize: 24, lineHeight: 1.42, color: C.paper, margin: 0 }}>{w.quote}</p>
                <div style={{ fontSize: 13, color: "rgba(245,241,234,.55)", marginTop: 14 }}>{w.context}</div>
              </div>
            ))}
          </div>
          <div style={{ height: 1, background: "rgba(245,241,234,.14)", margin: "54px 0 30px" }} />
          <div style={{ fontFamily: mono, fontSize: 10.5, letterSpacing: ".18em", textTransform: "uppercase", color: "rgba(245,241,234,.5)", marginBottom: 18 }}>Things he always said</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            {D.phrases.map((t, i) => <span key={i} style={{ fontFamily: serif, fontStyle: "italic", fontSize: 17, color: C.paper, border: "1px solid rgba(245,241,234,.28)", padding: "9px 18px", borderRadius: 999 }}>{t}</span>)}
          </div>
        </div>
      </div>

      {/* PRESERVATION FOOTER */}
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "66px 40px 80px" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 30 }}>
          <div>
            <div style={{ fontFamily: mono, fontSize: 11, letterSpacing: ".22em", textTransform: "uppercase", color: C.ink3 }}>How {D.name.split(" ")[0]} was preserved</div>
            <div style={{ display: "flex", gap: 46, marginTop: 24 }}>
              {D.preservation.stats.map((s) => <div key={s.label}><div style={{ fontFamily: serif, fontSize: 34, color: C.ink }}>{s.n}</div><div style={{ fontSize: 11.5, color: C.ink3 }}>{s.label}</div></div>)}
            </div>
            <div style={{ fontSize: 13, color: C.ink2, marginTop: 24 }}>{D.preservation.note}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: serif, fontSize: 22, color: C.ink }}>Legacy AI</div>
            <div style={{ fontSize: 12, color: C.ink3, marginTop: 4, maxWidth: 240 }}>A legacy, preserved — not a database, but a presence.</div>
          </div>
        </div>
      </div>

      {/* LIVE CALL */}
      {callOpen && (
        <LiveCall
          D={D}
          accent={accent}
          enableTalkingVideo={enableTalkingVideo}
          videoStatus={videoStatus}
          videoUrl={videoUrl}
          videoMsg={videoMsg}
          busy={busy}
          listening={listening}
          sttStarting={sttStarting}
          input={input}
          setInput={setInput}
          answer={busy ? "" : talkA}
          question={talkQ}
          showQ={showQ}
          selfVideoRef={selfVideoRef}
          onSend={() => send()}
          onToggleListen={toggleListen}
          onEnd={endCall}
          ask={ask}
          onPickSuggestion={(i) => send(D.suggestions[i].q)}
          callError={callError}
        />
      )}

    </div>
  );
}

/* ───────────────────────── Portrait + inline live call ──────────────────── */
function PortraitCard({
  D,
  accent,
  liveReady,
  canChat,
  portraitLive,
  portraitConnectKey,
  talkCreatorId,
  showCreateAvatar,
  onCreateAvatar,
  onStartLive,
  onTextTalk,
  onEndLive,
}: {
  D: AvatarData;
  accent: string;
  liveReady: boolean;
  canChat: boolean;
  portraitLive: boolean;
  portraitConnectKey: number;
  talkCreatorId?: string;
  showCreateAvatar?: boolean;
  onCreateAvatar?: () => void;
  onStartLive: () => void;
  onTextTalk?: () => void;
  onEndLive: () => void;
}) {
  const firstName = D.name.split(" ")[0];
  const live = useAnamLiveCall(talkCreatorId, PORTRAIT_LIVE_VIDEO_ID, portraitConnectKey);
  const videoLive = live.videoReady;
  const [portraitBroken, setPortraitBroken] = useState(false);
  const [proxyPortrait, setProxyPortrait] = useState<string | null>(null);
  const portraitSrc = portraitBroken ? null : (D.portraitSrc || proxyPortrait || null);
  const showLiveTalk = liveReady && canChat;
  const showTextTalk = !liveReady && canChat && Boolean(onTextTalk);
  const portraitHint = showCreateAvatar && !liveReady
    ? "Add a portrait"
    : liveReady
      ? `${firstName} is ready to talk`
      : canChat
        ? `${firstName} is here — ask anything`
        : undefined;

  useEffect(() => {
    setPortraitBroken(false);
    setProxyPortrait(null);
  }, [D.portraitSrc, talkCreatorId]);

  useEffect(() => {
    if (D.portraitSrc || !talkCreatorId || portraitBroken) return;
    let cancelled = false;
    let objectUrl: string | null = null;

    void (async () => {
      try {
        const headers = await authHeaders();
        const res = await fetch(
          apiUrl(`/api/avatar/portrait?creatorId=${encodeURIComponent(talkCreatorId)}`),
          { headers },
        );
        if (!res.ok || cancelled) return;
        const blob = await res.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setProxyPortrait(objectUrl);
      } catch {
        /* portrait proxy unavailable */
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [D.portraitSrc, talkCreatorId, portraitBroken]);

  const handleEnd = async () => {
    await live.hangUp()
    onEndLive()
  }

  return (
    <div id="portrait-live" style={{ background: C.card, border: `1px solid ${C.line}`, padding: 12, boxShadow: "0 22px 50px rgba(43,36,28,.14)", borderRadius: 3 }}>
      <div style={{ width: "100%", aspectRatio: "4 / 5", background: "#e4d8c2", position: "relative", overflow: "hidden" }}>
        {portraitSrc ? (
          <img
            src={portraitSrc}
            alt={`Portrait of ${D.name}`}
            onError={() => setPortraitBroken(true)}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
              opacity: portraitLive && videoLive ? 0 : 1,
              transition: "opacity 0.55s ease",
            }}
          />
        ) : !portraitLive ? (
          <PortraitPlaceholder name={D.name} hint={portraitHint} />
        ) : null}

        {portraitLive && (
          <>
            <video
              id={PORTRAIT_LIVE_VIDEO_ID}
              autoPlay
              playsInline
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
                background: "transparent",
                opacity: videoLive ? 1 : 0,
                transition: "opacity 0.55s ease",
                pointerEvents: videoLive ? "auto" : "none",
              }}
            />
            {live.phase === "connecting" && (
              <div style={{ position: "absolute", left: 10, right: 10, bottom: 10, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
                <div style={{ background: "rgba(0,0,0,.48)", color: "#fbf6ec", padding: "7px 14px", borderRadius: 999, fontFamily: sans, fontSize: 12, backdropFilter: "blur(4px)", textAlign: "center" }}>
                  {live.statusNote || `Waking ${firstName}…`}
                </div>
              </div>
            )}
            {live.phase === "error" && (
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(29,24,18,.52)", color: "#ffb4a3", padding: 16, textAlign: "center", gap: 10 }}>
                <div style={{ fontFamily: serif, fontSize: 16 }}>Couldn&apos;t connect</div>
                <div style={{ fontSize: 12, opacity: 0.9, lineHeight: 1.45 }}>{live.error}</div>
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <button onClick={() => live.retry()} style={{ border: "none", cursor: "pointer", background: accent, color: "#fbf6ec", fontFamily: sans, fontWeight: 600, fontSize: 13, padding: "8px 16px", borderRadius: 999 }}>Try again</button>
                  <button onClick={() => void handleEnd()} style={{ border: `1px solid ${C.line}`, cursor: "pointer", background: "transparent", color: "#f4ecdc", fontFamily: sans, fontWeight: 600, fontSize: 13, padding: "8px 16px", borderRadius: 999 }}>Back to photo</button>
                </div>
              </div>
            )}
            {live.phase === "live" && live.caption && (
              <div style={{ position: "absolute", left: 8, right: 8, bottom: 8 }}>
                <div style={{ background: "rgba(0,0,0,.62)", color: "#fff", padding: "8px 12px", borderRadius: 10, fontSize: 13, lineHeight: 1.45, fontFamily: serif, textAlign: "center" }}>
                  {live.caption}
                </div>
              </div>
            )}
            {live.phase === "live" && (
              <div style={{ position: "absolute", top: 10, left: 10, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#e0563f", animation: "la-pulse 2.2s ease-in-out infinite" }} />
                <span style={{ fontFamily: mono, fontSize: 9.5, letterSpacing: ".12em", textTransform: "uppercase", color: "rgba(255,255,255,.85)", background: "rgba(0,0,0,.45)", padding: "4px 8px", borderRadius: 999 }}>Live</span>
              </div>
            )}
          </>
        )}
      </div>

      <div style={{ marginTop: 11, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "2px 2px 1px" }}>
        <div style={{ fontFamily: serif, fontStyle: "italic", fontSize: 15, color: C.umber }}>{D.name}</div>
        <div style={{ fontFamily: mono, fontSize: 10.5, letterSpacing: ".08em", color: C.ink3 }}>{D.lifespan}</div>
      </div>

      {portraitLive ? (
        <LiveCallControls onEnd={handleEnd} compact />
      ) : showCreateAvatar && !liveReady && onCreateAvatar ? (
        <button
          type="button"
          onClick={onCreateAvatar}
          style={{ width: "100%", marginTop: 12, border: `1px solid ${C.line}`, cursor: "pointer", background: C.paper, color: C.ink, fontFamily: sans, fontWeight: 600, fontSize: 14, padding: "12px 16px", borderRadius: 999 }}
        >
          Set up avatar in Studio
        </button>
      ) : showLiveTalk ? (
        <button
          type="button"
          onClick={onStartLive}
          style={{ width: "100%", marginTop: 12, border: "none", cursor: "pointer", background: C.ink, color: C.paper, fontFamily: sans, fontWeight: 600, fontSize: 14, padding: "12px 16px", borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}
        >
          <span style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(255,255,255,.14)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>▶</span>
          {showCreateAvatar ? `Bring ${firstName} to life` : `Talk with ${firstName}`}
        </button>
      ) : showTextTalk ? (
        <button
          type="button"
          onClick={onTextTalk}
          style={{ width: "100%", marginTop: 12, border: "none", cursor: "pointer", background: C.ink, color: C.paper, fontFamily: sans, fontWeight: 600, fontSize: 14, padding: "12px 16px", borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}
        >
          <span style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(255,255,255,.14)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>▶</span>
          Talk with {firstName}
        </button>
      ) : null}
    </div>
  );
}

/* ───────────────────────── Live video-call experience ───────────────────── */
type LiveCallProps = {
  D: AvatarData;
  accent: string;
  enableTalkingVideo: boolean;
  videoStatus: VideoStatus;
  videoUrl: string | null;
  videoMsg: string;
  busy: boolean;
  listening: boolean;
  sttStarting: boolean;
  input: string;
  setInput: (v: string) => void;
  answer: string;
  question: string;
  showQ: boolean;
  selfVideoRef: React.RefObject<HTMLVideoElement | null>;
  onSend: () => void;
  onToggleListen: () => void;
  onEnd: () => void;
  ask: number;
  onPickSuggestion: (i: number) => void;
  callError: string | null;
};

function LiveCall({
  D, accent, enableTalkingVideo, videoStatus, videoUrl, videoMsg, busy, listening, sttStarting,
  input, setInput, answer, question, showQ, selfVideoRef, onSend, onToggleListen, onEnd, onPickSuggestion, callError,
}: LiveCallProps) {
  const [elapsed, setElapsed] = useState(0);
  const [showType, setShowType] = useState(false);
  const firstName = D.name.split(" ")[0];

  useEffect(() => {
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const speaking = videoStatus === "ready" || videoStatus === "rendering";
  const statusLabel = sttStarting
    ? "Opening mic…"
    : listening
    ? (input.trim() ? "Hearing you… tap Send when done" : "Mic ready — start speaking")
    : busy
      ? "Thinking…"
      : videoStatus === "rendering"
        ? (videoMsg || "Speaking…")
        : videoStatus === "ready"
          ? "Speaking"
          : "Connected";

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 80, background: "radial-gradient(900px 600px at 50% -10%, #2a231b, #141009 70%)", display: "flex", flexDirection: "column", fontFamily: sans }}>
      {/* top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#e0563f", boxShadow: "0 0 0 0 rgba(224,86,63,.6)", animation: "la-pulse 2.2s ease-in-out infinite" }} />
          <div style={{ color: "#fbf6ec", fontFamily: serif, fontSize: 18 }}>{D.name}</div>
          <div style={{ fontFamily: mono, fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: "rgba(245,241,234,.55)" }}>· live · {mm}:{ss}</div>
        </div>
        <div style={{ fontFamily: mono, fontSize: 10.5, letterSpacing: ".14em", textTransform: "uppercase", color: "rgba(245,241,234,.6)" }}>{statusLabel}</div>
      </div>

      {/* stage */}
      <div style={{ flex: 1, position: "relative", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        <div style={{ position: "relative", width: "min(70vh, 92vw)", aspectRatio: "1 / 1", borderRadius: 22, overflow: "hidden", background: "#1d1812", boxShadow: "0 30px 80px rgba(0,0,0,.5)", border: "1px solid rgba(245,241,234,.08)" }}>
          {enableTalkingVideo && videoStatus === "ready" && videoUrl ? (
            <video key={videoUrl} src={videoUrl} autoPlay playsInline style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          ) : D.portraitSrc ? (
            <img src={D.portraitSrc} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", filter: speaking ? "none" : "saturate(.9) brightness(.92)" }} />
          ) : (
            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: serif, fontSize: 120, color: "#fbf6ec", background: C.umber }}>{D.initial}</div>
          )}

          {/* speaking / thinking overlay */}
          {(busy || videoStatus === "rendering" || listening) && (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 22, background: "linear-gradient(to top, rgba(20,16,9,.7), transparent 50%)" }}>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 26 }}>
                {[0, 1, 2, 3, 4].map((i) => (
                  <span key={i} style={{ width: 4, background: listening ? "#8fb573" : "#fbf6ec", borderRadius: 2, height: 8, animation: `la-eq 0.9s ease-in-out ${i * 0.12}s infinite alternate` }} />
                ))}
              </div>
            </div>
          )}

          {!enableTalkingVideo && (
            <div style={{ position: "absolute", top: 14, left: 14, fontFamily: mono, fontSize: 9.5, letterSpacing: ".12em", textTransform: "uppercase", color: "rgba(245,241,234,.7)", background: "rgba(20,16,9,.5)", padding: "5px 10px", borderRadius: 999 }}>text only · finish avatar setup for voice</div>
          )}
        </div>

        {/* self view */}
        <div style={{ position: "absolute", right: 22, bottom: 22, width: 150, aspectRatio: "4 / 3", borderRadius: 12, overflow: "hidden", background: "#0d0a06", border: "1px solid rgba(245,241,234,.14)", boxShadow: "0 12px 30px rgba(0,0,0,.4)" }}>
          <video ref={selfVideoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }} />
          <div style={{ position: "absolute", bottom: 5, left: 8, fontFamily: mono, fontSize: 9, letterSpacing: ".1em", textTransform: "uppercase", color: "rgba(245,241,234,.75)" }}>You</div>
        </div>

        {/* caption */}
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 22, display: "flex", justifyContent: "center", padding: "0 24px", pointerEvents: "none" }}>
          <div style={{ maxWidth: 680, textAlign: "center" }}>
            {listening && input.trim() && (
              <div style={{ display: "inline-block", background: "rgba(143,181,115,.2)", color: "#e8f4dc", fontFamily: sans, fontSize: 16, lineHeight: 1.45, padding: "12px 18px", borderRadius: 14, border: "1px solid rgba(143,181,115,.35)", marginBottom: answer ? 10 : 0 }}>{input}</div>
            )}
            {showQ && question && !listening && <div style={{ fontFamily: mono, fontSize: 11, letterSpacing: ".06em", color: "rgba(245,241,234,.55)", marginBottom: 8 }}>you asked · “{question}”</div>}
            {answer && (
              <div style={{ display: "inline-block", background: "rgba(20,16,9,.66)", backdropFilter: "blur(6px)", color: "#fbf6ec", fontFamily: serif, fontSize: 20, lineHeight: 1.5, padding: "14px 20px", borderRadius: 14, border: "1px solid rgba(245,241,234,.1)" }}>{answer}</div>
            )}
          </div>
        </div>
      </div>

      {/* type panel */}
      {showType && (
        <div style={{ padding: "0 24px 6px", display: "flex", justifyContent: "center" }}>
          <form onSubmit={(e) => { e.preventDefault(); onSend(); setShowType(false); }} style={{ width: "min(680px, 92vw)", display: "flex", alignItems: "center", gap: 10, background: "rgba(245,241,234,.1)", border: "1px solid rgba(245,241,234,.2)", borderRadius: 999, padding: "6px 6px 6px 18px" }}>
            <input autoFocus value={input} onChange={(e) => setInput(e.target.value)} placeholder={`Ask ${firstName} anything…`} style={{ flex: 1, border: "none", background: "transparent", outline: "none", fontFamily: sans, fontSize: 15, color: "#fbf6ec" }} />
            <button type="submit" style={{ border: "none", cursor: "pointer", background: accent, color: "#fbf6ec", width: 38, height: 38, borderRadius: "50%", fontSize: 17 }}>→</button>
          </form>
        </div>
      )}

      {/* mic / permission error */}
      {callError && (
        <div style={{ display: "flex", justifyContent: "center", padding: "0 24px 8px" }}>
          <div style={{ maxWidth: 560, textAlign: "center", fontFamily: sans, fontSize: 13, color: "#f4c7bd", background: "rgba(216,65,44,.16)", border: "1px solid rgba(216,65,44,.4)", borderRadius: 10, padding: "9px 14px" }}>{callError}</div>
        </div>
      )}

      {/* suggestion chips */}
      {!showType && (
        <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", padding: "0 24px 10px", maxWidth: 820, margin: "0 auto" }}>
          {D.suggestions.slice(0, 3).map((s, i) => (
            <button key={i} onClick={() => onPickSuggestion(i)} disabled={busy} style={{ cursor: busy ? "default" : "pointer", background: "rgba(245,241,234,.08)", border: "1px solid rgba(245,241,234,.18)", color: "rgba(245,241,234,.85)", fontFamily: sans, fontSize: 12.5, padding: "8px 14px", borderRadius: 999 }}>{s.q}</button>
          ))}
        </div>
      )}

      {/* call controls */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 18, padding: "14px 24px 30px" }}>
        <CallBtn
          label={sttStarting ? "…" : listening ? "Send" : "Speak"}
          active={listening || sttStarting}
          activeColor="#5f8f43"
          onClick={onToggleListen}
          glyph={sttStarting ? "…" : listening ? "⏹" : "🎙"}
        />
        <button onClick={onEnd} title="End call" style={{ cursor: "pointer", border: "none", background: "#d8412c", color: "#fff", width: 66, height: 66, borderRadius: "50%", fontSize: 26, boxShadow: "0 12px 30px rgba(216,65,44,.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        <CallBtn
          label="Type"
          active={showType}
          activeColor={accent}
          onClick={() => setShowType((v) => !v)}
          glyph="⌨"
        />
      </div>

      <style>{`@keyframes la-eq { from { height: 6px; opacity:.7 } to { height: 26px; opacity:1 } }`}</style>
    </div>
  );
}

function CallBtn({ label, active, activeColor, onClick, glyph }: { label: string; active: boolean; activeColor: string; onClick: () => void; glyph: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7 }}>
      <button onClick={onClick} style={{ cursor: "pointer", border: "1px solid rgba(245,241,234,.2)", background: active ? activeColor : "rgba(245,241,234,.1)", color: "#fbf6ec", width: 56, height: 56, borderRadius: "50%", fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center" }}>{glyph}</button>
      <span style={{ fontFamily: mono, fontSize: 9.5, letterSpacing: ".1em", textTransform: "uppercase", color: "rgba(245,241,234,.6)" }}>{label}</span>
    </div>
  );
}

function Mark({ size = 26, border, color, font = 15 }: { size?: number; border: string; color: string; font?: number }) {
  return <div style={{ width: size, height: size, borderRadius: "50%", border: `1px solid ${border}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: serif, fontSize: font, color }}>H</div>;
}
