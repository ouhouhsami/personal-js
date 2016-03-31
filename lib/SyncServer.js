'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * @fileoverview Server-side syncronization component
 * @author Jean-Philippe.Lambert@ircam.fr, Sebastien.Robaszkiewicz@ircam.fr,
 *         Norbert.Schnell@ircam.fr
 */

//const debug = require('debug')('soundworks:sync');

var SyncServer = exports.SyncServer = function () {
  /**
   * @callback SyncServer~getTimeFunction
   * @return {Number} monotonic, ever increasing, time in second.
   **/

  /**
   * @callback SyncServer~sendFunction
   * @see {@linkcode SyncClient~receiveFunction}
   * @param {String} messageType identification of pong message type
   * @param {Number} pingId unique identifier
   * @param {Number} clientPingTime time-stamp of ping emission
   * @param {Number} serverPingTime time-stamp of ping reception
   * @param {Number} serverPongTime time-stamp of pong emission
   **/

  /**
   * @callback SyncServer~receiveFunction
   * @see {@linkcode SyncClient~sendFunction}
   * @param {String} messageType identification of ping message type
   * @param {SyncServer~receiveCallback} receiveCallback called on
   * each message matching messageType.
   **/

  /**
   * @callback SyncServer~receiveCallback
   * @param {Number} pingId unique identifier
   * @param {Number} clientPingTime time-stamp of ping emission
   **/

  /**
   * This is the constructor. @see {@linkcode SyncServer~start} method to
   * actually start a synchronisation process.
   *
   * @constructs SyncServer
   * @param {SyncServer~getTimeFunction} getTimeFunction called to get the local
   * time. It must return a time in seconds, monotonic, ever
   * increasing.
   */

  function SyncServer(getTimeFunction) {
    _classCallCheck(this, SyncServer);

    this.getTimeFunction = getTimeFunction;
  }

  /**
   * Start a synchronisation process by registering the receive
   * function passed as second parameter. On each received message,
   * send a reply using the function passed as first parameter.
   *
   * @function SyncServer~start
   * @param {SyncServer~sendFunction} sendFunction
   * @param {SyncServer~receiveFunction} receiveFunction
   */


  _createClass(SyncServer, [{
    key: 'start',
    value: function start(sendFunction, receiveFunction) {
      var _this = this;

      receiveFunction('data', function (obj) {
        //
        console.log("----", obj);
        if (obj.msg === 'sync:ping') {
          var id = obj.args[0];
          var clientPingTime = obj.args[1];
          var serverPingTime = _this.getLocalTime();
          console.log("send !", { 'msg': 'sync:pong', 'args': [id, clientPingTime, serverPingTime, _this.getLocalTime()] });
          sendFunction({ 'msg': 'sync:pong', 'args': [id, clientPingTime, serverPingTime, _this.getLocalTime()] });
        }

        // debug('ping: %s, %s, %s', id, clientPingTime, serverPingTime);
      });
    }

    /**
     * Get local time, or convert a synchronised time to a local time.
     *
     * @function SyncServer~getLocalTime
     * @param {Number} syncTime undefined to get local time
     * @returns {Number} local time, in seconds
     */

  }, {
    key: 'getLocalTime',
    value: function getLocalTime(syncTime) {
      if (typeof syncTime !== 'undefined') {
        return syncTime; // sync time is local: no conversion
      } else {
          return this.getTimeFunction();
        }
    }

    /**
     * Get synchronised time, or convert a local time to a synchronised time.
     *
     * @function SyncServer~getSyncTime
     * @param {Number} localTime undefined to get synchronised time
     * @returns {Number} synchronised time, in seconds.
     */

  }, {
    key: 'getSyncTime',
    value: function getSyncTime(localTime) {
      return this.getLocalTime(localTime); // sync time is local, here
    }
  }]);

  return SyncServer;
}();