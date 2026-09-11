import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  User,
  Calendar,
  Image as ImageIcon,
  X,
  Minus,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Search,
  ChevronsDownUp,
  ChevronsUpDown,
  Plus,
  UserPlus,
  Loader2,
  Printer,
  Pencil,
  Trash2,
  LocateFixed,
  Focus,
  Check,
} from "lucide-react";
import AppHeader from "./AppHeader.jsx";
import { useFamily } from "./FamilyContext.jsx";
import { computeLayout, ancestorsOf } from "./treeLayout.js";
import { findRelationship, pathToEdgeKeySet } from "./relationship.js";

const CARD_W = 136;
const ROW_HEIGHT = 190;
const ZOOM_MIN = 0.15;
const ZOOM_MAX = 1.6;
const ZOOM_STEP = 0.15;

const RELATION_OPTIONS = [
  { value: "father", label: "is their father" },
  { value: "mother", label: "is their mother" },
  { value: "parent", label: "is their parent" },
  { value: "spouse", label: "is their spouse / partner" },
  { value: "child", label: "is their child" },
  { value: "sibling", label: "is their sibling" },
];

function familyKeysFor(person) {
  const keys = (person?.parentFamilies || [])
    .map((family) => [...(family.partner_ids || [])].sort().join("|"))
    .filter(Boolean);
  if (keys.length) return keys;
  const fallback = person?.parentIds?.length ? [...person.parentIds].sort().join("|") : "";
  return fallback ? [fallback] : [];
}

function familyKeyFor(person) {
  return familyKeysFor(person)[0] || "";
}

/* ------------------------------------------------------------------ */
/* Left panel: add-person form, always on screen, updates tree live    */
/* ------------------------------------------------------------------ */

const inputClass =
  "w-full rounded-lg border border-[#D9D3C3] bg-white px-3 py-2 text-sm text-[#1C1F1D] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#1C4B3C]/30 focus:border-[#1C4B3C]";
const inputWithIconClass = `${inputClass} pl-9`;

function Field({ label, icon: Icon, children }) {
  return (
    <label className="block mb-4">
      <span className="block text-xs font-medium text-[#374151] mb-1.5">{label}</span>
      <div className="relative">
        {Icon && <Icon className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />}
        {children}
      </div>
    </label>
  );
}

const emptyForm = { name: "", dob: "", dod: "", gender: "unspecified", photo: "", notes: "" };

function AddPersonPanel() {
  const { people, addPerson } = useFamily();
  const fileInputRef = useRef(null);

  const [form, setForm] = useState(emptyForm);
  const [relationType, setRelationType] = useState("father");
  const [relatedToId, setRelatedToId] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handlePhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setForm((f) => ({ ...f, photo: reader.result }));
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.name.trim()) {
      setError("Name is required.");
      return;
    }
    if (people.length > 0 && !relatedToId) {
      setError("Choose who this person is related to.");
      return;
    }

    setSaving(true);
    try {
      const relation = people.length === 0 ? null : { type: relationType, toId: relatedToId };
      await addPerson(form, relation);
      // Tree on the right updates via FamilyContext refresh — reset the form
      // so the panel is ready for the next person, without navigating away.
      setForm(emptyForm);
      setRelatedToId("");
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <aside className="w-full lg:w-[340px] shrink-0 border-b lg:border-b-0 lg:border-r border-[#E7E2D6] bg-[#FBFAF6]">
      <div className="lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto px-6 py-8">
        <h2 className="text-lg font-serif font-bold text-[#1C1F1D] mb-1">Add a family member</h2>
        <p className="text-xs text-[#6B7280] mb-6">
          Fill this in — the tree on the right updates as soon as you save.
        </p>

        <form onSubmit={handleSubmit}>
          {error && (
            <div className="mb-4 text-sm text-[#B3441C] bg-[#FBEAE1] border border-[#F0C7B3] rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex items-center gap-3 mb-5">
            <div className="w-12 h-12 rounded-full bg-[#F0EDE3] border border-[#E7E2D6] flex items-center justify-center overflow-hidden shrink-0">
              {form.photo ? (
                <img src={form.photo} alt="" className="w-full h-full object-cover" />
              ) : (
                <User className="w-5 h-5 text-[#C9BEA8]" />
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 text-xs font-medium text-[#1C4B3C] border border-[#1C4B3C]/30 rounded-lg px-2.5 py-1.5 hover:bg-[#1C4B3C]/5"
              >
                <ImageIcon className="w-3.5 h-3.5" />
                {form.photo ? "Change" : "Add photo"}
              </button>
              {form.photo && (
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, photo: "" }))}
                  className="flex items-center gap-1 text-xs text-[#9CA3AF] hover:text-[#B3441C]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhoto} className="hidden" />
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

          <label className="block mb-4">
            <span className="block text-xs font-medium text-[#374151] mb-1.5">Gender</span>
            <select value={form.gender} onChange={update("gender")} className={inputClass}>
              <option value="unspecified">Prefer not to say</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Date of birth" icon={Calendar}>
              <input type="date" value={form.dob} onChange={update("dob")} className={inputWithIconClass} />
            </Field>
            <Field label="Date of death" icon={Calendar}>
              <input type="date" value={form.dod} onChange={update("dod")} className={inputWithIconClass} />
            </Field>
          </div>

          {people.length > 0 ? (
            <div className="border-t border-[#E7E2D6] pt-4 mt-1 mb-2">
              <span className="block text-xs font-medium text-[#374151] mb-2">Relationship</span>
              <select
                value={relationType}
                onChange={(e) => setRelationType(e.target.value)}
                className={`${inputClass} mb-2`}
              >
                {RELATION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {form.name || "This person"} {opt.label}
                  </option>
                ))}
              </select>
              <span className="block text-xs font-medium text-[#374151] mb-1.5">Related to</span>
              <select
                value={relatedToId}
                onChange={(e) => setRelatedToId(e.target.value)}
                className={inputClass}
              >
                <option value="">Select a person…</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <p className="text-xs text-[#9CA3AF] mb-2">
              This is the first person in your tree — no relationship needed yet.
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full mt-5 bg-[#1C4B3C] text-white text-sm font-medium rounded-lg py-2.5 hover:bg-[#163C30] transition-colors disabled:opacity-60"
          >
            {saving ? "Adding…" : "Add to tree"}
          </button>
        </form>
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/* Right panel: the tree itself                                        */
/* ------------------------------------------------------------------ */

function PersonCard({
  person,
  cardRef,
  highlighted,
  onPath,
  isRoot,
  isSelected,
  onSelect,
}) {
  // Border colour communicates *why* a card is drawn attention to — gold for
  // a search match or a highlighted relationship path. This is intentionally
  // decoupled from `isSelected`: several cards can be on-path at once, so if
  // selection reused the same gold styling, the one card you actually
  // clicked was indistinguishable from the others. Selection now gets its
  // own always-visible ring + corner badge that layers on top regardless of
  // the border colour underneath, so there's never any doubt which single
  // card is selected.
  const borderClass = highlighted || onPath ? "border-[#D2A338]" : "border-[#1C4B3C]";
  const selectionRingClass = isSelected ? "ring-4 ring-[#174F61] ring-offset-2 ring-offset-white" : "";

  return (
    <div className="flex flex-col items-center text-center" style={{ width: CARD_W }}>
      {/* This inner box is what line anchors measure — fixed height regardless
          of whether the collapse pill below is present, so siblings in the
          same row always connect at the same Y position. */}
      <div
        ref={cardRef}
        data-person-id={person.id}
        onClick={() => onSelect?.(person.id)}
        className={`relative flex flex-col items-center w-[122px] min-h-[138px] mx-auto rounded-md border-[3px] bg-[#1C4B3C] px-2 py-2 text-white shadow-sm cursor-pointer transition-transform hover:-translate-y-0.5 ${borderClass} ${selectionRingClass}`}
        title="Select this person"
      >
        {isSelected && (
          <span
            title="Selected"
            className="absolute -top-2 -left-2 w-5 h-5 rounded-full bg-[#174F61] text-white flex items-center justify-center shadow ring-2 ring-white z-10"
          >
            <Check className="w-3 h-3" strokeWidth={3} />
          </span>
        )}
        <div className="relative mb-1">
          <div
            className="w-12 h-12 rounded-full bg-[#EDF4F3] border-2 border-white/70 shadow-sm flex items-center justify-center overflow-hidden"
          >
            {person.photo ? (
              <img src={person.photo} alt="" className="w-full h-full object-cover" />
            ) : (
              <User className="w-5 h-5 text-[#C9BEA8]" />
            )}
          </div>
          {isRoot && (
            <span
              title="This is you"
              className="absolute -bottom-1 -right-2 text-[9px] font-semibold bg-[#174F61] text-white rounded-full px-1.5 py-0.5 leading-none shadow-sm"
            >
              You
            </span>
          )}
        </div>
        <p className="text-[11px] font-semibold leading-tight truncate w-full">{person.name}</p>
        <p className="text-[9px] text-white/85 h-3.5 mt-0.5">
          {person.dob ? person.dob.slice(0, 4) : "Birth unknown"}
          {person.dod ? ` – ${person.dod.slice(0, 4)}` : ""}
        </p>
        <p className="text-[8px] text-white/75 leading-tight line-clamp-2 mt-1">{person.notes || "Family member"}</p>
      </div>

      {/* Branch controls are rendered at the connector junction, not under
          individual cards. That makes one family branch feel like one unit. */}
      <div className="h-6" />
    </div>
  );
}

export default function TreeView() {
  const { people, rootPersonId, setRootPersonId, addPerson, deletePerson } = useFamily();
  const containerRef = useRef(null);
  const scrollRef = useRef(null);
  const cardRefs = useRef({});
  const [lines, setLines] = useState([]);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [collapsedFamilyKeys, setCollapsedFamilyKeys] = useState(() => new Set());
  const [zoom, setZoom] = useState(1);
  const [query, setQuery] = useState("");
  const [highlightId, setHighlightId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [quickRelation, setQuickRelation] = useState(null);
  const [quickName, setQuickName] = useState("");
  const [quickGender, setQuickGender] = useState("unspecified");
  const [quickParentType, setQuickParentType] = useState("parent");
  const [quickFamilyRelationship, setQuickFamilyRelationship] = useState("unknown");
  const [quickPartnerStatus, setQuickPartnerStatus] = useState("partner");
  const [quickFamilyId, setQuickFamilyId] = useState("");
  const [quickPartnerName, setQuickPartnerName] = useState("");
  const [quickPartnerId, setQuickPartnerId] = useState("");
  const [quickPartnerMode, setQuickPartnerMode] = useState("add");
  const [quickPartnerSaving, setQuickPartnerSaving] = useState(false);
  const [quickSuccess, setQuickSuccess] = useState("");
  const [quickError, setQuickError] = useState("");
  const [quickSaving, setQuickSaving] = useState(false);
  const [inspectorTab, setInspectorTab] = useState("personal");
  const [isPanning, setIsPanning] = useState(false);
  const [collapseControls, setCollapseControls] = useState([]);
  const panState = useRef(null);

  // The canvas always represents the whole saved tree. Relationship context
  // is chosen in the add flow instead of hiding the rest of the family.
  const scopedPeople = people;

  const { rows, edges, layoutWidth } = useMemo(
    () => computeLayout(scopedPeople, collapsedFamilyKeys),
    [scopedPeople, collapsedFamilyKeys]
  );

  // "How am I related?" — recomputed whenever the selection or the root
  // ("you") changes. Cheap even for large trees: bounded by tree depth.
  const relationship = useMemo(() => {
    if (!selectedId || !rootPersonId || selectedId === rootPersonId) return null;
    return findRelationship(rootPersonId, selectedId, scopedPeople);
  }, [selectedId, rootPersonId, scopedPeople]);

  const pathIdSet = useMemo(
    () => new Set(relationship?.path || []),
    [relationship]
  );
  const pathEdgeKeys = useMemo(
    () => pathToEdgeKeySet(relationship?.path || []),
    [relationship]
  );

  const selectedPerson = selectedId ? scopedPeople.find((p) => p.id === selectedId) : null;

  useEffect(() => {
    if (scopedPeople.length && !scopedPeople.some((p) => p.id === selectedId)) {
      setSelectedId(rootPersonId && scopedPeople.some((p) => p.id === rootPersonId) ? rootPersonId : scopedPeople[0].id);
    }
  }, [scopedPeople, rootPersonId, selectedId]);

  const openQuickAdd = (relation) => {
    const person = selectedPerson;
    const parentFamilies = person?.parentFamilies || [];
    const partnerFamilies = person?.partnerFamilies || [];
    setQuickRelation(relation);
    setQuickName("");
    setQuickGender("unspecified");
    setQuickParentType("parent");
    setQuickFamilyRelationship("unknown");
    setQuickPartnerStatus("partner");
    setQuickPartnerName("");
    setQuickPartnerId("");
    setQuickPartnerMode("add");
    setQuickFamilyRelationship("unknown");
    setQuickPartnerStatus("partner");
    setQuickSuccess("");
    if (relation === "sibling") {
      setQuickFamilyId(parentFamilies.length === 1 ? parentFamilies[0].id : parentFamilies.length === 0 ? "new-family" : "");
    } else if (relation === "child") {
      setQuickFamilyId(partnerFamilies.length === 1 ? partnerFamilies[0].id : partnerFamilies.length === 0 ? "no-partner" : "");
    } else if (relation === "parent") {
      const available = parentFamilies.filter((family) => family.partner_ids.length < 2);
      setQuickFamilyId(available.length === 1 ? available[0].id : "");
    } else {
      setQuickFamilyId("");
    }
    setQuickError("");
  };

  const closeQuickAdd = () => {
    setQuickRelation(null);
    setQuickName("");
    setQuickFamilyId("");
    setQuickPartnerName("");
    setQuickPartnerId("");
    setQuickPartnerMode("add");
    setQuickSuccess("");
    setQuickError("");
  };

  const addPartnerBeforeChild = async () => {
    if (!selectedPerson || !quickPartnerName.trim()) {
      setQuickError("Enter the partner's name first.");
      return;
    }
    setQuickPartnerSaving(true);
    setQuickError("");
    try {
      const partnerId = await addPerson(
        { name: quickPartnerName.trim(), gender: "unspecified", dob: "", dod: "", photo: "", notes: "" },
        { type: "spouse", toId: selectedPerson.id }
      );
      setQuickPartnerId(partnerId);
      setQuickPartnerName("");
      setQuickSuccess("Partner added. Select that partner below, then add the child.");
    } catch (err) {
      setQuickError(err.message || "Could not add the partner.");
    } finally {
      setQuickPartnerSaving(false);
    }
  };

  const submitQuickAdd = async (e) => {
    e.preventDefault();
    if (!quickName.trim() || !selectedPerson || !quickRelation) {
      setQuickError("Enter their name to add them to the tree.");
      return;
    }
    if (quickRelation === "sibling" && !quickFamilyId) {
      setQuickError(
        selectedPerson.parentFamilies?.length
          ? "Choose which parent family this sibling shares."
          : "Add a parent family to this person before adding a sibling."
      );
      return;
    }
    if (quickRelation === "parent" && !quickFamilyId && parentFamilyOptions.length > 1) {
      setQuickError("Choose which parent family this new parent belongs to.");
      return;
    }
    if (quickRelation === "child" && !quickFamilyId) {
      setQuickError("Choose the partner or choose different partner to continue.");
      return;
    }
    if (quickRelation === "child" && quickFamilyId === "different-partner") {
      if (!quickPartnerId) {
        setQuickError("Add or select the different partner first, then add the child.");
        return;
      }
    }
    setQuickSaving(true);
    setQuickError("");
    try {
      const id = await addPerson(
        { name: quickName.trim(), gender: quickGender, dob: "", dod: "", photo: "", notes: "" },
        {
          type: quickRelation === "parent" ? quickParentType : quickRelation,
          toId: selectedPerson.id,
          familyId: ["no-partner", "new-family", "different-partner"].includes(quickFamilyId)
            ? null
            : quickFamilyId || null,
          partnerId: quickFamilyId === "different-partner" ? quickPartnerId : null,
          familyRelationship: quickFamilyRelationship,
          partnerStatus: quickPartnerStatus,
          newFamily: quickFamilyId === "new-family",
        }
      );
      if (quickRelation !== "child") setSelectedId(id);
      requestAnimationFrame(() => revealAndFocus(id));
      if (quickRelation === "child") {
        setQuickName("");
        setQuickSuccess("Child added. Add another child below, or choose Done.");
      } else {
        closeQuickAdd();
      }
    } catch (err) {
      setQuickError(err.message || "Could not add this family member. Please try again.");
    } finally {
      setQuickSaving(false);
    }
  };

  useEffect(() => {
    if (!quickPartnerId || !selectedPerson?.partnerFamilies?.length) return;
    const family = selectedPerson.partnerFamilies.find((entry) => entry.partner_ids.includes(quickPartnerId));
    if (family) setQuickFamilyId(family.id);
  }, [quickPartnerId, selectedPerson]);

  // Reveal a person hidden behind a collapsed ancestor, then scroll to them.
  const revealAndFocus = (id) => {
    const ancestors = ancestorsOf(id, people);
    setCollapsedFamilyKeys((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const ancestorId of [...ancestors, id]) {
        for (const branch of familyKeysFor(people.find((person) => person.id === ancestorId))) {
          if (next.has(branch)) {
            next.delete(branch);
            changed = true;
          }
        }
      }
      return changed ? next : prev;
    });
    requestAnimationFrame(() => {
      cardRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    });
  };

  const handleSelectPerson = (id) => {
    setSelectedId((cur) => (cur === id ? null : id));
  };

  const handleDeleteSelected = async () => {
    if (!selectedPerson) return;
    await deletePerson(selectedPerson.id);
    setSelectedId(null);
  };

  // Delete/Backspace removes the selected card immediately, matching the
  // inspector action. Never intercept normal typing in a form field.
  // Bails out whenever focus is inside a text field (input/textarea/select/
  // contentEditable) so ordinary typing and backspacing elsewhere in the app
  // — the add-person form, search box, quick-add modal — is never hijacked.
  useEffect(() => {
    const handleKeyDown = async (e) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const target = e.target;
      const isEditable =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable;
      if (isEditable || !selectedId) return;

      e.preventDefault();
      await deletePerson(selectedId);
      setSelectedId(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedId, deletePerson]);

  // Click-and-drag panning on empty canvas — a large tree needs this far
  // more than thin scrollbars. Bails out if the mousedown started on an
  // actual person card, so clicking someone still selects them normally.
  const handleCanvasMouseDown = (e) => {
    if (e.button !== 0 || e.target.closest("[data-person-id]")) return;
    const viewport = scrollRef.current;
    if (!viewport) return;
    panState.current = {
      startX: e.clientX,
      startY: e.clientY,
      scrollLeft: viewport.scrollLeft,
      scrollTop: viewport.scrollTop,
    };
    setIsPanning(true);
  };

  const handleCanvasWheel = (e) => {
    e.preventDefault();
    const viewport = scrollRef.current;
    if (!viewport) return;
    const bounds = viewport.getBoundingClientRect();
    const cursorX = e.clientX - bounds.left;
    const cursorY = e.clientY - bounds.top;

    setZoom((current) => {
      // Convert the cursor into the tree's unscaled coordinate system, then
      // restore that same point under the cursor after the scale changes.
      // This makes ordinary wheel zoom feel anchored to the graph, rather
      // than jumping toward a fixed canvas corner.
      const treeX = (viewport.scrollLeft + cursorX) / current;
      const treeY = (viewport.scrollTop + cursorY) / current;
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      const next = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, +(current * factor).toFixed(3)));
      requestAnimationFrame(() => {
        viewport.scrollLeft = Math.max(0, treeX * next - cursorX);
        viewport.scrollTop = Math.max(0, treeY * next - cursorY);
      });
      return next;
    });
  };

  const centerPerson = (id) => {
    cardRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
  };

  const toggleFullscreen = async () => {
    if (!scrollRef.current) return;
    if (document.fullscreenElement) await document.exitFullscreen?.();
    else await scrollRef.current.requestFullscreen?.();
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      const state = panState.current;
      const viewport = scrollRef.current;
      if (!state || !viewport) return;
      viewport.scrollLeft = state.scrollLeft - (e.clientX - state.startX);
      viewport.scrollTop = state.scrollTop - (e.clientY - state.startY);
    };
    const handleMouseUp = () => {
      panState.current = null;
      setIsPanning(false);
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const toggleCollapse = (familyKey) => {
    setCollapsedFamilyKeys((prev) => {
      const next = new Set(prev);
      if (next.has(familyKey)) next.delete(familyKey);
      else next.add(familyKey);
      return next;
    });
  };

  const collapseAll = () => {
    const withChildren = scopedPeople.flatMap((person) => familyKeysFor(person));
    setCollapsedFamilyKeys(new Set(withChildren));
  };
  const expandAll = () => setCollapsedFamilyKeys(new Set());

  const handleSearch = (e) => {
    e.preventDefault();
    const q = query.trim().toLowerCase();
    if (!q) return;
    const match = scopedPeople.find((p) => p.name.toLowerCase().includes(q));
    if (!match) return;

    // If an ancestor is collapsed, this person is hidden — reveal them first.
    const ancestors = ancestorsOf(match.id, people);
    setCollapsedFamilyKeys((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const ancestorId of [...ancestors, match.id]) {
        for (const branch of familyKeysFor(people.find((person) => person.id === ancestorId))) {
          if (next.has(branch)) {
            next.delete(branch);
            changed = true;
          }
        }
      }
      return changed ? next : prev;
    });

    setHighlightId(match.id);
    setSelectedId(match.id); // also surfaces "how you're related" + path highlight
    // Wait a tick for any expand to re-render, then scroll to it.
    requestAnimationFrame(() => {
      const el = cardRefs.current[match.id];
      el?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    });
    setTimeout(() => setHighlightId((cur) => (cur === match.id ? null : cur)), 2200);
  };

  const zoomIn = () => setZoom((z) => Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(2)));
  const zoomOut = () => setZoom((z) => Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(2)));

  // Actually fits the whole tree in the viewport, rather than just resetting
  // to 100% — measures the tree's true (unscaled) size via scrollWidth /
  // scrollHeight, which CSS transforms don't affect, then picks whichever
  // scale (width- or height-limited) is smaller so nothing gets clipped.
  const fitToScreen = () => {
    const content = containerRef.current;
    const viewport = scrollRef.current;
    if (!content || !viewport) return;

    const contentW = content.scrollWidth;
    const contentH = content.scrollHeight;
    const viewportW = viewport.clientWidth;
    const viewportH = viewport.clientHeight;
    if (!contentW || !contentH) return;

    const scale = Math.min(viewportW / contentW, viewportH / contentH, 1) * 0.94;
    const nextZoom = Math.max(0.08, +scale.toFixed(3));
    setZoom(nextZoom);

    // Center horizontally, start from the top so ancestors are visible first.
    requestAnimationFrame(() => {
      const scaledW = contentW * nextZoom;
      viewport.scrollTo({
        left: Math.max(0, (scaledW - viewportW) / 2),
        top: 0,
        behavior: "smooth",
      });
    });
  };

  useLayoutEffect(() => {
    if (!containerRef.current || people.length === 0) return;

    const recompute = () => {
      const containerRect = containerRef.current.getBoundingClientRect();
      const points = {};
      for (const [id, el] of Object.entries(cardRefs.current)) {
        if (!el) continue;
        const r = el.getBoundingClientRect();
        points[id] = {
          top: { x: (r.left + r.width / 2 - containerRect.left) / zoom, y: (r.top - containerRect.top) / zoom },
          bottom: { x: (r.left + r.width / 2 - containerRect.left) / zoom, y: (r.bottom - containerRect.top) / zoom },
          left: { x: (r.left - containerRect.left) / zoom, y: (r.top + r.height / 2 - containerRect.top) / zoom },
          right: { x: (r.right - containerRect.left) / zoom, y: (r.top + r.height / 2 - containerRect.top) / zoom },
        };
      }
      const visibleById = new Map(scopedPeople.map((person) => [person.id, person]));
      const nextCollapseControls = [];

      const newLines = edges
        .map((edge) => {
          if (edge.type === "family-child") {
            const parentEntries = edge.parents
              .map((id) => ({ id, point: points[id] }))
              .filter((entry) => entry.point);
            const children = edge.children.map((id) => ({ id, point: points[id] })).filter((entry) => entry.point);
            if (!parentEntries.length || !children.length) return null;

            // When the parents are a couple, begin at the midpoint of their
            // horizontal partner connector. The previous implementation
            // began at the midpoint of their card bottoms, which left a
            // visible disconnected-looking section between the partner line
            // and the parent-to-child stem. For parent records without a
            // partner link, build a small bottom-edge family bar instead.
            const isPartnerPair =
              parentEntries.length === 2 &&
              parentEntries.every(({ id }) => visibleById.has(id)) &&
              parentEntries.every(({ id }) => {
                const partner = visibleById.get(id);
                return partner.spouseIds?.includes(parentEntries.find((entry) => entry.id !== id)?.id);
              });
            let startX;
            let startY;
            let parentConnector = "";
            if (isPartnerPair) {
              const [first, second] = parentEntries.map(({ point }) => point).sort((a, b) => a.left.x - b.left.x);
              startX = (first.right.x + second.left.x) / 2;
              startY = (first.right.y + second.left.y) / 2;
            } else {
              const parentBarY = Math.max(...parentEntries.map(({ point }) => point.bottom.y));
              const parentXs = parentEntries.map(({ point }) => point.bottom.x);
              startX = parentXs.reduce((sum, x) => sum + x, 0) / parentXs.length;
              startY = parentBarY;
              const parentDrops = parentEntries
                .map(({ point }) =>
                  point.bottom.y < parentBarY
                    ? `M ${point.bottom.x} ${point.bottom.y} L ${point.bottom.x} ${parentBarY}`
                    : ""
                )
                .join("");
              const parentMinX = Math.min(...parentXs);
              const parentMaxX = Math.max(...parentXs);
              parentConnector = `${parentDrops}${
                parentMaxX - parentMinX > 0.5
                  ? ` M ${parentMinX} ${parentBarY} L ${parentMaxX} ${parentBarY}`
                  : ""
              }`;
            }
            const junctionY = Math.min(...children.map(({ point }) => point.top.y)) - 26;
            nextCollapseControls.push({
              key: edge.familyKey,
              x: startX,
              y: junctionY,
              collapsed: collapsedFamilyKeys.has(edge.familyKey),
            });
            const childXs = children.map(({ point }) => point.top.x);
            const onPath = children.some(({ id }) => edge.parents.some((parentId) => pathEdgeKeys.has(`${parentId}|${id}`))) ||
              edge.parents.includes(selectedId) || edge.children.includes(selectedId);
            const stem = `M ${startX} ${startY} L ${startX} ${junctionY}`;
            // The bar must always span from the parents' stem to every child,
            // not just between the children themselves — with one child (or
            // children whose x-range doesn't include startX), the old code
            // skipped this segment entirely, leaving the stem and the drop
            // as two disconnected pieces (a visible gap in the line).
            const barXs = [startX, ...childXs];
            const barMinX = Math.min(...barXs);
            const barMaxX = Math.max(...barXs);
            const bar = barMaxX - barMinX > 0.5 ? ` M ${barMinX} ${junctionY} L ${barMaxX} ${junctionY}` : "";
            const drops = children.map(({ point }) => ` M ${point.top.x} ${junctionY} L ${point.top.x} ${point.top.y}`).join("");
            return {
              key: `family-${edge.parents.join("-")}-${edge.children.join("-")}`,
              type: "family-child",
              onPath,
              path: `${parentConnector}${stem}${bar}${drops}`,
            };
          }
          const from = points[edge.from];
          const to = points[edge.to];
          if (!from || !to) return null;
          const onPath = pathEdgeKeys.has(`${edge.from}|${edge.to}`) || edge.from === selectedId || edge.to === selectedId;
          if (edge.type === "spouse") {
            // Stored spouse links are not guaranteed to be left-to-right.
            // Choose visual anchors first so a reversed one-sided link
            // cannot draw through the two cards.
            const [left, right] = from.left.x <= to.left.x ? [from, to] : [to, from];
            return {
              key: `${edge.from}-${edge.to}-spouse`,
              type: "spouse",
              onPath,
              x1: left.right.x,
              y1: left.right.y,
              x2: right.left.x,
              y2: right.left.y,
            };
          }
          const midY = (from.bottom.y + to.top.y) / 2;
          return {
            key: `${edge.from}-${edge.to}-pc`,
            type: "parent-child",
            onPath,
            path: `M ${from.bottom.x} ${from.bottom.y} L ${from.bottom.x} ${midY} L ${to.top.x} ${midY} L ${to.top.x} ${to.top.y}`,
          };
        })
        .filter(Boolean);

      // A collapsed branch no longer has visible children to measure. Keep
      // its plus control at the family connector just below the parent cards.
      // This is the same junction used while expanded, so the control never
      // jumps under one arbitrary card.
      const visibleControlKeys = new Set(nextCollapseControls.map((control) => control.key));
      for (const familyKey of collapsedFamilyKeys) {
        if (visibleControlKeys.has(familyKey)) continue;
        const parentIds = familyKey.split("|").filter(Boolean);
        const parentPoints = parentIds.map((id) => points[id]).filter(Boolean);
        if (!parentPoints.length) continue;
        nextCollapseControls.push({
          key: familyKey,
          x: parentPoints.reduce((sum, point) => sum + point.bottom.x, 0) / parentPoints.length,
          y: Math.max(...parentPoints.map((point) => point.bottom.y)) + 18,
          collapsed: true,
        });
      }

      setLines(newLines);
      setCollapseControls(nextCollapseControls);
      setSize({ w: containerRect.width / zoom, h: containerRect.height / zoom });
    };

    recompute();
    window.addEventListener("resize", recompute);
    return () => window.removeEventListener("resize", recompute);
  }, [scopedPeople, edges, rows, zoom, pathEdgeKeys, selectedId, collapsedFamilyKeys]);

  // Auto-fit once, the first time the tree actually has people rendered,
  // so a freshly seeded/large tree opens fully visible instead of cropped
  // at 100% zoom, without fighting any zoom level the user picks afterward.
  const hasAutoFitted = useRef(false);
  useEffect(() => {
    if (hasAutoFitted.current || scopedPeople.length === 0) return;
    if (!containerRef.current?.scrollWidth) return;
    hasAutoFitted.current = true;
    fitToScreen();
  }, [scopedPeople, rows]);

  const familyLabel = (family) => {
    const otherPartners = (family.partner_ids || [])
      .filter((id) => id !== selectedPerson?.id)
      .map((id) => people.find((person) => person.id === id)?.name)
      .filter(Boolean);
    const partnerText = otherPartners.length ? `With ${otherPartners.join(" & ")}` : "Without a partner";
    return family.relationship_status && family.relationship_status !== "partner"
      ? `${partnerText} · ${family.relationship_status}`
      : partnerText;
  };
  const parentFamilyOptions = (selectedPerson?.parentFamilies || []).filter(
    (family) => family.partner_ids.length < 2
  );
  const childFamilyOptions = selectedPerson?.partnerFamilies || [];

  return (
    <div className="min-h-screen w-full bg-[#F7F5F0] flex flex-col">
      <AppHeader />

      <div className="flex-1 flex flex-col lg:flex-row">
        <aside className="w-full lg:w-[330px] shrink-0 border-b lg:border-b-0 lg:border-r border-[#DCE3E1] bg-white shadow-sm z-10">
          <div className="lg:sticky lg:top-0 lg:h-[calc(100vh-69px)] lg:overflow-y-auto">
            <div className="flex border-b border-[#DCE3E1] px-5 gap-6">
              {[
                ["personal", "Personal"],
                ["biography", "Biography"],
                ["image", "Image"],
              ].map(([tab, label]) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setInspectorTab(tab)}
                  className={`py-4 text-xs font-semibold uppercase tracking-wide border-b-2 -mb-px ${
                    inspectorTab === tab ? "border-[#1C4B3C] text-[#1C4B3C]" : "border-transparent text-[#7B8794] hover:text-[#1C4B3C]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {selectedPerson ? (
              <div className="p-5">
                {inspectorTab === "personal" && (
                  <>
                    <div className="border border-[#DCE3E1] rounded-lg overflow-hidden mb-5">
                      {[
                        ["Person’s name", selectedPerson.name],
                        ["Gender", selectedPerson.gender ? selectedPerson.gender[0].toUpperCase() + selectedPerson.gender.slice(1) : "Not recorded"],
                        ["Date of birth", selectedPerson.dob || "Not recorded"],
                        ["Date of death", selectedPerson.dod || "—"],
                      ].map(([label, value]) => (
                        <div key={label} className="flex justify-between gap-3 px-3 py-2.5 border-b last:border-b-0 border-[#DCE3E1] text-sm">
                          <span className="text-[#374151]">{label}</span>
                          <span className="text-[#5A6980] text-right truncate">{value}</span>
                        </div>
                      ))}
                    </div>
                    <Link
                      to={`/people/${selectedPerson.id}/edit`}
                      className="flex items-center justify-center gap-2 w-full rounded-md bg-[#1C4B3C] text-white text-sm font-medium py-2.5 shadow-sm hover:bg-[#163C30]"
                    >
                      <Pencil className="w-4 h-4" /> Edit person
                    </Link>
                  </>
                )}

                {inspectorTab === "biography" && (
                  <div className="rounded-lg border border-[#DCE3E1] p-4 text-sm leading-relaxed text-[#5A6980] min-h-28">
                    {selectedPerson.notes || "No biography has been added for this person yet."}
                  </div>
                )}

                {inspectorTab === "image" && (
                  <div className="rounded-lg border border-[#DCE3E1] p-5 flex flex-col items-center text-center">
                    <div className="w-28 h-28 rounded-full overflow-hidden bg-[#EDF4F3] border border-[#DCE3E1] flex items-center justify-center mb-4">
                      {selectedPerson.photo ? <img src={selectedPerson.photo} alt={selectedPerson.name} className="w-full h-full object-cover" /> : <User className="w-10 h-10 text-[#C9BEA8]" />}
                    </div>
                    <Link to={`/people/${selectedPerson.id}/edit`} className="text-sm font-medium text-[#1C4B3C] hover:underline">Add or change photo</Link>
                  </div>
                )}

                <div className="border-t border-[#DCE3E1] mt-5 pt-5 space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7B8794] mb-3">Build this branch</p>
                  <button
                    type="button"
                    onClick={() => openQuickAdd("parent")}
                    className="w-full rounded-md bg-[#D7E7DF] text-[#1C4B3C] text-sm font-medium py-2.5 hover:bg-[#C5DDD2]"
                  >
                    Add parent
                  </button>
                  <button type="button" onClick={() => openQuickAdd("sibling")} className="w-full rounded-md bg-[#1C4B3C] text-white text-sm font-medium py-2.5 hover:bg-[#163C30]">Add sibling</button>
                  <button type="button" onClick={() => openQuickAdd("spouse")} className="w-full rounded-md bg-[#1C4B3C] text-white text-sm font-medium py-2.5 hover:bg-[#163C30]">Add partner</button>
                  <button type="button" onClick={() => openQuickAdd("child")} className="w-full rounded-md bg-[#1C4B3C] text-white text-sm font-medium py-2.5 hover:bg-[#163C30]">Add child</button>
                </div>

                <div className="border-t border-[#DCE3E1] mt-5 pt-4">
                  <button type="button" onClick={() => setRootPersonId(selectedPerson.id)} className="w-full text-xs font-medium text-[#6B7280] rounded-md py-2 hover:bg-[#F0EDE3] mb-2">Set as root person</button>
                  <button type="button" onClick={handleDeleteSelected} className="flex items-center justify-center gap-1.5 w-full text-xs font-medium text-[#A65035] border border-[#E7C4B8] rounded-md py-2 hover:bg-[#FBEAE1]"><Trash2 className="w-3.5 h-3.5" /> Delete person</button>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center">
                <User className="w-8 h-8 text-[#C9BEA8] mx-auto mb-3" />
                <p className="text-sm text-[#5A6980]">Select someone in the tree to view and build their family branch.</p>
              </div>
            )}
          </div>
        </aside>

        <main className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center justify-between gap-4 flex-wrap px-6 lg:px-10 py-5 border-b border-[#E7E2D6]">
            <div>
              <h1 className="text-xl font-serif font-bold text-[#1C1F1D] mb-0.5">Your family tree</h1>
              <p className="text-xs text-[#6B7280]">
                Generated automatically from the people and relationships you've added.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <form onSubmit={handleSearch} className="relative">
                <Search className="w-3.5 h-3.5 text-[#9CA3AF] absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search person…"
                  className="text-xs rounded-lg border border-[#D9D3C3] bg-white pl-8 pr-2.5 py-1.5 w-36 focus:outline-none focus:ring-2 focus:ring-[#1C4B3C]/30 focus:border-[#1C4B3C]"
                />
              </form>

              <div className="flex items-center border border-[#D9D3C3] rounded-lg overflow-hidden bg-white">
                <button
                  type="button"
                  onClick={zoomOut}
                  title="Zoom out"
                  className="p-1.5 hover:bg-[#F0EDE3] text-[#374151]"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="text-[10px] text-[#6B7280] w-9 text-center select-none">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={zoomIn}
                  title="Zoom in"
                  className="p-1.5 hover:bg-[#F0EDE3] text-[#374151]"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>

              <button
                type="button"
                onClick={fitToScreen}
                title="Fit to screen"
                className="flex items-center gap-1 text-xs text-[#374151] border border-[#D9D3C3] rounded-lg px-2.5 py-1.5 bg-white hover:bg-[#F0EDE3]"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                Fit
              </button>

              <button type="button" onClick={() => centerPerson(selectedId || rootPersonId)} title="Center selected person" className="p-1.5 text-[#374151] border border-[#D9D3C3] rounded-lg bg-white hover:bg-[#F0EDE3]"><LocateFixed className="w-3.5 h-3.5" /></button>
              <button type="button" onClick={toggleFullscreen} title="Fullscreen canvas" className="p-1.5 text-[#374151] border border-[#D9D3C3] rounded-lg bg-white hover:bg-[#F0EDE3]"><Focus className="w-3.5 h-3.5" /></button>

              <button
                type="button"
                onClick={() => window.print()}
                title="Print this family tree"
                className="flex items-center gap-1 text-xs text-[#374151] border border-[#D9D3C3] rounded-lg px-2.5 py-1.5 bg-white hover:bg-[#F0EDE3]"
              >
                <Printer className="w-3.5 h-3.5" />
                Print
              </button>

              <button
                type="button"
                onClick={collapseAll}
                title="Collapse all branches"
                className="flex items-center gap-1 text-xs text-[#374151] border border-[#D9D3C3] rounded-lg px-2.5 py-1.5 bg-white hover:bg-[#F0EDE3]"
              >
                <ChevronsDownUp className="w-3.5 h-3.5" />
                Collapse all
              </button>
              <button
                type="button"
                onClick={expandAll}
                title="Expand all branches"
                className="flex items-center gap-1 text-xs text-[#374151] border border-[#D9D3C3] rounded-lg px-2.5 py-1.5 bg-white hover:bg-[#F0EDE3]"
              >
                <ChevronsUpDown className="w-3.5 h-3.5" />
                Expand all
              </button>
            </div>
          </div>

          {scopedPeople.length === 0 ? (
            <div className="m-8 border border-dashed border-[#C9BEA8] rounded-xl px-8 py-20 text-center">
              <p className="text-sm text-[#6B7280] mb-1">Nothing to show yet.</p>
              <p className="text-xs text-[#9CA3AF]">Add someone on the left and the tree will build itself.</p>
            </div>
          ) : (
            <div
              ref={scrollRef}
              onMouseDown={handleCanvasMouseDown}
              onWheel={handleCanvasWheel}
              className={`flex-1 overflow-auto px-6 lg:px-10 py-8 bg-white ${
                isPanning ? "cursor-grabbing select-none" : "cursor-grab"
              }`}
              style={{ backgroundImage: "radial-gradient(#DCE3E1 0.7px, transparent 0.7px)", backgroundSize: "16px 16px" }}
            >
              <div
                ref={containerRef}
                className="relative mx-auto origin-top-left"
                style={{
                  minWidth: layoutWidth,
                  minHeight: rows.length * ROW_HEIGHT + 32,
                  transform: `scale(${zoom})`,
                }}
              >
                <svg
                  className="absolute top-0 left-0 pointer-events-none overflow-visible"
                  width={size.w}
                  height={size.h}
                  style={{ width: "100%", height: "100%" }}
                >
                  {lines.map((line) =>
                    line.type === "spouse" ? (
                      <line
                        key={line.key}
                        x1={line.x1}
                        y1={line.y1}
                        x2={line.x2}
                        y2={line.y2}
                        stroke={line.onPath ? "#B8862E" : "#C9BEA8"}
                        strokeWidth={line.onPath ? 3 : 2}
                      />
                    ) : (
                      <path
                        key={line.key}
                        d={line.path}
                        fill="none"
                        stroke={line.onPath ? "#B8862E" : "#C9BEA8"}
                        strokeWidth={line.onPath ? 2.5 : line.type === "family-child" ? 2 : 1.5}
                      />
                    )
                  )}
                </svg>

                <div
                  className="relative"
                  style={{
                    height: rows.length * ROW_HEIGHT + 32,
                    minWidth: layoutWidth,
                  }}
                >
                  {rows.map((row, i) => (
                    <div
                      key={`${row.componentIndex}-${i}`}
                      className="absolute left-0 right-0"
                      style={{ top: i * ROW_HEIGHT, height: ROW_HEIGHT }}
                    >
                      {row.people.map(({ person, x }) => {
                        return (
                          <div
                            key={person.id}
                            className="absolute top-0"
                            style={{ left: x }}
                          >
                            <PersonCard
                              person={person}
                              cardRef={(el) => (cardRefs.current[person.id] = el)}
                              highlighted={highlightId === person.id}
                              onPath={pathIdSet.has(person.id)}
                              isRoot={rootPersonId === person.id}
                              isSelected={selectedId === person.id}
                              onSelect={handleSelectPerson}
                            />
                          </div>
                        );
                      })}
                    </div>
                  ))}
                  {collapseControls.map((control) => (
                    <button
                      key={control.key}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleCollapse(control.key);
                      }}
                      title={control.collapsed ? "Expand this family branch" : "Collapse this family branch"}
                      aria-label={control.collapsed ? "Expand this family branch" : "Collapse this family branch"}
                      className="absolute z-10 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-[#174F61] text-white shadow-md hover:bg-[#1C4B3C] focus:outline-none focus:ring-2 focus:ring-[#174F61]/40"
                      style={{ left: control.x, top: control.y }}
                    >
                      {control.collapsed ? <Plus className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {quickRelation && selectedPerson && (
        <div className="fixed inset-0 z-30 flex items-end sm:items-center justify-center bg-[#1C1F1D]/30 p-4" onMouseDown={closeQuickAdd}>
          <form
            onSubmit={submitQuickAdd}
            onMouseDown={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-xl bg-white shadow-xl border border-[#E7E2D6] p-5"
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="w-9 h-9 rounded-full bg-[#1C4B3C]/10 flex items-center justify-center shrink-0">
                <UserPlus className="w-4 h-4 text-[#1C4B3C]" />
              </div>
              <div>
                <h2 className="text-base font-serif font-bold text-[#1C1F1D]">
                  Add {quickRelation === "spouse" ? "a partner" : quickRelation === "parent" ? "a parent" : `a ${quickRelation}`}
                </h2>
                <p className="text-xs text-[#6B7280] mt-0.5">
                  {quickRelation === "child"
                    ? `Choose which partner family ${selectedPerson.name} belongs to.`
                    : quickRelation === "sibling"
                    ? `This sibling will share the selected parent family.`
                    : `The new person will be linked directly to ${selectedPerson.name}.`}
                </p>
              </div>
            </div>

            {quickError && <p className="mb-3 rounded-lg bg-[#FBEAE1] px-3 py-2 text-xs text-[#B3441C]">{quickError}</p>}
            {quickSuccess && <p className="mb-3 rounded-lg bg-[#E7F3ED] px-3 py-2 text-xs text-[#1C4B3C]">{quickSuccess}</p>}

            {quickRelation === "parent" && (
              <>
                <label className="block text-xs font-medium text-[#374151] mb-1.5">Parent family</label>
                <select value={quickFamilyId} onChange={(e) => setQuickFamilyId(e.target.value)} className={inputClass}>
                  {parentFamilyOptions.length > 1 && <option value="">Choose a parent family…</option>}
                  {parentFamilyOptions.map((family) => (
                    <option key={family.id} value={family.id}>{familyLabel(family)}</option>
                  ))}
                  <option value="new-family">Create a new parent family</option>
                </select>
                <label className="block text-xs font-medium text-[#374151] mt-3 mb-1.5">Parent type</label>
                <select
                  value={quickParentType}
                  onChange={(e) => {
                    setQuickParentType(e.target.value);
                    setQuickGender(e.target.value === "father" ? "male" : e.target.value === "mother" ? "female" : "unspecified");
                  }}
                  className={inputClass}
                >
                  <option value="parent">Parent</option>
                  <option value="father">Father</option>
                  <option value="mother">Mother</option>
                </select>
                <label className="block text-xs font-medium text-[#374151] mt-3 mb-1.5">Relationship to this family</label>
                <select value={quickFamilyRelationship} onChange={(e) => setQuickFamilyRelationship(e.target.value)} className={inputClass}>
                  <option value="biological">Biological</option>
                  <option value="adoptive">Adoptive</option>
                  <option value="step">Step-parent</option>
                  <option value="unknown">Unknown</option>
                </select>
              </>
            )}

            {quickRelation === "sibling" && (
              <>
                <label className="block text-xs font-medium text-[#374151] mb-1.5">Shared parent family</label>
                <select value={quickFamilyId} onChange={(e) => setQuickFamilyId(e.target.value)} className={inputClass}>
                  {parentFamilyOptions.length === 0 && <option value="">No parent family available</option>}
                  {parentFamilyOptions.length > 1 && <option value="">Choose a parent family…</option>}
                  {selectedPerson.parentFamilies?.map((family) => (
                    <option key={family.id} value={family.id}>{familyLabel(family)}</option>
                  ))}
                  <option value="new-family">Different / unknown parent family</option>
                </select>
                <label className="block text-xs font-medium text-[#374151] mt-3 mb-1.5">Sibling relationship</label>
                <select value={quickFamilyRelationship} onChange={(e) => setQuickFamilyRelationship(e.target.value)} className={inputClass}>
                  <option value="biological">Biological sibling</option>
                  <option value="adoptive">Adoptive sibling</option>
                  <option value="step">Step-sibling</option>
                  <option value="unknown">Unknown</option>
                </select>
              </>
            )}

            {quickRelation === "child" && (
              <>
                <label className="block text-xs font-medium text-[#374151] mb-1.5">Partner for this child</label>
                <select value={quickFamilyId} onChange={(e) => setQuickFamilyId(e.target.value)} className={inputClass}>
                  {childFamilyOptions.length > 1 && <option value="">Choose a partner family…</option>}
                  {childFamilyOptions.map((family) => (
                    <option key={family.id} value={family.id}>{familyLabel(family)}</option>
                  ))}
                  <option value="no-partner">No partner / just {selectedPerson.name}</option>
                  <option value="different-partner">Different partner — add partner first</option>
                </select>
                {quickFamilyId === "different-partner" && (
                  <div className="mt-3 rounded-lg border border-[#DCE3E1] bg-[#F7F9F7] p-3">
                    <p className="text-xs text-[#5A6980] mb-2">Add or select the partner first. The child form stays open after that.</p>
                    <div className="flex gap-2 mb-3">
                      <button
                        type="button"
                        onClick={() => { setQuickPartnerMode("add"); setQuickPartnerId(""); }}
                        className={`flex-1 rounded-md px-2 py-1.5 text-[11px] font-medium ${quickPartnerMode === "add" ? "bg-[#1C4B3C] text-white" : "bg-white text-[#5A6980] border border-[#DCE3E1]"}`}
                      >
                        Add partner
                      </button>
                      <button
                        type="button"
                        onClick={() => { setQuickPartnerMode("select"); setQuickPartnerName(""); }}
                        className={`flex-1 rounded-md px-2 py-1.5 text-[11px] font-medium ${quickPartnerMode === "select" ? "bg-[#1C4B3C] text-white" : "bg-white text-[#5A6980] border border-[#DCE3E1]"}`}
                      >
                        Select existing
                      </button>
                    </div>
                    {quickPartnerMode === "add" ? (
                      <>
                        <input
                          value={quickPartnerName}
                          onChange={(e) => setQuickPartnerName(e.target.value)}
                          placeholder="Partner's full name"
                          className={inputClass}
                        />
                        <button
                          type="button"
                          onClick={addPartnerBeforeChild}
                          disabled={quickPartnerSaving}
                          className="mt-2 w-full rounded-lg border border-[#1C4B3C]/30 py-2 text-xs font-medium text-[#1C4B3C] hover:bg-white disabled:opacity-60"
                        >
                          {quickPartnerSaving ? "Adding partner…" : "Add partner and continue"}
                        </button>
                      </>
                    ) : (
                      <select
                        value={quickPartnerId}
                        onChange={(e) => setQuickPartnerId(e.target.value)}
                        className={inputClass}
                      >
                        <option value="">Select an existing person…</option>
                        {people
                          .filter((person) => person.id !== selectedPerson.id)
                          .map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
                      </select>
                    )}
                  </div>
                )}
                <label className="block text-xs font-medium text-[#374151] mt-3 mb-1.5">Child relationship</label>
                <select value={quickFamilyRelationship} onChange={(e) => setQuickFamilyRelationship(e.target.value)} className={inputClass}>
                  <option value="biological">Biological child</option>
                  <option value="adoptive">Adopted child</option>
                  <option value="step">Stepchild</option>
                  <option value="unknown">Unknown</option>
                </select>
              </>
            )}

            <label className="block text-xs font-medium text-[#374151] mb-1.5" htmlFor="quick-relative-name">Full name</label>
            <input
              id="quick-relative-name"
              autoFocus
              value={quickName}
              onChange={(e) => setQuickName(e.target.value)}
              placeholder="e.g. Asha Rao"
              className={inputClass}
            />

            <label className="block text-xs font-medium text-[#374151] mt-3 mb-1.5" htmlFor="quick-relative-gender">Gender</label>
            <select id="quick-relative-gender" value={quickGender} onChange={(e) => setQuickGender(e.target.value)} className={inputClass}>
              <option value="unspecified">Prefer not to say</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
            </select>
            {quickRelation === "spouse" && (
              <>
                <label className="block text-xs font-medium text-[#374151] mt-3 mb-1.5">Partner status</label>
                <select value={quickPartnerStatus} onChange={(e) => setQuickPartnerStatus(e.target.value)} className={inputClass}>
                  <option value="partner">Partner</option>
                  <option value="married">Married</option>
                  <option value="separated">Separated</option>
                  <option value="divorced">Divorced / remarriage history</option>
                  <option value="unknown">Unknown</option>
                </select>
              </>
            )}

            <div className="flex justify-end gap-2 mt-5">
              <button type="button" onClick={closeQuickAdd} className="text-xs font-medium text-[#6B7280] px-3 py-2 hover:text-[#1C1F1D]">Cancel</button>
              {quickRelation === "child" && quickSuccess && (
                <button type="button" onClick={closeQuickAdd} className="text-xs font-medium text-[#1C4B3C] px-3 py-2 hover:underline">Done</button>
              )}
              <button type="submit" disabled={quickSaving} className="inline-flex items-center gap-1.5 rounded-lg bg-[#1C4B3C] px-3.5 py-2 text-xs font-medium text-white hover:bg-[#163C30] disabled:opacity-60">
                {quickSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {quickRelation === "child" && quickSuccess ? "Add another child" : "Add to tree"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
