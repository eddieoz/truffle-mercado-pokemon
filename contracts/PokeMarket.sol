/*
Copyright (c) 2016 Edilson Osorio Junior - OriginalMy.com

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
*/

/* Prototipagem dos contratos que serao chamados a partir deste */
pragma solidity ^0.4.2;
contract pokeCoinContract { mapping (address => uint256) public balanceOf; function transferFrom(address _from, address _to, uint256 _value){  } }
contract pokeCentralContract { mapping (uint256 => address) public pokemonToMaster; function transferPokemon(address _from, address _to, uint256 _pokemonID) {  } }

contract accessControlled {
    address public owner;

    function owned() {
        owner = msg.sender;
    }

    modifier onlyOwner {
        if (msg.sender != owner) throw;
        /* o caracter "_" é substituído pelo corpo da funcao onde o modifier é utilizado */
        _;
    }

    function transferOwnership(address newOwner) onlyOwner {
        owner = newOwner;
    }


}

contract PokeMarket is accessControlled {
    pokeCoinContract public pokeCoin;
    pokeCentralContract public pokeCentral;

    uint public totalPokemonSales;
    uint public totalActiveSales;

    PokeSale[] public pokeSales;

    mapping (uint => bool) public pokeSelling;
    mapping (address => uint[]) public pokeMasterSelling;
    mapping (uint => uint) public pokeSaleIndex;

    struct PokeSale{
        address pokeSeller;
        address pokeBuyer;
        uint pokeID;
        uint pokePrice;
        bool pokeSold;
        bool pokeSellActive;
    }

    event NewSale(address pokeSellerAddress, uint pokemonID, uint pokemonSalePrice);
    event StopSale(address pokeSellerAddress, uint pokemonID);
    event PokeTrade(address pokeBuyerAddress, address pokeSellerAddress, uint pokemonID );

    /* Inicializa o mercado pokemon apontando os endereços da PokeCoin e da PokeCentral */
    function PokeMarket(pokeCoinContract pokeCoinAddress, pokeCentralContract pokeCentralAddress) {
        owner = msg.sender;
        pokeCoin = pokeCoinContract(pokeCoinAddress);
        pokeCentral = pokeCentralContract(pokeCentralAddress);
    }


    /* Inicia uma nova venda */
    function newSale(address pokeSellerAddress, uint pokemonID, uint pokemonSalePrice)  onlyOwner returns (bool success){
        if (pokeSellerAddress != pokeCentral.pokemonToMaster(pokemonID)) throw;     // Verifica se o vendedor possui o pokemon colocado a venda
        if (pokeSelling[pokemonID]) throw;                                          // Verifica se ja ha venda ativa para este pokemon

        uint pokeSalesID = pokeSales.length++;
        PokeSale p = pokeSales[pokeSalesID];
        if (p.pokeSellActive) throw;
        p.pokeSeller = pokeSellerAddress;
        p.pokeID = pokemonID;
        p.pokePrice = pokemonSalePrice;
        p.pokeSold = false;
        p.pokeSellActive = true;

        pokeSelling[pokemonID] = true;
        pokeSaleIndex[pokemonID] = pokeSalesID;                                     // Em muitos casos é importante criar um indice para o pesquisar no struct

        //addPokemonToSellingList(pokeSellerAddress, pokemonID);                      // Adiciona esta venda na lista de vendas

        totalPokemonSales+=1;
        totalActiveSales+=1;

        NewSale(pokeSellerAddress, pokemonID, pokemonSalePrice);                    // Notifica os clientes que há uma nova venda
        return (true);
    }

    /* Cancela uma venda ativa */
    function stopSale(address pokeSellerAddress, uint pokemonID) onlyOwner {
        if (msg.sender != owner && msg.sender != pokeSellerAddress) throw;          // Verifica se quem está solicitando o cancelamento da venda é o criador da mesma ou o owner
        if (pokeSellerAddress != pokeCentral.pokemonToMaster(pokemonID)) throw;     // Verifica se o pokemon é do proprietario
        if (!pokeSelling[pokemonID]) throw;                                         // Verifica se a venda esta ativa

        uint pokeSalesID = pokeSaleIndex[pokemonID];
        PokeSale p = pokeSales[pokeSalesID];
        if (!p.pokeSellActive) throw;
        p.pokeSellActive = false;
        pokeSelling[pokemonID] = false;

        delPokemonFromSellingList(pokeSellerAddress, pokemonID);

        totalActiveSales-=1;

        StopSale(pokeSellerAddress, pokemonID);
    }

    /* Compra um Pokemon */
    function buyPokemon(address pokeBuyerAddress, uint pokemonID) {
        if (pokeBuyerAddress == pokeCentral.pokemonToMaster(pokemonID)) throw;  // Verifica se quem está comprando é o próprio vendedor
        if (!pokeSelling[pokemonID]) throw;                                     // Verifica se o pokemon esta a venda

        uint pokeSalesID = pokeSaleIndex[pokemonID];
        PokeSale p = pokeSales[pokeSalesID];
        if (!p.pokeSellActive) throw;                                           // Verifica se na struct o pokemon esta com venda ativa
        if (pokeCoin.balanceOf(pokeBuyerAddress) < p.pokePrice) throw;          // Verifica se o comprador possui fundos suficientes para comprar o pokemon

        pokeCoin.transferFrom(pokeBuyerAddress, p.pokeSeller, p.pokePrice);     // Chama a funcao transferFrom do contrato pokecoin
        pokeCentral.transferPokemon(p.pokeSeller, pokeBuyerAddress, pokemonID); // Chama a funcao transferPokemon do contrato pokecentral
        p.pokeBuyer = pokeBuyerAddress;                                         // Ajusta o endereço do comprador
        p.pokeSold = true;                                                      // Marca o pokemon como vendido

        stopSale(pokeBuyerAddress,pokemonID);                                   // Cancela a venda

        PokeTrade(pokeBuyerAddress, p.pokeSeller, pokemonID );                  // Notifica os clientes que a venda ocorreu

    }

    /* Adiciona o pokemon para a lista de vendas */
    function addPokemonToSellingList(address pokeSellerAddress, uint pokemonID) onlyOwner internal {
        uint[] tempList = pokeMasterSelling[pokeSellerAddress];                 // Carrega a lista de vendas para o vendedor
        tempList[tempList.length++] = pokemonID;                                // Adiciona um pokemon ao final da lista

        pokeMasterSelling[pokeSellerAddress] = cleanArray(tempList);            // Substitui o mapping que possui a lista de vendas, reorganizando o array (retirando os zeros)
    }


    /* Exclui um pokemon da lista de vendas */
    function delPokemonFromSellingList(address pokeSellerAddress, uint pokemonID) onlyOwner internal {
        uint[] tempList = pokeMasterSelling[pokeSellerAddress];                 // Carrega a lista de vendas para o vendedor
        uint count = tempList.length;                                           // Conta o numero de itens da lista

        for (uint i=0; i<count; i++){
            if (tempList[i] == pokemonID) delete tempList[i];                   // Procura pelo item da lista e o exclui
        }

        pokeMasterSelling[pokeSellerAddress] = cleanArray(tempList);            // Substitui o mapping que possui a lista de vendas, reorganizando o array (retirando os zeros)
    }

    /* Atualiza os enderecos da Pokecoin e da PokeCentral */
    function updatePokecoinAndPokemarketAddresses(address newPokecoinAddress, address newPokecentralAddress) onlyOwner {
        pokeCoin = pokeCoinContract(newPokecoinAddress);
        pokeCentral = pokeCentralContract(newPokecentralAddress);

    }

    /* Esta funcao elimina todos os itens com zero do array, ao custo de gas */
    function cleanArray(uint[] pokeList) onlyOwner internal returns (uint[]) {
        uint[] memory tempList = new uint[](pokeList.length);                   // Cria uma lista temporaria em memoria, do tamanho do array
        uint j = 0;
        for (uint i=0; i < pokeList.length; i++){
            if ( pokeList[i] > 0 ){
                tempList[j] = pokeList[i];                                      // Ajusta a lista temporaria com os valores que nao sao zero
                j++;
            }
        }
        uint[] memory tempList2 = new uint[](j);                                // Cria uma segunda lista em memória, com tamanho do "j" que e a contagem dos itens do "for" anterior
        for (i=0; i< j; i++) tempList2[i] = tempList[i];                        // Adiciona cada item do primeiro array para o segundo array. O excedente fica de fora
        return tempList2;                                                       // Retorna a segunda lista
    }

    /* Uma funcao sem nome '()' eh chamada todas as vezes que forem enviados ethers para ela */
    function (){
        throw;      // Nao permite o recebimento de ether
    }

}
