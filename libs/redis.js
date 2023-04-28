const db = {};
const asyncRedis = require('async-redis');

const client = asyncRedis.createClient();

client.on('error', (err) => {
  console.log('Error :', err);
});

db.set = (key, value, expire) => {
  client.set(key, value);
  client.expire(key, expire);
};

db.get = async (key) => await client.get(key);

module.exports = db;
