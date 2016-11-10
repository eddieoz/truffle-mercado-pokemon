var Web3 = require("web3");
var SolidityEvent = require("web3/lib/web3/event.js");

(function() {
  // Planned for future features, logging, etc.
  function Provider(provider) {
    this.provider = provider;
  }

  Provider.prototype.send = function() {
    this.provider.send.apply(this.provider, arguments);
  };

  Provider.prototype.sendAsync = function() {
    this.provider.sendAsync.apply(this.provider, arguments);
  };

  var BigNumber = (new Web3()).toBigNumber(0).constructor;

  var Utils = {
    is_object: function(val) {
      return typeof val == "object" && !Array.isArray(val);
    },
    is_big_number: function(val) {
      if (typeof val != "object") return false;

      // Instanceof won't work because we have multiple versions of Web3.
      try {
        new BigNumber(val);
        return true;
      } catch (e) {
        return false;
      }
    },
    merge: function() {
      var merged = {};
      var args = Array.prototype.slice.call(arguments);

      for (var i = 0; i < args.length; i++) {
        var object = args[i];
        var keys = Object.keys(object);
        for (var j = 0; j < keys.length; j++) {
          var key = keys[j];
          var value = object[key];
          merged[key] = value;
        }
      }

      return merged;
    },
    promisifyFunction: function(fn, C) {
      var self = this;
      return function() {
        var instance = this;

        var args = Array.prototype.slice.call(arguments);
        var tx_params = {};
        var last_arg = args[args.length - 1];

        // It's only tx_params if it's an object and not a BigNumber.
        if (Utils.is_object(last_arg) && !Utils.is_big_number(last_arg)) {
          tx_params = args.pop();
        }

        tx_params = Utils.merge(C.class_defaults, tx_params);

        return new Promise(function(accept, reject) {
          var callback = function(error, result) {
            if (error != null) {
              reject(error);
            } else {
              accept(result);
            }
          };
          args.push(tx_params, callback);
          fn.apply(instance.contract, args);
        });
      };
    },
    synchronizeFunction: function(fn, instance, C) {
      var self = this;
      return function() {
        var args = Array.prototype.slice.call(arguments);
        var tx_params = {};
        var last_arg = args[args.length - 1];

        // It's only tx_params if it's an object and not a BigNumber.
        if (Utils.is_object(last_arg) && !Utils.is_big_number(last_arg)) {
          tx_params = args.pop();
        }

        tx_params = Utils.merge(C.class_defaults, tx_params);

        return new Promise(function(accept, reject) {

          var decodeLogs = function(logs) {
            return logs.map(function(log) {
              var logABI = C.events[log.topics[0]];

              if (logABI == null) {
                return null;
              }

              var decoder = new SolidityEvent(null, logABI, instance.address);
              return decoder.decode(log);
            }).filter(function(log) {
              return log != null;
            });
          };

          var callback = function(error, tx) {
            if (error != null) {
              reject(error);
              return;
            }

            var timeout = C.synchronization_timeout || 240000;
            var start = new Date().getTime();

            var make_attempt = function() {
              C.web3.eth.getTransactionReceipt(tx, function(err, receipt) {
                if (err) return reject(err);

                if (receipt != null) {
                  // If they've opted into next gen, return more information.
                  if (C.next_gen == true) {
                    return accept({
                      tx: tx,
                      receipt: receipt,
                      logs: decodeLogs(receipt.logs)
                    });
                  } else {
                    return accept(tx);
                  }
                }

                if (timeout > 0 && new Date().getTime() - start > timeout) {
                  return reject(new Error("Transaction " + tx + " wasn't processed in " + (timeout / 1000) + " seconds!"));
                }

                setTimeout(make_attempt, 1000);
              });
            };

            make_attempt();
          };

          args.push(tx_params, callback);
          fn.apply(self, args);
        });
      };
    }
  };

  function instantiate(instance, contract) {
    instance.contract = contract;
    var constructor = instance.constructor;

    // Provision our functions.
    for (var i = 0; i < instance.abi.length; i++) {
      var item = instance.abi[i];
      if (item.type == "function") {
        if (item.constant == true) {
          instance[item.name] = Utils.promisifyFunction(contract[item.name], constructor);
        } else {
          instance[item.name] = Utils.synchronizeFunction(contract[item.name], instance, constructor);
        }

        instance[item.name].call = Utils.promisifyFunction(contract[item.name].call, constructor);
        instance[item.name].sendTransaction = Utils.promisifyFunction(contract[item.name].sendTransaction, constructor);
        instance[item.name].request = contract[item.name].request;
        instance[item.name].estimateGas = Utils.promisifyFunction(contract[item.name].estimateGas, constructor);
      }

      if (item.type == "event") {
        instance[item.name] = contract[item.name];
      }
    }

    instance.allEvents = contract.allEvents;
    instance.address = contract.address;
    instance.transactionHash = contract.transactionHash;
  };

  // Use inheritance to create a clone of this contract,
  // and copy over contract's static functions.
  function mutate(fn) {
    var temp = function Clone() { return fn.apply(this, arguments); };

    Object.keys(fn).forEach(function(key) {
      temp[key] = fn[key];
    });

    temp.prototype = Object.create(fn.prototype);
    bootstrap(temp);
    return temp;
  };

  function bootstrap(fn) {
    fn.web3 = new Web3();
    fn.class_defaults  = fn.prototype.defaults || {};

    // Set the network iniitally to make default data available and re-use code.
    // Then remove the saved network id so the network will be auto-detected on first use.
    fn.setNetwork("default");
    fn.network_id = null;
    return fn;
  };

  // Accepts a contract object created with web3.eth.contract.
  // Optionally, if called without `new`, accepts a network_id and will
  // create a new version of the contract abstraction with that network_id set.
  function Contract() {
    if (this instanceof Contract) {
      instantiate(this, arguments[0]);
    } else {
      var C = mutate(Contract);
      var network_id = arguments.length > 0 ? arguments[0] : "default";
      C.setNetwork(network_id);
      return C;
    }
  };

  Contract.currentProvider = null;

  Contract.setProvider = function(provider) {
    var wrapped = new Provider(provider);
    this.web3.setProvider(wrapped);
    this.currentProvider = provider;
  };

  Contract.new = function() {
    if (this.currentProvider == null) {
      throw new Error("PokeMarket error: Please call setProvider() first before calling new().");
    }

    var args = Array.prototype.slice.call(arguments);

    if (!this.unlinked_binary) {
      throw new Error("PokeMarket error: contract binary not set. Can't deploy new instance.");
    }

    var regex = /__[^_]+_+/g;
    var unlinked_libraries = this.binary.match(regex);

    if (unlinked_libraries != null) {
      unlinked_libraries = unlinked_libraries.map(function(name) {
        // Remove underscores
        return name.replace(/_/g, "");
      }).sort().filter(function(name, index, arr) {
        // Remove duplicates
        if (index + 1 >= arr.length) {
          return true;
        }

        return name != arr[index + 1];
      }).join(", ");

      throw new Error("PokeMarket contains unresolved libraries. You must deploy and link the following libraries before you can deploy a new version of PokeMarket: " + unlinked_libraries);
    }

    var self = this;

    return new Promise(function(accept, reject) {
      var contract_class = self.web3.eth.contract(self.abi);
      var tx_params = {};
      var last_arg = args[args.length - 1];

      // It's only tx_params if it's an object and not a BigNumber.
      if (Utils.is_object(last_arg) && !Utils.is_big_number(last_arg)) {
        tx_params = args.pop();
      }

      tx_params = Utils.merge(self.class_defaults, tx_params);

      if (tx_params.data == null) {
        tx_params.data = self.binary;
      }

      // web3 0.9.0 and above calls new twice this callback twice.
      // Why, I have no idea...
      var intermediary = function(err, web3_instance) {
        if (err != null) {
          reject(err);
          return;
        }

        if (err == null && web3_instance != null && web3_instance.address != null) {
          accept(new self(web3_instance));
        }
      };

      args.push(tx_params, intermediary);
      contract_class.new.apply(contract_class, args);
    });
  };

  Contract.at = function(address) {
    if (address == null || typeof address != "string" || address.length != 42) {
      throw new Error("Invalid address passed to PokeMarket.at(): " + address);
    }

    var contract_class = this.web3.eth.contract(this.abi);
    var contract = contract_class.at(address);

    return new this(contract);
  };

  Contract.deployed = function() {
    if (!this.address) {
      throw new Error("Cannot find deployed address: PokeMarket not deployed or address not set.");
    }

    return this.at(this.address);
  };

  Contract.defaults = function(class_defaults) {
    if (this.class_defaults == null) {
      this.class_defaults = {};
    }

    if (class_defaults == null) {
      class_defaults = {};
    }

    var self = this;
    Object.keys(class_defaults).forEach(function(key) {
      var value = class_defaults[key];
      self.class_defaults[key] = value;
    });

    return this.class_defaults;
  };

  Contract.extend = function() {
    var args = Array.prototype.slice.call(arguments);

    for (var i = 0; i < arguments.length; i++) {
      var object = arguments[i];
      var keys = Object.keys(object);
      for (var j = 0; j < keys.length; j++) {
        var key = keys[j];
        var value = object[key];
        this.prototype[key] = value;
      }
    }
  };

  Contract.all_networks = {
  "default": {
    "abi": [
      {
        "constant": true,
        "inputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "name": "pokeSales",
        "outputs": [
          {
            "name": "pokeSeller",
            "type": "address"
          },
          {
            "name": "pokeBuyer",
            "type": "address"
          },
          {
            "name": "pokeID",
            "type": "uint256"
          },
          {
            "name": "pokePrice",
            "type": "uint256"
          },
          {
            "name": "pokeSold",
            "type": "bool"
          },
          {
            "name": "pokeSellActive",
            "type": "bool"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "newPokecoinAddress",
            "type": "address"
          },
          {
            "name": "newPokecentralAddress",
            "type": "address"
          }
        ],
        "name": "updatePokecoinAndPokemarketAddresses",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "name": "pokeSaleIndex",
        "outputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "name": "pokeSelling",
        "outputs": [
          {
            "name": "",
            "type": "bool"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "pokeSellerAddress",
            "type": "address"
          },
          {
            "name": "pokemonID",
            "type": "uint256"
          },
          {
            "name": "pokemonSalePrice",
            "type": "uint256"
          }
        ],
        "name": "newSale",
        "outputs": [
          {
            "name": "success",
            "type": "bool"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "totalPokemonSales",
        "outputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "pokeCoin",
        "outputs": [
          {
            "name": "",
            "type": "address"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "owner",
        "outputs": [
          {
            "name": "",
            "type": "address"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "pokeSellerAddress",
            "type": "address"
          },
          {
            "name": "pokemonID",
            "type": "uint256"
          }
        ],
        "name": "stopSale",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "pokeCentral",
        "outputs": [
          {
            "name": "",
            "type": "address"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "pokeBuyerAddress",
            "type": "address"
          },
          {
            "name": "pokemonID",
            "type": "uint256"
          }
        ],
        "name": "buyPokemon",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "totalActiveSales",
        "outputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [],
        "name": "owned",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "",
            "type": "address"
          },
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "name": "pokeMasterSelling",
        "outputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "newOwner",
            "type": "address"
          }
        ],
        "name": "transferOwnership",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "inputs": [
          {
            "name": "pokeCoinAddress",
            "type": "address"
          },
          {
            "name": "pokeCentralAddress",
            "type": "address"
          }
        ],
        "type": "constructor"
      },
      {
        "payable": false,
        "type": "fallback"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "pokeSellerAddress",
            "type": "address"
          },
          {
            "indexed": false,
            "name": "pokemonID",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "pokemonSalePrice",
            "type": "uint256"
          }
        ],
        "name": "NewSale",
        "type": "event"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "pokeSellerAddress",
            "type": "address"
          },
          {
            "indexed": false,
            "name": "pokemonID",
            "type": "uint256"
          }
        ],
        "name": "StopSale",
        "type": "event"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "pokeBuyerAddress",
            "type": "address"
          },
          {
            "indexed": false,
            "name": "pokeSellerAddress",
            "type": "address"
          },
          {
            "indexed": false,
            "name": "pokemonID",
            "type": "uint256"
          }
        ],
        "name": "PokeTrade",
        "type": "event"
      }
    ],
    "unlinked_binary": "0x6060604081815280610da7833960a0905251608051600080546c01000000000000000000000000338102819004600160a060020a031992831617909255600180548584028490049083161790556002805484840293909304929091169190911790555050610d36806100716000396000f3606060405236156100b95760e060020a60003504630f6cf39f81146100c657806310c9c76d146101285780631f91d04f146101515780634a2d7ded1461016e5780635b4cc2491461018e578063718493b6146101bf57806380952547146101cd5780638da5cb5b146101e4578063b7086f7b146101fb578063ba1ce2c114610228578063c0ec55a51461023f578063c768d54b146102e0578063df32754b146102ee578063e578b9b214610310578063f2fde38b1461034a575b346100025761030e610002565b34610002576103706004356005805482908110156100025790600052602060002090600502016000508054600182015460028301546003840154600490940154600160a060020a03938416955091909216929060ff8082169161010090041686565b346100025761030e60043560243560005433600160a060020a039081169116146103f557610002565b34610002576103b360043560086020526000908152604090205481565b34610002576103c560043560066020526000908152604090205460ff1681565b34610002576103c5600435602435604435600080548190819033600160a060020a0390811691161461042657610002565b34610002576103b360035481565b34610002576103d9600154600160a060020a031681565b34610002576103d9600054600160a060020a031681565b346100025761030e6004356024355b60008054819033600160a060020a0390811691161461064857610002565b34610002576103d9600254600160a060020a031681565b346100025761030e600435602435600254604080516000602091820181905282517f7efa592b00000000000000000000000000000000000000000000000000000000815260048101869052925190938493600160a060020a0390911692637efa592b9260248084019382900301818787803b156100025760325a03f11561000257505060405151600160a060020a0386811691161415905061080c57610002565b34610002576103b360045481565b346100025760008054600160a060020a031916606060020a338102041790555b005b34610002576103b3600435602435600760205260008281526040902080548290811015610002576000918252602090912001549150829050565b346100025761030e60043560005433600160a060020a03908116911614610a9057610002565b60408051600160a060020a03978816815295909616602086015284860193909352606084019190915215156080830152151560a082015290519081900360c00190f35b60408051918252519081900360200190f35b604080519115158252519081900360200190f35b60408051600160a060020a039092168252519081900360200190f35b60018054606060020a938402849004600160a060020a03199182161790915560028054928402939093049116179055565b600260009054906101000a9004600160a060020a0316600160a060020a0316637efa592b866000604051602001526040518260e060020a02815260040180828152602001915050602060405180830381600087803b156100025760325a03f11561000257505060405151600160a060020a0388811691161490506104a957610002565b60008581526006602052604090205460ff16156104c557610002565b600580546001810180835590919082801582901161053e5760050281600502836000526020600020918201910161053e91905b8082111561057e578054600160a060020a031990811682556001820180549091169055600060028201819055600382015560048101805461ffff191690556005016104f8565b50505091506005600050828154811015610002579060005260206000209060050201600050600481015490915060ff610100909104161561058257610002565b5090565b8054606060020a80880204600160a060020a03199091161781556002810185905560038082018590556004808301805461ffff19166101001790556000878152600660209081526040808320805460ff1916600190811790915560088352928190208790558454830190945582549091019091558151600160a060020a038916815290810187905280820186905290517fa3ed4207b1480804a4590a74f4b9cc310dc0fc839af8d10e2141ca3b72fd93489181900360600190a150600195945050505050565b60005433600160a060020a03908116911614801590610679575083600160a060020a031633600160a060020a031614155b1561068357610002565b600260009054906101000a9004600160a060020a0316600160a060020a0316637efa592b846000604051602001526040518260e060020a02815260040180828152602001915050602060405180830381600087803b156100025760325a03f11561000257505060405151600160a060020a03868116911614905061070657610002565b60008381526006602052604090205460ff16151561072357610002565b60008381526008602052604090205460058054919350908390811015610002579060005260206000209060050201600050600481015490915060ff61010090910416151561077057610002565b60048101805461ff00191690556000838152600660205260409020805460ff191690556107b88484600080548190819033600160a060020a03908116911614610aaf57610002565b6004805460001901905560408051600160a060020a03861681526020810185905281517f52ca857c57bb277b653d35849a414b5e0b1e44e768d2b5f5bea93bde8f6a7ff3929181900390910190a150505050565b60008381526006602052604090205460ff16151561082957610002565b60008381526008602052604090205460058054919350908390811015610002579060005260206000209060050201600050600481015490915060ff61010090910416151561087657610002565b6003810154600154604080516000602091820181905282517f70a08231000000000000000000000000000000000000000000000000000000008152600160a060020a038a81166004830152935193909416936370a08231936024808301949391928390030190829087803b156100025760325a03f115610002575050604051519190911015905061090657610002565b60015481546003830154604080517f23b872dd000000000000000000000000000000000000000000000000000000008152600160a060020a038981166004830152938416602482015260448101929092525191909216916323b872dd91606480830192600092919082900301818387803b156100025760325a03f1156100025750506002548254604080517fc80f9a4f000000000000000000000000000000000000000000000000000000008152600160a060020a039283166004820152888316602482015260448101889052905191909216925063c80f9a4f9160648082019260009290919082900301818387803b156100025760325a03f1156100025750505060018181018054600160a060020a031916606060020a8781020417905560048201805460ff19169091179055610a3e848461020a565b805460408051600160a060020a0380881682529092166020830152818101859052517f2043931581894b5204bcac9b7bd1b362f9b277b9b647061ec50a01aed865c08f9181900360600190a150505050565b60008054606060020a80840204600160a060020a031990911617905550565b505050600160a060020a0382166000908152600760205260408120805490915b81811015610b14578383828154811015610002576000918252602090912001541415610b0c57828181548110156100025760009182526020822001555b600101610acf565b610bae83805480602002602001604051908101604052809291908181526020018280548015610b6357602002820191906000526020600020905b81548152600190910190602001808311610b4e575b50505050506040805160208181018352600080835283518083018552818152845192830190945280825280549293929091829133600160a060020a03908116911614610c2f57610002565b600160a060020a0386166000908152600760209081526040822083518154818355828552938390209194938201939092018215610c0a579160200282015b82811115610c0a578251826000505591602001919060010190610bec565b50610c269291505b8082111561057e5760008155600101610c12565b50505050505050565b8551604051805910610c3e5750595b908082528060200260200182016040528015610c55575b50935060009250600091505b8551821015610cc35760008683815181101561000257906020019060200201511115610cb8578582815181101561000257906020019060200201518484815181101561000257602090810290910101526001909201915b600190910190610c61565b82604051805910610cd15750595b908082528060200260200182016040528015610ce8575b506000925090505b82821015610d2d57838281518110156100025790602001906020020151818381518110156100025760209081029091010152600190910190610cf0565b9594505050505056",
    "events": {
      "0xa3ed4207b1480804a4590a74f4b9cc310dc0fc839af8d10e2141ca3b72fd9348": {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "pokeSellerAddress",
            "type": "address"
          },
          {
            "indexed": false,
            "name": "pokemonID",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "pokemonSalePrice",
            "type": "uint256"
          }
        ],
        "name": "NewSale",
        "type": "event"
      },
      "0x52ca857c57bb277b653d35849a414b5e0b1e44e768d2b5f5bea93bde8f6a7ff3": {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "pokeSellerAddress",
            "type": "address"
          },
          {
            "indexed": false,
            "name": "pokemonID",
            "type": "uint256"
          }
        ],
        "name": "StopSale",
        "type": "event"
      },
      "0x2043931581894b5204bcac9b7bd1b362f9b277b9b647061ec50a01aed865c08f": {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "pokeBuyerAddress",
            "type": "address"
          },
          {
            "indexed": false,
            "name": "pokeSellerAddress",
            "type": "address"
          },
          {
            "indexed": false,
            "name": "pokemonID",
            "type": "uint256"
          }
        ],
        "name": "PokeTrade",
        "type": "event"
      }
    },
    "updated_at": 1478792247511,
    "address": "0xb07acd1c91d1be1eea17ec05f470000b89c31756",
    "links": {}
  }
};

  Contract.checkNetwork = function(callback) {
    var self = this;

    if (this.network_id != null) {
      return callback();
    }

    this.web3.version.network(function(err, result) {
      if (err) return callback(err);

      var network_id = result.toString();

      // If we have the main network,
      if (network_id == "1") {
        var possible_ids = ["1", "live", "default"];

        for (var i = 0; i < possible_ids.length; i++) {
          var id = possible_ids[i];
          if (Contract.all_networks[id] != null) {
            network_id = id;
            break;
          }
        }
      }

      if (self.all_networks[network_id] == null) {
        return callback(new Error(self.name + " error: Can't find artifacts for network id '" + network_id + "'"));
      }

      self.setNetwork(network_id);
      callback();
    })
  };

  Contract.setNetwork = function(network_id) {
    var network = this.all_networks[network_id] || {};

    this.abi             = this.prototype.abi             = network.abi;
    this.unlinked_binary = this.prototype.unlinked_binary = network.unlinked_binary;
    this.address         = this.prototype.address         = network.address;
    this.updated_at      = this.prototype.updated_at      = network.updated_at;
    this.links           = this.prototype.links           = network.links || {};
    this.events          = this.prototype.events          = network.events || {};

    this.network_id = network_id;
  };

  Contract.networks = function() {
    return Object.keys(this.all_networks);
  };

  Contract.link = function(name, address) {
    if (typeof name == "function") {
      var contract = name;

      if (contract.address == null) {
        throw new Error("Cannot link contract without an address.");
      }

      Contract.link(contract.contract_name, contract.address);

      // Merge events so this contract knows about library's events
      Object.keys(contract.events).forEach(function(topic) {
        Contract.events[topic] = contract.events[topic];
      });

      return;
    }

    if (typeof name == "object") {
      var obj = name;
      Object.keys(obj).forEach(function(name) {
        var a = obj[name];
        Contract.link(name, a);
      });
      return;
    }

    Contract.links[name] = address;
  };

  Contract.contract_name   = Contract.prototype.contract_name   = "PokeMarket";
  Contract.generated_with  = Contract.prototype.generated_with  = "3.2.0";

  // Allow people to opt-in to breaking changes now.
  Contract.next_gen = false;

  var properties = {
    binary: function() {
      var binary = Contract.unlinked_binary;

      Object.keys(Contract.links).forEach(function(library_name) {
        var library_address = Contract.links[library_name];
        var regex = new RegExp("__" + library_name + "_*", "g");

        binary = binary.replace(regex, library_address.replace("0x", ""));
      });

      return binary;
    }
  };

  Object.keys(properties).forEach(function(key) {
    var getter = properties[key];

    var definition = {};
    definition.enumerable = true;
    definition.configurable = false;
    definition.get = getter;

    Object.defineProperty(Contract, key, definition);
    Object.defineProperty(Contract.prototype, key, definition);
  });

  bootstrap(Contract);

  if (typeof module != "undefined" && typeof module.exports != "undefined") {
    module.exports = Contract;
  } else {
    // There will only be one version of this contract in the browser,
    // and we can use that.
    window.PokeMarket = Contract;
  }
})();
