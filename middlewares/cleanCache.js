const { cleaerHash } = require('../services/cache');

module.exports = async (req, res, next) => {
  await next();
  clearHash(req.user.id);
};
