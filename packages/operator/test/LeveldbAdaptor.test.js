const { describe, it } = require("mocha")
const { assert } = require("chai")
const LeveldbAdaptor = require('../lib/db/LeveldbAdaptor');
const memdown = require('memdown')

describe('LeveldbAdaptor', () => {

  it('insert and get', async () => {
    const db = new LeveldbAdaptor(memdown('test'))
    db.insert('aaa', 'bbb')
    const bbb = await db.get('aaa')
    assert.equal(bbb, 'bbb')
  })
  
});
