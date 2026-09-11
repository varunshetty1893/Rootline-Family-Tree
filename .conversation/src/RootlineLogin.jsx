import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { GitBranch, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { api } from "./api.js";
import { useAuth } from "./AuthContext.jsx";
import { Field, GoogleIcon } from "./RootlineRegister.jsx";

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

export default function RootlineLogin() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const data = await api.login(form);
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
            Welcome back
          </h1>
          <p className="text-sm text-[#6B7280] mb-7">
            Log in to continue building your family's digital record.
          </p>

          {error && (
            <div className="mb-4 text-sm text-[#B42318] bg-[#FEF3F2] border border-[#FDA29B] rounded-lg px-3 py-2.5">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field
              label="Email"
              icon={<Mail className="w-4 h-4 text-[#9CA3AF]" />}
              type="email"
              placeholder="Enter your email"
              value={form.email}
              onChange={update("email")}
              required
            />

            <div>
              <Field
                label="Password"
                icon={<Lock className="w-4 h-4 text-[#9CA3AF]" />}
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={form.password}
                onChange={update("password")}
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
              <div className="flex justify-end mt-1.5">
                <Link to="/forgot-password" className="text-xs text-[#1C4B3C] font-medium hover:underline">
                  Forgot password?
                </Link>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-[#1C4B3C] hover:bg-[#163D31] disabled:opacity-60 transition-colors text-white text-sm font-semibold rounded-lg py-2.5 mt-2"
            >
              {submitting ? "Logging in…" : "Log in"}
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
            Continue with Google
          </a>

          <p className="text-center text-xs text-[#6B7280] mt-6">
            Don't have an account?{" "}
            <Link to="/register" className="text-[#1C4B3C] font-semibold hover:underline">
              Register
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
