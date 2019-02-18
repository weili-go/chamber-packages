import { ChamberError } from '@layer2/core'

export class ChainErrorFactory {

  static BlockNotFound() {
    return new ChamberError(1000, 'block not found')
  }
  static InvalidTransaction() {
    return new ChamberError(1010, 'invalid transaction')
  }
  static ConflictSegment() {
    return new ChamberError(1020, 'segment conflicted')
  }
  static NoValidTransactions() {
    return new ChamberError(1030, 'no valid transactions')
  }

}
