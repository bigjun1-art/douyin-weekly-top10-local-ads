---
name: douyin-creator-material-ads
description: Create or update 巨量本地推短视频图文 plans from weekly GMV/VV rankings or Excel/XLSX creator-video tables, including grouped units within an existing project. Prefer official MAPI for material checks, project/unit writes and readback; use logged-in Chrome for source collection or diagnosed capability gaps.
---

# 抖音周榜与表格回传门店种草投放

## 后台优先与前台兜底

执行优先级：先使用已授权、可用且能精确绑定账号与页面的端口/浏览器后台连接、参数化脚本或官方接口；其次使用已登录页面的后台同源请求；仅在相关后台路径确实不可用时使用前台兜底。官方接口已满足任务时不必为端口方式额外探测。不能把“后台优先”解释为“禁止所有前台操作”。

使用已有端口连接前核对工具允许的访问方式、浏览器资料、准确 URL 和账号/计划；不盲扫端口，不自行开启调试权限，不绕过工具限制或另建登录环境。页面 JavaScript/DOM 操作与系统键鼠分开判断，正常后台执行不激活窗口。

启用前台兜底前说明后台失败的具体证据、拟操作范围与预计占用方式；当前任务已授权该兜底且工具允许时继续，不逐批重复确认。如果用户正在使用前台、明确要求本次全程后台，或工具要求额外批准，则先协调必要的前台时段/授权。优先最少量的语义操作或一次 Console 参数化脚本提交，避免逐条鼠标重复操作及盲目坐标回放。

接口明确禁止调用、账号不匹配、登录挑战或权限拒绝不得通过换通道绕过。一般能力不支持时可采用获准的正常页面操作；写入结果不确定时，先回读并恢复检查点，绝不因切换前后台而重复提交。原有素材保留、删除授权、准确 ID 与回读验收规则始终有效。无法完成的页面验收如实记录；用户明确接受本次接口验收时按该范围交付。


## 本技能 MAPI 接口接入

执行本技能的 MAPI 查询、写入或回读前，读取 [references/mapi-execution.md](references/mapi-execution.md)。接口代码随本技能独立分发；沿用下述业务功能与筛选规则。

## Official MAPI first

Use the bundled `scripts/run_local_mapi.mjs` as the default execution layer with the exact authorized local account. First use the existing authorized credential provider; an empty `OCEANENGINE_ACCESS_TOKEN` environment value alone does not establish that authorization is unavailable. Read [references/mapi-config.md](references/mapi-config.md) when composing its temporary credential-free config. The runner and reference are part of this Skill; no other Skill is required.

1. Continue collecting weekly GMV/VV ranking inputs from the logged-in 生意经 tab; MAPI does not replace that ranking source.
2. Resolve candidate videos with `material.aweme.video` or `material.library.video` instead of `getTradeItemList` when the official response contains the required exact item ID, author, publish time, deliverability, and cover/title fields.
3. For a new project, call `project.create`, then one `promotion.create` per unit. For an update, fresh-read `project.detail` and `promotion.detail` before `project.update`/`promotion.update`.
4. Read back every unit through `promotion.detail` or the newer `standard.project.materials`, and assert the same names, counts, exact material-ID sets, and dedupe boundaries defined below.
5. Never translate a captured `/api/lamp/...` body directly into MAPI. Compose the official request schema from current official detail responses and endpoint documentation.

Use the existing direct Chrome runner only when the required delivery mode or material type is proven unsupported by MAPI, or when the existing credential provider confirms the required scope is unavailable. Preserve the same account, selection, mutation, and readback contracts in either mode; do not silently switch paths after an uncertain POST. When the user requests background execution, complete authorized MAPI writes in the background and do not move the foreground mouse or keyboard without separate authorization. If browser-only visible readback is blocked, report that verification gap; do not bring the browser forward or use coordinate actions to bypass it.

Choose the input workflow from the user's source:

- Weekly GMV/VV ranking data: collect and select through the workflow below, then submit through MAPI by default. Use the direct Chrome runner only under the fallback rule above.
- Excel/XLSX creator-video return tables, such as separate 实探 and 混剪 workbooks: read [references/spreadsheet-material-placement.md](references/spreadsheet-material-placement.md) for row validation and grouping, then prefer MAPI material resolution and unit writes. Do not force spreadsheet rows into the weekly ranking schema.

For post-submission rejection matching and authorized removal, follow [the MAPI spreadsheet reference](references/mapi-spreadsheet-placement.md#removing-newly-rejected-materials-after-submission); reconcile gross additions, removals and final retained IDs before reporting results.

For spreadsheet placement, the remaining weekly ranking names, quotas, staff exclusions and ranking-runner schema do not apply automatically. Follow the spreadsheet reference and [references/mapi-spreadsheet-placement.md](references/mapi-spreadsheet-placement.md). The UI's `创建多个单元至项目` supports overflow within the same project; the per-unit material cap is not a project cap. Resolve `promotion_id -> project_id`, preserve the original unit's materials, and create only the necessary sibling units within the authorized scope. A screenshot or correction pointing to this entry during an active batch-placement request can clarify that scope; do not request the same authorization again.

For same-project multi-unit placement, sharing a `project_id` does **not** enable `创建多个单元至项目`. Before sibling creation, verify the actual saved `project.auto_extend.multi_promotion_enable=true` and the corresponding editor mode; unknown/false is not ready. After a first small group, switch real editor tabs and verify different intended material sets before continuing the batch. Final acceptance requires both per-unit backend IDs and per-unit visible editor content. When the user prioritizes a repost/correction workbook, reconcile that source before video-ID deduplication and exclude superseded videos, even if a replacement is unavailable. See the references for the complete boundaries.

## Chrome fallback entrypoint

```bash
node ${CODEX_HOME:-$HOME/.codex}/skills/douyin-creator-material-ads/scripts/run_weekly_local_ads.mjs \
  --config /private/tmp/douyin-weekly-run.json
```

Validation only:

```bash
node ${CODEX_HOME:-$HOME/.codex}/skills/douyin-creator-material-ads/scripts/run_weekly_local_ads.mjs --self-test
```

Dry run performs identity checks, current-unit detail reads, protected-ID construction, request capture, candidate selection, payload construction, and all assertions, but does not send the final create/update request:

```bash
node ${CODEX_HOME:-$HOME/.codex}/skills/douyin-creator-material-ads/scripts/run_weekly_local_ads.mjs \
  --config /private/tmp/douyin-weekly-run.json --dry-run
```

The agent creates the temporary config itself. Do not ask the user to write JSON, paste Console code, click confirmation dialogs, or keep Chrome in the foreground.

## Required run configuration

```json
{
  "operation": "create",
  "advertiserId": "CURRENT_ADVERTISER_ID",
  "businessDate": "YYYYMMDD",
  "rankStart": 1,
  "rankEnd": 10,
  "targetCount": 10,
  "currentProjectName": "EXACT_COPIED_PROJECT_NAME",
  "projectName": "YYYYMMDD_门店种草_gmv-vv-1-10",
  "tab": { "pathContains": "/lamp/pc/" },
  "captureButtonText": "保存投放",
  "protectedPromotionIds": [],
  "units": [
    { "metric": "gmv", "currentName": "EXACT_SOURCE_GMV_NAME", "name": "YYYYMMDD_周gmv-top10" },
    { "metric": "vv", "currentName": "EXACT_SOURCE_VV_NAME", "name": "YYYYMMDD_周vv-top10" }
  ],
  "rankings": { "gmv": [], "vv": [] }
}
```

For `operation=update`, each target unit also requires its exact numeric `promotionId`. `currentName` remains the preflight identity guard.

Each ranking row must contain:

```json
{
  "rank": 1,
  "name": "达人名称",
  "creatorId": "达人ID",
  "publish": "YYYY-MM-DD HH:mm",
  "role": "达人",
  "canDelivery": true,
  "video": {
    "itemId": "AWEME_ITEM_ID",
    "videoId": "VIDEO_ID",
    "title": "完整标题",
    "authorUid": "INTERNAL_AUTHOR_ID",
    "duration": 15,
    "width": 720,
    "height": 1280,
    "imageMode": 15,
    "imageUrl": { "uri": "COVER_URI", "urlList": ["COVER_URL"] }
  }
}
```

`requestBody` and `requestUrl` are optional. When absent, the runner installs a same-origin capture bridge in the exact logged-in edit tab, semantically activates the single visible `保存投放` button, blocks the outgoing create/update request, captures its complete body, restores the page's fetch function, mutates in memory, and submits once. This is not a per-item UI workflow.

## Build inputs without guessing

1. Use the logged-in `抖音生活服务生意经` tab, select `近7日`, and read GMV descending and VV descending responses. Keep original rank, creator name, exact creator ID, full publish minute, role, metric, and title.
2. Exclude rows labeled `职人` or `店员/职人`. Do not infer the role from a nickname.
3. Resolve each row through the current local-ads material response. Match creator name + exact creator ID + publish minute; use title/cover when the same creator has multiple videos in the same minute. Promote `aweme_item_id` to the canonical identity.
4. Before selection, separately record each candidate's material eligibility, request-submission result, and current audit status. Mark hidden, missing, ambiguous, `canDelivery=false`, known rejected, user-deleted, or invalid-delivery material unavailable. Read known rejection evidence before submission; do not restore such material from an old manifest. Keep the row in ranking order with its evidence-based reason; it must not consume a target slot.
5. Read protected unit IDs from current platform state. For Top11-20, protect every video already in the Top10 GMV/VV units. The runner independently re-reads all `protectedPromotionIds` and constructs the final protected video-ID set before selection.

Do not hardcode old creators, old dates, advertiser IDs, project IDs, promotion IDs, budget, bid, stores, region, schedule, or audience.

## Selection and naming contract

- Select GMV first in source-rank order and advance until the requested count is full.
- Select VV second. Exclude every protected video and every video selected for GMV, then advance until full.
- Deduplicate by exact `aweme_item_id`, not by creator. Different videos by the same creator are allowed.
- Top10 project: `YYYYMMDD_门店种草_gmv-vv-1-10`.
- Top11-20 project: `YYYYMMDD_门店种草_gmv-vv-11-20`.
- Unit names: `YYYYMMDD_周gmv-top10`, `YYYYMMDD_周vv-top10`, or the corresponding `top11-20` names.
- Reject old business dates, `_复制` suffixes, duplicate unit names, incomplete quotas, staff leakage, or ambiguous matches.

## Mutation boundary

The captured current create/update body is the source of truth. Change only:

- project name;
- target GMV/VV unit names;
- each target unit's `VideoMaterialList`;
- the paired `TitleMaterialList`.

Preserve budget, bid, stores, region, schedule, audience, optimization goal, search coefficient, automatic-store behavior, neighboring units, and all unknown fields byte-for-structure. If the project-name field or target unit cannot be uniquely found, fail immediately. Do not search random endpoints or fall back to mouse material selection.

## Submit and readback contract

1. Batch-read targets and protected units before mutation.
2. Assert exact tab advertiser, current target names, quota, deliverability, no staff, unique IDs, no protected intersection, and no GMV/VV intersection.
3. Capture or use the supplied current request body.
4. Send exactly one same-origin `createPromote` or `updatePromote` request. Retain existing materials unless the user gave specific authorization that covers their deletion; do not use a stale list to remove or restore materials.
5. On timeout or uncertain response, do not retry blindly.
6. Read every resulting unit through `GET /api/lamp/pc/v2/superior/ad/promotion/detail` and the project through `GET /api/lamp/pc/v2/superior/promote/projects/detail`.
7. Require exact project name, exact unit names, exact material-ID sets, exact counts, and pairwise zero intersections. For four Top10/Top11-20 units, require 40 unique IDs. Then check the audit status of every submitted material individually and report it separately from eligibility and request acceptance: `待审核` is not `通过`.

Only report completion when readback verifies all assertions. Do not claim that a material will pass review or that a pre-check predicts every violation. Use exact platform fields or explicit platform text for a rejection reason; screenshots may support inspection but cannot justify a guessed reason. Otherwise report the concrete failed guard. Do not add unbounded polling or automatic scheduled checks.

## Fast-path discipline

- Run `--self-test` once after skill installation or code changes, not before every business run.
- During a normal run, use one config, one runner invocation, one capture, one submission, and one readback.
- Do not re-discover Chrome ports, CDP settings, extension state, AppleScript settings, endpoint families, or old HAR files when the direct runner reaches the exact tab.
- A missing exact tab, non-unique save button, changed payload schema, login loss, CAPTCHA, permission change, or failed identity assertion is a fast failure. Stop at that guard; do not spend the run on unrelated exploration.

## 发布版执行参数

后台优先策略不改变发布版预演和目标校验。已授权任务由执行者填写这些参数，不代表需要逐批再次询问用户。

Chrome runner 默认预演；实际执行使用 `--execute`，并在配置中设置与 `advertiserId` 相同的 `confirmAdvertiserId`。

`applescript_eval.sh` 默认不激活窗口；仅获准的前台兜底同时使用 `--activate --allow-foreground`。没有该 helper 的技能按其连接器流程执行。
