import { describe, it } from "mocha"
import { assert } from "chai"
import { constants, utils, ethers } from "ethers"
import { Snapshot, ISnapshotDb } from '../src/snapshot'
import { TransferTransaction, Segment, SignedTransaction } from '@layer2/core'

class MockSnapshotDb implements ISnapshotDb {
  contains(key: string): Promise<boolean> {
    return Promise.resolve(true)
  }
  insertId(key: string): Promise<boolean> {
    return Promise.resolve(true)
  }
  deleteId(key: string): Promise<boolean> {
    return Promise.resolve(true)
  }
}

describe('Snapshot', () => {
  const AlicePrivateKey = '0xe88e7cda6f7fae195d0dcda7ccb8d733b8e6bb9bd0bc4845e1093369b5dc2257'
  const BobPrivateKey = '0x855364a82b6d1405211d4b47926f4aa9fa55175ab2deaf2774e28c2881189cff'
  const AliceAddress = utils.computeAddress(AlicePrivateKey)
  const BobAddress = utils.computeAddress(BobPrivateKey)

  it('should checkInput', async () => {
    const snapshot = new Snapshot(new MockSnapshotDb())
    const tx = new TransferTransaction(
      AliceAddress,
      new Segment(ethers.utils.bigNumberify(0), ethers.utils.bigNumberify(10000000)),
      ethers.utils.bigNumberify(5),
      BobAddress
    )
    const signedTx = new SignedTransaction(tx)
    const result = await snapshot.checkInput(signedTx)
    assert.equal(result, true)
  })

})
