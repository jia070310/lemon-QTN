# 金蝉窗帘报价工具（P0）

多人协作的窗帘报价软件：型号库 + 报价编辑 + **打印 / 出表格 / 出图** 三个独立导出。

## 技术栈

- 前端：React + Vite + TypeScript（当前用浏览器调试；后续可套 Electron 成客户端）
- 后端：Node.js + Express + SQLite（Node 内置 `node:sqlite`）
- 鉴权：JWT

## 快速启动

```bash
npm install
npm run dev
```

- 前端：http://127.0.0.1:5280
- 后端：http://127.0.0.1:3780
- 默认账号：`admin` / `admin123`

## P0 已实现

- 登录
- 产品型号库（增改停用、搜索）
- 报价单列表 / 新建 / 编辑 / 保存
- 型号自动补全；库中无此型号时询问是否入库
- 计价：布/纱按宽×单价；百叶按宽×高×单价
- **打印**（独立模块 `client/src/exports/print.ts`）
- **出表格** Excel / CSV 二选一（`client/src/exports/table.ts`）
- **出图** PNG（`client/src/exports/image.ts`）

## 后续客户端

业务代码已在 Web 前端，后期用 Electron/Tauri 包一层桌面壳即可，接口仍指向本机或局域网服务器。

## 目录

```
client/   前端
server/   API + SQLite
data/     数据库文件（运行后生成）
```
