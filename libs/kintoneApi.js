const { KintoneRestAPIClient } = require("@kintone/rest-api-client");
const config = require("../config.js");

class kintoneApi {
  constructor() {
    const apiToken = config.kintone.apiToken;
    this.client = new KintoneRestAPIClient({
      baseUrl: config.kintone.domain,
      auth: {
        apiToken,
      },
    });
  }

  addRecord(app, record) {
    const param = {
      app,
      record,
    };
    return this.client.record.addRecord(param);
  }

  getRecord(appId, recordId) {
    const param = {
      app: appId,
      id: recordId,
    };
    return this.client.record.getRecord(param);
  }

  getRecords(appId, query) {
    const param = {
      app: appId,
      query,
      totalCount: true,
    };

    return this.client.record.getRecords(param);
  }

  updateRecord(app, id, record) {
    const param = {
      app,
      id,
      record,
    };
    return this.client.record.updateRecord(param);
  }

  updateRecordByKey(app, updateKey, record) {
    const param = {
      app,
      updateKey,
      record,
    };
    return this.client.record.updateRecord(param);
  }

  updateRecordStatus(app, id, action) {
    const param = {
      app,
      id,
      action,
    };
    return this.client.record.updateRecordStatus(param);
  }

  uploadFile(FILE) {
    return this.client.file.uploadFile({
      file: FILE,
    });
  }

  getFile(fileKey) {
    const buffer = this.client.file.downloadFile({
      fileKey,
    });
    return buffer;
  }
}
module.exports = kintoneApi;
