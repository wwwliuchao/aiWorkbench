# Asset Portal

飞书多维表与 Dify 工作流统一入口。第一版只读展示 MySQL 中维护的目录和链接，不提供管理后台，不读取或修改飞书 Base / Dify 内部内容。

## 技术栈

- Next.js App Router
- TypeScript
- Node.js API Routes
- MySQL
- mysql2

## EIP 用户和部门引用

- 登录用户直接读取 `eip.sys_user`，不使用 `asset_portal.sys_user`。
- 部门直接读取 `eip.departmentinfo`。
- 用户唯一标识统一使用 `eip.sys_user.workcode`；没有工号的用户不会进入可选用户列表，也不能登录。
- 应用负责人只保存 `assets.owner_workcode`。
- 应用负责部门只保存 `asset_departments.department_id`。
- 收藏和访问记录保存 `user_workcode`，部门保存 `department_id`，名称在查询时从 EIP 解析。
- `asset_portal_user` 需要拥有 `eip.sys_user`、`eip.departmentinfo` 的 `SELECT` 权限。
- 现有数据库升级执行：`node scripts/migrate-eip-references.cjs`。
- 工号引用升级执行：`node scripts/migrate-user-workcode-references.cjs`。

## 本地启动

1. 安装依赖：

```bash
npm install
```

2. 创建 `.env`：

```bash
cp .env.example .env
```

按实际 MySQL 信息修改 `.env`。

如果要启用飞书单点登录，还需要补充：

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000
FEISHU_APP_ID=<飞书应用 App ID>
FEISHU_APP_SECRET=<飞书应用 App Secret>
FEISHU_REDIRECT_URI=http://localhost:3000/api/auth/feishu/callback
```

3. 初始化数据库：

```bash
mysql -h 127.0.0.1 -u root -p < db/init.sql
```

如果使用非 root 用户，请先创建数据库和授权用户，再执行表结构 SQL。

如果当前库里还没有用户表，执行：

```bash
mysql -h <host> -P <port> -u <user> -p < db/migrate_sys_user.sql
```

如果已经有 `sys_user`，不用重复建表，但要确认它和本项目配置的 `MYSQL_DATABASE` 是同一个库，或者把用户表同步到这个库。

4. 启动开发服务：

```bash
npm run dev
```

打开 `http://localhost:3000`。

## API

- `POST /api/auth/login`：邮箱和密码登录，校验 `sys_user`。
- `POST /api/auth/logout`：退出登录。
- `GET /api/auth/me`：返回当前登录用户。
- `GET /api/auth/feishu/start`：跳转飞书单点登录。
- `GET /api/directories`：返回 `active` 状态目录。
- `GET /api/assets`：返回 `active` 状态资产。
- `GET /api/assets?directoryId=1`：按目录过滤。
- `GET /api/assets?keyword=销售`：按名称、说明、负责人、部门、标签过滤。
- `GET /api/stats?startDate=2026-07-01&endDate=2026-07-31`：按访问日期范围返回统计报表。

## 用户登录

系统使用已有的 `sys_user` 作为用户表：

- 邮箱登录只匹配 `sys_user.email`。
- 只允许 `status = 1` 的用户登录。
- 密码按 `MD5(明文密码).toUpperCase()` 与 `user_password` 比对。
- 飞书单点登录成功后，会用飞书返回的邮箱匹配 `sys_user.email`，匹配不到或用户停用则拒绝进入。

最少需要这些字段可用：

- `user_id`
- `email`
- `user_password`
- `status`
- `chinese_name`
- `english_name`
- `first_name`
- `last_name`
- `department_name`

## Docker 部署

CentOS 7 建议用 Docker 运行本项目，避免宿主机 Node.js 版本和 glibc 版本不兼容。

### 1. 安装 Docker

```bash
sudo yum install -y yum-utils device-mapper-persistent-data lvm2
sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
sudo yum install -y docker-ce docker-ce-cli containerd.io
sudo systemctl enable docker
sudo systemctl start docker
docker --version
```

如果服务器已经有 Docker，可跳过这一步。

### 2. 准备生产环境变量

在服务器项目目录创建 `.env.production`：

```bash
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://your-domain.example.com
FEISHU_APP_ID=your_feishu_app_id
FEISHU_APP_SECRET=your_feishu_app_secret
FEISHU_REDIRECT_URI=https://your-domain.example.com/api/auth/feishu/callback

MYSQL_HOST=your_mysql_host
MYSQL_PORT=3306
MYSQL_DATABASE=asset_portal
MYSQL_USER=asset_portal_user
MYSQL_PASSWORD=your_mysql_password
```

飞书应用主页可以配置为：

```text
https://your-domain.example.com/api/auth/feishu/start
```

这样用户在飞书里点击应用，会直接进入飞书单点登录流程。

如果只能使用已有域名 `erp.huahui-in.com`，可以部署到子路径：

```env
NEXT_PUBLIC_BASE_PATH=/ai-workbench
NEXT_PUBLIC_APP_URL=https://erp.huahui-in.com/ai-workbench
FEISHU_REDIRECT_URI=https://erp.huahui-in.com/ai-workbench/api/auth/feishu/callback
```

飞书应用主页配置为：

```text
https://erp.huahui-in.com/ai-workbench/api/auth/feishu/start
```

### 3. 构建并启动容器

如果服务器安装了 Docker Compose v2：

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

如果没有 Docker Compose：

```bash
docker build -t asset-portal:latest .
docker rm -f asset-portal 2>/dev/null || true
docker run -d \
  --name asset-portal \
  --restart unless-stopped \
  --env-file .env.production \
  -p 3000:3000 \
  asset-portal:latest
```

查看状态和日志：

```bash
docker ps
docker logs -f asset-portal
```

### 4. Nginx 反向代理

```nginx
server {
  listen 80;
  server_name your-domain.example.com;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }
}
```

生产环境建议配置 HTTPS，并把 `NEXT_PUBLIC_APP_URL` 和 `FEISHU_REDIRECT_URI` 都改成 `https://` 地址。

如果部署在 `https://erp.huahui-in.com/ai-workbench`，Nginx 在现有 `erp.huahui-in.com` 的 443 `server` 内增加：

```nginx
location ^~ /ai-workbench {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;

    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto https;
    proxy_set_header X-Forwarded-Host $host;

    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";

    proxy_read_timeout 300s;
    proxy_send_timeout 300s;
    proxy_redirect off;
}
```

注意这个 `location` 要放在现有 `location /` 前面，避免被 ERP 前端静态页接管。

## 数据维护

第一版通过 MySQL 直接维护：

- 新增目录：向 `directories` 插入 `active` 记录。
- 新增子目录：向 `directories` 插入记录，并把 `parent_id` 设置为上级目录 `id`；可以继续向下挂多级。
- 新增资产：向 `assets` 插入 `active` 记录，并填写 `directory_id`。
- 停用目录或资产：把 `status` 改为 `inactive`。

侧边栏支持多级目录。旧数据库如果还没有 `directories.parent_id` 字段，可以执行：

```bash
mysql -h <host> -P <port> -u <user> -p < db/migrate_two_level_directories.sql
```

如果不执行迁移，系统仍可按一级目录展示，不会影响现有资产读取。执行迁移后，点击任意层级目录都会展示该目录及其所有子孙目录下的资产。

访问数统计需要给 `assets` 增加 `click_count` 字段：

```bash
mysql -h <host> -P <port> -u <user> -p < db/migrate_asset_clicks.sql
```

执行后，点击应用名称会自动累计访问数，左侧「统计报表」页面会按应用展示对应访问数。

Asset department migration:
```bash
mysql -h <host> -P <port> -u <user> -p < db/migrate_asset_department.sql
```

After this migration, maintain the owning department in `assets.department_name`.

Asset visit log migration:
```bash
mysql -h <host> -P <port> -u <user> -p < db/migrate_asset_visit_logs.sql
```

After this migration, new clicks are written to `asset_visit_logs`; the stats page can show today, 7-day, 30-day, department, user and daily trend reports.

`assets.type` 只允许：

- `feishu_base`
- `dify_workflow`

## 后续计划

- 完善飞书 OAuth 登录的线上应用配置和权限范围。
- 增加目录级权限。
- 增加管理后台。
- 增加 Linux 部署脚本、PM2 配置和 Nginx 示例。
