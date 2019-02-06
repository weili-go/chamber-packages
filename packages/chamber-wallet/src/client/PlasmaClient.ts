import {
  INetworkClient
} from './JsonRpcClient'
import { SignedTransactionWithProof } from '@layer2/core';

export class PlasmaClient {
  jsonRpcClient: INetworkClient

  constructor(
    client: INetworkClient
  ) {
    this.jsonRpcClient = client
  }

  async getBlockNumber(): Promise<number> {
    const res = await this.jsonRpcClient.request('getBlockNumber', {})
    return res.result
  }

  async getBlock(blkNum: number) {
    const res = await this.jsonRpcClient.request('getBlock', [blkNum])
    if(res.error) {
      throw new Error(res.error.message)
    }
    return res.result
  }

  async getUserTransactions(blkNum: number): Promise<SignedTransactionWithProof[]> {
    const res = await this.jsonRpcClient.request('getUserTransactions', [blkNum])
    return res.result.map((r: string) => SignedTransactionWithProof.deserialize(r))
  }

  sendTransaction(data: string) {
    return this.jsonRpcClient.request('sendTransaction', [data])
  }
  
}
