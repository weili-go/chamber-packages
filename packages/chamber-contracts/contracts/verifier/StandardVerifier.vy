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
def decodeAddress(txBytes: bytes[496], offset: int128) -> address:
  return extract32(txBytes, offset, type=address)

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
) -> (bool):
  # from, start, end, blkNum, to
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
    assert(_owner == to and _outputIndex == 0)
  return (self.ecrecoverSig(_txHash, _sigs, 0) == _from) and tokenId == _tokenId and (start <= _start) and (_end <= end)

@public
@constant
def getTxoHashOfTransfer(
  _txBytes: bytes[496],
  _index: uint256,
  _blkNum: uint256
) -> (bytes32):
  # from, start, end, blkNum, to
  _from: address
  segment: uint256
  blkNum: uint256
  to: address
  (_from, segment, blkNum, to) = self.decodeTransfer(_txBytes)
  tokenId: uint256
  start: uint256
  end: uint256
  (tokenId, start, end) = self.parseSegment(segment)
  if _index >= 10:
    return self.getOwnState(_from, tokenId, start, end, blkNum)
  else:
    return self.getOwnState(to, tokenId, start, end, _blkNum)

# split
@public
@constant
def verifySplit(
  _txHash: bytes32,
  _txBytes: bytes[496],
  _sigs: bytes[260],
  _outputIndex: uint256,
  _owner: address,
  _tokenId: uint256,
  _start: uint256,
  _end: uint256
) -> (bool):
  # from, start, end, blkNum, to1, to2, offset
  _from: address
  segment: uint256
  blkNum: uint256
  to1: address
  (_from, segment, blkNum, to1) = self.decodeTransfer(_txBytes)
  tokenId: uint256
  start: uint256
  end: uint256
  (tokenId, start, end) = self.parseSegment(segment)
  to2: address = self.decodeAddress(_txBytes, 128 + 16)
  offset: uint256 = extract32(_txBytes, 160 + 16, type=uint256)
  if _owner != ZERO_ADDRESS:
    if _outputIndex == 0:
      assert(_owner == to1)
    else:
      assert(_owner == to2)
  assert _tokenId == tokenId
  if _outputIndex == 0:
    assert (_start >= start) and (_end <= offset)
  else:
    assert (_start >= offset) and (_end <= end)
  return (self.ecrecoverSig(_txHash, _sigs, 0) == _from)

@public
@constant
def getTxoHashOfSplit(
  _txBytes: bytes[496],
  _index: uint256,
  _blkNum: uint256
) -> (bytes32):
  # from, start, end, blkNum, to1, to2, offset
  _from: address
  segment: uint256
  blkNum: uint256
  to1: address
  (_from, segment, blkNum, to1) = self.decodeTransfer(_txBytes)
  tokenId: uint256
  start: uint256
  end: uint256
  (tokenId, start, end) = self.parseSegment(segment)
  offset: uint256 = extract32(_txBytes, 160 + 16, type=uint256)
  if _index >= 10:
    return self.getOwnState(_from, tokenId, start, end, blkNum)
  elif _index == 0:
    return self.getOwnState(to1, tokenId, start, offset, _blkNum)
  else:
    to2: address = self.decodeAddress(_txBytes, 128 + 16)
    return self.getOwnState(to2, tokenId, offset, end, _blkNum)

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
) -> (bool):
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
  return (self.ecrecoverSig(_txHash, _sigs, 0) == _from)

@public
@constant
def getTxoHashOfMerge(
  _txBytes: bytes[496],
  _index: uint256,
  _blkNum: uint256
) -> (bytes32):
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
  blkNum1: uint256 = extract32(_txBytes, 128 + 16, type=uint256)
  blkNum2: uint256 = extract32(_txBytes, 160 + 16, type=uint256)
  if _index == 10:
    return self.getOwnState(_from, tokenId, start, offset, blkNum1)
  elif _index == 11:
    return self.getOwnState(_from, tokenId, offset, end, blkNum2)
  else:
    return self.getOwnState(to, tokenId, start, end, _blkNum)
