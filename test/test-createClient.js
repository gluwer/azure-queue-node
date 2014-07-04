/* jshint expr: true */
/* globals it, describe */
'use strict';

var expect = require('chai').expect;
var azureQueue = require('../index');

describe('create client', function() {
  it('should throw exception if account settings are not set up and created client doesn\'t define them', function() {
    function creatingClient() {
      azureQueue.createClient({
        accountUrl: null
      });
    }

    expect(creatingClient).to.throw('Provide accountUrl, accountName, and accountKey in settings or in env CLOUD_STORAGE_ACCOUNT');
  });

  it('should create client with additional settings and not override default settings', function() {
    var newClient = azureQueue.createClient({
      accountUrl: 'http://dummy.queue.core.windows.net/',
      accountName: 'dummy',
      accountKey: 'XUpVW5efmPDA42r4VY/86bt9k+smnhdEFVRRGrrt/wE0SmFg=='
    });

    expect(newClient).to.be.an('object');

    var settings = newClient.getSettings();

    expect(settings).to.have.property('accountUrl', 'http://dummy.queue.core.windows.net/');
    expect(settings).to.have.property('accountName', 'dummy');
    expect(settings).to.have.property('accountKey', 'XUpVW5efmPDA42r4VY/86bt9k+smnhdEFVRRGrrt/wE0SmFg==');
    expect(settings).to.have.property('timeout', 30000);
  });

  it('should create client with overridden default settings', function() {
    var newClient = azureQueue.createClient({
      accountUrl: 'https://dummy.queue.core.windows.net/',
      accountName: 'dummy',
      accountKey: 'XUpVW5efmPDA42r4VY/86bt9k+smnhdEFVRRGrrt/wE0SmFg==',
      timeout: 15000
    });

    expect(newClient).to.be.an('object');

    var settings = newClient.getSettings();

    expect(settings).to.have.property('accountUrl', 'https://dummy.queue.core.windows.net/');
    expect(settings).to.have.property('accountName', 'dummy');
    expect(settings).to.have.property('accountKey', 'XUpVW5efmPDA42r4VY/86bt9k+smnhdEFVRRGrrt/wE0SmFg==');
    expect(settings).to.have.property('timeout', 15000);
  });

  it('should create client based on other client', function() {
    var baseClient = azureQueue.createClient({
      accountUrl: 'http://dummy.queue.core.windows.net/',
      accountName: 'dummy',
      accountKey: 'XUpVW5efmPDA42r4VY/86bt9k+smnhdEFVRRGrrt/wE0SmFg=='
    });

    var newClient = azureQueue.createClient({
      timeout: 15000
    }, baseClient);

    var settings = newClient.getSettings();

    expect(settings).to.have.property('accountUrl', 'http://dummy.queue.core.windows.net/');
    expect(settings).to.have.property('accountName', 'dummy');
    expect(settings).to.have.property('accountKey', 'XUpVW5efmPDA42r4VY/86bt9k+smnhdEFVRRGrrt/wE0SmFg==');
    expect(settings).to.have.property('timeout', 15000);
  });
});