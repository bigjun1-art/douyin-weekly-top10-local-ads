import assert from "node:assert/strict";
import { OPERATIONS, checkAssertions, runConfig, selfTest, parseJsonPreservingLargeIntegers, stringifyApiJson } from "./run_local_mapi.mjs";

assert.equal(selfTest().status, "ok");
assert.equal(OPERATIONS["project.create"].path, "/open_api/v3.0/local/project/create/");
assert.equal(OPERATIONS["report.material"].method, "GET");

checkAssertions({ data: { ids: [3, 2, 1] } }, [
  { type: "setEquals", path: "data.ids", expected: [1, 2, 3] }
]);

await assert.rejects(
  runConfig({ steps: [{ name: "write", operation: "project.create", body: {} }] }, { execute: false, env: {} }),
  /requires --execute/
);

await assert.rejects(
  runConfig({ steps: [{ name: "read", operation: "project.detail", query: {} }] }, { execute: false, env: {} }),
  /missing access token environment variable/
);

const exactId = "9007199254740993";
const parsed = parseJsonPreservingLargeIntegers('{"id":9007199254740993,"ids":[9007199254740993,9007199254740995],"small":123,"title":"id 9007199254740993","quoted":"\\\"9007199254740993\\\""}');
assert.equal(parsed.id, exactId);
assert.deepEqual(parsed.ids, [exactId, "9007199254740995"]);
assert.equal(parsed.small, 123);
assert.equal(parsed.title, `id ${exactId}`);
assert.equal(parsed.quoted, `"${exactId}"`);
assert.equal(stringifyApiJson({id:{$integer:exactId},handle:exactId,ids:[{$integer:exactId}]}), `{"id":${exactId},"handle":"${exactId}","ids":[${exactId}]}`);
assert.throws(() => stringifyApiJson({id:Number(exactId)}), /unsafe numeric/);
assert.throws(() => stringifyApiJson({id:{$integer:'1,"bad":2'}}), /invalid \$integer/);

const realFetch = globalThis.fetch;
const env = { OCEANENGINE_ACCESS_TOKEN: "offline-placeholder-not-a-credential" };
let calls = [];
try {
  globalThis.fetch = async (url, options) => {
    calls.push({url: String(url), options});
    return new Response(`{"code":0,"data":{"promotion_id":${exactId},"customer_material_list":[{"item_id":${exactId}}]}}`);
  };
  const full = await runConfig({steps:[{name:"get",operation:"promotion.detail",includeData:true,query:{local_account_id:123,promotion_id:{$integer:exactId},filtering:{item_ids:[{$integer:exactId}]}},assertions:[{type:"equals",path:"data.promotion_id",expected:exactId}]}]}, {env});
  assert.equal(full.status,"verified");
  assert.equal(full.steps[0].data.customer_material_list[0].item_id,exactId);
  assert.equal(new URL(calls[0].url).searchParams.get('promotion_id'),exactId);
  assert.equal(new URL(calls[0].url).searchParams.get('filtering'),`{"item_ids":[${exactId}]}`);
  const compact = await runConfig({steps:[{name:"get",operation:"promotion.detail",query:{}}]}, {env});
  assert.equal(compact.steps[0].data.promotion_id,exactId);

  calls=[];
  globalThis.fetch = async (url, options) => {
    calls.push({url:String(url),options});
    return new Response(JSON.stringify({code:0,data:{list:calls.length===1?[]:["ready"]}}));
  };
  const eventual = await runConfig({steps:[{name:"readback",operation:"promotion.detail",query:{},readbackAttempts:3,readbackDelayMs:0,assertions:[{type:"notEmpty",path:"data.list"}]}]}, {env});
  assert.equal(eventual.status,"verified");
  assert.equal(calls.length,2);
  assert(calls.every(c=>c.options.method==='GET'));

  calls=[];
  globalThis.fetch = async (url, options) => {
    calls.push({url:String(url),options});
    return new Response('{"code":0,"data":{"list":[]}}');
  };
  const exhausted=await runConfig({steps:[{name:"readback",operation:"promotion.detail",query:{},readbackAttempts:3,readbackDelayMs:0,assertions:[{type:"notEmpty",path:"data.list"}]}]}, {env});
  assert.equal(exhausted.status,"failed");
  assert.equal(calls.length,3);

  calls=[];
  globalThis.fetch = async (url, options) => {calls.push({url:String(url),options}); throw new TypeError('simulated uncertain write');};
  const failedWrite=await runConfig({steps:[{name:"create",operation:"promotion.create",body:{project_id:{$integer:exactId}}}]},{execute:true,env});
  assert.equal(failedWrite.status,"failed");
  assert.equal(calls.length,1);
  assert.equal(calls[0].options.body,`{"project_id":${exactId}}`);
  await assert.rejects(runConfig({steps:[{name:"create",operation:"promotion.create",body:{},readbackAttempts:2}]},{execute:true,env}),/POST steps/);
} finally { globalThis.fetch=realFetch; }
process.stdout.write('{"status":"ok","checks":"lossless IDs, typed integers, full data, bounded GET readback, no POST replay"}\n');
