# Learning Notes

使用 Nextra 构建的个人编程学习笔记。

## 本地运行

```bash
npm install
npm run dev
```

打开 <http://localhost:3000>。

## 添加笔记

把 `.md` 或 `.mdx` 文件放进 `content/`，然后在对应目录的 `_meta.js` 中设置侧边栏名称和顺序。

## 部署

在 Vercel 中导入本 GitHub 仓库即可。Vercel 会自动识别 Next.js，并在每次推送到 `main` 后重新部署。
