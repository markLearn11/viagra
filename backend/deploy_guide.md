# 服务器部署完整指南

## 部署架构

```
用户请求 → 备案域名 → Nginx (反向代理) → FastAPI 后端服务 → PostgreSQL 数据库
```

## 第一步：服务器环境准备

### 1.1 系统要求
- 操作系统：Ubuntu 18.04+ / CentOS 7+ / Debian 9+
- 内存：至少 2GB RAM
- 存储：至少 20GB 可用空间
- Python：3.8 或更高版本

### 1.2 安装必要软件

#### Ubuntu/Debian 系统：
```bash
# 更新系统包
sudo apt update && sudo apt upgrade -y

# 安装 Python3 和相关工具
sudo apt install python3 python3-pip python3-venv -y

# 安装 PostgreSQL
sudo apt install postgresql postgresql-contrib -y

# 安装 Nginx
sudo apt install nginx -y

# 安装 Redis (可选，用于缓存和限流)
sudo apt install redis-server -y

# 安装其他必要工具
sudo apt install git curl wget unzip -y
```

#### CentOS/RHEL 系统：
```bash
# 更新系统包
sudo yum update -y

# 安装 Python3 和相关工具
sudo yum install python3 python3-pip -y

# 安装 PostgreSQL
sudo yum install postgresql postgresql-server postgresql-contrib -y
sudo postgresql-setup initdb
sudo systemctl enable postgresql

# 安装 Nginx
sudo yum install nginx -y

# 安装 Redis
sudo yum install redis -y

# 安装其他必要工具
sudo yum install git curl wget unzip -y
```

## 第二步：上传和部署应用

### 2.1 上传部署包
```bash
# 在本地将打包好的文件上传到服务器
scp dist/xinli-backend-1.0.0-*.zip user@your-server-ip:/opt/
```

### 2.2 解压和配置
```bash
# 在服务器上执行
cd /opt
sudo unzip xinli-backend-1.0.0-*.zip
sudo mv xinli-backend-* xinli-backend
sudo chown -R $USER:$USER xinli-backend
cd xinli-backend
```

## 第三步：配置数据库

### 3.1 配置 PostgreSQL
```bash
# 切换到 postgres 用户
sudo -u postgres psql

# 在 PostgreSQL 中创建数据库和用户
CREATE USER xinli_user WITH PASSWORD 'your_secure_password';
CREATE DATABASE xinli_db OWNER xinli_user;
GRANT ALL PRIVILEGES ON DATABASE xinli_db TO xinli_user;
\q
```

### 3.2 配置数据库连接
```bash
# 编辑 PostgreSQL 配置文件
sudo nano /etc/postgresql/*/main/postgresql.conf

# 找到并修改以下行（取消注释并修改）
listen_addresses = 'localhost'

# 编辑访问控制文件
sudo nano /etc/postgresql/*/main/pg_hba.conf

# 添加以下行（在其他规则之前）
local   xinli_db        xinli_user                              md5

# 重启 PostgreSQL
sudo systemctl restart postgresql
```

## 第四步：配置环境变量

### 4.1 创建生产环境配置
```bash
# 在应用目录中创建 .env 文件
cd /opt/xinli-backend
cp .env.example .env
nano .env
```

### 4.2 编辑环境变量
```bash
# 数据库配置
DATABASE_URL=postgresql://xinli_user:your_secure_password@localhost/xinli_db

# 微信小程序配置
WECHAT_APPID=your_wechat_appid
WECHAT_SECRET=your_wechat_secret

# DeepSeek AI 配置
DEEPSEEK_API_KEY=your_deepseek_api_key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat

# 其他配置
JWT_SECRET_KEY=your_jwt_secret_key_here
ALLOWED_HOSTS=["your-domain.com", "localhost"]
```

## 第五步：初始化应用

### 5.1 安装依赖和初始化
```bash
cd /opt/xinli-backend

# 创建虚拟环境
python3 -m venv venv
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 初始化数据库
python init_db.py
```

## 第六步：配置 Nginx

### 6.1 创建 Nginx 配置文件
```bash
sudo nano /etc/nginx/sites-available/xinli-backend
```

### 6.2 Nginx 配置内容
```nginx
# HTTP 重定向到 HTTPS
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    
    # 重定向所有 HTTP 请求到 HTTPS
    return 301 https://$server_name$request_uri;
}

# HTTPS 主配置
server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;
    
    # SSL 证书配置（稍后配置）
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    
    # SSL 安全配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # 安全头部
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
    # 日志配置
    access_log /var/log/nginx/xinli-backend.access.log;
    error_log /var/log/nginx/xinli-backend.error.log;
    
    # 后端服务代理
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
        proxy_connect_timeout 10s;
        
        # 缓冲配置
        proxy_buffering on;
        proxy_buffer_size 128k;
        proxy_buffers 4 256k;
        proxy_busy_buffers_size 256k;
    }
    
    # 静态文件缓存（如果有）
    location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # 健康检查接口
    location /health {
        proxy_pass http://127.0.0.1:8000/health;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 6.3 启用配置
```bash
# 启用网站配置
sudo ln -s /etc/nginx/sites-available/xinli-backend /etc/nginx/sites-enabled/

# 测试 Nginx 配置
sudo nginx -t

# 如果测试通过，重启 Nginx（SSL 配置完成后再执行）
# sudo systemctl restart nginx
```

## 第七步：配置 SSL 证书

### 7.1 使用 Let's Encrypt（推荐）
```bash
# 安装 Certbot
sudo apt install certbot python3-certbot-nginx -y

# 临时禁用 SSL 配置以获取证书
sudo nano /etc/nginx/sites-available/xinli-backend
# 注释掉 SSL 相关配置行，保留 HTTP 配置

# 重启 Nginx
sudo systemctl restart nginx

# 获取 SSL 证书
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# 恢复完整的 Nginx 配置
sudo nano /etc/nginx/sites-available/xinli-backend
# 取消注释 SSL 配置

# 重启 Nginx
sudo systemctl restart nginx
```

### 7.2 使用自有证书
如果您有自己的 SSL 证书：
```bash
# 创建证书目录
sudo mkdir -p /etc/nginx/ssl

# 上传证书文件到服务器
sudo cp your-certificate.crt /etc/nginx/ssl/
sudo cp your-private-key.key /etc/nginx/ssl/

# 修改 Nginx 配置中的证书路径
ssl_certificate /etc/nginx/ssl/your-certificate.crt;
ssl_certificate_key /etc/nginx/ssl/your-private-key.key;
```

## 第八步：创建系统服务

### 8.1 创建 systemd 服务文件
```bash
sudo nano /etc/systemd/system/xinli-backend.service
```

### 8.2 服务配置内容
```ini
[Unit]
Description=Xinli Backend API Service
After=network.target postgresql.service

[Service]
Type=simple
User=ubuntu
Group=ubuntu
WorkingDirectory=/opt/xinli-backend
Environment=PATH=/opt/xinli-backend/venv/bin
ExecStart=/opt/xinli-backend/venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000 --workers 2
ExecReload=/bin/kill -s HUP $MAINPID
KillMode=mixed
TimeoutStopSec=5
PrivateTmp=true
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### 8.3 启动服务
```bash
# 重新加载 systemd
sudo systemctl daemon-reload

# 启用开机自启
sudo systemctl enable xinli-backend

# 启动服务
sudo systemctl start xinli-backend

# 检查服务状态
sudo systemctl status xinli-backend
```

## 第九步：验证部署

### 9.1 检查服务状态
```bash
# 检查后端服务
sudo systemctl status xinli-backend
curl http://localhost:8000/health

# 检查 Nginx
sudo systemctl status nginx
sudo nginx -t

# 检查数据库
sudo systemctl status postgresql
```

### 9.2 测试 API 访问
```bash
# 测试健康检查
curl https://your-domain.com/health

# 测试 API 文档
curl https://your-domain.com/docs

# 查看日志
sudo journalctl -u xinli-backend -f
sudo tail -f /var/log/nginx/xinli-backend.access.log
sudo tail -f /var/log/nginx/xinli-backend.error.log
```

## 第十步：安全和优化

### 10.1 防火墙配置
```bash
# Ubuntu/Debian
sudo ufw enable
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443

# CentOS/RHEL
sudo firewall-cmd --permanent --add-service=ssh
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

### 10.2 定期任务设置
```bash
# 设置自动更新证书
sudo crontab -e

# 添加以下行（每月1号凌晨2点更新证书）
0 2 1 * * /usr/bin/certbot renew --quiet && /bin/systemctl reload nginx
```

### 10.3 日志轮转
```bash
sudo nano /etc/logrotate.d/xinli-backend
```

```
/var/log/nginx/xinli-backend.*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 0644 www-data www-data
    postrotate
        /bin/systemctl reload nginx
    endscript
}
```

## 故障排除

### 常见问题及解决方案

1. **服务无法启动**
   ```bash
   sudo journalctl -u xinli-backend -f
   ```

2. **数据库连接失败**
   ```bash
   sudo -u postgres psql -d xinli_db -c "SELECT 1;"
   ```

3. **Nginx 配置错误**
   ```bash
   sudo nginx -t
   sudo systemctl status nginx
   ```

4. **SSL 证书问题**
   ```bash
   sudo certbot certificates
   sudo certbot renew --dry-run
   ```

5. **端口被占用**
   ```bash
   sudo lsof -i :8000
   sudo lsof -i :80
   sudo lsof -i :443
   ```

## 性能监控

### 监控脚本
```bash
# 创建监控脚本
sudo nano /opt/xinli-backend/monitor.sh
```

```bash
#!/bin/bash
echo "=== 系统状态监控 ==="
echo "时间: $(date)"
echo "CPU 使用率: $(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | awk -F'%' '{print $1}')"
echo "内存使用: $(free -h | awk '/^Mem:/ {print $3 "/" $2}')"
echo "磁盘使用: $(df -h / | awk 'NR==2 {print $3 "/" $2 " (" $5 ")"}')"
echo "后端服务状态: $(systemctl is-active xinli-backend)"
echo "Nginx 状态: $(systemctl is-active nginx)"
echo "数据库状态: $(systemctl is-active postgresql)"
echo "============================="
```

```bash
chmod +x /opt/xinli-backend/monitor.sh

# 设置定时监控
crontab -e
# 添加：*/5 * * * * /opt/xinli-backend/monitor.sh >> /var/log/xinli-monitor.log 2>&1
```

部署完成后，您的 API 将可以通过以下地址访问：
- 主域名：https://your-domain.com
- API 文档：https://your-domain.com/docs
- 健康检查：https://your-domain.com/health

记得将 `your-domain.com` 替换为您的实际域名！