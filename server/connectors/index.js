/**
 * Connector Registry
 * Central registry mapping integration types to their connector modules.
 */

const quickbooks = require('./quickbooks');
const salesforce = require('./salesforce');
const google = require('./google');
const microsoft365 = require('./microsoft365');
const procore = require('./procore');

const connectors = {
  quickbooks,
  salesforce,
  google,
  microsoft365,
  procore
};

function getConnector(type) {
  return connectors[type] || null;
}

module.exports = { getConnector, connectors };
