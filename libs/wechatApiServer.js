const axios = require("axios");
const config = require("../config");
const db = require("./redis");

class wechatApiServer {
  constructor(appType = "dianjian") {
    this.secret = config[appType].secret;
    this.agentid = config[appType].agentID;
    this.corpid = config[appType].corpid;
    this.baseUrl = config[appType].baseUrl;
    this.key = config[appType].redis_token_key;
    this.expire = config.redis.expire;
    this.token = "";
  }

  async getToken() {
    const token = await db.get(this.key);
    if (token) {
      this.token = token;
    } else {
      await this.getAccessToken();
    }
  }

  getAccessToken() {
    const url = `${this.baseUrl}/gettoken?corpid=${this.corpid}&corpsecret=${this.secret}`;
    return axios.get(url).then((resp) => {
      this.token = resp.data.access_token;
      db.set(this.key, this.token, this.expire);
    });
  }

  async sendMsg(recordId, msg, users) {
    await this.getToken().catch((res) => {
      console.log(res);
    });
    const url = `${this.baseUrl}/message/send?access_token=${this.token}`;
    const data = {
      touser: users,
      msgtype: "text",
      agentid: this.agentid,
      text: {
        content: msg,
      },
    };

    return axios.post(url, data);
  }

  // eslint-disable-next-line camelcase
  async updateTaskcard(userids, task_id, replace_name) {
    await this.getToken().catch((res) => {
      console.log(res);
    });
    const url = `${this.baseUrl}/message/update_taskcard?access_token=${this.token}`;
    const data = {
      userids,
      agentid: this.agentid,
      task_id,
      replace_name,
    };

    return axios.post(url, data);
  }

  async sendCardMsg(recordId, msg, users) {
    await this.getToken().catch((res) => {
      console.log(res);
    });
    const url = `${this.baseUrl}/message/send?access_token=${this.token}`;
    const data = {
      touser: users,
      msgtype: "news",
      agentid: this.agentid,
      news: {
        articles: [
          {
            title: "审批",
            description: msg,
            url: `${config.kintone.domain}/k/${config.kintone.approve.appId}/show#record=${recordId}`,
            picurl:
              "http://res.mail.qq.com/node/ww/wwopenmng/images/independent/doc/test_pic_msg1.png",
          },
        ],
      },
      text: {
        content: msg,
      },
    };
    return axios.post(url, data);
  }

  async sendTaskCardMsg(taskId, msg, users, status) {
    await this.getToken().catch((res) => {
      console.log(res);
    });
    const url = `${this.baseUrl}/message/send?access_token=${this.token}`;
    let btn = [];
    switch (status) {
      case "退回":
        btn = [
          {
            key: "submit",
            name: "提交审批",
            color: "red",
            is_bold: true,
          },
        ];
        break;
      case "处理中":
        btn = [
          {
            key: "approve",
            name: "批准",
            color: "red",
            is_bold: true,
          },
          {
            key: "back",
            name: "退回",
          },
        ];
        break;
      case "审核":
        btn = [
          {
            key: "confirm",
            name: "确认",
            color: "red",
            is_bold: true,
          },
        ];
        break;
      default:
        btn = [
          {
            key: "approve",
            name: "批准",
            color: "red",
            is_bold: true,
          },
          {
            key: "back",
            name: "退回",
          },
        ];
    }
    const data = {
      touser: users,
      msgtype: "interactive_taskcard",
      agentid: this.agentid,
      interactive_taskcard: {
        title: "审批申请",
        description: msg,
        task_id: taskId,
        btn,
      },
    };
    return axios.post(url, data).catch((resp) => {
      console.log(resp);
    });
  }

  async getSpInfo(sp_no) {
    await this.getToken().catch((res) => {
      // console.log(res);
    });
    const url = `${this.baseUrl}/oa/getapprovaldetail?access_token=${this.token}`;
    const data = {
      sp_no,
    };

    return axios.post(url, data);
  }

  async getFile(mediaId) {
    await this.getToken();
    const url = `${this.baseUrl}/media/get?access_token=${this.token}&media_id=${mediaId}`;
    return axios.get(url, {
      responseType: "stream",
    });
  }
}

module.exports = wechatApiServer;
