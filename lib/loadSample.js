'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.loadSample = loadSample;
var wavesAudio = require('waves-audio');
var audioContext = wavesAudio.audioContext;

function loadSample(url) {
    return new Promise(function (resolve, reject) {
        fetch(url).then(function (response) {
            return response.arrayBuffer();
        }).then(function (buffer) {
            audioContext.decodeAudioData(buffer, function (decodedAudioData) {
                resolve(decodedAudioData);
            });
        });
    });
};