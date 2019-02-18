import {
  INetworkClient
} from './JsonRpcClient'
import {
  ChamberResult,
  ChamberOk,
  ChamberResultError,
  ChamberError,
  SignedTransactionWithProof,
  Block
} from '@layer2/core';

export class PlasmaClient {
  jsonRpcClient: INetworkClient

  constructor(
    client: INetworkClient
  ) {
    this.jsonRpcClient = client
  }

  static deserialize<T>(serialized: any, handler: (data: any) => T): ChamberResult<T> {
    if(serialized.error) {
      return new ChamberResultError<T>(new ChamberError(serialized.error.code, serialized.error.message))
    } else {
      return new ChamberOk<T>(handler(serialized.result))
    }
  }

  async getBlockNumber(): Promise<number> {
    const res = await this.jsonRpcClient.request('getBlockNumber', {})
    return res.result
  }

  async getBlock(blkNum: number): Promise<ChamberResult<Block>> {
    const res = await this.jsonRpcClient.request('getBlock', [blkNum])
    return PlasmaClient.deserialize<Block>(res, (result) => Block.deserialize(result))
  }

  async getUserTransactions(blkNum: number): Promise<SignedTransactionWithProof[]> {
    const res = await this.jsonRpcClient.request('getUserTransactions', [blkNum])
    return res.result.map((r: string) => SignedTransactionWithProof.deserialize(r))
  }

  async sendTransaction(data: any): Promise<ChamberResult<boolean>> {
    const res = await this.jsonRpcClient.request('sendTransaction', [data])
    return PlasmaClient.deserialize<boolean>(res, (result) => result as boolean)
  }
  
}
