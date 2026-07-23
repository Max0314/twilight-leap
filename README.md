# 暮光跃境 · Twilight Leap

一款原创的单关卡浏览器平台跳跃游戏。玩家需要穿越余烬古城，收集 12 枚星辉、避开尖刺并越过两类敌人，最终抵达星门。

项目使用 Next.js、React、TypeScript 与 Canvas 2D。生产构建导出为纯静态文件，由无特权 Nginx 容器提供服务；当前版本不需要 PostgreSQL 或 Redis。

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
curl http://127.0.0.1:3100/healthz
```

端口可以通过 `TWILIGHT_LEAP_PORT` 调整。构建时通过 `NEXT_PUBLIC_SITE_URL` 写入正式 HTTPS 地址：

```bash
docker compose --env-file .env.example up -d --build
```

## 生产部署

完整的 Ubuntu、Docker Compose、宿主机 Nginx、HTTPS、升级和回滚步骤见 [docs/deployment.md](docs/deployment.md)。

游戏记录和音效偏好仅保存在当前浏览器的 `localStorage`。如果未来加入全服排行榜、跨设备存档或账户系统，再接入 PostgreSQL；Redis 只用于限流、Session 或热点排行榜缓存。
