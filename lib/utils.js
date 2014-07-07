'use strict';

var crypto = require('crypto');

var ACCOUNT_STRING_KEYS = ['QueueEndpoint', 'AccountName', 'AccountKey'];
var ACCOUNT_STRING_SETTINGS_KEYS = ['accountUrl', 'accountName', 'accountKey'];
var ESCAPE_REGEXP = /[<&]/g;
var ESCAPE_FN = function (match) {
  return match === '<' ? '&lt;' : '&amp;';
}

exports.parseAccountString = function parseAccountString(accountString) {
  if (typeof accountString !== 'string') {
    return null;
  }

  var trimmedAS = accountString.trim();
  if (trimmedAS.length < 30) {
    return null;
  }

  var splittedAS = trimmedAS.split(';');
  if (splittedAS.length < 3) {
    return null;
  }

  var entry, i, j, retrievedValues = {};
  for (i = 0; i < splittedAS.length; ++i) {
    entry = splittedAS[i].split('=');
    if (entry.length < 2) {
      return null;
    }
    // get back if within string
    if (entry.length > 2) {
      for (j = 2; j < entry.length; ++j) {
        entry[1] += '='+entry[j];
      }
    }
    if (ACCOUNT_STRING_KEYS.indexOf(entry[0]) !== -1) {
      retrievedValues[entry[0]] = entry[1];
    }
  }

  if (Object.keys(retrievedValues).length !== ACCOUNT_STRING_KEYS.length) {
    return null;
  }

  // convert to settings keys
  var finalValues = {};
  for (i = 0; i < ACCOUNT_STRING_SETTINGS_KEYS.length; ++i) {
    finalValues[ACCOUNT_STRING_SETTINGS_KEYS[i]] = retrievedValues[ACCOUNT_STRING_KEYS[i]];
  }

  return finalValues;
};

exports.base64Decode = function base64Decode(base64String) {
  return new Buffer(base64String, 'base64');
};

exports.hmacSha256 = function hmacSha256(keyBuffer, stringToSign) {
  return crypto.createHmac('sha256', keyBuffer).update(stringToSign, 'utf-8').digest('base64');
};

exports.xmlizeMessage = function xmlizeMessage(options, message) {
  if (options.json === true || (this._settings.json === true && options.json !== false)) {
    if (typeof message !== 'object') {
      throw 'message must be an object';
    } else {
      message = JSON.stringify(message).replace(ESCAPE_REGEXP, ESCAPE_FN);
    }
  }
  if ((options.json === false || (this._settings.json === false && options.json !== true)) || (options.base64 === true || (this._settings.base64 === true && options.base64 !== false))) {
    if (message instanceof Buffer) {
      message = message.toString('base64');
    } else if (typeof message === 'string') {
      message = new Buffer(message).toString('base64');
    } else {
      throw 'message must be a Buffer or string';
    }
  }
  return '<QueueMessage><MessageText>'+message+'</MessageText></QueueMessage>';
};

exports.decodeMessage = function decodeMessage(options, message) {
  if (options.base64 === true || (this._settings.base64 === true && options.base64 !== false) || (message.messageText[0] !== '{' && message.messageText[0] !== '[')) {
    try {
      message.messageText = new Buffer(message.messageText, 'base64').toString('utf8');
    } catch (e) {
      message.messageText = e.toString();
    }
  }
  if (options.json === true || (this._settings.json === true && options.json !== false)) {
    try {
      message.messageText = JSON.parse(message.messageText);
    } catch (e) {
      message.messageText = e;
    }
  }
  if (message.dequeueCount) {
    message.dequeueCount = parseInt(message.dequeueCount, 10)
  }
  if (message.expirationTime) {
    message.expirationTime = new Date(message.expirationTime);
  }
  if (message.insertionTime) {
    message.insertionTime = new Date(message.insertionTime);
  }
  if (message.timeNextVisible) {
    message.timeNextVisible = new Date(message.timeNextVisible);
  }
  return message;
};

var _defaultRetryOptions = {
  retries: 3,
  firstDelay: 2000,
  nextDelayMult: 2,
  variability:  0.2,
  transientErrors: [500, 501, 502, 503, 'ETIMEDOUT', 'ECONNRESET', 'EADDRINUSE', 'ESOCKETTIMEDOUT', 'ECONNREFUSED']
};
function _retryLogic(requestOptions, nextReq) {
  // requestOptions needs to be edited in place (it is safe to do so)
  // but retry does not change it in any way
  var retry = 0, delay, settings = this;

  function retryFn(err, resp, nextResp) {
    if (err) {
      if (retry < settings.retries && (settings.transientErrors.indexOf(err.code) !== -1 || settings.transientErrors.indexOf(err.statusCode) !== -1)) {
        retry += 1;
        if (retry === 1) {
          delay = settings.firstDelay;
        } else {
          delay *= settings.nextDelayMult;
        }
        delay += (Math.random() - 0.5) * settings.variability * delay;
        delay = Math.floor(delay);
        setTimeout(function() {
          nextReq(retryFn);
        }, delay);
      } else {
        err.retriesMade = retry;
        nextResp(err, resp);
      }
    } else {
      nextResp(err, resp);
    }
  }

  nextReq(retryFn);
}
exports.generateRetryFunction = function generateRetryFunction(options) {
  var finalOptions = !options ? _defaultRetryOptions : {
    retries: options.retries > 0 ? options.retries : _defaultRetryOptions.retries,
    firstDelay: options.firstDelay > 0 ? options.firstDelay : _defaultRetryOptions.firstDelay,
    nextDelayMult: options.nextDelayMult > 0 ? options.nextDelayMult : _defaultRetryOptions.nextDelayMult,
    variability: typeof options.variability === 'number' ? options.variability : _defaultRetryOptions.variability,
    transientErrors: Array.isArray(options.transientErrors) ? options.transientErrors : _defaultRetryOptions.transientErrors
  };

  return _retryLogic.bind(finalOptions);
};

exports.makeSignature = function makeSignature(keyBuffer, values) {
  return exports.hmacSha256(keyBuffer, values.join('\n'));
};

exports.isoDateWithoutMiliseconds = function isoDateWithoutMiliseconds(date) {
  var raw = date.toJSON();
  return raw.substr(0, raw.lastIndexOf('.')) + 'Z';
};