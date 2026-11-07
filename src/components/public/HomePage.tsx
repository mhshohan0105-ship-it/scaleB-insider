"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import Link from "next/link";
import { TRIAL_DAYS } from "@/lib/subscription";
import type { PublicPlan } from "@/server/services/subscription/subscriptionService";
import type { PublicContact } from "./PublicFrame";
import { FlightGlobe } from "./home/FlightGlobe";
import s from "./home/home.module.css";

const WORDS = ["air tickets", "visas", "Hajj & Umrah", "tours", "refunds"];

const FEATURES = [
  {
    code: "INV",
    tag: "Invoices",
    title: "Every service, one invoice",
    text: "Air tickets with commission and AIT worked out, visas, tours, Hajj, Umrah and more, printed with your logo and a QR check.",
  },
  {
    code: "RFD",
    tag: "Refunds",
    title: "Reissue and refund in steps",
    text: "Airline and agency charges taken off, and the client, the vendor and your profit put right on their own.",
  },
  {
    code: "ACC",
    tag: "Accounts",
    title: "Books that always balance",
    text: "Every sale, receipt, payment and expense posted by double entry. Dues and cash agree, every day.",
  },
  {
    code: "RPT",
    tag: "Reports",
    title: "Over 40 ready reports",
    text: "Sales, profit, dues, ledgers, airline and salesman reports, trial balance and balance sheet, exported in a click.",
  },
  {
    code: "TEAM",
    tag: "Your team",
    title: "Roles you decide",
    text: "Each staff member sees and does only what their role allows. Every change is recorded with who made it.",
  },
  {
    code: "SAFE",
    tag: "Your data",
    title: "Kept apart, backed up nightly",
    text: "Each agency's data is separate, encrypted backups run every night, and you can export everything any time.",
  },
];

const STEPS = [
  ["Quote", "Send a quotation and turn it into an invoice in one click."],
  ["Invoice", "Tickets, visas or packages, with profit shown before you save."],
  ["Receive", "Take cash, bank or bKash; dues update at once."],
  ["Pay vendor", "Pay airlines and suppliers against what you owe."],
  ["Report", "Profit, dues and cash, ready when you are."],
] as const;

const FAQ = [
  [
    "Do I need a card to start the trial?",
    `No. Sign up with your mobile number and use everything for ${TRIAL_DAYS} days.`,
  ],
  [
    "What happens when the trial ends?",
    "Nothing is deleted. You can still see and export everything; adding new records starts again once you choose a plan.",
  ],
  [
    "How do I pay?",
    "By bKash, bank transfer or cash. Your account is renewed as soon as the payment is received, with a receipt.",
  ],
  [
    "Can I bring my old balances?",
    "Yes. Clients, vendors, agents and accounts take an opening balance, so you start with the dues you already have.",
  ],
] as const;

const CLASSES = ["Economy", "Business", "First class"];

/** "15000.00" -> "15,000" (Bangladeshi grouping), without turning money into a float. */
function taka(amount: string): string {
  const whole = amount.split(".")[0] ?? "0";
  if (whole.length <= 3) return whole;
  const last3 = whole.slice(-3);
  const rest = whole.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `${rest},${last3}`;
}

const hasPrice = (amount: string) => /[1-9]/.test(amount.split(".")[0] ?? "");

/** Adds the "shown" class to [data-reveal] elements as they scroll into view. */
function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>("[data-reveal]");
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          if (e.isIntersecting) {
            e.target.classList.add(s.shown!);
            io.unobserve(e.target);
          }
      },
      { threshold: 0.15 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

/** Counts up to `to` once visible. */
function Counter({ to, suffix = "" }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLElement>(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e?.isIntersecting) return;
      io.disconnect();
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / 1400);
        setN(Math.round(to * (1 - Math.pow(1 - t, 3))));
        if (t < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [to]);
  return (
    <b ref={ref} className={s.display}>
      {n}
      {suffix}
    </b>
  );
}

/** Tilts a card toward the pointer. */
function tilt(e: ReactPointerEvent<HTMLElement>) {
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width - 0.5;
  const y = (e.clientY - r.top) / r.height - 0.5;
  el.style.setProperty("--ry", `${x * 14}deg`);
  el.style.setProperty("--rx", `${-y * 14}deg`);
}

function untilt(e: ReactPointerEvent<HTMLElement>) {
  e.currentTarget.style.setProperty("--ry", "0deg");
  e.currentTarget.style.setProperty("--rx", "0deg");
}

/** The plane that flies along the journey path as the section scrolls by. */
function JourneyPath() {
  const wrap = useRef<HTMLDivElement>(null);
  const path = useRef<SVGPathElement>(null);
  const plane = useRef<SVGGElement>(null);
  const trail = useRef<SVGPathElement>(null);

  useEffect(() => {
    const p = path.current;
    if (!p || !wrap.current) return;
    const len = p.getTotalLength();
    let raf = 0;
    const update = () => {
      raf = 0;
      const r = wrap.current!.getBoundingClientRect();
      const vh = window.innerHeight;
      const t = Math.min(1, Math.max(0, (vh - r.top) / (vh * 0.6 + r.height)));
      const at = p.getPointAtLength(t * len);
      const ahead = p.getPointAtLength(Math.min(len, t * len + 1));
      const angle = (Math.atan2(ahead.y - at.y, ahead.x - at.x) * 180) / Math.PI;
      plane.current?.setAttribute("transform", `translate(${at.x} ${at.y}) rotate(${angle})`);
      if (trail.current) trail.current.style.strokeDashoffset = String(len * (1 - t));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    if (trail.current) trail.current.style.strokeDasharray = String(len);
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  const d = "M20 90 C 160 10, 260 150, 400 70 S 640 20, 760 80 S 1000 140, 1160 40";
  return (
    <div ref={wrap} className={s.journey} aria-hidden>
      <svg className={s.journeySvg} viewBox="0 0 1180 160">
        <path
          ref={path}
          d={d}
          fill="none"
          stroke="rgba(159,212,198,0.25)"
          strokeWidth="2"
          strokeDasharray="2 10"
          strokeLinecap="round"
        />
        <path
          ref={trail}
          d={d}
          fill="none"
          stroke="#f2ad2e"
          strokeWidth="3"
          strokeLinecap="round"
        />
        {[20, 400, 760, 1160].map((x, i) => (
          <circle
            key={x}
            cx={x}
            cy={[90, 70, 80, 40][i]}
            r="6"
            fill="#0a2924"
            stroke="#f2ad2e"
            strokeWidth="2"
          />
        ))}
        <g ref={plane}>
          <path d="M14 0 L-10 -9 L-5 0 L-10 9 Z" fill="#ffffff" />
        </g>
      </svg>
    </div>
  );
}

export function HomePage({
  plans,
  contact,
}: {
  plans: PublicPlan[];
  contact: PublicContact | null;
}) {
  const [word, setWord] = useState(0);
  const [yearly, setYearly] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  useReveal();

  useEffect(() => {
    const id = setInterval(() => setWord((w) => (w + 1) % WORDS.length), 2200);
    return () => clearInterval(id);
  }, []);

  // The floating cards lean toward the pointer.
  useEffect(() => {
    const el = stage.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const move = (e: PointerEvent) => {
      el.style.setProperty("--mx", String(e.clientX / window.innerWidth - 0.5));
      el.style.setProperty("--my", String(e.clientY / window.innerHeight - 0.5));
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, []);

  const phone = contact?.phone?.replace(/\D/g, "") ?? "";
  const whatsapp = phone ? `https://wa.me/${phone.startsWith("0") ? `88${phone}` : phone}` : null;
  const anyYearly = plans.some((p) => hasPrice(p.priceYearly));

  return (
    <div className={s.page}>
      <header className={s.nav}>
        <div className={s.navIn}>
          <Link href="/" aria-label="ScaleB Insider home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/scaleb-insider-dark.svg" alt="ScaleB Insider" />
          </Link>
          <nav className={s.navLinks}>
            <a href="#features">Features</a>
            <a href="#journey">How it works</a>
            <a href="#plans">Plans</a>
            <a href="#faq">Questions</a>
          </nav>
          <Link href="/login" className={`${s.btn} ${s.btnGhost} ${s.btnSm} ${s.hideSm}`}>
            Sign in
          </Link>
          <Link href="/signup" className={`${s.btn} ${s.btnGold} ${s.btnSm}`}>
            Free trial
          </Link>
        </div>
      </header>

      <section style={{ position: "relative" }}>
        <div className={s.sky} />
        <div className={s.stars} />
        <div className={s.hero}>
          <div>
            <span className={s.kicker}>
              <i /> Travel agency software · Bangladesh
            </span>
            <h1 className={`${s.h1} ${s.display}`}>
              One set of books for{" "}
              <span className={s.rotator}>
                <span key={word} className={s.rotWord}>
                  {WORDS[word]}
                </span>
              </span>
            </h1>
            <p className={s.lead}>
              Sell, receive, pay and report from one place. ScaleB Insider keeps every ticket, visa
              and package posted to accounts that always balance.
            </p>
            <div className={s.ctas}>
              <Link href="/signup" className={`${s.btn} ${s.btnGold}`}>
                Start {TRIAL_DAYS} day free trial →
              </Link>
              <a href="#journey" className={`${s.btn} ${s.btnGhost}`}>
                See how it works
              </a>
            </div>
            <div className={s.stats}>
              <div className={s.stat}>
                <Counter to={TRIAL_DAYS} />
                <span>days free</span>
              </div>
              <div className={s.stat}>
                <Counter to={40} suffix="+" />
                <span>ready reports</span>
              </div>
              <div className={s.stat}>
                <Counter to={9} />
                <span>invoice types</span>
              </div>
            </div>
          </div>

          <div ref={stage} className={s.stage}>
            <FlightGlobe className={s.globe} />
            <div className={`${s.float} ${s.fTicket}`}>
              <div className={s.floatInner}>
                <div className={s.fLabel}>Air ticket · AIT-2026-00418</div>
                <div className={s.fRoute}>
                  DAC
                  <svg viewBox="0 0 80 12" height="12">
                    <path d="M2 6 H72" stroke="#0f6b5c" strokeWidth="1.5" strokeDasharray="3 3" />
                    <path d="M78 6 L68 1 L70 6 L68 11Z" fill="#f2ad2e" />
                  </svg>
                  DXB
                </div>
                <div className={s.fRow}>
                  <span>Profit</span>
                  <b style={{ color: "#067647" }}>৳ 2,150</b>
                </div>
              </div>
            </div>
            <div className={`${s.float} ${s.fProfit}`}>
              <div className={s.floatInner} style={{ animationDelay: "-2s" }}>
                <div className={s.fLabel}>This month</div>
                <div className={s.fBig}>৳ 4,85,600</div>
                <div className={s.bars}>
                  {[40, 62, 48, 78, 66, 92].map((hgt, i) => (
                    <span key={i} style={{ height: `${hgt}%`, animationDelay: `${i * 0.12}s` }} />
                  ))}
                </div>
              </div>
            </div>
            <div className={`${s.float} ${s.fVisa}`}>
              <div className={s.floatInner} style={{ animationDelay: "-4s" }}>
                <div className={s.fLabel}>Visa · Thailand</div>
                <div className={s.stamp}>APPROVED</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className={s.strip} aria-hidden>
        <div className={s.stripTrack}>
          {[0, 1].map((k) =>
            [
              ["BS", "US-Bangla"],
              ["BG", "Biman"],
              ["EK", "Emirates"],
              ["SV", "Saudia"],
              ["QR", "Qatar Airways"],
              ["MH", "Malaysia Airlines"],
              ["SQ", "Singapore Airlines"],
              ["TK", "Turkish Airlines"],
              ["2A", "Air Astra"],
            ].map(([c, n]) => (
              <span key={`${k}${c}`}>
                <b>{c}</b>
                {n}
              </span>
            )),
          )}
        </div>
      </div>

      <section id="features" className={s.section}>
        <div data-reveal className={s.reveal}>
          <div className={s.eyebrow}>Boarding now</div>
          <h2 className={`${s.h2} ${s.display}`}>Everything your counter does in a day</h2>
          <p className={s.sub}>
            From the first quote to the vendor payment, without spreadsheets or lost dues.
          </p>
        </div>
        <div className={s.passes}>
          {FEATURES.map((f, i) => (
            <article
              key={f.code}
              data-reveal
              className={`${s.pass} ${s.reveal}`}
              style={{ transitionDelay: `${(i % 3) * 0.08}s` }}
              onPointerMove={tilt}
              onPointerLeave={untilt}
            >
              <div className={s.passTop}>
                <span>{f.tag}</span>
                <span className={s.passCode}>{f.code}</span>
              </div>
              <div className={s.perf} />
              <div className={s.passBody}>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="journey" className={s.section} style={{ paddingTop: 40 }}>
        <div data-reveal className={s.reveal}>
          <div className={s.eyebrow}>Your route</div>
          <h2 className={`${s.h2} ${s.display}`}>From quote to report, one flight path</h2>
        </div>
        <JourneyPath />
        <div className={s.steps}>
          {STEPS.map(([t, d], i) => (
            <div
              key={t}
              data-reveal
              className={`${s.step} ${s.reveal}`}
              style={{ transitionDelay: `${i * 0.08}s` }}
            >
              <span className={s.stepNo}>0{i + 1}</span>
              <b>{t}</b>
              <span>{d}</span>
            </div>
          ))}
        </div>
      </section>

      {plans.length > 0 && (
        <section id="plans" className={s.section}>
          <div className={s.plansHead}>
            <div data-reveal className={s.reveal}>
              <div className={s.eyebrow}>Choose your class</div>
              <h2 className={`${s.h2} ${s.display}`}>Plans that grow with you</h2>
              <p className={s.sub} style={{ marginBottom: 0 }}>
                Every plan starts with a {TRIAL_DAYS} day free trial. Change plan whenever you need.
              </p>
            </div>
            {anyYearly && (
              <div className={s.toggle} role="group" aria-label="Billing period">
                <button type="button" aria-pressed={!yearly} onClick={() => setYearly(false)}>
                  Monthly
                </button>
                <button type="button" aria-pressed={yearly} onClick={() => setYearly(true)}>
                  Yearly
                </button>
              </div>
            )}
          </div>
          <div className={s.tickets}>
            {plans.map((p, i) => {
              const hot = plans.length > 2 && i === 1;
              const amount = yearly ? p.priceYearly : p.priceMonthly;
              return (
                <article
                  key={p.code}
                  data-reveal
                  className={`${s.pass} ${s.reveal} ${hot ? s.ticketHot : ""}`}
                  style={{ transitionDelay: `${i * 0.1}s` }}
                  onPointerMove={tilt}
                  onPointerLeave={untilt}
                >
                  {hot && <span className={s.badge}>Most popular</span>}
                  <div className={s.passTop}>
                    <span>{CLASSES[i] ?? "Class"}</span>
                    <span className={s.passCode}>{p.name}</span>
                  </div>
                  <div className={s.perf} />
                  <div
                    className={s.passBody}
                    style={{ display: "flex", flexDirection: "column", flex: 1 }}
                  >
                    <div className={s.price}>
                      {hasPrice(amount) ? (
                        <>
                          ৳{taka(amount)} <small>/ {yearly ? "year" : "month"}</small>
                        </>
                      ) : (
                        <small style={{ fontSize: 24 }}>Price on request</small>
                      )}
                    </div>
                    <ul className={s.perks}>
                      <li>{p.maxUsers ? `Up to ${p.maxUsers} users` : "Unlimited users"}</li>
                      <li>{p.modules.length ? `${p.modules.length} modules` : "Every module"}</li>
                      <li>Invoices, refunds and accounts</li>
                      <li>All reports with export</li>
                      <li>Nightly encrypted backup</li>
                    </ul>
                    <Link href="/signup" className={`${s.btn} ${s.btnGold} ${s.ticketCta}`}>
                      Start free trial
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      <section id="faq" className={`${s.section} ${s.faq}`}>
        <div className={s.eyebrow}>Before you fly</div>
        <h2 className={`${s.h2} ${s.display}`}>Questions</h2>
        {FAQ.map(([q, a]) => (
          <details key={q} className={s.faqItem}>
            <summary>{q}</summary>
            <p>{a}</p>
          </details>
        ))}
      </section>

      <section className={s.final} data-reveal>
        <svg className={s.contrail} viewBox="0 0 1200 120" aria-hidden>
          <path
            d="M0 100 C 300 100, 600 20, 1200 10"
            fill="none"
            stroke="#f2ad2e"
            strokeWidth="2"
            strokeDasharray="2 10"
            strokeLinecap="round"
          />
        </svg>
        <h2 className={`${s.h2} ${s.display}`} style={{ position: "relative" }}>
          Ready for take-off?
        </h2>
        <p style={{ position: "relative" }}>
          Open your agency in two minutes. {TRIAL_DAYS} days free, no card.
        </p>
        <Link href="/signup" className={`${s.btn} ${s.btnGold}`} style={{ position: "relative" }}>
          Start free trial →
        </Link>
      </section>

      <footer className={s.footer}>
        <div className={s.footerIn}>
          <span>
            © {new Date().getFullYear()} {contact?.name ?? "ScaleB"}
            {contact?.phone && ` · ${contact.phone}`}
            {contact?.email && ` · ${contact.email}`}
          </span>
          <span>
            <Link href="/terms">Terms of Service</Link>
            <Link href="/privacy">Privacy Policy</Link>
          </span>
        </div>
      </footer>

      {whatsapp && (
        <a
          className={s.whats}
          href={whatsapp}
          target="_blank"
          rel="noreferrer"
          aria-label="Chat on WhatsApp"
        >
          <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" aria-hidden>
            <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.6.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.4.8 3.2.6a2.8 2.8 0 0 0 1.8-1.3 2.3 2.3 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3Z" />
          </svg>
        </a>
      )}
    </div>
  );
}
