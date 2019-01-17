const { deployRLPdecoder } = require('./helpers/deployRLPdecoder')

const utils = require("ethereumjs-util");
const RLP = require('rlp')

const RootChain = artifacts.require("Rootchain")

const BigNumber = web3.utils.BN

require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should();


contract("RootChain", ([owner, nonOwner]) => {
  const start = new BigNumber(100000);
  const end = new BigNumber(200000);


  beforeEach(async () => {
    await deployRLPdecoder(owner);
    this.rootChain = await RootChain.new();
  });

  describe("segment", () => {
    it("should decode segment", async () => {
      const hex = utils.bufferToHex(RLP.encode([start, end]))
      const result = await this.rootChain.get(
        hex,
        {
          from: owner
        });
      assert.equal(start.toString(), result[0].toString())
      assert.equal(end.toString(), result[1].toString())
    })
  });
  
})
