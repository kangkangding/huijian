# 绘简

给电商、学生和个人爱好者的文生图站点。主做出图，页面里可以问简单问题，会员可以生成短视频。

页面设计在 Figma：https://www.figma.com/design/bD3LSG34hORLVZSAgMBXW4

前端发布到 Cloudflare Pages，接口跑在 Cloudflare Workers，数据放在 Supabase。聊天、图片和视频由 Workers 用 Cloudflare 里的国内密钥转发到 Agnes 中国站。这一边失败时，自动改用国际密钥和国际站。视频的创建和查询保持同一边。密钥不会进前端，也不会进仓库。

## 方案

| 方案 | 价格 | 30 天额度 |
| --- | --- | --- |
| 免费 | 0 元 | 每天 10 张 1K 图、200 条问答 |
| 限时会员 | 1.9 元 | 每天 100 张图（可到 2K）、2000 条问答、5 段视频 |
| 月费会员 | 9.9 元 | 与限时会员相同 |

第一个注册的账号是管理员，到账户页把 Agnes 密钥写入 `provider_secrets`。

## 本地

```bash
npm install --prefix apps/api
npm install --prefix apps/web
cp apps/api/.dev.vars.example apps/api/.dev.vars
```

把 Supabase 的项目地址和 `service_role` 密钥写进 `apps/api/.dev.vars`。先在 Supabase SQL Editor 执行 `supabase/migrations/20261021000000_init.sql`。

开两个终端：

```bash
npm run dev:api
npm run dev:web
```

打开 http://localhost:5173 。注册后在账户页保存 Agnes 密钥，再去文生图。

开发环境下，会员订单可以由下单用户自己确认，方便联调。生产环境必须由支付回调带上 `X-Payment-Secret`，值与 `PAYMENT_WEBHOOK_SECRET` 一致。

## 发布

接口：

```bash
cd apps/api
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put PAYMENT_WEBHOOK_SECRET
```

把 `wrangler.jsonc` 里的 `APP_ORIGIN` 改成 Pages 域名，`APP_ENV` 保持 `production`，然后：

```bash
npx wrangler deploy
```

页面：

```bash
cd apps/web
VITE_API_BASE=https://api.oranook.com npm run build
npx wrangler pages deploy dist --project-name huijian
```

文生图可能超过免费 Workers 的请求时长。生产环境建议使用 Workers 付费计划。视频创建后用任务号轮询，不把等待放在同一次请求里。

## 接口

- `POST /api/auth/register` `POST /api/auth/login` `POST /api/auth/logout` `GET /api/auth/me`
- `POST /api/auth/forgot-password` `POST /api/auth/reset-password`
- `GET /api/plans` `POST /api/membership/orders` `POST /api/membership/orders/:id/confirm`
- `POST /api/images` `GET /api/images`
- `POST /api/chat` `GET /api/chat/conversations` `GET /api/chat/conversations/:id`
- `POST /api/videos` `GET /api/videos` `GET /api/videos/:id`
- `GET /api/admin/provider-key` `POST /api/admin/provider-key`

上游地址固定为 Agnes 中国站：聊天 `agnes-2.5-flash`，图片 `agnes-image-2.5-flash`，视频 `agnes-video-2.5-flash`。
