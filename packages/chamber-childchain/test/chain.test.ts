import { describe, it } from "mocha"
import chai = require('chai');
import { assert } from "chai"
import chaiAsPromised from 'chai-as-promised'
import { constants, utils, ethers } from "ethers"
import { Snapshot, ISnapshotDb } from '../src/snapshot'
import {
  Chain,
  IChainDb
} from '../src/chain'
import { SplitTransaction, Segment, SignedTransaction } from '@layer2/core'

class MockSnapshotDb implements ISnapshotDb {
  getRoot() {
    return ''
  }
  setRoot(root: string) {}
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

class MockNoDataSnapshotDb implements ISnapshotDb {
  getRoot() {
    return ''
  }
  setRoot(root: string) {}
  contains(key: string): Promise<boolean> {
    return Promise.resolve(false)
  }
  insertId(key: string): Promise<boolean> {
    return Promise.resolve(true)
  }
  deleteId(key: string): Promise<boolean> {
    return Promise.resolve(true)
  }
}

class MockChainDb implements IChainDb {
  contains(key: string): Promise<boolean> {
    return Promise.resolve(true)
  }
  insert(key: string, value: string): Promise<boolean> {
    return Promise.resolve(true)
  }
  get(key: string): Promise<string> {
    return Promise.resolve("")
  }
  delete(key: string): Promise<boolean> {
    return Promise.resolve(true)
  }
}


describe('Chain', () => {
  const AlicePrivateKey = '0xe88e7cda6f7fae195d0dcda7ccb8d733b8e6bb9bd0bc4845e1093369b5dc2257'
  const BobPrivateKey = '0x855364a82b6d1405211d4b47926f4aa9fa55175ab2deaf2774e28c2881189cff'
  const AliceAddress = utils.computeAddress(AlicePrivateKey)
  const BobAddress = utils.computeAddress(BobPrivateKey)

  before(() => {
    chai.use(chaiAsPromised)
  })

  it('should generateBlock', async () => {
    const snapshot = new Snapshot(new MockSnapshotDb())
    const chain = new Chain(snapshot, new MockChainDb())
    const tx = SplitTransaction.Transfer(
      AliceAddress,
      Segment.ETH(ethers.utils.bigNumberify(0), ethers.utils.bigNumberify(10000000)),
      ethers.utils.bigNumberify(5),
      BobAddress
    )
    const signedTx = new SignedTransaction(tx)
    signedTx.sign(AlicePrivateKey)
    chain.appendTx(signedTx)
    const root = await chain.generateBlock()
    assert.equal(root.ok().length, 66)
  })

  it('should failed to generateBlock by no input', async () => {
    const snapshot = new Snapshot(new MockNoDataSnapshotDb())
    const chain = new Chain(snapshot, new MockChainDb())
    const tx = SplitTransaction.Transfer(
      AliceAddress,
      Segment.ETH(ethers.utils.bigNumberify(0), ethers.utils.bigNumberify(10000000)),
      ethers.utils.bigNumberify(5),
      BobAddress
    )
    const signedTx = new SignedTransaction(tx)
    signedTx.sign(AlicePrivateKey)
    chain.appendTx(signedTx)
    const result = await chain.generateBlock()
    assert.isTrue(result.isError())
    assert.equal(result.error().message, 'no valid transactions')
  })

  it('should success to generateBlock but segment duplecated', async () => {
    const snapshot = new Snapshot(new MockSnapshotDb())
    const chain = new Chain(snapshot, new MockChainDb())
    const tx = SplitTransaction.Transfer(
      AliceAddress,
      Segment.ETH(ethers.utils.bigNumberify(0), ethers.utils.bigNumberify(10000000)),
      ethers.utils.bigNumberify(5),
      BobAddress
    )
    const signedTx = new SignedTransaction(tx)
    signedTx.sign(AlicePrivateKey)
    chain.appendTx(signedTx)
    const result = chain.appendTx(signedTx)
    assert.isTrue(result.isError())
    assert.equal(result.error().message, 'invalid transaction')
    // segment duplecated will be occurred, but block generate root correctly
    const root = await chain.generateBlock()
    assert.equal(root.ok().length, 66)
  })

})
