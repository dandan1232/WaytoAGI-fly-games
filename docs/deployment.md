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

生产部署 ID、URL、源提交和匿名验收证据将在首次部署完成后补充。
