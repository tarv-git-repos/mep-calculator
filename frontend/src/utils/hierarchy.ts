export function deduplicateHierarchyByEmail(members: any[]): any[] {
  if (!Array.isArray(members)) return [];
  const seenEmails = new Set<string>();
  const seenIds = new Set<string>();
  const result: any[] = [];

  for (const m of members) {
    if (!m) continue;
    const email = String(m.email || "").toLowerCase().trim();
    const id = String(m.id || "").toLowerCase().trim();

    if (email && seenEmails.has(email)) {
      continue; // Skip duplicate email
    }
    if (id && seenIds.has(id)) {
      continue; // Skip duplicate ID
    }

    if (email) seenEmails.add(email);
    if (id) seenIds.add(id);
    result.push(m);
  }

  return result;
}

export function getEffectiveOrgId(userData?: any, profile?: any): string {
  const ap = profile || userData || {};
  let orgVal = ap.organization_id || ap.organization || ap.company ||
               ap.features?.organization_id || ap.features?.organization || ap.features?.company;
  if (!orgVal && typeof window !== "undefined") {
    try {
      const storedP = localStorage.getItem('mep_profile');
      const storedU = localStorage.getItem('mep_user_data');
      if (storedP) {
        const p = JSON.parse(storedP);
        orgVal = p.organization_id || p.organization || p.company || p.features?.organization_id || p.features?.organization || p.features?.company;
      }
      if (!orgVal && storedU) {
        const u = JSON.parse(storedU);
        orgVal = u.organization_id || u.organization || u.company || u.features?.organization_id || u.features?.organization || u.features?.company;
      }
    } catch (e) {}
  }
  const clean = String(orgVal || "default_org").toLowerCase().trim().replace(/[^a-z0-9_-]/g, "_");
  return clean;
}

export function getOrgHierarchyStorageKey(userData?: any, profile?: any): string {
  const orgId = getEffectiveOrgId(userData, profile);
  return `mep_company_hierarchy_${orgId}`;
}

export function loadOrgHierarchyFromStorage(userData?: any, profile?: any): any[] | null {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return null;
  const key = getOrgHierarchyStorageKey(userData, profile);
  try {
    const saved = localStorage.getItem(key);
    if (saved) return deduplicateHierarchyByEmail(JSON.parse(saved));
    const fallback = localStorage.getItem("mep_company_hierarchy");
    if (fallback) return deduplicateHierarchyByEmail(JSON.parse(fallback));
  } catch (e) {}
  return null;
}

export function saveOrgHierarchyToStorage(members: any[], userData?: any, profile?: any) {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return;
  const key = getOrgHierarchyStorageKey(userData, profile);
  try {
    const cleanMembers = deduplicateHierarchyByEmail(members);
    const json = JSON.stringify(cleanMembers);
    localStorage.setItem(key, json);
    localStorage.setItem("mep_company_hierarchy", json);
  } catch (e) {}
}

export function getMemberParentIds(member: any): string[] {
  if (!member) return [];
  if (Array.isArray(member.parentIds) && member.parentIds.length > 0) {
    return Array.from(new Set(member.parentIds.map((p: any) => String(p).trim()).filter(Boolean)));
  }
  if (member.parentId) {
    return [String(member.parentId).trim()];
  }
  return [];
}

export function computeMemberLevels(members: any[]): Map<string, number> {
  const levelMap = new Map<string, number>();
  const memberMap = new Map<string, any>();
  if (!Array.isArray(members)) return levelMap;

  members.forEach((m) => {
    if (m && m.id) memberMap.set(String(m.id), m);
  });

  function getLevel(id: string, visited: Set<string>): number {
    if (levelMap.has(id)) return levelMap.get(id)!;
    if (visited.has(id)) return 0; // Avoid cycles
    visited.add(id);

    const m = memberMap.get(id);
    if (!m) return 0;

    const parentIds = getMemberParentIds(m).filter((pId) => memberMap.has(pId) && pId !== id);
    if (parentIds.length === 0) {
      levelMap.set(id, 0);
      return 0;
    }

    let maxParentLevel = -1;
    for (const pId of parentIds) {
      const pLvl = getLevel(pId, new Set(visited));
      if (pLvl > maxParentLevel) {
        maxParentLevel = pLvl;
      }
    }

    const myLevel = maxParentLevel + 1;
    levelMap.set(id, myLevel);
    return myLevel;
  }

  members.forEach((m) => {
    if (m && m.id) getLevel(String(m.id), new Set());
  });

  return levelMap;
}


