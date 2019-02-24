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

@private
@constant
def parseSegment(
  segment: uint256
) -> (uint256, uint256, uint256):
  tokenId: uint256 = bitwise_and(shift(segment, -16 * 8), MASK8BYTES)
  start: uint256 = bitwise_and(shift(segment, -8 * 8), MASK8BYTES)
  end: uint256 = bitwise_and(segment, MASK8BYTES)
  return (tokenId, start, end)

@private
@constant
def getOwnState(
  owner: address,
  tokenId: uint256,
  start: uint256,
  end: uint256,
  blkNum: uint256
) -> (bytes32):
  return sha3(
      concat("own",
        convert(owner, bytes32),
        convert(tokenId, bytes32),
        convert(start, bytes32),
        convert(end, bytes32),
        convert(blkNum, bytes32)
      )
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
  _hasSig: uint256
) -> (bool):
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
  offset1: uint256 = extract32(_txBytes, 192 + 16, type=uint256)
  offset2: uint256 = extract32(_txBytes, 224 + 16, type=uint256)
  if _owner != ZERO_ADDRESS:
    if _outputIndex == 0:
      assert _owner == from2
    elif _outputIndex == 1:
      assert _owner == from1
    elif _outputIndex == 2:
      assert _owner == from1
    elif _outputIndex == 3:
      assert _owner == from2
  if _outputIndex == 0:
    assert _tokenId == tokenId1 and _start >= start1 and _end <= start1 + offset1
  elif _outputIndex == 1:
    assert _tokenId == tokenId2 and _start >= start2 and _end <= start2 + offset2
  elif _outputIndex == 2:
    assert _tokenId == tokenId1 and _start >= start1 + offset1 and _end <= end1
  elif _outputIndex == 3:
    assert _tokenId == tokenId2 and _start >= start2 + offset2 and _end <= end2
  check1: bool = self.ecrecoverSig(_txHash, _sigs, 0) == from1
  check2: bool = self.ecrecoverSig(_txHash, _sigs, 1) == from2
  assert check1 and check2
  if _hasSig == 0:
    assert self.ecrecoverSig(_merkleHash, _sigs, 2) == from1 and self.ecrecoverSig(_merkleHash, _sigs, 3) == from2
  elif _hasSig == 1:
    assert self.ecrecoverSig(_merkleHash, _sigs, 2) == from1
  elif _hasSig == 2:
    assert self.ecrecoverSig(_merkleHash, _sigs, 2) == from2
  return True


@public
@constant
def getTxoHashOfSwap(
  _txBytes: bytes[496],
  _index: uint256,
  _blkNum: uint256
) -> (bytes32):
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
  offset1: uint256 = extract32(_txBytes, 192 + 16, type=uint256)
  offset2: uint256 = extract32(_txBytes, 224 + 16, type=uint256)
  if _index == 10:
    return self.getOwnState(from1, tokenId1, start1, end1, blkNum1)
  elif _index == 11:
    return self.getOwnState(from2, tokenId2, start2, end2, blkNum2)
  elif _index == 0:
    return self.getOwnState(from2, tokenId1, start1, start1 + offset1, _blkNum)
  elif _index == 1:
    return self.getOwnState(from1, tokenId2, start1 + offset1, end2, _blkNum)
  elif _index == 2:
    return self.getOwnState(from1, tokenId2, start2, start2 + offset2, _blkNum)
  elif _index == 3:
    return self.getOwnState(from2, tokenId2, start2 + offset2, end2, _blkNum)
  else:
    return sha3("swap")

# multisig
@public
@constant
def verifyMultisig2(
  _txHash: bytes32,
  _tBytes: bytes[496],
  _sigs: bytes[260],
  _outputIndex: uint256,
  _owner: address,
  _start: uint256,
  _end: uint256
) -> (bool):
  # label, maxBlkNum, lockstate, nextstate, from1, start1, end1, blkNum1, from2, start2, end2, blkNum2
  tList = RLPList(_tBytes, [
    uint256, uint256, bytes, bytes, address, uint256, uint256, uint256, address, uint256, uint256, uint256])
  return True

@public
@constant
def getTxoHashOfMultisig2(
  _tBytes: bytes[496],
  _index: uint256,
  _blkNum: uint256
) -> (bytes32):
  return sha3("multisig2")
