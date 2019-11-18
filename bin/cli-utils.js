var _ = require('lodash');
var url = require('url');
var read = require('read')
var log = require('npmlog');
var Client = require('ocore-wallet-client');
var FileStorage = require('./filestorage');
var sjcl = require('sjcl');

var WALLET_ENCRYPTION_OPTS = {
  iter: 5000
};

var Utils = function() {};

Utils.ASSETS = {
  base: {
    name: 'bytes',
    ticker: 'BYTES',
    decimals: 0
  },
};

var die = Utils.die = function(err) {
  if (err) {
    if (err.code && err.code == 'ECONNREFUSED') {
      console.error('!! Could not connect to Ocore Wallet Service');
    } else {
      console.log('!! ' + err.toString());
    }
    process.exit(1);
  }
};

Utils.parseMN = function(text) {
  if (!text) throw new Error('No m-n parameter');

  var regex = /^(\d+)(-|of|-of-)?(\d+)$/i;
  var match = regex.exec(text.trim());

  if (!match || match.length === 0) throw new Error('Invalid m-n parameter');

  var m = parseInt(match[1]);
  var n = parseInt(match[3]);
  if (m > n) throw new Error('Invalid m-n parameter');

  return [m, n];
};

Utils.shortID = function(id) {
  return id.substr(id.length - 4);
};

Utils.confirmationId = function(copayer) {
  return parseInt(copayer.signature.substr(-4), 16).toString().substr(-4);
}

Utils.doLoad = function(client, doNotComplete, walletData, password, filename, cb) {
  if (password) {
    try {
      walletData = sjcl.decrypt(password, walletData);
    } catch (e) {
      die('Could not open wallet. Wrong password.');
    }
  }

  try {
    client.import(walletData);
  } catch (e) {
    die('Corrupt wallet file.');
  };
  if (doNotComplete) return cb(client);

  client.on('walletCompleted', function(wallet) {
    Utils.doSave(client, filename, password, function() {
      log.info('Your wallet has just been completed. Please backup your wallet file or use the export command.');
    });
  });
  
  client.openWallet(function(err, isComplete) {
    if (err) throw err;
    return cb(client);
  });
};

Utils.loadEncrypted = function(client, opts, walletData, filename, cb) {
  read({
    prompt: 'Enter password to decrypt:',
    silent: true
  }, function(er, password) {
    if (er) die(err);
    if (!password) die("no password given");

    return Utils.doLoad(client, opts.doNotComplete, walletData, password, filename, cb);
  });
};

Utils.getClient = function(args, opts, cb) {
  opts = opts || {};

  var filename = args.file || process.env['WALLET_FILE'] || process.env['HOME'] + '/.wallet.dat';
  var host = args.host || process.env['OWS_HOST'] || 'http://localhost:3232/ows/api';

  var storage = new FileStorage({
    filename: filename,
  });

  var client = new Client({
    baseUrl: host,
    verbose: args.verbose,
    supportStaffWalletId: opts.walletId,
  });

  client.getAssets({}, function (err, assets) {
    if (err) die(err);

    if (Array.isArray(assets)) {
      assets.forEach(asset => {
        Utils.ASSETS[asset.asset] = {
          name: asset.shortName,
          ticker: asset.ticker,
          decimals: asset.decimals
        };
      });
    }

    storage.load(function(err, walletData) {
      if (err) {
        if (err.code == 'ENOENT') {
          if (opts.mustExist) {
            die('File "' + filename + '" not found.');
          }
        } else {
          die(err);
        }
      }

      if (walletData && opts.mustBeNew) {
        die('File "' + filename + '" already exists.');
      }
      if (!walletData) return cb(client);

      var json;
      try {
        json = JSON.parse(walletData);
      } catch (e) {
        die('Invalid input file');
      };

      if (json.ct) {
        Utils.loadEncrypted(client, opts, walletData, filename, cb);
      } else {
        Utils.doLoad(client, opts.doNotComplete, walletData, null, filename, cb);
      }
    });
  });
};

Utils.doSave = function(client, filename, password, cb) {
  var opts = {};

  var str = client.export();
  if (password) {
    str = sjcl.encrypt(password, str, WALLET_ENCRYPTION_OPTS);
  }

  var storage = new FileStorage({
    filename: filename,
  });

  storage.save(str, function(err) {
    die(err);
    return cb();
  });
};

Utils.saveEncrypted = function(client, filename, cb) {
  read({
    prompt: 'Enter password to encrypt:',
    silent: true
  }, function(er, password) {
    if (er) Utils.die(err);
    if (!password) Utils.die("no password given");
    read({
      prompt: 'Confirm password:',
      silent: true
    }, function(er, password2) {
      if (er) Utils.die(err);
      if (password != password2)
        Utils.die("passwords were not equal");

      Utils.doSave(client, filename, password, cb);
    });
  });
};

Utils.saveClient = function(args, client, opts, cb) {
  if (_.isFunction(opts)) {
    cb = opts;
    opts = {};
  }

  var filename = args.file || process.env['WALLET_FILE'] || process.env['HOME'] + '/.wallet.dat';

  var storage = new FileStorage({
    filename: filename,
  });

  console.log(' * Saving file', filename);

  storage.exists(function(exists) {
    if (exists && opts.doNotOverwrite) {
      console.log(' * File already exists! Please specify a new filename using the -f option.');
      return cb();
    }

    if (args.password) {
      Utils.saveEncrypted(client, filename, cb);
    } else {
      Utils.doSave(client, filename, null, cb);
    };
  });
};

Utils.findOneTxProposal = function(txps, id) {
  var matches = _.filter(txps, function(tx) {
    return _.endsWith(Utils.shortID(tx.id), id);
  });

  if (!matches.length)
    Utils.die('Could not find TX Proposal:' + id);

  if (matches.length > 1) {
    console.log('More than one TX Proposals match:' + id);
    Utils.renderTxProposals(txps);
    program.exit(1);
  }

  return matches[0];
};

Utils.parseAmount = function(text, asset) {
  var amount = +text;
  if (!_.isNumber(amount) || _.isNaN(amount)) throw new Error('Invalid amount');

  var u = Utils.ASSETS[asset] || Utils.ASSETS['base'];
  amount = amount * Math.pow(10, u.decimals);
  if (amount != Math.round(amount)) throw new Error('Invalid amount');

  return amount;
};

Utils.configureCommander = function(program) {
  program
    .version('0.0.1')
    .option('-f, --file <filename>', 'Wallet file')
    .option('-s, --host <host>', 'Ocore Wallet Service URL (eg: http://localhost:3001/ows/api)')
    .option('-v, --verbose', 'be verbose')

  return program;
};

Utils.renderAmount = function(amount, asset, opts) {
  function clipDecimals(number, decimals) {
    var x = number.toString().split('.');
    var d = (x[1] || '0').substring(0, decimals);
    return parseFloat(x[0] + '.' + d);
  };

  function addSeparators(nStr, thousands, decimal, minDecimals) {
    nStr = nStr.replace('.', decimal);
    var x = nStr.split(decimal);
    var x0 = x[0];
    var x1 = x[1];

    x1 = _.dropRightWhile(x1, function(n, i) {
      return n == '0' && i >= minDecimals;
    }).join('');
    var x2 = x.length > 1 ? decimal + x1 : '';

    x0 = x0.replace(/\B(?=(\d{3})+(?!\d))/g, thousands);
    return x0 + x2;
  };

  opts = opts || {};

  var u = Utils.ASSETS[asset] || Utils.ASSETS['base'];
  var n = clipDecimals((amount/Math.pow(10, u.decimals)), u.decimals).toFixed(u.decimals);
  return addSeparators(n, opts.thousandsSeparator || ',', opts.decimalSeparator || '.', u.decimals) + ' ' + u.ticker;
};

Utils.renderTxProposals = function(txps) {
  if (_.isEmpty(txps))
    return;

  _.each(txps, function(x) {
    if (x.app == 'payment') {
      var outputs = x.params.outputs.filter(output => output.address != x.params.change_address);
      var asset = x.params.asset || 'base';
      var amount = Utils.renderAmount(outputs[0].amount, asset);
      console.log("  %s [%s] %s => %s [\"%s\" by %s] [%s]", Utils.shortID(x.id), x.app, amount, outputs[0].address, x.message, x.creatorName, x.status);
    } else {
      console.log("  %s [%s] %s [\"%s\" by %s] [%s]", Utils.shortID(x.id), x.app, JSON.stringify(x.params), x.message, x.creatorName, x.status);
    }
  });
};

module.exports = Utils;
