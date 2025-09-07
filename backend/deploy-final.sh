#!/bin/bash
# sisuinfo.top 一次性完整部署脚本
# 支持阿里云 Linux / CentOS / Ubuntu 等多种系统

set -e

# 配置常量
DOMAIN="sisuinfo.top"
WWW_DOMAIN="www.sisuinfo.top"
APP_DIR="/opt/xinli-backend"
APP_USER="ubuntu"
APP_GROUP="ubuntu"

echo "======================================"
echo "  栖溯光屿心理健康 API 部署脚本"
echo "  域名: $DOMAIN"
echo "  系统: 自动检测"
echo "======================================"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# 系统检测
detect_system() {
    log_info "检测系统环境..."
    
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        DISTRO="$ID"
        VERSION="$VERSION_ID"
    elif [ -f /etc/redhat-release ]; then
        DISTRO="centos"
    elif [ -f /etc/debian_version ]; then
        DISTRO="ubuntu"
    else
        DISTRO="unknown"
    fi
    
    # 设置包管理器和管理员组
    case $DISTRO in
        ubuntu|debian)
            PKG_UPDATE="apt update"
            PKG_INSTALL="apt install -y"
            ADMIN_GROUP="sudo"
            NGINX_SITES_DIR="/etc/nginx/sites-available"
            NGINX_ENABLED_DIR="/etc/nginx/sites-enabled"
            ;;
        centos|rhel|fedora|alinux|alios)
            PKG_UPDATE="yum makecache"
            PKG_INSTALL="yum install -y"
            ADMIN_GROUP="wheel"
            NGINX_SITES_DIR="/etc/nginx/conf.d"
            NGINX_ENABLED_DIR="/etc/nginx/conf.d"
            ;;
        *)
            log_error "不支持的系统: $DISTRO"
            ;;
    esac
    
    log_success "系统: $DISTRO, 包管理器: ${PKG_INSTALL%% *}, 管理员组: $ADMIN_GROUP"
}

# 用户权限处理
setup_user() {
    if [ "$EUID" -eq 0 ]; then
        log_info "以 root 用户运行，创建应用用户..."
        
        if ! id "$APP_USER" &>/dev/null; then
            useradd -m -s /bin/bash $APP_USER
            if getent group $ADMIN_GROUP >/dev/null 2>&1; then
                usermod -aG $ADMIN_GROUP $APP_USER
                log_success "用户 $APP_USER 已创建并添加到 $ADMIN_GROUP 组"
            else
                log_warning "管理员组 $ADMIN_GROUP 不存在"
            fi
        fi
    else
        APP_USER="$USER"
        APP_GROUP="$USER"
    fi
    
    log_info "应用将以用户 $APP_USER 运行"
}

# 获取配置信息
get_config() {
    echo
    echo "请提供配置信息（回车使用默认值）："
    
    read -p "数据库密码 [SisuInfo@2024#Db8x]: " -s DB_PASSWORD
    echo
    read -p "微信小程序 AppID: " WECHAT_APPID
    read -p "微信小程序 Secret: " -s WECHAT_SECRET
    echo
    read -p "DeepSeek API Key: " -s DEEPSEEK_API_KEY
    echo
    read -p "JWT Secret Key (留空自动生成): " JWT_SECRET
    
    # 设置默认值
    DB_PASSWORD=${DB_PASSWORD:-"SisuInfo@2024#Db8x"}
    JWT_SECRET=${JWT_SECRET:-$(openssl rand -hex 32)}
    
    # 验证必要参数
    if [ -z "$WECHAT_APPID" ] || [ -z "$WECHAT_SECRET" ] || [ -z "$DEEPSEEK_API_KEY" ]; then
        log_error "微信配置和 DeepSeek API Key 是必需的"
    fi
    
    log_success "配置收集完成"
}

# 安装系统依赖
install_dependencies() {
    log_info "安装系统依赖..."
    
    $PKG_UPDATE
    
    # 基础依赖
    $PKG_INSTALL python3 python3-pip curl wget unzip git openssl
    
    # 安装 PostgreSQL
    case $DISTRO in
        ubuntu|debian)
            $PKG_INSTALL postgresql postgresql-contrib python3-venv
            ;;
        centos|rhel|fedora|alinux|alios)
            $PKG_INSTALL postgresql postgresql-server postgresql-contrib
            # 初始化数据库
            if [ ! -f /var/lib/pgsql/data/postgresql.conf ]; then
                postgresql-setup initdb 2>/dev/null || /usr/bin/postgresql-setup initdb 2>/dev/null || sudo -u postgres /usr/bin/initdb -D /var/lib/pgsql/data
            fi
            # 安装 virtualenv
            pip3 install virtualenv
            ;;
    esac
    
    # 安装 Nginx
    $PKG_INSTALL nginx
    
    # 安装 Certbot
    if [ "$DISTRO" = "ubuntu" ] || [ "$DISTRO" = "debian" ]; then
        $PKG_INSTALL certbot python3-certbot-nginx
    else
        $PKG_INSTALL epel-release || true
        $PKG_INSTALL certbot python3-certbot-nginx || pip3 install certbot certbot-nginx
    fi
    
    log_success "系统依赖安装完成"
}

# 配置数据库
setup_database() {
    log_info "配置 PostgreSQL..."
    
    systemctl start postgresql
    systemctl enable postgresql
    sleep 3
    
    # 创建数据库和用户
    sudo -u postgres psql -c "DROP DATABASE IF EXISTS xinli_db;" 2>/dev/null || true
    sudo -u postgres psql -c "DROP USER IF EXISTS xinli_user;" 2>/dev/null || true
    sudo -u postgres psql -c "CREATE USER xinli_user WITH PASSWORD '$DB_PASSWORD';"
    sudo -u postgres psql -c "CREATE DATABASE xinli_db OWNER xinli_user;"
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE xinli_db TO xinli_user;"
    
    log_success "数据库配置完成"
}

# 部署应用
deploy_app() {
    log_info "部署应用到 $APP_DIR..."
    
    # 创建应用目录
    mkdir -p $APP_DIR
    cp -r ./* $APP_DIR/
    chown -R $APP_USER:$APP_GROUP $APP_DIR
    cd $APP_DIR
    
    # 创建兼容的 requirements 文件
    cat > requirements-compatible.txt << 'EOF'
fastapi==0.83.0
uvicorn[standard]==0.18.3
sqlalchemy==1.4.46
psycopg2-binary==2.9.5
alembic==1.8.1
pydantic==1.10.8
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.5
python-dotenv==0.19.2
requests==2.28.2
pytest==7.2.1
pytest-asyncio==0.20.3
httpx==0.23.3
pytz==2022.7.1
EOF
    
    # 创建虚拟环境和安装依赖
    if [ "$EUID" -eq 0 ]; then
        sudo -u $APP_USER bash -c "
            cd $APP_DIR
            rm -rf venv
            
            # 选择虚拟环境工具
            if python3 -m venv --help >/dev/null 2>&1; then
                python3 -m venv venv
            else
                python3 -m virtualenv venv
            fi
            
            source venv/bin/activate
            pip install --upgrade pip
            
            # 优先使用兼容版本
            pip install -r requirements-compatible.txt || pip install -r requirements.txt
        "
    else
        rm -rf venv
        if python3 -m venv --help >/dev/null 2>&1; then
            python3 -m venv venv
        else
            python3 -m virtualenv venv
        fi
        
        source venv/bin/activate
        pip install --upgrade pip
        pip install -r requirements-compatible.txt || pip install -r requirements.txt
    fi
    
    # 创建环境配置
    cat > .env << EOF
# 数据库配置
DATABASE_URL=postgresql://xinli_user:$DB_PASSWORD@localhost/xinli_db

# 微信小程序配置
WECHAT_APPID=$WECHAT_APPID
WECHAT_SECRET=$WECHAT_SECRET

# DeepSeek AI 配置
DEEPSEEK_API_KEY=$DEEPSEEK_API_KEY
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat

# JWT 配置
JWT_SECRET_KEY=$JWT_SECRET

# 域名配置
ALLOWED_HOSTS=["$DOMAIN", "$WWW_DOMAIN", "localhost", "127.0.0.1"]
DEBUG=false
CORS_ORIGINS=["https://$DOMAIN", "https://$WWW_DOMAIN"]
TRUSTED_HOSTS=["$DOMAIN", "$WWW_DOMAIN"]
EOF
    
    chmod 600 .env
    chown $APP_USER:$APP_GROUP .env
    
    # 初始化数据库
    if [ "$EUID" -eq 0 ]; then
        sudo -u $APP_USER bash -c "cd $APP_DIR && source venv/bin/activate && python init_db.py"
    else
        source venv/bin/activate && python init_db.py
    fi
    
    log_success "应用部署完成"
}

# 配置系统服务
setup_systemd() {
    log_info "配置系统服务..."
    
    cat > /etc/systemd/system/xinli-backend.service << EOF
[Unit]
Description=Xinli Backend API Service
After=network.target postgresql.service

[Service]
Type=simple
User=$APP_USER
Group=$APP_GROUP
WorkingDirectory=$APP_DIR
Environment=PATH=$APP_DIR/venv/bin
ExecStart=$APP_DIR/venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000 --workers 2
ExecReload=/bin/kill -s HUP \$MAINPID
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
    
    systemctl daemon-reload
    systemctl enable xinli-backend
    
    log_success "系统服务配置完成"
}

# 配置 Nginx
setup_nginx() {
    log_info "配置 Nginx..."
    
    # 创建 Nginx 配置
    NGINX_CONF="$NGINX_SITES_DIR/xinli-backend.conf"
    
    cat > $NGINX_CONF << EOF
server {
    listen 80;
    server_name $DOMAIN $WWW_DOMAIN;
    
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
    
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }
}
EOF
    
    # 启用配置（Ubuntu/Debian 需要软链接）
    if [ "$DISTRO" = "ubuntu" ] || [ "$DISTRO" = "debian" ]; then
        ln -sf $NGINX_CONF /etc/nginx/sites-enabled/
        rm -f /etc/nginx/sites-enabled/default
    fi
    
    nginx -t && log_success "Nginx 配置创建成功" || log_error "Nginx 配置验证失败"
}

# 配置 SSL 证书
setup_ssl() {
    log_info "配置 SSL 证书..."
    
    systemctl start nginx
    systemctl enable nginx
    
    if certbot --nginx -d $DOMAIN -d $WWW_DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN; then
        log_success "SSL 证书配置成功"
        
        # 更新配置强制 HTTPS
        cat > $NGINX_CONF << EOF
server {
    listen 80;
    server_name $DOMAIN $WWW_DOMAIN;
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name $DOMAIN $WWW_DOMAIN;
    
    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
    
    location /health {
        proxy_pass http://127.0.0.1:8000/health;
        proxy_set_header Host \$host;
        add_header Cache-Control "no-cache";
    }
    
    location /docs {
        proxy_pass http://127.0.0.1:8000/docs;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF
        systemctl reload nginx
    else
        log_warning "SSL 证书配置失败，将使用 HTTP"
    fi
}

# 启动服务
start_services() {
    log_info "启动所有服务..."
    
    systemctl start xinli-backend
    systemctl start nginx
    
    # 等待服务启动
    sleep 5
    
    # 验证服务状态
    for service in xinli-backend nginx postgresql; do
        if systemctl is-active --quiet $service; then
            log_success "$service 运行正常"
        else
            log_warning "$service 状态异常"
        fi
    done
    
    # 测试 API
    if curl -f -s http://localhost:8000/health >/dev/null; then
        log_success "API 服务响应正常"
    else
        log_warning "API 服务无响应，请检查日志"
    fi
}

# 显示部署结果
show_results() {
    echo
    echo "======================================"
    log_success "部署完成！"
    echo "======================================"
    echo
    echo "🌐 访问地址："
    echo "   主域名: https://$DOMAIN"
    echo "   API文档: https://$WWW_DOMAIN/docs"
    echo "   健康检查: https://$WWW_DOMAIN/health"
    echo
    echo "📁 重要路径："
    echo "   应用目录: $APP_DIR"
    echo "   配置文件: $APP_DIR/.env"
    echo "   Nginx配置: $NGINX_CONF"
    echo "   系统服务: /etc/systemd/system/xinli-backend.service"
    echo
    echo "🔧 管理命令："
    echo "   查看状态: systemctl status xinli-backend"
    echo "   重启服务: systemctl restart xinli-backend"
    echo "   查看日志: journalctl -u xinli-backend -f"
    echo "   测试API: curl https://$WWW_DOMAIN/health"
    echo
    echo "📋 数据库信息："
    echo "   数据库: xinli_db"
    echo "   用户: xinli_user"
    echo "   主机: localhost"
    echo
    echo "⚠️  安全提示："
    echo "   - 定期备份数据库"
    echo "   - 定期更新系统和依赖"
    echo "   - 监控服务运行状态"
    echo "   - SSL证书自动续期已配置"
    echo
}

# 清理多余脚本
cleanup_scripts() {
    log_info "清理多余的部署脚本..."
    
    # 保留的文件
    KEEP_FILES=("deploy-final.sh" "main.py" "requirements.txt" "init_db.py" ".env.example" "README.md")
    
    # 删除其他部署脚本
    for script in deploy*.sh; do
        if [ "$script" != "deploy-final.sh" ] && [ -f "$script" ]; then
            rm -f "$script"
            log_info "删除: $script"
        fi
    done
    
    # 删除多余的配置文件
    rm -f nginx.conf sisuinfo-deploy.conf requirements-*.txt fix-*.sh debug-*.sh
    
    # 删除scripts目录（如果存在）
    if [ -d "scripts" ]; then
        rm -rf scripts
        log_info "删除: scripts/ 目录"
    fi
    
    log_success "脚本清理完成"
}

# 主函数
main() {
    # 检查运行环境
    if [ ! -f "main.py" ] || [ ! -f "requirements.txt" ]; then
        log_error "请在后端项目目录中运行此脚本"
    fi
    
    # 执行部署流程
    detect_system
    setup_user
    get_config
    install_dependencies
    setup_database
    deploy_app
    setup_systemd
    setup_nginx
    setup_ssl
    start_services
    cleanup_scripts
    show_results
    
    echo "🎉 部署流程全部完成！"
}

# 异常处理
trap 'log_error "部署过程中发生错误，请检查日志"' ERR

# 运行主函数
main "$@"
