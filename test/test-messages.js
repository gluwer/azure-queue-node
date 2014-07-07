/* jshint expr: true, quotmark: false */
/* globals it, describe, before, afterEach */
'use strict';

var expect = require('chai').expect;
var nock = require('nock');
var azureQueue = require('../index');

//nock.recorder.rec();

describe('default client', function() {
  var client;

  before(function(){
    client = azureQueue.getDefaultClient();
  });

  afterEach(function(){
    nock.cleanAll();
  });

  it('should put default json message in queue', function(done) {
    var azure = nock('http://127.0.0.1:10001')
      .post('/devstoreaccount1/testqueue/messages', '<QueueMessage><MessageText>{"value1":"ABCD&lt;EFG&amp;","value2":123}</MessageText></QueueMessage>')
      .reply(201, "", { 'transfer-encoding': 'chunked',
        server: 'Windows-Azure-Queue/1.0 Microsoft-HTTPAPI/2.0',
        'x-ms-request-id': '152019d0-2e7d-4582-8e35-6d54453c5b4e',
        'x-ms-version': '2014-02-14',
        date: 'Wed, 02 Jul 2014 13:22:13 GMT' });

    client.putMessage('testqueue', {
      value1: 'ABCD<EFG&',
      value2: 123
    }, function(err, data) {
      expect(err).to.be.null;
      expect(data).to.be.undefined;
      expect(azure.isDone()).to.be.true;

      done();
    });
  });

  it('should put string message in queue with time parameters', function(done) {
    var azure = nock('http://127.0.0.1:10001')
      .post('/devstoreaccount1/testqueue/messages?visibilitytimeout=5&messagettl=60', "<QueueMessage><MessageText>4pmpdXN0IHRlc3Rpbmcg4piR</MessageText></QueueMessage>")
      .reply(201, "", { 'transfer-encoding': 'chunked',
        server: 'Windows-Azure-Queue/1.0 Microsoft-HTTPAPI/2.0',
        'x-ms-request-id': 'd8bedef6-212f-459d-83c6-1c73c230980e',
        'x-ms-version': '2014-02-14',
        date: 'Thu, 03 Jul 2014 07:13:04 GMT' });

    client.putMessage('testqueue', '♩ust testing ☑', {
      json: false,
      visibilityTimeout: 5,
      messageTTL: 60
    }, function(err, data) {
      expect(err).to.be.null;
      expect(data).to.be.undefined;
      expect(azure.isDone()).to.be.true;

      done();
    });
  });

  it('should put JSON message in queue as base64 if forced to do so', function(done) {
    var azure = nock('http://127.0.0.1:10001')
      .post('/devstoreaccount1/testqueue/messages', "<QueueMessage><MessageText>eyJhYmMiOjF9</MessageText></QueueMessage>")
      .reply(201, "", { 'transfer-encoding': 'chunked',
        server: 'Windows-Azure-Queue/1.0 Microsoft-HTTPAPI/2.0',
        'x-ms-request-id': 'd8bedef6-212f-459d-83c6-1c73c230980e',
        'x-ms-version': '2014-02-14',
        date: 'Thu, 03 Jul 2014 07:13:04 GMT' });

    client.putMessage('testqueue', {abc:1}, {
      base64: true
    }, function(err, data) {
      expect(err).to.be.null;
      expect(data).to.be.undefined;
      expect(azure.isDone()).to.be.true;

      done();
    });
  });

  it('should return error when messageTTL is invalid', function(done) {
    var azure = nock('http://127.0.0.1:10001')
      .post('/devstoreaccount1/testqueue/messages?visibilitytimeout=60&messagettl=691200', "<QueueMessage><MessageText>[1,2,3]</MessageText></QueueMessage>")
      .reply(400, "﻿<?xml version=\"1.0\" encoding=\"utf-8\"?><Error><Code>OutOfRangeQueryParameterValue</Code><Message>One of the query parameters specified in the request URI is outside the permissible range.\nRequestId:d8e7b520-036a-4522-905e-2a390368d631\nTime:2014-07-03T07:15:15.3236342Z</Message><QueryParameterName>messagettl</QueryParameterName><QueryParameterValue>691200</QueryParameterValue><MinimumAllowed>1</MinimumAllowed><MaximumAllowed>604800</MaximumAllowed></Error>", { 'content-length': '461',
        'content-type': 'application/xml',
        server: 'Windows-Azure-Queue/1.0 Microsoft-HTTPAPI/2.0',
        'x-ms-request-id': 'd8e7b520-036a-4522-905e-2a390368d631',
        'x-ms-version': '2014-02-14',
        date: 'Thu, 03 Jul 2014 07:15:15 GMT' });

    client.putMessage('testqueue', [1,2,3], {
      json: true,
      visibilityTimeout: 60,
      messageTTL: 8*86400
    }, function(err, data) {
      expect(err).to.be.deep.equal({
        statusCode: 400,
        code: 'OutOfRangeQueryParameterValue',
        "body": {
          "code": "OutOfRangeQueryParameterValue",
          "maximumAllowed": "604800",
          "message": "One of the query parameters specified in the request URI is outside the permissible range.\nRequestId:d8e7b520-036a-4522-905e-2a390368d631\nTime:2014-07-03T07:15:15.3236342Z",
          "minimumAllowed": "1",
          "queryParameterName": "messagettl",
          "queryParameterValue": "691200"
        },
        "retriesMade": 0
      });
      expect(data).to.be.undefined;
      expect(azure.isDone()).to.be.true;

      done();
    });
  });

  it('should clear all messages in queue', function(done) {
    var azure = nock('http://127.0.0.1:10001')
      .delete('/devstoreaccount1/testqueue/messages')
      .reply(204, "", { 'content-length': '0',
        server: 'Windows-Azure-Queue/1.0 Microsoft-HTTPAPI/2.0',
        'x-ms-request-id': '80fa7f86-e7fa-42be-aecf-022411e3b097',
        'x-ms-version': '2014-02-14',
        date: 'Thu, 03 Jul 2014 07:35:45 GMT' });

    client.clearMessages('testqueue', function(err, data) {
      expect(err).to.be.null;
      expect(data).to.be.undefined;
      expect(azure.isDone()).to.be.true;

      done();
    });
  });

  it('should get no message from queue', function(done) {
    var azure = nock('http://127.0.0.1:10001')
      .get('/devstoreaccount1/testqueue/messages')
      .reply(200, "﻿<?xml version=\"1.0\" encoding=\"utf-8\"?><QueueMessagesList />", { 'cache-control': 'no-cache',
        'transfer-encoding': 'chunked',
        'content-type': 'application/xml',
        server: 'Windows-Azure-Queue/1.0 Microsoft-HTTPAPI/2.0',
        'x-ms-request-id': '4e03b48a-d58c-4d56-850e-d6ba778226c9',
        'x-ms-version': '2014-02-14',
        date: 'Thu, 03 Jul 2014 08:49:23 GMT' });

    client.getMessages('testqueue', function(err, data) {
      expect(err).to.be.null;
      expect(data).to.be.deep.equal([]);
      expect(azure.isDone()).to.be.true;

      done();
    });
  });

  it('should get one message from queue', function(done) {
    var azure = nock('http://127.0.0.1:10001')
      .get('/devstoreaccount1/testqueue/messages')
      .reply(200, "﻿<?xml version=\"1.0\" encoding=\"utf-8\"?><QueueMessagesList><QueueMessage><MessageId>f00c98a4-1547-4d65-a5ea-ec233a85d7af</MessageId><InsertionTime>Thu, 03 Jul 2014 08:54:30 GMT</InsertionTime><ExpirationTime>Thu, 10 Jul 2014 08:54:30 GMT</ExpirationTime><DequeueCount>1</DequeueCount><PopReceipt>sK52prNk0QgBAAAA</PopReceipt><TimeNextVisible>Thu, 03 Jul 2014 08:55:19 GMT</TimeNextVisible><MessageText>{\"value1\":\"ABCD&lt;EFG&amp;\",\"value2\":123}</MessageText></QueueMessage></QueueMessagesList>", { 'cache-control': 'no-cache',
        'transfer-encoding': 'chunked',
        'content-type': 'application/xml',
        server: 'Windows-Azure-Queue/1.0 Microsoft-HTTPAPI/2.0',
        'x-ms-request-id': '51e22df0-d77a-4c04-a5f9-0a8a0f885ca4',
        'x-ms-version': '2014-02-14',
        date: 'Thu, 03 Jul 2014 08:54:49 GMT' });

    client.getMessages('testqueue', function(err, data) {
      expect(err).to.be.null;
      expect(data).to.be.deep.equal([
        {
          "dequeueCount": 1,
          "expirationTime": new Date("Thu, 10 Jul 2014 08:54:30 GMT"),
          "insertionTime": new Date("Thu, 03 Jul 2014 08:54:30 GMT"),
          "messageId": "f00c98a4-1547-4d65-a5ea-ec233a85d7af",
          "messageText": {
            "value1": "ABCD<EFG&",
            "value2": 123
          },
          "popReceipt": "sK52prNk0QgBAAAA",
          "timeNextVisible": new Date("Thu, 03 Jul 2014 08:55:19 GMT")
        }
      ]);
      expect(azure.isDone()).to.be.true;

      done();
    });
  });

  it('should get two messages from queue using additional parameters', function(done) {
    var azure = nock('http://127.0.0.1:10001')
      .get('/devstoreaccount1/testqueue/messages?visibilitytimeout=5&numofmessages=32')
      .reply(200, "﻿<?xml version=\"1.0\" encoding=\"utf-8\"?><QueueMessagesList><QueueMessage><MessageId>f00c98a4-1547-4d65-a5ea-ec233a85d7af</MessageId><InsertionTime>Thu, 03 Jul 2014 08:54:30 GMT</InsertionTime><ExpirationTime>Thu, 10 Jul 2014 08:54:30 GMT</ExpirationTime><DequeueCount>3</DequeueCount><PopReceipt>UEko0r5k0QgDAAAA</PopReceipt><TimeNextVisible>Thu, 03 Jul 2014 10:15:16 GMT</TimeNextVisible><MessageText>{\"value1\":\"ABCD&lt;EFG&amp;\",\"value2\":123}</MessageText></QueueMessage><QueueMessage><MessageId>a6599b16-1565-46fc-b483-48395e4a877e</MessageId><InsertionTime>Thu, 03 Jul 2014 10:14:49 GMT</InsertionTime><ExpirationTime>Thu, 10 Jul 2014 10:14:49 GMT</ExpirationTime><DequeueCount>1</DequeueCount><PopReceipt>UEko0r5k0QgBAAAA</PopReceipt><TimeNextVisible>Thu, 03 Jul 2014 10:15:16 GMT</TimeNextVisible><MessageText>{\"test\":true}</MessageText></QueueMessage></QueueMessagesList>", { 'cache-control': 'no-cache',
        'transfer-encoding': 'chunked',
        'content-type': 'application/xml',
        server: 'Windows-Azure-Queue/1.0 Microsoft-HTTPAPI/2.0',
        'x-ms-request-id': 'f1213e62-b89e-43a8-9c42-3cb32d42cd0b',
        'x-ms-version': '2014-02-14',
        date: 'Thu, 03 Jul 2014 10:15:11 GMT' });

    client.getMessages('testqueue', {
      visibilityTimeout: 5,
      maxMessages: 32
    }, function(err, data) {
      expect(err).to.be.null;
      expect(data).to.be.deep.equal([
        {
          "dequeueCount": 3,
          "expirationTime": new Date('Thu, 10 Jul 2014 08:54:30 GMT'),
          "insertionTime": new Date('Thu, 03 Jul 2014 08:54:30 GMT'),
          "messageId": "f00c98a4-1547-4d65-a5ea-ec233a85d7af",
          "messageText": {
            "value1": "ABCD<EFG&",
            "value2": 123
          },
          "popReceipt": "UEko0r5k0QgDAAAA",
          "timeNextVisible": new Date('Thu, 03 Jul 2014 10:15:16 GMT')
        },
        {
          "dequeueCount": 1,
          "expirationTime": new Date('Thu, 10 Jul 2014 10:14:49 GMT'),
          "insertionTime": new Date('Thu, 03 Jul 2014 10:14:49 GMT'),
          "messageId": "a6599b16-1565-46fc-b483-48395e4a877e",
          "messageText": {
            "test": true
          },
          "popReceipt": "UEko0r5k0QgBAAAA",
          "timeNextVisible": new Date('Thu, 03 Jul 2014 10:15:16 GMT')
        }
      ]);
      expect(azure.isDone()).to.be.true;

      done();
    });
  });

  it('should get one message from queue with json=false', function(done) {
    var azure = nock('http://127.0.0.1:10001')
      .get('/devstoreaccount1/testqueue/messages')
      .reply(200, "﻿<?xml version=\"1.0\" encoding=\"utf-8\"?><QueueMessagesList><QueueMessage><MessageId>f00c98a4-1547-4d65-a5ea-ec233a85d7af</MessageId><InsertionTime>Thu, 03 Jul 2014 08:54:30 GMT</InsertionTime><ExpirationTime>Thu, 10 Jul 2014 08:54:30 GMT</ExpirationTime><DequeueCount>1</DequeueCount><PopReceipt>sK52prNk0QgBAAAA</PopReceipt><TimeNextVisible>Thu, 03 Jul 2014 08:55:19 GMT</TimeNextVisible><MessageText>4pmpdXN0IHRlc3Rpbmcg4piR</MessageText></QueueMessage></QueueMessagesList>", { 'cache-control': 'no-cache',
        'transfer-encoding': 'chunked',
        'content-type': 'application/xml',
        server: 'Windows-Azure-Queue/1.0 Microsoft-HTTPAPI/2.0',
        'x-ms-request-id': '51e22df0-d77a-4c04-a5f9-0a8a0f885ca4',
        'x-ms-version': '2014-02-14',
        date: 'Thu, 03 Jul 2014 08:54:49 GMT' });

    client.getMessages('testqueue', {json: false}, function(err, data) {
      expect(err).to.be.null;
      expect(data).to.be.deep.equal([
        {
          "dequeueCount": 1,
          "expirationTime": new Date("Thu, 10 Jul 2014 08:54:30 GMT"),
          "insertionTime": new Date("Thu, 03 Jul 2014 08:54:30 GMT"),
          "messageId": "f00c98a4-1547-4d65-a5ea-ec233a85d7af",
          "messageText": '♩ust testing ☑',
          "popReceipt": "sK52prNk0QgBAAAA",
          "timeNextVisible": new Date("Thu, 03 Jul 2014 08:55:19 GMT")
        }
      ]);
      expect(azure.isDone()).to.be.true;

      done();
    });
  });

  it('should get one message from queue with json=true but base64 encoded', function(done) {
    var azure = nock('http://127.0.0.1:10001')
      .get('/devstoreaccount1/testqueue/messages')
      .reply(200, "﻿<?xml version=\"1.0\" encoding=\"utf-8\"?><QueueMessagesList><QueueMessage><MessageId>f00c98a4-1547-4d65-a5ea-ec233a85d7af</MessageId><InsertionTime>Thu, 03 Jul 2014 08:54:30 GMT</InsertionTime><ExpirationTime>Thu, 10 Jul 2014 08:54:30 GMT</ExpirationTime><DequeueCount>1</DequeueCount><PopReceipt>sK52prNk0QgBAAAA</PopReceipt><TimeNextVisible>Thu, 03 Jul 2014 08:55:19 GMT</TimeNextVisible><MessageText>eyJhYmMiOjF9</MessageText></QueueMessage></QueueMessagesList>", { 'cache-control': 'no-cache',
        'transfer-encoding': 'chunked',
        'content-type': 'application/xml',
        server: 'Windows-Azure-Queue/1.0 Microsoft-HTTPAPI/2.0',
        'x-ms-request-id': '51e22df0-d77a-4c04-a5f9-0a8a0f885ca4',
        'x-ms-version': '2014-02-14',
        date: 'Thu, 03 Jul 2014 08:54:49 GMT' });

    client.getMessages('testqueue', {base64: true}, function(err, data) {
      expect(err).to.be.null;
      expect(data).to.be.deep.equal([
        {
          "dequeueCount": 1,
          "expirationTime": new Date("Thu, 10 Jul 2014 08:54:30 GMT"),
          "insertionTime": new Date("Thu, 03 Jul 2014 08:54:30 GMT"),
          "messageId": "f00c98a4-1547-4d65-a5ea-ec233a85d7af",
          "messageText": {abc:1},
          "popReceipt": "sK52prNk0QgBAAAA",
          "timeNextVisible": new Date("Thu, 03 Jul 2014 08:55:19 GMT")
        }
      ]);
      expect(azure.isDone()).to.be.true;

      done();
    });
  });

  it('should peek one message from queue', function(done) {
    var azure = nock('http://127.0.0.1:10001')
      .get('/devstoreaccount1/testqueue/messages?peekonly=true')
      .reply(200, "﻿<?xml version=\"1.0\" encoding=\"utf-8\"?><QueueMessagesList><QueueMessage><MessageId>a6599b16-1565-46fc-b483-48395e4a877e</MessageId><InsertionTime>Thu, 03 Jul 2014 10:14:49 GMT</InsertionTime><ExpirationTime>Thu, 10 Jul 2014 10:14:49 GMT</ExpirationTime><DequeueCount>1</DequeueCount><MessageText>{\"test\":true}</MessageText></QueueMessage></QueueMessagesList>", { 'cache-control': 'no-cache',
        'transfer-encoding': 'chunked',
        'content-type': 'application/xml',
        server: 'Windows-Azure-Queue/1.0 Microsoft-HTTPAPI/2.0',
        'x-ms-request-id': '06a8dd21-7014-4c71-b80d-7479788891cf',
        'x-ms-version': '2014-02-14',
        date: 'Thu, 03 Jul 2014 12:26:48 GMT' });

    client.peekMessages('testqueue', function(err, data) {
      expect(err).to.be.null;
      expect(data).to.be.deep.equal([
        {
          "dequeueCount": 1,
          "expirationTime": new Date("Thu, 10 Jul 2014 10:14:49 GMT"),
          "insertionTime": new Date("Thu, 03 Jul 2014 10:14:49 GMT"),
          "messageId": "a6599b16-1565-46fc-b483-48395e4a877e",
          "messageText": {
            "test": true
          }
        }
      ]);
      expect(azure.isDone()).to.be.true;

      done();
    });
  });

  it('should update message in queue', function(done) {
    var azure = nock('http://127.0.0.1:10001')
      .put('/devstoreaccount1/testqueue/messages/3b0127e4-72dd-4839-8444-44af7ec8532e?popreceipt=4JQ8aWll0QgBAAAA&visibilitytimeout=600', "<QueueMessage><MessageText>{\"value2\":125}</MessageText></QueueMessage>")
      .reply(204, "", { 'content-length': '0',
        server: 'Windows-Azure-Queue/1.0 Microsoft-HTTPAPI/2.0',
        'x-ms-request-id': 'e1a50159-d947-4f43-af48-d944cf6a9661',
        'x-ms-version': '2014-02-14',
        'x-ms-popreceipt': 'DKtBR2tl0QgBAAAA',
        'x-ms-time-next-visible': 'Fri, 04 Jul 2014 06:49:46 GMT',
        date: 'Fri, 04 Jul 2014 06:39:46 GMT' });

    client.updateMessage('testqueue', '3b0127e4-72dd-4839-8444-44af7ec8532e', '4JQ8aWll0QgBAAAA', 600, {
      value2: 125
    }, function(err, data) {
      expect(err).to.be.null;
      expect(data).to.be.deep.equal({
        popReceipt: 'DKtBR2tl0QgBAAAA',
        timeNextVisible: new Date('Fri, 04 Jul 2014 06:49:46 GMT')
      });
      expect(azure.isDone()).to.be.true;

      done();
    });
  });

  it('should return error when updating message in queue', function(done) {
    var azure = nock('http://127.0.0.1:10001')
      .put('/devstoreaccount1/testqueue/messages/3b0127e4-72dd-4839-8444-44af7ec8532e?popreceipt=5JQ8aWll0QgBAAAA&visibilitytimeout=600', "<QueueMessage><MessageText>{\"value2\":125}</MessageText></QueueMessage>")
      .reply(404, "﻿<?xml version=\"1.0\" encoding=\"utf-8\"?><Error><Code>MessageNotFound</Code><Message>The specified message does not exist.\nRequestId:dad4a129-2550-478d-8303-7f67a5452db7\nTime:2014-07-04T06:53:08.4328495Z</Message></Error>", { 'content-length': '221',
        'content-type': 'application/xml',
        server: 'Windows-Azure-Queue/1.0 Microsoft-HTTPAPI/2.0',
        'x-ms-request-id': 'dad4a129-2550-478d-8303-7f67a5452db7',
        'x-ms-version': '2014-02-14',
        date: 'Fri, 04 Jul 2014 06:53:08 GMT' });

    client.updateMessage('testqueue', '3b0127e4-72dd-4839-8444-44af7ec8532e', '5JQ8aWll0QgBAAAA', 600, {
      value2: 125
    }, function(err, data) {
      expect(err).to.be.deep.equal({
        statusCode: 404,
        "body": {
          "code": "MessageNotFound",
          "message": "The specified message does not exist.\nRequestId:dad4a129-2550-478d-8303-7f67a5452db7\nTime:2014-07-04T06:53:08.4328495Z"
        },
        "code": "MessageNotFound",
        "retriesMade": 0
      });
      expect(data).to.be.undefined;
      expect(azure.isDone()).to.be.true;

      done();
    });
  });

  it('should delete message from queue', function(done) {
    var azure = nock('http://127.0.0.1:10001')
      .delete('/devstoreaccount1/testqueue/messages/3b0127e4-72dd-4839-8444-44af7ec8532e?popreceipt=sGqEZXBl0QgCAAAA&timeout=15')
      .reply(204, "", { 'content-length': '0',
        server: 'Windows-Azure-Queue/1.0 Microsoft-HTTPAPI/2.0',
        'x-ms-request-id': 'f53bc13a-c6b7-45af-b4d8-6b79e1587af6',
        'x-ms-version': '2014-02-14',
        date: 'Fri, 04 Jul 2014 07:26:32 GMT' });

    client.deleteMessage('testqueue', '3b0127e4-72dd-4839-8444-44af7ec8532e', 'sGqEZXBl0QgCAAAA', {
      timeout: 15
    }, function(err, data) {
      expect(err).to.be.null;
      expect(data).to.be.undefined;
      expect(azure.isDone()).to.be.true;

      done();
    });
  });

  it('should return error when deleting message from queue', function(done) {
    var azure = nock('http://127.0.0.1:10001')
      .delete('/devstoreaccount1/testqueue/messages/3b0127e4-72dd-4839-8444-44af7ec8532e?popreceipt=4JQ8aWll0QgBAAAA&timeout=15')
      .reply(404, "﻿<?xml version=\"1.0\" encoding=\"utf-8\"?><Error><Code>MessageNotFound</Code><Message>The specified message does not exist.\nRequestId:534dec26-ab27-4813-a10d-f66807b393cc\nTime:2014-07-04T06:58:44.1052252Z</Message></Error>", { 'content-length': '221',
        'content-type': 'application/xml',
        server: 'Windows-Azure-Queue/1.0 Microsoft-HTTPAPI/2.0',
        'x-ms-request-id': '534dec26-ab27-4813-a10d-f66807b393cc',
        'x-ms-version': '2014-02-14',
        date: 'Fri, 04 Jul 2014 06:58:44 GMT' });

    client.deleteMessage('testqueue', '3b0127e4-72dd-4839-8444-44af7ec8532e', '4JQ8aWll0QgBAAAA', {
      timeout: 15
    }, function(err, data) {
      expect(err).to.be.deep.equal({
        statusCode: 404,
        "body": {
          "code": "MessageNotFound",
          "message": "The specified message does not exist.\nRequestId:534dec26-ab27-4813-a10d-f66807b393cc\nTime:2014-07-04T06:58:44.1052252Z"
        },
        "code": "MessageNotFound",
        "retriesMade": 0
      });
      expect(data).to.be.undefined;
      expect(azure.isDone()).to.be.true;

      done();
    });
  });
});
