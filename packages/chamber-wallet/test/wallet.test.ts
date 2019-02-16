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
import { MockWalletStorage } from "../src/storage/MockWalletStorage";
import { util } from 'prettier';

class MockNetworkClient implements INetworkClient {
  request(methodName: string, args: any) {
    return Promise.resolve({})
  }
}


describe('ChamberWallet', () => {

  const AlicePrivateKey = '0xe88e7cda6f7fae195d0dcda7ccb8d733b8e6bb9bd0bc4845e1093369b5dc2257'
  const AliceAddress = utils.computeAddress(AlicePrivateKey)
  const ContractAddress = '0xfb88de099e13c3ed21f80a7a1e49f8caecf10df6'
  const mockClient = new MockNetworkClient()
  const client = new PlasmaClient(mockClient)
  let storage = new MockWalletStorage()

  beforeEach(() => {
    storage = new MockWalletStorage()
  })

  it('should create wallet', () => {
    const wallet = new ChamberWallet(
      client,
      AlicePrivateKey,
      'http://127.0.0.1:8545',
      ContractAddress,
      storage
    )
    assert.equal(wallet.getBalance().toNumber(), 0)
  })


  describe('handleDeposit', () => {

    const wallet = new ChamberWallet(
      client,
      AlicePrivateKey,
      'http://127.0.0.1:8545',
      ContractAddress,
      storage
    )

    it('should handleDeposit', () => {
      wallet.handleDeposit(
        AliceAddress,
        utils.bigNumberify(0),
        utils.bigNumberify(0),
        utils.bigNumberify(10000000),
        utils.bigNumberify(2)
      )
      console.log(wallet.getUTXOArray())
      assert.equal(wallet.getBalance().toNumber(), 10000000)
    })
    
  })

  describe('getExits', () => {

    const wallet = new ChamberWallet(
      client,
      AlicePrivateKey,
      'http://127.0.0.1:8545',
      ContractAddress,
      storage
    )

    it('should getExit', () => {
      wallet.handleExit(
        utils.bigNumberify(1),
        utils.bigNumberify(1520700),
        utils.bigNumberify(0),
        utils.bigNumberify(0),
        utils.bigNumberify(10000000)
      )
      assert.equal(wallet.getExits().length, 1)
      wallet.loadExits()
      assert.equal(wallet.getExits().length, 1)
    })
    
  })
  
  describe('transfer', () => {

    const wallet = new ChamberWallet(
      client,
      AlicePrivateKey,
      'http://127.0.0.1:8545',
      ContractAddress,
      storage
    )

    it('should transfer', async () => {
      wallet.handleDeposit(
        AliceAddress,
        utils.bigNumberify(0),
        utils.bigNumberify(0),
        utils.bigNumberify(10000000),
        utils.bigNumberify(2)
      )
      await wallet.transfer(
        AliceAddress,
        '2000000'
      )
    })
    
  })
  

})
