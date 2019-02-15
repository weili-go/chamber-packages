import { describe, it } from "mocha"
import { Segment } from '../src'
import { assert } from "chai"
import { utils } from "ethers"

describe('Segment', () => {

  it('encode', () => {
    const segment = new Segment(
      utils.bigNumberify('0'),
      utils.bigNumberify('1000000'),
      utils.bigNumberify('2000000'))
    const hex = segment.encode()
    assert.equal(hex, '0xc900830f4240831e8480');
  });

  it('decode', () => {
    const segment = Segment.decode('0xc900830f4240831e8480');
    assert.equal(segment.start.toString(), '1000000');
  });


})
