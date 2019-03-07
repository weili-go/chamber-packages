import { ChamberError } from '@layer2/core'

export class WalletErrorFactory {
  static InvalidReceipt() {
    return new ChamberError(1200, 'invalid receipt')
  }
  static ExitNotFound() {
    return new ChamberError(1220, 'exit not found')
  }
  static TooLargeAmount() {
    return new ChamberError(1230, 'too large amount')
  }
  static SwapRequestError() {
    return new ChamberError(1240, 'swap request error')
  }
  
}
