const { decrypt } = require("@wecom/crypto");
const { DateTime } = require("luxon");
const { dianjian, kintone } = require("../config");
const { appId: dianjianId, fields: dianjianField } = kintone.dianjian;
const { appId: scheduleId, fields: scheduleField } = kintone.schedule;
const kintoneApi = require("../libs/kintoneApi");
const workWechatReceive = require("../libs/workWechatReceive");
const wechatApiServer = require("../libs/wechatApiServer");
const { kintoneToCommonData, convertToKintoneData } = require("../libs/utils");
const KEYWORD = {
  schedule: "今日点检",
  start: "点检开始",
  help: "帮助",
};

const STATUS = {
  step1: "step1",
  step2: "step2",
  step3: "step3",
  step4: "step4",
  step5: "finish",
};

const STEPS = {
  step1: "是否完成日常清扫(是/否)",
  step2: "机器温度是否正常(是/否)",
  step3: "是否有设备异常(是/否)",
  step4: "请上传异常图片",
  step5: "已经完成点检",
};

const HELP = "本系统支持指令：今日点检-查询点检信息，点检开始-进行今日点检";
const workWechatReceiveObj = new workWechatReceive("dianjian");
const kintoneObj = new kintoneApi();
const wechatApiObj = new wechatApiServer("dianjian");

exports.get = (ctx) => {
  const params = ctx.query;
  const signState = workWechatReceiveObj.verifyURL(params, params.echostr);
  let message = "";
  if (!signState) {
    message = "-40001_invaild MsgSig";
  } else {
    message = decrypt(dianjian.encodingAESKey, params.echostr).message;
  }
  return message;
};

//条件：用户，时间
const getSchedule = async (wechatId) => {
  const query = `${scheduleField.wechat_id} = "${wechatId}" and ${scheduleField.date} = TODAY()`;
  const { records } = await kintoneObj
    .getRecords(scheduleId, query)
    .catch((err) => {
      console.log(err);
    });

  let message = "";
  if (records.length > 0) {
    for (const r of records) {
      const data = kintoneToCommonData(r);
      message += `设备：${data[scheduleField.shebei]}\n位置：${
        data[scheduleField.weizhi]
      }\n点检内容：${
        data[scheduleField.detail]
      }\n---------------------------\n`;
    }
  } else {
    message = "还没录入今日点检";
  }
  return message;
};

const getDianJianRercod = async (wechatId) => {
  const query = `${dianjianField.wechat_id} = "${wechatId}" limit 1`;
  const { records } = await kintoneObj
    .getRecords(dianjianId, query)
    .catch((err) => {
      console.log(err);
    });
  return records;
};

//点检开始 创建一条点检数据，并自动返回下一步操作说明。如果有了，则提示
const startDianjian = async (wechatId) => {
  const date = DateTime.local().setLocale("zh").toFormat("yyyy-MM-dd");
  const record = {
    [dianjianField.date]: date,
    [dianjianField.wechat_id]: wechatId,
    [dianjianField.status]: STATUS.step1,
  };
  const kintoneData = convertToKintoneData(record, dianjianField);
  await kintoneObj.addRecord(dianjianId, kintoneData);
};

//根据当前的步骤，更新数据
const checkDianjian = async (currentStep, recordId, userInput) => {
  const arr = Object.values(STATUS);
  const index = arr.indexOf(currentStep);
  let nextStep = arr[index + 1];
  if (currentStep === "step3" && userInput.inputInfo.Content === "否") {
    nextStep = arr[index + 2];
  }
  let record = {};
  if (userInput.type === "text") {
    record = {
      [dianjianField[currentStep]]: userInput.inputInfo.Content,
      [dianjianField.status]: nextStep,
    };
  } else if (userInput.type === "image") {
    const file = await wechatApiObj.getFile(userInput.inputInfo.MediaId);
    const FILE = {
      name: userInput.inputInfo.MediaId + ".jpg",
      data: file.data,
    };
    const { fileKey } = await kintoneObj.uploadFile(FILE);
    record = {
      [dianjianField[currentStep]]: [{ fileKey }],
      [dianjianField.status]: nextStep,
    };
  } else {
    return false;
  }
  const kintoneData = convertToKintoneData(record, dianjianField);
  const result = await kintoneObj
    .updateRecord(dianjianId, recordId, kintoneData)
    .catch(() => {
      return false;
    });
  if (!result) {
    return result;
  } else {
    return nextStep;
  }
};

const handle = async (wechatId, userInput) => {
  let replyMessage = "";
  if (
    userInput.type === "text" &&
    userInput.inputInfo.Content === KEYWORD.help
  ) {
    replyMessage = HELP;
  } else if (
    userInput.type === "text" &&
    userInput.inputInfo.Content === KEYWORD.schedule
  ) {
    replyMessage = await getSchedule(wechatId);
  } else {
    if (
      userInput.type === "text" &&
      userInput.inputInfo.Content === KEYWORD.start
    ) {
      await startDianjian(wechatId);
      replyMessage = STEPS.step1;
    } else {
      const records = await getDianJianRercod(wechatId);
      if (records.length > 0) {
        //说明已经有开始记录，直接判断当前步骤是第几部，从当前步骤开始提示。
        const currentStep = records[0][dianjianField.status].value;
        if (currentStep === "finish") {
          const finishKey = Object.keys(STATUS).find(
            (finishKey) => STATUS[finishKey] === currentStep
          );
          replyMessage = STEPS[finishKey];
          return replyMessage;
        }
        const recordId = records[0].$id.value;
        const nextStep = await checkDianjian(currentStep, recordId, userInput);
        if (!nextStep) {
          replyMessage = "更新失败，请重新填写";
        } else {
          //获取下个步骤，并提示
          const key = Object.keys(STATUS).find(
            (key) => STATUS[key] === nextStep
          );
          replyMessage = STEPS[key];
        }
      }
    }
  }
  return replyMessage;
};

exports.post = async (ctx) => {
  const { xml } = ctx.request.body;

  const signState = workWechatReceiveObj.verifyURL(ctx.query, xml.Encrypt[0]);
  if (!signState) {
    const error = "-40001_invaild MsgSig";
    return error;
  }
  const [wechatId, userInput, id] = workWechatReceiveObj.getMsg(xml.Encrypt[0]);
  const respMessage = await handle(wechatId, userInput);
  xmlResp = workWechatReceiveObj.reply(id, wechatId, respMessage);
  return xmlResp;
};
