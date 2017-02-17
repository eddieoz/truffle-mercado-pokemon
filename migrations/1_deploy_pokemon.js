account1Demo = '0x616d18096ce6e1038b5c3ded080cef8ab17b3843';
account2Demo = '0x2f33f148b5ff5f76e63460e14228a671923de628';
pokeCoinAddress = '';
pokeCentralAddress = '';
module.exports = function(deployer) {
  deployer.deploy(PokeCoin, {gas:2000000}).then(function(){
      pokecoin = PokeCoin.deployed();
      pokeCoinAddress = pokecoin.address;
      pokecoin.issueNew(10000, {gas:2000000}).then(function(){
        return pokecoin.transfer(account1Demo, 5000, {from:web3.eth.accounts[0],gas:2000000});
      }).then(function(){
        return pokecoin.transfer(account2Demo, 5000, {from:web3.eth.accounts[0],gas:2000000});
      });


    });
  deployer.deploy(PokeCentral, {gas:6000000}).then(function(){
    pokecentral = PokeCentral.deployed();
    pokeCentralAddress = pokecentral.address;
    pokecentral.newPokemon(3,500,40, {from:web3.eth.accounts[0],gas:6000000}).then(function(){
      return pokecentral.transferPokemon(web3.eth.accounts[0], account1Demo, 1,{from:web3.eth.accounts[0],gas:6000000});
    });

    pokecentral.newPokemon(1,535,70, {from:web3.eth.accounts[0],gas:6000000}).then(function(){
      return pokecentral.transferPokemon(web3.eth.accounts[0], account2Demo, 2,{from:web3.eth.accounts[0],gas:6000000});
    });

    pokecentral.newPokemon(4,546,80, {from:web3.eth.accounts[0],gas:6000000}).then(function(){
      return pokecentral.transferPokemon(web3.eth.accounts[0], account2Demo, 3,{from:web3.eth.accounts[0],gas:6000000});
    });

    pokecentral.newPokemon(2,557,90, {from:web3.eth.accounts[0],gas:6000000}).then(function(){
      return pokecentral.transferPokemon(web3.eth.accounts[0], account1Demo, 4,{from:web3.eth.accounts[0],gas:6000000});
    });


  });
  deployer.deploy(PokeMarket, {gas:4000000}).then(function(){
    pokemarket = PokeMarket.deployed();
    return pokemarket.updatePokecoinAndPokemarketAddresses(pokeCoinAddress, pokeCentralAddress, {from:web3.eth.accounts[0],gas:4000000}).then(function(){
      return pokecoin.updatePokeMarketAddress(pokemarket.address, {from:web3.eth.accounts[0],gas:4000000}).then(function(){
        return pokecentral.updatePokeMarketAddress(pokemarket.address, {from:web3.eth.accounts[0],gas:4000000});
      });
    });
  });
};
