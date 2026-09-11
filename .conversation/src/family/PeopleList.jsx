import { Link } from "react-router-dom";
import { useState } from "react";
import { User, Plus, Pencil, Trash2, GitBranch } from "lucide-react";
import AppHeader from "./AppHeader.jsx";
import { useFamily } from "./FamilyContext.jsx";

function relationSummary(person, getPerson) {
  const parts = [];
  if (person.parentIds.length) {
    parts.push(
      `child of ${person.parentIds.map((id) => getPerson(id)?.name).filter(Boolean).join(" & ")}`
    );
  }
  if (person.spouseIds.length) {
    parts.push(
      `married to ${person.spouseIds.map((id) => getPerson(id)?.name).filter(Boolean).join(", ")}`
    );
  }
  return parts.join(" · ");
}

export default function PeopleList() {
  const { people, deletePerson, getPerson } = useFamily();
  const [confirmId, setConfirmId] = useState(null);

  return (
    <div className="min-h-screen w-full bg-[#F7F5F0] flex flex-col">
      <AppHeader />

      <main className="flex-1 px-8 lg:px-16 py-12 max-w-3xl mx-auto w-full">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-serif font-bold text-[#1C1F1D] mb-1">People</h1>
            <p className="text-sm text-[#6B7280]">
              {people.length} {people.length === 1 ? "person" : "people"} in your tree.
            </p>
          </div>
          <Link
            to="/people/new"
            className="flex items-center gap-1.5 bg-[#1C4B3C] text-white text-sm font-medium rounded-lg px-4 py-2.5 hover:bg-[#163C30] transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            Add person
          </Link>
        </div>

        {people.length === 0 ? (
          <div className="border border-dashed border-[#C9BEA8] rounded-xl px-8 py-16 text-center">
            <p className="text-sm text-[#6B7280] mb-1">No family members yet.</p>
            <p className="text-xs text-[#9CA3AF] mb-6">Start with yourself or your oldest known relative.</p>
            <Link
              to="/people/new"
              className="inline-flex items-center gap-1.5 bg-[#1C4B3C] text-white text-sm font-medium rounded-lg px-4 py-2.5 hover:bg-[#163C30] transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add the first person
            </Link>
          </div>
        ) : (
          <>
            <div className="flex justify-end mb-4">
              <Link
                to="/tree"
                className="flex items-center gap-1.5 text-sm font-medium text-[#1C4B3C] hover:underline"
              >
                <GitBranch className="w-4 h-4" />
                View generated tree
              </Link>
            </div>
            <ul className="divide-y divide-[#E7E2D6] border border-[#E7E2D6] rounded-xl overflow-hidden bg-white">
              {people.map((p) => (
                <li key={p.id} className="flex items-center gap-4 px-5 py-4">
                  <div className="w-11 h-11 rounded-full bg-[#F0EDE3] border border-[#E7E2D6] flex items-center justify-center overflow-hidden shrink-0">
                    {p.photo ? (
                      <img src={p.photo} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-5 h-5 text-[#C9BEA8]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#1C1F1D] truncate">{p.name}</p>
                    <p className="text-xs text-[#9CA3AF] truncate">
                      {p.dob ? `Born ${p.dob}` : "Birth date unknown"}
                      {relationSummary(p, getPerson) ? ` · ${relationSummary(p, getPerson)}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Link
                      to={`/people/${p.id}/edit`}
                      className="text-[#6B7280] hover:text-[#1C4B3C]"
                      title="Edit"
                    >
                      <Pencil className="w-4 h-4" />
                    </Link>
                    {confirmId === p.id ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            deletePerson(p.id);
                            setConfirmId(null);
                          }}
                          className="text-xs font-medium text-[#B3441C]"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setConfirmId(null)}
                          className="text-xs text-[#9CA3AF]"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmId(p.id)}
                        className="text-[#6B7280] hover:text-[#B3441C]"
                        title="Remove"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
    </div>
  );
}
