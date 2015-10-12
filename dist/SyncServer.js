/**
 * @fileoverview Server-side syncronization component
 * @author Jean-Philippe.Lambert@ircam.fr, Sebastien.Robaszkiewicz@ircam.fr,
 *         Norbert.Schnell@ircam.fr
 */

//const debug = require('debug')('soundworks:sync');

'use strict';

var _createClass = require('babel-runtime/helpers/create-class')['default'];

var _classCallCheck = require('babel-runtime/helpers/class-call-check')['default'];

Object.defineProperty(exports, '__esModule', {
  value: true
});

var SyncServer = (function () {
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
})();

exports.SyncServer = SyncServer;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImVzNi9TeW5jU2VydmVyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7OztJQVNhLFVBQVU7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUF1Q1YsV0F2Q0EsVUFBVSxDQXVDVCxlQUFlLEVBQUU7MEJBdkNsQixVQUFVOztBQXdDbkIsUUFBSSxDQUFDLGVBQWUsR0FBRyxlQUFlLENBQUM7R0FDeEM7Ozs7Ozs7Ozs7OztlQXpDVSxVQUFVOztXQW9EaEIsZUFBQyxZQUFZLEVBQUUsZUFBZSxFQUFFOzs7QUFDbkMscUJBQWUsQ0FBQyxNQUFNLEVBQUUsVUFBQyxHQUFHLEVBQUs7O0FBRS9CLGVBQU8sQ0FBQyxHQUFHLENBQUMsTUFBTSxFQUFFLEdBQUcsQ0FBQyxDQUFDO0FBQ3pCLFlBQUcsR0FBRyxDQUFDLEdBQUcsS0FBSyxXQUFXLEVBQUM7QUFDekIsY0FBSSxFQUFFLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNyQixjQUFJLGNBQWMsR0FBSSxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ2xDLGNBQU0sY0FBYyxHQUFHLE1BQUssWUFBWSxFQUFFLENBQUM7QUFDM0MsaUJBQU8sQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFLEVBQUMsS0FBSyxFQUFFLFdBQVcsRUFBRSxNQUFNLEVBQUMsQ0FBQyxFQUFFLEVBQUUsY0FBYyxFQUMxRCxjQUFjLEVBQUUsTUFBSyxZQUFZLEVBQUUsQ0FBQyxFQUFDLENBQUMsQ0FBQTtBQUNqRCxzQkFBWSxDQUFDLEVBQUMsS0FBSyxFQUFFLFdBQVcsRUFBRSxNQUFNLEVBQUMsQ0FBQyxFQUFFLEVBQUUsY0FBYyxFQUNqRCxjQUFjLEVBQUUsTUFBSyxZQUFZLEVBQUUsQ0FBQyxFQUFDLENBQUMsQ0FBQztTQUNuRDs7O09BR0YsQ0FBQyxDQUFDO0tBQ0o7Ozs7Ozs7Ozs7O1dBU1csc0JBQUMsUUFBUSxFQUFFO0FBQ3JCLFVBQUksT0FBTyxRQUFRLEtBQUssV0FBVyxFQUFFO0FBQ25DLGVBQU8sUUFBUSxDQUFDO09BQ2pCLE1BQU07QUFDTCxpQkFBTyxJQUFJLENBQUMsZUFBZSxFQUFFLENBQUM7U0FDL0I7S0FDRjs7Ozs7Ozs7Ozs7V0FTVSxxQkFBQyxTQUFTLEVBQUU7QUFDckIsYUFBTyxJQUFJLENBQUMsWUFBWSxDQUFDLFNBQVMsQ0FBQyxDQUFDO0tBQ3JDOzs7U0E5RlUsVUFBVSIsImZpbGUiOiJlczYvU3luY1NlcnZlci5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGZpbGVvdmVydmlldyBTZXJ2ZXItc2lkZSBzeW5jcm9uaXphdGlvbiBjb21wb25lbnRcbiAqIEBhdXRob3IgSmVhbi1QaGlsaXBwZS5MYW1iZXJ0QGlyY2FtLmZyLCBTZWJhc3RpZW4uUm9iYXN6a2lld2ljekBpcmNhbS5mcixcbiAqICAgICAgICAgTm9yYmVydC5TY2huZWxsQGlyY2FtLmZyXG4gKi9cblxuXG4vL2NvbnN0IGRlYnVnID0gcmVxdWlyZSgnZGVidWcnKSgnc291bmR3b3JrczpzeW5jJyk7XG5cbmV4cG9ydCBjbGFzcyBTeW5jU2VydmVyIHtcbiAgLyoqXG4gICAqIEBjYWxsYmFjayBTeW5jU2VydmVyfmdldFRpbWVGdW5jdGlvblxuICAgKiBAcmV0dXJuIHtOdW1iZXJ9IG1vbm90b25pYywgZXZlciBpbmNyZWFzaW5nLCB0aW1lIGluIHNlY29uZC5cbiAgICoqL1xuXG4gIC8qKlxuICAgKiBAY2FsbGJhY2sgU3luY1NlcnZlcn5zZW5kRnVuY3Rpb25cbiAgICogQHNlZSB7QGxpbmtjb2RlIFN5bmNDbGllbnR+cmVjZWl2ZUZ1bmN0aW9ufVxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZVR5cGUgaWRlbnRpZmljYXRpb24gb2YgcG9uZyBtZXNzYWdlIHR5cGVcbiAgICogQHBhcmFtIHtOdW1iZXJ9IHBpbmdJZCB1bmlxdWUgaWRlbnRpZmllclxuICAgKiBAcGFyYW0ge051bWJlcn0gY2xpZW50UGluZ1RpbWUgdGltZS1zdGFtcCBvZiBwaW5nIGVtaXNzaW9uXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBzZXJ2ZXJQaW5nVGltZSB0aW1lLXN0YW1wIG9mIHBpbmcgcmVjZXB0aW9uXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBzZXJ2ZXJQb25nVGltZSB0aW1lLXN0YW1wIG9mIHBvbmcgZW1pc3Npb25cbiAgICoqL1xuXG4gIC8qKlxuICAgKiBAY2FsbGJhY2sgU3luY1NlcnZlcn5yZWNlaXZlRnVuY3Rpb25cbiAgICogQHNlZSB7QGxpbmtjb2RlIFN5bmNDbGllbnR+c2VuZEZ1bmN0aW9ufVxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZVR5cGUgaWRlbnRpZmljYXRpb24gb2YgcGluZyBtZXNzYWdlIHR5cGVcbiAgICogQHBhcmFtIHtTeW5jU2VydmVyfnJlY2VpdmVDYWxsYmFja30gcmVjZWl2ZUNhbGxiYWNrIGNhbGxlZCBvblxuICAgKiBlYWNoIG1lc3NhZ2UgbWF0Y2hpbmcgbWVzc2FnZVR5cGUuXG4gICAqKi9cblxuICAvKipcbiAgICogQGNhbGxiYWNrIFN5bmNTZXJ2ZXJ+cmVjZWl2ZUNhbGxiYWNrXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBwaW5nSWQgdW5pcXVlIGlkZW50aWZpZXJcbiAgICogQHBhcmFtIHtOdW1iZXJ9IGNsaWVudFBpbmdUaW1lIHRpbWUtc3RhbXAgb2YgcGluZyBlbWlzc2lvblxuICAgKiovXG5cbiAgLyoqXG4gICAqIFRoaXMgaXMgdGhlIGNvbnN0cnVjdG9yLiBAc2VlIHtAbGlua2NvZGUgU3luY1NlcnZlcn5zdGFydH0gbWV0aG9kIHRvXG4gICAqIGFjdHVhbGx5IHN0YXJ0IGEgc3luY2hyb25pc2F0aW9uIHByb2Nlc3MuXG4gICAqXG4gICAqIEBjb25zdHJ1Y3RzIFN5bmNTZXJ2ZXJcbiAgICogQHBhcmFtIHtTeW5jU2VydmVyfmdldFRpbWVGdW5jdGlvbn0gZ2V0VGltZUZ1bmN0aW9uIGNhbGxlZCB0byBnZXQgdGhlIGxvY2FsXG4gICAqIHRpbWUuIEl0IG11c3QgcmV0dXJuIGEgdGltZSBpbiBzZWNvbmRzLCBtb25vdG9uaWMsIGV2ZXJcbiAgICogaW5jcmVhc2luZy5cbiAgICovXG4gIGNvbnN0cnVjdG9yKGdldFRpbWVGdW5jdGlvbikge1xuICAgIHRoaXMuZ2V0VGltZUZ1bmN0aW9uID0gZ2V0VGltZUZ1bmN0aW9uO1xuICB9XG5cbiAgLyoqXG4gICAqIFN0YXJ0IGEgc3luY2hyb25pc2F0aW9uIHByb2Nlc3MgYnkgcmVnaXN0ZXJpbmcgdGhlIHJlY2VpdmVcbiAgICogZnVuY3Rpb24gcGFzc2VkIGFzIHNlY29uZCBwYXJhbWV0ZXIuIE9uIGVhY2ggcmVjZWl2ZWQgbWVzc2FnZSxcbiAgICogc2VuZCBhIHJlcGx5IHVzaW5nIHRoZSBmdW5jdGlvbiBwYXNzZWQgYXMgZmlyc3QgcGFyYW1ldGVyLlxuICAgKlxuICAgKiBAZnVuY3Rpb24gU3luY1NlcnZlcn5zdGFydFxuICAgKiBAcGFyYW0ge1N5bmNTZXJ2ZXJ+c2VuZEZ1bmN0aW9ufSBzZW5kRnVuY3Rpb25cbiAgICogQHBhcmFtIHtTeW5jU2VydmVyfnJlY2VpdmVGdW5jdGlvbn0gcmVjZWl2ZUZ1bmN0aW9uXG4gICAqL1xuICBzdGFydChzZW5kRnVuY3Rpb24sIHJlY2VpdmVGdW5jdGlvbikge1xuICAgIHJlY2VpdmVGdW5jdGlvbignZGF0YScsIChvYmopID0+IHtcbiAgICAgIC8vXG4gICAgICBjb25zb2xlLmxvZyhcIi0tLS1cIiwgb2JqKTtcbiAgICAgIGlmKG9iai5tc2cgPT09ICdzeW5jOnBpbmcnKXtcbiAgICAgICAgbGV0IGlkID0gb2JqLmFyZ3NbMF07XG4gICAgICAgIGxldCBjbGllbnRQaW5nVGltZSA9ICBvYmouYXJnc1sxXTtcbiAgICAgICAgY29uc3Qgc2VydmVyUGluZ1RpbWUgPSB0aGlzLmdldExvY2FsVGltZSgpO1xuICAgICAgICBjb25zb2xlLmxvZyhcInNlbmQgIVwiLCB7J21zZyc6ICdzeW5jOnBvbmcnLCAnYXJncyc6W2lkLCBjbGllbnRQaW5nVGltZSxcbiAgICAgICAgICAgICAgICAgICBzZXJ2ZXJQaW5nVGltZSwgdGhpcy5nZXRMb2NhbFRpbWUoKV19KVxuICAgICAgICBzZW5kRnVuY3Rpb24oeydtc2cnOiAnc3luYzpwb25nJywgJ2FyZ3MnOltpZCwgY2xpZW50UGluZ1RpbWUsXG4gICAgICAgICAgICAgICAgICAgc2VydmVyUGluZ1RpbWUsIHRoaXMuZ2V0TG9jYWxUaW1lKCldfSk7XG4gICAgICB9XG5cbiAgICAgIC8vIGRlYnVnKCdwaW5nOiAlcywgJXMsICVzJywgaWQsIGNsaWVudFBpbmdUaW1lLCBzZXJ2ZXJQaW5nVGltZSk7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogR2V0IGxvY2FsIHRpbWUsIG9yIGNvbnZlcnQgYSBzeW5jaHJvbmlzZWQgdGltZSB0byBhIGxvY2FsIHRpbWUuXG4gICAqXG4gICAqIEBmdW5jdGlvbiBTeW5jU2VydmVyfmdldExvY2FsVGltZVxuICAgKiBAcGFyYW0ge051bWJlcn0gc3luY1RpbWUgdW5kZWZpbmVkIHRvIGdldCBsb2NhbCB0aW1lXG4gICAqIEByZXR1cm5zIHtOdW1iZXJ9IGxvY2FsIHRpbWUsIGluIHNlY29uZHNcbiAgICovXG4gIGdldExvY2FsVGltZShzeW5jVGltZSkge1xuICAgIGlmICh0eXBlb2Ygc3luY1RpbWUgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICByZXR1cm4gc3luY1RpbWU7IC8vIHN5bmMgdGltZSBpcyBsb2NhbDogbm8gY29udmVyc2lvblxuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gdGhpcy5nZXRUaW1lRnVuY3Rpb24oKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogR2V0IHN5bmNocm9uaXNlZCB0aW1lLCBvciBjb252ZXJ0IGEgbG9jYWwgdGltZSB0byBhIHN5bmNocm9uaXNlZCB0aW1lLlxuICAgKlxuICAgKiBAZnVuY3Rpb24gU3luY1NlcnZlcn5nZXRTeW5jVGltZVxuICAgKiBAcGFyYW0ge051bWJlcn0gbG9jYWxUaW1lIHVuZGVmaW5lZCB0byBnZXQgc3luY2hyb25pc2VkIHRpbWVcbiAgICogQHJldHVybnMge051bWJlcn0gc3luY2hyb25pc2VkIHRpbWUsIGluIHNlY29uZHMuXG4gICAqL1xuICBnZXRTeW5jVGltZShsb2NhbFRpbWUpIHtcbiAgICByZXR1cm4gdGhpcy5nZXRMb2NhbFRpbWUobG9jYWxUaW1lKTsgLy8gc3luYyB0aW1lIGlzIGxvY2FsLCBoZXJlXG4gIH1cblxufVxuIl19