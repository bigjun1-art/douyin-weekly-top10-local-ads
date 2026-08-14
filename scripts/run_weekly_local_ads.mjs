#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { mutateCreatePayload, mutateUpdatePayload, selectTargetWindow, verifyReadback } from "./weekly_core.mjs";

const EVAL = fileURLToPath(new URL("./applescript_eval.sh", import.meta.url));
const SELF_TEST = fileURLToPath(new URL("./self_test.mjs", import.meta.url));

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const out = { timeout: 45, dryRun: true };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--self-test") out.selfTest = true;
    else if (argv[i] === "--execute") out.dryRun = false;
    else if (argv[i] === "--dry-run") out.dryRun = true;
    else if (argv[i] === "--config") out.config = argv[++i];
    else if (argv[i] === "--timeout") out.timeout = Number(argv[++i]);
    else fail(`unknown argument ${argv[i]}`);
  }
  if (!out.selfTest && !out.config) fail("--config is required");
  if (!Number.isFinite(out.timeout) || out.timeout < 10) fail("--timeout must be at least 10 seconds");
  return out;
}

function validateConfig(cfg) {
  assert(["create", "update"].includes(cfg.operation), "operation must be create or update");
  assert(/^\d+$/.test(String(cfg.advertiserId || "")), "advertiserId must be numeric");
  assert(/^\d{8}$/.test(String(cfg.businessDate || "")), "businessDate must be YYYYMMDD");
  assert(Number.isInteger(cfg.rankStart) && Number.isInteger(cfg.rankEnd) && cfg.rankEnd >= cfg.rankStart, "invalid rank window");
  assert(Number.isInteger(cfg.targetCount) && cfg.targetCount > 0, "targetCount must be positive");
  assert(Array.isArray(cfg.rankings?.gmv) && Array.isArray(cfg.rankings?.vv), "rankings.gmv/vv are required");
  assert(Array.isArray(cfg.units) && cfg.units.length === 2, "exactly two target units are required");
  assert(cfg.units.map((x) => x.metric).sort().join(",") === "gmv,vv", "units must contain gmv and vv");
  assert(cfg.projectName === `${cfg.businessDate}_门店浏览_gmv-vv-${cfg.rankStart}-${cfg.rankEnd}`, "projectName does not match date/window");
  assert(String(cfg.currentProjectName || ""), "currentProjectName is required");
  for (const unit of cfg.units) {
    if (cfg.operation === "update") assert(/^\d+$/.test(String(unit.promotionId || "")), `invalid promotionId for ${unit.metric}`);
    if (cfg.operation === "create") assert(String(unit.currentName || ""), `currentName is required for ${unit.metric}`);
    assert(unit.name === `${cfg.businessDate}_周${unit.metric}-top${cfg.rankStart === 1 && cfg.rankEnd === 10 ? "10" : `${cfg.rankStart}-${cfg.rankEnd}`}`, `unit name mismatch for ${unit.metric}`);
  }
  assert(Array.isArray(cfg.protectedPromotionIds), "protectedPromotionIds must be an array");
  assert(cfg.tab?.pathContains && /^\/[^\s]*$/.test(cfg.tab.pathContains), "tab.pathContains is required");
  if (cfg.requestBody == null) assert(cfg.captureButtonText || "保存投放", "captureButtonText is required");
  return cfg;
}

function appleEval(cfg, code) {
  const raw = execFileSync(EVAL, [
    "--host", "localads.chengzijianzhan.cn",
    "--identity-key", "advid",
    "--identity-value", String(cfg.advertiserId),
    "--path-contains", cfg.tab.pathContains,
    "--code", code,
  ], { encoding: "utf8", maxBuffer: 24 * 1024 * 1024 }).trim();
  const parsed = JSON.parse(raw);
  if (!parsed.ok) throw new Error(parsed.error || "AppleScript evaluation failed");
  return parsed.result;
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function storeLarge(cfg, key, value) {
  const text = JSON.stringify(value);
  appleEval(cfg, `localStorage.setItem(${JSON.stringify(key)},"");({stored:0})`);
  for (let offset = 0; offset < text.length; offset += 24000) {
    const chunk = text.slice(offset, offset + 24000);
    appleEval(cfg, `(()=>{const k=${JSON.stringify(key)};localStorage.setItem(k,(localStorage.getItem(k)||"")+${JSON.stringify(chunk)});return {stored:(localStorage.getItem(k)||"").length}})()`);
  }
}

function readLarge(cfg, key) {
  const length = Number(appleEval(cfg, `(localStorage.getItem(${JSON.stringify(key)})||"").length`));
  assert(length > 0, `browser value ${key} is empty`);
  let text = "";
  for (let offset = 0; offset < length; offset += 24000) {
    text += String(appleEval(cfg, `(localStorage.getItem(${JSON.stringify(key)})||"").slice(${offset},${offset + 24000})`));
  }
  return JSON.parse(text);
}

function poll(cfg, stateKey, timeoutSeconds) {
  const deadline = Date.now() + timeoutSeconds * 1000;
  let state;
  while (Date.now() < deadline) {
    sleep(350);
    state = appleEval(cfg, `window[${JSON.stringify(stateKey)}]`);
    if (state?.status === "done") return state.result;
    if (state?.status === "error") throw new Error(state.error || "browser job failed");
  }
  throw new Error(`browser job timed out; last=${JSON.stringify(state)}`);
}

function browserCaptureJob(args) {
  const { configKey, capturedKey, stateKey } = args;
  const cfg = JSON.parse(localStorage.getItem(configKey) || "null");
  window[stateKey] = { status: "running" };
  (async () => {
    const check = (ok, message) => { if (!ok) throw new Error(message); };
    check(location.origin === "https://localads.chengzijianzhan.cn", "ORIGIN_MISMATCH");
    check(new URL(location.href).searchParams.get("advid") === String(cfg.advertiserId), "ADVERTISER_MISMATCH");
    const detail = async (id) => {
      const r = await fetch(`/api/lamp/pc/v2/superior/ad/promotion/detail?advid=${cfg.advertiserId}&promotion_id=${id}`, { credentials: "include" });
      const j = await r.json();
      check(r.ok && Number(j.code ?? j.status_code) === 0, `DETAIL_FAILED ${id}`);
      const row = j.data?.[String(id)];
      check(row && String(row.id) === String(id), `DETAIL_ID_MISMATCH ${id}`);
      return {
        id: String(id), name: String(row.name || ""), projectId: String(row.project_id || ""),
        ids: (row.material_group?.video_material_info || []).map((x) => String(x.aweme_item_id || "")).filter(Boolean),
        editVersion: row.edit_version ?? row.modify_time ?? null,
      };
    };
    const targetIds = cfg.operation === "update" ? cfg.units.map((x) => String(x.promotionId)) : [];
    const ids = [...new Set([...targetIds, ...cfg.protectedPromotionIds.map(String)])];
    const before = [];
    for (const id of ids) before.push(await detail(id));
    for (const unit of cfg.units) {
      if (cfg.operation !== "update") continue;
      const row = before.find((x) => x.id === String(unit.promotionId));
      check(row && (!unit.currentName || row.name === unit.currentName), `TARGET_NAME_MISMATCH ${unit.promotionId}`);
    }
    if (localStorage.getItem(capturedKey)) {
      window[stateKey] = { status: "done", result: { before, captured: false, supplied: true } };
      return;
    }

    const restore = [];
    const install = (w) => {
      try {
        if (!w || typeof w.fetch !== "function" || w.__weeklyCaptureInstalled) return;
        const originalFunction = w.fetch;
        const original = w.fetch.bind(w);
        w.__weeklyCaptureInstalled = true;
        w.fetch = async function(input, init = {}) {
          const url = String(input?.url || input || "");
          const expected = cfg.operation === "create" ? "createPromote" : "updatePromote";
          if (new RegExp(`/api/lamp/pc/v2/ad/${expected}(?:\\?|$)`).test(url)) {
            let body = init?.body;
            if (body == null && input && typeof input.clone === "function") body = await input.clone().text();
            if (typeof body !== "string") body = JSON.stringify(body);
            const parsed = JSON.parse(body || "null");
            localStorage.setItem(capturedKey, JSON.stringify({ url: new URL(url, location.origin).pathname + new URL(url, location.origin).search, body: parsed }));
            return new w.Response(JSON.stringify({ status_code: 0, message: "captured_without_submit", data: {} }), { status: 200, headers: { "content-type": "application/json" } });
          }
          return original(input, init);
        };
        restore.push(() => { w.fetch = originalFunction; delete w.__weeklyCaptureInstalled; });
      } catch (_) {}
    };
    install(window);
    for (const frame of document.querySelectorAll("iframe")) { try { install(frame.contentWindow); } catch (_) {} }
    const text = String(cfg.captureButtonText || "保存投放");
    const buttons = [...document.querySelectorAll("button")].filter((b) => (b.innerText || "").trim() === text && !b.disabled && b.getClientRects().length);
    check(buttons.length === 1, `SAVE_BUTTON_NOT_UNIQUE count=${buttons.length}`);
    buttons[0].click();
    for (let i = 0; i < 40 && !localStorage.getItem(capturedKey); i += 1) await new Promise((resolve) => setTimeout(resolve, 200));
    for (const fn of restore) fn();
    check(Boolean(localStorage.getItem(capturedKey)), "UPDATE_CAPTURE_MISSING");
    window[stateKey] = { status: "done", result: { before, captured: true, supplied: false } };
  })().catch((error) => { window[stateKey] = { status: "error", error: String(error?.stack || error) }; });
  return { started: true, stateKey };
}

function browserSubmitJob(args) {
  const { configKey, mutationKey, stateKey, dryRun } = args;
  const cfg = JSON.parse(localStorage.getItem(configKey) || "null");
  const mutation = JSON.parse(localStorage.getItem(mutationKey) || "null");
  window[stateKey] = { status: "running" };
  (async () => {
    const check = (ok, message) => { if (!ok) throw new Error(message); };
    const getDetail = async (id) => {
      const r = await fetch(`/api/lamp/pc/v2/superior/ad/promotion/detail?advid=${cfg.advertiserId}&promotion_id=${id}`, { credentials: "include", cache: "no-store" });
      const j = await r.json();
      check(r.ok && Number(j.code ?? j.status_code) === 0, `DETAIL_FAILED ${id}`);
      const row = j.data?.[String(id)];
      check(row, `DETAIL_EMPTY ${id}`);
      return {
        id: String(id), name: String(row.name || ""), projectId: String(row.project_id || ""),
        ids: (row.material_group?.video_material_info || []).map((x) => String(x.aweme_item_id || "")).filter(Boolean),
      };
    };
    if (dryRun) {
      window[stateKey] = { status: "done", result: { dryRun: true, submitted: false } };
      return;
    }
    const response = await fetch(mutation.url, {
      method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify(mutation.body),
    });
    const json = await response.json().catch(() => null);
    check(response.ok && Number(json?.status_code ?? json?.code) === 0, `UPDATE_FAILED HTTP=${response.status} body=${JSON.stringify(json)}`);
    const collectIds = (node, pattern, out = []) => {
      if (!node || typeof node !== "object") return out;
      for (const [key, value] of Object.entries(node)) {
        if (pattern.test(key)) {
          if (Array.isArray(value)) {
            for (const item of value) if (/^\d+$/.test(String(item))) out.push(String(item));
          } else if (/^\d+$/.test(String(value))) {
            out.push(String(value));
          }
        }
        if (value && typeof value === "object") collectIds(value, pattern, out);
      }
      return [...new Set(out)];
    };
    const promotionIds = cfg.operation === "create"
      ? collectIds(json, /promotion.*id|promotionids/i).slice(0, cfg.units.length)
      : cfg.units.map((x) => String(x.promotionId));
    check(promotionIds.length === cfg.units.length, `PROMOTION_IDS_MISSING ${JSON.stringify(json)}`);
    let rows = [];
    for (let attempt = 1; attempt <= 8; attempt += 1) {
      rows = [];
      for (const id of promotionIds) rows.push(await getDetail(id));
      const ready = rows.every((row) => {
        const unit = cfg.operation === "create"
          ? cfg.units.find((x) => x.name === row.name)
          : cfg.units.find((x) => String(x.promotionId) === row.id);
        if (!unit) return false;
        return row.name === unit.name && row.ids.length === cfg.targetCount;
      });
      if (ready) break;
      await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
    const projectId = rows[0]?.projectId;
    check(projectId && rows.every((x) => x.projectId === projectId), "PROJECT_ID_MISMATCH");
    const pr = await fetch(`/api/lamp/pc/v2/superior/promote/projects/detail?advid=${cfg.advertiserId}&project_ids=${projectId}`, { credentials: "include", cache: "no-store" });
    const pj = await pr.json();
    check(pr.ok && Number(pj.code ?? pj.status_code) === 0, "PROJECT_DETAIL_FAILED");
    const project = pj.data?.[projectId] || pj.data?.detail || pj.data;
    const projectName = String(project?.name || project?.project_name || project?.projectName || "");
    window[stateKey] = { status: "done", result: { submitted: true, rows: rows.map((x) => ({ ...x, projectName })), projectId, projectName } };
  })().catch((error) => { window[stateKey] = { status: "error", error: String(error?.stack || error) }; });
  return { started: true, stateKey };
}

const args = parseArgs(process.argv.slice(2));
if (args.selfTest) {
  execFileSync(process.execPath, [SELF_TEST], { stdio: "inherit" });
  console.log(JSON.stringify({ ok: true, runner: "run_weekly_local_ads.mjs" }));
  process.exit(0);
}

try {
  const cfg = validateConfig(JSON.parse(fs.readFileSync(args.config, "utf8")));
  if (!args.dryRun) assert(String(cfg.confirmAdvertiserId || "") === String(cfg.advertiserId), "--execute requires config.confirmAdvertiserId matching advertiserId");
  const prefix = `__douyinWeekly_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const configKey = `${prefix}_config`;
  const capturedKey = `${prefix}_captured`;
  const mutationKey = `${prefix}_mutation`;
  const captureStateKey = `${prefix}_capture_state`;
  const submitStateKey = `${prefix}_submit_state`;
  storeLarge(cfg, configKey, cfg);
  if (cfg.requestBody) storeLarge(cfg, capturedKey, { url: cfg.requestUrl || `/api/lamp/pc/v2/ad/${cfg.operation === "create" ? "createPromote" : "updatePromote"}?advid=${cfg.advertiserId}`, body: cfg.requestBody });
  const started = appleEval(cfg, `(${browserCaptureJob.toString()})(${JSON.stringify({ configKey, capturedKey, stateKey: captureStateKey })})`);
  assert(started?.started, "capture job did not start");
  const capture = poll(cfg, captureStateKey, args.timeout);
  const captured = readLarge(cfg, capturedKey);
  const expectedEndpoint = cfg.operation === "create" ? "createPromote" : "updatePromote";
  assert(new RegExp(`/api/lamp/pc/v2/ad/${expectedEndpoint}(?:\\?|$)`).test(captured.url), `captured URL is not ${expectedEndpoint}`);
  const protectedPromotionSet = new Set(cfg.protectedPromotionIds.map(String));
  const protectedVideoIds = [
    ...(cfg.protectedVideoIds || []).map(String),
    ...capture.before.filter((row) => protectedPromotionSet.has(String(row.id))).flatMap((row) => row.ids.map(String)),
  ];
  const chosen = selectTargetWindow({
    gmvQueue: cfg.rankings.gmv,
    vvQueue: cfg.rankings.vv,
    count: cfg.targetCount,
    protectedIds: protectedVideoIds,
  });
  const units = cfg.units.map((unit) => ({ ...unit, rows: chosen[unit.metric] }));
  storeLarge(cfg, configKey, { ...cfg, units });
  const mutate = cfg.operation === "create" ? mutateCreatePayload : mutateUpdatePayload;
  const body = mutate(captured.body, {
    projectName: cfg.projectName,
    currentProjectName: cfg.currentProjectName,
    projectNamePath: cfg.projectNamePath,
    units,
  });
  storeLarge(cfg, mutationKey, { url: captured.url, body });
  const submitStarted = appleEval(cfg, `(${browserSubmitJob.toString()})(${JSON.stringify({ configKey, mutationKey, stateKey: submitStateKey, dryRun: Boolean(args.dryRun) })})`);
  assert(submitStarted?.started, "submit job did not start");
  const result = poll(cfg, submitStateKey, args.timeout);
  if (args.dryRun) {
    console.log(JSON.stringify({ ok: true, dryRun: true, capture, selection: chosen.ids, skipped: chosen.skipped }, null, 2));
  } else {
    const expectedUnits = units.map((unit) => {
      const row = cfg.operation === "create" ? result.rows.find((x) => x.name === unit.name) : null;
      return { ...unit, promotionId: row?.id || unit.promotionId, projectName: cfg.projectName };
    });
    const verified = verifyReadback(result.rows, expectedUnits);
    console.log(JSON.stringify({ ok: true, ...verified, projectId: result.projectId, projectName: result.projectName, skipped: chosen.skipped }, null, 2));
  }
  try { appleEval(cfg, `[${[configKey, capturedKey, mutationKey].map((x) => JSON.stringify(x)).join(",")}].forEach(k=>localStorage.removeItem(k));true`); } catch {}
} catch (error) {
  fail(error?.stderr?.toString() || error?.message || String(error));
}
