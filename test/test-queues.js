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

  it('should create testqueue queue using required headers', function(done) {
    var azure = nock('http://127.0.0.1:10001')
      .matchHeader('x-ms-version', '2014-02-14')
      .matchHeader('authorization', /SharedKey/i)
      .matchHeader('x-ms-date', / \d\d:\d\d:\d\d /)
      .put('/devstoreaccount1/testqueue')
      .reply(201, "", { 'transfer-encoding': 'chunked',
        server: 'Windows-Azure-Queue/1.0 Microsoft-HTTPAPI/2.0',
        'x-ms-request-id': '34ecf932-5706-43ca-83a9-eecdce111c3f',
        'x-ms-version': '2014-02-14',
        date: 'Wed, 02 Jul 2014 09:08:07 GMT' });

    client.createQueue('testqueue', function(err, data) {
      expect(err).to.be.null;
      expect(data).to.be.true;
      expect(azure.isDone()).to.be.true;

      done();
    });
  });

  it('should not return error when testqueue is already created', function(done) {
    var azure = nock('http://127.0.0.1:10001')
      .put('/devstoreaccount1/testqueue')
      .reply(204, "", { 'content-length': '0',
        server: 'Windows-Azure-Queue/1.0 Microsoft-HTTPAPI/2.0',
        'x-ms-request-id': 'ae05573d-dc7a-41de-8695-171fe8b3618e',
        'x-ms-version': '2014-02-14',
        date: 'Wed, 02 Jul 2014 09:35:47 GMT' });

    client.createQueue('testqueue', function(err, data) {
      expect(err).to.be.null;
      expect(data).to.be.false;
      expect(azure.isDone()).to.be.true;

      done();
    });
  });

  it('should return a list of queues without any additions', function(done) {
    var azure = nock('http://127.0.0.1:10001')
      .get('/devstoreaccount1/?comp=list')
      .reply(200, "﻿<?xml version=\"1.0\" encoding=\"utf-8\"?><EnumerationResults ServiceEndpoint=\"http://127.0.0.1:10001/devstoreaccount1/\"><Queues><Queue><Name>aqueue1</Name></Queue><Queue><Name>aqueue2</Name></Queue><Queue><Name>testqueue</Name></Queue></Queues><NextMarker /></EnumerationResults>", { 'cache-control': 'no-cache',
        'transfer-encoding': 'chunked',
        'content-type': 'application/xml',
        server: 'Windows-Azure-Queue/1.0 Microsoft-HTTPAPI/2.0',
        'x-ms-request-id': '26fe5ecf-09f6-47ef-ae36-38f9d00c5b51',
        'x-ms-version': '2014-02-14',
        date: 'Wed, 02 Jul 2014 10:25:02 GMT' });

    client.listQueues(function(err, data, marker) {
      expect(err).to.be.null;
      expect(data).to.be.deep.equal(['aqueue1', 'aqueue2', 'testqueue']);
      expect(marker).to.be.undefined;
      expect(azure.isDone()).to.be.true;

      done();
    });
  });

  it('should return a list of queues with marker using maxResults and prefix', function(done) {
    var azure = nock('http://127.0.0.1:10001')
      .get('/devstoreaccount1/?comp=list&prefix=aq&maxresults=1')
      .reply(200, "﻿<?xml version=\"1.0\" encoding=\"utf-8\"?><EnumerationResults ServiceEndpoint=\"http://127.0.0.1:10001/devstoreaccount1/\"><Prefix>aq</Prefix><MaxResults>1</MaxResults><Queues><Queue><Name>aqueue1</Name></Queue></Queues><NextMarker>aqueue2</NextMarker></EnumerationResults>", { 'cache-control': 'no-cache',
        'transfer-encoding': 'chunked',
        'content-type': 'application/xml',
        server: 'Windows-Azure-Queue/1.0 Microsoft-HTTPAPI/2.0',
        'x-ms-request-id': '984f3644-4010-4b2b-8f50-b5c063deb029',
        'x-ms-version': '2014-02-14',
        date: 'Wed, 02 Jul 2014 10:18:10 GMT' });

    client.listQueues({
      prefix: 'aq',
      maxResults: 1
    }, function(err, data, marker) {
      expect(err).to.be.null;
      expect(data).to.be.an.array;
      expect(data).to.have.length(1);
      expect(data[0]).to.be.equal('aqueue1');
      expect(marker).to.be.equal('aqueue2');
      expect(azure.isDone()).to.be.true;

      done();
    });
  });

  it('should return a list using marker and timeout', function(done) {
    var azure = nock('http://127.0.0.1:10001')
      .get('/devstoreaccount1/?comp=list&marker=aqueue2&timeout=10')
      .reply(200, "﻿<?xml version=\"1.0\" encoding=\"utf-8\"?><EnumerationResults ServiceEndpoint=\"http://127.0.0.1:10001/devstoreaccount1/\"><Marker>aqueue2</Marker><Queues><Queue><Name>aqueue2</Name></Queue><Queue><Name>testqueue</Name></Queue></Queues><NextMarker /></EnumerationResults>", { 'cache-control': 'no-cache',
        'transfer-encoding': 'chunked',
        'content-type': 'application/xml',
        server: 'Windows-Azure-Queue/1.0 Microsoft-HTTPAPI/2.0',
        'x-ms-request-id': '73f28ca9-ad77-4f1f-be3b-a449e45d13ae',
        'x-ms-version': '2014-02-14',
        date: 'Wed, 02 Jul 2014 11:12:10 GMT' });

    client.listQueues({
      marker: 'aqueue2',
      timeout: 10
    }, function(err, data, marker) {
      expect(err).to.be.null;
      expect(data).to.be.deep.equal(['aqueue2', 'testqueue']);
      expect(marker).to.be.undefined;
      expect(azure.isDone()).to.be.true;

      done();
    });
  });

  it('should return empty list of there is no queues with prefix', function(done) {
    var azure = nock('http://127.0.0.1:10001')
      .get('/devstoreaccount1/?comp=list&prefix=zebra')
      .reply(200, "﻿<?xml version=\"1.0\" encoding=\"utf-8\"?><EnumerationResults ServiceEndpoint=\"http://127.0.0.1:10001/devstoreaccount1/\"><Prefix>zebra</Prefix><Queues /><NextMarker /></EnumerationResults>", { 'cache-control': 'no-cache',
        'transfer-encoding': 'chunked',
        'content-type': 'application/xml',
        server: 'Windows-Azure-Queue/1.0 Microsoft-HTTPAPI/2.0',
        'x-ms-request-id': '8d5fcc72-2300-4278-9a17-7131003b0bd4',
        'x-ms-version': '2014-02-14',
        date: 'Wed, 02 Jul 2014 11:15:37 GMT' });

    client.listQueues({
      prefix: 'zebra'
    }, function(err, data, marker) {
      expect(err).to.be.null;
      expect(data).to.be.deep.equal([]);
      expect(marker).to.be.undefined;
      expect(azure.isDone()).to.be.true;

      done();
    });
  });

  it('should remove queue without errors', function(done) {
    var azure = nock('http://127.0.0.1:10001')
      .delete('/devstoreaccount1/aqueue1')
      .reply(204, "", { 'content-length': '0',
        server: 'Windows-Azure-Queue/1.0 Microsoft-HTTPAPI/2.0',
        'x-ms-request-id': 'cbb400e2-2cb4-4e84-a21f-e0761732514b',
        'x-ms-version': '2014-02-14',
        date: 'Wed, 02 Jul 2014 11:44:05 GMT' });

    client.deleteQueue('aqueue1', function(err, data) {
      expect(err).to.be.null;
      expect(data).to.be.undefined;

      expect(azure.isDone()).to.be.true;

      done();
    });
  });

  it('should return error if queue is removed', function(done) {
    var azure = nock('http://127.0.0.1:10001')
      .delete('/devstoreaccount1/aqueue1')
      .reply(404, "﻿<?xml version=\"1.0\" encoding=\"utf-8\"?><Error><Code>QueueNotFound</Code><Message>The specified queue does not exist.\nRequestId:052e5b46-2117-43d3-a33c-ce296adb7a72\nTime:2014-07-02T11:53:02.7276220Z</Message></Error>", { 'content-length': '217',
        'content-type': 'application/xml',
        server: 'Windows-Azure-Queue/1.0 Microsoft-HTTPAPI/2.0',
        'x-ms-request-id': '052e5b46-2117-43d3-a33c-ce296adb7a72',
        'x-ms-version': '2014-02-14',
        date: 'Wed, 02 Jul 2014 11:53:02 GMT' });

    client.deleteQueue('aqueue1', function(err, data) {
      expect(err).to.not.be.null;
      expect(data).to.be.undefined;
      expect(azure.isDone()).to.be.true;

      expect(err).to.have.property('statusCode', 404);
      expect(err).to.have.property('code', 'QueueNotFound');

      done();
    });
  });

  it('should return approximate queue length', function(done) {
    var azure = nock('http://127.0.0.1:10001')
      .head('/devstoreaccount1/testqueue?comp=metadata')
      .reply(200, "", { 'content-length': '0',
        server: 'Windows-Azure-Queue/1.0 Microsoft-HTTPAPI/2.0',
        'x-ms-request-id': 'cbb400e2-2cb4-4e84-a21f-e0761732514b',
        'x-ms-version': '2014-02-14',
        'x-ms-approximate-messages-count': '5',
        date: 'Wed, 02 Jul 2014 11:44:05 GMT' });

    client.countMessages('testqueue', function(err, data) {
      expect(err).to.be.null;
      expect(data).to.be.equal(5);
      expect(azure.isDone()).to.be.true;

      done();
    });
  });

});