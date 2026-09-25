# MAPI spreadsheet placement and diagnostics

Validated scope: standard local-delivery 短视频图文 / 门店种草, corrected with live editor checks on 2026-09-08. The earlier claim that sibling MAPI creation enables multi-unit mode is withdrawn. Recheck current responses for other delivery modes; these observations do not establish global-plan write support.

## Identity, grouping and preservation

- Read `promotion.list` (its rows may be `data.promotion_list`, not `data.list`), `promotion.detail` and `project.detail`. Detail responses may omit the unit name; obtain name and parent ID from the list or exact edit URL.
- Build `unit name -> exact ordered item IDs` after priority-list replacement, deduct existing slots, and separate 实探 / 云剪辑 categories. `promotion.create` with an existing `project_id` creates a sibling **but does not enable the UI multi-unit mode**. Verify the saved `project.auto_extend.multi_promotion_enable=true` and actual editor mode before using this path; do not create a new project when the user identifies an existing one.
- The verified browser detail route `/api/lamp/pc/v2/superior/ad/promotion/detail?advid=<account>&promotion_id=<unit>` returns the unit under `data[unitId]`, including `project.auto_extend.multi_promotion_enable` and `material_group.video_material_info[].aweme_item_id`. Use exact strings for all IDs. Read the field rather than inferring it from management-list layout.
- First submit a small group under the verified enabled project, then refresh the editor and actually switch between the original and new unit. Confirm their displayed names and distinct intended material sets before continuing. A successful sample permits the remaining authorized groups, each still requiring final readback and visible verification.
- To add materials, only update the original unit's complete material list and create required siblings. Leave project settings untouched. A project-detail round trip can omit UI targeting details, so do not copy it into `project.update` just to add videos.
- Retain existing names, materials, title/cover behavior and unrelated unit settings. New siblings inherit the same parent project's budget, targeting, stores, bid and schedule. Verify parent identity and unchanged project details after writes; never assume a displayed project budget is a separate budget for every sibling.

## Observed failure and corrected acceptance boundary

- **2026-09-07 failure, diagnosed 2026-09-08:** sibling units shared one project ID and MAPI returned different material sets, while the saved multi-unit flag remained false. The editor displayed the original unit's videos even when a different unit ID was in the URL. The earlier completion claim and the unconditional equivalence instruction were invalid. This evidence identifies a mode/verification mismatch; it does not by itself establish what videos actually delivered or prove the full platform root cause.
- **2026-09-08 verified workflow:** start from the user's new project with the flag true; reconcile 18 repost creators before allocation; use 17 deliverable replacements and exclude both the unavailable replacement and its old version for the remaining creator. Retain the already-present replacement once. Seven units contained 58 unique videos (13 实探, 45 云剪辑; 1 retained, 57 added). Every actual editor tab was selected, its name/count/full title set matched the manifest, backend IDs matched, and the full browser project settings plus MAPI project details were unchanged. Counts are historical validation evidence, never defaults.
- Do not promote a successful API call or offline script test into a claim about UI behavior. Correct the instruction that failed; do not merely append a success note while leaving the unconditional claim in place.

## Exact IDs and official request types

Use the bundled runner's lossless parser and `includeData: true` for full detail/material reads. IDs beyond JavaScript's safe integer range are returned as strings. Do not convert them through `Number` or ordinary JSON parsing before preservation.

When the official schema requires a JSON integer, use `{"$integer":"<digits>"}` in config. This is serialized as an exact numeric literal, including inside `filtering.item_ids` / `anchor_info.poi_ids` arrays. Fields defined as strings, such as `aweme_ids`, remain strings. Never remove quotes from all digit-only strings indiscriminately.

## Material lookup

- `material.aweme.video`: `cursor="0"`, `count<=100`; `filtering.item_ids` supports up to 10 exact IDs per request. Inspect `page_info.has_more` and continue with its returned cursor if needed.
- `filtering.anchor_info.anchor_types=["POI_ANCHOR"]` plus the target `poi_ids` checks that store-scoped source. It is not an exhaustive search across all anchor types.
- `ALL_ANCHOR` requires `aweme_ids`. Verify whether a spreadsheet column contains the public Douyin number, unique handle, or internal UID; they are not interchangeable. Preserve the original row value, and use current platform identity evidence for normalization. A misplaced space in a handle can prevent a match.
- Query `item_status="ALL"` to inspect both deliverable and unavailable materials. Require exact item identity plus `can_delivery=true`; a resolved share URL alone proves neither authorization nor deliverability.

## Minimal homepage-video payload

For the standard unit shape returning `customer_material_list`, the verified homepage-video element is:

```json
{
  "image_mode": "IMAGE_MODE_VIDEO_VERTICAL",
  "video_material": {"aweme_item_id": {"$integer":"9007199254740993"}}
}
```

Use the actual returned image mode. When `aweme_item_id` is present, omit `title_material`, `video_id` and `cover_web_uri`: the platform uses the original work's title, video and cover and rejects these redundant fields. This rule is for homepage-video submissions, not uploaded/library-video payloads. If an existing material has a deliberately customized cover/title, confirm a preservation path before rebuilding it through this minimal form.

`promotion.update` needs `local_account_id`, the exact `promotion_id`, the current unit `name` and the complete retained-plus-new list; include other fields only as required and preserve their current values. `promotion.create` needs the existing `project_id`, a unique category/sequence name and its material list. Keep supported material settings such as `video_hp_visibility` / `enable_graphic_delivery` consistent with the source unit where applicable.

Live validation on 2026-09-25 rejected an update without `name` with `40000: 单元名称不能为空`; read the current name from `promotion.list` and preserve it. Write requests also require integer-typed `local_account_id`; use an exact integer marker rather than a quoted digit string when the endpoint enforces this type. Correct these definite validation failures without replaying any successful mutation.

Consult the current [official SDK request schema](https://github.com/oceanengine/ad_open_sdk_go/blob/master/models/model_local_promotion_create_v3_0_request.go) together with actual endpoint validation; optional-field combinations can have stricter rules than the generated schema shows.

## Checkpoints and eventual readback

- Persist each successful create response and exact resulting ID immediately; the runner's per-invocation result is not a durable transaction ledger. Prefer one mutation per invocation with its output saved before preparing the next call. Resume from saved successful IDs, never by replaying the full create batch.
- After a successful create, a first detail read can temporarily return an empty material list. Retry only the GET, using a bounded interval (for example 2 seconds, up to 3 reads). The runner supports `readbackAttempts` / `readbackDelayMs` with assertions. Exhaustion means stop and report the created ID, not recreate it.
- A definite parameter-validation rejection can be corrected and resubmitted once the cause is understood. A timeout or unknown POST result requires read-only reconciliation by exact project/name/ID before further writes.
- Verify every final material-ID set, counts, deduplication boundary, unit name, parent project and preserved original material. Also perform the per-unit visible editor checks in [spreadsheet-material-placement.md](spreadsheet-material-placement.md#6-post-save-readback), and reconfirm the saved multi-unit flag. When the user requested background execution, browser read-only checks that cannot be completed without foreground mouse/keyboard control are a reported verification gap, not a reason to take over the foreground. Without an explicit acceptance adjustment, MAPI-only verification does not satisfy the visible-editor contract. If the user explicitly accepts interface-only verification for the current run, complete and report that agreed scope, preserving the page-check gap; this does not prove the UI multi-unit flag or editor behavior and does not waive future runs automatically. Read management-list statuses separately: `AUDIT` means under review and `NO_SCHEDULE` means outside the delivery schedule; neither alone proves a material was rejected. Check every submitted material's latest audit state and report eligibility, request acceptance, and audit result separately; `待审核` is not `通过`.

## Missing video and unavailable-reason diagnosis

An empty MAPI result means unresolved under that query. Do not label it deleted, unauthorised or prohibited without evidence. Check exact creator identifier, anchor filter, scope and pagination first.

If still missing, use the exact-account logged-in material picker, or a known read-only `getTradeItemList` request with the exact item ID and target stores. Use the target project's current optimization goal / `externalAction` and actual store set rather than a value remembered from another run. Reading this diagnostic source does not change the write route. Do not enumerate guessed endpoints or retry a third-party-call prohibition.

Capture `canDelivery`, `invalidDeliveryCodes`, `itemNotPassedReason`, `localAnchorInfo`, and `highRiskAwemeSubjectInfo` separately. Verified current UI mapping:

- `invalidDeliveryCodes` containing `20000001` -> **锚点类型不符合要求**.
- `localAnchorInfo=null` means this response did not identify a local anchor; it does not prove the author never attached any link.
- `highRiskAwemeSubjectInfo.allowed=true` passes that subject-risk check only. It does not prove every authorization requirement is satisfied.

Report the exact platform reason and the relevant source row only when current platform fields or unambiguous platform text supply it. A screenshot can support inspection, but a visual guess cannot be reported as the platform's exact rejection reason. Do not promise that pre-checks predict every violation. Do not attempt to alter a creator's video, anchor, authorization or account settings under material-addition authorization. If a code is unknown, report it as unresolved or obtain its current platform text without guessing. Keep identified account IDs, video IDs and credentials out of reusable defaults.

## Credential execution

Use an already authorized environment or credential provider; never print or store secrets in config, logs or Skill files. A shell environment without an injected access token does not prove that existing Keychain authorization is unavailable: first use the existing provider and refresh through the already authorized path. Sandbox Keychain errors are not evidence of token expiry: use the required tool escalation for the existing provider and do not clear or reauthorize credentials. Avoid changing credential providers across read/write calls without need. Do not add another machine's Keychain names or absolute provider path to this distributable skill.

## Official rejection readback

Use `promotion.reject-reasons` with `local_account_id` and `promotion_ids` (an array of exact integer markers). This read-only operation calls `/open_api/v3.0/local/promotion/reject_reason/get/`. Match `data.list[].material_reject[].video_material.video_id` to the saved promotion detail and its `aweme_item_id`, then identify the corresponding workbook row. A `type=VIDEO` record may also identify the video through `content`; use it only when it exactly matches a saved `video_id`. Retain `reject_reason` and `suggestion`. Records with null material/type/content can summarize unit-level reasons already present in specific video records: preserve them as unit evidence, but do not count them as additional rejected videos or assign them to an arbitrary creator. Deduplicate matched rejected videos by exact `aweme_item_id`. An empty rejection list proves only that no rejection reason was returned at that time; it does not establish that every material passed. Read `promotion.list` statuses separately. When the available API does not expose per-material pass/pending status, report it as unconfirmed instead of inferring approval from `can_delivery=true` or an enabled unit.

Schema source: [Ocean Engine official SDK](https://github.com/oceanengine/ad_open_sdk_go/blob/master/api/api_local_promotion_reject_reason_get_v30.go).


## Removing newly rejected materials after submission

- Query rejection reasons after submission and again at final acceptance when review has progressed during the run. A first empty result can become a nonempty rejection list minutes later, even while `promotion_status_first=PROMOTION_STATUS_ENABLE`. Use bounded reads, not continuous polling.
- Inform the user of each matched creator/video and the exact platform reason. Case examples from 2026-09-25 included an unauthorized named person's image, unsupported “原价219” wording, and government-worker imagery / medical-confusion claims. These are evidence from individual reviews, not universal keyword bans or proof about other videos.
- Before removal, check whether existing authorization covers the exact rejected set. If it does, proceed without another question; otherwise prepare the retained list and request only the missing removal authorization. Approval for this batch does not authorize future deletions.
- Fresh-read the affected unit and save its complete baseline. Build `retained = current exact IDs - authorized rejected IDs`; do not rebuild from an older manifest. Preserve the current name and supported material settings, and assert the baseline before the update to detect intervening edits. Submit one `promotion.update`, then read back the exact retained ID set and count. Also verify untouched units and parent settings; do not restore previously deleted materials.
- Report gross additions, rejected removals, net retained videos, and rows skipped for missing links separately. For example, 12 added minus 3 rejected removals yields 9 retained, not 12 successfully running videos. An enabled unit or absence of rejection still does not prove each retained video passed; an update may trigger review again.
- Save a credential-free row-level result with source row, creator, exact video ID, unit ID, outcome and rejection reason. Keep private account IDs and execution logs in task output, not reusable Skill defaults.
