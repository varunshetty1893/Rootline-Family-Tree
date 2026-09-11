import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { GitBranch, Lock, Eye, EyeOff } from "lucide-react";
import { api } from "./api.js";
import { Field } from "./RootlineRegister.jsx";

export default function RootlineResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") || "";

  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!token) {
      setError("This reset link is missing its token. Request a new one.");
      return;
    }

    setSubmitting(true);
    try {
      await api.resetPassword(token, password);
      setDone(true);
      setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#F7F5F0] px-6 py-12">
      <div className="w-full max-w-sm">
        <Link to="/" className="flex items-center gap-1.5 mb-6 w-fit">
          <GitBranch className="w-3.5 h-3.5 text-[#1C4B3C]" strokeWidth={2.5} />
          <p className="text-[11px] tracking-[0.2em] font-semibold text-[#1C4B3C]">
            ROOTLINE
          </p>
        </Link>

        <h1 className="text-3xl font-serif font-bold text-[#1C1F1D] mb-1">
          Set a new password
        </h1>
        <p className="text-sm text-[#6B7280] mb-7">
          Choose a new password for your account.
        </p>

        {done ? (
          <div className="text-sm text-[#1C4B3C] bg-[#EAF2EE] border border-[#BFDDCE] rounded-lg px-4 py-3.5">
            Password updated. Taking you to sign in…
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="text-sm text-[#B42318] bg-[#FEF3F2] border border-[#FDA29B] rounded-lg px-3 py-2.5">
                {error}
              </div>
            )}

            <Field
              label="New password"
              icon={<Lock className="w-4 h-4 text-[#9CA3AF]" />}
              type={showPassword ? "text" : "password"}
              placeholder="Enter a new password (min. 8 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
              className="w-full bg-[#1C4B3C] hover:bg-[#163D31] disabled:opacity-60 transition-colors text-white text-sm font-semibold rounded-lg py-2.5"
            >
              {submitting ? "Updating…" : "Update password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
