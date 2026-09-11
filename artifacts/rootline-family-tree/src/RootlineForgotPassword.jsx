import { useState } from "react";
import { Link } from "react-router-dom";
import { GitBranch, Mail } from "lucide-react";
import { api } from "./api.js";
import { Field } from "./RootlineRegister.jsx";

export default function RootlineForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await api.forgotPassword(email);
      setSent(true);
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
          Reset your password
        </h1>
        <p className="text-sm text-[#6B7280] mb-7">
          Enter your email and we'll send you a link to reset it.
        </p>

        {sent ? (
          <div className="text-sm text-[#1C4B3C] bg-[#EAF2EE] border border-[#BFDDCE] rounded-lg px-4 py-3.5">
            If an account exists for <span className="font-semibold">{email}</span>, a reset
            link is on its way. Check your inbox.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="text-sm text-[#B42318] bg-[#FEF3F2] border border-[#FDA29B] rounded-lg px-3 py-2.5">
                {error}
              </div>
            )}

            <Field
              label="Email"
              icon={<Mail className="w-4 h-4 text-[#9CA3AF]" />}
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-[#1C4B3C] hover:bg-[#163D31] disabled:opacity-60 transition-colors text-white text-sm font-semibold rounded-lg py-2.5"
            >
              {submitting ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )}

        <p className="text-center text-xs text-[#6B7280] mt-6">
          <Link to="/login" className="text-[#1C4B3C] font-semibold hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
