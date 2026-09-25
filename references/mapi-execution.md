# 本技能的 MAPI 执行能力

本目录自带 `scripts/run_local_mapi.mjs` 和 `scripts/mapi_pagination.mjs`，无需另一个技能或全局记忆中的代码。下文只规定接口接入；本技能的业务来源、筛选、分组、命名、数量和保护规则继续按 SKILL.md 执行。

## 可复用的接口层

- 先使用已授权账户的现有凭据机制，环境变量 `OCEANENGINE_ACCESS_TOKEN` 可作为一种输入。环境变量为空不能断定无授权；按既有授权正常刷新凭据提供器。不把凭据放入配置、命令示例实际值、日志或记忆，也不在分发技能中限定某台机器的 provider 路径。
- 配置 `steps` 的 operation、query/body 和 assertions 后运行：`node scripts/run_local_mapi.mjs --config <config.json> --output <result.json>`。实际 POST 需要已有用户授权并加 `--execute`；只读步骤不加。
- 需要完整详情/素材供下一步构造请求时，设置该 step 的 `resultMode:"full"`。默认仍输出摘要；摘要不能用作完整成员清单。旧 `includeData` 参数若原技能支持仍保持兼容。
- `material.aweme.video` 自动跟随 `page_info.cursor`，直至 `has_more=false`，按准确 item_id 去重，并输出 `paginationVerification`。游标循环、缺失分页标记、读完前达页数上限或中途失败均不能声称列表完整。
- 其他 GET 的游标分页只有在当前官方结构已确认时配置 `pagination:{listPath,pageInfoPath,idKey,cursorKey,moreKey,queryCursorKey,maxPages}`；不要把主页视频的分页结构强加给项目列表、素材库或报表。页码型接口按实际 schema 明确请求全部页并核对总数。
- 请求与响应保留长 ID；unsafe Number 输入被拒绝。接口要求整数 JSON 的嵌套查询参数，用验证过的纯数字字符串构造完整 `filtering` JSON 字符串，避免先转 Number 丢精度。
- POI 视频接口的 `filtering` 包含 `anchor_info.anchor_types:["POI_ANCHOR"]`、`anchor_info.poi_ids` 和 `start_time/end_time`（`YYYY-MM-DD HH:mm:ss`）。日期位于 filtering；POI 取本次目标，不能用历史示例。
- MAPI 视频库不是投放计划成员清单，也不是 GMV/VV 排名或消耗/产出报表。必须以本技能规定的来源筛选，再通过准确 item/material/video ID 核对，保留可投状态和来源证据。
- 能力探测只验证准确账户、计划类型、授权和返回结构。官方标准路径未覆盖旧全域时，是选择已验证混合路径的依据，不能据此断言所有接口路径不可用。
- POST 不自动重试；失败或响应不明时只读回查。不能在未决写入后换路径重发。遇 40010 等明确禁止内部调用时停止该路径，不规避限制。同一范围的授权沿用，真实工具审批仍正常处理。

## 本技能适配

**周榜/表格门店种草**：排名输入保持生意经来源，表格输入仍走本技能表格规则。官方 MAPI project/promotion 创建、更新和逐单元回读；保留原有排名顺序、GMV/VV 配额/去重、职人排除、表格分组和同项目溢出单元规则，不能将两种输入规则互套。MAPI 主页视频未覆盖目标时不能当作“不可用”，应按本技能已允许的来源补查。此技能不调用旧全域 updateAd，也不包含清理功能。

## 提交与验收

提交前重新取得当前目标状态，避免用旧编辑页面清单覆盖并带回已删素材；同一计划增删只由一个执行者串行处理。已知违规或用户已删除素材不得由旧清单恢复。保留现有素材，只有具体用户授权覆盖删除时才可从现有集合剔除。已提交请求有 pending 检查点，完成后保存实际回读集合。

接口成功只表示请求受理，不代表素材可投或审核通过。按本技能核对准确账户、目标项目/计划/单元、每个目标素材 ID 与应保留集合、设置、数量，以及逐素材当前审核状态；`待审核` 必须标明不等于通过。有并发修改或覆盖不完整时不扩大操作范围。审核检查使用一次提交后的逐素材读取及既有的有界 GET 回读，不增加无限轮询或自动定时。
