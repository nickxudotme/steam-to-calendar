<p align="center">
  <img src="public/assets/brand/steam-to-calendar-logo.png" alt="Steam to Calendar logo" width="96" height="96" />
</p>

<h1 align="center">Steam to Calendar</h1>

<p align="center">
  在系统日历里追踪 Steam 折扣、游戏发售日、愿望单和官方活动。
</p>

<p align="center">
  <a href="README.md">English</a>
  ·
  <a href="https://github.com/nickxudotme/steam-cli">Steam CLI</a>
  ·
  <a href="https://isthereanydeal.com/apps/">申请 API Key</a>
</p>

Steam to Calendar 是一个生产风格的 Next.js 应用，可以把公开 Steam 数据转换成可订阅的日历 feed。你可以追踪 Steam 官方促销窗口和主题节、关注指定游戏、导入公开 Steam 愿望单，并订阅到 Apple Calendar、Google Calendar、Outlook、Fantastical 或任何支持 ICS/WebCal 的日历应用。

这个项目基于 [Steam CLI](https://github.com/nickxudotme/steam-cli) 构建。Steam CLI 以 `vendor/steam-cli` submodule 的形式随项目 vendored，并在生产构建时编译到 `bin/steam-cli`。

> Steam to Calendar 与 Valve Corp. 没有关联。Steam、Valve 以及相关标识归各自权利方所有。

## 使用预览

桌面端工作台：

![Steam to Calendar 桌面端日历构建器](public/assets/readme/calendar-builder-desktop.png)

移动端日历构建器：

<p align="center">
  <img src="public/assets/readme/calendar-builder-mobile.png" alt="Steam to Calendar 移动端日历构建器" width="320" />
</p>

## 功能

- 为 Steam 活动、关注游戏或公开愿望单生成可订阅的日历 feed。
- 追踪 Steam 官方季节促销、Next Fest、主题游戏节、发行商促销和系列促销。
- 导入公开 Steam 愿望单，把未来发售、预购和折扣变成日历事件。
- 手动搜索并关注少量 Steam 游戏。
- 在桌面和移动端工作台里预览日历，再决定是否订阅。
- 独立选择 Steam 商店地区和界面语言。
- 生成带配置参数的 ICS/WebCal URL，方便分享、排障和重新订阅。
- 默认只使用公开 Steam 数据，也可以接入高级价格历史增强。

## 完整体验：API Key

项目不依赖第三方 API key 也可以运行。默认模式会通过 Steam CLI 使用公开 Steam 数据；当高级价格数据不可用时，应用会自动降级到 Steam 当前折扣和发售数据。

如果想获得完整价格历史和史低体验，请在 <https://isthereanydeal.com/apps/> 创建 IsThereAnyDeal API key，然后设置：

```bash
STEAM_CLI_ITAD_KEY=your_key
```

这会启用 Steam CLI 的高级价格历史能力，包括更完整的史低和价格窗口数据。底层行为可以参考 [Steam CLI README](https://github.com/nickxudotme/steam-cli#advanced-price-enhancement)。

## 快速开始

```bash
npm install
cp .env.example .env.local
npm run build:steam-cli
npm run dev
```

`npm run dev` 默认使用 webpack dev server。`npm run dev:turbopack` 可以用来检查 Turbopack 行为，但当前本地开发默认走 webpack。

如果本地 Next.js dev 状态变得奇怪，可以只清理 dev cache：

```bash
npm run dev:clean
```

然后打开 <http://localhost:3000>。

## 配置

常用环境变量：

| 变量                                | 必填 | 说明                                                     |
| ----------------------------------- | ---- | -------------------------------------------------------- |
| `STEAM_CLI_PATH`                    | 否   | Steam CLI 二进制路径。本地构建后通常是 `bin/steam-cli`。 |
| `STEAM_CLI_ITAD_KEY`                | 否   | 可选 IsThereAnyDeal API key，用于高级价格历史增强。      |
| `STEAM_CLI_CC`                      | 否   | 默认 Steam 商店地区代码，例如 `US`、`CN`、`JP`。         |
| `STEAM_CLI_LANG`                    | 否   | 默认 Steam 内容语言，例如 `english` 或 `schinese`。      |
| `STEAM_CLI_UI_LANG`                 | 否   | 默认 Steam CLI 界面语言，例如 `en` 或 `zh-CN`。          |
| `STEAM_CLI_CACHE_MAX_ENTRIES`       | 否   | Steam CLI 内存缓存最大条目数。                           |
| `STEAM_CLI_CACHE_STALE_TTL_MS`      | 否   | CLI 刷新失败后，可继续使用过期成功响应的时间。           |
| `STEAM_CALENDAR_WATCHED_APP_BUDGET` | 否   | 单个日历请求最多查询多少个关注游戏。                     |

完整本地模板见 [.env.example](.env.example)。

## 脚本

```bash
npm run dev              # 使用 webpack 启动 Next.js
npm run dev:clean        # 清理 .next/dev
npm run build:steam-cli  # 把 vendor/steam-cli 构建到 bin/steam-cli
npm run build            # 生产构建；会先构建 Steam CLI
npm run start            # 启动生产服务
npm run verify           # format、lint、typecheck、unit test、build
npm run verify:full      # verify + 稳定 Playwright e2e
npm run test:e2e:live    # 真实 Steam smoke test
```

生产构建会自动运行 `build:steam-cli`。如果你只是本地检查并明确想跳过二进制重建，可以使用：

```bash
SKIP_STEAM_CLI_BUILD=1 npm run build
```

## 项目结构

```text
src/
  app/                  轻量 App Router 页面和 route handlers
  features/             面向用户的工作流和 UI
  domain/               不依赖框架的日历规则和 ICS 映射
  integrations/         Steam CLI/API adapter、解析、缓存、降级
  server/               HTTP/API 响应编排
  shared/               浏览器/服务端共享合同和校验器

vendor/steam-cli/       Steam CLI submodule
public/assets/brand/    Logo 和应用图标
```

架构边界：

- `src/app` 保持轻量，只放 route handlers、layout 和页面壳。
- `src/features/calendar-builder` 负责交互式日历构建 UI。
- `src/domain/calendar` 负责 feed 配置、日历事件映射和 ICS 输出。
- `src/integrations/steam` 负责 Steam CLI/API 细节和 Steam 专属解析。
- `src/server/calendar` 负责请求级日历编排和 HTTP 响应。
- `src/shared` 放服务端和浏览器都需要共享的 DTO 与运行时校验。

## 测试

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

需要完整信心时：

```bash
npm run verify:full
```

测试策略：

- 单测覆盖日历映射、ICS 生成、Steam 解析、缓存行为、route contract 和响应构建。
- 默认 Playwright 测试使用 mocked Steam 响应，让 CI 保持确定性。
- 真实 Steam smoke test 单独运行，因为 Steam 数据和网络状态会变化：

```bash
npm run test:e2e:live
```

## 数据来源

Steam to Calendar 主要通过 vendored [Steam CLI](https://github.com/nickxudotme/steam-cli) 访问 Steam。Steam CLI 会组合公开 Steam Store、Steam Community、Steam Web API、Steamworks 活动页面，以及可选 IsThereAnyDeal 增强。

默认模式是公开、实时、无需 API key 的。高级价格能力需要设置 `STEAM_CLI_ITAD_KEY`。

## 参与贡献

欢迎提交 issue 和 pull request。提交 PR 前建议运行：

```bash
npm run verify
```

如果是 UI 变更，也请运行相关 Playwright 测试，并手动检查桌面和移动端布局。
