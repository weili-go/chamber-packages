import { describe, it } from "mocha"
import {
  ChamberOk,
  ChamberResultError,
  ChamberError
} from '../../src/index'
import { assert } from "chai"

describe('ChamberResult', () => {
  
  it('shoud success to ok', () => {
    const result = new ChamberOk<string>("Hello")
    assert.isTrue(result.isOk())
    assert.equal(result.ok(), 'Hello')
  })

  it('shoud success to error', () => {
    const result = new ChamberResultError<string>(new ChamberError(0, 'Test Error'))
    assert.isTrue(result.isError())
    assert.equal(result.error().message, 'Test Error')
  })

})
