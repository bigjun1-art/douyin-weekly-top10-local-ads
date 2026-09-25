# 抖音达人素材投流

`douyin-creator-material-ads` 是面向 Codex 的抖音本地生活投放自动化 Skill。支持按创作者视频 GMV/VV 周榜或 Excel 达人视频表创建、更新门店种草投放单元，优先使用官方 MAPI，提交后核对素材与审核结果。

> 非抖音、字节跳动或巨量引擎官方项目。仅限操作自己或已获明确授权的账号，并遵守适用的平台规则和法律。

## 安全边界

- 优先使用既有授权的官方 MAPI 凭据通道，不保存或导出凭据；需要页面数据时使用已登录的 Google Chrome。用户要求后台执行时，不占用前台鼠标和键盘。
- 所有写入默认只预演；实际执行必须显式确认目标，并在完成后回读验证。
- 不提交真实广告主 ID、计划 ID、门店 ID、业务数据、HAR、日志或观察账本。
- HTTP 成功不等于业务完成，必须检查业务状态和目标详情。

## 安装

将本仓库目录复制到 Codex 的 Skill 目录，目录名保持为 `douyin-creator-material-ads`。参数和执行边界见 [SKILL.md](SKILL.md)。

## 投放与审核

- 保留目标项目的预算、定向、门店和排期，按准确视频 ID 去重与分组。
- 分别记录素材可投、提交成功和审核结果；单元启用或拒审列表为空不等于逐条通过。
- 拒审后匹配到原表达人与视频，按已有授权处理移除，并回读最终保留名单。
- 页面检查受阻时说明缺口；只有用户明确接受时采用本次接口验收范围。

## 本地校验

```bash
node scripts/validate-repository.mjs
```

校验包含 Skill 结构、敏感信息模式、Node/Bash 语法和离线自测，不会执行真实平台写入。

## 可见性

本仓库按 MIT License 开源。

## 许可证

见 [MIT License](LICENSE)。

## English summary

Codex Skill for authorized Douyin creator-material advertising from weekly rankings or Excel tables. Uses official MAPI first, with scoped Chrome fallback. Mutating runners are preview-only by default and require explicit target confirmation plus readback. No credentials, cookies, tokens, production identifiers, or business data are included.
