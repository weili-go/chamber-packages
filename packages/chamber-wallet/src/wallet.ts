import * as ethers from 'ethers'
import {
  PlasmaClient
} from './client'
import { Address, constants, SplitTransaction, SignedTransaction } from '@layer2/core'
import { Contract } from 'ethers'
import { SignedTransactionWithProof } from '@layer2/core'

const abi = [
  'event BlockSubmitted(bytes32 _root, uint256 _timestamp, uint256 _blkNum)',
  'event Deposited(address _depositer, uint256 _start, uint256 _end, uint256 _blkNum)',
  'event ExitStarted(bytes32 _txHash, address _exitor, uint256 exitableAt, uint256 _start, uint256 _end)',
  'function deposit()',
  'function exit(uint256 _utxoPos, uint256 _start, uint256 _end, bytes _txBytes, bytes _proof, bytes _sig)'
]

export class ChamberWallet {
  client: PlasmaClient
  latestBlockNumber: number
  loadedBlockNumber: number
  rootChainContract: Contract
  wallet: ethers.Wallet
  utxos: Map<string, SignedTransactionWithProof>

  constructor(
    client: PlasmaClient,
    privateKey: string,
    rootChainEndpoint: string,
    contractAddress: Address
  ) {
    this.client = client
    this.latestBlockNumber = 0
    this.loadedBlockNumber = 0
    const httpProvider = new ethers.providers.JsonRpcProvider(rootChainEndpoint)
    const contract = new ethers.Contract(contractAddress, abi, httpProvider)
    this.wallet = new ethers.Wallet(privateKey, httpProvider)
    this.rootChainContract = contract.connect(this.wallet)
    this.utxos = new Map<string, SignedTransactionWithProof>()
  }

  async loadUserTransactions() {
    const blkNum: number = await this.client.getBlockNumber()
    this.latestBlockNumber = blkNum
    let tasks = [];
    for(let i = this.loadedBlockNumber + 1;i <= this.latestBlockNumber;i++) {
      tasks.push(this.client.getUserTransactions(i));
    }
    return Promise.all(tasks)
  }

  async updateUtxos() {
    const results = await this.loadUserTransactions()
    results.map(txs => {
      txs.map(tx => {
        tx.signedTx.tx.getInputs().forEach(input => {
          this.utxos.delete(input.hash())
        })
        if(tx.getOutput().getOwners().indexOf(this.wallet.address) >= 0) {
          this.utxos.set(tx.getOutput().hash(), tx)
        }
      })
    })
  }

  getBalance() {
    let balance = ethers.utils.bigNumberify(0)
    this.utxos.forEach((tx) => {
      balance.add(tx.getOutput().getSegment(0).getAmount())
    })
    return balance
  }

  async deposit() {
    return await this.rootChainContract.deposit({
      value: ethers.utils.parseEther('1.0')
    })
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

  searchUtxo(amount: number): SignedTransactionWithProof | null {
    let tx: SignedTransactionWithProof | null = null
    this.utxos.forEach((_tx) => {
      if(_tx.getOutput().getSegment(0).getAmount().toNumber() > amount) {
        tx = _tx
      }
    })
    return tx
  }

  sendTransaction(
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
    this.client.sendTransaction(JSON.stringify(signedTx.serialize()))
  }

  // events
  // handleDeposit
  // handleSubmit(confirm transaction)
  // handleExit invalid exit


}
