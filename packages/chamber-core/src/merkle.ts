import {
  constants,
  utils
} from "ethers"
import BigNumber = utils.BigNumber

export class SumMerkleTreeNode {

  hash: Buffer
  len: BigNumber

  constructor(hash: Buffer | String, len: BigNumber) {
    if((typeof hash == 'string') && utils.isHexString(hash)) {
      this.hash = Buffer.from(utils.arrayify(hash))
    }else if(hash instanceof Buffer) {
      this.hash = hash;
    }else{
      throw new Error('invalid hash type')
    }
    this.len = len;
  }

  getHash(): Buffer {
    return this.hash;
  }

  getLength8Byte(): Buffer {
    return bignumTo8BytesBuffer(this.len);
  }
  getLength32Byte(): Buffer {
    return bignumTo32BytesBuffer(this.len);
  }


  getLengthAsBigNumber(): BigNumber {
    return this.len;
  }

  toBytes(leftOrRight: number): Buffer {
    return Buffer.concat([Buffer.from([leftOrRight]), this.getLength8Byte(), this.getHash()]);
  }

  static getEmpty() {
    return new SumMerkleTreeNode(
      Buffer.from(constants.HashZero, 'hex'),
      new BigNumber(0)
    );
  }

}

export type MerkleProof = Buffer

/**
 * @description SumMerkleTree
 *     see https://ethresear.ch/t/plasma-prime-design-proposal/4222
 */
export class SumMerkleTree {
  leaves: SumMerkleTreeNode[]
  layers: SumMerkleTreeNode[][]

  /**
   * @dev constructor
   * @param {SumMerkleTreeNode[]} leaves 
   */
  constructor(leaves: SumMerkleTreeNode[]) {
    if(!Array.isArray(leaves) || leaves.length < 1) {
      throw new Error('invalid leaves')
    }

    const depth = Math.ceil(Math.log(leaves.length) / Math.log(2))
    if(depth > 20) {
      throw new Error('depth must be 20 or less')
    }

    const layer = leaves.concat(
      Array.from(
        Array(Math.pow(2, depth) - leaves.length),
        () => SumMerkleTreeNode.getEmpty()))

    this.leaves = layer
    this.layers = [layer].concat(this.createLayers(layer))
  }

  /**
   * 
   * @param {SumMerkleTreeNode[]} nodes 
   */
  createLayers(nodes: SumMerkleTreeNode[]): SumMerkleTreeNode[][] {
    if(nodes.length <= 1) {
      return []
    }

    const treeLevel = []
    for(let i = 0; i < nodes.length; i += 2) {
      const left = nodes[i]
      const right = nodes[i + 1]
      const buf = keccak256(Buffer.concat([
        left.getLength32Byte(),
        left.getHash(),
        right.getLength32Byte(),
        right.getHash()]))
      const newNode = new SumMerkleTreeNode(
        buf,
        left.getLengthAsBigNumber().add(right.getLengthAsBigNumber()))
      treeLevel.push(newNode)
    }

    if(nodes.length % 2 === 1) {
      treeLevel.push(nodes[nodes.length - 1])
    }

    return [treeLevel].concat(this.createLayers(treeLevel))
  }

  getLeaves() {
    return this.leaves
  }

  root() {
    const rootLayer = this.layers[this.layers.length - 1]
    if(rootLayer.length != 1) {
      throw new Error('invalid root')
    }
    return rootLayer[0].getHash()
  }

  /**
   * 
   * @param {SumMerkleTreeNode} leaf 
   */
  getIndex(leaf: Buffer) {
    let index = -1

    for(let i = 0; i < this.leaves.length; i++) {
      if(Buffer.compare(leaf, this.leaves[i].getHash()) === 0) {
        index = i
      }
    }
    return index
  }

  proof(leaf: Buffer): MerkleProof {
    let index = this.getIndex(leaf)
    if(index < 0) {
      throw new Error('invalid leaf')
    }

    const proof = []
    if(index <= this.getLeaves().length) {
      for(let i = 0; i < this.layers.length - 1; i++) {
        const leftOrRight = (index % 2 === 0)
        let layerIndex = leftOrRight ? (index + 1) : (index - 1)
        index = Math.floor(index / 2)
        proof.push(this.layers[i][layerIndex].toBytes(leftOrRight?0:1))
      }
    }
    return Buffer.concat(proof)
  }

  /**
   * @description verify the leaf is included in tree
   * @param {Number} range is amount of the leaf to verify
   * @param {Buffer} value is the leaf value
   * @param {Number} index is index of the leaf to verify
   * @param {Number} totalAmount is total amount of tree
   * @param {Number} leftOffset is the position of the leaf from left
   * @param {Buffer} root is root of tree
   * @param {MerkleProof} proof is proof buffer for the leaf
   */
  verify(
    range: BigNumber,
    value: Buffer,
    totalAmount: BigNumber,
    leftOffset: BigNumber,
    root: Buffer,
    proof: MerkleProof
  ) {
    if(!value || !root) {
      return false
    }

    let currentAmount = range
    let hash = value
    let lastLeftAmount = new BigNumber(0)
    for(let i = 0; i < proof.length; i += 41) {
      const leftOrRight = proof.slice(i, i + 1).readUInt8(0)
      const amount = proof.slice(i + 1, i + 9)
      const node = proof.slice(i + 9, i + 41)
      const currentAmountBuf = bignumTo32BytesBuffer(currentAmount)
      let buf = []
      if(leftOrRight === 0) {
        buf = [currentAmountBuf, hash, convert32(amount), node]
      }else{
        buf = [convert32(amount), node, currentAmountBuf, hash]
        lastLeftAmount = currentAmount.sub(range)
      }
      currentAmount = currentAmount.add(utils.bigNumberify(amount))
      hash = keccak256(Buffer.concat(buf))
    }
    
    return (
      Buffer.compare(hash, root) === 0
      && currentAmount.eq(totalAmount)
      && lastLeftAmount.eq(leftOffset))
  }
}

/**
 * bignumTo8BytesBuffer
 * @param {BigNumber} bn 
 */
function bignumTo8BytesBuffer(bn: BigNumber): Buffer {
  let str = bn.toHexString()
  return Buffer.from(utils.hexZeroPad(str, 8).substr(2), 'hex')
}

/**
 * bignumTo32BytesBuffer
 * @param {BigNumber} bn 
 */
function bignumTo32BytesBuffer(bn: BigNumber): Buffer {
  let str = bn.toHexString()
  return Buffer.from(utils.hexZeroPad(str, 32).substr(2), 'hex')
}

function convert32(amount: Buffer): Buffer {
  return Buffer.from(utils.hexZeroPad(utils.hexlify(amount), 32).substr(2), 'hex')
}

/**
 * 
 * @param b is Buffer
 */
function keccak256(b: Buffer): Buffer {
  return Buffer.from(utils.keccak256(utils.hexlify(b)).substr(2), 'hex')
}

module.exports = {
  SumMerkleTreeNode,
  SumMerkleTree
}