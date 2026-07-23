# Twilight Leap 自托管部署

## 部署架构

```text
Internet
  -> UFW 80/443
  -> 宿主机 Nginx（TLS）
  -> 127.0.0.1:${TWILIGHT_LEAP_PORT}
  -> Twilight Leap Nginx 容器 :8080
```

游戏是静态前端。生产容器不包含 Node.js、源码、开发依赖、数据库驱动或构建工具，也不连接 `fribench-backend`。PostgreSQL 与 Redis 保持现有隔离状态。

## 目录建议

```text
/srv/fribench/apps/twilight-leap      Git 部署副本
/srv/fribench/ops/twilight-leap       运维记录和可选脚本
/etc/fribench/twilight-leap.env       仅 root 可读的部署环境
```

当前环境文件不含业务密码，但仍统一放在 `/etc/fribench`，为未来增加服务端能力保留清晰边界。

## 首次部署

以下命令由具有 Docker 权限的管理账户执行：

```bash
sudo install -d -o cpl -g cpl /srv/fribench/apps/twilight-leap
git clone https://github.com/Max0314/twilight-leap.git \
  /srv/fribench/apps/twilight-leap
cd /srv/fribench/apps/twilight-leap
```

创建环境文件：

```bash
sudo install -m 600 -o root -g root .env.example \
  /etc/fribench/twilight-leap.env
sudoedit /etc/fribench/twilight-leap.env
```

必须设置：

```dotenv
TWILIGHT_LEAP_PORT=3100
NEXT_PUBLIC_SITE_URL=https://game.example.com
TWILIGHT_LEAP_IMAGE=twilight-leap:local
```

`NEXT_PUBLIC_SITE_URL` 是构建参数，修改后必须重新构建镜像。

构建并启动：

```bash
docker compose \
  --env-file /etc/fribench/twilight-leap.env \
  build --pull

docker compose \
  --env-file /etc/fribench/twilight-leap.env \
  up -d --remove-orphans

docker compose \
  --env-file /etc/fribench/twilight-leap.env \
  ps

curl --fail --show-error http://127.0.0.1:3100/healthz
```

容器端口只发布到 `127.0.0.1`。不要改成 `0.0.0.0`，公网入口统一由宿主机 Nginx 管理。

## 宿主机 Nginx 与 HTTPS

复制 `deploy/host-nginx.conf.example`，把示例域名、证书路径和回环端口改为实际值：

```bash
sudo cp deploy/host-nginx.conf.example \
  /etc/nginx/sites-available/twilight-leap.conf
sudoedit /etc/nginx/sites-available/twilight-leap.conf
sudo ln -s /etc/nginx/sites-available/twilight-leap.conf \
  /etc/nginx/sites-enabled/twilight-leap.conf
sudo nginx -t
sudo systemctl reload nginx
```

证书可以通过现有 ACME/Certbot 流程签发。Nginx 配置和证书验证成功后再开放 Web 端口：

```bash
sudo ufw allow 'Nginx Full'
sudo ufw status verbose
```

正式检查：

```bash
curl --fail --show-error https://game.example.com/healthz
curl --head https://game.example.com/
```

## 更新

更新前记录当前提交：

```bash
cd /srv/fribench/apps/twilight-leap
git rev-parse HEAD
git status -sb
```

工作区干净时执行：

```bash
git pull --ff-only origin main
npm ci
NEXT_PUBLIC_SITE_URL=https://game.example.com npm run verify

docker compose \
  --env-file /etc/fribench/twilight-leap.env \
  build --pull

docker compose \
  --env-file /etc/fribench/twilight-leap.env \
  up -d --remove-orphans
```

然后检查容器状态、健康端点、主页和移动端操作。

## 回滚

使用更新前记录的提交：

```bash
cd /srv/fribench/apps/twilight-leap
git checkout --detach <previous-commit>

docker compose \
  --env-file /etc/fribench/twilight-leap.env \
  build

docker compose \
  --env-file /etc/fribench/twilight-leap.env \
  up -d
```

确认恢复后再决定是否把 `main` 回退，或提交新的修复版本。

## 日志与检查

```bash
docker compose \
  --env-file /etc/fribench/twilight-leap.env \
  logs --tail=200 web

docker inspect \
  --format '{{json .State.Health}}' \
  twilight-leap-web-1
```

Compose 已设置单容器 128 MiB 内存、0.5 CPU、100 个 PID、只读根文件系统、无额外 Linux capability 和 `10 MB x 3` 日志轮转。

## PostgreSQL 与 Redis

当前版本不要为游戏创建数据库或 Redis 账号，也不要把容器加入后端网络。

未来加入全服排行榜、跨设备存档或账户后，再单独实施：

1. PostgreSQL 模式、迁移、最小权限账号和恢复演练。
2. 服务端 API、输入验证、限流与反作弊。
3. 仅在确实需要 Session、限流或热点缓存时连接 Redis。
4. 应用通过外部 `fribench-backend` Docker 网络访问服务，数据库和 Redis 仍不发布宿主机端口。
