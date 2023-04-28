const router = require("koa-router")();
const { get, post } = require("../controller/dianjianCallback");

router.prefix("/wechat");

router.get("/callback", async (ctx, next) => {
  const message = get(ctx);
  ctx.body = message;
});

router.post("/callback", async (ctx, next) => {
  const result = await post(ctx);
  ctx.body = result;
});

module.exports = router;
