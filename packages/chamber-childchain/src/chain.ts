import { TxFilter } from './txfilter'
import {
  ChamberResult,
  ChamberOk,
  ChamberResultError,
  DepositTransaction,
  SignedTransaction,
  Block,
  Segment,
  SegmentChecker,
  SignedTransactionWithProof,
  SplitTransaction
} from '@layer2/core'
import { ChainErrorFactory } from './error'
import { constants, utils } from 'ethers';
import BigNumber = utils.BigNumber
import { SwapManager } from './SwapManager';

export interface IChainDb {
  contains(key: string): Promise<boolean>
  insert(key: string, value: string): Promise<boolean>
  get(key: string): Promise<string>
  delete(key: string): Promise<boolean>
}

export class Chain {
  blockHeight: number
  db: IChainDb
  txQueue: SignedTransaction[]
  txFilter: TxFilter
  numTokens: number
  swapManager: SwapManager
  segmentChecker: SegmentChecker

  constructor(
    db: IChainDb
  ) {
    this.segmentChecker = new SegmentChecker()
    this.blockHeight = 0
    this.db = db
    this.txQueue = []
    this.txFilter = new TxFilter()
    this.numTokens = 1
    this.swapManager = new SwapManager()
  }

  setNumTokens(numTokens: number) {
    this.numTokens = numTokens
  }

  getSwapManager() {
    return this.swapManager
  }

  getCurrentSegments() {
    return this.segmentChecker.toObject()
  }

  appendTx(tx: SignedTransaction): ChamberResult<boolean> {
    try {
      if(this.txFilter.checkAndInsertTx(tx)
      && this.segmentChecker.isContain(tx)) {
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
      const inputChecked = this.segmentChecker.isContain(tx)
      if(inputChecked) {
        this.segmentChecker.spend(tx)
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
    await this.writeSnapshot()
    return new ChamberOk(root)
  }

  clear() {
    this.txQueue = []
    this.txFilter.clear()
  }
  
  async handleSubmit(superRoot: string, root: string, blkNum: BigNumber, timestamp: BigNumber) {
    const block = await this.readWaitingBlock(root)
    block.txs.forEach(tx => {
      this.segmentChecker.insert(tx, blkNum)
    })
    block.setBlockNumber(blkNum.toNumber())
    block.setBlockTimestamp(timestamp)
    block.setSuperRoot(superRoot)
    this.blockHeight = blkNum.toNumber()
    await this.writeToDb(block)
    await this.writeSnapshot()
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
    this.segmentChecker.insertDepositTx(depositTx, blkNum)
    await this.writeToDb(block)
    await this.writeSnapshot()
  }

  async handleExit(
    exitor: string,
    segment: BigNumber,
    blkNum: BigNumber
  ) {
    this.segmentChecker.spend(new SignedTransaction([new SplitTransaction(
      exitor,
      Segment.fromBigNumber(segment),
      blkNum,
      constants.AddressZero
    )]))
    await this.writeSnapshot()
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

  async writeSnapshot() {
    await this.db.insert('snapshot', JSON.stringify(this.segmentChecker.serialize()))
  }

  async readSnapshot() {
    const snapshot = await this.db.get('snapshot')
    this.segmentChecker.deserialize(JSON.parse(snapshot))
  }

  async syncBlocks() {
    await this.syncBlocksPart(utils.bigNumberify(3), false)
  }

  private async syncBlocksPart(blkNum: BigNumber, prevDoesExist: boolean) {
    const doesExist = await this.syncBlock(blkNum)
    // deposit block or submit block is exists
    if(prevDoesExist || doesExist) {
      await this.syncBlocksPart(blkNum.add(1), doesExist)
    }
  }

  private async syncBlock(blkNum: BigNumber) {
    const blockResult = await this.getBlock(blkNum)
    if(blockResult.isOk()) {
      const block = blockResult.ok()
      const tasks = block.txs.map(async tx => {
        await this.segmentChecker.spend(tx)
        await this.segmentChecker.insert(tx, blkNum)
      })
      await Promise.all(tasks)
      return true
    } else {
      return false
    }
  } 

}
