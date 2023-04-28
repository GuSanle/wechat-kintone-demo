const { getSignature, decrypt, encrypt } = require("@wecom/crypto");
const { js2xml, xml2js } = require("xml-js");
const { v4: uuidv4 } = require("uuid");
const config = require("../config");

class workWechatReceive {
  constructor(appType = "dianjian") {
    this.secret = config[appType].secret;
    this.agentid = config[appType].agentID;
    this.token = config[appType].token;
    this.corpid = config[appType].corpid;
    this.encodingAESKey = config[appType].encodingAESKey;
  }

  verifyURL(params, echostr) {
    return (
      getSignature(this.token, params.timestamp, params.nonce, echostr) ===
      params.msg_signature
    );
  }

  //根据MsgType判断来的是什么类型
  getMsg(data) {
    const { message, id } = decrypt(this.encodingAESKey, data);
    const xmlObj = xml2js(message, { compact: true }).xml;
    const type = xmlObj.MsgType._cdata;
    const fromUser = xmlObj.FromUserName._cdata;
    let userInput = { type };
    switch (type) {
      case "text":
        userInput.inputInfo = {
          Content: xmlObj.Content._cdata,
        };
        break;
      case "image":
        userInput.inputInfo = {
          PicUrl: xmlObj.PicUrl._cdata,
          MediaId: xmlObj.MediaId._cdata,
        };
        break;
      case "voice":
        userInput.inputInfo = {
          Format: xmlObj.Format._cdata,
          MediaId: xmlObj.MediaId._cdata,
        };
        break;
      case "video":
        userInput.inputInfo = {
          ThumbMediaId: xmlObj.ThumbMediaId._cdata,
          MediaId: xmlObj.MediaId._cdata,
        };
        break;
      case "location":
        userInput.inputInfo = {
          Location_X: xmlObj.Location_X,
          Location_Y: xmlObj.Location_Y,
          Scale: xmlObj.Scale,
          Label: xmlObj.Label._cdata,
        };
        break;
      case "link":
        userInput.inputInfo = {
          Title: xmlObj.Title._cdata,
          Description: xmlObj.Description._cdata,
          Url: xmlObj.Url._cdata,
          PicUrl: xmlObj.PicUrl._cdata,
        };
        break;
      default:
        break;
    }
    return [fromUser, userInput, id];
  }

  getTaskMsg(data) {
    const { message, id } = decrypt(this.encodingAESKey, data);
    const { FromUserName, EventKey, TaskId } = xml2js(message, {
      compact: true,
    }).xml;
    // eslint-disable-next-line no-underscore-dangle
    const fromUser = FromUserName._cdata;
    // eslint-disable-next-line no-underscore-dangle
    const content = EventKey._cdata;
    return [fromUser, content, TaskId, id];
  }

  reply(id, toUser, replyContent) {
    const timestamp = Date.now();
    const template = {
      xml: {
        ToUserName: { _cdata: toUser },
        FromUserName: { _cdata: this.corpid },
        CreateTime: timestamp,
        MsgType: { _cdata: "text" },
        Content: { _cdata: replyContent },
      },
    };

    const xmlData = js2xml(template, { compact: true });
    const ciphered = encrypt(this.encodingAESKey, xmlData, id);
    const nonce = uuidv4();
    const signature = getSignature(this.token, timestamp, nonce, ciphered);

    const resp = {
      xml: {
        TimeStamp: timestamp,
        Nonce: nonce,
        MsgSignature: { _cdata: signature },
        Encrypt: { _cdata: ciphered },
      },
    };

    return js2xml(resp, { compact: true });
  }

  replyTaskCard(id, toUser, replyContent) {
    const timestamp = Date.now();
    const template = {
      xml: {
        ToUserName: { _cdata: toUser },
        FromUserName: { _cdata: this.corpid },
        CreateTime: timestamp,
        MsgType: { _cdata: "update_taskcard" },
        TaskCard: { ReplaceName: { _cdata: replyContent } },
      },
    };

    const xmlData = js2xml(template, { compact: true });
    const ciphered = encrypt(this.encodingAESKey, xmlData, id);
    const nonce = uuidv4();
    const signature = getSignature(this.token, timestamp, nonce, ciphered);

    const resp = {
      xml: {
        TimeStamp: timestamp,
        Nonce: nonce,
        MsgSignature: { _cdata: signature },
        Encrypt: { _cdata: ciphered },
      },
    };

    return js2xml(resp, { compact: true });
  }

  approveChanged(data) {
    const { message, id } = decrypt(this.encodingAESKey, data);
    const { ApprovalInfo } = xml2js(message, { compact: true }).xml;
    const { SpName, SpStatus, SpNo } = ApprovalInfo;
    return [SpName._cdata, SpStatus._text, SpNo._text, id];
  }
}

module.exports = workWechatReceive;
