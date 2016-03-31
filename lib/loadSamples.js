'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.loadSamples = loadSamples;

var _loadSample = require('./loadSample');

function loadSamples(urls) {
    return Promise.all(urls.map(function (soundURL) {
        return (0, _loadSample.loadSample)(soundURL);
    }));
}