# Mercado Pokémon

Teaching material for Basic Ethereum for Developers Workshop

The featured content must be used only for educational purposes.
This is a prototype for studying and learning about the development of Dapps (decentralized applications) and should not be used in production.

## What is the Mercado Pokémon?
Mercado Pokémon is a demo of creating coins and Pokémons in Ethereum platform, as well as the trading between different accounts.

Also is presented the concept of a non-infrastructure environment, which uses blockchain as a data repository and acessing dapps directly by a standalone html.

## Pre-requisites:
- Geth **
- Truffle **
- TestRPC (problem with gas for pokemon contracts)
- Solidity Browser
- Mist

## Setup a ethereum private net:

1. Create the directory structure
    ```
    mkdir -p private_net/keystore
    ```

2. Copy the private key (password: abcd) to the keystore
    ```
    cp <truffle-mercado-pokemon>/support/UTC--2015-08-09T04-06-35.465758600Z--6a5b342ec71def8aac337b82969d9ddd811023c9 private_net/keystore
    ```

3. Start the blockchain with a new genesis
    ```
    geth --datadir ./private_net init private_genesis.json
    ```

4. Start the node
    ```
    geth --fast --cache 512 -ipcpath ~/Library/Ethereum/geth.ipc --networkid 1234 --datadir ./private_net --unlock 0 --rpc --rpccorsdomain="*" --rpcaddr "0.0.0.0"
    ```
5. Unlock the account[0] with the password 'abcd'

6. On a new terminal, attach to the geth console
    ```
    geth attach
    miner.start(1)
    ```

## Setup truffle
1. Go to the truffle-mercado-pokemon dir and open the Truffle console on a new terminal
    ```
    truffle console
    ```

2. Run the migrate to load contracts to blockchain
    ```
    migrate --reset
    ```

3. Update vars PokeCoinAddress, PokeCentralAddress and PokeMarketAddress in mercadopokemon.js

## Using Mercado Pokemon

Open player1.html and player2.html each one in a new window in Chrome

## Examples using Truffle console

1. Transfer pokecoins to the players 1 and 2 using the console:
    ```
    pokecoin.transfer(account1Demo, 5000, {from:web3.eth.accounts[0],gas:2000000});
    pokecoin.transfer(account2Demo, 5000, {from:web3.eth.accounts[0],gas:2000000});
    ```

    5.1 Verify is the transfers were suceeded
    ```
    pokecoin.balanceOf(account1Demo) // 5000
    pokecoin.balanceOf(account2Demo) // 5000
    ```


2. Create the next four valid pokemons:
    ```
    pokecentral.newPokemon(3,500,40, {from:web3.eth.accounts[0],gas:2000000});
    pokecentral.newPokemon(1,535,70, {from:web3.eth.accounts[0],gas:2000000});
    pokecentral.newPokemon(4,546,80, {from:web3.eth.accounts[0],gas:2000000});
    pokecentral.newPokemon(2,557,90, {from:web3.eth.accounts[0],gas:2000000});
    ```

    2.1 Verify pokemon total
    ```
    pokecentral.totalPokemonSupply() // 4
    ```

    2.2 Verify the pokemon owner (wait until mining)
    ```
    pokecentral.pokemons(0);
    pokecentral.pokemons(1);
    pokecentral.pokemons(2);
    pokecentral.pokemons(3);
    pokecentral.pokemons(4);
    ```

3. Transfer the pokemons to player1 and player2
    ```
    pokecentral.transferPokemon(web3.eth.accounts[0], account1Demo, 1,{from:web3.eth.accounts[0],gas:2000000});
    pokecentral.transferPokemon(web3.eth.accounts[0], account1Demo, 4,{from:web3.eth.accounts[0],gas:2000000});
    pokecentral.transferPokemon(web3.eth.accounts[0], account2Demo, 2,{from:web3.eth.accounts[0],gas:2000000});
    pokecentral.transferPokemon(web3.eth.accounts[0], account2Demo, 3,{from:web3.eth.accounts[0],gas:2000000});
    ```

    3.1 Verify the pokemon owner, as in 2.2

4. Update the PokeMarketAddress in dapps PokeCoin e PokeCentral
    ```
    pokecoin.updatePokeMarketAddress(pokemarket.address, {from:web3.eth.accounts[0],gas:2000000});
    pokecentral.updatePokeMarketAddress(pokemarket.address, {from:web3.eth.accounts[0],gas:2000000});
    ```

    4.1 Verify the addresses
    ```
    pokecoin.pokeMarketAddress();
    pokecentral.pokeMarketAddress();
    ```

5. Put the pokemon 1 from account1Demo for selling by 2000 pkc:
    ```
    pokemarket.newSale(account1Demo, 1, 2000, {from:web3.eth.accounts[0],gas:2000000});
    ```

6. Verify the number of active sells:
    ```
    pokemarket.totalActiveSales();
    ```

7. Verify the active sell 1 data:
    ```
    pokemarket.pokeSales(0);
    ```

8. Verify if the pokemon 1 is active for selling:
    ```
    pokemarket.pokeSelling(1);
    ```

9. Buy the pokemon 1, with the player 2
    ```
    pokemarket.buyPokemon(account2Demo, 1, {from:web3.eth.accounts[0],gas:2000000});
    ```

10. Verify if the pokemon owner was changed to account2Demo address
    ```
    pokecentral.pokemons(1);
    ```

11. Verify the pokecoins total for each player
    ```
    pokecoin.balanceOf(account1Demo);
    pokecoin.balanceOf(account2Demo);
    ```



## How it works:

Once the contracts were loaded, we created the PokeCoins and Pokemons, and distributed them between Player1 and Player2 accounts.
Through the html files you can put Pokemons for sale and make the purchase.

## Obs:
It is necessary that the account [0] is unlocked and has funds. To do this, type: personal.unlockAccount(eth.accounts[0]) on the console.

If pokecoins are transferred to an account, you can trade them directly in the secondary market, but that wallet must have funds for paying the rsk gas transaction.
