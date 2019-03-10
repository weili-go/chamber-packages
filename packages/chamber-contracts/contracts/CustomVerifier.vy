contract VerifierUtil():
  def ecrecoverSig(
    _txHash: bytes32,
    _sig: bytes[260],
    index: int128
  ) -> address: constant
  def parseSegment(
    segment: uint256
  ) -> (uint256, uint256, uint256): constant
  def encodeSegment(
    tokenId: uint256,
    start: uint256,
    end: uint256
  ) -> (bytes[96]):constant
  def isContainSegment(
    segment: uint256,
    small: uint256
  ) -> (bool): constant

contract StateVerifier():
  def encodeState(
    owner: address,
    segment: uint256,
    blkNum: uint256
  ) -> (bytes[256]): constant
  def decodeState(
    stateBytes: bytes[256]
  ) -> (address, uint256, uint256, uint256): constant
  def isSpent(
    _txHash: bytes32,
    _stateBytes: bytes[256],
    _evidence: bytes[256],
    _timestamp: uint256
  ) -> bool: constant

contract TransactionVerifier():
  def isExitGamable(
    _label: uint256,
    _txHash: bytes32,
    _merkleHash: bytes32,
    _txBytes: bytes[496],
    _sigs: bytes[260],
    _outputIndex: uint256,
    _owner: address,
    _segment: uint256,
    _hasSig: uint256
  ) -> (bool): constant
  def getOutput(
    _label: uint256,
    _txBytes: bytes[496],
    _txBlkNum: uint256,
    _index: uint256
  ) -> (bytes[256]): constant
  def getSpentEvidence(
    _label: uint256,
    _txBytes: bytes[496],
    _index: uint256,
    _sigs: bytes[260]
  ) -> (bytes[256]): constant

VerifierAdded: event({verifierId: uint256, verifierAddress: address})

verifierUtil: public(address)
ownStateVerifier: public(address)

operator: address

verifiers: map(uint256, address)
verifierNonce: uint256

# total deposit amount per token type
TOTAL_DEPOSIT: constant(uint256) = 2**48
MASK8BYTES: constant(uint256) = 2**64 - 1

@public
@constant
def decodeBaseTx(_txBytes: bytes[496]) -> (uint256, uint256):
  # label, maxBlock
  return (convert(slice(_txBytes, start=0, len=8), uint256),
          convert(slice(_txBytes, start=8, len=8), uint256))

# @dev decode deposit tx
@private
@constant
def decodeDeposit(
  _txBytes: bytes[496],
) -> (address, uint256):
  # depositor, segment
  return (
    extract32(_txBytes, 0 + 16, type=address),
    extract32(_txBytes, 32 + 16, type=uint256))

@public
@constant
def getDepositHash(
  _txBytes: bytes[496]
) -> (bytes32):
  depositor: address
  segment: uint256
  token: uint256
  start: uint256
  end: uint256
  (depositor, segment) = self.decodeDeposit(_txBytes)
  (token, start, end) = VerifierUtil(self.verifierUtil).parseSegment(segment)
  return sha3(
          concat(
            convert(depositor, bytes32),
            convert(token, bytes32),
            convert(start, bytes32),
            convert(end, bytes32)
          )
        )

@private
@constant
def isExitGamableDepositTx(
  _txHash: bytes32,
  _txBytes: bytes[496],
  _outputIndex: uint256,
  _owner: address,
  _segment: uint256
) -> (bool):
  # depositor, segment
  depositor: address
  segment: uint256
  (depositor, segment) = self.decodeDeposit(_txBytes)
  if _owner != ZERO_ADDRESS:
    assert(_owner == depositor)
  assert VerifierUtil(self.verifierUtil).isContainSegment(segment, _segment)
  return True

@private
@constant
def getOutputOfDeposit(
  _txBytes: bytes[496],
  _txBlkNum: uint256
) -> (bytes[256]):
  depositor: address
  segment: uint256
  (depositor, segment) = self.decodeDeposit(_txBytes)
  return StateVerifier(self.ownStateVerifier).encodeState(depositor, segment, _txBlkNum)

# @dev Constructor
@public
def __init__(_verifierUtil: address, _ownStateVerifier: address):
  self.operator = msg.sender
  self.verifierUtil = _verifierUtil
  self.ownStateVerifier = _ownStateVerifier
  self.verifierNonce = 1

@public
def addVerifier(verifierAddress: address):
  assert msg.sender == self.operator
  verifierId: uint256 = self.verifierNonce
  self.verifiers[verifierId] = verifierAddress
  self.verifierNonce += 1
  log.VerifierAdded(verifierId, verifierAddress)

# @dev verify the transaction is signed correctly
@public
@constant
def isExitGamable(
  _txHash: bytes32,
  _merkleHash: bytes32,
  _txBytes: bytes[496],
  _sigs: bytes[260],
  _outputIndex: uint256,
  _owner: address,
  _segment: uint256,
  _hasSig: uint256
) -> bool:
  label: uint256
  maxBlock: uint256
  (label, maxBlock) = self.decodeBaseTx(_txBytes)
  if label < 10:
    return True
    return self.isExitGamableDepositTx(
      _txHash, _txBytes, _outputIndex, _owner, _segment)
  else:
    verifierAddress: address = self.verifiers[label / 10]
    return TransactionVerifier(verifierAddress).isExitGamable(
      label % 10, _txHash, _merkleHash, _txBytes, _sigs, _outputIndex, _owner, _segment, _hasSig)

@public
@constant
def getOutput(
  _txBytes: bytes[496],
  _txBlkNum: uint256,
  _index: uint256
) -> bytes[256]:
  label: uint256
  maxBlock: uint256
  (label, maxBlock) = self.decodeBaseTx(_txBytes)
  if label < 10:
    return self.getOutputOfDeposit(_txBytes, _txBlkNum)
  else:
    verifierAddress: address = self.verifiers[label / 10]
    return TransactionVerifier(verifierAddress).getOutput(label % 10, _txBytes, _txBlkNum, _index)

@public
@constant
def getSpentEvidence(
  _txBytes: bytes[496],
  _index: uint256,
  _sigs: bytes[260]
) -> bytes[256]:
  label: uint256
  maxBlock: uint256
  (label, maxBlock) = self.decodeBaseTx(_txBytes)
  verifierAddress: address = self.verifiers[label / 10]
  return TransactionVerifier(verifierAddress).getSpentEvidence(label % 10, _txBytes, _index, _sigs)

# @dev get hash of input state of the transaction
#     _txHash spend _stateBytes
@public
@constant
def isSpent(
  _txHash: bytes32,
  _stateBytes: bytes[256],
  _evidence: bytes[256],
  _timestamp: uint256
) -> bool:
  stateVerifier: address = extract32(_stateBytes, 0, type=address)
  return StateVerifier(stateVerifier).isSpent(
    _txHash, _stateBytes, _evidence, _timestamp)
