import {
  JsonRpcClient,
  PlasmaClient
} from './client'
import {
  ChamberWallet
} from './wallet'

const wallet = new ChamberWallet(
  new PlasmaClient(new JsonRpcClient('http://127.0.0.1:3000')),
  '0xc87509a1c067bbde78beb793e6fa76530b6382a4c0241e5e4a9ec0a0f44dc0d3',
  'http://127.0.0.1:8545',
  '0xfb88de099e13c3ed21f80a7a1e49f8caecf10df6'
)

wallet.deposit().then(() => {
  console.log('deposited')
})
