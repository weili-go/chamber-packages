# multisig

# total deposit amount per token type
TOTAL_DEPOSIT: constant(uint256) = 2**48
MASK8BYTES: constant(uint256) = 2**64 - 1

# @dev from https://github.com/LayerXcom/plasma-mvp-vyper
@private
@constant
def ecrecoverSig(_txHash: bytes32, _sig: bytes[260], index: int128) -> address:
  if len(_sig) % 65 != 0:
    return ZERO_ADDRESS
  # ref. https://gist.github.com/axic/5b33912c6f61ae6fd96d6c4a47afde6d
  # The signature format is a compact form of:
  # {bytes32 r}{bytes32 s}{uint8 v}
  r: uint256 = extract32(_sig, 0 + 65 * index, type=uint256)
  s: uint256 = extract32(_sig, 32 + 65 * index, type=uint256)
  v: int128 = convert(slice(_sig, start=64 + 65 * index, len=1), int128)
  # Version of signature should be 27 or 28, but 0 and 1 are also possible versions.
  # geth uses [0, 1] and some clients have followed. This might change, see:
  # https://github.com/ethereum/go-ethereum/issues/2053
  if v < 27:
    v += 27
  if v in [27, 28]:
    return ecrecover(_txHash, convert(v, uint256), r, s)
  return ZERO_ADDRESS

@public
@constant
def parseSegment(
  segment: uint256
) -> (uint256, uint256, uint256):
  tokenId: uint256 = bitwise_and(shift(segment, -16 * 8), MASK8BYTES)
  start: uint256 = bitwise_and(shift(segment, -8 * 8), MASK8BYTES)
  end: uint256 = bitwise_and(segment, MASK8BYTES)
  return (tokenId, start, end)

@public
@constant
def encodeExitState(
  owner: address,
  tokenId: uint256,
  start: uint256,
  end: uint256,
  blkNum: uint256
) -> (bytes[256]):
  return concat(
    sha3("own"),
    convert(owner, bytes32),
    convert(tokenId, bytes32),
    convert(start, bytes32),
    convert(end, bytes32),
    convert(blkNum, bytes32)
  )

@public
@constant
def decodeExitState(
  stateBytes: bytes[256]
) -> (address, uint256, uint256, uint256):
  assert sha3("own") == extract32(stateBytes, 0, type=bytes32)
  return (
    extract32(stateBytes, 32*1, type=address),
    extract32(stateBytes, 32*2, type=uint256),
    extract32(stateBytes, 32*3, type=uint256),
    extract32(stateBytes, 32*4, type=uint256)
  )

@private
@constant
def decodeSwap(
  _txBytes: bytes[496],
) -> (address, uint256, uint256, address, uint256, uint256):
  #  from1, segment1, blkNum1, from2, segment2, blkNum2
  return (
    extract32(_txBytes, 0 + 16, type=address),
    extract32(_txBytes, 32 + 16, type=uint256),
    extract32(_txBytes, 64 + 16, type=uint256),
    extract32(_txBytes, 96 + 16, type=address),
    extract32(_txBytes, 128 + 16, type=uint256),
    extract32(_txBytes, 160 + 16, type=uint256))

# atomic swap
@public
@constant
def verifySwap(
  _txHash: bytes32,
  _merkleHash: bytes32,
  _txBytes: bytes[496],
  _sigs: bytes[260],
  _outputIndex: uint256,
  _owner: address,
  _tokenId: uint256,
  _start: uint256,
  _end: uint256,
  _txBlkNum: uint256,
  _hasSig: uint256
) -> (bytes[256]):
  from1: address
  tokenId1: uint256
  segment1: uint256
  start1: uint256
  end1: uint256
  blkNum1: uint256
  from2: address
  tokenId2: uint256
  segment2: uint256
  start2: uint256
  end2: uint256
  blkNum2: uint256
  (from1, segment1, blkNum1, from2, segment2, blkNum2) = self.decodeSwap(_txBytes)
  (tokenId1, start1, end1) = self.parseSegment(segment1)
  (tokenId2, start2, end2) = self.parseSegment(segment2)
  if _owner != ZERO_ADDRESS:
    if _outputIndex == 0:
      assert _owner == from2
    elif _outputIndex == 1:
      assert _owner == from1
  if _outputIndex == 0:
    assert _tokenId == tokenId1 and _start >= start1 and _end <= end1
  elif _outputIndex == 1:
    assert _tokenId == tokenId2 and _start >= start2 and _end <= end2
  check1: bool = self.ecrecoverSig(_txHash, _sigs, 0) == from1
  check2: bool = self.ecrecoverSig(_txHash, _sigs, 1) == from2
  assert check1 and check2
  if _hasSig == 0:
    assert self.ecrecoverSig(_merkleHash, _sigs, 2) == from1 and self.ecrecoverSig(_merkleHash, _sigs, 3) == from2
  elif _hasSig == 1:
    assert self.ecrecoverSig(_merkleHash, _sigs, 2) == from1
  elif _hasSig == 2:
    assert self.ecrecoverSig(_merkleHash, _sigs, 2) == from2
  return self.encodeExitState(_owner, _tokenId, _start, _end, _txBlkNum)

@public
@constant
def checkSpendOfSwap(
  _exitStateBytes: bytes[256],
  _txBytes: bytes[496],
  _index: uint256,
  _exitBlkNum: uint256
) -> (bool):
  exitOwner: address
  exitTokenId: uint256
  exitStart: uint256
  exitEnd: uint256
  (exitOwner, exitTokenId, exitStart, exitEnd) = self.decodeExitState(_exitStateBytes)
  from1: address
  tokenId1: uint256
  segment1: uint256
  start1: uint256
  end1: uint256
  blkNum1: uint256
  from2: address
  tokenId2: uint256
  segment2: uint256
  start2: uint256
  end2: uint256
  blkNum2: uint256
  (from1, segment1, blkNum1, from2, segment2, blkNum2) = self.decodeSwap(_txBytes)
  (tokenId1, start1, end1) = self.parseSegment(segment1)
  (tokenId2, start2, end2) = self.parseSegment(segment2)
  if _index == 0:
    assert exitOwner == from1
    assert exitTokenId == tokenId1
    assert exitStart <= start1 and end1 <= exitEnd
    assert blkNum1 == _exitBlkNum
  elif _index == 1:
    assert exitOwner == from2
    assert exitTokenId == tokenId2
    assert exitStart <= start2 and end2 <= exitEnd
    assert blkNum2 == _exitBlkNum
  else:
    assert False
  return True
