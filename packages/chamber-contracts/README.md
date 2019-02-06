@layer2/contracts


## Deploy

launch ganache.

```
ganache-cli --mnemonic 'candy maple cake sugar pudding cream honey rich smooth crumble sweet treat'
```

deploy RLP decoder and Plasma contracts.
And please note RootChain address.

>   RootChain: 0xaa588d3737b611bafd7bd713445b314bd453a5c8


```
$ yarn build
$ node deploy.js http://127.0.0.1:8545 0xc87509a1c067bbde78beb793e6fa76530b6382a4c0241e5e4a9ec0a0f44dc0d3
$ truffle migrate --network local
Using network 'local'.

Running migration: 1_initial_migration.js
  Deploying Migrations...
  ... 0xf692ceb550c4fa216ab9944a4ede26e777dd999910db76f536eca9e88e992b0c
  Migrations: 0xf25186b5081ff5ce73482ad761db0eb0d25abfbf
Saving successful migration to network...
  ... 0xc794a344a460f3122cad79c39c1dd5d74ad576c3d90356b159939e6d87f4fb18
Saving artifacts...
Running migration: 2_deploy_contracts.js
  Deploying StandardVerifier...
  ... 0x4d97c987b8995d064d207d7f52f7a68d9b9a2ca0cb9a9cce737c003f0627d5ba
  StandardVerifier: 0x9fbda871d559710256a2502a2517b794b482db40
  Deploying EscrowVerifier...
  ... 0x8b92be6c16888098d07239e78773d867af06f2d299ef474ad38385e7a73f9dc5
  EscrowVerifier: 0x2c2b9c9a4a25e24b174f26114e8926a9f2128fe4
  Deploying MultisigVerifier...
  ... 0x933231e27ad0c8635ea20866d3097fac5c2be43ab6db991a9832cfce98d34fe1
  MultisigVerifier: 0x30753e4a8aad7f8597332e813735def5dd395028
  Deploying TransactionVerifier...
  ... 0xeac1c5069748ae62b55e4f8eda815d89bfd3e7b76f539666b2e70158f99543e7
  TransactionVerifier: 0xfb88de099e13c3ed21f80a7a1e49f8caecf10df6
  Deploying RootChain...
  ... 0x944f5e1127a3cc79a9e39b1fe38b2be6e1307296de040916b2e67c380434d06d
  RootChain: 0xaa588d3737b611bafd7bd713445b314bd453a5c8
  Deploying FastFinality...
  ... 0xbbb423751c264f975949e3d5b83571dc91b9d2821246d1cc5938958694e8c78f
  FastFinality: 0xf204a4ef082f5c04bb89f7d5e6568b796096735a
Saving successful migration to network...
  ... 0xca91d4cf283ea97905fe02597eeb5500a17f1ad148e0a364ec8e1d54339400bd
Saving artifacts...

```
