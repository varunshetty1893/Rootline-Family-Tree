import { useNavigate } from "react-router-dom";
import { GitBranch, Users, Share2, Layers } from "lucide-react";

const NODES = [
  { cx: 120, cy: 90, r: 7, gold: false },
  { cx: 360, cy: 40, r: 9, gold: true },
  { cx: 470, cy: 130, r: 7, gold: false },
  { cx: 90, cy: 260, r: 7, gold: false },
  { cx: 210, cy: 320, r: 7, gold: false },
  { cx: 410, cy: 300, r: 7, gold: false },
  { cx: 470, cy: 380, r: 9, gold: true },
];
const CENTER = { cx: 280, cy: 195 };

const FEATURES = [
  {
    icon: Users,
    title: "Unlimited people",
    body: "Add as many family members as your tree needs — no caps, no plans that limit you.",
  },
  {
    icon: Share2,
    title: "Relationships, not diagrams",
    body: "Say how someone's related. Rootline works out the rest and draws the connections for you.",
  },
  {
    icon: Layers,
    title: "Every generation, clear",
    body: "Grandparents, cousins, branches that split and rejoin — laid out so it's easy to follow.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Add a person",
    body: "Name, date of birth, photo — fill in what you know, add more later.",
  },
  {
    n: "02",
    title: "Link them to family",
    body: "Pick an existing member and say how the new person relates to them.",
  },
  {
    n: "03",
    title: "See the tree build itself",
    body: "Rootline places every person automatically as the family grows.",
  },
];

export default function RootlineHome() {
  const navigate = useNavigate();
  const onGetStarted = () => navigate("/register");
  const onSignIn = () => navigate("/login");

  return (
    <div className="min-h-screen w-full bg-[#F7F5F0] flex flex-col">
      {/* Nav */}
      <header className="flex items-center justify-between px-8 lg:px-16 py-6">
        <div className="flex items-center gap-1.5">
          <GitBranch className="w-4 h-4 text-[#1C4B3C]" strokeWidth={2.5} />
          <span className="text-[13px] tracking-[0.2em] font-semibold text-[#1C4B3C]">
            ROOTLINE
          </span>
        </div>

        <nav className="flex items-center gap-6">
          <button
            type="button"
            onClick={onSignIn}
            className="text-sm font-medium text-[#374151] hover:text-[#1C1F1D] transition-colors"
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={onGetStarted}
            className="text-sm font-semibold text-white bg-[#1C4B3C] hover:bg-[#163D31] transition-colors rounded-lg px-4 py-2"
          >
            Get started
          </button>
        </nav>
      </header>

      {/* Hero */}
      <section className="px-8 lg:px-16 py-10 lg:py-16">
        <div className="grid lg:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
          <div>
            <h1 className="text-4xl lg:text-5xl font-serif font-bold text-[#1C1F1D] leading-[1.15] mb-5">
              Every relationship
              <br />
              recorded once.
            </h1>
            <p className="text-base text-[#6B7280] leading-relaxed mb-8 max-w-md">
              Add the people in your family and how they're related.
              Rootline builds the tree — every generation, every branch,
              easy to follow.
            </p>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={onGetStarted}
                className="text-sm font-semibold text-white bg-[#1C4B3C] hover:bg-[#163D31] transition-colors rounded-lg px-5 py-3"
              >
                Start your tree
              </button>
              <button
                type="button"
                onClick={onSignIn}
                className="text-sm font-medium text-[#1C4B3C] hover:underline"
              >
                Sign in
              </button>
            </div>
          </div>

          <div className="hidden lg:flex justify-center">
            <svg viewBox="0 0 560 420" className="w-full max-w-md" aria-hidden="true">
              {NODES.map((n, i) => (
                <line
                  key={i}
                  x1={CENTER.cx}
                  y1={CENTER.cy}
                  x2={n.cx}
                  y2={n.cy}
                  stroke="#C9BEA8"
                  strokeWidth="1.5"
                  opacity="0.8"
                />
              ))}
              {NODES.map((n, i) => (
                <circle
                  key={i}
                  cx={n.cx}
                  cy={n.cy}
                  r={n.r}
                  fill={n.gold ? "#C9A468" : "#1C4B3C"}
                  opacity="0.9"
                />
              ))}
              <circle cx={CENTER.cx} cy={CENTER.cy} r={13} fill="#1C4B3C" />
            </svg>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-8 lg:px-16 py-14 border-t border-[#E7E2D6]">
        <div className="max-w-6xl mx-auto">
          <p className="text-[11px] tracking-[0.2em] font-semibold text-[#C9A468] mb-3">
            WHAT YOU GET
          </p>
          <div className="grid md:grid-cols-3 gap-8">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <div key={title}>
                <div className="w-9 h-9 rounded-lg bg-[#1C4B3C] flex items-center justify-center mb-4">
                  <Icon className="w-4 h-4 text-[#EDEAE2]" />
                </div>
                <h3 className="text-base font-semibold text-[#1C1F1D] mb-2">{title}</h3>
                <p className="text-sm text-[#6B7280] leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="px-8 lg:px-16 py-14 bg-[#16342B]">
        <div className="max-w-6xl mx-auto">
          <p className="text-[11px] tracking-[0.2em] font-semibold text-[#C9A468] mb-3">
            HOW IT WORKS
          </p>
          <div className="grid md:grid-cols-3 gap-8">
            {STEPS.map(({ n, title, body }) => (
              <div key={n}>
                <p className="text-sm font-serif text-[#C9A468] mb-2">{n}</p>
                <h3 className="text-base font-semibold text-white mb-2">{title}</h3>
                <p className="text-sm text-[#9BB0A6] leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA strip */}
      <section className="px-8 lg:px-16 py-14">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <h2 className="text-2xl font-serif font-semibold text-[#1C1F1D]">
            Start recording your family's story.
          </h2>
          <button
            type="button"
            onClick={onGetStarted}
            className="text-sm font-semibold text-white bg-[#1C4B3C] hover:bg-[#163D31] transition-colors rounded-lg px-5 py-3 w-fit"
          >
            Create your tree
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-8 lg:px-16 py-12 border-t border-[#E7E2D6]">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-4 gap-10 mb-10">
            <div>
              <div className="flex items-center gap-1.5 mb-3">
                <GitBranch className="w-3.5 h-3.5 text-[#1C4B3C]" strokeWidth={2.5} />
                <span className="text-[11px] tracking-[0.2em] font-semibold text-[#1C4B3C]">
                  ROOTLINE
                </span>
              </div>
              <p className="text-xs text-[#9CA3AF] leading-relaxed max-w-[220px]">
                A clear, generated record of how your family fits together.
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold text-[#374151] mb-3">Product</p>
              <ul className="space-y-2 text-xs text-[#6B7280]">
                <li>
                  <button type="button" onClick={onGetStarted} className="hover:text-[#1C1F1D]">
                    Get started
                  </button>
                </li>
                <li>
                  <button type="button" onClick={onSignIn} className="hover:text-[#1C1F1D]">
                    Sign in
                  </button>
                </li>
              </ul>
            </div>

            <div>
              <p className="text-xs font-semibold text-[#374151] mb-3">Company</p>
              <ul className="space-y-2 text-xs text-[#6B7280]">
                <li><a href="#" className="hover:text-[#1C1F1D]">About</a></li>
                <li><a href="#" className="hover:text-[#1C1F1D]">Contact</a></li>
              </ul>
            </div>

            <div>
              <p className="text-xs font-semibold text-[#374151] mb-3">Legal</p>
              <ul className="space-y-2 text-xs text-[#6B7280]">
                <li><a href="#" className="hover:text-[#1C1F1D]">Terms of Service</a></li>
                <li><a href="#" className="hover:text-[#1C1F1D]">Privacy Policy</a></li>
              </ul>
            </div>
          </div>

          <div className="pt-6 border-t border-[#E7E2D6] flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
            <p className="text-xs text-[#9CA3AF]">© {new Date().getFullYear()} Rootline. All rights reserved.</p>
            <p className="text-xs text-[#9CA3AF] max-w-md">
              This record is a generated aid for organizing family information — it does
              not independently constitute legal proof of relationship, ownership, or
              inheritance.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
