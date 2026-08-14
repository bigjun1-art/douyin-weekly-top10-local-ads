import assert from "node:assert/strict";

export function videoId(row) {
  return String(row?.video?.itemId ?? row?.itemId ?? row?.aweme_item_id ?? "");
}

export function candidateKey(row) {
  return `${String(row?.creatorId ?? "")}|${String(row?.publish ?? "")}`;
}

export function assertCandidate(row) {
  assert(row && Number.isFinite(Number(row.rank)), "candidate rank is required");
  assert(String(row.creatorId || ""), `creatorId is required at rank ${row.rank}`);
  assert(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(String(row.publish || "")), `publish minute is invalid at rank ${row.rank}`);
  assert(!/职人|店员/.test(String(row.role || "")), `staff candidate leaked at rank ${row.rank}`);
}

export function selectRankedSet(queue, count, blockedIds, selectedIds = new Set()) {
  const chosen = [];
  const skipped = [];
  const seen = new Set();
  for (const row of queue) {
    assertCandidate(row);
    if (chosen.length >= count) break;
    const id = videoId(row);
    let reason = "";
    if (!id) reason = row.reason || "unresolved";
    else if (row.canDelivery === false || row.video?.canDelivery === false) reason = "not_deliverable";
    else if ((row.invalidDeliveryCodes || row.video?.invalidDeliveryCodes || []).length) reason = "invalid_delivery";
    else if (blockedIds.has(id)) reason = "protected_previous_window";
    else if (selectedIds.has(id)) reason = "gmv_vv_duplicate";
    else if (seen.has(id)) reason = "queue_duplicate";
    if (reason) {
      skipped.push({ rank: row.rank, creatorId: row.creatorId, publish: row.publish, id, reason });
      continue;
    }
    seen.add(id);
    selectedIds.add(id);
    chosen.push(row);
  }
  assert.equal(chosen.length, count, `insufficient eligible videos: expected ${count}, got ${chosen.length}`);
  return { chosen, skipped };
}

export function selectTargetWindow({ gmvQueue, vvQueue, count, protectedIds = [] }) {
  const blocked = new Set(protectedIds.map(String));
  const selected = new Set();
  const gmv = selectRankedSet(gmvQueue, count, blocked, selected);
  const vv = selectRankedSet(vvQueue, count, blocked, selected);
  return {
    gmv: gmv.chosen,
    vv: vv.chosen,
    skipped: [...gmv.skipped, ...vv.skipped],
    ids: { gmv: gmv.chosen.map(videoId), vv: vv.chosen.map(videoId) },
  };
}

export function toVideoMaterial(row) {
  const v = row.video || row;
  const image = v.imageUrl || {};
  const poster = image.urlList?.[0] || "";
  assert(v.itemId && v.videoId && v.title != null && image.uri && poster, `incomplete material ${String(v.itemId || "")}`);
  return {
    ImageMode: v.imageMode || 15,
    AwemeItemId: String(v.itemId),
    ItemSource: 1,
    IsExtendedRootPoi: Boolean(v.isExtendedRootPoi),
    VideoInfo: {
      VideoId: String(v.videoId), Vid: String(v.videoId), Width: v.width, Height: v.height,
      ThumbWidth: v.width, ThumbHeight: v.height, CoverUri: image.uri,
      Duration: v.duration, VideoName: String(v.title), VideoPoster: poster,
    },
    ImageInfo: { WebUri: image.uri, SignUrl: poster, Width: v.width, Height: v.height },
    CoverSource: v.coverSource ?? 1,
  };
}

export function toTitleMaterial(row, index) {
  const v = row.video || row;
  return { Title: String(v.title || ""), AwemeItemId: String(v.itemId), ItemSource: 1, VideoIdxRef: String(index) };
}

function entriesOf(payload) {
  return Object.values(payload?.multiAdProxy?.promotionUpdateInfo || {});
}

function promotionId(entry) {
  const p = entry?.promotionUpdateInfo || {};
  return String(p.Id ?? p.ID ?? p.id ?? "");
}

function setAtPath(object, path, value) {
  assert(Array.isArray(path) && path.length, "projectNamePath must be a non-empty array");
  let current = object;
  for (const key of path.slice(0, -1)) {
    assert(current && Object.prototype.hasOwnProperty.call(current, key), `projectNamePath missing at ${String(key)}`);
    current = current[key];
  }
  const last = path.at(-1);
  assert(current && Object.prototype.hasOwnProperty.call(current, last), `projectNamePath missing at ${String(last)}`);
  current[last] = value;
}

export function mutateUpdatePayload(payload, { projectName, currentProjectName, projectNamePath, units }) {
  const out = structuredClone(payload);
  assert(out?.multiAdProxy?.promotionUpdateInfo, "promotionUpdateInfo is missing");
  let renamed = false;
  if ("project_name" in out) { out.project_name = projectName; renamed = true; }
  if ("projectName" in out) { out.projectName = projectName; renamed = true; }
  if (projectNamePath) { setAtPath(out, projectNamePath, projectName); renamed = true; }
  if (!renamed && currentProjectName) {
    const walk = (node) => {
      if (!node || typeof node !== "object") return;
      for (const [key, value] of Object.entries(node)) {
        if (/name/i.test(key) && value === currentProjectName) { node[key] = projectName; renamed = true; }
        else if (value && typeof value === "object") walk(value);
      }
    };
    walk(out);
  }
  assert(renamed, "project name field was not found; supply projectNamePath");
  for (const unit of units) {
    const entry = entriesOf(out).find((x) => promotionId(x) === String(unit.promotionId));
    assert(entry, `promotion ${unit.promotionId} not found in captured payload`);
    const p = entry.promotionUpdateInfo || {};
    assert(String(p.Name ?? p.name ?? ""), `promotion ${unit.promotionId} name is missing`);
    if ("Name" in p) p.Name = unit.name; else p.name = unit.name;
    const m = entry.materialGroupUpdateInfo;
    assert(m && Array.isArray(m.VideoMaterialList) && Array.isArray(m.TitleMaterialList), `material arrays missing for ${unit.promotionId}`);
    m.VideoMaterialList = unit.rows.map(toVideoMaterial);
    m.TitleMaterialList = unit.rows.map(toTitleMaterial);
  }
  return out;
}

export function mutateCreatePayload(payload, { projectName, currentProjectName, projectNamePath, units }) {
  const out = structuredClone(payload);
  const info = out?.multiAdProxy?.promotionCreateInfo;
  assert(info && typeof info === "object", "promotionCreateInfo is missing");
  let renamed = false;
  if ("project_name" in out) { out.project_name = projectName; renamed = true; }
  if ("projectName" in out) { out.projectName = projectName; renamed = true; }
  if (projectNamePath) { setAtPath(out, projectNamePath, projectName); renamed = true; }
  if (!renamed && currentProjectName) {
    const walk = (node) => {
      if (!node || typeof node !== "object") return;
      for (const [key, value] of Object.entries(node)) {
        if (/name/i.test(key) && value === currentProjectName) { node[key] = projectName; renamed = true; }
        else if (value && typeof value === "object") walk(value);
      }
    };
    walk(out);
  }
  assert(renamed, "project name field was not found; supply projectNamePath");
  const entries = Object.values(info);
  for (const unit of units) {
    const entry = entries.find((x) => {
      const p = x?.promotionCreateInfo || x || {};
      return String(p.Name ?? p.name ?? "") === String(unit.currentName || "");
    });
    assert(entry, `source create unit ${unit.currentName} not found`);
    const p = entry.promotionCreateInfo || entry;
    if ("Name" in p) p.Name = unit.name; else p.name = unit.name;
    const m = entry.materialGroupCreateInfo || p.materialGroupCreateInfo;
    assert(m && Array.isArray(m.VideoMaterialList) && Array.isArray(m.TitleMaterialList), `create material arrays missing for ${unit.currentName}`);
    m.VideoMaterialList = unit.rows.map(toVideoMaterial);
    m.TitleMaterialList = unit.rows.map(toTitleMaterial);
  }
  return out;
}

export function verifyReadback(rows, expectedUnits) {
  const expected = new Map(expectedUnits.map((x) => [String(x.promotionId), x]));
  const global = new Set();
  const report = [];
  for (const row of rows) {
    const exp = expected.get(String(row.id));
    assert(exp, `unexpected readback promotion ${row.id}`);
    const ids = (row.ids || []).map(String);
    assert.equal(row.name, exp.name, `unit name mismatch ${row.id}`);
    assert.equal(row.projectName, exp.projectName, `project name mismatch ${row.id}`);
    assert.equal(ids.length, exp.rows.length, `material count mismatch ${row.id}`);
    assert.deepEqual(new Set(ids), new Set(exp.rows.map(videoId)), `material ids mismatch ${row.id}`);
    for (const id of ids) {
      assert(!global.has(id), `cross-unit duplicate ${id}`);
      global.add(id);
    }
    report.push({ id: String(row.id), name: row.name, count: ids.length });
  }
  assert.equal(report.length, expected.size, "readback unit count mismatch");
  return { verified: true, units: report, uniqueVideoCount: global.size };
}
