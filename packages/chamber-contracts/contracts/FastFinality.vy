struct Dispute:
  recipient: address
  withdrawableAt: timestamp
  amount: uint256
  status: uint256

contract RootChain():
  def checkTransaction(
    _start: uint256,
    _end: uint256,
    _txHash: bytes32,
    _txBytes: bytes[1024],
    _blkNum: uint256,
    _proof: bytes[512],
    _sigs: bytes[260],
    _outputIndex: uint256
  ) -> bool: constant

contract TransactionVerifier():
  def verify(
    _txHash: bytes32,
    _merkleHash: bytes32,
    _txBytes: bytes[1024],
    _sigs: bytes[260],
    _outputIndex: uint256,
    _owner: address,
    _start: uint256,
    _end: uint256
  ) -> bool: constant
  def getTxoHash(
    _txBytes: bytes[1024],
    _index: uint256,
    _blkNum: uint256
  ) -> bytes32: constant

BOND: constant(wei_value) = as_wei_value(1, "finney")

STATE_FIRST_DISPUTED: constant(uint256) = 1
STATE_CHALLENGED: constant(uint256) = 2
STATE_SECOND_DISPUTED: constant(uint256) = 3
STATE_FINALIZED: constant(uint256) = 4
  
totalAmount: wei_value
deposits: map(address, wei_value)
operator: address
disputes: map(bytes32, Dispute)
rootchain: address
txverifier: address

#
# Library
#

# @dev from https://github.com/LayerXcom/plasma-mvp-vyper
@private
@constant
def ecrecoverSig(_txHash: bytes32, _sig: bytes[65]) -> address:
  if len(_sig) != 65:
    return ZERO_ADDRESS
  # ref. https://gist.github.com/axic/5b33912c6f61ae6fd96d6c4a47afde6d
  # The signature format is a compact form of:
  # {bytes32 r}{bytes32 s}{uint8 v}
  r: uint256 = extract32(_sig, 0, type=uint256)
  s: uint256 = extract32(_sig, 32, type=uint256)
  v: int128 = convert(slice(_sig, start=64, len=1), int128)
  # Version of signature should be 27 or 28, but 0 and 1 are also possible versions.
  # geth uses [0, 1] and some clients have followed. This might change, see:
  # https://github.com/ethereum/go-ethereum/issues/2053
  if v < 27:
    v += 27
  if v in [27, 28]:
    return ecrecover(_txHash, convert(v, uint256), r, s)
  return ZERO_ADDRESS

# @dev Constructor
@public
def __init__(
  _rootchain: address,
  _txverifier: address
):
  self.operator = msg.sender
  self.rootchain = _rootchain
  self.txverifier = _txverifier

@public
@payable
def deposit():
  self.totalAmount += msg.value

# @dev buy bandwidth by merchant
@public
@payable
def buyBandwidth():
  assert self.totalAmount >= msg.value
  self.deposits[msg.sender] = msg.value
  self.totalAmount -= msg.value

# @dev dispute
@public
@payable
def dispute(
  _txBytes: bytes[1024],
  _sigs: bytes[260],
  _operatorSigs: bytes[65],
  _index: uint256,
  _start: uint256,
  _end: uint256
):
  assert msg.value == BOND
  # check operator's signatures
  txHash: bytes32 = sha3(_txBytes)
  assert self.disputes[txHash].status == 0 and self.disputes[txHash].withdrawableAt == 0
  assert self.operator == self.ecrecoverSig(txHash, _operatorSigs)
  assert TransactionVerifier(self.txverifier).verify(
    txHash,
    txHash, # dummy
    _txBytes,
    _sigs,
    _index,
    msg.sender,
    _start,
    _end)
  self.disputes[txHash] = Dispute({
    recipient: msg.sender,
    withdrawableAt: block.timestamp + 1 * 7 * 24 * 60 * 60,
    amount: _end - _start,
    status: STATE_FIRST_DISPUTED
  })

# @dev challenge
@public
def challenge(
  _txBytes: bytes[1024],
  _proof: bytes[512],
  _sigs: bytes[260],
  _pos: uint256,
  _start: uint256,
  _end: uint256
):
  txHash: bytes32 = sha3(_txBytes)
  blkNum: uint256 = _pos / 100
  index: uint256 = _pos - blkNum * 100
  assert self.disputes[txHash].status == STATE_FIRST_DISPUTED
  RootChain(self.rootchain).checkTransaction(
    _start,
    _end,
    txHash,
    _txBytes,
    blkNum,
    _proof,
    _sigs,
    index)
  self.disputes[txHash].status = STATE_CHALLENGED

# @dev secondDispute
@public
def secondDispute(
  _disputeTxBytes: bytes[1024],
  _txBytes: bytes[1024],
  _proof: bytes[512],
  _sigs: bytes[260],
  _pos: uint256,
  _start: uint256,
  _end: uint256
):
  txHash: bytes32 = sha3(_txBytes)
  blkNum: uint256 = _pos / 100
  index: uint256 = _pos - blkNum * 100
  assert RootChain(self.rootchain).checkTransaction(
    _start,
    _end,
    txHash,
    _txBytes,
    blkNum,
    _proof,
    _sigs,
    index)
  inputDisputeTx: bytes32 = TransactionVerifier(self.txverifier).getTxoHash(
    _disputeTxBytes,
    10,
    0 # dummy
  )
  assert inputDisputeTx == TransactionVerifier(self.txverifier).getTxoHash(
    _txBytes,
    10,
    0 # dummy
  )
  self.disputes[sha3(_disputeTxBytes)].status = STATE_SECOND_DISPUTED

# @dev finalizeDispute
@public
def finalizeDispute(
  _txHash: bytes32
):
  # finalize dispute after 7 days
  dispute: Dispute = self.disputes[_txHash]
  assert dispute.withdrawableAt < block.timestamp
  assert dispute.status == STATE_FIRST_DISPUTED or dispute.status == STATE_SECOND_DISPUTED
  send(dispute.recipient, as_wei_value(dispute.amount, "wei") + BOND)
  self.disputes[_txHash].status = STATE_FINALIZED

# @dev getDispute
@public
@constant
def getDispute(
  _txHash: bytes32
) -> (address, uint256, uint256, uint256):
  dispute: Dispute = self.disputes[_txHash]
  return (
    dispute.recipient,
    dispute.withdrawableAt,
    dispute.amount,
    dispute.status
  )