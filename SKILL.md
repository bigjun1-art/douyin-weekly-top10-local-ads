---
name: douyin-weekly-top10-local-ads
description: Parameterize weekly Douyin Local Life GMV/VV creator-video ranking plans in 巨量本地推. Use for creating or updating 门店浏览 GMV/VV Top10 or Top11-20 projects from the logged-in Chrome session, with staff exclusion, unavailable-video backfill, global video dedupe, one batch submission, and exact detail readback.
---

# 抖音周榜门店浏览参数化投放

Use the directly runnable entrypoint. Do not replace it with per-video mouse actions, port probing, guessed APIs, screenshots, or repeated browser experiments.

## Direct entrypoint

```bash
cd <skill-directory>
node scripts/run_weekly_local_ads.mjs \
  --config /private/tmp/douyin-weekly-run.json
```

Validation only:

```bash
node scripts/run_weekly_local_ads.mjs --self-test
```

Dry run performs identity checks, current-unit detail reads, protected-ID construction, request capture, candidate selection, payload construction, and all assertions, but does not send the final create/update request:

```bash
node scripts/run_weekly_local_ads.mjs --config /private/tmp/douyin-weekly-run.json
```

Preview is the default. To submit, add `"confirmAdvertiserId": "CURRENT_ADVERTISER_ID"` to the config and run with `--execute`.

The agent creates the temporary config itself. Do not ask the user to write JSON, paste Console code, click confirmation dialogs, or keep Chrome in the foreground.

## Required run configuration

```json
{
  "operation": "create",
  "advertiserId": "CURRENT_ADVERTISER_ID",
  "confirmAdvertiserId": "CURRENT_ADVERTISER_ID",
  "businessDate": "YYYYMMDD",
  "rankStart": 1,
  "rankEnd": 10,
  "targetCount": 10,
  "currentProjectName": "EXACT_COPIED_PROJECT_NAME",
  "projectName": "YYYYMMDD_门店浏览_gmv-vv-1-10",
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
4. Mark hidden, missing, ambiguous, `canDelivery=false`, or invalid-delivery material unavailable. Keep the row in ranking order with its reason; it must not consume a target slot.
5. Read protected unit IDs from current platform state. For Top11-20, protect every video already in the Top10 GMV/VV units. The runner independently re-reads all `protectedPromotionIds` and constructs the final protected video-ID set before selection.

Do not hardcode old creators, old dates, advertiser IDs, project IDs, promotion IDs, budget, bid, stores, region, schedule, or audience.

## Selection and naming contract

- Select GMV first in source-rank order and advance until the requested count is full.
- Select VV second. Exclude every protected video and every video selected for GMV, then advance until full.
- Deduplicate by exact `aweme_item_id`, not by creator. Different videos by the same creator are allowed.
- Top10 project: `YYYYMMDD_门店浏览_gmv-vv-1-10`.
- Top11-20 project: `YYYYMMDD_门店浏览_gmv-vv-11-20`.
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
4. Send exactly one same-origin `createPromote` or `updatePromote` request.
5. On timeout or uncertain response, do not retry blindly.
6. Read every resulting unit through `GET /api/lamp/pc/v2/superior/ad/promotion/detail` and the project through `GET /api/lamp/pc/v2/superior/promote/projects/detail`.
7. Require exact project name, exact unit names, exact material-ID sets, exact counts, and pairwise zero intersections. For four Top10/Top11-20 units, require 40 unique IDs.

Only report completion when readback verifies all assertions. Otherwise report the concrete failed guard.

## Fast-path discipline

- Run `--self-test` once after skill installation or code changes, not before every business run.
- During a normal run, use one config, one runner invocation, one capture, one submission, and one readback.
- Do not re-discover Chrome ports, CDP settings, extension state, AppleScript settings, endpoint families, or old HAR files when the direct runner reaches the exact tab.
- A missing exact tab, non-unique save button, changed payload schema, login loss, CAPTCHA, permission change, or failed identity assertion is a fast failure. Stop at that guard; do not spend the run on unrelated exploration.
