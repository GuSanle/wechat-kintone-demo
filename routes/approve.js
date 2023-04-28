const router = require("koa-router")();
const { wechatGet, wechatPost } = require("../controller/approveCallback");

router.prefix("/approve");

router.get("/callback", async (ctx, next) => {
  const message = wechatGet(ctx);
  ctx.body = message;
});

router.post("/callback", async (ctx, next) => {
  const result = await wechatPost(ctx);
  ctx.body = result;
});

module.exports = router;
