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
    client = azureQueue.setDefaultClient({
      retry: {
        firstDelay: 100 // normal delay would be too long to wait
      }
    });
  });

  afterEach(function(){
    nock.cleanAll();
  });

  it('should retry the create testqueue when receiving error', function(done) {
    var azure = nock('http://127.0.0.1:10001')
      .put('/devstoreaccount1/testqueue2')
      .reply(500, '<?xml version="1.0" encoding="utf-8"?><Error><Code>OutOfRangeQueryParameterValue</Code><Message>SomeError</Message></Error>', { 'transfer-encoding': 'chunked',
        server: 'Windows-Azure-Queue/1.0 Microsoft-HTTPAPI/2.0',
        'x-ms-request-id': '34ecf932-5706-43ca-83a9-eecdce111c3f',
        'x-ms-version': '2014-02-14',
        date: 'Wed, 02 Jul 2014 09:08:07 GMT' })
      .put('/devstoreaccount1/testqueue2')
      .reply(412, '<?xml version="1.0" encoding="utf-8"?><Error><Code>ETIMEDOUT</Code><Message>SomeError2</Message></Error>', { 'transfer-encoding': 'chunked',
        server: 'Windows-Azure-Queue/1.0 Microsoft-HTTPAPI/2.0',
        'x-ms-request-id': '34ecf932-5706-43ca-83a9-eecdce111c3f',
        'x-ms-version': '2014-02-14',
        date: 'Wed, 02 Jul 2014 09:08:07 GMT' })
      .put('/devstoreaccount1/testqueue2')
      .reply(201, "", { 'transfer-encoding': 'chunked',
        server: 'Windows-Azure-Queue/1.0 Microsoft-HTTPAPI/2.0',
        'x-ms-request-id': '34ecf932-5706-43ca-83a9-eecdce111c3f',
        'x-ms-version': '2014-02-14',
        date: 'Wed, 02 Jul 2014 09:08:07 GMT' });

    client.createQueue('testqueue2', function(err, data) {
      expect(err).to.be.null;
      expect(data).to.be.true;
      expect(azure.isDone()).to.be.true;

      done();
    });
  });

  it('should return error when all retries are erroring', function(done) {
    var azure = nock('http://127.0.0.1:10001')
      .put('/devstoreaccount1/testqueue2')
      .reply(501, '<?xml version="1.0" encoding="utf-8"?><Error><Code>Error</Code><Message>SomeError</Message></Error>', { 'transfer-encoding': 'chunked',
        server: 'Windows-Azure-Queue/1.0 Microsoft-HTTPAPI/2.0',
        'x-ms-request-id': '34ecf932-5706-43ca-83a9-eecdce111c3f',
        'x-ms-version': '2014-02-14',
        date: 'Wed, 02 Jul 2014 09:08:07 GMT' })
      .put('/devstoreaccount1/testqueue2')
      .reply(412, '<?xml version="1.0" encoding="utf-8"?><Error><Code>EADDRINUSE</Code><Message>SomeError</Message></Error>', { 'transfer-encoding': 'chunked',
        server: 'Windows-Azure-Queue/1.0 Microsoft-HTTPAPI/2.0',
        'x-ms-request-id': '34ecf932-5706-43ca-83a9-eecdce111c3f',
        'x-ms-version': '2014-02-14',
        date: 'Wed, 02 Jul 2014 09:08:07 GMT' })
      .put('/devstoreaccount1/testqueue2')
      .reply(503, '<?xml version="1.0" encoding="utf-8"?><Error><Code>OtherError</Code><Message>SomeError</Message></Error>', { 'transfer-encoding': 'chunked',
        server: 'Windows-Azure-Queue/1.0 Microsoft-HTTPAPI/2.0',
        'x-ms-request-id': '34ecf932-5706-43ca-83a9-eecdce111c3f',
        'x-ms-version': '2014-02-14',
        date: 'Wed, 02 Jul 2014 09:08:07 GMT' })
      .put('/devstoreaccount1/testqueue2')
      .reply(400, '<?xml version="1.0" encoding="utf-8"?><Error><Code>ECONNRESET</Code><Message>SomeError</Message></Error>', { 'transfer-encoding': 'chunked',
        server: 'Windows-Azure-Queue/1.0 Microsoft-HTTPAPI/2.0',
        'x-ms-request-id': '34ecf932-5706-43ca-83a9-eecdce111c3f',
        'x-ms-version': '2014-02-14',
        date: 'Wed, 02 Jul 2014 09:08:07 GMT' });

    client.createQueue('testqueue2', function(err, data) {
      expect(err).to.not.be.null;
      expect(err.retriesMade).to.be.equal(3);
      expect(data).to.be.undefined;
      expect(azure.isDone()).to.be.true;

      done();
    });
  });
});

describe('client with retry disabled', function() {
  var client;

  before(function(){
    client = azureQueue.createClient({
      retry: false
    });
  });

  afterEach(function(){
    nock.cleanAll();
  });

  it('should return error to requester after first error', function(done) {
    var azure = nock('http://127.0.0.1:10001')
      .put('/devstoreaccount1/testqueue2')
      .reply(503, '<?xml version="1.0" encoding="utf-8"?><Error><Code>Error</Code><Message>SomeError</Message></Error>', { 'transfer-encoding': 'chunked',
        server: 'Windows-Azure-Queue/1.0 Microsoft-HTTPAPI/2.0',
        'x-ms-request-id': '34ecf932-5706-43ca-83a9-eecdce111c3f',
        'x-ms-version': '2014-02-14',
        date: 'Wed, 02 Jul 2014 09:08:07 GMT' });

    client.createQueue('testqueue2', function(err, data) {
      expect(err).to.not.be.null;
      expect(data).to.be.undefined;
      expect(azure.isDone()).to.be.true;

      done();
    });
  });
});

describe('client with custom retry options', function() {
  var client;

  before(function(){
    client = azureQueue.createClient({
      retry: {
        retries: 1,
        firstDelay: 50,
        nextDelayMult: 1,
        variability:  0,
        transientErrors: [502]
      }
    });
  });

  afterEach(function(){
    nock.cleanAll();
  });

  it('should return error immediately if it is not a transient one', function(done) {
    var azure = nock('http://127.0.0.1:10001')
      .put('/devstoreaccount1/testqueue2')
      .reply(503, '<?xml version="1.0" encoding="utf-8"?><Error><Code>Error</Code><Message>SomeError</Message></Error>', { 'transfer-encoding': 'chunked',
        server: 'Windows-Azure-Queue/1.0 Microsoft-HTTPAPI/2.0',
        'x-ms-request-id': '34ecf932-5706-43ca-83a9-eecdce111c3f',
        'x-ms-version': '2014-02-14',
        date: 'Wed, 02 Jul 2014 09:08:07 GMT' });

    client.createQueue('testqueue2', function(err, data) {
      expect(err).to.not.be.null;
      expect(data).to.be.undefined;
      expect(azure.isDone()).to.be.true;

      done();
    });
  });

  it('should make only one retry', function(done) {
    var azure = nock('http://127.0.0.1:10001')
      .put('/devstoreaccount1/testqueue2')
      .reply(502, '<?xml version="1.0" encoding="utf-8"?><Error><Code>Error</Code><Message>SomeError</Message></Error>', { 'transfer-encoding': 'chunked',
        server: 'Windows-Azure-Queue/1.0 Microsoft-HTTPAPI/2.0',
        'x-ms-request-id': '34ecf932-5706-43ca-83a9-eecdce111c3f',
        'x-ms-version': '2014-02-14',
        date: 'Wed, 02 Jul 2014 09:08:07 GMT' })
      .put('/devstoreaccount1/testqueue2')
      .reply(502, '<?xml version="1.0" encoding="utf-8"?><Error><Code>Error2</Code><Message>SomeError</Message></Error>', { 'transfer-encoding': 'chunked',
        server: 'Windows-Azure-Queue/1.0 Microsoft-HTTPAPI/2.0',
        'x-ms-request-id': '34ecf932-5706-43ca-83a9-eecdce111c3f',
        'x-ms-version': '2014-02-14',
        date: 'Wed, 02 Jul 2014 09:08:07 GMT' })

    client.createQueue('testqueue2', function(err, data) {
      expect(err).to.not.be.null;
      expect(err).to.have.property('code', 'Error2');
      expect(err).to.have.property('retriesMade', 1);
      expect(data).to.be.undefined;
      expect(azure.isDone()).to.be.true;

      done();
    });
  });

  it('should start counting retries again in next request', function(done) {
    var azure = nock('http://127.0.0.1:10001')
      .put('/devstoreaccount1/testqueue2')
      .reply(502, '<?xml version="1.0" encoding="utf-8"?><Error><Code>Error</Code><Message>SomeError</Message></Error>', { 'transfer-encoding': 'chunked',
        server: 'Windows-Azure-Queue/1.0 Microsoft-HTTPAPI/2.0',
        'x-ms-request-id': '34ecf932-5706-43ca-83a9-eecdce111c3f',
        'x-ms-version': '2014-02-14',
        date: 'Wed, 02 Jul 2014 09:08:07 GMT' })
      .put('/devstoreaccount1/testqueue2')
      .reply(502, '<?xml version="1.0" encoding="utf-8"?><Error><Code>Error2</Code><Message>SomeError</Message></Error>', { 'transfer-encoding': 'chunked',
        server: 'Windows-Azure-Queue/1.0 Microsoft-HTTPAPI/2.0',
        'x-ms-request-id': '34ecf932-5706-43ca-83a9-eecdce111c3f',
        'x-ms-version': '2014-02-14',
        date: 'Wed, 02 Jul 2014 09:08:07 GMT' })

    client.createQueue('testqueue2', function(err, data) {
      expect(err).to.not.be.null;
      expect(err).to.have.property('code', 'Error2');
      expect(err).to.have.property('retriesMade', 1);
      expect(data).to.be.undefined;
      expect(azure.isDone()).to.be.true;

      done();
    });
  });
});