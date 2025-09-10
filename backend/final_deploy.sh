#!/bin/bash
# 栖溯光屿心理健康API - 一体化部署脚本（阿里云优化版 + PostgreSQL认证修复）
# 集成部署、修复、诊断功能

set -e

# 配置常量
DOMAIN="sisuinfo.top"
WWW_DOMAIN="www.sisuinfo.top"
APP_DIR="/opt/xinli-backend"
APP_USER="ubuntu"
APP_GROUP="ubuntu"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

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
            ;;
        centos|rhel|fedora|alinux|alios)
            PKG_UPDATE="yum makecache"
            PKG_INSTALL="yum install -y"
            ADMIN_GROUP="wheel"
            ;;
        *)
            log_error "不支持的系统: $DISTRO"
            exit 1
            ;;
    esac
    
    log_success "系统: $DISTRO ($VERSION)"
}

# 确保应用用户存在
ensure_app_user() {
    if ! id "$APP_USER" &>/dev/null; then
        log_info "创建应用用户: $APP_USER"
        if command -v useradd >/dev/null; then
            useradd -m -s /bin/bash "$APP_USER" 2>/dev/null || useradd -m -s /bin/sh "$APP_USER"
        else
            log_error "无法创建用户，请手动创建或修改 APP_USER"
            exit 1
        fi
    fi
    if ! groups "$APP_USER" | grep -q "$ADMIN_GROUP"; then
        usermod -aG "$ADMIN_GROUP" "$APP_USER"
        log_info "用户 $APP_USER 已加入组 $ADMIN_GROUP"
    fi
    log_success "应用用户准备完成: $APP_USER"
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
        exit 1
    fi
    
    log_success "配置收集完成"
}

# 安装系统依赖
install_dependencies() {
    log_info "安装系统依赖..."
    
    $PKG_UPDATE
    
    case $DISTRO in
        ubuntu|debian)
            $PKG_INSTALL python3 python3-pip curl wget unzip git openssl \
                        python3-venv build-essential python3-dev libpq-dev libssl-dev
            $PKG_INSTALL postgresql postgresql-contrib
            ;;
        centos|rhel|fedora|alinux|alios)
            $PKG_INSTALL python3 python3-pip curl wget unzip git openssl \
                        gcc gcc-c++ make python3-devel postgresql-devel openssl-devel
            $PKG_INSTALL postgresql postgresql-server postgresql-contrib
            # 初始化数据库（如果未初始化）
            if [ ! -f /var/lib/pgsql/data/postgresql.conf ] && command -v postgresql-setup >/dev/null; then
                postgresql-setup initdb 2>/dev/null || /usr/bin/postgresql-setup initdb 2>/dev/null || true
            fi
            ;;
    esac
    
    log_success "系统依赖安装完成"
}

# 配置数据库
setup_database() {
    log_info "配置 PostgreSQL..."
    
    systemctl start postgresql
    systemctl enable postgresql
    sleep 3
    
    # 切换到公共目录，避免 Permission denied
    cd /tmp
    
    # 创建数据库和用户
    sudo -u postgres psql -c "CREATE USER xinli_user WITH PASSWORD '$DB_PASSWORD';" 2>/dev/null || true
    sudo -u postgres psql -c "CREATE DATABASE xinli_db OWNER xinli_user;" 2>/dev/null || true
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE xinli_db TO xinli_user;"
    
    log_success "数据库配置完成"
}

# 自动修复 PostgreSQL 本地认证方式（解决 Ident authentication failed）
fix_pg_auth() {
    log_info "正在修复 PostgreSQL 本地认证方式 (解决 Ident authentication failed)..."

    # 自动获取 pg_hba.conf 路径
    HBA_FILE=$(sudo -u postgres psql -t -c "SHOW hba_file;" 2>/dev/null | xargs)
    if [ -z "$HBA_FILE" ] || [ ! -f "$HBA_FILE" ]; then
        log_error "❌ 无法定位 pg_hba.conf，尝试常见路径..."

        # 阿里云常见路径
        if [ -f "/var/lib/pgsql/data/pg_hba.conf" ]; then
            HBA_FILE="/var/lib/pgsql/data/pg_hba.conf"
        elif [ -f "/etc/postgresql/14/main/pg_hba.conf" ]; then
            HBA_FILE="/etc/postgresql/14/main/pg_hba.conf"
        elif [ -f "/etc/postgresql/13/main/pg_hba.conf" ]; then
            HBA_FILE="/etc/postgresql/13/main/pg_hba.conf"
        elif [ -f "/etc/postgresql/12/main/pg_hba.conf" ]; then
            HBA_FILE="/etc/postgresql/12/main/pg_hba.conf"
        else
            log_error "❌ 未找到 pg_hba.conf，请手动处理或联系支持"
            return 1
        fi
    fi

    log_success "定位到配置文件: $HBA_FILE"

    # 备份原文件
    sudo cp "$HBA_FILE" "$HBA_FILE.bak_$(date +%Y%m%d_%H%M%S)"
    log_info "已备份配置文件"

    # 替换所有 local 的 peer/ident 为 md5
    sudo sed -i 's/^\(local\s\+all\s\+all\s\+\)\(peer\|ident\)$/\1md5/' "$HBA_FILE"
    sudo sed -i 's/^\(local\s\+xinli_db\s\+xinli_user\s\+\)\(peer\|ident\)$/\1md5/' "$HBA_FILE"

    # 如果没有匹配行，直接在文件末尾添加（确保生效）
    if ! grep -q "^local\s\+all\s\+all\s\+md5" "$HBA_FILE"; then
        echo "" | sudo tee -a "$HBA_FILE" > /dev/null
        echo "# Added by deploy script" | sudo tee -a "$HBA_FILE" > /dev/null
        echo "local   all             all                                     md5" | sudo tee -a "$HBA_FILE" > /dev/null
        log_info "已追加 local all all md5 认证规则"
    fi

    # 重启 PostgreSQL
    log_info "重启 PostgreSQL 服务..."
    if systemctl is-active --quiet postgresql; then
        sudo systemctl restart postgresql
    else
        # 尝试其他服务名（阿里云有时叫 postgresql-14 等）
        for svc in postgresql postgresql-14 postgresql-13 postgresql-12; do
            if systemctl list-unit-files | grep -q "^$svc"; then
                sudo systemctl restart $svc
                break
            fi
        done
    fi

    sleep 3

    # 测试连接
    log_info "测试数据库连接..."
    if PGPASSWORD="$DB_PASSWORD" psql -U xinli_user -d xinli_db -h localhost -c "SELECT '✅ 连接成功！';" >/dev/null 2>&1; then
        log_success "🎉 PostgreSQL 本地认证修复成功！"
    else
        log_error "❌ 修复后仍无法连接，请检查密码或手动验证配置"
        log_info "建议手动测试：PGPASSWORD='你的密码' psql -U xinli_user -d xinli_db -h localhost"
        return 1
    fi
}

# 部署应用
deploy_app() {
    log_info "部署应用到 $APP_DIR..."
    
    # 创建应用目录并设置权限
    mkdir -p $APP_DIR
    chown -R $APP_USER:$APP_GROUP $APP_DIR
    chmod 755 $APP_DIR
    
    # 复制文件
    cp -r ./* $APP_DIR/ 2>/dev/null || true
    chown -R $APP_USER:$APP_GROUP $APP_DIR
    find $APP_DIR -type d -exec chmod 755 {} \;
    find $APP_DIR -type f -exec chmod 644 {} \;
    
    # 切换到应用目录
    cd $APP_DIR
    
    # 检查Python版本
    PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}' | cut -d. -f1,2)
    log_info "检测到Python版本: $PYTHON_VERSION"
    
    # 生成兼容 requirements
    if [[ $(echo "$PYTHON_VERSION >= 3.8" | bc -l) -eq 1 ]]; then
        log_info "Python版本>=3.8，使用标准版本"
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
pycryptodome==3.19.0
EOF
    elif [[ $(echo "$PYTHON_VERSION >= 3.7" | bc -l) -eq 1 ]]; then
        log_info "Python版本3.7，使用兼容版本"
        cat > requirements-compatible.txt << 'EOF'
fastapi==0.75.0
uvicorn[standard]==0.17.0
sqlalchemy==1.4.40
psycopg2-binary==2.9.3
alembic==1.7.7
pydantic==1.9.2
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.5
python-dotenv==0.19.2
requests==2.27.1
pytest==7.1.2
pytest-asyncio==0.18.3
httpx==0.23.0
pytz==2022.1
pycryptodome==3.19.0
EOF
    else
        log_info "Python版本<3.7，使用最低兼容版本"
        cat > requirements-compatible.txt << 'EOF'
fastapi==0.60.0
uvicorn==0.12.0
sqlalchemy==1.3.24
psycopg2-binary==2.8.6
alembic==1.5.8
pydantic==1.7.4
python-jose[cryptography]==3.1.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.5
python-dotenv==0.15.0
requests==2.24.0
pytest==6.1.2
pytest-asyncio==0.14.0
httpx==0.16.1
pytz==2020.4
pycryptodome==3.19.0
EOF
    fi
    
    chown $APP_USER:$APP_GROUP requirements-compatible.txt
    chmod 644 requirements-compatible.txt
    
    # 创建虚拟环境和安装依赖
    sudo -u $APP_USER bash -c "
        cd $APP_DIR
        rm -rf venv
        
        # 创建虚拟环境
        if python3 -m venv --help >/dev/null 2>&1; then
            python3 -m venv venv
        else
            python3 -m virtualenv venv
        fi
        
        source venv/bin/activate
        
        # 升级pip并设置国内镜像源
        pip install --upgrade pip
        pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple/
        pip config set install.trusted-host pypi.tuna.tsinghua.edu.cn
        
        # 安装依赖
        echo '正在安装依赖...'
        if pip install -r requirements-compatible.txt; then
            echo '✓ 依赖安装成功'
        else
            echo '✗ 依赖安装失败'
            exit 1
        fi
        
        # 强制重装加密库（确保成功）
        echo '正在安装 pycryptodome...'
        if pip install pycryptodome --force-reinstall --no-cache-dir; then
            echo '✓ pycryptodome 安装成功'
        else
            echo '✗ pycryptodome 安装失败'
            exit 1
        fi
        
        # 验证加密库（优先验证 Crypto，兼容微信官方代码）
        echo '正在验证加密库...'
        if python -c 'from Crypto.Cipher import AES; from Crypto.Util.Padding import unpad; print(\"✓ Crypto 验证成功\")'; then
            echo '✓ Crypto 加密库验证成功'
        else
            echo '✗ Crypto 加密库验证失败'
            exit 1
        fi
    "
    
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
    log_info "开始初始化数据库..."
    sudo -u $APP_USER bash -c "cd $APP_DIR && source venv/bin/activate && python init_db.py"
    
    log_success "应用部署完成"
}

# 配置系统服务
setup_systemd() {
    log_info "配置系统服务..."
    
    mkdir -p $APP_DIR
    chown -R $APP_USER:$APP_GROUP $APP_DIR
    
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
ExecStart=$APP_DIR/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 2
ExecReload=/bin/kill -s HUP \$MAINPID
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF
    
    systemctl daemon-reload
    systemctl enable xinli-backend
    
    log_success "系统服务配置完成"
}

# 启动服务
start_services() {
    log_info "启动所有服务..."
    
    systemctl start xinli-backend
    
    # 等待服务启动
    sleep 5
    
    # 验证服务状态
    if systemctl is-active --quiet xinli-backend; then
        log_success "xinli-backend 运行正常"
    else
        log_warning "xinli-backend 状态异常，请查看日志：journalctl -u xinli-backend -n 50 --no-pager"
    fi
    
    # 测试 API
    if curl -f -s http://localhost:8000/health >/dev/null 2>&1; then
        log_success "API 服务响应正常"
    else
        log_warning "API 服务无响应，请检查应用日志"
    fi
}

# 诊断功能
diagnose() {
    log_info "诊断部署问题..."
    
    # 检查应用目录
    if [ ! -d "$APP_DIR" ]; then
        log_error "应用目录不存在: $APP_DIR"
        return 1
    fi
    
    cd $APP_DIR
    log_success "工作目录: $(pwd)"
    
    # 检查虚拟环境
    if [ ! -d "venv" ]; then
        log_error "虚拟环境不存在"
        return 1
    fi
    
    log_success "虚拟环境存在"
    
    # 激活虚拟环境并检查 Python
    if ! source venv/bin/activate 2>/dev/null; then
        log_error "无法激活虚拟环境"
        return 1
    fi
    log_success "虚拟环境已激活: $(which python)"
    
    # 检查依赖安装
    log_info "检查关键依赖..."
    pip list | grep -E "(fastapi|uvicorn|sqlalchemy|pycryptodome|psycopg2)" >/dev/null
    if [ $? -eq 0 ]; then
        log_success "关键依赖已安装"
    else
        log_warning "部分关键依赖未安装"
    fi
    
    # 检查加密库（兼容微信官方代码）
    log_info "检查 Crypto 加密库..."
    if python -c "from Crypto.Cipher import AES; from Crypto.Util.Padding import unpad; print('OK')" 2>/dev/null; then
        log_success "✓ Crypto 加密库可用"
    else
        log_error "✗ Crypto 加密库不可用"
        return 1
    fi
    
    # 检查环境变量文件
    if [ -f ".env" ]; then
        log_success ".env 文件存在"
        if grep -q "WECHAT_APPID" .env && grep -q "WECHAT_SECRET" .env; then
            log_success "微信配置完整"
        else
            log_warning "微信配置缺失"
        fi
    else
        log_error ".env 文件不存在"
        return 1
    fi
    
    # 检查服务状态
    if systemctl is-active --quiet xinli-backend 2>/dev/null; then
        log_success "服务 xinli-backend 正在运行"
    else
        log_warning "服务 xinli-backend 未运行"
    fi
    
    log_success "✅ 诊断完成！未发现致命错误"
}

# 修复功能
fix() {
    log_info "修复部署问题..."
    
    # 检查应用目录
    if [ ! -d "$APP_DIR" ]; then
        log_error "应用目录不存在: $APP_DIR"
        log_info "请先运行部署"
        return 1
    fi
    
    cd $APP_DIR
    log_success "工作目录: $(pwd)"
    
    # 修复目录权限
    log_info "修复目录权限..."
    chown -R $APP_USER:$APP_GROUP $APP_DIR
    find $APP_DIR -type d -exec chmod 755 {} \;
    find $APP_DIR -type f -exec chmod 644 {} \;
    log_success "目录权限修复完成"
    
    # 检查/重建虚拟环境
    if [ ! -d "venv" ]; then
        log_warning "虚拟环境不存在，正在重建..."
        sudo -u $APP_USER bash -c "
            cd $APP_DIR
            if python3 -m venv --help >/dev/null 2>&1; then
                python3 -m venv venv
            else
                python3 -m virtualenv venv
            fi
        "
        log_success "虚拟环境创建完成"
    fi
    
    # 激活虚拟环境
    if ! source venv/bin/activate 2>/dev/null; then
        log_error "无法激活虚拟环境"
        return 1
    fi
    log_success "虚拟环境已激活"
    
    # 升级 pip 并设置镜像源
    log_info "配置 pip 镜像源..."
    pip install --upgrade pip
    pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple/
    pip config set install.trusted-host pypi.tuna.tsinghua.edu.cn
    
    # 重新生成兼容 requirements
    PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}' | cut -d. -f1,2)
    log_info "Python版本: $PYTHON_VERSION"
    
    if [[ $(echo "$PYTHON_VERSION >= 3.8" | bc -l) -eq 1 ]]; then
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
pycryptodome==3.19.0
EOF
    elif [[ $(echo "$PYTHON_VERSION >= 3.7" | bc -l) -eq 1 ]]; then
        cat > requirements-compatible.txt << 'EOF'
fastapi==0.75.0
uvicorn[standard]==0.17.0
sqlalchemy==1.4.40
psycopg2-binary==2.9.3
alembic==1.7.7
pydantic==1.9.2
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.5
python-dotenv==0.19.2
requests==2.27.1
pytest==7.1.2
pytest-asyncio==0.18.3
httpx==0.23.0
pytz==2022.1
pycryptodome==3.19.0
EOF
    else
        cat > requirements-compatible.txt << 'EOF'
fastapi==0.60.0
uvicorn==0.12.0
sqlalchemy==1.3.24
psycopg2-binary==2.8.6
alembic==1.5.8
pydantic==1.7.4
python-jose[cryptography]==3.1.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.5
python-dotenv==0.15.0
requests==2.24.0
pytest==6.1.2
pytest-asyncio==0.14.0
httpx==0.16.1
pytz==2020.4
pycryptodome==3.19.0
EOF
    fi
    
    chown $APP_USER:$APP_GROUP requirements-compatible.txt
    chmod 644 requirements-compatible.txt
    
    # 重新安装依赖
    log_info "重新安装依赖..."
    if pip install -r requirements-compatible.txt; then
        log_success "依赖安装成功"
    else
        log_error "依赖安装失败"
        return 1
    fi
    
    # 强制重装 pycryptodome
    log_info "修复加密库..."
    if pip install pycryptodome --force-reinstall --no-cache-dir; then
        log_success "pycryptodome 修复成功"
    else
        log_error "pycryptodome 修复失败"
        return 1
    fi
    
    # 验证
    if python -c "from Crypto.Cipher import AES; print('OK')" 2>/dev/null; then
        log_success "✓ Crypto 库验证通过"
    else
        log_error "✗ Crypto 库仍不可用"
        return 1
    fi
    
    # 修复系统服务
    log_info "修复 systemd 服务..."
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
ExecStart=$APP_DIR/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 2
ExecReload=/bin/kill -s HUP \$MAINPID
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF
    
    systemctl daemon-reload
    systemctl enable xinli-backend
    
    # 重启服务
    log_info "重启服务..."
    systemctl restart xinli-backend
    sleep 5
    
    if systemctl is-active --quiet xinli-backend; then
        log_success "🎉 服务修复成功并已启动！"
    else
        log_error "服务启动失败，请查看日志：journalctl -u xinli-backend -n 50 --no-pager"
        return 1
    fi
    
    log_success "✅ 修复流程全部完成！"
}

# 显示帮助信息
show_help() {
    echo "栖溯光屿心理健康API - 一体化部署脚本（阿里云优化版）"
    echo ""
    echo "用法:"
    echo "  ./final_deploy.sh [选项]"
    echo ""
    echo "选项:"
    echo "  deploy     部署应用（默认）"
    echo "  diagnose   诊断部署问题"
    echo "  fix        修复部署问题"
    echo "  help       显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  ./final_deploy.sh          # 部署应用"
    echo "  ./final_deploy.sh diagnose # 诊断问题"
    echo "  ./final_deploy.sh fix      # 修复问题"
}

# 主函数
main() {
    # 检查运行环境
    if [ ! -f "main.py" ] || [ ! -f "requirements.txt" ]; then
        log_error "请在后端项目目录中运行此脚本"
        exit 1
    fi
    
    # 解析命令行参数
    case "${1:-deploy}" in
        deploy)
            detect_system
            ensure_app_user
            get_config
            install_dependencies
            setup_database
            fix_pg_auth      # ✅ 关键：修复 PostgreSQL 认证
            deploy_app
            setup_systemd
            start_services
            
            echo ""
            echo "======================================"
            log_success "🎉 部署完成！"
            echo "======================================"
            echo ""
            echo "应用查看: journalctl -u xinli-backend -f"
            echo "健康检查: curl http://localhost:8000/health"
            echo "部署目录: $APP_DIR"
            echo ""
            ;;
        diagnose)
            diagnose
            ;;
        fix)
            fix
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            log_error "未知选项: $1"
            show_help
            exit 1
            ;;
    esac
}

# 运行主函数
main "$@"