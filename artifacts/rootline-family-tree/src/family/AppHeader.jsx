import { Link, NavLink, useNavigate } from "react-router-dom";
import { GitBranch, LogOut } from "lucide-react";
import { useAuth } from "../AuthContext.jsx";

const navLinkClass = ({ isActive }) =>
  `text-sm font-medium transition-colors ${
    isActive ? "text-[#1C4B3C]" : "text-[#6B7280] hover:text-[#1C1F1D]"
  }`;

export default function AppHeader() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <header className="flex items-center justify-between px-8 lg:px-16 py-6 border-b border-[#E7E2D6] bg-[#F7F5F0]">
      <div className="flex items-center gap-10">
        <Link to="/dashboard" className="flex items-center gap-1.5">
          <GitBranch className="w-4 h-4 text-[#1C4B3C]" strokeWidth={2.5} />
          <span className="text-[13px] tracking-[0.2em] font-semibold text-[#1C4B3C]">
            ROOTLINE
          </span>
        </Link>
        <nav className="hidden sm:flex items-center gap-7">
          <NavLink to="/dashboard" className={navLinkClass} end>
            Overview
          </NavLink>
          <NavLink to="/people" className={navLinkClass}>
            People
          </NavLink>
          <NavLink to="/tree" className={navLinkClass}>
            Tree
          </NavLink>
        </nav>
      </div>

      <div className="flex items-center gap-5">
        <span className="hidden md:inline text-xs text-[#9CA3AF]">{user?.email}</span>
        <button
          type="button"
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-sm font-medium text-[#374151] hover:text-[#1C1F1D] transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Log out
        </button>
      </div>
    </header>
  );
}
