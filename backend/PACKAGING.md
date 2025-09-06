# 后端项目打包说明

本文档提供了关于如何打包后端项目的说明，以便于部署到生产环境。

## 打包步骤

1. 确保您已经安装了所有必要的依赖：

```bash
pip install -r requirements.txt
```

2. 在后端项目根目录下运行打包脚本：

```bash
python package.py
```

3. 打包脚本将在 `dist` 目录下创建一个包含时间戳的ZIP文件，例如：`xinli-backend-1.0.0-20231201_120000.zip`

## 打包内容

打包后的文件包含以下内容：

- `main.py`：主应用入口
- `requirements.txt`：依赖列表
- `.env.example`：环境变量示例文件
- `README.md`：项目说明文档
- `init_db.py`：数据库初始化脚本
- `app/`：应用程序代码目录
- `start.sh`：自动生成的启动脚本

## 部署说明

1. 将生成的ZIP文件上传到服务器
2. 解压ZIP文件：

```bash
unzip xinli-backend-1.0.0-*.zip -d /path/to/deploy
```

3. 进入解压后的目录：

```bash
cd /path/to/deploy/xinli-backend-1.0.0-*
```

4. 配置环境变量：

```bash
cp .env.example .env
# 编辑.env文件，设置正确的环境变量
nano .env
```

5. 运行启动脚本：

```bash
./start.sh
```

## 注意事项

- 打包过程会排除以下内容：
  - `__pycache__` 目录
  - `.pyc`, `.pyo`, `.pyd` 文件
  - `.git` 目录
  - `.env` 文件（出于安全考虑）
  - 数据库文件（`.db`）
  - 其他临时文件和构建目录

- 确保服务器上已安装 Python 3.8 或更高版本
- 如果需要自定义打包内容，可以编辑 `package.py` 文件中的 `INCLUDE_FILES` 和 `INCLUDE_DIRS` 变量

## 自定义配置

如果需要修改打包配置，可以编辑 `package.py` 文件中的以下变量：

- `PACKAGE_NAME`：包名
- `VERSION`：版本号
- `OUTPUT_DIR`：输出目录
- `INCLUDE_FILES`：需要包含的文件列表
- `INCLUDE_DIRS`：需要包含的目录列表
- `EXCLUDE_PATTERNS`：需要排除的文件和目录模式