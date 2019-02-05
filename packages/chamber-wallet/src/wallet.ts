import * as ethers from 'ethers'
import {
  PlasmaClient
} from './client'
import {
  IWalletStorage
} from './storage/IWalletStorage'
import {
  Address,
  constants,
  SplitTransaction,
  SignedTransaction,
  SignedTransactionWithProof,
  Block,
} from '@layer2/core'
import { Contract } from 'ethers'
import { BigNumber } from 'ethers/utils';

const abi = [
  'event BlockSubmitted(bytes32 _root, uint256 _timestamp, uint256 _blkNum)',
  'event Deposited(address indexed _depositer, uint256 _start, uint256 _end, uint256 _blkNum)',
  'event ExitStarted(address indexed _exitor, bytes32 _txHash, uint256 exitableAt, uint256 _start, uint256 _end)',
  'function deposit() payable',
  'function exit(uint256 _utxoPos, uint256 _start, uint256 _end, bytes _txBytes, bytes _proof, bytes _sig) payable',
  'function finalizeExit(bytes32 _exitHash)',
  'function getExit(bytes32 _exitHash) constant returns(address, uint256)',
]

export class ChamberWallet {
  client: PlasmaClient
  latestBlockNumber: number
  loadedBlockNumber: number
  rootChainContract: Contract
  wallet: ethers.Wallet
  utxos: Map<string, SignedTransactionWithProof>
  storage: IWalletStorage
  httpProvider: ethers.providers.JsonRpcProvider

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
    this.utxos = new Map<string, SignedTransactionWithProof>()
    this.loadUTXO()
    this.storage = storage
    this.loadedBlockNumber = this.getNumberFromStorage('loadedBlockNumber')
  }

  async loadBlockNumber() {
    return await this.client.getBlockNumber()
  }

  private async loadBlocks() {
    const blkNum: number = await this.client.getBlockNumber()
    this.latestBlockNumber = blkNum
    let tasks = [];
    for(let i = this.loadedBlockNumber + 1;i <= this.latestBlockNumber;i++) {
      tasks.push(this.client.getBlock(i));
    }
    return Promise.all(tasks)
  }

  async updateBlocks() {
    const results = await this.loadBlocks()
    results.map(this.updateBlock)
  }

  updateBlock(block: Block) {
    this.utxos.forEach((tx) => {
      const exclusionProof = block.getExclusionProof(tx.getOutput().getSegment(0).start)
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

  addUTXO(tx: SignedTransactionWithProof) {
    this.utxos.set(tx.getOutput().hash(), tx)
    this.storage.add('utxos', JSON.stringify(this.utxos))
  }

  loadUTXO() {
    try {
      this.utxos = JSON.parse(this.storage.get('utxos'))
    } catch(e) {
      this.utxos = new Map<string, SignedTransactionWithProof>()
    }
  }

  deleteUTXO(key: string) {
    this.utxos.delete(key)
    this.storage.add('utxos', JSON.stringify(this.utxos))
  }

  getNumberFromStorage(key: string): number {
    try {
      return Number(this.storage.get(key))
    } catch(e) {
      return 0
    }
  }

  getAddress() {
    return this.wallet.address
  }

  getBalance() {
    let balance = ethers.utils.bigNumberify(0)
    this.utxos.forEach((tx) => {
      balance.add(tx.getOutput().getSegment(0).getAmount())
    })
    return balance
  }

  /**
   * 
   * @param ether 1.0
   */
  async deposit(ether: string) {
    const result = await this.rootChainContract.deposit({
      value: ethers.utils.parseEther(ether)
    })
    return await this.httpProvider.getTransactionReceipt(result.hash)
  }

  async exit(tx: SignedTransactionWithProof) {
    return await this.rootChainContract.exit(
      tx.blkNum.mul(100),
      tx.getOutput().getSegment(0).start,
      tx.getOutput().getSegment(0).end,
      tx.getTxBytes(),
      tx.getProofAsHex(),
      tx.getSignatures(),
      {
      value: constants.EXIT_BOND
    })
  }

  async getExit(exitId: string) {
    return await this.rootChainContract.getExit(exitId)
  }
  
  async finalizeExit(exitId: string) {
    return await this.rootChainContract.finalizeExit(exitId)
  }

  searchUtxo(amount: number): SignedTransactionWithProof | null {
    let tx: SignedTransactionWithProof | null = null
    this.utxos.forEach((_tx) => {
      if(_tx.getOutput().getSegment(0).getAmount().toNumber() > amount) {
        tx = _tx
      }
    })
    return tx
  }

  async sendTransaction(
    to: Address,
    amount: number
  ) {
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
      this.wallet.address,
      to,
      segment.start.add(amount)
    )
    const signedTx = new SignedTransaction(newTx)
    signedTx.sign(this.wallet.privateKey)
    await this.client.sendTransaction(JSON.stringify(signedTx.serialize()))
  }

  // events
  // handleDeposit
  // handleSubmit(confirm transaction)
  // handleExit invalid exit


}
