'use strict';

var _createClass = require('babel-runtime/helpers/create-class')['default'];

var _classCallCheck = require('babel-runtime/helpers/class-call-check')['default'];

var _Object$keys = require('babel-runtime/core-js/object/keys')['default'];

var _loadSamples = require('./loadSamples');

var _SyncServerJs = require('./SyncServer.js');

var _SyncClientJs = require('./SyncClient.js');

var wavesAudio = require('waves-audio');
var audioContext = wavesAudio.audioContext;

var $peer = document.querySelector('#peer');
var $create = document.querySelector('#create');
var $join = document.querySelector('#join');

var sampleURLS = ['./media/bass-1.mp3', './media/bass-2.mp3', './media/bass-3.mp3', './media/drums1-1.mp3', './media/drums1-2.mp3', './media/drums1-3.mp3', './media/drums2-1.mp3', './media/drums2-2.mp3', './media/drums3-1.mp3', './media/drums3-2.mp3', './media/drums3-3.mp3', './media/fx-1.mp3', './media/guitar-1.mp3', './media/guitar-2.mp3', './media/synths-1.mp3', './media/synths-10.mp3', './media/synths-11.mp3', './media/synths-2.mp3', './media/synths-3.mp3', './media/synths-4.mp3', './media/synths-5.mp3', './media/synths-6.mp3', './media/synths-7.mp3', './media/synths-8.mp3', './media/synths-9.mp3', './media/voice-1.mp3', './media/voice-2.mp3', './media/voice-3.mp3', './media/voice-4.mp3', './media/voice-5.mp3'];

var App = (function () {
    function App() {
        var _this = this;

        _classCallCheck(this, App);

        this.load();
        this.$play = document.querySelector('#play');
        this.$play.style.display = "none";
        this.$reset = document.querySelector('#reset');
        this.$reset.addEventListener('click', function () {
            _this.$play.style.display = "none";
            _this.$connect.style.display = "block";
            //console.log(this.shared.connectedPeers);
            var cP = _Object$keys(_this.shared.connectedPeers);
            for (var i = 0; i < cP.length; i++) {
                var val = _this.shared.connectedPeers[cP[i]];
                console.log(val);
                val.dataChannel.close();
                // use val
            }
            $peer.value = "";
            document.location.reload();
        });
        this.$connect = document.querySelector('#connect');
        this.samples = [];
        $create.addEventListener('click', function () {
            _this.create($peer.value);
        }, false);
        $join.addEventListener('click', function () {
            _this.join($peer.value);
        }, false);
        this.currentSource = undefined;
        this.sync = undefined;
        this.shared = {
            'peer': undefined,
            'connectedPeers': {}
        };
    }

    _createClass(App, [{
        key: 'load',
        value: function load() {
            var _this2 = this;

            console.log('Load samples');
            (0, _loadSamples.loadSamples)(sampleURLS).then(function (samples) {
                // build play interface
                _this2.samples = samples;
                _this2.buildPads();
            });
        }
    }, {
        key: 'create',
        value: function create(peerID) {
            var _this3 = this;

            this.peer = new Peer(peerID, {
                key: 'ubgje3sm5p0evcxr',
                debug: 3,
                logFunction: function logFunction() {
                    var copy = Array.prototype.slice.call(arguments).join(' ');
                    console.log(copy);
                }
            });
            this.peer.on('open', function (id) {
                console.log("created");
                _this3.$play.style.display = "block";
                _this3.$connect.style.display = "none";
                _this3.sync = "master";
                _this3.shared['peer'] = id;
                _this3.peerMasterSync();
            });
        }

        // MASTER SYNC PROCESS

    }, {
        key: 'peerMasterSync',
        value: function peerMasterSync() {
            // Function to get the local time
            var getTimeFunction = function getTimeFunction() {
                return audioContext.currentTime;
            };
            // Initialize sync module
            this.syncMaster = new _SyncServerJs.SyncServer(getTimeFunction);
            // shared['sync'] = syncMaster
            //var peer = this.shared['peer'];
            this.peer.on('connection', this.slaveConnect.bind(this));
            // return new Promise(function(resolve, reject) {
            //     resolve('play');
            // })
            this.play(12);
        }
    }, {
        key: 'slaveConnect',
        value: function slaveConnect(conn) {
            console.log('CONNECTION !');
            this.shared['connectedPeers'] = this.shared['connectedPeers'] || {};
            var connectedPeers = this.shared['connectedPeers'];
            connectedPeers[conn.peer] = conn;

            var sendFunction = conn.send.bind(conn);
            var receiveFunction = conn.on.bind(conn);

            var syncTimeBegin = this.shared['syncTimeBegin'];
            sendFunction({
                'msg': 'sync:syncTimeBegin',
                args: [syncTimeBegin]
            });

            this.syncMaster.start(sendFunction, receiveFunction);

            conn.on('data', this.peerMasterDataListener.bind(this)(conn, this));

            // conn.on('close', ()=> {
            //     console.log('CLOSE')
            //     $peer.value = "";
            //     document.location.reload();
            // })
        }
    }, {
        key: 'peerMasterDataListener',
        value: function peerMasterDataListener(conn, that) {
            return function (data) {
                if (data.msg == 'sync:newPeer') {

                    that.shared['connectedPeers'][data.args[0]] = conn;
                    console.log("new peer:", that.shared['connectedPeers']);
                    // let syncTimeBegin = that.shared['syncTimeBegin'];
                    var syncTimeBegin = that.syncTimeBegin;
                    //
                    conn.send({
                        'msg': 'sync:syncTimeBegin',
                        args: [syncTimeBegin]
                    });
                    // if (that.shared['peer']) {
                    //     conn.send({
                    //         'msg': 'sample:change',
                    //         args: [that.shared['currentId'], that.shared['peer'].id]
                    //     })
                    // }
                }
                // if (data.msg == 'sample:change') {
                //     that.sampleChange(data);
                // }
            };
        }
    }, {
        key: 'sampleChange',
        value: function sampleChange(data) {
            console.log('CHANGE', data);
            var sampleId = data.args[0];
            var pId = data.args[1];
            var c = 'peer-played-' + pId;
            var tg = document.querySelector('.sample-' + sampleId);
            tg.style["border-color"] = "green";

            //$('.samples').find("a").removeClass(c);
            //$('.sample[data-id='+sampleId+']').addClass(c);
        }
    }, {
        key: 'join',
        value: function join(peerID) {
            var _this4 = this;

            var peer = new Peer({
                key: 'ubgje3sm5p0evcxr',
                debug: 3,
                logFunction: function logFunction() {
                    var copy = Array.prototype.slice.call(arguments).join(' ');
                    console.log(copy);
                }
            });
            var conn = peer.connect(peerID);
            this.shared['conn'] = conn;
            peer.on('error', function (err) {
                console.log(err);
            });
            conn.on('open', function () {
                console.log("join");
                _this4.$play.style.display = "block";
                _this4.$connect.style.display = "none";
                _this4.sync = "slave";
                _this4.peerSlaveSync();
            });
        }

        // SLAVE SYNC PROCESS

    }, {
        key: 'peerSlaveSync',
        value: function peerSlaveSync() {
            var conn = this.shared['conn'];
            this.shared['connectedPeers'] = this.shared['connectedPeers'] || {};
            var connectedPeers = this.shared['connectedPeers'];
            connectedPeers[conn.peer] = 1;

            conn.send({
                'msg': 'sync:newPeer',
                'args': [conn.peer]
            });
            //
            var getTimeFunction = function getTimeFunction() {
                return audioContext.currentTime;
            };
            // Function to send a message to the master peer
            var sendFunction = conn.send.bind(conn);
            // Function to receive a message from the master peer
            var receiveFunction = conn.on.bind(conn);

            console.log("!!!! this.syncSlave", this.syncSlave);
            var reportFunction = this.syncSlave.bind(this); // console.log; // FAKE

            this.syncSlave = new _SyncClientJs.SyncClient(getTimeFunction);
            this.syncSlave.start(sendFunction, receiveFunction, reportFunction);
            this.shared['sync'] = this.syncSlave;

            conn.on('data', this.peerSlaveDataListener.bind(this));

            conn.on('close', function () {
                $peer.value = "";
                document.location.reload();
            });
        }
    }, {
        key: 'syncSlave',
        value: function syncSlave(obj) {
            //console.log('HERE Im Syncrhonized', obj.timeOffset);
            this.syncTime = obj.timeOffset;
        }
    }, {
        key: 'peerSlaveDataListener',
        value: function peerSlaveDataListener(data) {
            if (data.msg == 'sync:syncTimeBegin') {
                // console.log("sync:syncTimeBegin", data.args[0]);
                var syncTimeBeginFromMaster = data.args[0];
                this.shared['syncTimeBeginFromMaster'] = syncTimeBeginFromMaster;
            }
            if (data.msg == 'sample:change') {
                this.sampleChange(data);
            }
        }
    }, {
        key: 'buildPads',
        value: function buildPads() {
            var _this5 = this;

            var _loop = function (i) {
                var $pad = document.createElement('button');
                var sampleName = sampleURLS[i].split('.')[1].split("/")[2];
                $pad.classList.add(sampleName);
                $pad.classList.add("sample-" + i);
                $pad.classList.add("sample");
                $pad.textContent = sampleName;
                $pad.addEventListener('click', function () {
                    _this5.play(i);
                }, false);
                _this5.$play.insertBefore($pad, _this5.$reset);
            };

            for (var i = 0; i < this.samples.length; i++) {
                _loop(i);
            }
        }
    }, {
        key: 'play',
        value: function play(padID) {
            if (this.currentSource) {
                this.currentSource.stop();
            }
            var source = audioContext.createBufferSource();
            this.currentSource = source;
            var audioBuffer = this.samples[padID];
            source.loop = true;
            source.connect(audioContext.destination);
            source.buffer = audioBuffer;
            var seek = 0;
            if (this.syncMaster) {
                if (!this.syncTimeBegin) {
                    this.syncTimeBegin = audioContext.currentTime;
                }
                var syncTime = audioContext.currentTime;
                var nbLoop = parseInt((syncTime - this.syncTimeBegin) / audioBuffer.duration);
                var lastBeginTime = this.syncTimeBegin + nbLoop * audioBuffer.duration;
                seek = syncTime - lastBeginTime;
                //
                // let cP = Object.keys(this.shared.connectedPeers);
                // for (var i = 0; i < cP.length; i++) {
                //     cP.send([padID, this.shared['peer']])

                // }
            } else {
                    //let syncSlave = this.shared['sync'];
                    var syncTimeBeginFromMaster = this.shared['syncTimeBeginFromMaster'];
                    var syncTime = this.syncSlave.getSyncTime();
                    var nbLoop = parseInt((syncTime - syncTimeBeginFromMaster) / audioBuffer.duration);
                    var lastBeginTime = syncTimeBeginFromMaster + nbLoop * audioBuffer.duration;
                    seek = syncTime - lastBeginTime;

                    // let conn = this.shared['conn'];
                    // console.log([padID, conn.id])
                    // conn.send({
                    //     'msg': 'sample:change',
                    //     'args': [padID, conn.id]
                    // });
                }
            source.start(0, seek);
            // pretty display
            var $allSamples = document.querySelectorAll('.sample');
            for (var i = 0; i < $allSamples.length; ++i) {
                $allSamples[i].style["background-color"] = "white";
            }
            var $target = document.querySelector('.sample-' + padID);
            $target.style["background-color"] = "red";
        }
    }]);

    return App;
})();

var app = new App();
//# sourceMappingURL=data:application/json;base64,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QUFDLE1BQU0sRUFBRSxFQUFFLENBQUMsRUFBRTtBQUMzQywyQkFBVyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxrQkFBa0IsQ0FBQyxHQUFHLE9BQU8sQ0FBQzthQUNwRDtBQUNELGdCQUFJLE9BQU8sR0FBRyxRQUFRLENBQUMsYUFBYSxDQUFDLFVBQVUsR0FBQyxLQUFLLENBQUMsQ0FBQztBQUN2RCxtQkFBTyxDQUFDLEtBQUssQ0FBQyxrQkFBa0IsQ0FBQyxHQUFHLEtBQUssQ0FBQztTQUU3Qzs7O1dBalNDLEdBQUc7OztBQW9TVCxJQUFJLEdBQUcsR0FBRyxJQUFJLEdBQUcsRUFBRSxDQUFDIiwiZmlsZSI6ImVzNi9TeW5jU2VydmVyLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtcbiAgICBsb2FkU2FtcGxlc1xufVxuZnJvbSAnLi9sb2FkU2FtcGxlcyc7XG5cbmltcG9ydCB7XG4gICAgU3luY1NlcnZlclxufVxuZnJvbSAnLi9TeW5jU2VydmVyLmpzJztcbmltcG9ydCB7XG4gICAgU3luY0NsaWVudFxufVxuZnJvbSAnLi9TeW5jQ2xpZW50LmpzJztcblxuY29uc3Qgd2F2ZXNBdWRpbyA9IHJlcXVpcmUoJ3dhdmVzLWF1ZGlvJyk7XG5jb25zdCBhdWRpb0NvbnRleHQgPSB3YXZlc0F1ZGlvLmF1ZGlvQ29udGV4dDtcblxuY29uc3QgJHBlZXIgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjcGVlcicpO1xuY29uc3QgJGNyZWF0ZSA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyNjcmVhdGUnKTtcbmNvbnN0ICRqb2luID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI2pvaW4nKTtcblxuY29uc3Qgc2FtcGxlVVJMUyA9IFsnLi9tZWRpYS9iYXNzLTEubXAzJywgJy4vbWVkaWEvYmFzcy0yLm1wMycsICcuL21lZGlhL2Jhc3MtMy5tcDMnLCAnLi9tZWRpYS9kcnVtczEtMS5tcDMnLCAnLi9tZWRpYS9kcnVtczEtMi5tcDMnLCAnLi9tZWRpYS9kcnVtczEtMy5tcDMnLCAnLi9tZWRpYS9kcnVtczItMS5tcDMnLCAnLi9tZWRpYS9kcnVtczItMi5tcDMnLCAnLi9tZWRpYS9kcnVtczMtMS5tcDMnLCAnLi9tZWRpYS9kcnVtczMtMi5tcDMnLCAnLi9tZWRpYS9kcnVtczMtMy5tcDMnLCAnLi9tZWRpYS9meC0xLm1wMycsICcuL21lZGlhL2d1aXRhci0xLm1wMycsICcuL21lZGlhL2d1aXRhci0yLm1wMycsICcuL21lZGlhL3N5bnRocy0xLm1wMycsICcuL21lZGlhL3N5bnRocy0xMC5tcDMnLCAnLi9tZWRpYS9zeW50aHMtMTEubXAzJywgJy4vbWVkaWEvc3ludGhzLTIubXAzJywgJy4vbWVkaWEvc3ludGhzLTMubXAzJywgJy4vbWVkaWEvc3ludGhzLTQubXAzJywgJy4vbWVkaWEvc3ludGhzLTUubXAzJywgJy4vbWVkaWEvc3ludGhzLTYubXAzJywgJy4vbWVkaWEvc3ludGhzLTcubXAzJywgJy4vbWVkaWEvc3ludGhzLTgubXAzJywgJy4vbWVkaWEvc3ludGhzLTkubXAzJywgJy4vbWVkaWEvdm9pY2UtMS5tcDMnLCAnLi9tZWRpYS92b2ljZS0yLm1wMycsICcuL21lZGlhL3ZvaWNlLTMubXAzJywgJy4vbWVkaWEvdm9pY2UtNC5tcDMnLCAnLi9tZWRpYS92b2ljZS01Lm1wMyddO1xuXG5jbGFzcyBBcHAge1xuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICB0aGlzLmxvYWQoKTtcbiAgICAgICAgdGhpcy4kcGxheSA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyNwbGF5Jyk7XG4gICAgICAgIHRoaXMuJHBsYXkuc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiO1xuICAgICAgICB0aGlzLiRyZXNldCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyNyZXNldCcpXG4gICAgICAgIHRoaXMuJHJlc2V0LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy4kcGxheS5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XG4gICAgICAgICAgICB0aGlzLiRjb25uZWN0LnN0eWxlLmRpc3BsYXkgPSBcImJsb2NrXCI7XG4gICAgICAgICAgICAvL2NvbnNvbGUubG9nKHRoaXMuc2hhcmVkLmNvbm5lY3RlZFBlZXJzKTtcbiAgICAgICAgICAgIHZhciBjUCA9IE9iamVjdC5rZXlzKHRoaXMuc2hhcmVkLmNvbm5lY3RlZFBlZXJzKTtcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY1AubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICB2YXIgdmFsID0gdGhpcy5zaGFyZWQuY29ubmVjdGVkUGVlcnNbY1BbaV1dO1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKHZhbClcbiAgICAgICAgICAgICAgICB2YWwuZGF0YUNoYW5uZWwuY2xvc2UoKTtcbiAgICAgICAgICAgICAgICAvLyB1c2UgdmFsXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAkcGVlci52YWx1ZSA9IFwiXCI7XG4gICAgICAgICAgICBkb2N1bWVudC5sb2NhdGlvbi5yZWxvYWQoKTtcbiAgICAgICAgfSlcbiAgICAgICAgdGhpcy4kY29ubmVjdCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyNjb25uZWN0Jyk7XG4gICAgICAgIHRoaXMuc2FtcGxlcyA9IFtdO1xuICAgICAgICAkY3JlYXRlLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5jcmVhdGUoJHBlZXIudmFsdWUpXG4gICAgICAgIH0sIGZhbHNlKVxuICAgICAgICAkam9pbi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICAgICAgICAgIHRoaXMuam9pbigkcGVlci52YWx1ZSlcbiAgICAgICAgfSwgZmFsc2UpXG4gICAgICAgIHRoaXMuY3VycmVudFNvdXJjZSA9IHVuZGVmaW5lZDtcbiAgICAgICAgdGhpcy5zeW5jID0gdW5kZWZpbmVkXG4gICAgICAgIHRoaXMuc2hhcmVkID0ge1xuICAgICAgICAgICAgJ3BlZXInOiB1bmRlZmluZWQsXG4gICAgICAgICAgICAnY29ubmVjdGVkUGVlcnMnOiB7fVxuICAgICAgICB9XG4gICAgfVxuICAgIGxvYWQoKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdMb2FkIHNhbXBsZXMnKTtcbiAgICAgICAgbG9hZFNhbXBsZXMoc2FtcGxlVVJMUykudGhlbigoc2FtcGxlcykgPT4ge1xuICAgICAgICAgICAgLy8gYnVpbGQgcGxheSBpbnRlcmZhY2VcbiAgICAgICAgICAgIHRoaXMuc2FtcGxlcyA9IHNhbXBsZXM7XG4gICAgICAgICAgICB0aGlzLmJ1aWxkUGFkcygpXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBjcmVhdGUocGVlcklEKSB7XG4gICAgICAgIHRoaXMucGVlciA9IG5ldyBQZWVyKHBlZXJJRCwge1xuICAgICAgICAgICAga2V5OiAndWJnamUzc201cDBldmN4cicsXG4gICAgICAgICAgICBkZWJ1ZzogMyxcbiAgICAgICAgICAgIGxvZ0Z1bmN0aW9uOiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICB2YXIgY29weSA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cykuam9pbignICcpO1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGNvcHkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5wZWVyLm9uKCdvcGVuJywgKGlkKSA9PiB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhcImNyZWF0ZWRcIilcbiAgICAgICAgICAgIHRoaXMuJHBsYXkuc3R5bGUuZGlzcGxheSA9IFwiYmxvY2tcIjtcbiAgICAgICAgICAgIHRoaXMuJGNvbm5lY3Quc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiO1xuICAgICAgICAgICAgdGhpcy5zeW5jID0gXCJtYXN0ZXJcIjtcbiAgICAgICAgICAgIHRoaXMuc2hhcmVkWydwZWVyJ10gPSBpZDtcbiAgICAgICAgICAgIHRoaXMucGVlck1hc3RlclN5bmMoKTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gTUFTVEVSIFNZTkMgUFJPQ0VTU1xuXG4gICAgcGVlck1hc3RlclN5bmMoKSB7XG4gICAgICAgIC8vIEZ1bmN0aW9uIHRvIGdldCB0aGUgbG9jYWwgdGltZVxuICAgICAgICBsZXQgZ2V0VGltZUZ1bmN0aW9uID0gKCkgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIGF1ZGlvQ29udGV4dC5jdXJyZW50VGltZTtcbiAgICAgICAgfTtcbiAgICAgICAgLy8gSW5pdGlhbGl6ZSBzeW5jIG1vZHVsZVxuICAgICAgICB0aGlzLnN5bmNNYXN0ZXIgPSBuZXcgU3luY1NlcnZlcihnZXRUaW1lRnVuY3Rpb24pO1xuICAgICAgICAvLyBzaGFyZWRbJ3N5bmMnXSA9IHN5bmNNYXN0ZXJcbiAgICAgICAgLy92YXIgcGVlciA9IHRoaXMuc2hhcmVkWydwZWVyJ107XG4gICAgICAgIHRoaXMucGVlci5vbignY29ubmVjdGlvbicsIHRoaXMuc2xhdmVDb25uZWN0LmJpbmQodGhpcykpO1xuICAgICAgICAvLyByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgIC8vICAgICByZXNvbHZlKCdwbGF5Jyk7XG4gICAgICAgIC8vIH0pXG4gICAgICAgIHRoaXMucGxheSgxMik7XG4gICAgfVxuXG4gICAgc2xhdmVDb25uZWN0KGNvbm4pIHtcbiAgICAgICAgY29uc29sZS5sb2coJ0NPTk5FQ1RJT04gIScpXG4gICAgICAgIHRoaXMuc2hhcmVkWydjb25uZWN0ZWRQZWVycyddID0gdGhpcy5zaGFyZWRbJ2Nvbm5lY3RlZFBlZXJzJ10gfHwge307XG4gICAgICAgIGxldCBjb25uZWN0ZWRQZWVycyA9IHRoaXMuc2hhcmVkWydjb25uZWN0ZWRQZWVycyddO1xuICAgICAgICBjb25uZWN0ZWRQZWVyc1tjb25uLnBlZXJdID0gY29ubjtcblxuICAgICAgICBsZXQgc2VuZEZ1bmN0aW9uID0gY29ubi5zZW5kLmJpbmQoY29ubilcbiAgICAgICAgbGV0IHJlY2VpdmVGdW5jdGlvbiA9IGNvbm4ub24uYmluZChjb25uKVxuXG4gICAgICAgIGxldCBzeW5jVGltZUJlZ2luID0gdGhpcy5zaGFyZWRbJ3N5bmNUaW1lQmVnaW4nXTtcbiAgICAgICAgc2VuZEZ1bmN0aW9uKHtcbiAgICAgICAgICAgICdtc2cnOiAnc3luYzpzeW5jVGltZUJlZ2luJyxcbiAgICAgICAgICAgIGFyZ3M6IFtzeW5jVGltZUJlZ2luXVxuICAgICAgICB9KVxuXG4gICAgICAgIHRoaXMuc3luY01hc3Rlci5zdGFydChzZW5kRnVuY3Rpb24sIHJlY2VpdmVGdW5jdGlvbik7XG5cbiAgICAgICAgY29ubi5vbignZGF0YScsIHRoaXMucGVlck1hc3RlckRhdGFMaXN0ZW5lci5iaW5kKHRoaXMpKGNvbm4sIHRoaXMpKVxuXG4gICAgICAgIC8vIGNvbm4ub24oJ2Nsb3NlJywgKCk9PiB7XG4gICAgICAgIC8vICAgICBjb25zb2xlLmxvZygnQ0xPU0UnKVxuICAgICAgICAvLyAgICAgJHBlZXIudmFsdWUgPSBcIlwiO1xuICAgICAgICAvLyAgICAgZG9jdW1lbnQubG9jYXRpb24ucmVsb2FkKCk7XG4gICAgICAgIC8vIH0pXG4gICAgfVxuXG4gICAgcGVlck1hc3RlckRhdGFMaXN0ZW5lcihjb25uLCB0aGF0KSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbihkYXRhKSB7XG4gICAgICAgICAgICBpZiAoZGF0YS5tc2cgPT0gJ3N5bmM6bmV3UGVlcicpIHtcblxuICAgICAgICAgICAgICAgIHRoYXQuc2hhcmVkWydjb25uZWN0ZWRQZWVycyddW2RhdGEuYXJnc1swXV0gPSBjb25uO1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwibmV3IHBlZXI6XCIsIHRoYXQuc2hhcmVkWydjb25uZWN0ZWRQZWVycyddKVxuICAgICAgICAgICAgICAgIC8vIGxldCBzeW5jVGltZUJlZ2luID0gdGhhdC5zaGFyZWRbJ3N5bmNUaW1lQmVnaW4nXTtcbiAgICAgICAgICAgICAgICBsZXQgc3luY1RpbWVCZWdpbiA9IHRoYXQuc3luY1RpbWVCZWdpbjtcbiAgICAgICAgICAgICAgICAvL1xuICAgICAgICAgICAgICAgIGNvbm4uc2VuZCh7XG4gICAgICAgICAgICAgICAgICAgICdtc2cnOiAnc3luYzpzeW5jVGltZUJlZ2luJyxcbiAgICAgICAgICAgICAgICAgICAgYXJnczogW3N5bmNUaW1lQmVnaW5dXG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAvLyBpZiAodGhhdC5zaGFyZWRbJ3BlZXInXSkge1xuICAgICAgICAgICAgICAgIC8vICAgICBjb25uLnNlbmQoe1xuICAgICAgICAgICAgICAgIC8vICAgICAgICAgJ21zZyc6ICdzYW1wbGU6Y2hhbmdlJyxcbiAgICAgICAgICAgICAgICAvLyAgICAgICAgIGFyZ3M6IFt0aGF0LnNoYXJlZFsnY3VycmVudElkJ10sIHRoYXQuc2hhcmVkWydwZWVyJ10uaWRdXG4gICAgICAgICAgICAgICAgLy8gICAgIH0pXG4gICAgICAgICAgICAgICAgLy8gfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gaWYgKGRhdGEubXNnID09ICdzYW1wbGU6Y2hhbmdlJykge1xuICAgICAgICAgICAgLy8gICAgIHRoYXQuc2FtcGxlQ2hhbmdlKGRhdGEpO1xuICAgICAgICAgICAgLy8gfVxuICAgICAgICB9XG5cbiAgICB9XG5cblxuICAgIHNhbXBsZUNoYW5nZShkYXRhKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdDSEFOR0UnLCBkYXRhKTtcbiAgICAgICAgbGV0IHNhbXBsZUlkID0gZGF0YS5hcmdzWzBdO1xuICAgICAgICBsZXQgcElkID0gZGF0YS5hcmdzWzFdO1xuICAgICAgICBsZXQgYyA9ICdwZWVyLXBsYXllZC0nICsgcElkO1xuICAgICAgICBsZXQgdGcgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcuc2FtcGxlLScrc2FtcGxlSWQpO1xuICAgICAgICB0Zy5zdHlsZVtcImJvcmRlci1jb2xvclwiXSA9IFwiZ3JlZW5cIjtcblxuICAgICAgICAvLyQoJy5zYW1wbGVzJykuZmluZChcImFcIikucmVtb3ZlQ2xhc3MoYyk7XG4gICAgICAgIC8vJCgnLnNhbXBsZVtkYXRhLWlkPScrc2FtcGxlSWQrJ10nKS5hZGRDbGFzcyhjKTtcbiAgICB9XG5cbiAgICBqb2luKHBlZXJJRCkge1xuICAgICAgICBsZXQgcGVlciA9IG5ldyBQZWVyKHtcbiAgICAgICAgICAgIGtleTogJ3ViZ2plM3NtNXAwZXZjeHInLFxuICAgICAgICAgICAgZGVidWc6IDMsXG4gICAgICAgICAgICBsb2dGdW5jdGlvbjogZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgdmFyIGNvcHkgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpLmpvaW4oJyAnKTtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhjb3B5KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIHZhciBjb25uID0gcGVlci5jb25uZWN0KHBlZXJJRCk7XG4gICAgICAgIHRoaXMuc2hhcmVkWydjb25uJ10gPSBjb25uO1xuICAgICAgICBwZWVyLm9uKCdlcnJvcicsIGZ1bmN0aW9uKGVycikge1xuICAgICAgICAgICAgY29uc29sZS5sb2coZXJyKTtcbiAgICAgICAgfSlcbiAgICAgICAgY29ubi5vbignb3BlbicsICgpID0+IHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiam9pblwiKVxuICAgICAgICAgICAgdGhpcy4kcGxheS5zdHlsZS5kaXNwbGF5ID0gXCJibG9ja1wiO1xuICAgICAgICAgICAgdGhpcy4kY29ubmVjdC5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XG4gICAgICAgICAgICB0aGlzLnN5bmMgPSBcInNsYXZlXCI7XG4gICAgICAgICAgICB0aGlzLnBlZXJTbGF2ZVN5bmMoKVxuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBTTEFWRSBTWU5DIFBST0NFU1NcblxuXG4gICAgcGVlclNsYXZlU3luYygpIHtcbiAgICAgICAgbGV0IGNvbm4gPSB0aGlzLnNoYXJlZFsnY29ubiddO1xuICAgICAgICB0aGlzLnNoYXJlZFsnY29ubmVjdGVkUGVlcnMnXSA9IHRoaXMuc2hhcmVkWydjb25uZWN0ZWRQZWVycyddIHx8IHt9O1xuICAgICAgICBsZXQgY29ubmVjdGVkUGVlcnMgPSB0aGlzLnNoYXJlZFsnY29ubmVjdGVkUGVlcnMnXTtcbiAgICAgICAgY29ubmVjdGVkUGVlcnNbY29ubi5wZWVyXSA9IDE7XG5cbiAgICAgICAgY29ubi5zZW5kKHtcbiAgICAgICAgICAgICdtc2cnOiAnc3luYzpuZXdQZWVyJyxcbiAgICAgICAgICAgICdhcmdzJzogW2Nvbm4ucGVlcl1cbiAgICAgICAgfSk7XG4gICAgICAgIC8vXG4gICAgICAgIGxldCBnZXRUaW1lRnVuY3Rpb24gPSAoKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gYXVkaW9Db250ZXh0LmN1cnJlbnRUaW1lO1xuICAgICAgICB9O1xuICAgICAgICAvLyBGdW5jdGlvbiB0byBzZW5kIGEgbWVzc2FnZSB0byB0aGUgbWFzdGVyIHBlZXJcbiAgICAgICAgdmFyIHNlbmRGdW5jdGlvbiA9IGNvbm4uc2VuZC5iaW5kKGNvbm4pO1xuICAgICAgICAvLyBGdW5jdGlvbiB0byByZWNlaXZlIGEgbWVzc2FnZSBmcm9tIHRoZSBtYXN0ZXIgcGVlclxuICAgICAgICB2YXIgcmVjZWl2ZUZ1bmN0aW9uID0gY29ubi5vbi5iaW5kKGNvbm4pO1xuXG4gICAgICAgIGNvbnNvbGUubG9nKFwiISEhISB0aGlzLnN5bmNTbGF2ZVwiLCB0aGlzLnN5bmNTbGF2ZSlcbiAgICAgICAgdmFyIHJlcG9ydEZ1bmN0aW9uID0gdGhpcy5zeW5jU2xhdmUuYmluZCh0aGlzKTsgLy8gY29uc29sZS5sb2c7IC8vIEZBS0VcblxuICAgICAgICB0aGlzLnN5bmNTbGF2ZSA9IG5ldyBTeW5jQ2xpZW50KGdldFRpbWVGdW5jdGlvbik7XG4gICAgICAgIHRoaXMuc3luY1NsYXZlLnN0YXJ0KHNlbmRGdW5jdGlvbiwgcmVjZWl2ZUZ1bmN0aW9uLCByZXBvcnRGdW5jdGlvbik7XG4gICAgICAgIHRoaXMuc2hhcmVkWydzeW5jJ10gPSB0aGlzLnN5bmNTbGF2ZTtcblxuICAgICAgICBjb25uLm9uKCdkYXRhJywgdGhpcy5wZWVyU2xhdmVEYXRhTGlzdGVuZXIuYmluZCh0aGlzKSlcblxuICAgICAgICBjb25uLm9uKCdjbG9zZScsICgpPT4ge1xuICAgICAgICAgICAgJHBlZXIudmFsdWUgPSBcIlwiO1xuICAgICAgICAgICAgZG9jdW1lbnQubG9jYXRpb24ucmVsb2FkKCk7XG4gICAgICAgIH0pXG5cbiAgICB9XG5cbiAgICBzeW5jU2xhdmUob2JqKSB7XG4gICAgICAgIC8vY29uc29sZS5sb2coJ0hFUkUgSW0gU3luY3Job25pemVkJywgb2JqLnRpbWVPZmZzZXQpO1xuICAgICAgICB0aGlzLnN5bmNUaW1lID0gb2JqLnRpbWVPZmZzZXQ7XG4gICAgfVxuXG4gICAgcGVlclNsYXZlRGF0YUxpc3RlbmVyKGRhdGEpIHtcbiAgICAgICAgaWYgKGRhdGEubXNnID09ICdzeW5jOnN5bmNUaW1lQmVnaW4nKSB7XG4gICAgICAgICAgICAvLyBjb25zb2xlLmxvZyhcInN5bmM6c3luY1RpbWVCZWdpblwiLCBkYXRhLmFyZ3NbMF0pO1xuICAgICAgICAgICAgdmFyIHN5bmNUaW1lQmVnaW5Gcm9tTWFzdGVyID0gZGF0YS5hcmdzWzBdO1xuICAgICAgICAgICAgdGhpcy5zaGFyZWRbJ3N5bmNUaW1lQmVnaW5Gcm9tTWFzdGVyJ10gPSBzeW5jVGltZUJlZ2luRnJvbU1hc3RlcjtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZGF0YS5tc2cgPT0gJ3NhbXBsZTpjaGFuZ2UnKSB7XG4gICAgICAgICAgICB0aGlzLnNhbXBsZUNoYW5nZShkYXRhKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGJ1aWxkUGFkcygpIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLnNhbXBsZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGxldCAkcGFkID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYnV0dG9uJyk7XG4gICAgICAgICAgICBsZXQgc2FtcGxlTmFtZSA9IHNhbXBsZVVSTFNbaV0uc3BsaXQoJy4nKVsxXS5zcGxpdChcIi9cIilbMl1cbiAgICAgICAgICAgICRwYWQuY2xhc3NMaXN0LmFkZChzYW1wbGVOYW1lKVxuICAgICAgICAgICAgJHBhZC5jbGFzc0xpc3QuYWRkKFwic2FtcGxlLVwiK2kpO1xuICAgICAgICAgICAgJHBhZC5jbGFzc0xpc3QuYWRkKFwic2FtcGxlXCIpO1xuICAgICAgICAgICAgJHBhZC50ZXh0Q29udGVudCA9IHNhbXBsZU5hbWU7XG4gICAgICAgICAgICAkcGFkLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMucGxheShpKTtcbiAgICAgICAgICAgIH0sIGZhbHNlKTtcbiAgICAgICAgICAgIHRoaXMuJHBsYXkuaW5zZXJ0QmVmb3JlKCRwYWQsIHRoaXMuJHJlc2V0KVxuICAgICAgICB9XG4gICAgfVxuICAgIHBsYXkocGFkSUQpIHtcbiAgICAgICAgaWYgKHRoaXMuY3VycmVudFNvdXJjZSkge1xuICAgICAgICAgICAgdGhpcy5jdXJyZW50U291cmNlLnN0b3AoKVxuICAgICAgICB9XG4gICAgICAgIGxldCBzb3VyY2UgPSBhdWRpb0NvbnRleHQuY3JlYXRlQnVmZmVyU291cmNlKClcbiAgICAgICAgdGhpcy5jdXJyZW50U291cmNlID0gc291cmNlO1xuICAgICAgICBsZXQgYXVkaW9CdWZmZXIgPSB0aGlzLnNhbXBsZXNbcGFkSURdO1xuICAgICAgICBzb3VyY2UubG9vcCA9IHRydWU7XG4gICAgICAgIHNvdXJjZS5jb25uZWN0KGF1ZGlvQ29udGV4dC5kZXN0aW5hdGlvbik7XG4gICAgICAgIHNvdXJjZS5idWZmZXIgPSBhdWRpb0J1ZmZlcjtcbiAgICAgICAgbGV0IHNlZWsgPSAwO1xuICAgICAgICBpZiAodGhpcy5zeW5jTWFzdGVyKSB7XG4gICAgICAgICAgICBpZiAoIXRoaXMuc3luY1RpbWVCZWdpbikge1xuICAgICAgICAgICAgICAgIHRoaXMuc3luY1RpbWVCZWdpbiA9IGF1ZGlvQ29udGV4dC5jdXJyZW50VGltZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGxldCBzeW5jVGltZSA9IGF1ZGlvQ29udGV4dC5jdXJyZW50VGltZTtcbiAgICAgICAgICAgIGxldCBuYkxvb3AgPSBwYXJzZUludCgoc3luY1RpbWUgLSB0aGlzLnN5bmNUaW1lQmVnaW4pIC8gYXVkaW9CdWZmZXIuZHVyYXRpb24pO1xuICAgICAgICAgICAgbGV0IGxhc3RCZWdpblRpbWUgPSB0aGlzLnN5bmNUaW1lQmVnaW4gKyBuYkxvb3AgKiBhdWRpb0J1ZmZlci5kdXJhdGlvbjtcbiAgICAgICAgICAgIHNlZWsgPSBzeW5jVGltZSAtIGxhc3RCZWdpblRpbWU7XG4gICAgICAgICAgICAvL1xuICAgICAgICAgICAgLy8gbGV0IGNQID0gT2JqZWN0LmtleXModGhpcy5zaGFyZWQuY29ubmVjdGVkUGVlcnMpO1xuICAgICAgICAgICAgLy8gZm9yICh2YXIgaSA9IDA7IGkgPCBjUC5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgLy8gICAgIGNQLnNlbmQoW3BhZElELCB0aGlzLnNoYXJlZFsncGVlciddXSlcblxuICAgICAgICAgICAgLy8gfVxuXG5cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvL2xldCBzeW5jU2xhdmUgPSB0aGlzLnNoYXJlZFsnc3luYyddO1xuICAgICAgICAgICAgICAgIGxldCBzeW5jVGltZUJlZ2luRnJvbU1hc3RlciA9IHRoaXMuc2hhcmVkWydzeW5jVGltZUJlZ2luRnJvbU1hc3RlciddO1xuICAgICAgICAgICAgICAgIGxldCBzeW5jVGltZSA9IHRoaXMuc3luY1NsYXZlLmdldFN5bmNUaW1lKCk7XG4gICAgICAgICAgICAgICAgbGV0IG5iTG9vcCA9IHBhcnNlSW50KChzeW5jVGltZSAtIHN5bmNUaW1lQmVnaW5Gcm9tTWFzdGVyKS9hdWRpb0J1ZmZlci5kdXJhdGlvbik7XG4gICAgICAgICAgICAgICAgbGV0IGxhc3RCZWdpblRpbWUgPSBzeW5jVGltZUJlZ2luRnJvbU1hc3RlciArIG5iTG9vcCAqIGF1ZGlvQnVmZmVyLmR1cmF0aW9uO1xuICAgICAgICAgICAgICAgIHNlZWsgPSBzeW5jVGltZS1sYXN0QmVnaW5UaW1lO1xuXG4gICAgICAgICAgICAgICAgLy8gbGV0IGNvbm4gPSB0aGlzLnNoYXJlZFsnY29ubiddO1xuICAgICAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKFtwYWRJRCwgY29ubi5pZF0pXG4gICAgICAgICAgICAgICAgLy8gY29ubi5zZW5kKHtcbiAgICAgICAgICAgICAgICAvLyAgICAgJ21zZyc6ICdzYW1wbGU6Y2hhbmdlJyxcbiAgICAgICAgICAgICAgICAvLyAgICAgJ2FyZ3MnOiBbcGFkSUQsIGNvbm4uaWRdXG4gICAgICAgICAgICAgICAgLy8gfSk7XG5cbiAgICAgICAgfVxuICAgICAgICBzb3VyY2Uuc3RhcnQoMCwgc2Vlayk7XG4gICAgICAgIC8vIHByZXR0eSBkaXNwbGF5XG4gICAgICAgIGxldCAkYWxsU2FtcGxlcyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJy5zYW1wbGUnKTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCAkYWxsU2FtcGxlcy5sZW5ndGg7ICsraSkge1xuICAgICAgICAgICRhbGxTYW1wbGVzW2ldLnN0eWxlW1wiYmFja2dyb3VuZC1jb2xvclwiXSA9IFwid2hpdGVcIjtcbiAgICAgICAgfVxuICAgICAgICBsZXQgJHRhcmdldCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5zYW1wbGUtJytwYWRJRCk7XG4gICAgICAgICR0YXJnZXQuc3R5bGVbXCJiYWNrZ3JvdW5kLWNvbG9yXCJdID0gXCJyZWRcIjtcblxuICAgIH1cbn1cblxubGV0IGFwcCA9IG5ldyBBcHAoKTtcbiJdfQ==