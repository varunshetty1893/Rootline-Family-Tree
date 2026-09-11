/*
 * Layered family-tree layout.
 *
 * The old layout assigned a slot while walking the graph. That works for a
 * single parent chain, but it cannot keep two parents, two partners and
 * several sibling branches aligned at the same time. This implementation
 * first contracts partners into family units, lays those units out by
 * generation, and only then expands each unit back into person cards.
 *
 * A family unit is one person or a connected group of partners. Parent/child
 * edges are laid out between units, so a couple always occupies one logical
 * position. That is what keeps a child centred under both parents and keeps a
 * couple centred under the two sides of their family.
 */

const CARD_WIDTH = 136;
const PERSON_PITCH = 160;
const UNIT_GAP = 48;

function stableKey(person, indexById) {
  const created = person.created_at || person.createdAt || "";
  return `${created}|${person.name || ""}|${indexById.get(person.id) ?? 0}|${person.id}`;
}

function birthKey(person) {
  // ISO dates sort chronologically as strings. Keep missing DOBs after every
  // known DOB so an incomplete record never displaces a dated sibling.
  const dob = person?.dob || person?.date_of_birth || "";
  return dob || "9999-99-99";
}

function siblingKey(person, indexById) {
  return `${birthKey(person)}|${stableKey(person, indexById)}`;
}

function childKeyForParentUnit(unit, parentUnitId, indexById) {
  // A child can be contracted with their partner. When ordering the children
  // of one parent unit, use the member who is actually connected to that
  // parent, never the partner's DOB or creation order.
  const connected = unit.members.filter((member) =>
    unit.memberParents.get(member.id)?.has(parentUnitId)
  );
  const person = connected.sort((a, b) => siblingKey(a, indexById).localeCompare(siblingKey(b, indexById)))[0]
    || unit.members[0];
  return siblingKey(person, indexById);
}

function familyKeyForParentUnit(unit, parentUnitId, indexById) {
  const familyKeys = [];
  for (const member of unit.members) {
    const parentFamilies = unit.memberParentFamilies.get(member.id)?.get(parentUnitId) || [];
    familyKeys.push(...parentFamilies);
  }
  const uniqueKeys = [...new Set(familyKeys)];
  if (!uniqueKeys.length) return "9999";

  return uniqueKeys
    .map((key) => {
      const positions = key
        .split("|")
        .map((id) => indexById.get(id))
        .filter((index) => Number.isFinite(index))
        .sort((a, b) => a - b);
      return `${positions.map((position) => String(position).padStart(4, "0")).join(".")}|${key}`;
    })
    .sort()[0]
    .split("|")[0];
}

function validIds(ids, byId) {
  return [...new Set((ids || []).filter((id) => byId.has(id) && id))];
}

function unionFind(ids) {
  const parent = new Map(ids.map((id) => [id, id]));
  const find = (id) => {
    let current = id;
    while (parent.get(current) !== current) {
      parent.set(current, parent.get(parent.get(current)));
      current = parent.get(current);
    }
    return current;
  };
  const union = (a, b) => {
    const left = find(a);
    const right = find(b);
    if (left !== right) parent.set(right, left);
  };
  return { find, union };
}

function fullChildrenMap(people) {
  const map = new Map();
  for (const person of people) {
    for (const parentId of person.parentIds || []) {
      if (!map.has(parentId)) map.set(parentId, []);
      map.get(parentId).push(person.id);
    }
  }
  return map;
}

function parentGroupsFor(person, byId) {
  const groups = (person.parentFamilies || [])
    .map((family) => validIds(family.partner_ids, byId).sort())
    .filter((parents) => parents.length);
  if (groups.length) return groups;
  const fallback = validIds(person.parentIds, byId).sort();
  return fallback.length ? [fallback] : [];
}

function descendantsOf(id, childrenMap, acc = new Set()) {
  for (const childId of childrenMap.get(id) || []) {
    if (acc.has(childId)) continue;
    acc.add(childId);
    descendantsOf(childId, childrenMap, acc);
  }
  return acc;
}

function buildUnits(people) {
  const byId = new Map(people.map((person) => [person.id, person]));
  const indexById = new Map(people.map((person, index) => [person.id, index]));
  const uf = unionFind(people.map((person) => person.id));

  // Treat the relationship as undirected. Older records can contain only one
  // side of a spouse link, but the visual relationship is still a couple.
  for (const person of people) {
    for (const spouseId of validIds(person.spouseIds, byId)) uf.union(person.id, spouseId);
  }

  const membersByRoot = new Map();
  for (const person of people) {
    const root = uf.find(person.id);
    if (!membersByRoot.has(root)) membersByRoot.set(root, []);
    membersByRoot.get(root).push(person);
  }

  const units = new Map();
  const unitByPerson = new Map();
  for (const members of membersByRoot.values()) {
    members.sort((a, b) => stableKey(a, indexById).localeCompare(stableKey(b, indexById)));
    const id = members[0].id;
    units.set(id, {
      id,
      members,
      parentUnits: new Set(),
      childUnits: new Set(),
      memberParents: new Map(),
      memberParentFamilies: new Map(),
    });
    for (const person of members) unitByPerson.set(person.id, id);
  }

  for (const unit of units.values()) {
    for (const person of unit.members) {
      const parentUnits = new Set();
      for (const parentGroup of parentGroupsFor(person, byId)) {
        const familyKey = parentGroup.join("|");
        for (const parentId of parentGroup) {
          const parentUnitId = unitByPerson.get(parentId);
          if (!parentUnitId || parentUnitId === unit.id) continue;
          parentUnits.add(parentUnitId);
          units.get(parentUnitId).childUnits.add(unit.id);
          unit.parentUnits.add(parentUnitId);
          if (!unit.memberParentFamilies.has(person.id)) {
            unit.memberParentFamilies.set(person.id, new Map());
          }
          const familyMap = unit.memberParentFamilies.get(person.id);
          if (!familyMap.has(parentUnitId)) familyMap.set(parentUnitId, new Set());
          familyMap.get(parentUnitId).add(familyKey);
        }
      }
      unit.memberParents.set(person.id, parentUnits);
    }
  }

  return { units, unitByPerson, byId, indexById };
}

function assignGenerations(units) {
  const generation = new Map();
  const visiting = new Set();

  // Longest-path generation is stable when a child has one or two parents.
  // The cycle guard prevents malformed data from making the UI recurse
  // forever; malformed cycles are placed as close to their oldest reachable
  // generation as possible.
  const depthOf = (unitId) => {
    if (generation.has(unitId)) return generation.get(unitId);
    if (visiting.has(unitId)) return 0;
    visiting.add(unitId);
    const unit = units.get(unitId);
    const parents = [...(unit?.parentUnits || [])];
    const depth = parents.length ? Math.max(...parents.map((id) => depthOf(id) + 1)) : 0;
    visiting.delete(unitId);
    generation.set(unitId, depth);
    return depth;
  };

  for (const unitId of units.keys()) depthOf(unitId);
  return generation;
}

function orderUnits(units, generation, indexById) {
  // A child couple has a meaningful left/right member order. Carry that
  // order back up to the parent units so the parents of the left partner stay
  // on the left and the parents of the right partner stay on the right,
  // regardless of the names or insertion order of those parents.
  const branchMemo = new Map();
  const branchVisiting = new Set();
  const branchKey = (unitId) => {
    if (branchMemo.has(unitId)) return branchMemo.get(unitId);
    if (branchVisiting.has(unitId)) return "";
    branchVisiting.add(unitId);
    const unit = units.get(unitId);
    const childKeys = [...(unit?.childUnits || [])].map((childId) => {
      const child = units.get(childId);
      const side = child?.members.findIndex((member) => child.memberParents.get(member.id)?.has(unitId));
      return `${familyKeyForParentUnit(unit, unitId, indexById)}|${childKeyForParentUnit(child, unitId, indexById)}|${String(Math.max(side ?? 0, 0)).padStart(3, "0")}|${branchKey(childId)}`;
    });
    branchVisiting.delete(unitId);
    const key = childKeys.sort()[0] || stableKey(unit.members[0], indexById);
    branchMemo.set(unitId, key);
    return key;
  };

  const roots = [...units.values()]
    .filter((unit) => unit.parentUnits.size === 0)
    .sort((a, b) => branchKey(a.id).localeCompare(branchKey(b.id)));
  const order = new Map();
  let next = 0;
  const seen = new Set();

  const visit = (unitId) => {
    if (seen.has(unitId)) return;
    seen.add(unitId);
    order.set(unitId, next++);
    const unit = units.get(unitId);
    const children = [...(unit?.childUnits || [])];
    const referenceCouple = children
      .map((childId) => units.get(childId))
      .find((child) =>
        child?.members.length > 1 &&
        child.members.some((member) => child.memberParents.get(member.id)?.has(unitId))
      );
    const referenceSide = referenceCouple
      ? referenceCouple.members.findIndex((member) => referenceCouple.memberParents.get(member.id)?.has(unitId))
      : -1;
    const referenceFamilyKeys = referenceCouple
      ? new Set(
          referenceCouple.members.flatMap(
            (member) => referenceCouple.memberParentFamilies.get(member.id)?.get(unitId) || []
          )
        )
      : new Set();
    const childFamilyKeys = new Set(
      children.flatMap((childId) => {
        const child = units.get(childId);
        return child.members.flatMap(
          (member) => child.memberParentFamilies.get(member.id)?.get(unitId) || []
        );
      })
    );

    children.sort((a, b) => {
      // If this parent unit is the left partner's parent, siblings belong
      // before the couple. If it is the right partner's parent, siblings
      // belong after the couple. This prevents a sibling of babu from being
      // laid out on shubha's side merely because babu and shubha are a
      // contracted partner unit.
      if (
        referenceCouple &&
        referenceFamilyKeys.size === 1 &&
        childFamilyKeys.size === 1 &&
        (a === referenceCouple.id || b === referenceCouple.id)
      ) {
        if (a === referenceCouple.id) return referenceSide === 0 ? 1 : -1;
        if (b === referenceCouple.id) return referenceSide === 0 ? -1 : 1;
      }
      const ga = generation.get(a);
      const gb = generation.get(b);
      if (ga !== gb) return ga - gb;
      return `${familyKeyForParentUnit(units.get(a), unitId, indexById)}|${childKeyForParentUnit(units.get(a), unitId, indexById)}`
        .localeCompare(
          `${familyKeyForParentUnit(units.get(b), unitId, indexById)}|${childKeyForParentUnit(units.get(b), unitId, indexById)}`
        );
    });
    children.forEach(visit);
  };

  roots.forEach((unit) => visit(unit.id));
  // Covers disconnected components and the safe fallback for a cyclic record.
  [...units.values()]
    .sort((a, b) => branchKey(a.id).localeCompare(branchKey(b.id)))
    .forEach((unit) => visit(unit.id));

  return order;
}

function unitWidth(unit) {
  return Math.max(CARD_WIDTH, (unit.members.length - 1) * PERSON_PITCH + CARD_WIDTH);
}

function placeRow(units, desired, current) {
  if (!units.length) return;

  const positions = units.map((unit) => desired.get(unit.id) ?? current.get(unit.id) ?? 0);
  const widths = units.map(unitWidth);

  // Push colliding blocks apart symmetrically. Keeping the correction
  // symmetric is important: two children of one couple remain centred under
  // that couple instead of drifting to the right.
  for (let pass = 0; pass < units.length * 3 + 3; pass += 1) {
    let changed = false;
    for (let i = 1; i < positions.length; i += 1) {
      const minDistance = (widths[i - 1] + widths[i]) / 2 + UNIT_GAP;
      const distance = positions[i] - positions[i - 1];
      if (distance < minDistance) {
        const correction = (minDistance - distance) / 2;
        positions[i - 1] -= correction;
        positions[i] += correction;
        changed = true;
      }
    }
    if (!changed) break;
  }

  const minLeft = Math.min(...positions.map((center, index) => center - widths[index] / 2));
  const shift = Math.max(24 - minLeft, 0);
  units.forEach((unit, index) => current.set(unit.id, positions[index] + shift));
}

function layoutUnitCenters(units, generation, order) {
  const rows = new Map();
  for (const unit of units.values()) {
    if (!rows.has(generation.get(unit.id))) rows.set(generation.get(unit.id), []);
    rows.get(generation.get(unit.id)).push(unit);
  }
  for (const row of rows.values()) row.sort((a, b) => order.get(a.id) - order.get(b.id));

  const centers = new Map();
  for (const row of rows.values()) {
    let cursor = 24;
    for (const unit of row) {
      const width = unitWidth(unit);
      centers.set(unit.id, cursor + width / 2);
      cursor += width + UNIT_GAP;
    }
  }

  // Relax parent/child alignment without ever allowing cards to overlap.
  // Repeating from both directions handles a couple whose two partners have
  // parents on different sides, as well as sibling rows with different widths.
  const maxGeneration = Math.max(...rows.keys(), 0);
  for (let pass = 0; pass < 14; pass += 1) {
    for (let g = 0; g <= maxGeneration; g += 1) {
      const row = rows.get(g) || [];
      const desired = new Map();
      for (const unit of row) {
        const parentCenters = [...unit.parentUnits]
          .map((id) => centers.get(id))
          .filter((value) => Number.isFinite(value));
        const childCenters = [...unit.childUnits]
          .map((id) => centers.get(id))
          .filter((value) => Number.isFinite(value));
        const neighbours = parentCenters.length ? parentCenters : childCenters;
        if (neighbours.length) {
          const target = neighbours.reduce((sum, value) => sum + value, 0) / neighbours.length;
          desired.set(unit.id, (centers.get(unit.id) + target * 3) / 4);
        }
      }
      placeRow(row, desired, centers);
    }
    for (let g = maxGeneration; g >= 0; g -= 1) {
      const row = rows.get(g) || [];
      const desired = new Map();
      for (const unit of row) {
        const childCenters = [...unit.childUnits]
          .map((id) => centers.get(id))
          .filter((value) => Number.isFinite(value));
        if (childCenters.length) {
          const target = childCenters.reduce((sum, value) => sum + value, 0) / childCenters.length;
          desired.set(unit.id, (centers.get(unit.id) + target * 2) / 3);
        }
      }
      placeRow(row, desired, centers);
    }
  }

  return { rows, centers };
}

function makeRows(units, generation, order, centers) {
  const rowNumbers = [...new Set([...units.values()].map((unit) => generation.get(unit.id)))].sort((a, b) => a - b);
  return rowNumbers.map((generationNumber) => {
    const rowUnits = [...units.values()]
      .filter((unit) => generation.get(unit.id) === generationNumber)
      .sort((a, b) => centers.get(a.id) - centers.get(b.id) || order.get(a.id) - order.get(b.id));
    const people = [];
    for (const unit of rowUnits) {
      const center = centers.get(unit.id);
      const totalWidth = (unit.members.length - 1) * PERSON_PITCH;
      unit.members.forEach((person, index) => {
        people.push({
          person,
          slot: (center - totalWidth / 2) / PERSON_PITCH,
          x: center - totalWidth / 2 + index * PERSON_PITCH - CARD_WIDTH / 2,
          unitId: unit.id,
        });
      });
    }
    return {
      generation: generationNumber,
      people,
      componentIndex: 0,
      firstInComponent: false,
      label: "Family branch",
    };
  });
}

function makeEdges(people, byId) {
  const familyGroups = new Map();
  for (const person of people) {
    for (const parents of parentGroupsFor(person, byId)) {
      const key = parents.join("|");
      if (!familyGroups.has(key)) familyGroups.set(key, { parents, children: [] });
      familyGroups.get(key).children.push(person.id);
    }
  }

  const edges = [...familyGroups.values()].map((family) => ({
    type: "family-child",
    parents: family.parents,
    children: family.children,
    familyKey: family.parents.join("|"),
  }));

  const seenSpousePairs = new Set();
  for (const person of people) {
    for (const spouseId of validIds(person.spouseIds, byId)) {
      const pairKey = [person.id, spouseId].sort().join("|");
      if (seenSpousePairs.has(pairKey)) continue;
      seenSpousePairs.add(pairKey);
      edges.push({ type: "spouse", from: person.id, to: spouseId });
    }
  }
  return edges;
}

export function computeLayout(allPeople, collapsedFamilyKeys = new Set()) {
  if (!allPeople.length) return { rows: [], edges: [], childrenCount: new Map(), layoutColumns: 1, layoutWidth: 760 };

  const childrenMapFull = fullChildrenMap(allPeople);
  const childrenCount = new Map(
    allPeople.map((person) => [person.id, (childrenMapFull.get(person.id) || []).length])
  );
  const hidden = new Set();
  const allById = new Map(allPeople.map((person) => [person.id, person]));
  const familyChildren = new Map();
  for (const person of allPeople) {
    for (const parents of parentGroupsFor(person, allById)) {
      const key = parents.join("|");
      if (!familyChildren.has(key)) familyChildren.set(key, []);
      familyChildren.get(key).push(person.id);
    }
  }
  for (const familyKey of collapsedFamilyKeys) {
    for (const childId of familyChildren.get(familyKey) || []) {
      hidden.add(childId);
      descendantsOf(childId, childrenMapFull).forEach((descendantId) => hidden.add(descendantId));
    }
  }
  const people = hidden.size ? allPeople.filter((person) => !hidden.has(person.id)) : allPeople;
  if (!people.length) return { rows: [], edges: [], childrenCount, layoutColumns: 1, layoutWidth: 760 };

  const { units, byId, indexById } = buildUnits(people);
  const generation = assignGenerations(units);
  const order = orderUnits(units, generation, indexById);
  const { rows, centers } = layoutUnitCenters(units, generation, order);
  const positionedRows = makeRows(units, generation, order, centers);
  const maxRight = Math.max(
    760,
    ...positionedRows.flatMap((row) => row.people.map((entry) => entry.x + CARD_WIDTH))
  );

  // Generation is returned for relationship/debug consumers and keeps the
  // public shape of the previous layout.
  const personGeneration = new Map();
  for (const unit of units.values()) {
    for (const person of unit.members) personGeneration.set(person.id, generation.get(unit.id));
  }

  return {
    rows: positionedRows,
    edges: makeEdges(people, byId),
    generation: personGeneration,
    childrenCount,
    layoutColumns: Math.ceil(maxRight / PERSON_PITCH),
    layoutWidth: maxRight + 24,
  };
}

// Ancestor chain (parents, grandparents, ...) for a person, walking every
// parentIds branch. Used to auto-expand collapsed branches when a search match
// is hiding behind them.
export function ancestorsOf(id, people) {
  const byId = new Map(people.map((person) => [person.id, person]));
  const acc = new Set();
  const queue = [id];
  while (queue.length) {
    const current = byId.get(queue.shift());
    if (!current) continue;
    for (const parentId of current.parentIds || []) {
      if (acc.has(parentId)) continue;
      acc.add(parentId);
      queue.push(parentId);
    }
  }
  return acc;
}