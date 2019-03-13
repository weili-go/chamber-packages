const levelup = require('levelup');

/**
 * implements IChainDb
 */
class LeveldbAdaptor {
  constructor(path) {
    this.db = levelup(path);
  }

  async contains(key) {
    return await this.db.get(key)
  }

  async insert(key, value) {
    await this.db.put(key, value)
    return true
  }

  async get(key) {
    return (await this.db.get(key)).toString()
  }

  async delete(key) {
    return await this.db.del(key)
  }

}

module.exports = LeveldbAdaptor
