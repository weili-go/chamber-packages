import { Snapshot } from './snapshot';
import { TxFilter } from './txfilter'
import {
  ChamberResult,
  ChamberOk,
  ChamberResultError,
  DepositTransaction,
  SignedTransaction,
  Block,
  Segment,
  SignedTransactionWithProof
} from '@layer2/core'
import { ChainErrorFactory } from './error'
import { BigNumber } from 'ethers/utils';

export interface IChainDb {
  contains(key: string): Promise<boolean>
  insert(key: string, value: string): Promise<boolean>
  get(key: string): Promise<string>
  delete(key: string): Promise<boolean>
}

export class Chain {
  snapshot: Snapshot
  blockHeight: number
  db: IChainDb
  txQueue: SignedTransaction[]
  txFilter: TxFilter
  numTokens: number

  constructor(
    snapshot: Snapshot,
    db: IChainDb
  ) {
    this.snapshot = snapshot
    this.blockHeight = 0
    this.db = db
    this.txQueue = []
    this.txFilter = new TxFilter()
    this.numTokens = 1
  }

  setNumTokens(numTokens: number) {
    this.numTokens = numTokens
  }

  appendTx(tx: SignedTransaction): ChamberResult<boolean> {
    try {
      if(this.txFilter.checkAndInsertTx(tx)) {
        this.txQueue.push(tx)
        return new ChamberOk(true)
      }else{
        return new ChamberOk(false)
      }
    } catch (e) {
      return new ChamberResultError(ChainErrorFactory.InvalidTransaction())
    }
  }

  async updateConfSig(tx: SignedTransactionWithProof) {
    const result = await this.getBlock(tx.blkNum)
    if(result.isOk()) {
      const block = result.ok()
      tx.confSigs.map(confSig => {
        block.appendConfSig(tx.getSignedTx(), confSig)
      })
      await this.writeToDb(block)
    }
  }

  isEmpty() {
    return this.txQueue.length == 0
  }
  
  async generateBlock(): Promise<ChamberResult<string>> {
    const block = new Block(this.numTokens)
    if(this.txQueue.length == 0) {
      return new ChamberResultError(ChainErrorFactory.NoValidTransactions())
    }
    const tasks = this.txQueue.map(async tx => {
      const inputChecked = await this.snapshot.checkInput(tx)
      if(inputChecked) {
        block.appendTx(tx)
      }
    })
    await Promise.all(tasks)
    if(block.getTransactions().length == 0) {
      return new ChamberResultError(ChainErrorFactory.NoValidTransactions())
    }
    // write to DB
    const root = block.getRoot()
    await this.writeWaitingBlock(root, block)
    return new ChamberOk(root)
  }

  clear() {
    this.txQueue = []
    this.txFilter.clear()
  }
  
  async handleSubmit(superRoot: string, root: string, blkNum: BigNumber, timestamp: BigNumber) {
    const block = await this.readWaitingBlock(root)
    block.txs.forEach(tx => {
      this.snapshot.applyTx(tx, blkNum)
    })
    block.setBlockNumber(blkNum.toNumber())
    block.setBlockTimestamp(timestamp)
    block.setSuperRoot(superRoot)
    this.blockHeight = blkNum.toNumber()
    await this.writeToDb(block)
  }

  async handleDeposit(depositor: string, tokenId: BigNumber, start: BigNumber, end: BigNumber, blkNum: BigNumber) {
    const depositTx = new DepositTransaction(
      depositor,
      new Segment(
        tokenId,
        start,
        end
      )
    )
    const block = new Block()
    block.setBlockNumber(blkNum.toNumber())
    block.setDepositTx(depositTx)
    this.blockHeight = blkNum.toNumber()
    // write to DB
    this.snapshot.db.insertId(depositTx.getOutput().withBlkNum(blkNum).hash())
    await this.writeToDb(block)
  }

  async getBlock(blkNum: BigNumber): Promise<ChamberResult<Block>> {
    try {
      const block = await this.readFromDb(blkNum)
      return new ChamberOk(block)
    } catch(e) {
      return new ChamberResultError(ChainErrorFactory.BlockNotFound())
    }
  }

  async getUserTransactions(blkNum: BigNumber, owner: string): Promise<ChamberResult<SignedTransactionWithProof[]>> {
    const block = await this.getBlock(blkNum)
    if(block.isOk()) {
      return new ChamberOk(block.ok().getUserTransactionAndProofs(owner))
    } else {
      return new ChamberResultError(block.error())
    }
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
