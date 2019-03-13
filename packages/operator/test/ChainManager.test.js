const { describe, it } = require("mocha")
const { assert } = require("chai")

describe('ChainManager', () => {
  it('check', () => {
    const ChainManager = require('../lib/ChainManager');
    assert.isNotNull(ChainManager)
  })
});
