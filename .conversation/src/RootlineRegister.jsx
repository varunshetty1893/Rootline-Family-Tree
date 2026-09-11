import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { GitBranch, User, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { api } from "./api.js";
import { useAuth } from "./AuthContext.jsx";

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

export default function RootlineRegister() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const data = await api.register(form);
      login(data.access_token, data.user);
      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-[#F7F5F0]">
      {/* Left — form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <Link to="/" className="flex items-center gap-1.5 mb-2 w-fit">
            <GitBranch className="w-3.5 h-3.5 text-[#1C4B3C]" strokeWidth={2.5} />
            <p className="text-[11px] tracking-[0.2em] font-semibold text-[#1C4B3C]">
              ROOTLINE
            </p>
          </Link>

          <h1 className="text-3xl font-serif font-bold text-[#1C1F1D] mb-1">
            Create your account
          </h1>
          <p className="text-sm text-[#6B7280] mb-7">
            Start building your family's digital record.
          </p>

          {error && (
            <div className="mb-4 text-sm text-[#B42318] bg-[#FEF3F2] border border-[#FDA29B] rounded-lg px-3 py-2.5">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field
              label="Full name"
              icon={<User className="w-4 h-4 text-[#9CA3AF]" />}
              type="text"
              placeholder="Enter your full name"
              value={form.name}
              onChange={update("name")}
              required
            />

            <Field
              label="Email"
              icon={<Mail className="w-4 h-4 text-[#9CA3AF]" />}
              type="email"
              placeholder="Enter your email"
              value={form.email}
              onChange={update("email")}
              required
            />

            <Field
              label="Password"
              icon={<Lock className="w-4 h-4 text-[#9CA3AF]" />}
              type={showPassword ? "text" : "password"}
              placeholder="Create a password (min. 8 characters)"
              value={form.password}
              onChange={update("password")}
              minLength={8}
              required
              trailing={
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="text-[#9CA3AF] hover:text-[#6B7280]"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              }
            />

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-[#1C4B3C] hover:bg-[#163D31] disabled:opacity-60 transition-colors text-white text-sm font-semibold rounded-lg py-2.5 mt-2"
            >
              {submitting ? "Creating account…" : "Create account"}
            </button>
          </form>

          <div className="flex items-center gap-3 my-6">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="text-xs text-[#9CA3AF]">OR</span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          <a
            href={api.googleLoginUrl()}
            className="w-full flex items-center justify-center gap-2 border border-gray-200 rounded-lg py-2.5 text-sm font-medium text-[#1C1F1D] hover:bg-gray-50 transition-colors"
          >
            <GoogleIcon />
            Sign up with Google
          </a>

          <p className="text-center text-xs text-[#6B7280] mt-6">
            Already have an account?{" "}
            <Link to="/login" className="text-[#1C4B3C] font-semibold hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>

      {/* Right — brand panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#16342B] relative overflow-hidden flex-col justify-between px-14 py-14">
        <p className="text-[11px] tracking-[0.25em] font-semibold text-[#C9A468]">
          DIGITAL FAMILY TREE MANAGEMENT SYSTEM
        </p>

        <div className="relative">
          <svg viewBox="0 0 560 420" className="w-full max-w-md mx-auto" aria-hidden="true">
            {NODES.map((n, i) => (
              <line
                key={i}
                x1={CENTER.cx}
                y1={CENTER.cy}
                x2={n.cx}
                y2={n.cy}
                stroke="#5A7A6C"
                strokeWidth="1.5"
                opacity="0.6"
              />
            ))}
            {NODES.map((n, i) => (
              <circle
                key={i}
                cx={n.cx}
                cy={n.cy}
                r={n.r}
                fill={n.gold ? "#C9A468" : "#EDEAE2"}
                opacity="0.9"
              />
            ))}
            <circle cx={CENTER.cx} cy={CENTER.cy} r={13} fill="#EDEAE2" />
          </svg>
        </div>

        <div>
          <h2 className="text-2xl lg:text-3xl font-serif font-semibold text-white leading-snug mb-6">
            Every relationship recorded once,
            <br />
            every generation traceable from it.
          </h2>
          <p className="text-xs leading-relaxed text-[#9BB0A6] max-w-sm">
            This record is a generated aid for organizing family information — it does
            not independently constitute legal proof of relationship, ownership, or
            inheritance.
          </p>
        </div>
      </div>
    </div>
  );
}

export function Field({ label, icon, trailing, ...inputProps }) {
  return (
    <div>
      <label className="block text-xs font-medium text-[#374151] mb-1.5">{label}</label>
      <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2.5 focus-within:ring-2 focus-within:ring-[#1C4B3C]/20 focus-within:border-[#1C4B3C] transition-colors">
        {icon}
        <input
          {...inputProps}
          className="flex-1 text-sm outline-none placeholder:text-[#B0B7C0] bg-transparent"
        />
        {trailing}
      </div>
    </div>
  );
}

export function GoogleIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.82-.07-1.42-.22-2.05H12v3.72h6.61c-.13 1.09-.86 2.74-2.47 3.85l-.02.15 3.59 2.78.25.02c2.28-2.1 3.56-5.19 3.56-8.47z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.07 7.93-2.91l-3.78-2.93c-1.01.7-2.37 1.19-4.15 1.19-3.17 0-5.86-2.09-6.82-4.99l-.14.01-3.73 2.89-.05.13C3.24 21.3 7.29 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.18 14.36A7.16 7.16 0 0 1 4.8 12c0-.82.14-1.62.36-2.36L5.15 9.5 1.38 6.55l-.12.06A11.96 11.96 0 0 0 0 12c0 1.93.46 3.76 1.26 5.39l3.92-3.03z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c2.25 0 3.77.97 4.64 1.79l3.39-3.31C17.94 1.19 15.24 0 12 0 7.29 0 3.24 2.7 1.26 6.61l3.92 3.03C6.14 6.84 8.83 4.75 12 4.75z"
      />
    </svg>
  );
}
