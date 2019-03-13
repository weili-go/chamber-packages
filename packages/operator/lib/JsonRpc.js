const jayson = require('jayson');
const cors = require('cors');
const connect = require('connect');
const jsonParser = require('body-parser').json;
const app = connect();
const {
  SignedTransaction,
  SignedTransactionWithProof,
  SwapRequest
} = require('@layer2/core')

module.exports.run = childChain => {
  // create a server
  var server = jayson.server({
    sendTransaction: (args, cb) => {
      const signedTx = SignedTransaction.deserialize(args[0])
      const result = childChain.appendTx(signedTx);
      if(result.isOk()) {
        cb(null, result.ok());
      } else {
        cb(result.error().serialize().error);
      }      
    },
    sendConfsig: async (args, cb) => {
      const signedTx = SignedTransactionWithProof.deserialize(args[0])
      const result = await childChain.updateConfSig(signedTx)
      cb(null, true);
    },
    getBlockNumber: (args, cb) => {
      // Get latest block for descending manner
      // https://github.com/ethereum/wiki/wiki/JSON-RPC#eth_blocknumber
      cb(null, childChain.blockHeight)
    },
    getBlock: (args, cb) => {
      childChain.getBlock(args[0]).then((result) => {
        if(result.isOk()) {
          cb(null, result.ok().serialize());
        } else {
          cb(result.error().serialize().error);
        }
      }).catch((e) => {
        console.error(e)
        cb({
          code: -100,
          message: e.message
        })
      })
    },
    swapRequest: async (args, cb) => {
      const swapRequest = SwapRequest.deserialize(args[0])
      childChain.getSwapManager().requestSwap(swapRequest)
      cb(null, true)
    },
    swapRequestResponse: async (args, cb) => {
      console.log(args[0])
      const signedTx = SignedTransaction.deserialize(args[1])
      childChain.getSwapManager().respondRequestSwap(args[0], signedTx)
      cb(null, true)
    },
    clearSwapRequestResponse: async (args, cb) => {
      childChain.getSwapManager().clearRespond(args[0])
      cb(null, true)
    },
    getSwapRequest: async (args, cb) => {
      const swapRequests = childChain.getSwapManager().getRequests()
      cb(null, swapRequests.map(r => r.serialize()))
    },
    getSwapRequestResponse: async (args, cb) => {
      const signedTx = childChain.getSwapManager().getRespond(args[0])
      if(signedTx) {
        cb(null, signedTx.serialize())
      } else {
        cb({code: 0, message: ''})
      }
    },
    getCurrentSegments: (args, cb) => {
      cb(null, childChain.getCurrentSegments())
    }
  });
  app.use('/check', (req, res) => {
    res.end('OK!\n');
  })
  app.use(cors({methods: ['POST', 'GET']}));
  app.use(jsonParser());
  app.use(server.middleware());

  app.listen(process.env.PORT || 3000);

}
