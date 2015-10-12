/**
 * @fileOverview Client-side syncronization component
 * @author Jean-Philippe.Lambert@ircam.fr, Sebastien.Robaszkiewicz@ircam.fr,
 *         Norbert.Schnell@ircam.fr
 */

'use strict';

//var debug = require('debug')('soundworks:sync');

////// helpers

/**
 * Order min and max attributes.
 * @param {Object} that with min and max attributes
 * @returns {Object} with min and man attributes, swapped if that.min > that.max
 */

var _createClass = require('babel-runtime/helpers/create-class')['default'];

var _classCallCheck = require('babel-runtime/helpers/class-call-check')['default'];

Object.defineProperty(exports, '__esModule', {
  value: true
});
function orderMinMax(that) {
  if (typeof that !== 'undefined' && typeof that.min !== 'undefined' && typeof that.max !== 'undefined' && that.min > that.max) {
    var tmp = that.min;
    that.min = that.max;
    that.max = tmp;
  }
  return that;
}

/**
 * Mean over an array, selecting one dimension of the array values.
 * @param {Array.<Array.<Number>>} array
 * @param {Number} [dimension = 0]
 * @returns {Number} mean
 */
function mean(array) {
  var dimension = arguments.length <= 1 || arguments[1] === undefined ? 0 : arguments[1];

  return array.reduce(function (p, q) {
    return p + q[dimension];
  }, 0) / array.length;
}

var SyncClient = (function () {
  /**
   * @callback SyncClient~getTimeFunction
   * @return {Number} monotonic, ever increasing, time in second.
   **/

  /**
   * @callback SyncClient~sendFunction
   * @see {@linkcode SyncServer~receiveFunction}
   * @param {String} messageType identification of ping message type
   * @param {Number} pingId unique identifier
   * @param {Number} clientPingTime time-stamp of ping emission
   **/

  /**
   * @callback SyncClient~receiveFunction
   * @see {@linkcode SyncServer~sendFunction}
   * @param {String} messageType identification of pong message type
   * @param {SyncClient~receiveCallback} receiveCallback called on
   * each message matching messageType.
   **/

  /**
   * @callback SyncClient~receiveCallback
   * @param {Number} pingId unique identifier
   * @param {Number} clientPingTime time-stamp of ping emission
   * @param {Number} serverPingTime time-stamp of ping reception
   * @param {Number} serverPongTime time-stamp of pong emission
   * @param {Number} clientPongTime time-stamp of pong reception
   **/

  /**
   * @callback SyncClient~reportFunction
   * @param {String} messageType identification of status message type
   * @param {Object} report
   * @param {String} report.status
   * @param {Number} report.statusDuration duration since last status
   * change
   * @param {Number} report.timeOffset time difference between local
   * time and sync time, in seconds. Measured as the median of the
   * shortest round-trip times over the last ping-pong streak.
   * @param {Number} report.travelDuration half-duration of a
   * ping-pong round-trip, in seconds, mean over the the last
   * ping-pong streak.
   * @param {Number} report.travelDurationMin half-duration of a
   * ping-pong round-trip, in seconds, minimum over the the last
   * ping-pong streak.
   * @param {Number} report.travelDurationMax half-duration of a
   * ping-pong round-trip, in seconds, maximum over the the last
   * ping-pong streak.
   **/

  /**
   * This is the constructor. @see {@linkcode SyncClient~start} method to
   * actually start a synchronisation process.
   *
   * @constructs SyncClient
   * @param {SyncClient~getTimeFunction} getTimeFunction
   * @param {Object} options
   * @param {Object} options.pingTimeOutDelay range of duration (in seconds) to
   * consider a ping was not ponged back
   * @param {Number} options.pingTimeOutDelay.min
   * @param {Number} options.pingTimeOutDelay.max
   * @param {Number} options.pingTimeTravelDurationAccepted maximum
   * travel time, in seconds, to take a ping-pong probe into account.
   * @param {Number} options.pingStreakIterations ping-pongs in a
   * streak
   * @param {Number} options.pingStreakPeriod interval (in seconds) between pings
   * in a streak
   * @param {Number} options.pingStreakDelay range of interval (in
   * seconds) between ping-pong streaks in a streak
   * @param {Number} options.pingStreakDelay.min
   * @param {Number} options.pingStreakDelay.max
   * @param {Number} options.longTermDataTrainingDuration duration of
   * training, in seconds, approximately, before using the estimate of
   * clock frequency
   * @param {Number} options.longTermDataDuration estimate synchronisation over
   *  this duration, in seconds, approximately
   */

  function SyncClient(getTimeFunction) {
    var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

    _classCallCheck(this, SyncClient);

    this.pingTimeoutDelay = options.pingTimeoutDelay || {
      min: 1,
      max: 30
    };
    orderMinMax(this.pingTimeoutDelay);

    this.pingTravelDurationAccepted = options.pingTravelDurationAccepted || 0.5;

    this.pingStreakIterations = options.pingStreakIterations || 10;
    this.pingStreakPeriod = options.pingStreakPeriod || 0.250;
    this.pingStreakDelay = options.pingStreakDelay || {
      min: 10,
      max: 20
    };
    orderMinMax(this.pingStreakDelay);

    this.pingDelay = 0; // current delay before next ping
    this.pingTimeoutId = 0; // to cancel timeout on sync_pinc
    this.pingId = 0; // absolute ID to mach pong against

    this.pingStreakCount = 0; // elapsed pings in a streak
    this.streakData = []; // circular buffer
    this.streakDataNextIndex = 0; // next index to write in circular buffer
    this.streakDataLength = this.pingStreakIterations; // size of circular buffer

    this.longTermDataTrainingDuration = options.longTermDataTrainingDuration || 120;

    // use a fixed-size circular buffer, even if it does not match
    // exactly the required duration
    this.longTermDataDuration = options.longTermDataDuration || 900;
    this.longTermDataLength = Math.max(2, this.longTermDataDuration / (0.5 * (this.pingStreakDelay.min + this.pingStreakDelay.max)));

    this.longTermData = []; // circular buffer
    this.longTermDataNextIndex = 0; // next index to write in circular buffer

    this.timeOffset = 0; // mean of (serverTime - clientTime) in the last streak
    this.travelDuration = 0;
    this.travelDurationMin = 0;
    this.travelDurationMax = 0;

    // T(t) = T0 + R * (t - t0)
    this.serverTimeReference = 0; // T0
    this.clientTimeReference = 0; // t0
    this.frequencyRatio = 1; // R

    this.pingTimeoutDelay.current = this.pingTimeoutDelay.min;

    this.getTimeFunction = getTimeFunction;

    this.status = 'new';
    this.statusChangedTime = 0;

    this.connectionStatus = 'offline';
    this.connectionStatusChangedTime = 0;
  }

  /**
   * Set status, and set this.statusChangedTime, to later
   * use @see {@linkcode SyncClient~getStatusDuration}
   *
   * @function SyncClient~setStatus
   * @param {String} status
   * @returns {Object} this
   */

  _createClass(SyncClient, [{
    key: 'setStatus',
    value: function setStatus(status) {
      if (status !== this.status) {
        this.status = status;
        this.statusChangedTime = this.getLocalTime();
      }
      return this;
    }

    /**
     * Get time since last status change. @see {@linkcode
     * SyncClient~setStatus}
     *
     * @function SyncClient~getStatusDuration
     * @returns {Number} time, in seconds, since last status change.
     */
  }, {
    key: 'getStatusDuration',
    value: function getStatusDuration() {
      return Math.max(0, this.getLocalTime() - this.statusChangedTime);
    }

    /**
     * Set connectionStatus, and set this.connectionStatusChangedTime,
     * to later use @see {@linkcode
     * SyncClient~getConnectionStatusDuration}
     *
     * @function SyncClient~setConnectionStatus
     * @param {String} connectionStatus
     * @returns {Object} this
     */
  }, {
    key: 'setConnectionStatus',
    value: function setConnectionStatus(connectionStatus) {
      if (connectionStatus !== this.connectionStatus) {
        this.connectionStatus = connectionStatus;
        this.connectionStatusChangedTime = this.getLocalTime();
      }
      return this;
    }

    /**
     * Get time since last connectionStatus change. @see {@linkcode
     * SyncClient~setConnectionStatus}
     *
     * @function SyncClient~getConnectionStatusDuration
     * @returns {Number} time, in seconds, since last connectionStatus
     * change.
     */
  }, {
    key: 'getConnectionStatusDuration',
    value: function getConnectionStatusDuration() {
      return Math.max(0, this.getLocalTime() - this.connectionStatusChangedTime);
    }

    /**
     * Report the status of the synchronisation process, if
     * reportFunction is defined.
     *
     * @param {SyncClient~reportFunction} reportFunction
     */
  }, {
    key: 'reportStatus',
    value: function reportStatus(reportFunction) {
      if (typeof reportFunction !== 'undefined') {
        reportFunction({ 'msg': 'sync:status',
          status: this.status,
          statusDuration: this.getStatusDuration(),
          timeOffset: this.timeOffset,
          frequencyRatio: this.frequencyRatio,
          connection: this.connectionStatus,
          connectionDuration: this.getConnectionStatusDuration(),
          connectionTimeOut: this.pingTimeoutDelay.current,
          travelDuration: this.travelDuration,
          travelDurationMin: this.travelDurationMin,
          travelDurationMax: this.travelDurationMax
        });
      }
    }

    /**
     * Process to send ping messages.
     *
     * @private
     * @function SyncClient~__syncLoop
     * @param {SyncClient~sendFunction} sendFunction
     * @param {SyncClient~reportFunction} reportFunction
     */
  }, {
    key: '__syncLoop',
    value: function __syncLoop(sendFunction, reportFunction) {
      var _this = this;

      clearTimeout(this.timeoutId);
      ++this.pingId;
      sendFunction({
        'msg': 'sync:ping',
        'args': [this.pingId, this.getLocalTime()]
      });

      this.timeoutId = setTimeout(function () {
        // increase timeout duration on timeout, to avoid overflow
        _this.pingTimeoutDelay.current = Math.min(_this.pingTimeoutDelay.current * 2, _this.pingTimeoutDelay.max);
        // debug('sync:ping timeout > %s', this.pingTimeoutDelay.current);
        _this.setConnectionStatus('offline');
        _this.reportStatus(reportFunction);
        // retry (yes, always increment pingId)
        _this.__syncLoop(sendFunction, reportFunction);
      }, 1000 * this.pingTimeoutDelay.current);
    }

    /**
     * Start a synchronisation process by registering the receive
     * function passed as second parameter. Then, send regular messages
     * to the server, using the send function passed as first parameter.
     *
     * @function SyncClient~start
     * @param {SyncClient~sendFunction} sendFunction
     * @param {SyncClient~receiveFunction} receiveFunction to register
     * @param {SyncClient~reportFunction} reportFunction if defined,
     * is called to report the status, on each status change
     */
  }, {
    key: 'start',
    value: function start(sendFunction, receiveFunction, reportFunction) {
      var _this2 = this;

      this.setStatus('startup');
      this.setConnectionStatus('offline');

      this.streakData = [];
      this.streakDataNextIndex = 0;

      this.longTermData = [];
      this.longTermDataNextIndex = 0;

      receiveFunction('data', function (data) {
        if (data.msg == 'sync:pong') {
          var pingId = data.args[0];
          var clientPingTime = data.args[1];
          var serverPingTime = data.args[2];
          var serverPongTime = data.args[3];

          // accept only the pong that corresponds to the last ping
          if (pingId === _this2.pingId) {
            ++_this2.pingStreakCount;
            clearTimeout(_this2.timeoutId);
            _this2.setConnectionStatus('online');
            // reduce timeout duration on pong, for better reactivity
            _this2.pingTimeoutDelay.current = Math.max(_this2.pingTimeoutDelay.current * 0.75, _this2.pingTimeoutDelay.min);

            // time-differences are valid on a single-side only (client or server)
            var clientPongTime = _this2.getLocalTime();
            var clientTime = 0.5 * (clientPongTime + clientPingTime);
            var serverTime = 0.5 * (serverPongTime + serverPingTime);
            var travelDuration = Math.max(0, clientPongTime - clientPingTime - (serverPongTime - serverPingTime));
            var offsetTime = serverTime - clientTime;

            // order is important for sorting, later.
            _this2.streakData[_this2.streakDataNextIndex] = [travelDuration, offsetTime, clientTime, serverTime];
            _this2.streakDataNextIndex = ++_this2.streakDataNextIndex % _this2.streakDataLength;

            // debug('ping %s, travel = %s, offset = %s, client = %s, server = %s',
            //       pingId, travelDuration, offsetTime, clientTime, serverTime);

            // end of a streak
            if (_this2.pingStreakCount >= _this2.pingStreakIterations && _this2.streakData.length >= _this2.streakDataLength) {
              // plan the begining of the next streak
              _this2.pingDelay = _this2.pingStreakDelay.min + Math.random() * (_this2.pingStreakDelay.max - _this2.pingStreakDelay.min);
              _this2.pingStreakCount = 0;

              // sort by travel time first, then offset time.
              var sorted = _this2.streakData.slice(0).sort();

              var streakTravelDuration = sorted[0][0];

              // When the clock tick is long enough,
              // some travel times (dimension 0) might be identical.
              // Then, use the offset median (dimension 1 is the second sort key)
              var s = 0;
              while (s < sorted.length && sorted[s][0] <= streakTravelDuration * 1.01) {
                ++s;
              }
              s = Math.max(0, s - 1);
              var median = Math.floor(s / 2);

              var streakClientTime = sorted[median][2];
              var streakServerTime = sorted[median][3];
              var streakClientSquaredTime = streakClientTime * streakClientTime;
              var streakClientServerTime = streakClientTime * streakServerTime;

              _this2.longTermData[_this2.longTermDataNextIndex] = [streakTravelDuration, streakClientTime, streakServerTime, streakClientSquaredTime, streakClientServerTime];
              _this2.longTermDataNextIndex = ++_this2.longTermDataNextIndex % _this2.longTermDataLength;

              // mean of the time offset over 3 samples around median
              // (it might use a longer travel duration)
              var aroundMedian = sorted.slice(Math.max(0, median - 1), Math.min(sorted.length, median + 1));
              _this2.timeOffset = mean(aroundMedian, 3) - mean(aroundMedian, 2);

              if (_this2.status === 'startup' || _this2.status === 'training' && _this2.getStatusDuration() < _this2.longTermDataTrainingDuration) {
                // set only the phase offset, not the frequency
                _this2.serverTimeReference = _this2.timeOffset;
                _this2.clientTimeReference = 0;
                _this2.frequencyRatio = 1;
                _this2.setStatus('training');
                // debug('T = %s + %s * (%s - %s) = %s',
                //       this.serverTimeReference, this.frequencyRatio,
                //       streakClientTime, this.clientTimeReference,
                //       this.getSyncTime(streakClientTime));
              }

              if (_this2.status === 'training' && _this2.getStatusDuration() >= _this2.longTermDataTrainingDuration || _this2.status === 'sync') {
                // linear regression, R = covariance(t,T) / variance(t)
                var regClientTime = mean(_this2.longTermData, 1);
                var regServerTime = mean(_this2.longTermData, 2);
                var regClientSquaredTime = mean(_this2.longTermData, 3);
                var regClientServerTime = mean(_this2.longTermData, 4);

                var covariance = regClientServerTime - regClientTime * regServerTime;
                var variance = regClientSquaredTime - regClientTime * regClientTime;
                if (variance > 0) {
                  // update freq and shift
                  _this2.frequencyRatio = covariance / variance;
                  _this2.clientTimeReference = regClientTime;
                  _this2.serverTimeReference = regServerTime;

                  // 10% is a lot
                  if (_this2.frequencyRatio > 0.99 && _this2.frequencyRatio < 1.01) {
                    _this2.setStatus('sync');
                  } else {
                    //debug('clock frequency ratio out of sync: %s, training again',
                    //      this.frequencyRatio);
                    // start the training again from the last streak
                    _this2.serverTimeReference = _this2.timeOffset; // offset only
                    _this2.clientTimeReference = 0;
                    _this2.frequencyRatio = 1;
                    _this2.setStatus('training');

                    _this2.longTermData[0] = [streakTravelDuration, streakClientTime, streakServerTime, streakClientSquaredTime, streakClientServerTime];
                    _this2.longTermData.length = 1;
                    _this2.longTermDataNextIndex = 1;
                  }
                }

                /*debug('T = %s + %s * (%s - %s) = %s',
                      this.serverTimeReference, this.frequencyRatio,
                      streakClientTime, this.clientTimeReference,
                      this.getSyncTime(streakClientTime) );*/
              }

              _this2.travelDuration = mean(sorted, 0);
              _this2.travelDurationMin = sorted[0][0];
              _this2.travelDurationMax = sorted[sorted.length - 1][0];

              _this2.reportStatus(reportFunction);
            } else {
              // we are in a streak, use the pingInterval value
              _this2.pingDelay = _this2.pingStreakPeriod;
            }

            _this2.timeoutId = setTimeout(function () {
              _this2.__syncLoop(sendFunction, reportFunction);
            }, 1000 * _this2.pingDelay);
          } // ping and pong ID match
        }
      }); // receive function

      this.__syncLoop(sendFunction, reportFunction);
    }

    /**
     * Get local time, or convert a synchronised time to a local time.
     *
     * @function SyncClient~getLocalTime
     * @param {Number} syncTime undefined to get local time
     * @returns {Number} local time, in seconds
     */
  }, {
    key: 'getLocalTime',
    value: function getLocalTime(syncTime) {
      if (typeof syncTime !== 'undefined') {
        // conversion: t(T) = t0 + (T - T0) / R
        return this.clientTimeReference + (syncTime - this.serverTimeReference) / this.frequencyRatio;
      } else {
        // read local clock
        return this.getTimeFunction();
      }
    }

    /**
     * Get synchronised time, or convert a local time to a synchronised time.
     *
     * @function SyncClient~getSyncTime
     * @param {Number} localTime undefined to get synchronised time
     * @returns {Number} synchronised time, in seconds.
     */
  }, {
    key: 'getSyncTime',
    value: function getSyncTime() {
      var localTime = arguments.length <= 0 || arguments[0] === undefined ? this.getLocalTime() : arguments[0];

      // always convert: T(t) = T0 + R * (t - t0)
      return this.serverTimeReference + this.frequencyRatio * (localTime - this.clientTimeReference);
    }
  }]);

  return SyncClient;
})();

exports.SyncClient = SyncClient;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImVzNi9TeW5jU2VydmVyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7OztBQU1BLFlBQVksQ0FBQzs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQVdiLFNBQVMsV0FBVyxDQUFDLElBQUksRUFBRTtBQUN6QixNQUFJLE9BQU8sSUFBSSxLQUFLLFdBQVcsSUFBSSxPQUFPLElBQUksQ0FBQyxHQUFHLEtBQUssV0FBVyxJQUFJLE9BQU8sSUFBSSxDQUFDLEdBQUcsS0FBSyxXQUFXLElBQUksSUFBSSxDQUFDLEdBQUcsR0FBRyxJQUFJLENBQUMsR0FBRyxFQUFFO0FBQzVILFFBQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUM7QUFDckIsUUFBSSxDQUFDLEdBQUcsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDO0FBQ3BCLFFBQUksQ0FBQyxHQUFHLEdBQUcsR0FBRyxDQUFDO0dBQ2hCO0FBQ0QsU0FBTyxJQUFJLENBQUM7Q0FDYjs7Ozs7Ozs7QUFRRCxTQUFTLElBQUksQ0FBQyxLQUFLLEVBQWlCO01BQWYsU0FBUyx5REFBRyxDQUFDOztBQUNoQyxTQUFPLEtBQUssQ0FBQyxNQUFNLENBQUMsVUFBQyxDQUFDLEVBQUUsQ0FBQztXQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsU0FBUyxDQUFDO0dBQUEsRUFBRSxDQUFDLENBQUMsR0FBRyxLQUFLLENBQUMsTUFBTSxDQUFDO0NBQ25FOztJQUVZLFVBQVU7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBK0VWLFdBL0VBLFVBQVUsQ0ErRVQsZUFBZSxFQUFnQjtRQUFkLE9BQU8seURBQUcsRUFBRTs7MEJBL0U5QixVQUFVOztBQWdGbkIsUUFBSSxDQUFDLGdCQUFnQixHQUFHLE9BQU8sQ0FBQyxnQkFBZ0IsSUFBSTtBQUNsRCxTQUFHLEVBQUUsQ0FBQztBQUNOLFNBQUcsRUFBRSxFQUFFO0tBQ1IsQ0FBQztBQUNG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QUFFekMsYUFBTyxJQUFJLENBQUMsbUJBQW1CLEdBQUcsSUFBSSxDQUFDLGNBQWMsSUFBSSxTQUFTLEdBQUcsSUFBSSxDQUFDLG1CQUFtQixDQUFBLEFBQUMsQ0FBQztLQUNoRzs7O1NBcGJVLFVBQVUiLCJmaWxlIjoiZXM2L1N5bmNTZXJ2ZXIuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBmaWxlT3ZlcnZpZXcgQ2xpZW50LXNpZGUgc3luY3Jvbml6YXRpb24gY29tcG9uZW50XG4gKiBAYXV0aG9yIEplYW4tUGhpbGlwcGUuTGFtYmVydEBpcmNhbS5mciwgU2ViYXN0aWVuLlJvYmFzemtpZXdpY3pAaXJjYW0uZnIsXG4gKiAgICAgICAgIE5vcmJlcnQuU2NobmVsbEBpcmNhbS5mclxuICovXG5cbid1c2Ugc3RyaWN0JztcblxuLy92YXIgZGVidWcgPSByZXF1aXJlKCdkZWJ1ZycpKCdzb3VuZHdvcmtzOnN5bmMnKTtcblxuLy8vLy8vIGhlbHBlcnNcblxuLyoqXG4gKiBPcmRlciBtaW4gYW5kIG1heCBhdHRyaWJ1dGVzLlxuICogQHBhcmFtIHtPYmplY3R9IHRoYXQgd2l0aCBtaW4gYW5kIG1heCBhdHRyaWJ1dGVzXG4gKiBAcmV0dXJucyB7T2JqZWN0fSB3aXRoIG1pbiBhbmQgbWFuIGF0dHJpYnV0ZXMsIHN3YXBwZWQgaWYgdGhhdC5taW4gPiB0aGF0Lm1heFxuICovXG5mdW5jdGlvbiBvcmRlck1pbk1heCh0aGF0KSB7XG4gIGlmICh0eXBlb2YgdGhhdCAhPT0gJ3VuZGVmaW5lZCcgJiYgdHlwZW9mIHRoYXQubWluICE9PSAndW5kZWZpbmVkJyAmJiB0eXBlb2YgdGhhdC5tYXggIT09ICd1bmRlZmluZWQnICYmIHRoYXQubWluID4gdGhhdC5tYXgpIHtcbiAgICBjb25zdCB0bXAgPSB0aGF0Lm1pbjtcbiAgICB0aGF0Lm1pbiA9IHRoYXQubWF4O1xuICAgIHRoYXQubWF4ID0gdG1wO1xuICB9XG4gIHJldHVybiB0aGF0O1xufVxuXG4vKipcbiAqIE1lYW4gb3ZlciBhbiBhcnJheSwgc2VsZWN0aW5nIG9uZSBkaW1lbnNpb24gb2YgdGhlIGFycmF5IHZhbHVlcy5cbiAqIEBwYXJhbSB7QXJyYXkuPEFycmF5LjxOdW1iZXI+Pn0gYXJyYXlcbiAqIEBwYXJhbSB7TnVtYmVyfSBbZGltZW5zaW9uID0gMF1cbiAqIEByZXR1cm5zIHtOdW1iZXJ9IG1lYW5cbiAqL1xuZnVuY3Rpb24gbWVhbihhcnJheSwgZGltZW5zaW9uID0gMCkge1xuICByZXR1cm4gYXJyYXkucmVkdWNlKChwLCBxKSA9PiBwICsgcVtkaW1lbnNpb25dLCAwKSAvIGFycmF5Lmxlbmd0aDtcbn1cblxuZXhwb3J0IGNsYXNzIFN5bmNDbGllbnQge1xuICAvKipcbiAgICogQGNhbGxiYWNrIFN5bmNDbGllbnR+Z2V0VGltZUZ1bmN0aW9uXG4gICAqIEByZXR1cm4ge051bWJlcn0gbW9ub3RvbmljLCBldmVyIGluY3JlYXNpbmcsIHRpbWUgaW4gc2Vjb25kLlxuICAgKiovXG5cbiAgLyoqXG4gICAqIEBjYWxsYmFjayBTeW5jQ2xpZW50fnNlbmRGdW5jdGlvblxuICAgKiBAc2VlIHtAbGlua2NvZGUgU3luY1NlcnZlcn5yZWNlaXZlRnVuY3Rpb259XG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlVHlwZSBpZGVudGlmaWNhdGlvbiBvZiBwaW5nIG1lc3NhZ2UgdHlwZVxuICAgKiBAcGFyYW0ge051bWJlcn0gcGluZ0lkIHVuaXF1ZSBpZGVudGlmaWVyXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBjbGllbnRQaW5nVGltZSB0aW1lLXN0YW1wIG9mIHBpbmcgZW1pc3Npb25cbiAgICoqL1xuXG4gIC8qKlxuICAgKiBAY2FsbGJhY2sgU3luY0NsaWVudH5yZWNlaXZlRnVuY3Rpb25cbiAgICogQHNlZSB7QGxpbmtjb2RlIFN5bmNTZXJ2ZXJ+c2VuZEZ1bmN0aW9ufVxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZVR5cGUgaWRlbnRpZmljYXRpb24gb2YgcG9uZyBtZXNzYWdlIHR5cGVcbiAgICogQHBhcmFtIHtTeW5jQ2xpZW50fnJlY2VpdmVDYWxsYmFja30gcmVjZWl2ZUNhbGxiYWNrIGNhbGxlZCBvblxuICAgKiBlYWNoIG1lc3NhZ2UgbWF0Y2hpbmcgbWVzc2FnZVR5cGUuXG4gICAqKi9cblxuICAvKipcbiAgICogQGNhbGxiYWNrIFN5bmNDbGllbnR+cmVjZWl2ZUNhbGxiYWNrXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBwaW5nSWQgdW5pcXVlIGlkZW50aWZpZXJcbiAgICogQHBhcmFtIHtOdW1iZXJ9IGNsaWVudFBpbmdUaW1lIHRpbWUtc3RhbXAgb2YgcGluZyBlbWlzc2lvblxuICAgKiBAcGFyYW0ge051bWJlcn0gc2VydmVyUGluZ1RpbWUgdGltZS1zdGFtcCBvZiBwaW5nIHJlY2VwdGlvblxuICAgKiBAcGFyYW0ge051bWJlcn0gc2VydmVyUG9uZ1RpbWUgdGltZS1zdGFtcCBvZiBwb25nIGVtaXNzaW9uXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBjbGllbnRQb25nVGltZSB0aW1lLXN0YW1wIG9mIHBvbmcgcmVjZXB0aW9uXG4gICAqKi9cblxuICAvKipcbiAgICogQGNhbGxiYWNrIFN5bmNDbGllbnR+cmVwb3J0RnVuY3Rpb25cbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2VUeXBlIGlkZW50aWZpY2F0aW9uIG9mIHN0YXR1cyBtZXNzYWdlIHR5cGVcbiAgICogQHBhcmFtIHtPYmplY3R9IHJlcG9ydFxuICAgKiBAcGFyYW0ge1N0cmluZ30gcmVwb3J0LnN0YXR1c1xuICAgKiBAcGFyYW0ge051bWJlcn0gcmVwb3J0LnN0YXR1c0R1cmF0aW9uIGR1cmF0aW9uIHNpbmNlIGxhc3Qgc3RhdHVzXG4gICAqIGNoYW5nZVxuICAgKiBAcGFyYW0ge051bWJlcn0gcmVwb3J0LnRpbWVPZmZzZXQgdGltZSBkaWZmZXJlbmNlIGJldHdlZW4gbG9jYWxcbiAgICogdGltZSBhbmQgc3luYyB0aW1lLCBpbiBzZWNvbmRzLiBNZWFzdXJlZCBhcyB0aGUgbWVkaWFuIG9mIHRoZVxuICAgKiBzaG9ydGVzdCByb3VuZC10cmlwIHRpbWVzIG92ZXIgdGhlIGxhc3QgcGluZy1wb25nIHN0cmVhay5cbiAgICogQHBhcmFtIHtOdW1iZXJ9IHJlcG9ydC50cmF2ZWxEdXJhdGlvbiBoYWxmLWR1cmF0aW9uIG9mIGFcbiAgICogcGluZy1wb25nIHJvdW5kLXRyaXAsIGluIHNlY29uZHMsIG1lYW4gb3ZlciB0aGUgdGhlIGxhc3RcbiAgICogcGluZy1wb25nIHN0cmVhay5cbiAgICogQHBhcmFtIHtOdW1iZXJ9IHJlcG9ydC50cmF2ZWxEdXJhdGlvbk1pbiBoYWxmLWR1cmF0aW9uIG9mIGFcbiAgICogcGluZy1wb25nIHJvdW5kLXRyaXAsIGluIHNlY29uZHMsIG1pbmltdW0gb3ZlciB0aGUgdGhlIGxhc3RcbiAgICogcGluZy1wb25nIHN0cmVhay5cbiAgICogQHBhcmFtIHtOdW1iZXJ9IHJlcG9ydC50cmF2ZWxEdXJhdGlvbk1heCBoYWxmLWR1cmF0aW9uIG9mIGFcbiAgICogcGluZy1wb25nIHJvdW5kLXRyaXAsIGluIHNlY29uZHMsIG1heGltdW0gb3ZlciB0aGUgdGhlIGxhc3RcbiAgICogcGluZy1wb25nIHN0cmVhay5cbiAgICoqL1xuXG4gIC8qKlxuICAgKiBUaGlzIGlzIHRoZSBjb25zdHJ1Y3Rvci4gQHNlZSB7QGxpbmtjb2RlIFN5bmNDbGllbnR+c3RhcnR9IG1ldGhvZCB0b1xuICAgKiBhY3R1YWxseSBzdGFydCBhIHN5bmNocm9uaXNhdGlvbiBwcm9jZXNzLlxuICAgKlxuICAgKiBAY29uc3RydWN0cyBTeW5jQ2xpZW50XG4gICAqIEBwYXJhbSB7U3luY0NsaWVudH5nZXRUaW1lRnVuY3Rpb259IGdldFRpbWVGdW5jdGlvblxuICAgKiBAcGFyYW0ge09iamVjdH0gb3B0aW9uc1xuICAgKiBAcGFyYW0ge09iamVjdH0gb3B0aW9ucy5waW5nVGltZU91dERlbGF5IHJhbmdlIG9mIGR1cmF0aW9uIChpbiBzZWNvbmRzKSB0b1xuICAgKiBjb25zaWRlciBhIHBpbmcgd2FzIG5vdCBwb25nZWQgYmFja1xuICAgKiBAcGFyYW0ge051bWJlcn0gb3B0aW9ucy5waW5nVGltZU91dERlbGF5Lm1pblxuICAgKiBAcGFyYW0ge051bWJlcn0gb3B0aW9ucy5waW5nVGltZU91dERlbGF5Lm1heFxuICAgKiBAcGFyYW0ge051bWJlcn0gb3B0aW9ucy5waW5nVGltZVRyYXZlbER1cmF0aW9uQWNjZXB0ZWQgbWF4aW11bVxuICAgKiB0cmF2ZWwgdGltZSwgaW4gc2Vjb25kcywgdG8gdGFrZSBhIHBpbmctcG9uZyBwcm9iZSBpbnRvIGFjY291bnQuXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBvcHRpb25zLnBpbmdTdHJlYWtJdGVyYXRpb25zIHBpbmctcG9uZ3MgaW4gYVxuICAgKiBzdHJlYWtcbiAgICogQHBhcmFtIHtOdW1iZXJ9IG9wdGlvbnMucGluZ1N0cmVha1BlcmlvZCBpbnRlcnZhbCAoaW4gc2Vjb25kcykgYmV0d2VlbiBwaW5nc1xuICAgKiBpbiBhIHN0cmVha1xuICAgKiBAcGFyYW0ge051bWJlcn0gb3B0aW9ucy5waW5nU3RyZWFrRGVsYXkgcmFuZ2Ugb2YgaW50ZXJ2YWwgKGluXG4gICAqIHNlY29uZHMpIGJldHdlZW4gcGluZy1wb25nIHN0cmVha3MgaW4gYSBzdHJlYWtcbiAgICogQHBhcmFtIHtOdW1iZXJ9IG9wdGlvbnMucGluZ1N0cmVha0RlbGF5Lm1pblxuICAgKiBAcGFyYW0ge051bWJlcn0gb3B0aW9ucy5waW5nU3RyZWFrRGVsYXkubWF4XG4gICAqIEBwYXJhbSB7TnVtYmVyfSBvcHRpb25zLmxvbmdUZXJtRGF0YVRyYWluaW5nRHVyYXRpb24gZHVyYXRpb24gb2ZcbiAgICogdHJhaW5pbmcsIGluIHNlY29uZHMsIGFwcHJveGltYXRlbHksIGJlZm9yZSB1c2luZyB0aGUgZXN0aW1hdGUgb2ZcbiAgICogY2xvY2sgZnJlcXVlbmN5XG4gICAqIEBwYXJhbSB7TnVtYmVyfSBvcHRpb25zLmxvbmdUZXJtRGF0YUR1cmF0aW9uIGVzdGltYXRlIHN5bmNocm9uaXNhdGlvbiBvdmVyXG4gICAqICB0aGlzIGR1cmF0aW9uLCBpbiBzZWNvbmRzLCBhcHByb3hpbWF0ZWx5XG4gICAqL1xuICBjb25zdHJ1Y3RvcihnZXRUaW1lRnVuY3Rpb24sIG9wdGlvbnMgPSB7fSkge1xuICAgIHRoaXMucGluZ1RpbWVvdXREZWxheSA9IG9wdGlvbnMucGluZ1RpbWVvdXREZWxheSB8fCB7XG4gICAgICBtaW46IDEsXG4gICAgICBtYXg6IDMwXG4gICAgfTtcbiAgICBvcmRlck1pbk1heCh0aGlzLnBpbmdUaW1lb3V0RGVsYXkpO1xuXG4gICAgdGhpcy5waW5nVHJhdmVsRHVyYXRpb25BY2NlcHRlZCA9IG9wdGlvbnMucGluZ1RyYXZlbER1cmF0aW9uQWNjZXB0ZWQgfHwgMC41O1xuXG4gICAgdGhpcy5waW5nU3RyZWFrSXRlcmF0aW9ucyA9IG9wdGlvbnMucGluZ1N0cmVha0l0ZXJhdGlvbnMgfHwgMTA7XG4gICAgdGhpcy5waW5nU3RyZWFrUGVyaW9kID0gb3B0aW9ucy5waW5nU3RyZWFrUGVyaW9kIHx8IDAuMjUwO1xuICAgIHRoaXMucGluZ1N0cmVha0RlbGF5ID0gb3B0aW9ucy5waW5nU3RyZWFrRGVsYXkgfHwge1xuICAgICAgbWluOiAxMCxcbiAgICAgIG1heDogMjBcbiAgICB9O1xuICAgIG9yZGVyTWluTWF4KHRoaXMucGluZ1N0cmVha0RlbGF5KTtcblxuICAgIHRoaXMucGluZ0RlbGF5ID0gMDsgLy8gY3VycmVudCBkZWxheSBiZWZvcmUgbmV4dCBwaW5nXG4gICAgdGhpcy5waW5nVGltZW91dElkID0gMDsgLy8gdG8gY2FuY2VsIHRpbWVvdXQgb24gc3luY19waW5jXG4gICAgdGhpcy5waW5nSWQgPSAwOyAvLyBhYnNvbHV0ZSBJRCB0byBtYWNoIHBvbmcgYWdhaW5zdFxuXG4gICAgdGhpcy5waW5nU3RyZWFrQ291bnQgPSAwOyAvLyBlbGFwc2VkIHBpbmdzIGluIGEgc3RyZWFrXG4gICAgdGhpcy5zdHJlYWtEYXRhID0gW107IC8vIGNpcmN1bGFyIGJ1ZmZlclxuICAgIHRoaXMuc3RyZWFrRGF0YU5leHRJbmRleCA9IDA7IC8vIG5leHQgaW5kZXggdG8gd3JpdGUgaW4gY2lyY3VsYXIgYnVmZmVyXG4gICAgdGhpcy5zdHJlYWtEYXRhTGVuZ3RoID0gdGhpcy5waW5nU3RyZWFrSXRlcmF0aW9uczsgLy8gc2l6ZSBvZiBjaXJjdWxhciBidWZmZXJcblxuICAgIHRoaXMubG9uZ1Rlcm1EYXRhVHJhaW5pbmdEdXJhdGlvbiA9IG9wdGlvbnMubG9uZ1Rlcm1EYXRhVHJhaW5pbmdEdXJhdGlvbiB8fCAxMjA7XG5cbiAgICAvLyB1c2UgYSBmaXhlZC1zaXplIGNpcmN1bGFyIGJ1ZmZlciwgZXZlbiBpZiBpdCBkb2VzIG5vdCBtYXRjaFxuICAgIC8vIGV4YWN0bHkgdGhlIHJlcXVpcmVkIGR1cmF0aW9uXG4gICAgdGhpcy5sb25nVGVybURhdGFEdXJhdGlvbiA9IG9wdGlvbnMubG9uZ1Rlcm1EYXRhRHVyYXRpb24gfHwgOTAwO1xuICAgIHRoaXMubG9uZ1Rlcm1EYXRhTGVuZ3RoID0gTWF0aC5tYXgoXG4gICAgICAyLFxuICAgICAgdGhpcy5sb25nVGVybURhdGFEdXJhdGlvbiAvXG4gICAgICAoMC41ICogKHRoaXMucGluZ1N0cmVha0RlbGF5Lm1pbiArIHRoaXMucGluZ1N0cmVha0RlbGF5Lm1heCkpKTtcblxuICAgIHRoaXMubG9uZ1Rlcm1EYXRhID0gW107IC8vIGNpcmN1bGFyIGJ1ZmZlclxuICAgIHRoaXMubG9uZ1Rlcm1EYXRhTmV4dEluZGV4ID0gMDsgLy8gbmV4dCBpbmRleCB0byB3cml0ZSBpbiBjaXJjdWxhciBidWZmZXJcblxuICAgIHRoaXMudGltZU9mZnNldCA9IDA7IC8vIG1lYW4gb2YgKHNlcnZlclRpbWUgLSBjbGllbnRUaW1lKSBpbiB0aGUgbGFzdCBzdHJlYWtcbiAgICB0aGlzLnRyYXZlbER1cmF0aW9uID0gMDtcbiAgICB0aGlzLnRyYXZlbER1cmF0aW9uTWluID0gMDtcbiAgICB0aGlzLnRyYXZlbER1cmF0aW9uTWF4ID0gMDtcblxuICAgIC8vIFQodCkgPSBUMCArIFIgKiAodCAtIHQwKVxuICAgIHRoaXMuc2VydmVyVGltZVJlZmVyZW5jZSA9IDA7IC8vIFQwXG4gICAgdGhpcy5jbGllbnRUaW1lUmVmZXJlbmNlID0gMDsgLy8gdDBcbiAgICB0aGlzLmZyZXF1ZW5jeVJhdGlvID0gMTsgLy8gUlxuXG4gICAgdGhpcy5waW5nVGltZW91dERlbGF5LmN1cnJlbnQgPSB0aGlzLnBpbmdUaW1lb3V0RGVsYXkubWluO1xuXG4gICAgdGhpcy5nZXRUaW1lRnVuY3Rpb24gPSBnZXRUaW1lRnVuY3Rpb247XG5cbiAgICB0aGlzLnN0YXR1cyA9ICduZXcnO1xuICAgIHRoaXMuc3RhdHVzQ2hhbmdlZFRpbWUgPSAwO1xuXG4gICAgdGhpcy5jb25uZWN0aW9uU3RhdHVzID0gJ29mZmxpbmUnO1xuICAgIHRoaXMuY29ubmVjdGlvblN0YXR1c0NoYW5nZWRUaW1lID0gMDtcbiAgfVxuXG5cbiAgLyoqXG4gICAqIFNldCBzdGF0dXMsIGFuZCBzZXQgdGhpcy5zdGF0dXNDaGFuZ2VkVGltZSwgdG8gbGF0ZXJcbiAgICogdXNlIEBzZWUge0BsaW5rY29kZSBTeW5jQ2xpZW50fmdldFN0YXR1c0R1cmF0aW9ufVxuICAgKlxuICAgKiBAZnVuY3Rpb24gU3luY0NsaWVudH5zZXRTdGF0dXNcbiAgICogQHBhcmFtIHtTdHJpbmd9IHN0YXR1c1xuICAgKiBAcmV0dXJucyB7T2JqZWN0fSB0aGlzXG4gICAqL1xuICBzZXRTdGF0dXMoc3RhdHVzKSB7XG4gICAgaWYgKHN0YXR1cyAhPT0gdGhpcy5zdGF0dXMpIHtcbiAgICAgIHRoaXMuc3RhdHVzID0gc3RhdHVzO1xuICAgICAgdGhpcy5zdGF0dXNDaGFuZ2VkVGltZSA9IHRoaXMuZ2V0TG9jYWxUaW1lKCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldCB0aW1lIHNpbmNlIGxhc3Qgc3RhdHVzIGNoYW5nZS4gQHNlZSB7QGxpbmtjb2RlXG4gICAqIFN5bmNDbGllbnR+c2V0U3RhdHVzfVxuICAgKlxuICAgKiBAZnVuY3Rpb24gU3luY0NsaWVudH5nZXRTdGF0dXNEdXJhdGlvblxuICAgKiBAcmV0dXJucyB7TnVtYmVyfSB0aW1lLCBpbiBzZWNvbmRzLCBzaW5jZSBsYXN0IHN0YXR1cyBjaGFuZ2UuXG4gICAqL1xuICBnZXRTdGF0dXNEdXJhdGlvbigpIHtcbiAgICByZXR1cm4gTWF0aC5tYXgoMCwgdGhpcy5nZXRMb2NhbFRpbWUoKSAtIHRoaXMuc3RhdHVzQ2hhbmdlZFRpbWUpO1xuICB9XG5cbiAgLyoqXG4gICAqIFNldCBjb25uZWN0aW9uU3RhdHVzLCBhbmQgc2V0IHRoaXMuY29ubmVjdGlvblN0YXR1c0NoYW5nZWRUaW1lLFxuICAgKiB0byBsYXRlciB1c2UgQHNlZSB7QGxpbmtjb2RlXG4gICAqIFN5bmNDbGllbnR+Z2V0Q29ubmVjdGlvblN0YXR1c0R1cmF0aW9ufVxuICAgKlxuICAgKiBAZnVuY3Rpb24gU3luY0NsaWVudH5zZXRDb25uZWN0aW9uU3RhdHVzXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBjb25uZWN0aW9uU3RhdHVzXG4gICAqIEByZXR1cm5zIHtPYmplY3R9IHRoaXNcbiAgICovXG4gIHNldENvbm5lY3Rpb25TdGF0dXMoY29ubmVjdGlvblN0YXR1cykge1xuICAgIGlmIChjb25uZWN0aW9uU3RhdHVzICE9PSB0aGlzLmNvbm5lY3Rpb25TdGF0dXMpIHtcbiAgICAgIHRoaXMuY29ubmVjdGlvblN0YXR1cyA9IGNvbm5lY3Rpb25TdGF0dXM7XG4gICAgICB0aGlzLmNvbm5lY3Rpb25TdGF0dXNDaGFuZ2VkVGltZSA9IHRoaXMuZ2V0TG9jYWxUaW1lKCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldCB0aW1lIHNpbmNlIGxhc3QgY29ubmVjdGlvblN0YXR1cyBjaGFuZ2UuIEBzZWUge0BsaW5rY29kZVxuICAgKiBTeW5jQ2xpZW50fnNldENvbm5lY3Rpb25TdGF0dXN9XG4gICAqXG4gICAqIEBmdW5jdGlvbiBTeW5jQ2xpZW50fmdldENvbm5lY3Rpb25TdGF0dXNEdXJhdGlvblxuICAgKiBAcmV0dXJucyB7TnVtYmVyfSB0aW1lLCBpbiBzZWNvbmRzLCBzaW5jZSBsYXN0IGNvbm5lY3Rpb25TdGF0dXNcbiAgICogY2hhbmdlLlxuICAgKi9cbiAgZ2V0Q29ubmVjdGlvblN0YXR1c0R1cmF0aW9uKCkge1xuICAgIHJldHVybiBNYXRoLm1heCgwLCB0aGlzLmdldExvY2FsVGltZSgpIC0gdGhpcy5jb25uZWN0aW9uU3RhdHVzQ2hhbmdlZFRpbWUpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlcG9ydCB0aGUgc3RhdHVzIG9mIHRoZSBzeW5jaHJvbmlzYXRpb24gcHJvY2VzcywgaWZcbiAgICogcmVwb3J0RnVuY3Rpb24gaXMgZGVmaW5lZC5cbiAgICpcbiAgICogQHBhcmFtIHtTeW5jQ2xpZW50fnJlcG9ydEZ1bmN0aW9ufSByZXBvcnRGdW5jdGlvblxuICAgKi9cbiAgcmVwb3J0U3RhdHVzKHJlcG9ydEZ1bmN0aW9uKSB7XG4gICAgaWYgKHR5cGVvZiByZXBvcnRGdW5jdGlvbiAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIHJlcG9ydEZ1bmN0aW9uKHsnbXNnJzogJ3N5bmM6c3RhdHVzJyxcbiAgICAgICAgc3RhdHVzOiB0aGlzLnN0YXR1cyxcbiAgICAgICAgc3RhdHVzRHVyYXRpb246IHRoaXMuZ2V0U3RhdHVzRHVyYXRpb24oKSxcbiAgICAgICAgdGltZU9mZnNldDogdGhpcy50aW1lT2Zmc2V0LFxuICAgICAgICBmcmVxdWVuY3lSYXRpbzogdGhpcy5mcmVxdWVuY3lSYXRpbyxcbiAgICAgICAgY29ubmVjdGlvbjogdGhpcy5jb25uZWN0aW9uU3RhdHVzLFxuICAgICAgICBjb25uZWN0aW9uRHVyYXRpb246IHRoaXMuZ2V0Q29ubmVjdGlvblN0YXR1c0R1cmF0aW9uKCksXG4gICAgICAgIGNvbm5lY3Rpb25UaW1lT3V0OiB0aGlzLnBpbmdUaW1lb3V0RGVsYXkuY3VycmVudCxcbiAgICAgICAgdHJhdmVsRHVyYXRpb246IHRoaXMudHJhdmVsRHVyYXRpb24sXG4gICAgICAgIHRyYXZlbER1cmF0aW9uTWluOiB0aGlzLnRyYXZlbER1cmF0aW9uTWluLFxuICAgICAgICB0cmF2ZWxEdXJhdGlvbk1heDogdGhpcy50cmF2ZWxEdXJhdGlvbk1heFxuICAgICAgfSk7XG5cbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogUHJvY2VzcyB0byBzZW5kIHBpbmcgbWVzc2FnZXMuXG4gICAqXG4gICAqIEBwcml2YXRlXG4gICAqIEBmdW5jdGlvbiBTeW5jQ2xpZW50fl9fc3luY0xvb3BcbiAgICogQHBhcmFtIHtTeW5jQ2xpZW50fnNlbmRGdW5jdGlvbn0gc2VuZEZ1bmN0aW9uXG4gICAqIEBwYXJhbSB7U3luY0NsaWVudH5yZXBvcnRGdW5jdGlvbn0gcmVwb3J0RnVuY3Rpb25cbiAgICovXG4gIF9fc3luY0xvb3Aoc2VuZEZ1bmN0aW9uLCByZXBvcnRGdW5jdGlvbikge1xuICAgIGNsZWFyVGltZW91dCh0aGlzLnRpbWVvdXRJZCk7XG4gICAgKyt0aGlzLnBpbmdJZDtcbiAgICBzZW5kRnVuY3Rpb24oe1xuICAgICAgJ21zZyc6ICdzeW5jOnBpbmcnLFxuICAgICAgJ2FyZ3MnOiBbdGhpcy5waW5nSWQsIHRoaXMuZ2V0TG9jYWxUaW1lKCldXG4gICAgfSk7XG5cbiAgICB0aGlzLnRpbWVvdXRJZCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgLy8gaW5jcmVhc2UgdGltZW91dCBkdXJhdGlvbiBvbiB0aW1lb3V0LCB0byBhdm9pZCBvdmVyZmxvd1xuICAgICAgdGhpcy5waW5nVGltZW91dERlbGF5LmN1cnJlbnQgPSBNYXRoLm1pbih0aGlzLnBpbmdUaW1lb3V0RGVsYXkuY3VycmVudCAqIDIsXG4gICAgICAgIHRoaXMucGluZ1RpbWVvdXREZWxheS5tYXgpO1xuICAgICAgLy8gZGVidWcoJ3N5bmM6cGluZyB0aW1lb3V0ID4gJXMnLCB0aGlzLnBpbmdUaW1lb3V0RGVsYXkuY3VycmVudCk7XG4gICAgICB0aGlzLnNldENvbm5lY3Rpb25TdGF0dXMoJ29mZmxpbmUnKTtcbiAgICAgIHRoaXMucmVwb3J0U3RhdHVzKHJlcG9ydEZ1bmN0aW9uKTtcbiAgICAgIC8vIHJldHJ5ICh5ZXMsIGFsd2F5cyBpbmNyZW1lbnQgcGluZ0lkKVxuICAgICAgdGhpcy5fX3N5bmNMb29wKHNlbmRGdW5jdGlvbiwgcmVwb3J0RnVuY3Rpb24pO1xuICAgIH0sIDEwMDAgKiB0aGlzLnBpbmdUaW1lb3V0RGVsYXkuY3VycmVudCk7XG4gIH1cblxuICAvKipcbiAgICogU3RhcnQgYSBzeW5jaHJvbmlzYXRpb24gcHJvY2VzcyBieSByZWdpc3RlcmluZyB0aGUgcmVjZWl2ZVxuICAgKiBmdW5jdGlvbiBwYXNzZWQgYXMgc2Vjb25kIHBhcmFtZXRlci4gVGhlbiwgc2VuZCByZWd1bGFyIG1lc3NhZ2VzXG4gICAqIHRvIHRoZSBzZXJ2ZXIsIHVzaW5nIHRoZSBzZW5kIGZ1bmN0aW9uIHBhc3NlZCBhcyBmaXJzdCBwYXJhbWV0ZXIuXG4gICAqXG4gICAqIEBmdW5jdGlvbiBTeW5jQ2xpZW50fnN0YXJ0XG4gICAqIEBwYXJhbSB7U3luY0NsaWVudH5zZW5kRnVuY3Rpb259IHNlbmRGdW5jdGlvblxuICAgKiBAcGFyYW0ge1N5bmNDbGllbnR+cmVjZWl2ZUZ1bmN0aW9ufSByZWNlaXZlRnVuY3Rpb24gdG8gcmVnaXN0ZXJcbiAgICogQHBhcmFtIHtTeW5jQ2xpZW50fnJlcG9ydEZ1bmN0aW9ufSByZXBvcnRGdW5jdGlvbiBpZiBkZWZpbmVkLFxuICAgKiBpcyBjYWxsZWQgdG8gcmVwb3J0IHRoZSBzdGF0dXMsIG9uIGVhY2ggc3RhdHVzIGNoYW5nZVxuICAgKi9cbiAgc3RhcnQoc2VuZEZ1bmN0aW9uLCByZWNlaXZlRnVuY3Rpb24sIHJlcG9ydEZ1bmN0aW9uKSB7XG4gICAgdGhpcy5zZXRTdGF0dXMoJ3N0YXJ0dXAnKTtcbiAgICB0aGlzLnNldENvbm5lY3Rpb25TdGF0dXMoJ29mZmxpbmUnKTtcblxuICAgIHRoaXMuc3RyZWFrRGF0YSA9IFtdO1xuICAgIHRoaXMuc3RyZWFrRGF0YU5leHRJbmRleCA9IDA7XG5cbiAgICB0aGlzLmxvbmdUZXJtRGF0YSA9IFtdO1xuICAgIHRoaXMubG9uZ1Rlcm1EYXRhTmV4dEluZGV4ID0gMDtcblxuICAgIHJlY2VpdmVGdW5jdGlvbignZGF0YScsIChkYXRhKSA9PiB7XG4gICAgICBpZiAoZGF0YS5tc2cgPT0gJ3N5bmM6cG9uZycpIHtcbiAgICAgICAgbGV0IHBpbmdJZCA9IGRhdGEuYXJnc1swXTtcbiAgICAgICAgbGV0IGNsaWVudFBpbmdUaW1lID0gZGF0YS5hcmdzWzFdO1xuICAgICAgICBsZXQgc2VydmVyUGluZ1RpbWUgPSBkYXRhLmFyZ3NbMl07XG4gICAgICAgIGxldCBzZXJ2ZXJQb25nVGltZSA9IGRhdGEuYXJnc1szXTtcblxuICAgICAgICAvLyBhY2NlcHQgb25seSB0aGUgcG9uZyB0aGF0IGNvcnJlc3BvbmRzIHRvIHRoZSBsYXN0IHBpbmdcbiAgICAgICAgaWYgKHBpbmdJZCA9PT0gdGhpcy5waW5nSWQpIHtcbiAgICAgICAgICArK3RoaXMucGluZ1N0cmVha0NvdW50O1xuICAgICAgICAgIGNsZWFyVGltZW91dCh0aGlzLnRpbWVvdXRJZCk7XG4gICAgICAgICAgdGhpcy5zZXRDb25uZWN0aW9uU3RhdHVzKCdvbmxpbmUnKTtcbiAgICAgICAgICAvLyByZWR1Y2UgdGltZW91dCBkdXJhdGlvbiBvbiBwb25nLCBmb3IgYmV0dGVyIHJlYWN0aXZpdHlcbiAgICAgICAgICB0aGlzLnBpbmdUaW1lb3V0RGVsYXkuY3VycmVudCA9IE1hdGgubWF4KHRoaXMucGluZ1RpbWVvdXREZWxheS5jdXJyZW50ICogMC43NSxcbiAgICAgICAgICAgIHRoaXMucGluZ1RpbWVvdXREZWxheS5taW4pO1xuXG4gICAgICAgICAgLy8gdGltZS1kaWZmZXJlbmNlcyBhcmUgdmFsaWQgb24gYSBzaW5nbGUtc2lkZSBvbmx5IChjbGllbnQgb3Igc2VydmVyKVxuICAgICAgICAgIGNvbnN0IGNsaWVudFBvbmdUaW1lID0gdGhpcy5nZXRMb2NhbFRpbWUoKTtcbiAgICAgICAgICBjb25zdCBjbGllbnRUaW1lID0gMC41ICogKGNsaWVudFBvbmdUaW1lICsgY2xpZW50UGluZ1RpbWUpO1xuICAgICAgICAgIGNvbnN0IHNlcnZlclRpbWUgPSAwLjUgKiAoc2VydmVyUG9uZ1RpbWUgKyBzZXJ2ZXJQaW5nVGltZSk7XG4gICAgICAgICAgY29uc3QgdHJhdmVsRHVyYXRpb24gPSBNYXRoLm1heCgwLCAoY2xpZW50UG9uZ1RpbWUgLSBjbGllbnRQaW5nVGltZSkgLSAoc2VydmVyUG9uZ1RpbWUgLSBzZXJ2ZXJQaW5nVGltZSkpO1xuICAgICAgICAgIGNvbnN0IG9mZnNldFRpbWUgPSBzZXJ2ZXJUaW1lIC0gY2xpZW50VGltZTtcblxuICAgICAgICAgIC8vIG9yZGVyIGlzIGltcG9ydGFudCBmb3Igc29ydGluZywgbGF0ZXIuXG4gICAgICAgICAgdGhpcy5zdHJlYWtEYXRhW3RoaXMuc3RyZWFrRGF0YU5leHRJbmRleF0gPSBbdHJhdmVsRHVyYXRpb24sIG9mZnNldFRpbWUsIGNsaWVudFRpbWUsIHNlcnZlclRpbWVdO1xuICAgICAgICAgIHRoaXMuc3RyZWFrRGF0YU5leHRJbmRleCA9ICgrK3RoaXMuc3RyZWFrRGF0YU5leHRJbmRleCkgJSB0aGlzLnN0cmVha0RhdGFMZW5ndGg7XG5cbiAgICAgICAgICAvLyBkZWJ1ZygncGluZyAlcywgdHJhdmVsID0gJXMsIG9mZnNldCA9ICVzLCBjbGllbnQgPSAlcywgc2VydmVyID0gJXMnLFxuICAgICAgICAgIC8vICAgICAgIHBpbmdJZCwgdHJhdmVsRHVyYXRpb24sIG9mZnNldFRpbWUsIGNsaWVudFRpbWUsIHNlcnZlclRpbWUpO1xuXG4gICAgICAgICAgLy8gZW5kIG9mIGEgc3RyZWFrXG4gICAgICAgICAgaWYgKHRoaXMucGluZ1N0cmVha0NvdW50ID49IHRoaXMucGluZ1N0cmVha0l0ZXJhdGlvbnMgJiYgdGhpcy5zdHJlYWtEYXRhLmxlbmd0aCA+PSB0aGlzLnN0cmVha0RhdGFMZW5ndGgpIHtcbiAgICAgICAgICAgIC8vIHBsYW4gdGhlIGJlZ2luaW5nIG9mIHRoZSBuZXh0IHN0cmVha1xuICAgICAgICAgICAgdGhpcy5waW5nRGVsYXkgPSB0aGlzLnBpbmdTdHJlYWtEZWxheS5taW4gKyBNYXRoLnJhbmRvbSgpICogKHRoaXMucGluZ1N0cmVha0RlbGF5Lm1heCAtIHRoaXMucGluZ1N0cmVha0RlbGF5Lm1pbik7XG4gICAgICAgICAgICB0aGlzLnBpbmdTdHJlYWtDb3VudCA9IDA7XG5cbiAgICAgICAgICAgIC8vIHNvcnQgYnkgdHJhdmVsIHRpbWUgZmlyc3QsIHRoZW4gb2Zmc2V0IHRpbWUuXG4gICAgICAgICAgICBjb25zdCBzb3J0ZWQgPSB0aGlzLnN0cmVha0RhdGEuc2xpY2UoMCkuc29ydCgpO1xuXG4gICAgICAgICAgICBjb25zdCBzdHJlYWtUcmF2ZWxEdXJhdGlvbiA9IHNvcnRlZFswXVswXTtcblxuICAgICAgICAgICAgLy8gV2hlbiB0aGUgY2xvY2sgdGljayBpcyBsb25nIGVub3VnaCxcbiAgICAgICAgICAgIC8vIHNvbWUgdHJhdmVsIHRpbWVzIChkaW1lbnNpb24gMCkgbWlnaHQgYmUgaWRlbnRpY2FsLlxuICAgICAgICAgICAgLy8gVGhlbiwgdXNlIHRoZSBvZmZzZXQgbWVkaWFuIChkaW1lbnNpb24gMSBpcyB0aGUgc2Vjb25kIHNvcnQga2V5KVxuICAgICAgICAgICAgbGV0IHMgPSAwO1xuICAgICAgICAgICAgd2hpbGUgKHMgPCBzb3J0ZWQubGVuZ3RoICYmIHNvcnRlZFtzXVswXSA8PSBzdHJlYWtUcmF2ZWxEdXJhdGlvbiAqIDEuMDEpIHtcbiAgICAgICAgICAgICAgKytzO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcyA9IE1hdGgubWF4KDAsIHMgLSAxKTtcbiAgICAgICAgICAgIGxldCBtZWRpYW4gPSBNYXRoLmZsb29yKHMgLyAyKTtcblxuICAgICAgICAgICAgY29uc3Qgc3RyZWFrQ2xpZW50VGltZSA9IHNvcnRlZFttZWRpYW5dWzJdO1xuICAgICAgICAgICAgY29uc3Qgc3RyZWFrU2VydmVyVGltZSA9IHNvcnRlZFttZWRpYW5dWzNdO1xuICAgICAgICAgICAgY29uc3Qgc3RyZWFrQ2xpZW50U3F1YXJlZFRpbWUgPSBzdHJlYWtDbGllbnRUaW1lICogc3RyZWFrQ2xpZW50VGltZTtcbiAgICAgICAgICAgIGNvbnN0IHN0cmVha0NsaWVudFNlcnZlclRpbWUgPSBzdHJlYWtDbGllbnRUaW1lICogc3RyZWFrU2VydmVyVGltZTtcblxuICAgICAgICAgICAgdGhpcy5sb25nVGVybURhdGFbdGhpcy5sb25nVGVybURhdGFOZXh0SW5kZXhdID0gW3N0cmVha1RyYXZlbER1cmF0aW9uLCBzdHJlYWtDbGllbnRUaW1lLCBzdHJlYWtTZXJ2ZXJUaW1lLFxuICAgICAgICAgICAgICBzdHJlYWtDbGllbnRTcXVhcmVkVGltZSwgc3RyZWFrQ2xpZW50U2VydmVyVGltZVxuICAgICAgICAgICAgXTtcbiAgICAgICAgICAgIHRoaXMubG9uZ1Rlcm1EYXRhTmV4dEluZGV4ID0gKCsrdGhpcy5sb25nVGVybURhdGFOZXh0SW5kZXgpICUgdGhpcy5sb25nVGVybURhdGFMZW5ndGg7XG5cbiAgICAgICAgICAgIC8vIG1lYW4gb2YgdGhlIHRpbWUgb2Zmc2V0IG92ZXIgMyBzYW1wbGVzIGFyb3VuZCBtZWRpYW5cbiAgICAgICAgICAgIC8vIChpdCBtaWdodCB1c2UgYSBsb25nZXIgdHJhdmVsIGR1cmF0aW9uKVxuICAgICAgICAgICAgY29uc3QgYXJvdW5kTWVkaWFuID0gc29ydGVkLnNsaWNlKE1hdGgubWF4KDAsIG1lZGlhbiAtIDEpLFxuICAgICAgICAgICAgICBNYXRoLm1pbihzb3J0ZWQubGVuZ3RoLCBtZWRpYW4gKyAxKSk7XG4gICAgICAgICAgICB0aGlzLnRpbWVPZmZzZXQgPSBtZWFuKGFyb3VuZE1lZGlhbiwgMykgLSBtZWFuKGFyb3VuZE1lZGlhbiwgMik7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLnN0YXR1cyA9PT0gJ3N0YXJ0dXAnIHx8ICh0aGlzLnN0YXR1cyA9PT0gJ3RyYWluaW5nJyAmJiB0aGlzLmdldFN0YXR1c0R1cmF0aW9uKCkgPCB0aGlzLmxvbmdUZXJtRGF0YVRyYWluaW5nRHVyYXRpb24pKSB7XG4gICAgICAgICAgICAgIC8vIHNldCBvbmx5IHRoZSBwaGFzZSBvZmZzZXQsIG5vdCB0aGUgZnJlcXVlbmN5XG4gICAgICAgICAgICAgIHRoaXMuc2VydmVyVGltZVJlZmVyZW5jZSA9IHRoaXMudGltZU9mZnNldDtcbiAgICAgICAgICAgICAgdGhpcy5jbGllbnRUaW1lUmVmZXJlbmNlID0gMDtcbiAgICAgICAgICAgICAgdGhpcy5mcmVxdWVuY3lSYXRpbyA9IDE7XG4gICAgICAgICAgICAgIHRoaXMuc2V0U3RhdHVzKCd0cmFpbmluZycpO1xuICAgICAgICAgICAgICAvLyBkZWJ1ZygnVCA9ICVzICsgJXMgKiAoJXMgLSAlcykgPSAlcycsXG4gICAgICAgICAgICAgIC8vICAgICAgIHRoaXMuc2VydmVyVGltZVJlZmVyZW5jZSwgdGhpcy5mcmVxdWVuY3lSYXRpbyxcbiAgICAgICAgICAgICAgLy8gICAgICAgc3RyZWFrQ2xpZW50VGltZSwgdGhpcy5jbGllbnRUaW1lUmVmZXJlbmNlLFxuICAgICAgICAgICAgICAvLyAgICAgICB0aGlzLmdldFN5bmNUaW1lKHN0cmVha0NsaWVudFRpbWUpKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKCh0aGlzLnN0YXR1cyA9PT0gJ3RyYWluaW5nJyAmJiB0aGlzLmdldFN0YXR1c0R1cmF0aW9uKCkgPj0gdGhpcy5sb25nVGVybURhdGFUcmFpbmluZ0R1cmF0aW9uKSB8fCB0aGlzLnN0YXR1cyA9PT0gJ3N5bmMnKSB7XG4gICAgICAgICAgICAgIC8vIGxpbmVhciByZWdyZXNzaW9uLCBSID0gY292YXJpYW5jZSh0LFQpIC8gdmFyaWFuY2UodClcbiAgICAgICAgICAgICAgY29uc3QgcmVnQ2xpZW50VGltZSA9IG1lYW4odGhpcy5sb25nVGVybURhdGEsIDEpO1xuICAgICAgICAgICAgICBjb25zdCByZWdTZXJ2ZXJUaW1lID0gbWVhbih0aGlzLmxvbmdUZXJtRGF0YSwgMik7XG4gICAgICAgICAgICAgIGNvbnN0IHJlZ0NsaWVudFNxdWFyZWRUaW1lID0gbWVhbih0aGlzLmxvbmdUZXJtRGF0YSwgMyk7XG4gICAgICAgICAgICAgIGNvbnN0IHJlZ0NsaWVudFNlcnZlclRpbWUgPSBtZWFuKHRoaXMubG9uZ1Rlcm1EYXRhLCA0KTtcblxuICAgICAgICAgICAgICBjb25zdCBjb3ZhcmlhbmNlID0gcmVnQ2xpZW50U2VydmVyVGltZSAtIHJlZ0NsaWVudFRpbWUgKiByZWdTZXJ2ZXJUaW1lO1xuICAgICAgICAgICAgICBjb25zdCB2YXJpYW5jZSA9IHJlZ0NsaWVudFNxdWFyZWRUaW1lIC0gcmVnQ2xpZW50VGltZSAqIHJlZ0NsaWVudFRpbWU7XG4gICAgICAgICAgICAgIGlmICh2YXJpYW5jZSA+IDApIHtcbiAgICAgICAgICAgICAgICAvLyB1cGRhdGUgZnJlcSBhbmQgc2hpZnRcbiAgICAgICAgICAgICAgICB0aGlzLmZyZXF1ZW5jeVJhdGlvID0gY292YXJpYW5jZSAvIHZhcmlhbmNlO1xuICAgICAgICAgICAgICAgIHRoaXMuY2xpZW50VGltZVJlZmVyZW5jZSA9IHJlZ0NsaWVudFRpbWU7XG4gICAgICAgICAgICAgICAgdGhpcy5zZXJ2ZXJUaW1lUmVmZXJlbmNlID0gcmVnU2VydmVyVGltZTtcblxuICAgICAgICAgICAgICAgIC8vIDEwJSBpcyBhIGxvdFxuICAgICAgICAgICAgICAgIGlmICh0aGlzLmZyZXF1ZW5jeVJhdGlvID4gMC45OSAmJiB0aGlzLmZyZXF1ZW5jeVJhdGlvIDwgMS4wMSkge1xuICAgICAgICAgICAgICAgICAgdGhpcy5zZXRTdGF0dXMoJ3N5bmMnKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgLy9kZWJ1ZygnY2xvY2sgZnJlcXVlbmN5IHJhdGlvIG91dCBvZiBzeW5jOiAlcywgdHJhaW5pbmcgYWdhaW4nLFxuICAgICAgICAgICAgICAgICAgLy8gICAgICB0aGlzLmZyZXF1ZW5jeVJhdGlvKTtcbiAgICAgICAgICAgICAgICAgIC8vIHN0YXJ0IHRoZSB0cmFpbmluZyBhZ2FpbiBmcm9tIHRoZSBsYXN0IHN0cmVha1xuICAgICAgICAgICAgICAgICAgdGhpcy5zZXJ2ZXJUaW1lUmVmZXJlbmNlID0gdGhpcy50aW1lT2Zmc2V0OyAvLyBvZmZzZXQgb25seVxuICAgICAgICAgICAgICAgICAgdGhpcy5jbGllbnRUaW1lUmVmZXJlbmNlID0gMDtcbiAgICAgICAgICAgICAgICAgIHRoaXMuZnJlcXVlbmN5UmF0aW8gPSAxO1xuICAgICAgICAgICAgICAgICAgdGhpcy5zZXRTdGF0dXMoJ3RyYWluaW5nJyk7XG5cbiAgICAgICAgICAgICAgICAgIHRoaXMubG9uZ1Rlcm1EYXRhWzBdID0gW3N0cmVha1RyYXZlbER1cmF0aW9uLCBzdHJlYWtDbGllbnRUaW1lLCBzdHJlYWtTZXJ2ZXJUaW1lLFxuICAgICAgICAgICAgICAgICAgICBzdHJlYWtDbGllbnRTcXVhcmVkVGltZSwgc3RyZWFrQ2xpZW50U2VydmVyVGltZVxuICAgICAgICAgICAgICAgICAgXTtcbiAgICAgICAgICAgICAgICAgIHRoaXMubG9uZ1Rlcm1EYXRhLmxlbmd0aCA9IDE7XG4gICAgICAgICAgICAgICAgICB0aGlzLmxvbmdUZXJtRGF0YU5leHRJbmRleCA9IDE7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgLypkZWJ1ZygnVCA9ICVzICsgJXMgKiAoJXMgLSAlcykgPSAlcycsXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc2VydmVyVGltZVJlZmVyZW5jZSwgdGhpcy5mcmVxdWVuY3lSYXRpbyxcbiAgICAgICAgICAgICAgICAgICAgc3RyZWFrQ2xpZW50VGltZSwgdGhpcy5jbGllbnRUaW1lUmVmZXJlbmNlLFxuICAgICAgICAgICAgICAgICAgICB0aGlzLmdldFN5bmNUaW1lKHN0cmVha0NsaWVudFRpbWUpICk7Ki9cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy50cmF2ZWxEdXJhdGlvbiA9IG1lYW4oc29ydGVkLCAwKTtcbiAgICAgICAgICAgIHRoaXMudHJhdmVsRHVyYXRpb25NaW4gPSBzb3J0ZWRbMF1bMF07XG4gICAgICAgICAgICB0aGlzLnRyYXZlbER1cmF0aW9uTWF4ID0gc29ydGVkW3NvcnRlZC5sZW5ndGggLSAxXVswXTtcblxuICAgICAgICAgICAgdGhpcy5yZXBvcnRTdGF0dXMocmVwb3J0RnVuY3Rpb24pO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyB3ZSBhcmUgaW4gYSBzdHJlYWssIHVzZSB0aGUgcGluZ0ludGVydmFsIHZhbHVlXG4gICAgICAgICAgICB0aGlzLnBpbmdEZWxheSA9IHRoaXMucGluZ1N0cmVha1BlcmlvZDtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICB0aGlzLnRpbWVvdXRJZCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5fX3N5bmNMb29wKHNlbmRGdW5jdGlvbiwgcmVwb3J0RnVuY3Rpb24pO1xuICAgICAgICAgIH0sIDEwMDAgKiB0aGlzLnBpbmdEZWxheSk7XG4gICAgICAgIH0gLy8gcGluZyBhbmQgcG9uZyBJRCBtYXRjaFxuICAgICAgfVxuICAgIH0pOyAvLyByZWNlaXZlIGZ1bmN0aW9uXG5cbiAgICB0aGlzLl9fc3luY0xvb3Aoc2VuZEZ1bmN0aW9uLCByZXBvcnRGdW5jdGlvbik7XG4gIH1cblxuICAvKipcbiAgICogR2V0IGxvY2FsIHRpbWUsIG9yIGNvbnZlcnQgYSBzeW5jaHJvbmlzZWQgdGltZSB0byBhIGxvY2FsIHRpbWUuXG4gICAqXG4gICAqIEBmdW5jdGlvbiBTeW5jQ2xpZW50fmdldExvY2FsVGltZVxuICAgKiBAcGFyYW0ge051bWJlcn0gc3luY1RpbWUgdW5kZWZpbmVkIHRvIGdldCBsb2NhbCB0aW1lXG4gICAqIEByZXR1cm5zIHtOdW1iZXJ9IGxvY2FsIHRpbWUsIGluIHNlY29uZHNcbiAgICovXG4gIGdldExvY2FsVGltZShzeW5jVGltZSkge1xuICAgIGlmICh0eXBlb2Ygc3luY1RpbWUgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAvLyBjb252ZXJzaW9uOiB0KFQpID0gdDAgKyAoVCAtIFQwKSAvIFJcbiAgICAgIHJldHVybiB0aGlzLmNsaWVudFRpbWVSZWZlcmVuY2UgKyAoc3luY1RpbWUgLSB0aGlzLnNlcnZlclRpbWVSZWZlcmVuY2UpIC8gdGhpcy5mcmVxdWVuY3lSYXRpbztcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gcmVhZCBsb2NhbCBjbG9ja1xuICAgICAgcmV0dXJuIHRoaXMuZ2V0VGltZUZ1bmN0aW9uKCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEdldCBzeW5jaHJvbmlzZWQgdGltZSwgb3IgY29udmVydCBhIGxvY2FsIHRpbWUgdG8gYSBzeW5jaHJvbmlzZWQgdGltZS5cbiAgICpcbiAgICogQGZ1bmN0aW9uIFN5bmNDbGllbnR+Z2V0U3luY1RpbWVcbiAgICogQHBhcmFtIHtOdW1iZXJ9IGxvY2FsVGltZSB1bmRlZmluZWQgdG8gZ2V0IHN5bmNocm9uaXNlZCB0aW1lXG4gICAqIEByZXR1cm5zIHtOdW1iZXJ9IHN5bmNocm9uaXNlZCB0aW1lLCBpbiBzZWNvbmRzLlxuICAgKi9cbiAgZ2V0U3luY1RpbWUobG9jYWxUaW1lID0gdGhpcy5nZXRMb2NhbFRpbWUoKSkge1xuICAgIC8vIGFsd2F5cyBjb252ZXJ0OiBUKHQpID0gVDAgKyBSICogKHQgLSB0MClcbiAgICByZXR1cm4gdGhpcy5zZXJ2ZXJUaW1lUmVmZXJlbmNlICsgdGhpcy5mcmVxdWVuY3lSYXRpbyAqIChsb2NhbFRpbWUgLSB0aGlzLmNsaWVudFRpbWVSZWZlcmVuY2UpO1xuICB9XG59XG4iXX0=