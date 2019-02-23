import { SwapRequest, SignedTransaction } from '@layer2/core';

export class SwapManager {

  requests: SwapRequest[]
  responds: Map<string, SignedTransaction>

  constructor() {
    this.requests = []
    this.responds = new Map<string, SignedTransaction>()
  }

  requestSwap(swapReq: SwapRequest) {
    this.requests.push(swapReq)
    if(this.requests.length > 10) {
      this.requests.shift()
    }
  }

  respondRequestSwap(swapTx: SignedTransaction) {
    const from2 = swapTx.getRawTx().getInput(1).getOwners()[0]
    this.responds.set(from2, swapTx)
  }

  clearRespond(owner: string) {
    this.responds.delete(owner)
  }
  
  getRequests() {
    return this.requests
  }

  getRespond(owner: string) {
    return this.responds.get(owner)
  }

}