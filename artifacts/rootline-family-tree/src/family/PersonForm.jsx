import { useState, useRef, useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { User, Calendar, Image as ImageIcon, X } from "lucide-react";
import AppHeader from "./AppHeader.jsx";
import { useFamily } from "./FamilyContext.jsx";

const RELATION_OPTIONS = [
  { value: "father", label: "is their father" },
  { value: "mother", label: "is their mother" },
  { value: "parent", label: "is their parent" },
  { value: "spouse", label: "is their spouse / partner" },
  { value: "child", label: "is their child" },
  { value: "sibling", label: "is their sibling" },
];

function Field({ label, icon: Icon, children }) {
  return (
    <label className="block mb-5">
      <span className="block text-xs font-medium text-[#374151] mb-1.5">{label}</span>
      <div className="relative">
        {Icon && (
          <Icon className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
        )}
        {children}
      </div>
    </label>
  );
}

const inputClass =
  "w-full rounded-lg border border-[#D9D3C3] bg-white px-3 py-2.5 text-sm text-[#1C1F1D] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#1C4B3C]/30 focus:border-[#1C4B3C]";
const inputWithIconClass = `${inputClass} pl-9`;

export default function PersonForm() {
  const navigate = useNavigate();
  const { id } = useParams(); // present when editing
  const { people, addPerson, updatePerson, getPerson } = useFamily();
  const fileInputRef = useRef(null);

  const editing = Boolean(id);
  const existing = editing ? getPerson(id) : null;

  const [form, setForm] = useState({
    name: existing?.name || "",
    dob: existing?.dob || "",
    dod: existing?.dod || "",
    gender: existing?.gender || "unspecified",
    photo: existing?.photo || "",
    notes: existing?.notes || "",
  });
  const [error, setError] = useState("");
  const [relationType, setRelationType] = useState("father");
  const [relatedToId, setRelatedToId] = useState("");
  const [familyId, setFamilyId] = useState("");
  const [familyRelationship, setFamilyRelationship] = useState("unknown");
  const [partnerStatus, setPartnerStatus] = useState("partner");

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handlePhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setForm((f) => ({ ...f, photo: reader.result }));
    reader.readAsDataURL(file);
  };

  const relatedPerson = people.find((person) => person.id === relatedToId);
  const familyLabel = (family) => {
    const partners = (family.partner_ids || [])
      .filter((partnerId) => partnerId !== relatedToId)
      .map((partnerId) => people.find((person) => person.id === partnerId)?.name)
      .filter(Boolean);
    const partnerText = partners.length ? `With ${partners.join(" & ")}` : "Without a partner";
    return family.relationship_status && family.relationship_status !== "partner"
      ? `${partnerText} · ${family.relationship_status}`
      : partnerText;
  };

  useEffect(() => {
    if (editing || !relatedPerson) return;
    const families =
      relationType === "child"
        ? relatedPerson.partnerFamilies || []
        : relationType === "sibling"
        ? relatedPerson.parentFamilies || []
        : relationType === "parent"
        ? (relatedPerson.parentFamilies || []).filter((family) => family.partner_ids.length < 2)
        : [];
    if (families.length === 1) setFamilyId(families[0].id);
    else if (relationType === "child" && families.length === 0) setFamilyId("no-partner");
    else setFamilyId("");
  }, [editing, relationType, relatedToId, people]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.name.trim()) {
      setError("Name is required.");
      return;
    }
    if (!editing && people.length > 0 && !relatedToId) {
      setError("Choose who this person is related to.");
      return;
    }
    if (!editing && relatedPerson) {
      const choices =
        relationType === "child"
          ? relatedPerson.partnerFamilies || []
          : relationType === "sibling"
          ? relatedPerson.parentFamilies || []
          : relationType === "parent" || relationType === "father" || relationType === "mother"
          ? (relatedPerson.parentFamilies || []).filter((family) => family.partner_ids.length < 2)
          : [];
      if (relationType === "sibling" && choices.length === 0) {
        setError("Add a parent family to this person before adding a sibling.");
        return;
      }
      if (choices.length > 1 && !familyId) {
        setError("Choose which family this relationship belongs to.");
        return;
      }
    }

    try {
      if (editing) {
        await updatePerson(id, form);
      } else {
        const relation =
          people.length === 0
            ? null
            : {
                type: relationType,
                toId: relatedToId,
                familyId: ["no-partner", "new-family"].includes(familyId) ? null : familyId || null,
                familyRelationship,
                partnerStatus,
                newFamily: familyId === "new-family",
              };
        await addPerson(form, relation);
      }
      navigate("/people");
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#F7F5F0] flex flex-col">
      <AppHeader />

      <main className="flex-1 px-8 lg:px-16 py-12 max-w-xl mx-auto w-full">
        <Link to="/people" className="text-xs text-[#6B7280] hover:text-[#1C1F1D] mb-4 inline-block">
          ← Back to people
        </Link>
        <h1 className="text-2xl font-serif font-bold text-[#1C1F1D] mb-1">
          {editing ? "Edit person" : "Add a family member"}
        </h1>
        <p className="text-sm text-[#6B7280] mb-8">
          {editing
            ? "Update their details below."
            : "Enter their details, then tell us how they connect to someone already in the tree."}
        </p>

        <form onSubmit={handleSubmit} className="bg-white border border-[#E7E2D6] rounded-xl p-7">
          {error && (
            <div className="mb-5 text-sm text-[#B3441C] bg-[#FBEAE1] border border-[#F0C7B3] rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {/* Photo */}
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full bg-[#F0EDE3] border border-[#E7E2D6] flex items-center justify-center overflow-hidden shrink-0">
              {form.photo ? (
                <img src={form.photo} alt="" className="w-full h-full object-cover" />
              ) : (
                <User className="w-6 h-6 text-[#C9BEA8]" />
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 text-xs font-medium text-[#1C4B3C] border border-[#1C4B3C]/30 rounded-lg px-3 py-1.5 hover:bg-[#1C4B3C]/5"
              >
                <ImageIcon className="w-3.5 h-3.5" />
                {form.photo ? "Change photo" : "Add photo"}
              </button>
              {form.photo && (
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, photo: "" }))}
                  className="flex items-center gap-1 text-xs text-[#9CA3AF] hover:text-[#B3441C]"
                >
                  <X className="w-3.5 h-3.5" />
                  Remove
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhoto}
                className="hidden"
              />
            </div>
          </div>

          <Field label="Full name" icon={User}>
            <input
              type="text"
              value={form.name}
              onChange={update("name")}
              placeholder="e.g. Meera Rao"
              className={inputWithIconClass}
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Date of birth" icon={Calendar}>
              <input
                type="date"
                value={form.dob}
                onChange={update("dob")}
                className={inputWithIconClass}
              />
            </Field>
            <Field label="Date of death (optional)" icon={Calendar}>
              <input
                type="date"
                value={form.dod}
                onChange={update("dod")}
                className={inputWithIconClass}
              />
            </Field>
          </div>

          <label className="block mb-5">
            <span className="block text-xs font-medium text-[#374151] mb-1.5">Gender</span>
            <select value={form.gender} onChange={update("gender")} className={inputClass}>
              <option value="unspecified">Prefer not to say</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
            </select>
          </label>

          <label className="block mb-6">
            <span className="block text-xs font-medium text-[#374151] mb-1.5">Notes (optional)</span>
            <textarea
              value={form.notes}
              onChange={update("notes")}
              rows={3}
              placeholder="Anything worth remembering about them"
              className={inputClass}
            />
          </label>

          {!editing && people.length > 0 && (
            <div className="border-t border-[#E7E2D6] pt-6 mb-2">
              <span className="block text-xs font-medium text-[#374151] mb-3">
                How are they related?
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-[#1C1F1D]">{form.name || "This person"}</span>
                <select
                  value={relationType}
                    onChange={(e) => {
                      setRelationType(e.target.value);
                      setFamilyId("");
                    }}
                  className="rounded-lg border border-[#D9D3C3] bg-white px-2.5 py-1.5 text-sm"
                >
                  {RELATION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <select
                  value={relatedToId}
                  onChange={(e) => setRelatedToId(e.target.value)}
                  className="rounded-lg border border-[#D9D3C3] bg-white px-2.5 py-1.5 text-sm flex-1 min-w-[140px]"
                >
                  <option value="">Select a person…</option>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              {relatedPerson && relationType !== "spouse" && (
                <div className="mt-4">
                  <span className="block text-xs font-medium text-[#374151] mb-1.5">
                    {relationType === "child" ? "Partner family" : relationType === "sibling" ? "Shared parent family" : "Parent family"}
                  </span>
                  <select
                    value={familyId}
                    onChange={(e) => setFamilyId(e.target.value)}
                    className="w-full rounded-lg border border-[#D9D3C3] bg-white px-2.5 py-1.5 text-sm"
                  >
                    {relationType === "sibling" && (relatedPerson.parentFamilies || []).length > 1 && (
                      <option value="">Choose a parent family…</option>
                    )}
                    {relationType === "child" && (relatedPerson.partnerFamilies || []).length > 1 && (
                      <option value="">Choose a partner…</option>
                    )}
                    {(relationType === "child"
                      ? relatedPerson.partnerFamilies || []
                      : relationType === "sibling"
                      ? relatedPerson.parentFamilies || []
                      : (relatedPerson.parentFamilies || []).filter((family) => family.partner_ids.length < 2)
                    ).map((family) => (
                      <option key={family.id} value={family.id}>{familyLabel(family)}</option>
                    ))}
                    {relationType === "child" && <option value="no-partner">No partner / selected person only</option>}
                    {relationType === "parent" && <option value="new-family">Create a new parent family</option>}
                  </select>
                  {relationType !== "spouse" && (
                    <>
                      <label className="block text-xs font-medium text-[#374151] mt-3 mb-1.5">Relationship type</label>
                      <select value={familyRelationship} onChange={(e) => setFamilyRelationship(e.target.value)} className="w-full rounded-lg border border-[#D9D3C3] bg-white px-2.5 py-1.5 text-sm">
                        <option value="biological">Biological</option>
                        <option value="adoptive">Adoptive</option>
                        <option value="step">Step</option>
                        <option value="unknown">Unknown</option>
                      </select>
                    </>
                  )}
                  {relationType === "spouse" && (
                    <>
                      <label className="block text-xs font-medium text-[#374151] mt-3 mb-1.5">Partner status</label>
                      <select value={partnerStatus} onChange={(e) => setPartnerStatus(e.target.value)} className="w-full rounded-lg border border-[#D9D3C3] bg-white px-2.5 py-1.5 text-sm">
                        <option value="partner">Partner</option>
                        <option value="married">Married</option>
                        <option value="separated">Separated</option>
                        <option value="divorced">Divorced / remarriage history</option>
                        <option value="unknown">Unknown</option>
                      </select>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {!editing && people.length === 0 && (
            <p className="text-xs text-[#9CA3AF] mb-2">
              This is the first person in your tree — no relationship needed yet.
            </p>
          )}

          <button
            type="submit"
            className="w-full mt-4 bg-[#1C4B3C] text-white text-sm font-medium rounded-lg py-2.5 hover:bg-[#163C30] transition-colors"
          >
            {editing ? "Save changes" : "Add to tree"}
          </button>
        </form>
      </main>
    </div>
  );
}
