# ocore-wallet

A simple Command Line Interface Wallet using [Ocore Wallet Service] (https://github.com/guantau/ocore-wallet-service) and its *official* client lib, ocore-wallet-client] (https://github.com/guantau/ocore-wallet-client)

# Quick Guide

``` shell
# Use -s or OWS_HOST to setup the OWS URL (defaults to http://localhost:3232/ows/api)
# 
# Start a local OWS instance be doing:
# git clone https://github.com/guantau/ocore-wallet-service.git ows
# cd ows; npm install; npm start

cd bin
 
# Create a 2-of-2 wallet (~/.wallet.dat is the default filename where the wallet critical data will be stored)
wallet create 'my wallet' 2-2 
  * Secret to share:
    NPr1esQGqnb9QZEXr2pHXbKznkNf41VCFeHXb4YA8To2xMsXnuEavv8W3rUeAiXZK1WPdjWNF9Lobyte

# Check the status of your wallet 
wallet status
  * Wallet my wallet [livenet]: 2-of-2 pending
    Missing copayers: 1

# Generate another wallet file
wallet genkey -f pete.dat

# Join the wallet as another copayer (add -p to encrypt credentials file)
wallet -f pete.dat join NPr1esQGqnb9QZEXr2pHXbKznkNf41VCFeHXb4YA8To2xMsXnuEavv8W3rUeAiXZK1WPdjWNF9Lobyte
   
# Use -f or WALLET_FILE to setup the wallet data file
export WALLET_FILE=pete.dat
wallet status

# Generate addresses to receive money
wallet address
  * New Address EQWKH6ZQ74IDQ4DMMEUD4JPFUQXB7QDA

# Check your balance
wallet balance
   
# Spend coins. Amount is specified in BYTES
wallet send SENFAKDJEFYYUNLACJMXQPGLO6563YFR 1000 "dinner"
  * Tx created: ID 67f1 [temporary] RequiredSignatures: 2

# List pending TX Proposals
wallet txproposals
  * TX Proposals:
    67f1 [payment] 1,000 BYTES => SENFAKDJEFYYUNLACJMXQPGLO6563YFR ["dinner" by XXX] [pending]

# Sign or reject TXs from other copayers
wallet -f pete.dat reject <id>
wallet -f pete.dat sign <id>

# List transaction history
wallet history
  19 hours ago: [dTToRSg8kSyvZ8QmnohK0591GfUjwwM8tMN9PaULO2s=] => sent 42,692 BYTES ["test" by my copayer]  (stable) (5030599)
  19 hours ago: [YbIg86CdWT0pWmtm2B8Jr+4w4F7Fp0R6Bw9zKIsZCJc=] <= received 5,908 BYTES  (stable) (5030545)
   
# List all commands:
wallet --help
 
```
  
  
# Password protection 

It is possible (and recommeded) to encrypt the wallet (.dat file). this is done 
be adding the `-p` parameter `create` or `genkey`. The password will be asked 
interactively. Following commands that use the wallet will require the password to work.

Password-based key derication function 2 (http://en.wikipedia.org/wiki/PBKDF2) is used to derive
the key to encrypt the data. AES is used to do the actual encryption, using the implementation
of SJCL (https://bitwiseshiftleft.github.io/sjcl/).

