const { deployRLPdecoder } = require('./helpers/deployRLPdecoder')

const utils = require("ethereumjs-util")
const {
  Segment
} = require('@layer2/core')
const TransactionVerifier = artifacts.require("TransactionVerifier")

const ethers = require('ethers')

const BigNumber = ethers.utils.BigNumber

require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should();


contract("TransactionVerifier", ([alice, bob, operator, user4, user5, admin]) => {
  const start = new BigNumber(100000)
  const end = new BigNumber(200000)
  const segment = new Segment(start, end)

  beforeEach(async () => {
    await deployRLPdecoder(admin)
    this.transactionVerifier = await TransactionVerifier.new({ from: operator })
  });

  describe("segment", () => {
    it("should decode segment", async () => {
      const hex = utils.bufferToHex(segment.encode())
      const result = await this.transactionVerifier.get(
        hex,
        {
          from: bob
        });
      assert.equal(start.toString(), result[0].toString())
      assert.equal(end.toString(), result[1].toString())
    })
  });
  
})
