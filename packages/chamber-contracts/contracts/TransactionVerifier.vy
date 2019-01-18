struct BaseTx:
  maxBlknum: address
  start: address
  end: uint256

struct TransferTx:
  _from: address
  start: uint256
  end: uint256
  blkNum: uint256
  to: address

struct SplitTx:
  _from: address
  start: uint256
  end: uint256
  blkNum: uint256
  to1: address
  to2: address
  offset: uint256

struct MergeTx:
  _from: address
  start: uint256
  offset: uint256
  end: uint256
  blkNum1: uint256
  blkNum2: uint256
  to: address

struct SwapTx:
  from1: address
  start1: uint256
  end1: uint256
  blkNum1: uint256
  from2: address
  start2: uint256
  end2: uint256
  blkNum2: uint256

struct MultisigTx:
  lockstate: bytes[256]
  nextstate: bytes[256]
  from1: address
  start1: uint256
  end1: uint256
  blkNum1: uint256
  from2: address
  start2: uint256
  end2: uint256
  blkNum2: uint256

#
# Library
#

@private
@constant
def decodeSegment(_segmentBytes: bytes[64]) -> (uint256, uint256):
  segmentList = RLPList(_segmentBytes, [uint256, uint256])
  return segmentList[0], segmentList[1]

# transfer
@private
@constant
def decodeTransfer(_tBytes: bytes[224]) -> (uint256, uint256):
  #  label, maxBlkNum, from, start, end, blkNum, to
  tList = RLPList(_tBytes, [uint256, uint256, address, uint256, uint256, uint256, address])
  return tList[0], tList[1]

# split
@private
@constant
def decodeSplit(_tBytes: bytes[224]) -> (uint256, uint256):
  #  label, maxBlkNum, from, start, end, blkNum, to1, to2, offset
  tList = RLPList(_tBytes, [uint256, uint256, address, uint256, uint256, uint256, address, address, uint256])
  return tList[0], tList[1]

# merge
@private
@constant
def decodeMerge(_tBytes: bytes[224]) -> (uint256, uint256):
  #  label, maxBlkNum, from, start, offset, end, blkNum1, blkNum2, to
  tList = RLPList(_tBytes, [
    uint256, uint256, address, uint256, uint256, uint256, uint256, uint256, address])
  return tList[0], tList[1]

# atomic swap
@private
@constant
def decodeSwap(_tBytes: bytes[224]) -> (uint256, uint256):
  #  label, maxBlkNum, from1, start1, end1, blkNum1, from2, start2, end2, blkNum2
  tList = RLPList(_tBytes, [
    uint256, uint256, address, uint256, uint256, uint256, address, uint256, uint256, uint256])
  return tList[0], tList[1]


# multisig
@private
@constant
def decodeMultisig2(_tBytes: bytes[224]) -> (uint256, uint256):
  #  label, maxBlkNum, lockstate, nextstate, from1, start1, end1, blkNum1, from2, start2, end2, blkNum2
  tList = RLPList(_tBytes, [
    uint256, uint256, bytes, bytes, address, uint256, uint256, uint256, address, uint256, uint256, uint256])
  return tList[0], tList[1]


@public
@constant
def get(_segmentBytes: bytes[64]) -> (uint256, uint256):
  return self.decodeSegment(_segmentBytes)
