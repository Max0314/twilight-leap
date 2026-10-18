# 暮光跃境 · Twilight Leap

2026-10-18：原生账号插槽在 React 完成 hydration 后才交给公共视图渲染，避免外部 DOM 注入造成整页重绘；开始、暂停与结果页的显示规则不变。

一款原创的单关卡浏览器平台跳跃游戏。玩家需要穿越余烬古城，收集 12 枚星辉、避开尖刺并越过两类敌人，最终抵达星门。

项目使用 Next.js、React、TypeScript 与 Canvas 2D。游戏生产构建仍为纯静态文件，由无特权 Nginx 容器提供服务；可选账号云存档通过公共接入服务使用 PostgreSQL 持久化，Redis 仅承担限流。

## 操作

- 移动：`A` / `D` 或左右方向键
- 跳跃：`W`、上方向键或空格
- 再次按跳跃键：二段跳
- 贴墙下落时按跳跃键：蹬墙跳
- 暂停：`Esc`
- 重新开始：`R`
- 手机：左右移动按钮与跳跃按钮支持同时按住，建议横屏游玩

## 本地开发

要求 Node.js 22.13 或更高版本。

```bash
npm ci
npm run dev
```

默认访问 `http://localhost:3000`。

## 验证

```bash
npm run verify
docker compose config
docker compose build
docker compose up -d
curl http://127.0.0.1:23002/healthz
```

端口可以通过 `TWILIGHT_LEAP_PORT` 调整。构建时通过 `NEXT_PUBLIC_SITE_URL` 写入正式 HTTPS 地址：

```bash
docker compose --env-file .env.example up -d --build
```

## 生产部署

完整的 Ubuntu、Docker Compose、宿主机 Nginx、HTTPS、升级和回滚步骤见 [docs/deployment.md](docs/deployment.md)。

2026-10-15 统一登录与云存档接入代码已完成验证，生产状态见运维清单。公开游戏仍可匿名游玩，已有中央登录态自动识别。游客与各账号的最快用时、星辉和音效偏好分别存储，登录不隐式覆盖或上传游客进度。

账号记录及偏好变更可自动保存，空白设备可恢复云端数据。游客进度须预览、显式确认后认领，每个账号在本游戏仅有一次成功机会，失败不消耗，其他游戏独立计算。账号切换返回开始界面，旧对局的异步结算不能写入新账号，打开账号面板暂停游戏。当前只保存记录与偏好，不宣称支持半局位置恢复。

通过同源 `/_fribench/` 使用公共 OAuth BFF，不把服务端密钥、令牌写进静态资源。Next 和图片依赖已按 2026-10-15 公告升级；单元、渲染、类型和生产依赖审计需全部通过后发布。
