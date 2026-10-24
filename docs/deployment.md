# Vercel 部署

用户指定优先部署到 Vercel。项目已使用官方 CLI 登录并关联到 `dandan1232s-projects/waytoagi-fly-games`，GitHub 仓库为 `dandan1232/WaytoAGI-fly-games`。Git 集成已连接，main 推送会触发生产构建。

## 配置

- Framework：Vite。
- Install：`npm ci`。
- Build：`npm run build`，包含 TypeScript 检查。
- Output：`dist`。
- 不需要运行时环境变量和服务端函数。
- `.vercel/`、`.env*`、`work/`、测试报告和截图均不进入部署上传包。

## 命令

```sh
npx vercel login --global-config ./work/vercel-cli
npx vercel link --yes --project waytoagi-fly-games --scope dandan1232s-projects --global-config ./work/vercel-cli
npx vercel deploy --prod --scope dandan1232s-projects --global-config ./work/vercel-cli
```

CLI 的会话配置存放在忽略目录 `work/vercel-cli`，不在命令参数、代码或文档内放置令牌。后续部署应复用 `.vercel/project.json` 和同一项目。部署完成依据为平台 READY、源提交一致以及匿名浏览器实测，而不是仅存在一个预期 URL。

## 线上记录

- 直接游玩：<https://waytoagi-fly-games.vercel.app>。
- 当前游戏版本源提交：`574761308e945748c6de0fe28dd7fa38b423aa66`（KHB AIR 参考图还原版）。
- 对应部署：`dpl_EVdKT1S7eDcjP5JM4MCBaBxeZFgB`，状态 `READY`，GitHub main 自动构建。
- 不变部署地址：<https://waytoagi-fly-games-ehhupwxt7-dandan1232s-projects.vercel.app>。
- 2026-10-25 00:00（Asia/Shanghai）匿名生产验证通过：HTTP 200；JS、CSS、PNG 三项资产与本地构建 SHA-256 一致；桌面、模拟手机触摸和平板开局通过；无脚本错误或失败请求。生产包无开发观测接口。
- 验收脚本：`npm run test:production`。完整报告输出到忽略目录 `work/production-verification.json`，截图同目录保存。

首次版本部署为 `dpl_B1zPsjG2EmeMeU5XtKaGmAD4SFXB`，源提交 `4883ab6e920edd498e0f3c6bc177a40442d55529`。后续文档/验收脚本提交也会触发自动部署；它们不改变上述游戏资源内容。

验证环境的 Node 直接出网超时，而系统浏览器可正常访问；本机为验证进程临时使用已有系统代理并开启 Node 的 `--use-env-proxy`。这属于本机联网设置，不是网站运行时依赖，也没有把代理配置或认证信息写入项目。
