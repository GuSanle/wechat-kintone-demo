## 代码初始化
### 安装脚手架
npm install -g koa-generator  


### 生成项目
koa2 -e project(项目名称) （-e代表使用ejs模板）  
cd 项目   
npm i  


### 更新所有依赖
npm install -g npm-check-updates  
ncu -u


## 自动部署，自动运行
### pm2 
pm2 监控改动，自动reload  
通过运行ecosystem.config.js实现

```  
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
    },
  ],
};
```
pm2 start ecosystem.config.js

### 自动sftp部署
如果需要服务器部署，可以配合vscode的sftp扩展，进行自动上传，自动watch，自动reload

sftp例子：sftp.json

```
{
  "name": "SE阿里云服务器",
  "host": "xxx",
  "protocol": "sftp",
  "port": 22,
  "username": "root",
  "password": "xxx",
  "remotePath": "/root/wechat-kintone-demo",
  "uploadOnSave": true,
  "useTempFile": false,
  "openSsh": false,
  "ignore": [".vscode", ".git", ".DS_Store", "node-modules"]
}
```

## 环境变量
.env信息
```  
KINTONE_JIABAN=
KINTONE_QINGJIA=
KINTONE_DIANJIAN=
KINTONE_USER=
KINTONE_SCHEDULE=
DIANJIAN_TOKEN=
DIANJIAN_ENCODEINGAESKEY=
DIANJIAN_AGENTID=
DIANJIAN_CORPID=
DIANJIAN_SECRET=
APPROVE_TOKEN=
APPROVE_ENCODEINGAESKEY=
APPROVE_AGENTID=
APPROVE_CORPID=
APPROVE_SECRET=
CONTACTS_TOKEN=
CONTACTS_ENCODEINGAESKEY=
CONTACTS_AGENTID=
CONTACTS_CORPID=
CONTACTS_SECRET=
```  
## 系统设计
将企业微信的审批完成的同步到kintone  
方法1 
是定时获取审批数据同步到kintone
问题：非实时性

方法2 
通过审批结果回调，当数据是审批完的，就同步  
问题：遇到批量审批，只能得到申请号，还需要通过申请号获取申请详情，这样堆了一堆的数据时，需要执行非常多的请求。性能问题。  
解决方法：1 发起申请时，就建立记录。并设置状态。等批准时，只需要批量更新kintone。驳回时也是如此。   
2 使用同步执行，让他慢慢等。 
流程： 
1 收到审批结果回调时，先判断状态， 如果是1-审批中，则去kintone查询是否存在这条，不存在新增，存在就直接返回。（因为可能存在这条需要多人审批）   
如果状态是2-已通过；3-已驳回；4-已撤销；6-通过后撤销；7-已删除，10-已支付则直接更新状态。使用同步执行，不然可能发生kintone数据库死锁。 本次先决定使用2解决。 


token可能存在多处多次调用，根据企业微信规则，进行缓存。  
缓存方法1 放redis，过期再取。  
缓存方法2 放redis，定时获取。  
本次使用第一种  

