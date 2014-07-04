/* jshint expr: true */
/* globals it, describe */
'use strict';

var expect = require('chai').expect;

describe('default client', function() {
  it('should be created with storage account settings', function() {
    var azureQueue = require('../index');
    var defaultClient = azureQueue.getDefaultClient();

    expect(defaultClient).to.be.an('object');

    var settings = defaultClient.getSettings();
    expect(settings).to.have.property('accountUrl', 'http://127.0.0.1:10001/devstoreaccount1/');
    expect(settings).to.have.property('accountName', 'devstoreaccount1');
    expect(settings).to.have.property('accountKey', 'Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==');
    expect(settings).to.have.property('timeout', 30000);
  });

  it('should allow to create new default client with overridden settings', function() {
    var azureQueue = require('../index');
    var newDefaultClient = azureQueue.setDefaultClient({
      timeout: 15000,
      aSetting: 'HELLO',
      accountName: 'zebra'
    });

    expect(newDefaultClient).to.be.an('object');

    var settings = newDefaultClient.getSettings();
    expect(settings).to.have.property('accountUrl', 'http://127.0.0.1:10001/devstoreaccount1/');
    expect(settings).to.have.property('accountName', 'zebra');
    expect(settings).to.have.property('accountKey', 'Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==');
    expect(settings).to.have.property('timeout', 15000);
    expect(settings).to.have.property('aSetting', 'HELLO');

    azureQueue.setDefaultClient({
      timeout: 30000,
      aSetting: null,
      accountName: 'dummy'
    });
  });

  it('should use default client as singleton', function() {
    var azureQueue = require('../index');
    var defaultClient1 = azureQueue.getDefaultClient();
    var defaultClient2 = azureQueue.getDefaultClient();

    expect(defaultClient1).to.equal(defaultClient2);
  });

});
