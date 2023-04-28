const { decrypt } = require("@wecom/crypto");
const { DateTime } = require("luxon");
const { wechatApprove, kintone } = require("../config");
const { approve } = kintone;
const kintoneApi = require("../libs/kintoneApi");
const workWechatReceive = require("../libs/workWechatReceive");
const wechatApiServer = require("../libs/wechatApiServer");

const TEMPLATE = {
  加班: "jiaban",
  请假: "qingjia",
};

const STATUS = {
  1: "审批中",
  2: "已通过",
  3: "已驳回",
  4: "已撤销",
  6: "通过后撤销",
  7: "已删除",
  10: "已支付",
};

const FIELDMAPPING = {
  jiaban: {
    "item-item-1493800425749": approve.jiaban.fields.begin,
    "item-item-1493800431502": approve.jiaban.fields.end,
    "item-item-1493800442836": approve.jiaban.fields.duration,
    "item-item-1493800414708": approve.jiaban.fields.note,
  },
  qingjia: {
    "item-1497581399901": approve.qingjia.fields.note,
    "vacation-1563793073898": "tempHoliday",
    "item-1497581426169": approve.qingjia.fields.file,
  },
};

const tempHoliday = {
  type_name: approve.qingjia.fields.type,
  new_begin: approve.qingjia.fields.begin,
  new_end: approve.qingjia.fields.end,
  new_duration: approve.qingjia.fields.duration,
};

const wechatApiObj = new wechatApiServer("wechatApprove");
const kintoneObj = new kintoneApi();
const wechatApiServerObj = new wechatApiServer("wechatApprove");
const workWechatReceiveObj = new workWechatReceive("wechatApprove");

exports.wechatGet = (ctx) => {
  const params = ctx.query;
  const signState = workWechatReceiveObj.verifyURL(params, params.echostr);
  let message = "";
  if (!signState) {
    message = "-40001_invaild MsgSig";
  } else {
    message = decrypt(wechatApprove.encodingAESKey, params.echostr).message;
  }
  return message;
};

//根据类型处理企业微信数据，转换成kintone数据  vacation等一些一对多的是一个坑，只能特殊处理了。
const WechatToKintone = async (control, value) => {
  let kintoneValue = "";
  switch (control) {
    case "Textarea":
      kintoneValue = value.text;
      break;
    case "Date":
      const timestamp = Number(value.date.s_timestamp);
      const date = DateTime.fromSeconds(timestamp).toISO();
      kintoneValue = date;
      break;
    case "Text":
      kintoneValue = value.text;
      break;
    case "Vacation":
      const type_name = value.vacation.selector.options[0].value[0].text;
      const { new_begin, new_end, new_duration } =
        value.vacation.attendance.date_range;

      kintoneValue = {
        type_name,
        new_begin: DateTime.fromSeconds(new_begin).toISO(),
        new_end: DateTime.fromSeconds(new_end).toISO(),
        new_duration,
      };
      break;
    case "File":
      kintoneValue = await uploadFiles(value.files);
      break;
    default:
      break;
  }
  return { value: kintoneValue };
};

const uploadFiles = async (files) => {
  const fileArray = [];
  for (const f of files) {
    const file = await wechatApiObj.getFile(f.file_id);
    const FILE = {
      name: f.file_id + ".jpg",
      data: file.data,
    };
    const { fileKey } = await kintoneObj.uploadFile(FILE);
    fileArray.push({
      fileKey,
    });
  }
  return fileArray;
};
// 对请假申请的处理

// 对加班申请的处理
const handle = async (SpStatus, SpNo, template) => {
  const fieldsList = Object.keys(FIELDMAPPING[template]);
  if (STATUS[SpStatus] === "审批中") {
    const selectQuery = `${approve[template].fields.sp_no} = "${SpNo}" limit 1`;
    const { records } = await kintoneObj.getRecords(
      approve[template].appId,
      selectQuery
    );

    const result = await wechatApiServerObj.getSpInfo(SpNo);
    const { errcode, info } = result.data;
    if (errcode === 0) {
      const applyInfo = info.apply_data.contents;
      const record = {
        [approve[template].fields.status]: {
          value: STATUS[SpStatus],
        },
        [approve[template].fields.wechat_id]: {
          value: info.applyer.userid,
        },
        [approve[template].fields.sp_no]: {
          value: info.sp_no,
        },
      };
      for (const field of applyInfo) {
        if (fieldsList.indexOf(field.id) != -1) {
          const fieldName = FIELDMAPPING[template][field.id];
          record[fieldName] = await WechatToKintone(field.control, field.value);
        }
      }

      const hoildayFieldsList = Object.keys(tempHoliday);
      if ("tempHoliday" in record) {
        for (const field of hoildayFieldsList) {
          const fieldName = tempHoliday[field];
          record[fieldName] = { value: record.tempHoliday.value[field] };
        }
      }
      delete record.tempHoliday;
      if (records.length > 0) {
        const id = records[0].$id.value;
        await kintoneObj
          .updateRecord(approve[template].appId, id, record)
          .catch((err) => {
            console.log(err);
          });
      } else {
        await kintoneObj
          .addRecord(approve[template].appId, record)
          .catch((err) => {
            console.log(err);
          });
      }
    }
  } else {
    const updateKey = {
      field: approve[template].fields.sp_no,
      value: SpNo,
    };
    const record = {
      [approve[template].fields.status]: {
        value: STATUS[SpStatus],
      },
    };
    await kintoneObj
      .updateRecordByKey(approve[template].appId, updateKey, record)
      .catch((err) => {
        console.log(err);
      });
  }
};

// 审批后的更新状态

// 根据过来的审批的模版名称，审批状态 进行决策
// 如果过来的记录状态是审批中，则去kintone进行添加或更新这条记录。如果是其他状态，则直接做修改状态的动作。
// 因为虽然状态还是审批中，但是节点中的动作，数据等等可能有更新。当然更新的数据也和申请表设计有关。
// 批量处理是否为同一接口，是否需要另外判断

exports.wechatPost = async (ctx) => {
  const { xml } = ctx.request.body;
  const signState = workWechatReceiveObj.verifyURL(ctx.query, xml.Encrypt[0]);
  if (!signState) {
    const error = "-40001_invaild MsgSig";
    return error;
  }
  const result = workWechatReceiveObj.approveChanged(xml.Encrypt[0]);
  const [SpName, SpStatus, SpNo] = result;
  const templateList = Object.keys(TEMPLATE);
  if (templateList.indexOf(SpName) != -1) {
    await handle(SpStatus, SpNo, TEMPLATE[SpName]);
  }
  return true;
};
