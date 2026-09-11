import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "./api.js";
import { useAuth } from "./AuthContext.jsx";

// Google redirects here with ?token=... after backend/app/routers/auth.py
// completes the OAuth exchange. We store the token, fetch the profile, and
// forward to the dashboard.
export default function RootlineOAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      navigate("/login");
      return;
    }
    api
      .me(token)
      .then((user) => {
        login(token, user);
        navigate("/dashboard");
      })
      .catch(() => navigate("/login"));
  }, [searchParams, navigate, login]);

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#F7F5F0]">
      <p className="text-sm text-[#6B7280]">Signing you in…</p>
    </div>
  );
}
