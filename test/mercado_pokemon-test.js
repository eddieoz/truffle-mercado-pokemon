contract('Mercado Pokemon', function(accounts) {
  var account1Demo = '0x616d18096ce6e1038b5c3ded080cef8ab17b3843';
  var account2Demo = '0x2f33f148b5ff5f76e63460e14228a671923de628';


  it("creating 10000 pokecoins", function(){
      var pokecoin = PokeCoin.deployed();
      return pokecoin.totalSupply().then(function(totalSupply) {
        assert.equal(totalSupply.toNumber(), 10000, "10000 pokecoins wasn't created");
      });
  });

  it("should put 5000 pokecoins in the first account", function() {
    var pokecoin = PokeCoin.deployed();
    return pokecoin.balanceOf(account1Demo).then(function(balance) {
      assert.equal(balance.toNumber(), 5000, "5000 wasn't in the first account");
    });
  });

  it("should create 4 pokemons", function(){
    var pokecentral = PokeCentral.deployed();
    //pokecentral.newPokemon(3,500,40, {from:web3.eth.accounts[0],gas:2000000});
    return pokecentral.totalPokemonSupply().then(function(totalSupply) {
      assert.equal(totalSupply.toNumber(), 4, "4 wasn't in the first account");
    });
  });
});

/*contract('PokeCentral', function(accounts){
  var account1Demo = '0x616d18096ce6e1038b5c3ded080cef8ab17b3843';
  var account2Demo = '0x2f33f148b5ff5f76e63460e14228a671923de628';
  it("should create 4 pokemons", function(){
    var pokecentral = PokeCentral.deployed();
    //pokecentral.newPokemon(3,500,40, {from:web3.eth.accounts[0],gas:2000000});
    return pokecentral.totalPokemonSupply().then(function(totalSupply) {
      assert.equal(totalSupply.toNumber(), 4, "4 wasn't in the first account");
    });
  });

  it("should transfer a pokemon", function(){
    var pokecentral = PokeCentral.deployed();
    return pokecentral.pokemonToMaster(4).then(function(pokeMasterAddress) {
      assert.equal(pokeMasterAddress, account1Demo, "pokemon 4 not transferred to account1Demo");
    });
  });

});

contract('PokeMarket', function(accounts){
  var account1Demo = '0x616d18096ce6e1038b5c3ded080cef8ab17b3843';
  var account2Demo = '0x2f33f148b5ff5f76e63460e14228a671923de628';

  it("should put a pokemon for selling", function(){
    var pokemarket = PokeMarket.deployed();

    return pokemarket.pokeSelling(1).then(function(status) {
      assert.equal(status, true, "pokemon 1 for selling");
    });
  });

});
*/
