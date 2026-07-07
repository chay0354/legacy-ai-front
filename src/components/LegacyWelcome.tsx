import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

/**
 * Legacy AI — Welcome (landing) page + Sign in / Sign up modal.
 *
 * Self-contained: injects its own fonts + keyframes on mount.
 * Drop into any React app:  <LegacyWelcome onSignIn={...} onSignUp={...} />
 */

type AuthMode = "signup" | "signin";

export interface SignInValues {
  email: string;
  password: string;
}

export interface SignUpValues {
  name: string;
  email: string;
  password: string;
}

export interface LegacyWelcomeProps {
  accent?: string;
  portraitSrc?: string;
  onSignIn?: (values: SignInValues) => void;
  onSignUp?: (values: SignUpValues) => void;
  authBusy?: boolean;
  authError?: string | null;
  authNotice?: string | null;
  onClearAuthFeedback?: () => void;
  /** When set, switches the auth modal to this mode (e.g. after "already exists" on sign-up). */
  authMode?: AuthMode;
  onForgotPassword?: (email: string) => void | Promise<void>;
}

const C = {
  paper: "#ece3d2",
  panel: "#f4ecdc",
  card: "#fbf6ec",
  ink: "#2b241c",
  ink2: "#6e6253",
  ink3: "#9a8d79",
  line: "#ddccb0",
  terra: "#c06a44",
  umber: "#7a5236",
  gold: "#b3902f",
  sage: "#71805c",
};

const serif = "'Newsreader', Georgia, serif";
const sans = "'Hanken Grotesk', system-ui, sans-serif";
const mono = "'Spline Sans Mono', ui-monospace, monospace";

const STEPS = [
  { num: "01", title: "A gentle conversation", body: "We sit down with your loved one and ask about their life. They simply talk — or type, if they’d rather. No forms, no homework." },
  { num: "02", title: "We preserve who they are", body: "Not just dates and places — their stories, their values, their humor, the advice only they could give, in their own voice." },
  { num: "03", title: "Your family can meet them", body: "Children and grandchildren — even those not yet born — can sit down with their avatar and ask them anything." },
];

const LAYERS = [
  { name: "Facts", note: "The places, dates and chapters a life is built on.", swatch: "#6b5235" },
  { name: "Stories", note: "The moments they return to again and again.", swatch: "#a8503a" },
  { name: "Relationships", note: "The people who shaped who they are.", swatch: "#9a6a4b" },
  { name: "Values", note: "How they see the world and what they’ll never compromise.", swatch: "#71805c" },
  { name: "Wisdom", note: "The lessons earned the slow, hard way — worth passing on.", swatch: "#b3902f" },
  { name: "Personality", note: "The humor and warmth that make them who they are.", swatch: "#c06a44" },
];

const SWATCHES = ["#6b5235", "#a8503a", "#9a6a4b", "#71805c", "#b3902f", "#c06a44"];

function useInjectedHead() {
  useEffect(() => {
    const id = "legacy-ai-head";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,300;0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,300;1,6..72,400;1,6..72,500&family=Hanken+Grotesk:wght@400;500;600;700&family=Spline+Sans+Mono:wght@400;500&display=swap";
    document.head.appendChild(link);
    const style = document.createElement("style");
    style.id = id;
    style.textContent = `
      @keyframes legacy-pop { from { opacity:0; transform:translate(-50%,-50%) scale(.96) } to { opacity:1; transform:translate(-50%,-50%) scale(1) } }
      .legacy-ai a { color:inherit }
      .legacy-ai ::selection { background:#c06a44; color:#fbf6ec }
    `;
    document.head.appendChild(style);
  }, []);
}

export default function LegacyWelcome({
  accent = C.terra,
  portraitSrc,
  onSignIn = (v) => console.log("sign in", v),
  onSignUp = (v) => console.log("sign up", v),
  authBusy = false,
  authError = null,
  authNotice = null,
  onClearAuthFeedback,
  authMode,
  onForgotPassword,
}: LegacyWelcomeProps) {
  useInjectedHead();
  const [authOpen, setAuthOpen] = useState(false);
  const [mode, setMode] = useState<AuthMode>("signup");

  useEffect(() => {
    if (authMode) {
      setMode(authMode);
      setAuthOpen(true);
    }
  }, [authMode]);

  const openSignup = () => { onClearAuthFeedback?.(); setMode("signup"); setAuthOpen(true); };
  const openSignin = () => { onClearAuthFeedback?.(); setMode("signin"); setAuthOpen(true); };

  const pill = (extra: CSSProperties): CSSProperties => ({
    cursor: "pointer", border: "none", fontFamily: sans, fontWeight: 600,
    borderRadius: 999, ...extra,
  });

  return (
    <div
      className="legacy-ai"
      style={{
        minHeight: "100vh",
        background: C.paper,
        backgroundImage:
          "radial-gradient(1100px 580px at 80% -10%, rgba(255,251,242,.7), transparent 60%), radial-gradient(900px 520px at -10% 116%, rgba(122,82,54,.07), transparent 60%)",
        fontFamily: sans,
        color: C.ink,
        WebkitFontSmoothing: "antialiased",
      }}
    >
      {/* NAV */}
      <div style={{ position: "sticky", top: 0, zIndex: 30, backdropFilter: "saturate(1.1) blur(8px)", background: "rgba(236,227,210,.82)", borderBottom: `1px solid ${C.line}` }}>
        <div className="legacy-top-nav-inner" style={{ maxWidth: 1140, margin: "0 auto", padding: "0 36px", height: 68, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <Mark size={27} border={C.umber} color={C.umber} />
            <div style={{ fontFamily: serif, fontSize: 22, color: C.ink }}>Legacy AI</div>
          </div>
          <div className="legacy-nav-links" style={{ display: "flex", alignItems: "center", gap: 30, fontSize: 14, color: C.ink2 }}>
            <a href="#how" style={{ textDecoration: "none" }}>How it works</a>
            <a href="#preserve" style={{ textDecoration: "none" }}>What we preserve</a>
            <a href="#why" style={{ textDecoration: "none" }}>The legacy</a>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <button onClick={openSignin} style={pill({ background: "transparent", color: C.ink, fontSize: 14, padding: 0 })}>Sign in</button>
            <button onClick={openSignup} style={pill({ background: C.ink, color: C.paper, fontSize: 14, padding: "11px 20px" })}>Begin a legacy</button>
          </div>
        </div>
      </div>

      {/* HERO */}
      <div className="legacy-hero-pad" style={{ maxWidth: 1140, margin: "0 auto", padding: "84px 36px 70px" }}>
        <div className="legacy-grid-hero-side" style={{ display: "grid", gridTemplateColumns: "1fr 384px", gap: 64, alignItems: "center" }}>
          <div>
            <div style={{ fontFamily: mono, fontSize: 11.5, letterSpacing: ".24em", textTransform: "uppercase", color: C.ink3, marginBottom: 22 }}>A living legacy · preserved through conversation</div>
            <h1 className="legacy-hero-title" style={{ fontFamily: serif, fontWeight: 400, fontSize: 74, lineHeight: 1.0, letterSpacing: "-.022em", margin: 0, color: C.ink, textWrap: "balance" }}>
              A legacy you can<br /><span style={{ fontStyle: "italic", color: C.umber }}>actually talk to.</span>
            </h1>
            <p className="legacy-hero-sub" style={{ fontFamily: serif, fontWeight: 300, fontSize: 24, lineHeight: 1.45, color: C.ink2, maxWidth: 560, margin: "26px 0 0" }}>
              Legacy AI interviews the people you love — their stories, their voice, the way they see the world — and preserves their legacy, so every generation that follows can sit down and truly know them.
            </p>
            <div className="legacy-hero-ctas" style={{ display: "flex", gap: 14, marginTop: 36 }}>
              <button onClick={openSignup} style={pill({ background: accent, color: "#fbf6ec", fontSize: 16, padding: "16px 30px", boxShadow: "0 12px 28px rgba(192,106,68,.30)" })}>Begin a legacy</button>
              <a href="#how" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 10, background: "transparent", border: `1px solid ${C.ink}`, color: C.ink, fontFamily: sans, fontWeight: 500, fontSize: 16, padding: "16px 26px", borderRadius: 999 }}>See how it works</a>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 30, fontSize: 13.5, color: C.ink3 }}>
              <span style={{ display: "inline-flex", alignItems: "center" }}>
                <span style={{ width: 26, height: 26, borderRadius: "50%", background: C.umber, border: `2px solid ${C.paper}` }} />
                <span style={{ width: 26, height: 26, borderRadius: "50%", background: C.sage, border: `2px solid ${C.paper}`, marginLeft: -9 }} />
                <span style={{ width: 26, height: 26, borderRadius: "50%", background: C.gold, border: `2px solid ${C.paper}`, marginLeft: -9 }} />
              </span>
              Over 12,000 lives preserved, one conversation at a time.
            </div>
          </div>

          <div style={{ position: "relative" }}>
            <div style={{ background: C.card, border: `1px solid ${C.line}`, padding: 12, boxShadow: "0 26px 56px rgba(43,36,28,.16)", borderRadius: 3, transform: "rotate(-1.5deg)" }}>
              <div style={{ width: "100%", aspectRatio: "4 / 5", background: "#e4d8c2", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                {portraitSrc
                  ? <img src={portraitSrc} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  : <span style={{ fontFamily: serif, fontStyle: "italic", fontSize: 16, color: C.ink3 }}>A face worth keeping</span>}
              </div>
              <div style={{ marginTop: 11, display: "flex", alignItems: "center", justifyContent: "space-between", padding: 2 }}>
                <div style={{ fontFamily: serif, fontStyle: "italic", fontSize: 15, color: C.umber }}>For the ones who shaped us</div>
                <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: ".06em", color: C.ink3 }}>EST. A LIFETIME</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* HOW IT WORKS */}
      <div id="how" className="legacy-section-pad" style={{ maxWidth: 1140, margin: "0 auto", padding: "64px 36px" }}>
        <Eyebrow>How it works</Eyebrow>
        <h2 className="legacy-section-h2" style={{ fontFamily: serif, fontWeight: 500, fontSize: 40, letterSpacing: "-.01em", margin: "12px 0 44px", color: C.ink }}>Three quiet steps</h2>
        <div className="legacy-grid-3col" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 26 }}>
          {STEPS.map((s) => (
            <div key={s.num} style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 8, padding: "32px 30px", boxShadow: "0 14px 34px rgba(43,36,28,.06)" }}>
              <div style={{ fontFamily: serif, fontSize: 30, color: accent }}>{s.num}</div>
              <h3 style={{ fontFamily: serif, fontWeight: 500, fontSize: 24, lineHeight: 1.15, margin: "16px 0 10px", color: C.ink }}>{s.title}</h3>
              <p style={{ fontSize: 15, lineHeight: 1.6, color: C.ink2, margin: 0 }}>{s.body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* WHAT WE PRESERVE */}
      <div id="preserve" className="legacy-section-pad" style={{ maxWidth: 1140, margin: "0 auto", padding: "64px 36px" }}>
        <div className="legacy-grid-2-1" style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 56, alignItems: "start" }}>
          <div>
            <Eyebrow>What we preserve</Eyebrow>
            <h2 className="legacy-section-h2" style={{ fontFamily: serif, fontWeight: 500, fontSize: 40, lineHeight: 1.05, letterSpacing: "-.01em", margin: "12px 0 0", color: C.ink }}>Not a database. A person.</h2>
            <p style={{ fontSize: 16, lineHeight: 1.6, color: C.ink2, margin: "18px 0 0" }}>
              A database remembers when someone was born. Legacy AI remembers <em>what kind of person they are</em> — across six layers, from the plain facts to the warmth that makes them unmistakably themselves.
            </p>
          </div>
          <div className="legacy-grid-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {LAYERS.map((l) => (
              <div key={l.name} style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 8, padding: "20px 22px", display: "flex", gap: 14, alignItems: "flex-start" }}>
                <span style={{ width: 11, height: 11, borderRadius: 3, marginTop: 5, flex: "none", background: l.swatch }} />
                <div>
                  <div style={{ fontFamily: serif, fontSize: 21, color: C.ink, lineHeight: 1.1 }}>{l.name}</div>
                  <div style={{ fontSize: 13.5, color: C.ink2, lineHeight: 1.45, marginTop: 4 }}>{l.note}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* QUOTE */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "54px 36px", textAlign: "center" }}>
        <div style={{ fontFamily: serif, fontSize: 48, color: C.gold, lineHeight: 1 }}>“</div>
        <p className="legacy-quote" style={{ fontFamily: serif, fontWeight: 300, fontStyle: "italic", fontSize: 30, lineHeight: 1.4, color: C.ink, margin: "8px 0 0", textWrap: "pretty" }}>
          My daughter asked her grandfather what he was most proud of — and he answered, in his own words and his own voice. That’s a legacy no photo album could ever hold.
        </p>
        <div style={{ fontSize: 14, color: C.ink3, marginTop: 24, fontFamily: mono, letterSpacing: ".06em" }}>CAROL B. · DAUGHTER &amp; KEEPER</div>
      </div>

      {/* CLOSING */}
      <div id="why" style={{ background: C.ink, marginTop: 30 }}>
        <div style={{ maxWidth: 1140, margin: "0 auto", padding: "80px 36px", textAlign: "center" }}>
          <div style={{ fontFamily: mono, fontSize: 11, letterSpacing: ".24em", textTransform: "uppercase", color: "rgba(245,241,234,.5)" }}>The legacy</div>
          <h2 className="legacy-closing-h2" style={{ fontFamily: serif, fontWeight: 400, fontSize: 52, lineHeight: 1.06, letterSpacing: "-.015em", margin: "16px 0 0", color: C.paper, textWrap: "balance" }}>
            Every life is a legacy.<br />Start telling it today.
          </h2>
          <p style={{ fontSize: 18, lineHeight: 1.6, color: "rgba(245,241,234,.7)", maxWidth: 520, margin: "22px auto 0" }}>
            It takes one gentle conversation to start. You’ll have something irreplaceable by the end of it.
          </p>
          <button onClick={openSignup} style={pill({ marginTop: 36, background: accent, color: "#fbf6ec", fontSize: 17, padding: "18px 38px", boxShadow: "0 14px 30px rgba(192,106,68,.34)" })}>Begin a legacy</button>
        </div>
      </div>

      {/* FOOTER */}
      <div style={{ maxWidth: 1140, margin: "0 auto", padding: "40px 36px 56px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Mark size={24} border={C.umber} color={C.umber} font={13} />
          <span style={{ fontFamily: serif, fontSize: 18, color: C.ink }}>Legacy AI</span>
          <span style={{ fontSize: 13, color: C.ink3, marginLeft: 8 }}>A legacy, preserved.</span>
        </div>
        <div style={{ display: "flex", gap: 24, fontSize: 13, color: C.ink3 }}>
          <a href="#" style={{ textDecoration: "none" }}>Privacy</a>
          <a href="#" style={{ textDecoration: "none" }}>How it works</a>
          <a href="#" style={{ textDecoration: "none" }}>Contact</a>
        </div>
      </div>

      {/* AUTH MODAL */}
      <AuthModal
        open={authOpen}
        mode={mode}
        accent={accent}
        busy={authBusy}
        error={authError}
        notice={authNotice}
        onClose={() => setAuthOpen(false)}
        onToggle={() => { onClearAuthFeedback?.(); setMode((m) => (m === "signup" ? "signin" : "signup")); }}
        onSignIn={onSignIn}
        onSignUp={onSignUp}
        onForgotPassword={onForgotPassword}
      />
    </div>
  );
}

/* ---------- Auth modal ---------- */

interface AuthModalProps {
  open: boolean;
  mode: AuthMode;
  accent: string;
  busy?: boolean;
  error?: string | null;
  notice?: string | null;
  onClose: () => void;
  onToggle: () => void;
  onSignIn: (values: SignInValues) => void;
  onSignUp: (values: SignUpValues) => void;
  onForgotPassword?: (email: string) => void | Promise<void>;
}

function AuthModal({ open, mode, accent, busy = false, error = null, notice = null, onClose, onToggle, onSignIn, onSignUp, onForgotPassword }: AuthModalProps) {
  const isSignup = mode === "signup";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const copy = isSignup
    ? {
        title: "Begin a legacy",
        sub: "Create your account and start preserving someone you love.",
        cta: "Create account",
        quote: "A legacy isn’t something you leave behind. It’s something you build — one conversation at a time.",
        switchText: "Already preserving a legacy?",
        switchLink: "Sign in",
      }
    : {
        title: "Welcome back",
        sub: "Sign in to continue your family’s story.",
        cta: "Sign in",
        quote: "Every conversation you keep is a door your family can walk through for generations.",
        switchText: "New to Legacy AI?",
        switchLink: "Begin a legacy",
      };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSignup) onSignUp({ name, email, password });
    else onSignIn({ email, password });
  };

  const labelStyle: CSSProperties = { display: "block", fontFamily: mono, fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", color: C.ink3, marginBottom: 7 };
  const inputStyle: CSSProperties = { width: "100%", boxSizing: "border-box", border: `1px solid ${C.line}`, background: C.paper, borderRadius: 9, padding: "13px 15px", fontFamily: sans, fontSize: 15, color: C.ink, outline: "none" };

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, background: "rgba(43,36,28,.46)", backdropFilter: "blur(3px)",
          zIndex: 50, transition: "opacity .3s ease",
          opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none",
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={`legacy-auth-dialog${open ? ' open' : ''}`}
        style={{
          position: "fixed", top: "50%", left: "50%", width: 760, maxWidth: "94vw", zIndex: 51,
          borderRadius: 16, overflow: "hidden", boxShadow: "0 40px 100px rgba(43,36,28,.4)",
          transition: "opacity .3s ease, transform .3s cubic-bezier(.22,.61,.36,1)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transform: `translate(-50%,-50%) scale(${open ? 1 : 0.96})`,
        }}
      >
        <div className="legacy-auth-panels" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", minHeight: 540 }}>
          {/* left panel */}
          <div className="legacy-auth-quote-panel" style={{ background: C.ink, padding: "40px 36px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
              <Mark size={27} border="rgba(245,241,234,.5)" color={C.paper} font={14} />
              <div style={{ fontFamily: serif, fontSize: 21, color: C.paper }}>Legacy AI</div>
            </div>
            <div>
              <div style={{ fontFamily: serif, fontSize: 46, color: C.gold, lineHeight: 1 }}>“</div>
              <p style={{ fontFamily: serif, fontWeight: 300, fontStyle: "italic", fontSize: 23, lineHeight: 1.45, color: C.paper, margin: "6px 0 0" }}>{copy.quote}</p>
              <div style={{ fontFamily: mono, fontSize: 10.5, letterSpacing: ".1em", color: "rgba(245,241,234,.55)", marginTop: 18 }}>A LEGACY, PRESERVED — NOT A DATABASE</div>
            </div>
            <div style={{ display: "flex", gap: 9 }}>
              {SWATCHES.map((s) => <span key={s} style={{ width: 9, height: 9, borderRadius: 2, background: s }} />)}
            </div>
          </div>

          {/* form */}
          <form onSubmit={submit} className="legacy-auth-form-panel" style={{ background: C.card, padding: "40px 38px", position: "relative", display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <button type="button" onClick={onClose} style={{ position: "absolute", top: 20, right: 22, border: "none", background: "transparent", cursor: "pointer", fontSize: 24, color: C.ink3, lineHeight: 1 }}>×</button>
            <h2 style={{ fontFamily: serif, fontWeight: 500, fontSize: 32, margin: 0, color: C.ink }}>{copy.title}</h2>
            <p style={{ fontSize: 14.5, color: C.ink2, margin: "8px 0 26px" }}>{copy.sub}</p>

            {notice && <p style={{ fontSize: 13, color: C.sage, margin: "0 0 14px" }}>{notice}</p>}
            {error && <p style={{ fontSize: 13, color: "#a8503a", margin: "0 0 14px" }}>{error}</p>}

            {isSignup && (
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Your name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Maya Bellune" style={inputStyle} />
              </div>
            )}
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@family.com" style={inputStyle} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" style={inputStyle} />
            </div>

            {!isSignup && onForgotPassword && (
              <div style={{ marginTop: -12, marginBottom: 16, textAlign: "right" }}>
                <button
                  type="button"
                  onClick={() => onForgotPassword(email.trim())}
                  style={{ cursor: "pointer", background: "transparent", border: "none", color: C.ink2, fontFamily: sans, fontSize: 13, textDecoration: "underline" }}
                >
                  Forgot password?
                </button>
              </div>
            )}

            <button type="submit" disabled={busy} style={{ textAlign: "center", background: accent, color: "#fbf6ec", border: "none", cursor: busy ? "wait" : "pointer", fontFamily: sans, fontWeight: 600, fontSize: 15, padding: 15, borderRadius: 999, boxShadow: "0 10px 24px rgba(192,106,68,.28)", opacity: busy ? 0.7 : 1 }}>{busy ? "Please wait…" : copy.cta}</button>

            <div style={{ textAlign: "center", marginTop: 24, fontSize: 14, color: C.ink2 }}>
              {copy.switchText}{" "}
              <button type="button" onClick={onToggle} style={{ cursor: "pointer", background: "transparent", border: "none", color: accent, fontFamily: sans, fontWeight: 600, fontSize: 14 }}>{copy.switchLink}</button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

/* ---------- small helpers ---------- */

function Mark({ size = 27, border, color, font = 15 }: { size?: number; border: string; color: string; font?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", border: `1px solid ${border}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: serif, fontSize: font, color }}>H</div>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return <div style={{ fontFamily: mono, fontSize: 11, letterSpacing: ".24em", textTransform: "uppercase", color: C.ink3 }}>{children}</div>;
}
