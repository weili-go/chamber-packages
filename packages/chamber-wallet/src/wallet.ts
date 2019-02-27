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
  MergeTransaction,
  Segment,
  SumMerkleProof,
  ChamberResult,
  ChamberResultError,
  ChamberOk,
  MapUtil,
  SwapRequest,
  SwapTransaction,
  TransactionOutput
} from '@layer2/core'
import { WalletErrorFactory } from './error'
import { Exit, WaitingBlockWrapper } from './models'
import { Contract } from 'ethers'
import { BigNumber } from 'ethers/utils';
import artifact from './assets/RootChain.json'
if(!artifact.abi) {
  console.error('ABI not found')
}

const abi = [
  'event BlockSubmitted(bytes32 _superRoot, bytes32 _root, uint256 _timestamp, uint256 _blkNum)',
  'event Deposited(address indexed _depositer, uint256 _tokenId, uint256 _start, uint256 _end, uint256 _blkNum)',
  'event ExitStarted(address indexed _exitor, uint256 _exitId, uint256 exitableAt, uint256 _tokenId, uint256 _start, uint256 _end)',
  'event FinalizedExit(uint256 _exitId, uint256 _tokenId, uint256 _start, uint256 _end)',
  'function deposit() payable',
  'function exit(uint256 _utxoPos, uint256 _segment, bytes _txBytes, bytes _proof, bytes _sig, uint256 _hasSig) payable',
  'function finalizeExit(uint256 _exitableEnd, uint256 _exitId)',
  'function getExit(uint256 _exitId) constant returns(address, uint256)',
]

export class ChamberWallet {
  private client: PlasmaClient
  private loadedBlockNumber: number
  private rootChainContract: Contract
  private wallet: ethers.Wallet
  private utxos: Map<string, string>
  private storage: IWalletStorage
  private httpProvider: ethers.providers.JsonRpcProvider
  private listener: RootChainEventListener
  private rootChainInterface: ethers.utils.Interface
  private exitList: Map<string, string>
  private waitingBlocks: Map<string, string>
  private exitableRangeManager: ExitableRangeManager

  /**
   * 
   * @param client 
   * @param privateKey 
   * @param rootChainEndpoint Main chain endpoint
   * @param contractAddress RootChain address
   * @param storage 
   * 
   * ### Example
   * 
   * ```typescript
   *  const jsonRpcClient = new JsonRpcClient('http://localhost:3000')
   *  const client = new PlasmaClient(jsonRpcClient)
   *  const storage = new WalletStorage()
   *  return ChamberWallet.createWalletWithPrivateKey(
   *    client,
   *    'http://127.0.0.1:8545',
   *    '0x00... root chain address',
   *    storage,
   *    '0x00... private key'
   *  )
   * ```
   */
  static createWalletWithPrivateKey(
    client: PlasmaClient,
    rootChainEndpoint: string,
    contractAddress: Address,
    storage: IWalletStorage,
    privateKey: string
  ) {
    const httpProvider = new ethers.providers.JsonRpcProvider(rootChainEndpoint)
    return new ChamberWallet(
      client,
      httpProvider,
      new ethers.Wallet(privateKey, httpProvider),
      contractAddress,
      storage
    )
  }

  static createWalletWithMnemonic(
    client: PlasmaClient,
    rootChainEndpoint: string,
    contractAddress: Address,
    storage: IWalletStorage,
    mnemonic: string
  ) {
    return new ChamberWallet(
      client,
      new ethers.providers.JsonRpcProvider(rootChainEndpoint),
      ethers.Wallet.fromMnemonic(mnemonic),
      contractAddress,
      storage
    )    
  }

  static createRandomWallet(
    client: PlasmaClient,
    rootChainEndpoint: string,
    contractAddress: Address,
    storage: IWalletStorage
  ) {
    return new ChamberWallet(
      client,
      new ethers.providers.JsonRpcProvider(rootChainEndpoint),
      ethers.Wallet.createRandom(),
      contractAddress,
      storage
    )
  }

  constructor(
    client: PlasmaClient,
    provider: ethers.providers.JsonRpcProvider,
    wallet: ethers.Wallet,
    contractAddress: Address,
    storage: IWalletStorage
  ) {
    this.client = client
    this.loadedBlockNumber = 0
    this.httpProvider = provider
    const contract = new ethers.Contract(contractAddress, abi, this.httpProvider)
    this.wallet = wallet
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
      this.handleExit(
        e.values._exitId,
        e.values._exitStateHash,
        e.values._exitableAt,
        e.values._tokenId,
        e.values._start,
        e.values._end
      )
    })
    this.listener.addEvent('FinalizedExit', (e) => {
      console.log('FinalizedExit', e)
      this.handleFinalizedExit(
        e.values._tokenId,
        e.values._start,
        e.values._end
      )
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
    })

    this.exitableRangeManager = this.loadExitableRangeManager()
  }

  /**
   * @ignore
   */
  private loadExitableRangeManager() {
    try {
      const loaded = this.storage.get('exitable')
      return ExitableRangeManager.deserialize(loaded)
    }catch(e) {
      return new ExitableRangeManager()
    }
  }

  /**
   * @ignore
   */
  private saveExitableRangeManager() {
    this.storage.add('exitable', this.exitableRangeManager.serialize())
  }

  /**
   * 
   * @param handler 
   * 
   * ```typescript
   * await wallet.init((wallet) => {})
   * ```
   */
  async init(handler: (wallet: ChamberWallet) => void) {
    await this.listener.initPolling(() => {
      handler(this)
    })
  }

  async loadBlockNumber() {
    return await this.client.getBlockNumber()
  }

  /**
   * @ignore
   */
  private async loadBlocks() {
    const tasks = this.getWaitingBlocks().map(block => {
      return this.client.getBlock(block.blkNum.toNumber())
    })
    return Promise.all(tasks)
  }

  async syncChildChain(): Promise<SignedTransactionWithProof[]> {
    const results = await this.loadBlocks()
    const tasks = results.map(block => {
      if(block.isOk()) {
        const tasks = this.updateBlock(block.ok())
        // When success to get block, remove the block from waiting block list
        this.deleteWaitingBlock(block.ok().number)
        return tasks
      } else {
        console.warn(block.error())
        return []
      }
    })
    // send confirmation signatures
    await Promise.all(tasks)
    return this.getUTXOArray()
  }

  /**
   * @ignore
   */
  private _spend(txo: TransactionOutput) {
    this.getUTXOArray().forEach((tx) => {
      const output = tx.getOutput()
      if(output.checkSpent(txo)) {
        this.deleteUTXO(output.hash())
        tx.spend(txo).forEach(newTx => {
          this.addUTXO(newTx)
        })
      }
    })
  }

  /**
   * @ignore
   */
  private updateBlock(block: Block) {
    this.getUTXOArray().forEach((tx) => {
      const exclusionProof = block.getExclusionProof(tx.getOutput().getSegment(0))
      const key = tx.getOutput().hash()
      this.storage.addProof(key, block.getBlockNumber(), JSON.stringify(exclusionProof.serialize()))
    })
    const tasks = block.getUserTransactionAndProofs(this.wallet.address).map(tx => {
      tx.signedTx.tx.getInputs().forEach(input => {
        this._spend(input)
      })
      if(tx.getOutput().getOwners().indexOf(this.wallet.address) >= 0) {
        // require confirmation signature?
        if(tx.requireConfsig()) {
          tx.confirmMerkleProofs(this.wallet.privateKey)
        }
        this.addUTXO(tx)
        // send back to operator
        if(tx.requireConfsig()) {
          return this.client.sendConfsig(tx)
        }
      }
    }).filter(p => !!p)
    this.loadedBlockNumber = block.getBlockNumber()
    this.storage.add('loadedBlockNumber', this.loadedBlockNumber.toString())
    return tasks
  }

  /**
   * @ignore
   */
  handleDeposit(depositor: string, tokenId: BigNumber, start: BigNumber, end: BigNumber, blkNum: BigNumber) {
    const depositorAddress = ethers.utils.getAddress(depositor)
    const segment = new Segment(tokenId, start, end)
    const depositTx = new DepositTransaction(
      depositorAddress,
      segment
    )
    if(depositorAddress === this.getAddress()) {
      this.addUTXO(new SignedTransactionWithProof(
        new SignedTransaction(depositTx),
        0,
        '',
        '',
        ethers.constants.Zero,
        new SumMerkleProof(1, 0, segment, ''),
        blkNum))
    }
    this.exitableRangeManager.extendRight(end)
    this.saveExitableRangeManager()
    return depositTx
  }

  /**
   * @ignore
   */
  handleExit(
    exitId: BigNumber,
    exitStateHash: string,
    exitableAt: BigNumber,
    tokenId: BigNumber,
    start: BigNumber,
    end: BigNumber
  ) {
    const utxo = this.getUTXOArray().filter(utxo => {
      utxo.getOutput().hash() == exitStateHash
    })[0]
    if(utxo) {
      this.deleteUTXO(utxo.getOutput().hash())
      const segment = new Segment(tokenId, start, end)
      const exit = new Exit(
        exitId,
        exitableAt,
        segment
      )
      this.exitList.set(exit.getId(), exit.serialize())
      this.storeMap('exits', this.exitList)
      return exit
    } else {
      null
    }
  }

  /**
   * @ignore
   */
  handleFinalizedExit(tokenId: BigNumber, start: BigNumber, end: BigNumber) {
    try {
      this.exitableRangeManager.remove(
        tokenId,
        start,
        end
      )
    }catch(e){
      console.warn(e.message)
    }
    this.saveExitableRangeManager()
  }

  getExits() {
    const arr: Exit[] = []
    this.exitList.forEach(value => {
      arr.push(Exit.deserialize(value))
    })
    return arr
  }

  /**
   * @ignore
   */
  private deleteExit(id: string) {
    this.exitList.delete(id)
    this.storeMap('exits', this.exitList)
  }

  /**
   * @ignore
   */
  private getExitFromLocal(exitId: string) {
    const serialized = this.exitList.get(exitId)
    if(serialized)
      return Exit.deserialize(serialized)
    return null
  }

  /**
   * @ignore
   */
  loadExits() {
    return this.loadMap<string>('exits')
  }

  getUTXOArray(): SignedTransactionWithProof[] {
    const arr: SignedTransactionWithProof[] = []
    this.utxos.forEach(value => {
      arr.push(SignedTransactionWithProof.deserialize(JSON.parse(value)))
    })
    arr.sort((a: SignedTransactionWithProof, b: SignedTransactionWithProof) => {
      const aa = a.getOutput().getSegment(0).start
      const bb = b.getOutput().getSegment(0).start
      if(aa.gt(bb)) return 1
      else if(aa.lt(bb)) return -1
      else return 0
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

  /**
   * @ignore
   */
  private addWaitingBlock(tx: WaitingBlockWrapper) {
    this.waitingBlocks.set(tx.blkNum.toString(), tx.serialize())
    this.storeMap('waitingBlocks', this.waitingBlocks)
  }

  /**
   * @ignore
   */
  private deleteWaitingBlock(blkNum: number) {
    this.waitingBlocks.delete(blkNum.toString())
    this.storeMap('waitingBlocks', this.waitingBlocks)
  }

  /**
   * @ignore
   */
  private addUTXO(tx: SignedTransactionWithProof) {
    this.utxos.set(tx.getOutput().hash(), JSON.stringify(tx.serialize()))
    this.storeMap('utxos', this.utxos)
  }

  /**
   * @ignore
   */
  private loadUTXO() {
    return this.loadMap<string>('utxos')
  }

  /**
   * @ignore
   */
  private deleteUTXO(key: string) {
    this.utxos.delete(key)
    this.storeMap('utxos', this.utxos)
  }

  /**
   * @ignore
   */
  private loadSeenEvents() {
    return this.loadMap<boolean>('seenEvents')
  }

  /**
   * @ignore
   */
  private getNumberFromStorage(key: string): number {
    try {
      return Number(this.storage.get(key))
    } catch(e) {
      return 0
    }
  }

  /**
   * @ignore
   */
  private storeMap<T>(key: string, map: Map<string, T>) {
    this.storage.add(key, JSON.stringify(MapUtil.serialize<T>(map)))
  }

  /**
   * @ignore
   */
  private loadMap<T>(key: string) {
    try {
      return MapUtil.deserialize<T>(JSON.parse(this.storage.get(key)))
    } catch (e) {
      return MapUtil.deserialize<T>({})
    }
  }

  getAddress() {
    return this.wallet.address
  }

  getBalanceOfMainChain() {
    return this.wallet.getBalance()
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
  async deposit(ether: string): Promise<ChamberResult<DepositTransaction>> {
    const result = await this.rootChainContract.deposit({
      value: ethers.utils.parseEther(ether)
    })
    await result.wait()
    const receipt = await this.httpProvider.getTransactionReceipt(result.hash)
    if(receipt.logs && receipt.logs[0]) {
      const logDesc = this.rootChainInterface.parseLog(receipt.logs[0])
      return new ChamberOk(this.handleDeposit(
        logDesc.values._depositer,
        logDesc.values._tokenId,
        logDesc.values._start,
        logDesc.values._end,
        logDesc.values._blkNum
      ))
    } else {
      return new ChamberResultError(WalletErrorFactory.InvalidReceipt())
    }
  }

  async exit(tx: SignedTransactionWithProof): Promise<ChamberResult<Exit>> {
    const result = await this.rootChainContract.exit(
      tx.blkNum.mul(100).add(tx.outputIndex),
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
      // delete exiting UTXO from UTXO list.
      const exitOrNull = this.handleExit(
        logDesc.values._exitId,
        logDesc.values._exitStateHash,
        logDesc.values._exitableAt,
        logDesc.values._tokenId,
        logDesc.values._start,
        logDesc.values._end
      )
      if(exitOrNull)
        return new ChamberOk(exitOrNull)
      else
        return new ChamberResultError(WalletErrorFactory.InvalidReceipt())
    } else {
      return new ChamberResultError(WalletErrorFactory.InvalidReceipt())
    }
  }

  async getExit(exitId: string) {
    return await this.rootChainContract.getExit(exitId)
  }
  
  async finalizeExit(exitId: string): Promise<ChamberResult<Exit>> {
    const exit = this.getExitFromLocal(exitId)
    if(exit == null) {
      return new ChamberResultError(WalletErrorFactory.ExitNotFound())
    }
    const result = await this.rootChainContract.finalizeExit(
      this.exitableRangeManager.getExitableEnd(exit.segment.start, exit.segment.end),
      exitId)
    await result.wait()
    this.deleteExit(exit.getId())
    return new ChamberOk(exit)
  }

  /**
   * @ignore
   */
  private searchUtxo(to: Address, amount: BigNumber): SplitTransaction | null {
    let tx: SplitTransaction | null = null
    this.getUTXOArray().forEach((_tx) => {
      const output = _tx.getOutput()
      const segment = output.getSegment(0)
      if(segment.getAmount().gte(amount)) {
        tx = new SplitTransaction(
          this.wallet.address,
          new Segment(segment.getTokenId(), segment.start, segment.start.add(amount)),
          _tx.blkNum,
          to)
      }
    })
    return tx
  }

  searchMergable(): MergeTransaction | null {
    let tx = null
    let segmentEndMap = new Map<string, SignedTransactionWithProof>()
    this.getUTXOArray().forEach((_tx) => {
      const segment = _tx.getOutput().getSegment(0)
      const start = segment.start.toString()
      const end = segment.end.toString()
      const tx2 = segmentEndMap.get(start)
      if(tx2) {
        // _tx and segmentStartMap.get(start) are available for merge transaction
        tx = new MergeTransaction(
          this.wallet.address,
          tx2.getOutput().getSegment(0),
          segment,
          this.wallet.address,
          tx2.blkNum,
          _tx.blkNum
        )
      }
      segmentEndMap.set(end, _tx)
    })
    return tx
  }

  /**
   * @ignore
   */
  private makeSwapRequest(): SwapRequest | null {
    let swapRequest = null
    this.getUTXOArray().forEach((txNeighbor) => {
      const neighbor = txNeighbor.getOutput().getSegment(0)
      const txs = this.searchHole(neighbor)
      if(txs.length > 0) {
        const output = txs[0].getOutput()
        swapRequest = new SwapRequest(
          output.getOwners()[0],
          output.getBlkNum(),
          output.getSegment(0),
          txNeighbor.getOutput().getBlkNum(),
          neighbor)
      }
    })
    return swapRequest
  }

  private searchHole(neighbor: Segment) {
    return this.getUTXOArray().filter((_tx) => {
      const segment = _tx.getOutput().getSegment(0)
      return neighbor.end.lt(segment.start)
    })
  }

  private searchNeighbors(swapRequest: SwapRequest) {
    return this.getUTXOArray().filter((_tx) => {
      const segment = _tx.getOutput().getSegment(0)
      return swapRequest.check(segment)
    }).map(s => s.getOutput())
  }

  private checkSwapTx(swapTx: SwapTransaction) {
    const input = swapTx.getInputByOwner(this.getAddress())
    if(input) {
      return this.getUTXOArray().filter((_tx) => {
        // check input spent _tx which user has
        return _tx.getOutput().checkSpent(input)
      }).length > 0
    } else {
      return false
    }
  }

  async transfer(
    to: Address,
    amountStr: string
  ): Promise<ChamberResult<boolean>> {
    const amount = ethers.utils.bigNumberify(amountStr)
    const tx = this.searchUtxo(to, amount)
    if(tx == null) {
      return new ChamberResultError(WalletErrorFactory.TooLargeAmount())
    }
    const signedTx = new SignedTransaction(tx)
    signedTx.sign(this.wallet.privateKey)
    return await this.client.sendTransaction(signedTx)
  }

  async merge() {
    const tx = this.searchMergable()
    if(tx == null) {
      return new ChamberResultError(WalletErrorFactory.TooLargeAmount())
    }
    const signedTx = new SignedTransaction(tx)
    signedTx.sign(this.wallet.privateKey)
    return await this.client.sendTransaction(signedTx)
  }

  async swapRequest() {
    const swapRequest = this.makeSwapRequest()
    if(swapRequest) {
      return this.client.swapRequest(swapRequest)
    } else {
      return new ChamberResultError(WalletErrorFactory.SwapRequestError())
    }
  }

  async swapRequestRespond() {
    let swapRequests = await this.client.getSwapRequest()
    if(swapRequests.isError()) {
      return new ChamberResultError(WalletErrorFactory.SwapRequestError())
    }
    const tasks = swapRequests.ok().map((swapRequest) => {
      const neighbors = this.searchNeighbors(swapRequest)
      const neighbor = neighbors[0]
      if(neighbor) {
        swapRequest.setTarget(neighbor)
        return swapRequest
      } else {
        return null
      }
    })
    .filter(swapRequest => !!swapRequest)
    .map(swapRequest => {
      if(swapRequest) {
        const tx = swapRequest.getSignedSwapTx()
        if(tx) {
          tx.sign(this.wallet.privateKey)
          return this.client.swapRequestResponse(swapRequest.getOwner(), tx)
        }
      }
      return Promise.resolve(new ChamberResultError<boolean>(WalletErrorFactory.SwapRequestError()))
    }).filter(p => !!p)
    return await Promise.all(tasks)
  }

  async sendSwap() {
    const swapTxResult = await this.client.getSwapRequestResponse(this.getAddress())
    if(swapTxResult.isOk()) {
      const swapTx = swapTxResult.ok()
      if(this.checkSwapTx(swapTx.getRawTx() as SwapTransaction)) {
        swapTx.sign(this.wallet.privateKey)
        const result = await this.client.sendTransaction(swapTx)
        if(result.isOk()) {
          await this.client.clearSwapRequestResponse(this.getAddress())
        }
        return result
      }
    }
    return new ChamberResultError(WalletErrorFactory.SwapRequestError())
  }

  async startDefragmentation(handler: (message: string) => void) {
    handler('start defragmentation')
    const result = await this.merge()
    handler('merge phase is finished')
    if(result.isOk()) return
    await this.swapRequest()
    handler('swap request phase is finished')
    await this.swapRequestRespond()
    handler('swap respond phase is finished')
    await this.sendSwap()
    handler('all steps are finished')
  }

}
