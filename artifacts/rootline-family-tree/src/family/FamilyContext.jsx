import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useAuth } from "../AuthContext.jsx";
import { api } from "../api.js";

const FamilyContext = createContext(null);

// Maps the backend's snake_case Person (with parent_ids/spouse_ids derived
// from Family Units) onto the field names the tree layout and forms expect.
function mapPerson(person) {
  return {
    ...person,
    photo: person.photo_url || "",
    dob: person.date_of_birth || "",
    dod: person.date_of_death || "",
    notes: person.bio || "",
    parentIds: person.parent_ids || [],
    spouseIds: person.spouse_ids || [],
    parentFamilies: person.parent_families || [],
    partnerFamilies: person.partner_families || [],
  };
}

// "Who are you?" — the tree needs one reference point to describe every
// other person's relationship from ("your grandmother", "your cousin"...).
// Stored per-account in localStorage rather than the backend since it's a
// pure viewing preference, not family data other people would ever need.
function rootStorageKey(userId) {
  return `rootline:root-person:${userId}`;
}

export function FamilyProvider({ children }) {
  const { token, user } = useAuth();
  const [people, setPeople] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [rootPersonId, setRootPersonIdState] = useState(null);

  const refresh = useCallback(async () => {
    if (!token) {
      setPeople([]);
      setLoaded(true);
      return;
    }
    try {
      const data = await api.listPeople(token);
      setPeople(data.map(mapPerson));
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoaded(true);
    }
  }, [token]);

  useEffect(() => {
    setLoaded(false);
    refresh();
  }, [refresh, user?.id]);

  // Load the saved root person for this account once we know who's logged
  // in; falls back to the oldest-created person (usually the one the user
  // added first, i.e. themself) until they explicitly pick someone else.
  useEffect(() => {
    if (!user?.id) {
      setRootPersonIdState(null);
      return;
    }
    const saved = localStorage.getItem(rootStorageKey(user.id));
    setRootPersonIdState(saved || null);
  }, [user?.id]);

  const setRootPersonId = useCallback(
    (id) => {
      setRootPersonIdState(id);
      if (user?.id) {
        if (id) localStorage.setItem(rootStorageKey(user.id), id);
        else localStorage.removeItem(rootStorageKey(user.id));
      }
    },
    [user?.id]
  );

  // Effective root: the saved choice if it still exists, otherwise the
  // earliest-added person, otherwise nothing (empty tree).
  const effectiveRootPersonId = useCallback(() => {
    if (rootPersonId && people.some((p) => p.id === rootPersonId)) return rootPersonId;
    return people[0]?.id || null;
  }, [rootPersonId, people]);

  const getPerson = useCallback((id) => people.find((p) => p.id === id), [people]);

  const addPerson = useCallback(
    async (details, relation) => {
      const payload = {
        name: details.name,
        gender: details.gender && details.gender !== "unspecified" ? details.gender : null,
        date_of_birth: details.dob || null,
        date_of_death: details.dod || null,
        bio: details.notes || null,
        photo_url: details.photo || null,
        relation_type: relation?.type || null,
        related_to_id: relation?.toId || null,
        family_id: relation?.familyId || null,
        partner_id: relation?.partnerId || null,
        family_relationship: relation?.familyRelationship || null,
        partner_status: relation?.partnerStatus || null,
        new_family: Boolean(relation?.newFamily),
      };
      const created = await api.createPerson(payload, token);
      // A relation can change other people's parent/spouse lists too
      // (e.g. a new spouse links back to the existing partner), so
      // refresh the whole list rather than patching just the new node.
      await refresh();
      return created.id;
    },
    [token, refresh]
  );

  const updatePerson = useCallback(
    async (id, details) => {
      const payload = {
        name: details.name,
        gender: details.gender && details.gender !== "unspecified" ? details.gender : null,
        date_of_birth: details.dob || null,
        date_of_death: details.dod || null,
        bio: details.notes || null,
        photo_url: details.photo || null,
      };
      const updated = await api.updatePerson(id, payload, token);
      setPeople((prev) => prev.map((p) => (p.id === id ? mapPerson(updated) : p)));
    },
    [token]
  );

  const deletePerson = useCallback(
    async (id) => {
      await api.deletePerson(id, token);
      await refresh();
    },
    [token, refresh]
  );

  const childrenOf = useCallback(
    (id) => people.filter((p) => p.parentIds.includes(id)),
    [people]
  );

  const siblingsOf = useCallback(
    (id) => {
      const person = getPerson(id);
      if (!person || person.parentIds.length === 0) return [];
      return people.filter(
        (p) => p.id !== id && p.parentIds.some((pid) => person.parentIds.includes(pid))
      );
    },
    [people, getPerson]
  );

  return (
    <FamilyContext.Provider
      value={{
        people,
        loaded,
        error,
        addPerson,
        updatePerson,
        deletePerson,
        getPerson,
        childrenOf,
        siblingsOf,
        rootPersonId: effectiveRootPersonId(),
        setRootPersonId,
      }}
    >
      {children}
    </FamilyContext.Provider>
  );
}

export function useFamily() {
  const ctx = useContext(FamilyContext);
  if (!ctx) throw new Error("useFamily must be used within a FamilyProvider");
  return ctx;
}
