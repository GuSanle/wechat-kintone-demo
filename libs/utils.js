const config = require("../config.js");

const getClientIp = (req) =>
  req.headers["x-forwarded-for"] ||
  req.connection.remoteAddress ||
  req.socket.remoteAddress ||
  req.connection.socket.remoteAddress ||
  "";

module.exports.kintoneToCommonData = function (kintoneDataObj) {
  let commonObj = {};
  Object.keys(kintoneDataObj).forEach((k) => {
    commonObj[k] = kintoneDataObj[k].value;
  });
  return commonObj;
};

module.exports.convertToKintoneData = function (data, fields) {
  const kintoneData = {};
  Object.keys(data).forEach((val) => {
    kintoneData[fields[val]] = {
      value: data[val],
    };
  });
  return kintoneData;
};

module.exports.checkOrigin = async function (ctx, next) {
  const ip = getClientIp(ctx.req).match(/\d+.\d+.\d+.\d+/);
  const clientIp = ip ? ip.join(".") : null;
  if (config.access_ip.indexOf(clientIp) === -1) {
    ctx.throw(400, "您没有权限访问该接口!");
  } else {
    await next();
  }
};
