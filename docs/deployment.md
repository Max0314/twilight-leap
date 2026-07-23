# Twilight Leap 自托管部署

## 部署架构

```text
Internet
  -> UFW 80/443
  -> 宿主机 Nginx（TLS）
  -> 127.0.0.1:23002
  -> Twilight Leap Nginx 容器 :8080
```

游戏是静态前端。生产容器不包含 Node.js、源码、开发依赖、数据库驱动或构建工具，也不连接 `fribench-backend`。PostgreSQL 与 Redis 保持现有隔离状态。

## 目录建议

```text
/srv/fribench/apps/games/twilight-leap/releases/<commit>  版本化部署副本
/srv/fribench/apps/games/twilight-leap/current            当前 release
```

当前版本没有 Secret，也不需要创建服务器 `.env`；Compose 默认值就是私有部署配置。

## 首次部署

以下命令由具有 Docker 权限的管理账户执行：

```bash
cd /srv/fribench/apps/games/twilight-leap/current
```

`NEXT_PUBLIC_SITE_URL` 是构建参数。完成 ICP 备案并接入正式 HTTPS 域名后，
通过命令环境覆盖并重新构建镜像。

构建并启动：

```bash
docker compose build --pull

docker compose up -d --remove-orphans

docker compose ps

curl --fail --show-error http://127.0.0.1:23002/healthz
```

容器端口只发布到 Fribench 游戏端口段的 `127.0.0.1:23002`，并使用独立
edge 网络。不要改成 `0.0.0.0`，也不要加入任何数据库网络。

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

docker compose build --pull

docker compose up -d --remove-orphans
```

然后检查容器状态、健康端点、主页和移动端操作。

## 回滚

使用更新前记录的提交：

```bash
cd /srv/fribench/apps/twilight-leap
git checkout --detach <previous-commit>

docker compose build

docker compose up -d
```

确认恢复后再决定是否把 `main` 回退，或提交新的修复版本。

## 日志与检查

```bash
docker compose logs --tail=200 web

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
4. 为该游戏创建专用后端网络，不复用其他项目的数据库网络；数据库和 Redis 仍不发布宿主机端口。
