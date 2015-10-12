'use strict';

var _Promise = require('babel-runtime/core-js/promise')['default'];

Object.defineProperty(exports, '__esModule', {
    value: true
});
exports.loadSample = loadSample;

var wavesAudio = require('waves-audio');
var audioContext = wavesAudio.audioContext;

function loadSample(url) {
    return new _Promise(function (resolve, reject) {
        fetch(url).then(function (response) {
            return response.arrayBuffer();
        }).then(function (buffer) {
            audioContext.decodeAudioData(buffer, function (decodedAudioData) {
                resolve(decodedAudioData);
            });
        });
    });
}

;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImVzNi9TeW5jU2VydmVyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7OztBQUNBLElBQUksVUFBVSxHQUFHLE9BQU8sQ0FBQyxhQUFhLENBQUMsQ0FBQztBQUN4QyxJQUFJLFlBQVksR0FBRyxVQUFVLENBQUMsWUFBWSxDQUFDOztBQUVwQyxTQUFTLFVBQVUsQ0FBQyxHQUFHLEVBQUM7QUFDM0IsV0FBTyxhQUFZLFVBQVMsT0FBTyxFQUFFLE1BQU0sRUFBQztBQUN4QyxhQUFLLENBQUMsR0FBRyxDQUFDLENBQ1QsSUFBSSxDQUFDLFVBQUMsUUFBUSxFQUFLO0FBQ2hCLG1CQUFPLFFBQVEsQ0FBQyxXQUFXLEVBQUUsQ0FBQTtTQUNoQyxDQUFDLENBQ0QsSUFBSSxDQUFDLFVBQUMsTUFBTSxFQUFJO0FBQ2Isd0JBQVksQ0FBQyxlQUFlLENBQUMsTUFBTSxFQUFFLFVBQUMsZ0JBQWdCLEVBQUs7QUFDdkQsdUJBQU8sQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO2FBQzdCLENBQUMsQ0FBQTtTQUNMLENBQUMsQ0FBQztLQUNOLENBQUMsQ0FBQTtDQUNMOztBQUFBLENBQUMiLCJmaWxlIjoiZXM2L1N5bmNTZXJ2ZXIuanMiLCJzb3VyY2VzQ29udGVudCI6WyJcbnZhciB3YXZlc0F1ZGlvID0gcmVxdWlyZSgnd2F2ZXMtYXVkaW8nKTtcbnZhciBhdWRpb0NvbnRleHQgPSB3YXZlc0F1ZGlvLmF1ZGlvQ29udGV4dDtcblxuZXhwb3J0IGZ1bmN0aW9uIGxvYWRTYW1wbGUodXJsKXtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KXtcbiAgICAgICAgZmV0Y2godXJsKVxuICAgICAgICAudGhlbigocmVzcG9uc2UpID0+IHtcbiAgICAgICAgICAgIHJldHVybiByZXNwb25zZS5hcnJheUJ1ZmZlcigpXG4gICAgICAgIH0pXG4gICAgICAgIC50aGVuKChidWZmZXIpID0+e1xuICAgICAgICAgICAgYXVkaW9Db250ZXh0LmRlY29kZUF1ZGlvRGF0YShidWZmZXIsIChkZWNvZGVkQXVkaW9EYXRhKSA9PiB7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZShkZWNvZGVkQXVkaW9EYXRhKTtcbiAgICAgICAgICAgIH0pXG4gICAgICAgIH0pO1xuICAgIH0pXG59O1xuIl19