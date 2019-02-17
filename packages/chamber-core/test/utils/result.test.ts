import { describe, it } from "mocha"
import {
  ChamberOk,
  ChamberError
} from '../../src/utils/result'
import { assert } from "chai"

describe('ChamberResult', () => {
  
  it('shoud success to ok', () => {
    const result = new ChamberOk<string>("Hello")
    assert.isTrue(result.isOk())
    assert.equal(result.ok(), 'Hello')
  })

  it('shoud success to error', () => {
    const result = new ChamberError<string>(new Error('Test Error'))
    assert.isTrue(result.isError())
    assert.equal(result.error().message, 'Test Error')
  })

})
