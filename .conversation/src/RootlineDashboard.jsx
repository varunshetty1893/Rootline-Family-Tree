import { Link } from "react-router-dom";
import { Plus, Users, GitBranch as TreeIcon } from "lucide-react";
import AppHeader from "./family/AppHeader.jsx";
import { useFamily } from "./family/FamilyContext.jsx";
import { useAuth } from "./AuthContext.jsx";

export default function RootlineDashboard() {
  const { user } = useAuth();
  const { people } = useFamily();

  const generationsCount =
    people.length === 0
      ? 0
      : new Set(
          (() => {
            // quick rough estimate for the summary card; TreeView computes the real layout
            const genMap = {};
            const roots = people.filter((p) => p.parentIds.length === 0);
            const queue = roots.map((r) => ({ id: r.id, gen: 0 }));
            const visited = new Set();
            while (queue.length) {
              const { id, gen } = queue.shift();
              if (visited.has(id)) continue;
              visited.add(id);
              genMap[id] = gen;
              const kids = people.filter((p) => p.parentIds.includes(id));
              kids.forEach((k) => queue.push({ id: k.id, gen: gen + 1 }));
            }
            return Object.values(genMap);
          })()
        ).size;

  return (
    <div className="min-h-screen w-full bg-[#F7F5F0] flex flex-col">
      <AppHeader />

      <main className="flex-1 px-8 lg:px-16 py-16 max-w-4xl mx-auto w-full">
        <h1 className="text-3xl font-serif font-bold text-[#1C1F1D] mb-2">
          Welcome{user?.name ? `, ${user.name}` : ""}.
        </h1>
        <p className="text-sm text-[#6B7280] mb-10">
          {user?.email} · your family tree starts here.
        </p>

        <div className="grid sm:grid-cols-3 gap-4 mb-10">
          <div className="bg-white border border-[#E7E2D6] rounded-xl px-5 py-5">
            <p className="text-2xl font-serif font-bold text-[#1C1F1D]">{people.length}</p>
            <p className="text-xs text-[#9CA3AF] mt-1">
              {people.length === 1 ? "person" : "people"} added
            </p>
          </div>
          <div className="bg-white border border-[#E7E2D6] rounded-xl px-5 py-5">
            <p className="text-2xl font-serif font-bold text-[#1C1F1D]">{generationsCount || "—"}</p>
            <p className="text-xs text-[#9CA3AF] mt-1">generations mapped</p>
          </div>
          <div className="bg-white border border-[#E7E2D6] rounded-xl px-5 py-5">
            <p className="text-2xl font-serif font-bold text-[#1C1F1D]">
              {Math.floor(people.filter((p) => p.spouseIds.length > 0).length / 2)}
            </p>
            <p className="text-xs text-[#9CA3AF] mt-1">couples linked</p>
          </div>
        </div>

        {people.length === 0 ? (
          <div className="border border-dashed border-[#C9BEA8] rounded-xl px-8 py-14 text-center">
            <p className="text-sm text-[#6B7280] mb-1">No family members added yet.</p>
            <p className="text-xs text-[#9CA3AF] mb-6">
              Add your first person to start building the tree.
            </p>
            <Link
              to="/people/new"
              className="inline-flex items-center gap-1.5 bg-[#1C4B3C] text-white text-sm font-medium rounded-lg px-4 py-2.5 hover:bg-[#163C30] transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add the first person
            </Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            <Link
              to="/people"
              className="flex items-center gap-4 bg-white border border-[#E7E2D6] rounded-xl px-6 py-6 hover:border-[#1C4B3C]/40 transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-[#1C4B3C]/10 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5 text-[#1C4B3C]" />
              </div>
              <div>
                <p className="text-sm font-medium text-[#1C1F1D]">Manage people</p>
                <p className="text-xs text-[#9CA3AF]">View, edit, or add family members</p>
              </div>
            </Link>
            <Link
              to="/tree"
              className="flex items-center gap-4 bg-white border border-[#E7E2D6] rounded-xl px-6 py-6 hover:border-[#1C4B3C]/40 transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-[#1C4B3C]/10 flex items-center justify-center shrink-0">
                <TreeIcon className="w-5 h-5 text-[#1C4B3C]" />
              </div>
              <div>
                <p className="text-sm font-medium text-[#1C1F1D]">View the tree</p>
                <p className="text-xs text-[#9CA3AF]">See the generated family tree</p>
              </div>
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
