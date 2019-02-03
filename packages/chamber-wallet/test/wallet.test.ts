import { describe, it } from "mocha"
import {
  ChamberWallet
} from '../src'
import {
  INetworkClient,
  JsonRpcClient,
  PlasmaClient
} from '../src/client'

import { assert } from "chai"
import { constants, utils } from "ethers"

class MockNetworkClient implements INetworkClient {
  request(methodName: string, args: any) {
    return Promise.resolve({})
  }
}

const AlicePrivateKey = '0xe88e7cda6f7fae195d0dcda7ccb8d733b8e6bb9bd0bc4845e1093369b5dc2257'
const ContractAddress = '0xfb88de099e13c3ed21f80a7a1e49f8caecf10df6'

describe('ChamberWallet', () => {

  it('should create wallet', () => {
    const mockClient = new MockNetworkClient()
    const client = new PlasmaClient(mockClient)
    const wallet = new ChamberWallet(
      client,
      AlicePrivateKey,
      'http://127.0.0.1:8545',
      ContractAddress
    )
    assert.equal(wallet.getBalance().toNumber(), 0)
  })
  
})
