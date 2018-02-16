'use strict';

const utilLib = require('util');

var assert = require('assert');
var _ = require('lodash');
var Promise = require('bluebird');

var util = require('../util');

exports.deletions = [];

var specSources = {
  'googleapis.com': require('./google'),
  'azure.com': require('./azure'),
  'microsoft.com': require('./azure'),
  'windows.net': require('./azure'),
  'nytimes.com': require('./ny_times'),
  'swaggerhub.com': require('./swaggerhub'),
  'apitore.com': require('./apitore'),
  'gov.bc.ca': require('./bcgov'),
  'bclaws.ca': require('./bcgov'),
  'box.com': require('./box')
};
var catalogProviders = _.keys(specSources);

var blackListedUrls = util.readYaml(__dirname + '/blacklist.yaml');

exports.getLeads = function (specs) {
  var specsByProvider = _(specs).values()
    .groupBy(swagger => swagger.info['x-providerName']).value();

  var urlLeads = _(specsByProvider).omit(catalogProviders)
    .values().flatten()
    .map(swagger => ({
      info: {
	  	'version': swagger.info.version,
        'x-providerName': util.getProviderName(swagger),
        'x-serviceName': util.getServiceName(swagger),
        'x-origin': util.getOrigin(swagger)
      }
    })).value();

  var usedCatalogs = _(specsByProvider).keys().intersection(catalogProviders).value();
  return exports.getCatalogsLeads(usedCatalogs)
    .then(catalogLeads => {
      var leads = _(catalogLeads).values().concat(urlLeads).value();
      leads = indexByOriginUrl(leads);

	  // add new catalog leads (MER)
	  //for (var l in leads) {
	  //	var lead = leads[l];
	  //	var filename = util.getSwaggerPath(lead);
		//  if (!specs[filename]) { // we should compare on origin url
		//    console.log('!!! Adding ' + filename);
	  //	  specs[filename] = lead;
		//  }
	  //}

      return _(specs).mapValues((swagger, filename) => {
        var lead = leads[util.getOriginUrl(swagger)];
		if (!lead) exports.deletions.push(filename);
        //assert(lead, '!!! Delete ' + filename);
        return lead;
      }).value();
    })
}

exports.getCatalogsLeads = function (providers = catalogProviders) {
  var promises = _(specSources)
    .pick(providers).values().uniq()
    .map(func => func()).value();

  return Promise.all(promises)
    .then(function (catalogsLeads) {
      var allLeads = _.flatten(catalogsLeads);
      return _.omit(indexByOriginUrl(allLeads), blackListedUrls);
    });
}

function indexByOriginUrl(leads) {
  return _(leads)
    .groupBy(util.getOriginUrl)
    .mapValues(function (array, url) {
      assert(_.size(array) === 1, `Duplicate leads for "${url}" URL. `+utilLib.inspect(array));
      return array[0];
    }).value();
}
