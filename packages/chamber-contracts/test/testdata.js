const ethers = require('ethers')

const BigNumber = ethers.utils.BigNumber

const {
  SumMerkleTree,
  SumMerkleTreeNode
} = require('@layer2/core')


const leaves = []
leaves[0] = new SumMerkleTreeNode(
  Buffer.from('f19587814e8e932897572358b3c0ca6d9cbcc71654b1d312195607aa2b000001', 'hex'),
  new BigNumber(2)
);
leaves[1] = new SumMerkleTreeNode(
  Buffer.from('f19587814e8e932897572358b3c0ca6d9cbcc71654b1d312195607aa2b000002', 'hex'),
  new BigNumber(3)
);
leaves[2] = new SumMerkleTreeNode(
  Buffer.from('f19587814e8e932897572358b3c0ca6d9cbcc71654b1d312195607aa2b000003', 'hex'),
  new BigNumber(4)
);
leaves[3] = new SumMerkleTreeNode(
  Buffer.from('f19587814e8e932897572358b3c0ca6d9cbcc71654b1d312195607aa2b000004', 'hex'),
  new BigNumber(5)
);
leaves[4] = new SumMerkleTreeNode(
  Buffer.from('f19587814e8e932897572358b3c0ca6d9cbcc71654b1d312195607aa2b000005', 'hex'),
  new BigNumber(10)
);


module.exports = {
  Scenario1: {
    leaves: leaves,
    tree: new SumMerkleTree(leaves)
  }
}
