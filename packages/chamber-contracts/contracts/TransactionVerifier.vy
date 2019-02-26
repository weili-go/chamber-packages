contract StandardVerifier():
  def verifyTransfer(
    _txHash: bytes32,
    _txBytes: bytes[496],
    _sigs: bytes[260],
    _outputIndex: uint256,
    _owner: address,
    _tokenId: uint256,
    _start: uint256,
    _end: uint256
  ) -> bytes[256]: constant
  def checkSpentOfTransfer(
    _exitStateBytes: bytes[256],
    _txBytes: bytes[496],
    _exitBlkNum: uint256
  ) -> bool: constant
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
  ) -> bytes[256]: constant
  def checkSpentOfMerge(
    _exitStateBytes: bytes[256],
    _txBytes: bytes[496],
    _index: uint256,
    _exitBlkNum: uint256
  ) -> bool: constant


contract MultisigVerifier():
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
  ) -> bytes[256]: constant
  def checkSpentOfSwap(
    _exitStateBytes: bytes[256],
    _txBytes: bytes[496],
    _index: uint256,
    _exitBlkNum: uint256
  ) -> bool: constant

contract CustomVerifier():
  def verify(
    _label: uint256,
    _txHash: bytes32,
    _merkleHash: bytes32,
    _txBytes: bytes[496],
    _sigs: bytes[260],
    _outputIndex: uint256,
    _owner: address,
    _tokenId: uint256,
    _start: uint256,
    _end: uint256,
    _timestamp: uint256
  ) -> bytes[256]: constant
  def checkSpent(
    _label: uint256,
    _exitStateBytes: bytes[256],
    _txBytes: bytes[496],
    _index: uint256,
    _exitBlkNum: uint256
  ) -> bool: constant
  def doesRequireConfsig(
    _label: uint256
  ) -> bool: constant

VerifierAdded: event({verifierId: uint256, verifierAddress: address})

stdverifier: address
multisigverifier: address
escrowverifier: address

verifiers: map(uint256, address)
verifierNonce: uint256

# total deposit amount per token type
TOTAL_DEPOSIT: constant(uint256) = 2**48

@public
@constant
def decodeBaseTx(_txBytes: bytes[496]) -> (uint256, uint256):
  # label, maxBlock
  return (convert(slice(_txBytes, start=0, len=8), uint256),
          convert(slice(_txBytes, start=8, len=8), uint256))

@private
@constant
def getOwnState(
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

# @dev decodeDeposit
# error occurred if it's @private
@public
@constant
def decodeDeposit(
  _txBytes: bytes[496]
) -> (address, uint256, uint256, uint256):
  # depositor, token, start, end
  segment: uint256 = extract32(_txBytes, 64 + 16, type=uint256)
  start: uint256 = segment / TOTAL_DEPOSIT
  end: uint256 = segment - start * TOTAL_DEPOSIT
  return (
    extract32(_txBytes, 0 + 16, type=address),
    extract32(_txBytes, 32 + 16, type=uint256),
    start,
    end)

@public
@constant
def getDepositHash(
  _txBytes: bytes[496]
) -> (bytes32):
  #label: uint256
  #maxBlock: uint256
  #(label, maxBlock) = self.decodeBaseTx(_txBytes)
  depositor: address
  token: uint256
  start: uint256
  end: uint256
  (depositor, token, start, end) = self.decodeDeposit(_txBytes)
  return sha3(
          concat(
            convert(depositor, bytes32),
            convert(token, bytes32),
            convert(start, bytes32),
            convert(end, bytes32)
          )
        )

@public
@constant
def verifyDepositTx(
  _txBytes: bytes[496],
  _owner: address,
  _tokenId: uint256,
  _start: uint256,
  _end: uint256
) -> (bytes[256]):
  depositor: address
  token: uint256
  start: uint256
  end: uint256
  (depositor, token, start, end) = self.decodeDeposit(_txBytes)
  assert _tokenId == token and _start >= start and _end <= end
  if _owner != ZERO_ADDRESS:
    assert _owner == depositor
  return self.getOwnState(depositor, token, start, end)

# @dev Constructor
@public
def __init__(_stdverifier: address, _multisig: address, _escrow: address):
  self.stdverifier = _stdverifier
  self.multisigverifier = _multisig
  self.escrowverifier = _escrow
  self.verifierNonce = 50

@public
def addVerifier(verifierAddress: address):
  verifierId: uint256 = self.verifierNonce
  self.verifiers[verifierId] = verifierAddress
  self.verifierNonce += 1
  log.VerifierAdded(verifierId, verifierAddress)

# @dev verify the transaction is signed correctly
@public
@constant
def verify(
  _txHash: bytes32,
  _merkleHash: bytes32,
  _txBytes: bytes[496],
  _sigs: bytes[260],
  _hasSig: uint256,
  _outputIndex: uint256,
  _owner: address,
  _tokenId: uint256,
  _start: uint256,
  _end: uint256,
  _timestamp: uint256
) -> bytes[256]:
  label: uint256
  maxBlock: uint256
  (label, maxBlock) = self.decodeBaseTx(_txBytes)
  if label == 2:
    return StandardVerifier(self.stdverifier).verifyTransfer(_txHash, _txBytes, _sigs, _outputIndex, _owner, _tokenId, _start, _end)
  elif label == 3:
    return StandardVerifier(self.stdverifier).verifyMerge(_txHash, _merkleHash, _txBytes, _sigs, _outputIndex, _owner, _tokenId, _start, _end)
  elif label == 4:
    return self.verifyDepositTx(_txBytes, _owner, _tokenId, _start, _end)
  elif label == 5:
    return MultisigVerifier(self.multisigverifier).verifySwap(_txHash, _merkleHash, _txBytes, _sigs, _outputIndex, _owner, _tokenId, _start, _end, _hasSig)
  elif 20 <= label and label < 30:
    return CustomVerifier(self.escrowverifier).verify(label, _txHash, _merkleHash, _txBytes, _sigs, _outputIndex, _owner, _tokenId, _start, _end, _timestamp)
  else:
    verifierAddress: address = self.verifiers[label]
    return CustomVerifier(verifierAddress).verify(label, _txHash, _merkleHash, _txBytes, _sigs, _outputIndex, _owner, _tokenId, _start, _end, _timestamp)

# @dev get hash of input state of the transaction
@public
@constant
def checkSpent(
  _exitStateBytes: bytes[256],
  _txBytes: bytes[496],
  _index: uint256,
  _blkNum: uint256
) -> bool:
  label: uint256
  maxBlock: uint256
  (label, maxBlock) = self.decodeBaseTx(_txBytes)
  if label == 2:
    return StandardVerifier(self.stdverifier).checkSpentOfTransfer(_exitStateBytes, _txBytes, _blkNum)
  elif label == 3:
    return StandardVerifier(self.stdverifier).checkSpentOfMerge(_exitStateBytes, _txBytes, _index, _blkNum)
  elif label == 5:
    return MultisigVerifier(self.multisigverifier).checkSpentOfSwap(_exitStateBytes, _txBytes, _index, _blkNum)
  elif 20 <= label and label < 30:
    return CustomVerifier(self.escrowverifier).checkSpent(label, _exitStateBytes, _txBytes, _index, _blkNum)
  else:
    verifierAddress: address = self.verifiers[label]
    return CustomVerifier(verifierAddress).checkSpent(label, _exitStateBytes, _txBytes, _index, _blkNum)
  return False

@public
@constant
def doesRequireConfsig(
  _txBytes: bytes[496]
) -> bool:
  label: uint256
  maxBlock: uint256
  (label, maxBlock) = self.decodeBaseTx(_txBytes)
  if label == 1:
    return False
  elif label == 2:
    return False
  elif label == 3:
    return True
  elif label == 4:
    return False
  elif label == 5:
    return True
  elif label == 10:
    return True
  elif 20 <= label and label < 30:
    return True
  else:
    verifierAddress: address = self.verifiers[label]
    return CustomVerifier(verifierAddress).doesRequireConfsig(label)
  return False