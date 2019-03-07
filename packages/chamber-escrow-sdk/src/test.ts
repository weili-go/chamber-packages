import {
  JsonRpcClient,
  PlasmaClient
} from './client'
import {
  ChamberWallet,
} from './wallet'
import {
  MockStorage,
} from './storage/MockStorage'

const wallet = ChamberWallet.createWalletWithPrivateKey(
  new PlasmaClient(new JsonRpcClient('http://127.0.0.1:3000')),
  'http://127.0.0.1:8545',
  '0x30753e4a8aad7f8597332e813735def5dd395028',
  new MockStorage(),
  '0xc87509a1c067bbde78beb793e6fa76530b6382a4c0241e5e4a9ec0a0f44dc0d3',
)

wallet.deposit('1.0').then((receipt) => {
  console.log('deposited', receipt)
})
