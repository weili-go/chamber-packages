import {
  SignedTransaction,
  TransactionOutput,
  TransactionOutputDeserializer,
  DepositTransaction
} from '@layer2/core'
import { BigNumber } from 'ethers/utils';

export class SegmentChecker {

  leaves: TransactionOutput[]

  constructor() {
    this.leaves = []
  }

  private _isContain(txo: TransactionOutput) {
    return this.leaves.filter(l => {
      return l.checkSpent(txo)
    }).length > 0
  }

  private _spent(txo: TransactionOutput) {
    const target = this.leaves.filter(l => l.checkSpent(txo))[0]
    this.leaves = this.leaves.filter(l => !(l.checkSpent(txo)))
    if(target) {
      target.subSpent(txo).forEach(newTxo => {
        this.leaves.push(newTxo)
      })
      return true
    } else {
      return false
    }
  }

  private _insert(txo: TransactionOutput, blkNum: BigNumber) {
    this.leaves.push(txo.withBlkNum(blkNum))
  }

  isContain(tx: SignedTransaction): boolean {
    return tx.getRawTx().getInputs().reduce((isContain, i) => {
      return isContain && this._isContain(i)
    }, true)
  }

  spent(tx: SignedTransaction) {
    tx.getRawTx().getInputs().forEach((i) => {
      this._spent(i)
    })
  }

  insert(tx: SignedTransaction, blkNum: BigNumber) {
    tx.getRawTx().getOutputs().forEach((o) => {
      this._insert(o, blkNum)
    })
  }

  insertDepositTx(depositTx: DepositTransaction, blkNum: BigNumber) {
    this._insert(depositTx.getOutput(), blkNum)
  }

  serialize() {
    return this.leaves.map(l => l.serialize())
  }

  deserialize(data: any[]) {
    this.leaves = data.map(d => {
      return TransactionOutputDeserializer.deserialize(d)
    })
  }

}
