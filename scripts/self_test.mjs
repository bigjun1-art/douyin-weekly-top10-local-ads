#!/usr/bin/env node
import assert from "node:assert/strict";
import { mutateCreatePayload, mutateUpdatePayload, selectTargetWindow, verifyReadback, videoId } from "./weekly_core.mjs";

const raw = (rank, id, role = "达人") => ({
  rank, creatorId: `creator-${rank}`, publish: "2026-08-08 12:00", role, canDelivery: true,
  video: { itemId: id, videoId: `vid-${id}`, title: `title-${id}`, canDelivery: true, duration: 12, width: 720, height: 1280, imageUrl: { uri: `uri-${id}`, urlList: [`https://img/${id}`] } },
});

const protectedIds = ["p1", "p2"];
const gmvQueue = [raw(1, "p1"), raw(2, "g1"), raw(3, "g2"), raw(4, "g3")];
const vvQueue = [raw(1, "g1"), raw(2, "p2"), raw(3, "v1"), raw(4, "v2"), raw(5, "v3")];
const selected = selectTargetWindow({ gmvQueue, vvQueue, count: 2, protectedIds });
assert.deepEqual(selected.ids.gmv, ["g1", "g2"]);
assert.deepEqual(selected.ids.vv, ["v1", "v2"]);
assert(selected.skipped.some((x) => x.reason === "protected_previous_window"));
assert(selected.skipped.some((x) => x.reason === "gmv_vv_duplicate"));
assert.throws(() => selectTargetWindow({ gmvQueue: [raw(1, "x", "职人")], vvQueue, count: 1 }), /staff candidate leaked/);

const payload = {
  project_name: "old-project",
  untouched: { budget: 333, bid: 0.11 },
  multiAdProxy: { promotionUpdateInfo: {
    0: { promotionUpdateInfo: { Id: "gmv", Name: "old-gmv" }, materialGroupUpdateInfo: { VideoMaterialList: [], TitleMaterialList: [], Keep: 1 } },
    1: { promotionUpdateInfo: { Id: "vv", Name: "old-vv" }, materialGroupUpdateInfo: { VideoMaterialList: [], TitleMaterialList: [], Keep: 2 } },
  } },
};
const units = [
  { promotionId: "gmv", name: "20260810_周gmv-top11-20", rows: selected.gmv },
  { promotionId: "vv", name: "20260810_周vv-top11-20", rows: selected.vv },
];
const changed = mutateUpdatePayload(payload, { projectName: "20260810_门店浏览_gmv-vv-11-20", currentProjectName: "old-project", units });
assert.deepEqual(payload.untouched, changed.untouched);
assert.equal(changed.project_name, "20260810_门店浏览_gmv-vv-11-20");
assert.deepEqual(changed.multiAdProxy.promotionUpdateInfo[0].materialGroupUpdateInfo.VideoMaterialList.map((x) => x.AwemeItemId), selected.gmv.map(videoId));
assert.deepEqual(changed.multiAdProxy.promotionUpdateInfo[1].materialGroupUpdateInfo.TitleMaterialList.map((x) => x.AwemeItemId), selected.vv.map(videoId));

const createPayload = {
  project: { name: "copy-project" },
  multiAdProxy: { promotionCreateInfo: {
    0: { promotionCreateInfo: { Name: "copy-gmv" }, materialGroupCreateInfo: { VideoMaterialList: [], TitleMaterialList: [], Keep: 1 } },
    1: { promotionCreateInfo: { Name: "copy-vv" }, materialGroupCreateInfo: { VideoMaterialList: [], TitleMaterialList: [], Keep: 2 } },
  } },
};
const created = mutateCreatePayload(createPayload, {
  projectName: "20260810_门店浏览_gmv-vv-11-20", currentProjectName: "copy-project",
  units: [{ ...units[0], currentName: "copy-gmv" }, { ...units[1], currentName: "copy-vv" }],
});
assert.equal(created.project.name, "20260810_门店浏览_gmv-vv-11-20");
assert.equal(created.multiAdProxy.promotionCreateInfo[0].promotionCreateInfo.Name, units[0].name);
assert.equal(created.multiAdProxy.promotionCreateInfo[1].materialGroupCreateInfo.VideoMaterialList.length, 2);

const readback = units.map((unit) => ({
  id: unit.promotionId, name: unit.name, projectName: "20260810_门店浏览_gmv-vv-11-20", ids: unit.rows.map(videoId),
}));
assert.equal(verifyReadback(readback, units.map((x) => ({ ...x, projectName: "20260810_门店浏览_gmv-vv-11-20" }))).uniqueVideoCount, 4);
assert.throws(() => verifyReadback([{ ...readback[0], ids: ["g1", "g2"] }, { ...readback[1], ids: ["g1", "v2"] }], units.map((x) => ({ ...x, projectName: "20260810_门店浏览_gmv-vv-11-20" }))), /material ids mismatch|cross-unit duplicate/);

console.log(JSON.stringify({ ok: true, tests: ["protected-window", "gmv-first-vv-dedupe", "staff-guard", "update-mutation", "create-mutation", "readback"] }));
