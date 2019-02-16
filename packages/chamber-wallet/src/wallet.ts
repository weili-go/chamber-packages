import * as ethers from 'ethers'
import {
  PlasmaClient,
  RootChainEventListener
} from './client'
import {
  IWalletStorage
} from './storage/IWalletStorage'
import {
  Address,
  constants,
  ExitableRangeManager,
  SplitTransaction,
  SignedTransaction,
  SignedTransactionWithProof,
  Block,
  DepositTransaction,
  Segment,
  SumMerkleProof,
} from '@layer2/core'
import {
  Exit
} from './models/exit'
import { Contract } from 'ethers'
import { BigNumber } from 'ethers/utils';
import artifact from './assets/RootChain.json'

const abi = [
  'event BlockSubmitted(bytes32 _root, uint256 _timestamp, uint256 _blkNum)',
  'event Deposited(address indexed _depositer, uint256 _tokenId, uint256 _start, uint256 _end, uint256 _blkNum)',
  'event ExitStarted(address indexed _exitor, uint256 _exitId, uint256 exitableAt, uint256 _tokenId, uint256 _start, uint256 _end)',
  'event FinalizedExit(uint256 _exitId, uint256 _tokenId, uint256 _start, uint256 _end)',
  'function deposit() payable',
  'function exit(uint256 _utxoPos, uint256 _segment, bytes _txBytes, bytes _proof, bytes _sig, uint256 _hasSig) payable',
  'function finalizeExit(uint256 _exitableEnd, uint256 _exitId)',
  'function getExit(uint256 _exitId) constant returns(address, uint256)',
]

class WaitingBlockWrapper {
  blkNum: BigNumber
  root: string

  constructor(
    blkNum: BigNumber,
    root: string
  ) {
    this.blkNum = blkNum
    this.root = root
  }

  serialize() {
    return JSON.stringify({
      blkNum: this.blkNum,
      root: this.root
    })
  }

  static deserialize(str: string) {
    const data = JSON.parse(str)
    return new WaitingBlockWrapper(
      ethers.utils.bigNumberify(data.blkNum),
      data.root
    )
  }
}

export class ChamberWallet {
  client: PlasmaClient
  latestBlockNumber: number
  loadedBlockNumber: number
  rootChainContract: Contract
  wallet: ethers.Wallet
  utxos: Map<string, string>
  storage: IWalletStorage
  httpProvider: ethers.providers.JsonRpcProvider
  listener: RootChainEventListener
  rootChainInterface: ethers.utils.Interface
  exitList: Map<string, string>
  waitingBlocks: Map<string, string>
  exitableRangeManager: ExitableRangeManager

  constructor(
    client: PlasmaClient,
    privateKey: string,
    rootChainEndpoint: string,
    contractAddress: Address,
    storage: IWalletStorage
  ) {
    this.client = client
    this.latestBlockNumber = 0
    this.loadedBlockNumber = 0
    this.httpProvider = new ethers.providers.JsonRpcProvider(rootChainEndpoint)
    const contract = new ethers.Contract(contractAddress, abi, this.httpProvider)
    this.wallet = new ethers.Wallet(privateKey, this.httpProvider)
    this.rootChainContract = contract.connect(this.wallet)
    this.storage = storage
    this.utxos = this.loadUTXO()
    this.exitList = this.loadExits()
    this.waitingBlocks = this.loadMap<string>('waitingBlocks')
    this.loadedBlockNumber = this.getNumberFromStorage('loadedBlockNumber')
    this.rootChainInterface = new ethers.utils.Interface(artifact.abi)
    this.listener = new RootChainEventListener(
      this.httpProvider,
      this.rootChainInterface,
      contractAddress,
      storage,
      this.loadSeenEvents(),
      2
    )
    this.listener.addEvent('BlockSubmitted', (e) => {
      console.log('BlockSubmitted', e)
      this.addWaitingBlock(new WaitingBlockWrapper(
        e.values._blkNum,
        e.values._root
      ))
    })
    this.listener.addEvent('ExitStarted', (e) => {
      console.log('ExitStarted', e)
    })
    this.listener.addEvent('FinalizedExit', (e) => {
      console.log('FinalizedExit', e)
      this.exitableRangeManager.remove(
        e.values._tokenId,
        e.values._start,
        e.values._end
      )
      this.saveExitableRangeManager()
    })
    this.listener.addEvent('Deposited', (e) => {
      console.log('Deposited', e)
      this.handleDeposit(
        e.values._depositer,
        e.values._tokenId,
        e.values._start,
        e.values._end,
        e.values._blkNum
      )
      this.exitableRangeManager.extendRight(
        e.values._end
      )
      this.saveExitableRangeManager()
    })

    this.exitableRangeManager = this.loadExitableRangeManager()
  }

  private loadExitableRangeManager() {
    try {
      const loaded = this.storage.get('exitable')
      return ExitableRangeManager.deserialize(loaded)
    }catch(e) {
      return new ExitableRangeManager()
    }
  }

  private saveExitableRangeManager() {
    this.storage.add('exitable', this.exitableRangeManager.serialize())
  }

  async init(handler: (wallet: ChamberWallet) => void) {
    await this.listener.initPolling(() => {
      handler(this)
    })
  }

  async loadBlockNumber() {
    return await this.client.getBlockNumber()
  }

  private async loadBlocks() {
    const tasks = this.getWaitingBlocks().map(block => {
      return this.client.getBlock(block.blkNum.toNumber())
    })
    return Promise.all(tasks)
  }

  async syncChildChain(): Promise<SignedTransactionWithProof[]> {
    const results = await this.loadBlocks()
    results.map(block => this.updateBlock(Block.deserialize(block)))
    return this.getUTXOArray()
  }

  private updateBlock(block: Block) {
    this.getUTXOArray().forEach((tx) => {
      const exclusionProof = block.getExclusionProof(tx.getOutput().getSegment(0))
      const key = tx.getOutput().hash()
      this.storage.addProof(key, block.getBlockNumber(), JSON.stringify(exclusionProof.serialize()))
    })
    block.getUserTransactionAndProofs(this.wallet.address).map(tx => {
      tx.signedTx.tx.getInputs().forEach(input => {
        this.deleteUTXO(input.hash())
      })
      if(tx.getOutput().getOwners().indexOf(this.wallet.address) >= 0) {
        this.addUTXO(tx)
      }
    })
    this.loadedBlockNumber = block.getBlockNumber()
    this.storage.add('loadedBlockNumber', this.loadedBlockNumber.toString())
  }

  handleDeposit(depositor: string, tokenId: BigNumber, start: BigNumber, end: BigNumber, blkNum: BigNumber) {
    const depositorAddress = ethers.utils.getAddress(depositor)
    const segment = new Segment(tokenId, start, end)
    const depositTx = new DepositTransaction(
      depositorAddress,
      tokenId,
      segment
    )
    if(depositorAddress === this.getAddress()) {
      this.addUTXO(new SignedTransactionWithProof(
        new SignedTransaction(depositTx),
        0,
        '',
        new SumMerkleProof(1, 0, segment, ''),
        blkNum))
    }
    return depositTx
  }

  handleExit(exitId: BigNumber, exitableAt: BigNumber, tokenId: BigNumber, start: BigNumber, end: BigNumber) {
    const segment = new Segment(tokenId, start, end)
    const exit = new Exit(
      exitId,
      exitableAt,
      segment
    )
    this.exitList.set(exit.getId(), exit.serialize())
    this.storeMap('exits', this.exitList)
    return exit
  }

  getExits() {
    const arr: Exit[] = []
    this.exitList.forEach(value => {
      arr.push(Exit.deserialize(value))
    })
    return arr
  }

  getExitFromLocal(exitId: string) {
    const serialized = this.exitList.get(exitId)
    if(serialized)
      return Exit.deserialize(serialized)
    return null
  }

  loadExits() {
    return this.loadMap<string>('exits')
  }

  getUTXOArray(): SignedTransactionWithProof[] {
    const arr: SignedTransactionWithProof[] = []
    this.utxos.forEach(value => {
      arr.push(SignedTransactionWithProof.deserialize(JSON.parse(value)))
    })
    return arr
  }

  getWaitingBlocks(): WaitingBlockWrapper[] {
    const arr: WaitingBlockWrapper[] = []
    this.waitingBlocks.forEach(value => {
      arr.push(WaitingBlockWrapper.deserialize(value))
    })
    return arr
  }

  addWaitingBlock(tx: WaitingBlockWrapper) {
    this.waitingBlocks.set(tx.blkNum.toString(), tx.serialize())
    this.storeMap('waitingBlocks', this.waitingBlocks)
  }

  addUTXO(tx: SignedTransactionWithProof) {
    this.utxos.set(tx.getOutput().hash(), JSON.stringify(tx.serialize()))
    this.storeMap('utxos', this.utxos)
  }

  loadUTXO() {
    return this.loadMap<string>('utxos')
  }

  deleteUTXO(key: string) {
    this.utxos.delete(key)
    this.storeMap('utxos', this.utxos)
  }

  private loadSeenEvents() {
    return this.loadMap<boolean>('seenEvents')
  }

  getNumberFromStorage(key: string): number {
    try {
      return Number(this.storage.get(key))
    } catch(e) {
      return 0
    }
  }

  private storeMap<T>(key: string, map: Map<string, T>) {
    let obj: any = {}
    map.forEach((value, key) => {
      obj[key] = value
    })
    this.storage.add(key, JSON.stringify(obj))
  }

  private loadMap<T>(key: string) {
    const map = new Map<string, T>()
    try {
      const obj: any = JSON.parse(this.storage.get(key))
      for(let key in obj) {
        map.set(key, obj[key])
      }
    } catch(e) {
    }
    return map
  }

  getAddress() {
    return this.wallet.address
  }

  getBalance() {
    let balance = ethers.utils.bigNumberify(0)
    this.getUTXOArray().forEach((tx) => {
      balance = balance.add(tx.getOutput().getSegment(0).getAmount())
    })
    return balance
  }

  /**
   * 
   * @param ether 1.0
   */
  async deposit(ether: string): Promise<DepositTransaction> {
    const result = await this.rootChainContract.deposit({
      value: ethers.utils.parseEther(ether)
    })
    await result.wait()
    const receipt = await this.httpProvider.getTransactionReceipt(result.hash)
    if(receipt.logs && receipt.logs[0]) {
      const logDesc = this.rootChainInterface.parseLog(receipt.logs[0])
      return this.handleDeposit(
        logDesc.values._depositer,
        logDesc.values._tokenId,
        logDesc.values._start,
        logDesc.values._end,
        logDesc.values._blkNum
      )
    } else {
      throw new Error('invalid receipt')
    }
  }

  async exit(tx: SignedTransactionWithProof): Promise<Exit> {
    const result = await this.rootChainContract.exit(
      tx.blkNum.mul(100),
      tx.getOutput().getSegment(0).toBigNumber(),
      tx.getTxBytes(),
      tx.getProofAsHex(),
      tx.getSignatures(),
      0,
      {
      value: constants.EXIT_BOND
    })
    await result.wait()
    const receipt = await this.httpProvider.getTransactionReceipt(result.hash)
    if(receipt.logs && receipt.logs[0]) {
      const logDesc = this.rootChainInterface.parseLog(receipt.logs[0])
      return this.handleExit(
        logDesc.values._exitId,
        logDesc.values.exitableAt,
        logDesc.values._tokenId,
        logDesc.values._start,
        logDesc.values._end
      )
    } else {
      throw new Error('invalid receipt')
    }
  }

  async getExit(exitId: string) {
    return await this.rootChainContract.getExit(exitId)
  }
  
  async finalizeExit(exitId: string) {
    const exit = this.getExitFromLocal(exitId)
    if(exit == null) {
      throw new Error('exit not found')
    }
    return await this.rootChainContract.finalizeExit(
      this.exitableRangeManager.getExitableEnd(exit.segment.start, exit.segment.end),
      exitId)
  }

  searchUtxo(amount: BigNumber): SignedTransactionWithProof | null {
    let tx: SignedTransactionWithProof | null = null
    this.getUTXOArray().forEach((_tx) => {
      if(_tx.getOutput().getSegment(0).getAmount().gt(amount)) {
        tx = _tx
      }
    })
    return tx
  }

  async transfer(
    to: Address,
    amountStr: string
  ) {
    const amount = ethers.utils.bigNumberify(amountStr)
    const tx = this.searchUtxo(amount)
    if(tx == null) {
      throw new Error('too large amount')
    }
    const output = tx.getOutput()
    const segment = output.getSegment(0)
    const newTx = new SplitTransaction(
      this.wallet.address,
      segment,
      tx.blkNum,
      to,
      this.wallet.address,
      segment.start.add(amount)
    )
    const signedTx = new SignedTransaction(newTx)
    signedTx.sign(this.wallet.privateKey)
    await this.client.sendTransaction(signedTx.serialize())
  }

  private getExitableEnd(tokenId: number, end: BigNumber) {

  }
}
