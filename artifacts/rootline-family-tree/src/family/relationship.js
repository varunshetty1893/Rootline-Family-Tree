// Computes a human-readable relationship label ("first cousin once removed",
// "grandmother", "brother-in-law", ...) and a highlight path between a
// chosen root person ("you") and any other person in the tree.
//
// Works entirely off the parentIds/spouseIds already present on each mapped
// person (see FamilyContext.mapPerson) — no extra backend call needed, and
// it scales fine even for large trees since each lookup is a couple of BFS
// walks bounded by the tree's actual depth, not its total size.

function byIdMap(people) {
  return new Map(people.map((p) => [p.id, p]));
}

// BFS up through parentIds only, recording distance + path-so-far to every
// ancestor (including the person themself, at distance 0).
function ancestorDepths(startId, people) {
  const byId = byIdMap(people);
  const result = new Map();
  const queue = [{ id: startId, depth: 0, path: [startId] }];
  const seen = new Set([startId]);

  while (queue.length) {
    const { id, depth, path } = queue.shift();
    result.set(id, { depth, path });
    const person = byId.get(id);
    if (!person) continue;
    for (const parentId of person.parentIds || []) {
      if (seen.has(parentId) || !byId.has(parentId)) continue;
      seen.add(parentId);
      queue.push({ id: parentId, depth: depth + 1, path: [...path, parentId] });
    }
  }
  return result;
}

// Finds the closest common ancestor of a and b (by combined distance), and
// returns { up, down, path } where `up` = generations from a to the common
// ancestor, `down` = generations from the common ancestor to b, and `path`
// is the full chain of person ids from a to b through that ancestor.
function bloodRelation(aId, bId, people) {
  if (aId === bId) return { up: 0, down: 0, path: [aId] };

  const aAnc = ancestorDepths(aId, people);
  const bAnc = ancestorDepths(bId, people);

  let best = null;
  for (const [ancId, aInfo] of aAnc) {
    const bInfo = bAnc.get(ancId);
    if (!bInfo) continue;
    const total = aInfo.depth + bInfo.depth;
    if (!best || total < best.total) {
      best = { total, up: aInfo.depth, down: bInfo.depth, aPath: aInfo.path, bPath: bInfo.path };
    }
  }
  if (!best) return null;

  const downSide = [...best.bPath].reverse(); // ancestor ... b
  const path = [...best.aPath.slice(0, -1), ...downSide]; // a ... ancestor ... b
  return { up: best.up, down: best.down, path };
}

function ordinal(n) {
  const names = [
    "", "first", "second", "third", "fourth", "fifth", "sixth", "seventh",
    "eighth", "ninth", "tenth",
  ];
  if (n < names.length) return names[n];
  return `${n}th`;
}

function greatPrefix(count) {
  return count > 0 ? `${"great-".repeat(count)}` : "";
}

function genderWord(gender, male, female, neutral) {
  if (gender === "male") return male;
  if (gender === "female") return female;
  return neutral;
}

// Labels a pure blood relationship (no marriage involved) purely from the
// generation gap (up = steps toward the common ancestor, down = steps back
// down to the target), using the target's gender where it changes the word.
function bloodLabel(up, down, targetGender) {
  if (up === 0 && down === 0) return "you";

  if (down === 0) {
    // Straight-line ancestor of root: parent, grandparent, great-grandparent...
    if (up === 1) return genderWord(targetGender, "father", "mother", "parent");
    const g = greatPrefix(up - 2);
    return `${g}grand${genderWord(targetGender, "father", "mother", "parent")}`;
  }
  if (up === 0) {
    // Straight-line descendant of root: child, grandchild, great-grandchild...
    if (down === 1) return genderWord(targetGender, "son", "daughter", "child");
    const g = greatPrefix(down - 2);
    return `${g}grand${genderWord(targetGender, "son", "daughter", "child")}`;
  }
  if (up === 1 && down === 1) {
    return genderWord(targetGender, "brother", "sister", "sibling");
  }
  if (up >= 2 && down === 1) {
    // Root's parent/grandparent/... 's sibling
    const g = greatPrefix(up - 2);
    const grand = up > 2 ? "grand-" : "";
    return `${g}${grand}${genderWord(targetGender, "uncle", "aunt", "aunt/uncle")}`;
  }
  if (up === 1 && down >= 2) {
    // Root's sibling's child/grandchild/...
    const g = greatPrefix(down - 2);
    const grand = down > 2 ? "grand-" : "";
    return `${g}${grand}${genderWord(targetGender, "nephew", "niece", "niece/nephew")}`;
  }
  // General cousin case
  const degree = Math.min(up, down) - 1;
  const removed = Math.abs(up - down);
  let label = `${ordinal(degree)} cousin`;
  if (removed > 0) label += ` ${removed} time${removed > 1 ? "s" : ""} removed`;
  return label;
}

function spouseLabel(gender) {
  return genderWord(gender, "husband", "wife", "spouse");
}

// In-law label built from the underlying blood relation type. The common
// parent/child/sibling cases get the standard dedicated word; anything more
// distant falls back to a plain-English description, phrased differently
// depending on which side of the marriage the connection runs through:
//  - "target-spouse": the target themself married into root's blood family
//    (e.g. root's cousin's husband) -> "husband of your first cousin"
//  - "root-spouse": target is a blood relative of root's own spouse
//    (e.g. root's spouse's cousin) -> "your spouse's first cousin"
// `coreGender` is the gender of whichever person the blood relation is
// actually measured to: the spouse-of-target for "target-spouse" in-laws
// (their gender picks "uncle" vs "aunt", not the target's), or the target
// themself for "root-spouse" in-laws.
function inLawLabel(up, down, targetGender, coreGender, via) {
  if (up === 1 && down === 0) {
    return genderWord(targetGender, "father-in-law", "mother-in-law", "parent-in-law");
  }
  if (up === 0 && down === 1) {
    return genderWord(targetGender, "son-in-law", "daughter-in-law", "child-in-law");
  }
  if (up === 1 && down === 1) {
    return genderWord(targetGender, "brother-in-law", "sister-in-law", "sibling-in-law");
  }
  const core = bloodLabel(up, down, coreGender);
  if (via === "target-spouse") {
    return `${spouseLabel(targetGender)} of your ${core}`;
  }
  return `your spouse's ${core}`;
}

/**
 * Finds how `targetId` relates to `rootId`.
 * Returns null if no connection could be found within the loaded tree.
 * Otherwise returns { label, path } where `path` is an ordered array of
 * person ids from root to target, suitable for highlighting.
 */
export function findRelationship(rootId, targetId, people) {
  if (!rootId || !targetId) return null;
  const byId = byIdMap(people);
  const root = byId.get(rootId);
  const target = byId.get(targetId);
  if (!root || !target) return null;

  if (rootId === targetId) {
    return { label: "This is you", path: [rootId], kind: "self" };
  }

  const blood = bloodRelation(rootId, targetId, people);
  if (blood) {
    return { label: bloodLabel(blood.up, blood.down, target.gender), path: blood.path, kind: "blood" };
  }

  // Direct spouse
  if ((root.spouseIds || []).includes(targetId)) {
    return { label: spouseLabel(target.gender), path: [rootId, targetId], kind: "spouse" };
  }

  // In-law: target married to one of root's blood relatives.
  let bestInLaw = null;
  for (const spouseOfTarget of target.spouseIds || []) {
    const rel = bloodRelation(rootId, spouseOfTarget, people);
    if (rel && (!bestInLaw || rel.up + rel.down < bestInLaw.rel.up + bestInLaw.rel.down)) {
      bestInLaw = {
        rel,
        path: [...rel.path, targetId],
        via: "target-spouse",
        coreGender: byId.get(spouseOfTarget)?.gender,
      };
    }
  }
  // In-law: root married to one of target's blood relatives.
  for (const spouseOfRoot of root.spouseIds || []) {
    const rel = bloodRelation(spouseOfRoot, targetId, people);
    if (rel && (!bestInLaw || rel.up + rel.down < bestInLaw.rel.up + bestInLaw.rel.down)) {
      bestInLaw = {
        rel,
        path: [rootId, ...rel.path],
        via: "root-spouse",
        coreGender: target.gender,
      };
    }
  }

  if (bestInLaw) {
    return {
      label: inLawLabel(
        bestInLaw.rel.up,
        bestInLaw.rel.down,
        target.gender,
        bestInLaw.coreGender,
        bestInLaw.via
      ),
      path: bestInLaw.path,
      kind: "in-law",
    };
  }

  return null;
}

// Turns a path of person ids into a Set of undirected "a|b" edge keys, so
// the tree renderer can look up whether a given connector line sits on the
// highlighted path regardless of which direction it was drawn in.
export function pathToEdgeKeySet(path) {
  const keys = new Set();
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    keys.add(`${a}|${b}`);
    keys.add(`${b}|${a}`);
  }
  return keys;
}
