const koa = require("koa");
const json = require("koa-json");
const jsonp = require("koa-jsonp");
const xmlParser = require("koa-xml-body");
const bodyparser = require("koa-bodyparser");
// const { checkOrigin } = require("./libs/utils");
const dianjianCallback = require("./routes/dianjian");
const approveCallback = require("./routes/approve");

const app = new koa();

app.use(xmlParser());
app.use(
  bodyparser({
    enableTypes: ["json"],
  })
);
app.use(json());
app.use(jsonp());

//ip检查
// app.use(async (ctx, next) => {
//   await checkOrigin(ctx, next);
// });

// logger
// app.use(async (ctx, next) => {
//   const start = new Date();
//   await next();
//   const ms = new Date() - start;
//   console.log(`${ctx.method} ${ctx.url} - ${ms}ms`);
// });

// routes
app.use(dianjianCallback.routes(), dianjianCallback.allowedMethods());
app.use(approveCallback.routes(), approveCallback.allowedMethods());

// error-handling
app.on("error", (err, ctx) => {
  console.error("server error", err, ctx);
});

module.exports = app;
