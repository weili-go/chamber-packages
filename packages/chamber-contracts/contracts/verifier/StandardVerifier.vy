#
# Library
#

# total deposit amount per token type
TOTAL_DEPOSIT: constant(uint256) = 2**48
MASK8BYTES: constant(uint256) = 2**64 - 1

# @dev from https://github.com/LayerXcom/plasma-mvp-vyper
@private
@constant
def ecrecoverSig(_txHash: bytes32, _sig: bytes[260], index: int128) -> address:
  if len(_sig) != 65 and len(_sig) != 130:
    return ZERO_ADDRESS
  # ref. https://gist.github.com/axic/5b33912c6f61ae6fd96d6c4a47afde6d
  # The signature format is a compact form of:
  # {bytes32 r}{bytes32 s}{uint8 v}
  r: uint256 = extract32(_sig, 0 + 65 * index, type=uint256)
  s: uint256 = extract32(_sig, 32+ 65 * index, type=uint256)
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
  tokenId: uint256 = bitwise_and(shift(segment, - 16 * 8), MASK8BYTES)
  start: uint256 = bitwise_and(shift(segment, - 8 * 8), MASK8BYTES)
  end: uint256 = bitwise_and(segment, MASK8BYTES)
  return (tokenId, start, end)

@public
@constant
def encodeExitState(
  owner: address,
  tokenId: uint256,
  start: uint256,
  end: uint256
) -> (bytes[256]):
  return concat(
    sha3("own"),
    convert(owner, bytes32),
    convert(tokenId, bytes32),
    convert(start, bytes32),
    convert(end, bytes32)
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

# @dev decodeTransfer
@private
@constant
def decodeTransfer(
  _txBytes: bytes[496],
) -> (address, uint256, uint256, address):
  # from, segment, blkNum, to
  return (
    extract32(_txBytes, 0 + 16, type=address),
    extract32(_txBytes, 32 + 16, type=uint256),
    extract32(_txBytes, 64 + 16, type=uint256),
    extract32(_txBytes, 96 + 16, type=address))

# @dev Constructor
@public
def __init__():
  assert True

# split
@public
@constant
def verifyTransfer(
  _txHash: bytes32,
  _txBytes: bytes[496],
  _sigs: bytes[260],
  _outputIndex: uint256,
  _owner: address,
  _tokenId: uint256,
  _start: uint256,
  _end: uint256
) -> (bytes[256]):
  # from, start, end, blkNum, to1, to2, offset
  _from: address
  segment: uint256
  blkNum: uint256
  to: address
  (_from, segment, blkNum, to) = self.decodeTransfer(_txBytes)
  tokenId: uint256
  start: uint256
  end: uint256
  (tokenId, start, end) = self.parseSegment(segment)
  if _owner != ZERO_ADDRESS:
    if _outputIndex == 0:
      assert(_owner == to)
  assert _tokenId == tokenId
  if _outputIndex == 0:
    assert (_start >= start) and (_end <= end)
  assert (self.ecrecoverSig(_txHash, _sigs, 0) == _from)
  return self.encodeExitState(to, tokenId, start, end)

@public
@constant
def checkSpentOfTransfer(
  _exitStateBytes: bytes[256],
  _txBytes: bytes[496],
  _exitBlkNum: uint256
) -> (bool):
  exitOwner: address
  exitTokenId: uint256
  exitStart: uint256
  exitEnd: uint256
  exitState: bytes[64]
  (exitOwner, exitTokenId, exitStart, exitEnd) = self.decodeExitState(_exitStateBytes)
  # from, start, end, blkNum, to1, to2, offset
  _from: address
  segment: uint256
  blkNum: uint256
  to: address
  (_from, segment, blkNum, to) = self.decodeTransfer(_txBytes)
  tokenId: uint256
  start: uint256
  end: uint256
  (tokenId, start, end) = self.parseSegment(segment)
  assert exitOwner == _from
  assert exitTokenId == tokenId
  assert exitStart <= start and end <= exitEnd
  assert blkNum == _exitBlkNum
  return True

# merge
@public
@constant
def verifyMerge(
  _txHash: bytes32,
  _merkleHash: bytes32,
  _txBytes: bytes[496],
  _sigs: bytes[260],
  _outputIndex: uint256,
  _owner: address,
  _tokenId: uint256,
  _start: uint256,
  _end: uint256
) -> (bytes[256]):
  # from, start, offset, end, blkNum1, blkNum2, to
  _from: address
  segment: uint256
  offset: uint256
  to: address
  (_from, segment, offset, to) = self.decodeTransfer(_txBytes)
  tokenId: uint256
  start: uint256
  end: uint256
  (tokenId, start, end) = self.parseSegment(segment)
  if _owner != ZERO_ADDRESS:
    assert(_owner == to)
  assert _tokenId == tokenId and (_start >= start) and (_end <= end)
  assert self.ecrecoverSig(_merkleHash, _sigs, 1) == _from
  assert self.ecrecoverSig(_txHash, _sigs, 0) == _from
  return self.encodeExitState(to, tokenId, start, end)

@public
@constant
def checkSpentOfMerge(
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
  # from, start, offset, end, blkNum1, blkNum2, to
  _from: address
  segment: uint256
  offset: uint256
  to: address
  (_from, segment, offset, to) = self.decodeTransfer(_txBytes)
  tokenId: uint256
  start: uint256
  end: uint256
  (tokenId, start, end) = self.parseSegment(segment)
  assert exitOwner == _from
  assert exitTokenId == tokenId
  if _index == 0:
    blkNum1: uint256 = extract32(_txBytes, 128 + 16, type=uint256)
    assert exitStart <= start and offset <= exitEnd
    assert blkNum1 == _exitBlkNum
  elif _index == 1:
    blkNum2: uint256 = extract32(_txBytes, 160 + 16, type=uint256)
    assert exitStart <= offset and end <= exitEnd
    assert blkNum2 == _exitBlkNum
  else:
    assert False
  return True
