# 阿里云服务器部署指南

## 📦 打包文件包含内容

最新的打包文件 `xinli-backend-1.0.0-*.zip` 包含以下文件：

### 核心文件
- `main.py` - FastAPI应用入口
- `init_db.py` - 数据库初始化脚本
- `requirements.txt` - Python依赖列表
- `app/` - 应用程序核心代码目录

### 配置文件
- `.env.example` - 环境变量模板
- `.env.production` - 生产环境配置模板

### 部署脚本
- `deploy-final.sh` - **一键部署脚本**（推荐）
- `start_production.sh` - 生产环境启动脚本
- `fix-dependencies.sh` - **依赖兼容性修复脚本**（新增）
- `check_deployment.sh` - 部署状态检查脚本
- `start.sh` - 简单启动脚本

## 🚀 部署步骤

### 方案一：一键部署（推荐）

```bash
# 1. 上传并解压文件
scp xinli-backend-*.zip root@your_server_ip:/opt/
ssh root@your_server_ip
cd /opt
unzip xinli-backend-*.zip
cd xinli-backend-*

# 2. 运行一键部署脚本
chmod +x deploy-final.sh
./deploy-final.sh
```

脚本会要求您输入：
- 数据库密码（默认：SisuInfo@2024#Db8x）
- 微信小程序 AppID
- 微信小程序 Secret
- DeepSeek API Key
- JWT Secret Key（可自动生成）

### 方案二：遇到依赖问题时的修复部署

如果遇到依赖版本兼容性问题，可以先运行修复脚本：

```bash
# 1. 解压后先修复依赖
cd xinli-backend-*
chmod +x fix-dependencies.sh
./fix-dependencies.sh

# 2. 然后继续部署
./deploy-final.sh
```

### 方案三：手动部署

如果自动部署遇到问题，可以参考以下手动步骤：

```bash
# 1. 修复目录权限
chmod 755 /opt/xinli-backend-*
cd /opt/xinli-backend-*

# 2. 安装系统依赖
apt update
apt install -y python3 python3-pip python3-venv postgresql postgresql-contrib nginx certbot python3-certbot-nginx

# 3. 配置数据库
systemctl start postgresql
systemctl enable postgresql
sudo -u postgres psql -c "CREATE USER xinli_user WITH PASSWORD 'your_password';"
sudo -u postgres psql -c "CREATE DATABASE xinli_db OWNER xinli_user;"

# 4. 创建Python环境
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip

# 5. 安装依赖（使用兼容版本）
./fix-dependencies.sh
pip install -r requirements.txt

# 6. 配置环境变量
cp .env.production .env
# 编辑 .env 文件设置正确的配置值

# 7. 初始化数据库
python init_db.py

# 8. 测试服务
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

## 🔧 常见问题解决

### 1. 依赖版本不兼容
**问题**：`ERROR: No matching distribution found for uvicorn[standard]==0.18.3`

**解决**：运行依赖修复脚本
```bash
./fix-dependencies.sh
```

### 2. PostgreSQL权限警告
**问题**：`could not change directory to "/root/...": Permission denied`

**解决**：这是警告，不影响功能，可通过修改目录权限解决
```bash
chmod 755 /opt/xinli-backend-*
```

### 3. 服务无法启动
**问题**：systemd服务启动失败

**解决**：检查配置文件路径
```bash
sudo systemctl status xinli-backend
sudo journalctl -u xinli-backend -f
```

## 📋 部署后验证

```bash
# 检查服务状态
systemctl status xinli-backend
systemctl status nginx
systemctl status postgresql

# 测试API
curl https://www.sisuinfo.top/health
curl https://www.sisuinfo.top/docs

# 查看日志
journalctl -u xinli-backend -f
```

## 🌐 前端配置更新

部署完成后，需要更新小程序前端的API地址：

```javascript
// utils/config.js
production: {
  baseURL: 'https://www.sisuinfo.top',
  timeout: 60000
}
```

## 📞 技术支持

如果遇到问题，请提供以下信息：
1. 服务器系统版本：`cat /etc/os-release`
2. Python版本：`python3 --version`
3. 错误日志：`journalctl -u xinli-backend -n 50`