module.exports = {
  apps: [
    {
      name: "wechat-kintone-demo",
      script: "./bin/www",
      watch: true,
      ignore_watch: ["node_modules"],
      watch_options: {
        usePolling: true,
        interval: 1000,
      },
      // env: {
      //   NODE_ENV: "development",
      //   name: "wechat-kintone_dev",
      //   PORT: 3000,
      // },
    },
  ],
};
