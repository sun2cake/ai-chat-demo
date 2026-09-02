# AI Chat Demo 项目规范

## 技术栈

- Vue 3、TypeScript、Vite
- UI 组件使用 Ant Design Vue
- HTTP 请求使用 Axios 或浏览器 Fetch API

## 目录约定

- `src/components/`：Vue 组件
- `src/types/`：共享 TypeScript 类型
- `src/utils/`：无界面的通用工具函数
- `src/assets/`：由源码引用的静态资源
- `public/`：按原路径发布的静态资源

## 开发约定

- 只修改当前需求直接涉及的代码，不做无关重构或格式化。
- 文件名沿用现有风格；变量、函数和类型使用英文命名。
- API 密钥、Token 和密码不得写入源码或提交到 Git。
- Dify API Key 通过本地环境变量 `DIFY_API_KEY` 提供，由开发代理注入请求。
- 新增环境变量时同步更新 `.env.example`，示例中不得包含真实值。

## 验证

- 完成代码修改后运行 `npm run build`。
- 提交前检查 `git diff`，确认不包含密钥和无关改动。
