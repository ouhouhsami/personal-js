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

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

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

var SyncClient = exports.SyncClient = function () {
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
}();