import { Snapshot } from './snapshot';
import {
  DepositTransaction,
  SignedTransaction,
  Block,
  Segment,
  SignedTransactionWithProof
} from '@layer2/core';
import { BigNumber } from 'ethers/utils';
import { ethers } from 'ethers';

export interface IChainDb {
  contains(key: string): Promise<string>
  insert(key: string, value: string): Promise<boolean>
  get(key: string): Promise<string>
  delete(key: string): Promise<boolean>
}

export class Chain {
  snapshot: Snapshot
  blockHeight: number
  db: IChainDb
  txQueue: SignedTransaction[]

  constructor(
    snapshot: Snapshot,
    db: IChainDb
  ) {
    this.snapshot = snapshot
    this.blockHeight = 0
    this.db = db
    this.txQueue = []
  }

  appendTx(tx: SignedTransaction) {
    this.txQueue.push(tx)
  }

  async generateBlock() {
    const block = new Block()
    this.txQueue.forEach(tx => {
      if(tx.verify() && this.snapshot.checkInput(tx)) {
        block.appendTx(tx)
      }
    })
    // write to DB
    const root = block.getRoot()
    await this.writeWaitingBlock(root, block)
    return root
  }
  
  async handleSubmit(root: string, blkNumStr: string) {
    const blkNum = ethers.utils.bigNumberify(blkNumStr)
    const block = await this.readWaitingBlock(root)
    block.txs.forEach(tx => {
      this.snapshot.applyTx(tx, blkNum)
    })
    block.setBlockNumber(blkNum.toNumber())
    this.blockHeight = blkNum.toNumber()
    await this.writeToDb(block)
  }

  async handleDeposit(depositor: string, start: string, end: string, blkNum: string) {
    const depositTx = new DepositTransaction(
      depositor,
      '0x0000000000000000000000000000000000000000',
      new Segment(
        ethers.utils.bigNumberify(start),
        ethers.utils.bigNumberify(end)
      )
    )
    const block = new Block()
    block.setBlockNumber(Number(blkNum))
    block.setDepositTx(depositTx)
    this.blockHeight = Number(blkNum)
    // write to DB
    this.snapshot.db.insertId(depositTx.getOutput().hash())
    await this.writeToDb(block)
  }

  async getBlock(blkNum: BigNumber): Promise<Block> {
    return this.readFromDb(blkNum)
  }

  async getUserTransactions(blkNum: BigNumber, owner: string): Promise<SignedTransactionWithProof[]> {
    const block = await this.getBlock(blkNum)
    return block.getUserTransactionAndProofs(owner)
  }

  async writeWaitingBlock(root: string, block: Block) {
    await this.db.insert('waitingblock.' + root, JSON.stringify(block.serialize()))
  }

  async readWaitingBlock(root: string) {
    const str = await this.db.get('waitingblock.' + root)
    return Block.deserialize(JSON.parse(str))
  }

  async writeToDb(block: Block) {
    await this.db.insert('block.' + block.getBlockNumber().toString(), JSON.stringify(block.serialize()))
  }

  async readFromDb(blkNum: BigNumber) {
    const str = await this.db.get('block.' + blkNum.toString())
    return Block.deserialize(JSON.parse(str))
  }

}
