const fs = require('fs')
const path = require('path')

const Migrations = require('../build/contracts/Migrations.json')
const RootChain = require('../build/contracts/RootChain.json')
const TransactionVerifier = require('../build/contracts/TransactionVerifier.json')
const StandardVerifier = require('../build/contracts/StandardVerifier.json')
const MultisigVerifier = require('../build/contracts/MultisigVerifier.json')
const EscrowVerifier = require('../build/contracts/EscrowVerifier.json')
const FastFinality = require('../build/contracts/FastFinality.json')

const data = JSON.stringify({
  Migrations: Migrations.bytecode,
  RootChain: RootChain.bytecode,
  TransactionVerifier: TransactionVerifier.bytecode,
  StandardVerifier: StandardVerifier.bytecode,
  MultisigVerifier: MultisigVerifier.bytecode,
  EscrowVerifier: EscrowVerifier.bytecode,
  FastFinality: FastFinality.bytecode
}, null, 2)

fs.writeFileSync(path.join(__dirname, './bytescodes.json'), data)
