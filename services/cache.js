const mongoose = require('mongoose');
const redis = require('redis');
const util = require('util');
const keys  require('./config/keys');

const client = redis.createClient(keys.redisUrl);
client.hget = util.promisify(client.hget);

const exec = mongoose.Query.prototype.exec;

mongoose.Query.prototype.cache = function(options = {}) {
  this.useCache = true;
  this.hashKey = JSON.stringify(options.key || '');
  return this;
};

mongoose.Query.prototype.exec = async function() {
  if (!this.useCache) {
    return exec.apply(this, arguments);
  }
  const key = JSON.stringify(
    Object.assign({}, this.getQuery(), {
      collection: this.mongooseCollection.name
    })
  );
  //Check redis for value of 'key'
  const cacheValue = await client.hget(this.hashKey, key);

  if (cacheValue) {
    //return mongoose model instead of plain JSON
    const doc = JSON.parse(cacheValue);
    return Array.isArray(doc)
      ? doc.map(d => new this.model(d))
      : new this.model(doc);
  }
  const result = await exec.apply(this, arguments);

  //Turning result into JSON because redis caches plain documents, query
  //reponse come back as aobject with prototypes and fucntions attached to it
  client.hset(this.hashKey, key, JSON.stringify(result), 'EX', 10);
  return result;
};

module.exports = {
  clearHash(hashKey) {
    client.del(JSON.stringify(hashKey));
  }
};
