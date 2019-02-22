import {
  INetworkClient
} from './JsonRpcClient'
import {
  ChamberResult,
  ChamberOk,
  ChamberResultError,
  ChamberError,
  SignedTransactionWithProof,
  Block,
  SwapRequest,
  SignedTransaction
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

  async sendTransaction(tx: SignedTransaction): Promise<ChamberResult<boolean>> {
    const res = await this.jsonRpcClient.request('sendTransaction', [tx.serialize()])
    return PlasmaClient.deserialize<boolean>(res, (result) => result as boolean)
  }

  async sendConfsig(tx: SignedTransactionWithProof): Promise<ChamberResult<boolean>> {
    const res = await this.jsonRpcClient.request('sendConfsig', [tx.serialize()])
    return PlasmaClient.deserialize<boolean>(res, (result) => result as boolean)
  }

  async swapRequest(swapRequest: SwapRequest): Promise<ChamberResult<boolean>> {
    const res = await this.jsonRpcClient.request('swapRequest', [swapRequest.serialize()])
    return PlasmaClient.deserialize<boolean>(res, (result) => result as boolean)
  }

  async swapRequestResponse(tx: SignedTransaction): Promise<ChamberResult<boolean>> {
    const res = await this.jsonRpcClient.request('swapRequestResponse', [tx.serialize()])
    return PlasmaClient.deserialize<boolean>(res, (result) => result as boolean)
  }

  async getSwapRequest(): Promise<ChamberResult<SwapRequest[]>> {
    const res = await this.jsonRpcClient.request('getSwapRequest', [])
    return PlasmaClient.deserialize<SwapRequest[]>(res, (result) => result.map((r:any) => SwapRequest.deserialize(r)))
  }

  async getSwapRequestResponse(owner: string): Promise<ChamberResult<SignedTransaction>> {
    const res = await this.jsonRpcClient.request('getSwapRequestResponse', [owner])
    return PlasmaClient.deserialize<SignedTransaction>(res, (result) => SignedTransaction.deserialize(result))
  }

}
