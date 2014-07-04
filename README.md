azure-queue-node
================

Simplified Azure Queue Storage client library for NodeJS.

What is supported:

* creating, deleting and listing queues
* putting, updating, getting and deleting messages
* retrieve approximate number of messages in queue

What may added in the future:

* generating SAS (Shared Access Signature) and using it for authentication
* get and set service properties
* get and set per queue metadata

Usage
==============

## Setting the default client connection info and other settings

Default client uses environment variable to set up the access key and storage URL if possible. It looks for the `CLOUD_STORAGE_ACCOUNT` setting with three elements (it is the default format used by Azure Storage):

```
QueueEndpoint=http://accountName.queue.core.windows.net/;AccountName=accountName;AccountKey=theKey
```

No error is returned if this doesn't exists, is incomplete or malformed.

*Current version does not support quotes and AccountKey must be the last one to be parsed correctly. This may be fixed in the future.*

If the environment variable is not set, the default connection info have to be set using below command to be usable:

```javascript
var azureQueue = require('azure-queue-node');
azureQueue.setDefaultClient({
  accountUrl: 'http://accountName.queue.core.windows.net/',
  accountName: 'accountName',
  accountKey: 'theKey'
});
```

The same method allows to set other default client settings (see *Client settings*).

## Using default client

```javascript
var azureQueue = require('azure-queue-node');
var defaultClient = azureTable.getDefaultClient();

// use the client to create the queue
defaultClient.createQueue('queueName', true, cb);
// or add message
defaultClient.putMessage('queue', message, options, cb);
```

## Creating customized client

It is possible to create additional clients that are based on other client (or on default settings), but customized and independent. This allows to for example use several queue storage accounts but still have one default for convenience.

```javascript
var azureQueue = require('azure-queue-node');
var queueClient = azureQueue.createClient({
  // predefined settings
}, [baseClient]);
```

Base client is the client on which the new one will be based. If not provided, it is based on the default one.

## Longer usage example

```javascript
var client = azureQueue.getDefaultClient();
client.putMessage('taskqueue', {
  value1: 'ABCDEFG'
}, function(err, data) {
  // err is null
  // data is undefined
});
client.getMessages('taskqueue', {maxMessages: 10}, function(err, data) {
  // err is null
  // data contains array with to 10 queue message objects
});
client.deleteMessage('taskqueue', 'messageId', 'popReceipt', function(err, data) {
  // err is null
  // data is undefined
});
```

Client settings
===============

Account related:

* `accountUrl` (string) - URL of the service's endpoint (no default value)
* `accountName` (string) - name of the used account (no default value)
* `accountKey` (string) - base64 encoded account key (no default value), may be null if `sas` is provided

Underlying HTTP request related (passed without changes to request module):

* `timeout` (int) - request timeout in miliseconds (default: 30000)
* `proxy` (string) - proxy URL
* `forever` (bool) - use `true` to turn advanced socket reuse
* `agent` (Agent) - already created agent object (do not set `proxy`, `forever` or `pool` is set (may not work otherwise)
* `agentOptions` (object) - used to set maxSockets option for forever or standard agent
* `pool` (false|object) - use `false` to turn off socket reuse

Azure Queue Storage related:

* `json` (bool) - if set to `true` (default), message is JSON encoded/decoded; otherwise it is base64 encoded/decoded
* `retry` (false/object/function) - set to `false` to turn off any retry policy; provide a function for custom retry logic or use object to change parameter of build in retry logic

Retry options:

* `retries` (int) - a number of retries (default: 3)
* `firstDelay` (int) - delay of the first retry request in ms (default: 2000ms)
* `nextDelayMult` (float) - delay multiplier using previous delay as a base (default: 2); use 1 for linear delay
* `variability` (float) - random delay multiplier added or subtracted from current delay (default 0.2)
* `transientErrors` (array of ints or strings) - describes situations where retry should be used; if it is int, status code is checked for equality; for string the code element of error or response is checked (default: `[500, 501, 502, 503, 'ETIMEDOUT', 'ECONNRESET', 'EADDRINUSE', 'ESOCKETTIMEDOUT']`

Custom retry function should support below parameters (in order of appearance):

* `requestOptions` (object) - if needed it can be edited in place to change request options and headers
* `nextReq` (function) - function to be called to make a request.

The `nextReq` function must be called passing additional function `retryFn` with below parameters:

* `err` (object) - null or error object from response (see normal response callback)
* `resp` (object/array) - response object (see normal response callback)
* `nextResp` (function) - function to be called when there is no need for a retry passing (`err` and `resp` to it)

As by default request headers are not regenerated on retries, the retry time of of the last one cannot be very long, because authentication will fail.

Example retry function which retries every time `code` in error is `ETIMEDOUT`:

```javascript
function _retryLogic(requestOptions, nextReq) {
  function retryFn(err, resp, nextResp) {
    if (err && err.code === 'ETIMEDOUT') {
      nextReq(retryFn);
    } else {
      nextResp(err, resp);
    }
  }
  nextReq(retryFn);
}
```

In case of reties, the default retry function returns `retriesMade` key in error informing about the number of retries made (helps in debugging).

API
===

If not explained differently, `cb` in API is a functions in format `function cb(err, data)`, but `data` may be undefined if there is no explicit response. In case of queue list there may be additional third argument passed if there is a marker token.

If not stated otherwise, `options` parameter may contain `timeout` key with timeout in seconds specific for this operation. If not provided, Azure Storage uses its default (30 seconds).

## Module level

### getDefaultClient()

Returns default `Client` object. If `setDefaultClient()` was not used earlier the client only have default module settings and environment variable applied.

### setDefaultClient(settings)

Sets up and returns default `Client` object with provided `settings`. It is using default settings as a base.

### createClient(settings, [base])

Returns new `Client` object using new settings and `base` client settings as a fallback. If `base` is not provided, uses default client settings.


## Client object level

### create(settings)

Returns new `Client` object using only provided settings object. Shouldn't be used directly unless you want to provide all options. Use `createClient` from main module if possible.

### getSettings()

Returns sealed settings object used by this client.

### createQueue(queue, [options], cb)

Creates new queue. The `queue` is queue name. The `options` is optional and supports only `timeout` key. The `cb` is a standard callback function, but `data` is `true` if queue was created and `false` if already existed.

### deleteQueue(queue, [options], cb)

Removes existing queue. The `queue` is queue name. The `cb` is a standard callback function.

### listQueues([options], cb)

Returns array with queue names (as strings). The `options` is optional, but if exists and `marker` key is provided, the retrieval will start from last marker token. The `prefix` in `options` allow to filter the results to return only queues with names that begin with the specified prefix. The `maxResults` in `options` allow to retrieve lower about of results. The `cb` is a standard callback function, but if marker is returned, the third argument will be passed with value for `marker` key.

### countMessages(queue, [options], cb)

Returns approximate queue messages count. The `queue` is queue name. The `cb` is a standard callback function. The `data` part will contain integer with approximate count of messages in queue.

### putMessage(queue, message, [options], cb)

Add new `message` to `queue`. The `message` may be a base64 string (if JSON is not used) or object (it will be JSON encoded). The `options` have two time keys supported: `visibilityTimeout` and `messageTTL`; both are times in seconds (see Azure documentation). In addition `options` allow to override `json` setting per request.

### clearMessages(queue, [options], cb)

Removes messages from queue. The `queue` is queue name. The `cb` is a standard callback function.

### getMessages(queue, [options], cb)

Retrieves messages from queue. The `messageText` may be decoded to string (from bas64 if JSON is not used) or object (if was JSON encoded). The `options` have two main keys supported: `visibilityTimeout` (in seconds;see Azure documentation) and `maxMessages` (number of messages to retrieve; max is 32, default is 1). In addition `options` allow to override `json` setting per request.

The `data` in callback is always an array (even if there is no messages in queue). Each message may have below fields:

```
{
"messageId": "f00c98a4-1547-4d65-a5ea-ec233a85d7af",
"popReceipt": "sK52prNk0QgBAAAA",
"messageText": {}, // object or string depending on settings
"dequeueCount": integer, // number of gets without delete
"expirationTime": Date object
"insertionTime": Date object
"timeNextVisible": Date object
}
```

### peekMessages(queue, [options], cb)

Retrieves messages from queue. The `messageText` may be decoded to string (from bas64 if JSON is not used) or object (if was JSON encoded). The `options` supports `maxMessages` (number of messages to retrieve; max is 32, default is 1). In addition `options` allow to override `json` setting per request.

The `data` in callback is always an array (even if there is no messages in queue). Each message may have below fields:

```
{
"messageId": "f00c98a4-1547-4d65-a5ea-ec233a85d7af",
"messageText": {}, // object or string depending on settings
"dequeueCount": integer, // number of gets without delete
"expirationTime": Date object
"insertionTime": Date object
}
```

### updateMessage(queue, messageId, popReceipt, visibilityTimeout, message, [options], cb)

Updates `message` in `queue`. The `messageId` and `popReceipt` are values read using `getMessages()` or `popMessages()`. The `message` may be a base64 string (if JSON is not used) or object (it will be JSON encoded). The new `visibilityTimeout` is expressed in seconds (see Azure documentation). In addition `options` allow to override `json` setting per request.

The `data` object returned in callback contains new values of `timeNextVisible` (Date object) and `popReceipt`.

### deleteMessage(queue, messageId, popReceipt, [options], cb)

Removes `messageId` with `popReceipt` from `queue`. The `options` object is optional. The `data` in callback will always be undefined.


Running tests
=============

Run the tests using mocha from main project folder. But before that set the environment variable as some tests are relying on default:

```
set CLOUD_STORAGE_ACCOUNT=QueueEndpoint=http://127.0.0.1:10001/devstoreaccount1/;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==
mocha
```