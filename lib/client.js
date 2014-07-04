'use strict';

var request = require('request');
var url = require('url');
var querystring = require('querystring');
var xml2js = require('xml2js');

var versionInfo = require('../package.json').version;
var utils = require('./utils');

var XML_PARSER_OPTIONS = {
  ignoreAttrs: true,
  trim: true,
  tagNameProcessors: [xml2js.processors.firstCharLowerCase],
  explicitArray: false
};

var emptyObject = {};

var Client = {
  // settings object, cannot be edited
  _settings: null,
  // request object with defaults for this client
  _request: null,
  // decoded azure key
  _azureKey: null,
  // retry function
  _retryLogic: null,

  _prepareRequestDefaults: function(settings) {
    var defaults = {
      encoding: 'utf8',
      timeout: settings.timeout
    };
    if (settings.agent) {
      defaults.agent = settings.agent;
    }
    if (settings.proxy) {
      defaults.proxy = settings.proxy;
    }
    if (settings.forever === true) {
      defaults.forever = settings.forever;
    }
    if (settings.agentOptions) {
      defaults.agentOptions = settings.agentOptions;
    }
    if (settings.pool != null) {
      defaults.pool = settings.pool;
    }
    return defaults;
  },

  _getRequestSpecificOptions: function _getRequestSpecificOptions(method, path, qs, body) {
    var now = new Date().toUTCString();

    var requestOptions = {
      method: method,
      uri: url.parse(this._settings.accountUrl + path),
      qs: qs,
      headers: {
        date: now,
        'user-agent': 'azure-queue-node/'+versionInfo,
        'content-type': 'application/xml;charset="utf-8"',
        'content-length': body ? Buffer.byteLength(body, 'utf8') : 0,
        'x-ms-date': now,
        'x-ms-version': '2014-02-14'
      }
    };

    return requestOptions;
  },

  _addSharedKeyAuthHeader: function _addSharedKeyAuthHeader(requestOptions) {
    var stringToSign = requestOptions.method +'\n';
    stringToSign += (requestOptions.headers['content-encoding'] ? requestOptions.headers['content-encoding'] : '') + '\n';
    stringToSign += (requestOptions.headers['content-language'] ? requestOptions.headers['content-language'] : '') + '\n';
    stringToSign += (requestOptions.headers['content-length'] != null ? requestOptions.headers['content-length'] : '') + '\n';
    stringToSign += (requestOptions.headers['content-md5'] ? requestOptions.headers['content-md5'] : '') + '\n';
    stringToSign += (requestOptions.headers['content-type'] ? requestOptions.headers['content-type'] : '') + '\n';
    //stringToSign += (requestOptions.headers['date'] ? requestOptions.headers['date'] : '') + '\n';
    stringToSign += '\n'; // do not count date header (Microsoft's strange logic!)
    // If-Modified-Since, If-Match, If-None-Match, If-Unmodified-Since, Range are not used, so can be skipped
    stringToSign += '\n\n\n\n\n';
    // CanonicalizedHeaders, only below ones, as currently lib doesn't support queue metadata
    stringToSign += (requestOptions.headers['x-ms-date'] ? 'x-ms-date:'+requestOptions.headers['x-ms-date']+'\n' : '');
    stringToSign += (requestOptions.headers['x-ms-version'] ? 'x-ms-version:'+requestOptions.headers['x-ms-version']+'\n' : '');
    // CanonicalizedResource
    stringToSign += '/'+this._settings.accountName;
    stringToSign += requestOptions.uri.path;
    // as possible query string elements are very limited, ifs inlined
    if (requestOptions.qs) {
      if ('comp' in requestOptions.qs) {
        stringToSign += '\ncomp:' + requestOptions.qs.comp;
      }
      if ('marker' in requestOptions.qs) {
        stringToSign += '\nmarker:' + requestOptions.qs.marker;
      }
      if ('maxresults' in requestOptions.qs) {
        stringToSign += '\nmaxresults:' + requestOptions.qs.maxresults;
      }
      if ('messagettl' in requestOptions.qs) {
        stringToSign += '\nmessagettl:' + requestOptions.qs.messagettl;
      }
      if ('numofmessages' in requestOptions.qs) {
        stringToSign += '\nnumofmessages:' + requestOptions.qs.numofmessages;
      }
      if ('peekonly' in requestOptions.qs) {
        stringToSign += '\npeekonly:' + requestOptions.qs.peekonly;
      }
      if ('prefix' in requestOptions.qs) {
        stringToSign += '\nprefix:' + requestOptions.qs.prefix;
      }
      if ('popreceipt' in requestOptions.qs) {
        stringToSign += '\npopreceipt:' + requestOptions.qs.popreceipt;
      }
      if ('timeout' in requestOptions.qs) {
        stringToSign += '\ntimeout:' + requestOptions.qs.timeout;
      }
      if ('visibilitytimeout' in requestOptions.qs) {
        stringToSign += '\nvisibilitytimeout:' + requestOptions.qs.visibilitytimeout;
      }
    }
    requestOptions.headers.authorization = 'SharedKey ' + this._settings.accountName + ':' + utils.hmacSha256(this._azureKey, stringToSign);
    return requestOptions;
  },

  _normalizeCallback: function _normalizeCallback(cb, error, response, body) {
    if (error) {
      return cb(error);
    }
    if (!response) {
      return cb({code: 'UnknownError'});
    }

    // check if response is really XML, if yes, parse it
    if (body && typeof body === 'string' && body.indexOf('<?xml' === 0)) {
      xml2js.parseString(body, XML_PARSER_OPTIONS, function(err, result) {
        if (err) {
          return cb({code: 'XMLParseError'});
        }
        body = result;
        next();
      })
    } else {
      next();
    }

    function next() {
      if (response.statusCode >= 400) {
        return cb({
          statusCode: response.statusCode,
          code: body && body.error ? body.error.code : 'UnknownBody',
          body: body && body.error ? body.error : body
        });
      }
      return cb(null, {
        statusCode: response.statusCode,
        headers: response.headers, // some important data may be in response headers
        body: body
      });
    }
  },

  _sendRequestWithRetry: function _sendRequestWithRetry(options, cb) {
    if (this._retryLogic == null) {
      this._request(options, this._normalizeCallback.bind(this, cb));
    } else {
      var self = this;
      this._retryLogic(options, function(filterCb) {
        self._request(options, self._normalizeCallback.bind(self, function(err, resp) {
          filterCb(err, resp, function(err, resp) {
            cb(err, resp);
          });
        }));
      });
    }
  },

  _makeRequest: function _makeRequest(method, path, qs, body, cb) {
    var options = this._getRequestSpecificOptions(method, path, qs, body);
    if (this._azureKey) {
      options = this._addSharedKeyAuthHeader(options);
    }

    if (typeof body === 'string' || typeof body === 'object') {
      options.body = body;
    }

    this._sendRequestWithRetry(options, cb);
  },

  create: function create(settings) {
    if (!settings.accountUrl || !settings.accountName || !settings.accountKey) {
      throw 'Provide accountUrl, accountName, and accountKey in settings or in env CLOUD_STORAGE_ACCOUNT';
    }

    var sealedSettings = Object.seal(settings);

    // create request object with most of the default settings
    var defaultRequest = request.defaults(this._prepareRequestDefaults(sealedSettings));

    var retryLogic;
    if (typeof sealedSettings.retry === 'function') {
      retryLogic = sealedSettings.retry;
    } else if (typeof sealedSettings.retry === 'object') {
      retryLogic = utils.generateRetryFunction(sealedSettings.retry);
    } else if (sealedSettings.retry === false) {
      retryLogic = null;
    } else {
      retryLogic = utils.generateRetryFunction();
    }

    return Object.create(this, {
      _settings: {value: sealedSettings},
      _request: {value: defaultRequest},
      _azureKey: {value: sealedSettings.accountKey ? utils.base64Decode(sealedSettings.accountKey) : null},
      _retryLogic: {value: retryLogic}
    });
  },

  getSettings: function getSettings() {
    return this._settings;
  },

  _createQueueCb: function _createQueueCb(cb, options, err, data) {
    if (!err && (data.statusCode === 201 || data.statusCode === 204)) {
      return cb(null, data.statusCode === 201);
    } else {
      return cb(err);
    }
  },
  createQueue: function createQueue(queueName, options, cb) {
    if (typeof options === 'function') {
      cb = options;
    }
    var qs = null;
    if (typeof options === 'object' && options.timeout) {
      qs = {
        timeout: options.timeout
      };
    }
    this._makeRequest('PUT', queueName, qs, null, this._createQueueCb.bind(this, cb, typeof options === 'object' ? options : null));
    return this;
  },

  _listQueuesCb: function _listQueuesCb(cb, err, data) {
    if (!err && data.statusCode === 200) {
      var er = data.body.enumerationResults;
      var results = new Array(er.queues.queue ? er.queues.queue.length || 1 : 0);
      if (results.length === 1) {
        results[0] = er.queues.queue.name;
      } else if (results.length > 1) {
        er.queues.queue.forEach(function(r, i) {
          this[i] = r.name;
        }, results);
      }
      var continuation = er.nextMarker ? er.nextMarker : undefined;
      return cb(null, results, continuation);
    } else {
      return cb(err);
    }
  },
  listQueues: function listQueues(options, cb){
    if (typeof options === 'function') {
      cb = options;
    }
    var qs = {comp: 'list'};
    if (typeof options === 'object') {
      if (typeof options.prefix === 'string') {
        qs.prefix = options.prefix;
      }
      if (typeof options.marker === 'string') {
        qs.marker = options.marker;
      }
      if (options.maxResults) {
        qs.maxresults = options.maxResults;
      }
      if (options.timeout) {
        qs.timeout = options.timeout;
      }
    }

    this._makeRequest('GET', '', qs, null, this._listQueuesCb.bind(this, cb));
    return this;
  },

  _204Cb: function _204Cb(cb, err, data) {
    if (!err && data.statusCode === 204) {
      return cb(null);
    } else {
      return cb(err);
    }
  },

  deleteQueue: function deleteQueue(queueName, options, cb) {
    if (typeof options === 'function') {
      cb = options;
    }
    var qs = null;
    if (typeof options === 'object' && options.timeout) {
      qs = {
        timeout: options.timeout
      };
    }
    this._makeRequest('DELETE', queueName, qs, null, this._204Cb.bind(this, cb));
    return this;
  },

  _countMessagesCb: function _countMessagesCb(cb, err, data) {
    if (!err && data.statusCode === 200) {
      return cb(null, parseInt(data.headers['x-ms-approximate-messages-count'], 10));
    } else {
      return cb(err);
    }
  },
  countMessages: function countMessages(queueName, options, cb) {
    if (typeof options === 'function') {
      cb = options;
    }
    var qs = {
      comp: 'metadata'
    };
    if (typeof options === 'object' && options.timeout) {
      qs = {
        timeout: options.timeout
      };
    }
    this._makeRequest('HEAD', queueName, qs, null, this._countMessagesCb.bind(this, cb));
    return this;
  },

  _putMessageCb: function _putMessageCb(cb, err, data) {
    if (!err && data.statusCode === 201) {
      return cb(null);
    } else {
      return cb(err);
    }
  },
  putMessage: function putMessage(queue, message, options, cb) {
    if (typeof options === 'function') {
      cb = options;
    }

    var qs = null;
    if (typeof options === 'object') {
      qs = {};
      if (options.visibilityTimeout) {
        qs.visibilitytimeout = options.visibilityTimeout;
      }
      if (options.messageTTL) {
        qs.messagettl = options.messageTTL;
      }
      if (options.timeout) {
        qs.timeout = options.timeout;
      }
      if (Object.keys(qs).length === 0) {
        qs = null;
      }
    }

    this._makeRequest('POST', queue+'/messages', qs, utils.xmlizeMessage.call(this, options || emptyObject, message), this._putMessageCb.bind(this, cb));
    return this;
  },

  clearMessages: function clearMessages(queueName, cb) {
    if (typeof options === 'function') {
      cb = options;
    }
    var qs = null;
    if (typeof options === 'object' && options.timeout) {
      qs = {
        timeout: options.timeout
      };
    }
    this._makeRequest('DELETE', queueName+'/messages', qs, null, this._204Cb.bind(this, cb));
    return this;
  },

  _getMessagesCb: function _getMessagesCb(cb, options, err, data) {
    if (!err && data.statusCode === 200) {
      var er = data.body.queueMessagesList;
      var results = new Array(er.queueMessage ? er.queueMessage.length || 1 : 0);
      if (results.length === 1) {
        er.queueMessage = utils.decodeMessage.call(this, options || emptyObject, er.queueMessage);
        results[0] = er.queueMessage;
      } else if (results.length > 1) {
        var self = this;
        er.queueMessage.forEach(function(r, i) {
          this[i] = utils.decodeMessage.call(self, options || emptyObject, r);
        }, results);
      }
      return cb(null, results);
    } else {
      return cb(err);
    }
  },
  getMessages: function getMessages(queue, options, cb) {
    if (typeof options === 'function') {
      cb = options;
    }

    var qs = null;
    if (typeof options === 'object') {
      qs = {};
      if (options.visibilityTimeout) {
        qs.visibilitytimeout = options.visibilityTimeout;
      }
      if (options.maxMessages) {
        qs.numofmessages = options.maxMessages;
      }
      if (options.timeout) {
        qs.timeout = options.timeout;
      }
      if (Object.keys(qs).length === 0) {
        qs = null;
      }
    }

    this._makeRequest('GET', queue+'/messages', qs, null, this._getMessagesCb.bind(this, cb, options));
    return this;
  },

  peekMessages: function peekMessages(queue, options, cb) {
    if (typeof options === 'function') {
      cb = options;
    }

    var qs = {
      peekonly: 'true'
    };
    if (options.maxMessages) {
      qs.numofmessages = options.maxMessages;
    }
    if (options.timeout) {
      qs.timeout = options.timeout;
    }

    // we can use get _getMessagesCb here
    this._makeRequest('GET', queue+'/messages', qs, null, this._getMessagesCb.bind(this, cb, options));
    return this;
  },

  _updateMessageCb: function _updateMessageCb(cb, err, data) {
    if (!err && data.statusCode === 204) {
      return cb(null, {
        popReceipt: data.headers['x-ms-popreceipt'],
        timeNextVisible: new Date(data.headers['x-ms-time-next-visible'])
      });
    } else {
      return cb(err);
    }
  },
  updateMessage: function updateMessage(queue, messageId, popReceipt, visibilityTimeout, message, options, cb) {
    if (typeof options === 'function') {
      cb = options;
    }

    var qs = {
      popreceipt: popReceipt,
      visibilitytimeout: visibilityTimeout
    };
    if (options.timeout) {
      qs.timeout = options.timeout;
    }

    this._makeRequest('PUT', queue+'/messages/'+messageId, qs, utils.xmlizeMessage.call(this, options || emptyObject, message), this._updateMessageCb.bind(this, cb));
    return this;
  },

  deleteMessage: function deleteMessage(queue, messageId, popReceipt, options, cb) {
    if (typeof options === 'function') {
      cb = options;
    }

    var qs = {
      popreceipt: popReceipt
    };
    if (options.timeout) {
      qs.timeout = options.timeout;
    }

    this._makeRequest('DELETE', queue+'/messages/'+messageId, qs, null, this._204Cb.bind(this, cb));
    return this;
  }
};

exports.Client = Client;