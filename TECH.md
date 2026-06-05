# 口红试色小程序技术开发文档

## 1. 技术栈选择

| 模块 | 技术 |
| --- | --- |
| 小程序前端 | 微信小程序原生开发，TypeScript、WXML、WXSS |
| 后端逻辑 | 微信云开发 CloudBase 云函数 |
| 图像服务 | CloudBase 云托管，封装外部图像模型 API |
| 数据库 | CloudBase 云数据库 |
| 文件存储 | CloudBase 云存储 |
| 运营后台 | 微信公众平台、微信支付商户平台、CloudBase 控制台 |
| 支付 | 微信支付 |

图像模型优先选择中国大陆可稳定访问的供应商，例如阿里云百炼/通义万相、腾讯云混元、火山引擎。GPT Image / image2 不作为国内生产主链路。

## 2. 最小架构原则

- 小程序只调用云函数，不直接访问数据库核心业务数据。
- 云函数负责业务状态、支付、权限、推荐、报告解锁。
- 云托管只负责调用外部图像模型，返回水印图和无水印图。
- 第一版不建设独立 Web 管理后台，运营通过微信平台和 CloudBase 控制台完成。
- 第一版不用复杂微服务，不建独立 `preview_groups` 集合。

## 3. 最小项目结构

```text
lipstick-tryon/
  miniprogram/
    pages/
      home/ upload/ preferences/ generating/ preview/
      report/ my-reports/ share/ privacy/ refund-help/
    components/
      tryon-preview/ result-card-canvas/ locked-section/
    services/
      auth.ts test.ts report.ts payment.ts share.ts
    utils/
      constants.ts errors.ts

  cloudfunctions/
    user/
      auth/ test/ report/ payment/ share/ refund/
    scheduled/
      cleanupExpiredData/

  image-service/
    providers/
    generateTryOn.ts
    watermark.ts

  shared/
    types/
    constants/
```

说明：

- 云函数按用户业务域分组，避免第一版出现过多零散函数目录。
- `shared` 只放类型、状态枚举、错误码、价格等跨端常量。
- 图像供应商适配代码全部放在 `image-service/providers`。
- 运营所需查询、维护和排障通过 CloudBase 控制台处理。

## 4. 数据模型

### users

```text
_id
openid
createdAt
lastSeenAt
```

### try_on_tests

一次用户测试。负责记录自拍、偏好、生成状态、换组次数和当前激活报告。

```text
_id
openid
status
selfieFileId
preferences
safetyStatus
qualityStatus
generationStatus
generationRetryCount
previewRegenerateCount
maxPreviewRegenerateCount
activeReportId
sourceShareId
createdAt
updatedAt
expiresAt
```

关键规则：

- `previewRegenerateCount` 初始为 0。
- `maxPreviewRegenerateCount` 固定为 3。
- `activeReportId` 指向当前可支付解锁的 report。

### reports

一组预览和其付费报告。第一版用 report 表达多组预览，不额外建 `preview_groups`。

```text
_id
openid
testId
version
status
snapshot
previewImages
paidImages
shareCardImages
replacedByReportId
unlockedAt
expiresAt
deletedAt
createdAt
```

`status`：

```text
active
replaced
unlocked
deleted
expired
```

关键规则：

- 初始 report 的 `version=1`。
- 每次成功换组新建 report，`version` 递增。
- 旧 report 标记为 `replaced`。
- 支付只能解锁 `try_on_tests.activeReportId` 指向的 report。
- report 保存推荐快照，口红库后续修改不影响历史报告。

### orders

```text
_id
openid
testId
reportId
amount
currency
paymentStatus
refundStatus
wxTransactionId
merchantOrderNo
wxPrepayId
paidAt
unlockedAt
refundReason
createdAt
updatedAt
```

关键规则：

- `amount=599`，单位分。
- 一个订单只绑定一个 reportId。
- 支付回调必须幂等。
- 支付成功只解锁订单绑定的 report。
- 支付成功但报告不可查看时，标记为可退款。

### lipsticks

```text
_id
brand
shadeName
shadeCode
colorHex
swatchImageFileId
texture
undertone
skinToneTags
budgetRange
sceneTags
styleTags
baseScore
manualBoost
recommendationReason
cautionNote
substitute
searchKeywords
status
createdAt
updatedAt
```

第一版维护 50-70 个精品色号即可。运营人员直接在 CloudBase 云数据库控制台维护。

### share_entries

```text
_id
sharerOpenid
reportId
recommendationIndex
cardPreviewFileId
sharePath
visitCount
uniqueVisitorCount
newTestCount
paidOrderCount
createdAt
updatedAt
```

### provider_runs

记录图像模型调用，方便排障和成本统计。

```text
_id
testId
reportId
openid
provider
status
durationMs
retryIndex
errorCode
errorMessage
cleanImageFileIds
watermarkedImageFileIds
createdAt
```

### events

只记录漏斗和关键行为，不替代业务表。

```text
_id
openid
eventName
testId
reportId
orderId
shareId
properties
createdAt
```

核心事件：

```text
upload_selfie_success
preference_submit
generation_success
generation_fail
preview_view
preview_regenerate_success
preview_regenerate_fail
preview_regenerate_limit_reached
payment_success
report_view
share_visit
refund_request
```

## 5. 平台后台使用方式

第一版不开发自建后台，按下面方式运营：

| 需求 | 使用位置 |
| --- | --- |
| 小程序版本发布、类目、隐私协议 | 微信公众平台 / 微信开发者工具 |
| 支付交易、退款、商户对账 | 微信支付商户平台 |
| 云函数日志、环境变量、定时任务 | CloudBase 控制台 |
| 口红库维护 | CloudBase 云数据库 `lipsticks` 集合 |
| 订单与报告排查 | CloudBase 云数据库 `orders`、`try_on_tests`、`reports` |
| 图像供应商排查 | CloudBase 云数据库 `provider_runs` 和云托管日志 |
| 漏斗统计 | CloudBase 云数据库 `events` 集合查询/导出 |
| 图片文件排查 | CloudBase 云存储 |

平台后台限制：

- 不提供面向运营的定制化仪表盘。
- 不提供多管理员角色和细粒度操作日志。
- 数据维护依赖 CloudBase 控制台权限，请限制控制台成员范围。
- 复杂统计、批量导入、可视化图表后续再建设独立后台。

## 6. 关键技术点

### 6.1 换组状态

成功换组时按顺序执行：

1. 校验 `previewRegenerateCount < 3`。
2. 排除本次测试已推荐过的色号，重新推荐 Top 3。
3. 调用图像服务生成新 report 的 3 张图。
4. 新建 report，`version + 1`，状态为 `active`。
5. 旧 report 标记为 `replaced`。
6. 更新 `activeReportId`。
7. `previewRegenerateCount + 1`。

如果图像生成失败，不创建新 report，不增加换组次数。

### 6.2 试色图生成

输入：

```text
selfieFileId
targetLipsticks
testId
reportId
```

输出：

```text
cleanImages
watermarkedImages
provider
durationMs
errorCode
```

要求：

- 保留用户身份特征。
- 只改变嘴唇颜色。
- 不污染牙齿、鼻子、皮肤。
- 失败要返回明确错误码，用于重试或退款判断。

### 6.3 推荐规则

第一版不用 AI 决定推荐结果，使用可解释规则：

```text
肤色匹配 -> 预算过滤 -> 场景加分 -> 风格加分 -> 人工权重排序 -> Top 3
```

换组时优先排除本次测试已出现过的色号。

### 6.4 支付解锁

- 创建支付订单时读取 `activeReportId`。
- 订单绑定固定 `reportId`。
- 支付回调只解锁订单绑定的 report。
- 如果用户在支付前换组，旧 report 不可再被支付。
- 支付成功但报告不可查看，进入退款处理。

### 6.5 分享

- 结果卡片用小程序 Canvas 生成。
- 保存到相册可在本地完成。
- 分享时上传单张卡片到云存储，并创建 `share_entries`。
- 分享落地页只读取卡片和统计数据，不读取完整报告。

### 6.6 权限和生命周期

权限：

- 自拍原图不公开。
- 免费水印图只允许本人访问。
- 无水印图只允许已支付用户访问。
- 分享卡片只允许通过有效 shareId 访问。
- 色卡图可公开读，运营人员通过 CloudBase 控制台写。
- API Key 和支付密钥只放云函数或云托管环境变量。

生命周期：

- 自拍原图 24 小时后自动删除。
- 未支付 report 24 小时后自动清理。
- 已支付 report 保留在“我的报告”。
- 用户删除自拍不删除报告。
- 用户隐藏报告不删除订单。

## 7. 云存储路径

```text
selfies/{openid}/{testId}/original.jpg
previews/{openid}/{testId}/{reportId}/watermarked_1.jpg
previews/{openid}/{testId}/{reportId}/clean_1.jpg
share_cards/{openid}/{reportId}/{recommendationIndex}.jpg
swatches/{lipstickId}.jpg
```

`reportId` 用于区分最多 4 组预览，避免图片覆盖。

## 8. 代码风格和架构模式

- TypeScript 优先，业务状态使用明确枚举。
- 前端页面只处理展示和交互，业务判断放到 service 或云函数。
- 云函数按业务域拆分，不把支付、报告、分享混在一个入口里。
- 外部图像模型使用 provider adapter，统一输入输出和错误码。
- 所有支付回调、换组、报告解锁逻辑必须幂等。
- 第一版不实现自建后台权限系统。

## 9. 验收重点

- 上传、偏好、生成、换组、预览、支付、报告闭环可跑通。
- 每次测试最多免费换 3 次，失败不消耗次数。
- 支付只能解锁当前激活 report。
- 支付回调重复到达不会重复解锁或重复记账。
- 图像生成失败可重试，已支付但交付失败可退款。
- CloudBase 控制台可查询订单、测试记录、事件、分享数据、供应商调用记录。
- 自拍原图和未支付 report 可按 24 小时规则清理。
