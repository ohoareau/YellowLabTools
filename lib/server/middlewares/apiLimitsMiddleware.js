var config = (process.env.IS_TEST) ? require('../../../test/fixtures/settings.json') : require('../../../server_config/settings.json');

var debug = require('debug')('apiLimitsMiddleware');


var apiLimitsMiddleware = function(req, res, next) {
    'use strict';

    var ipAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    debug('Entering API Limits Middleware with IP address %s', ipAddress);

    if (req.path.indexOf('/api/') === 0 && !res.locals.hasApiKey) {
        
        
        // Monitoring requests
        if (req.path === '/api/runs' && req.method === 'GET') {
            next();
            return;
        }

        // New tests 
        if (req.path === '/api/runs' && req.method === 'POST') {
            
            if (!runsTable.accepts(ipAddress)) {
                // Sorry :/
                debug('Too many tests launched from IP address %s', ipAddress);
                res.status(429).send('Too many requests');
                return;
            }

        }

        // Every other calls
        if (!callsTable.accepts(ipAddress)) {
            // Sorry :/
            debug('Too many API requests from IP address %s', ipAddress);
            res.status(429).send('Too many requests');
            return;
        }

        debug('Not blocked by the API limits');
        // It's ok for the moment
    }

    next();
};


var RecordTable = function(maxPerDay) {
    var table = {};

    // Check if the user overpassed the limit and save its visit
    this.accepts = function(ipAddress) {
        if (table[ipAddress]) {
            
            this.cleanEntry(ipAddress);

            debug('%d visits in the last 24 hours', table[ipAddress].length);

            if (table[ipAddress].length >= maxPerDay) {
                return false;
            } else {
                table[ipAddress].push(Date.now());
            }

        } else {
            table[ipAddress] = [];
            table[ipAddress].push(Date.now());
        }

        return true;
    };

    // Clean the table for this guy
    this.cleanEntry = function(ipAddress) {
        table[ipAddress] = table[ipAddress].filter(function(date) {
            return date > Date.now() - 1000*60*60*24;
        });
    };

    // Clean the entire table once in a while
    this.removeOld = function() {
        for (var ipAddress in table) {
            this.cleanEntry(ipAddress);
        }
    };

};

// Init the records tables
var runsTable = new RecordTable(config.maxAnonymousRunsPerDay);
var callsTable = new RecordTable(config.maxAnonymousCallsPerDay);

module.exports = apiLimitsMiddleware;