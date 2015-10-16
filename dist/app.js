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

            conn.on('close', function () {
                console.log('CLOSE');
                $peer.value = "";
                document.location.reload();
            });
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
//# sourceMappingURL=data:application/json;base64,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OztpQkFTckM7QUFDRCxrQkFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUM7O0FBRXRCLGdCQUFJLFdBQVcsR0FBRyxRQUFRLENBQUMsZ0JBQWdCLENBQUMsU0FBUyxDQUFDLENBQUM7QUFDdkQsaUJBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxXQUFXLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQyxFQUFFO0FBQzNDLDJCQUFXLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLGtCQUFrQixDQUFDLEdBQUcsT0FBTyxDQUFDO2FBQ3BEO0FBQ0QsZ0JBQUksT0FBTyxHQUFHLFFBQVEsQ0FBQyxhQUFhLENBQUMsVUFBVSxHQUFDLEtBQUssQ0FBQyxDQUFDO0FBQ3ZELG1CQUFPLENBQUMsS0FBSyxDQUFDLGtCQUFrQixDQUFDLEdBQUcsS0FBSyxDQUFDO1NBRTdDOzs7V0FqU0MsR0FBRzs7O0FBb1NULElBQUksR0FBRyxHQUFHLElBQUksR0FBRyxFQUFFLENBQUMiLCJmaWxlIjoiZXM2L1N5bmNTZXJ2ZXIuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge1xuICAgIGxvYWRTYW1wbGVzXG59XG5mcm9tICcuL2xvYWRTYW1wbGVzJztcblxuaW1wb3J0IHtcbiAgICBTeW5jU2VydmVyXG59XG5mcm9tICcuL1N5bmNTZXJ2ZXIuanMnO1xuaW1wb3J0IHtcbiAgICBTeW5jQ2xpZW50XG59XG5mcm9tICcuL1N5bmNDbGllbnQuanMnO1xuXG5jb25zdCB3YXZlc0F1ZGlvID0gcmVxdWlyZSgnd2F2ZXMtYXVkaW8nKTtcbmNvbnN0IGF1ZGlvQ29udGV4dCA9IHdhdmVzQXVkaW8uYXVkaW9Db250ZXh0O1xuXG5jb25zdCAkcGVlciA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyNwZWVyJyk7XG5jb25zdCAkY3JlYXRlID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI2NyZWF0ZScpO1xuY29uc3QgJGpvaW4gPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjam9pbicpO1xuXG5jb25zdCBzYW1wbGVVUkxTID0gWycuL21lZGlhL2Jhc3MtMS5tcDMnLCAnLi9tZWRpYS9iYXNzLTIubXAzJywgJy4vbWVkaWEvYmFzcy0zLm1wMycsICcuL21lZGlhL2RydW1zMS0xLm1wMycsICcuL21lZGlhL2RydW1zMS0yLm1wMycsICcuL21lZGlhL2RydW1zMS0zLm1wMycsICcuL21lZGlhL2RydW1zMi0xLm1wMycsICcuL21lZGlhL2RydW1zMi0yLm1wMycsICcuL21lZGlhL2RydW1zMy0xLm1wMycsICcuL21lZGlhL2RydW1zMy0yLm1wMycsICcuL21lZGlhL2RydW1zMy0zLm1wMycsICcuL21lZGlhL2Z4LTEubXAzJywgJy4vbWVkaWEvZ3VpdGFyLTEubXAzJywgJy4vbWVkaWEvZ3VpdGFyLTIubXAzJywgJy4vbWVkaWEvc3ludGhzLTEubXAzJywgJy4vbWVkaWEvc3ludGhzLTEwLm1wMycsICcuL21lZGlhL3N5bnRocy0xMS5tcDMnLCAnLi9tZWRpYS9zeW50aHMtMi5tcDMnLCAnLi9tZWRpYS9zeW50aHMtMy5tcDMnLCAnLi9tZWRpYS9zeW50aHMtNC5tcDMnLCAnLi9tZWRpYS9zeW50aHMtNS5tcDMnLCAnLi9tZWRpYS9zeW50aHMtNi5tcDMnLCAnLi9tZWRpYS9zeW50aHMtNy5tcDMnLCAnLi9tZWRpYS9zeW50aHMtOC5tcDMnLCAnLi9tZWRpYS9zeW50aHMtOS5tcDMnLCAnLi9tZWRpYS92b2ljZS0xLm1wMycsICcuL21lZGlhL3ZvaWNlLTIubXAzJywgJy4vbWVkaWEvdm9pY2UtMy5tcDMnLCAnLi9tZWRpYS92b2ljZS00Lm1wMycsICcuL21lZGlhL3ZvaWNlLTUubXAzJ107XG5cbmNsYXNzIEFwcCB7XG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHRoaXMubG9hZCgpO1xuICAgICAgICB0aGlzLiRwbGF5ID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI3BsYXknKTtcbiAgICAgICAgdGhpcy4kcGxheS5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XG4gICAgICAgIHRoaXMuJHJlc2V0ID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI3Jlc2V0JylcbiAgICAgICAgdGhpcy4kcmVzZXQuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLiRwbGF5LnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIjtcbiAgICAgICAgICAgIHRoaXMuJGNvbm5lY3Quc3R5bGUuZGlzcGxheSA9IFwiYmxvY2tcIjtcbiAgICAgICAgICAgIC8vY29uc29sZS5sb2codGhpcy5zaGFyZWQuY29ubmVjdGVkUGVlcnMpO1xuICAgICAgICAgICAgdmFyIGNQID0gT2JqZWN0LmtleXModGhpcy5zaGFyZWQuY29ubmVjdGVkUGVlcnMpO1xuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjUC5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIHZhciB2YWwgPSB0aGlzLnNoYXJlZC5jb25uZWN0ZWRQZWVyc1tjUFtpXV07XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2codmFsKVxuICAgICAgICAgICAgICAgIHZhbC5kYXRhQ2hhbm5lbC5jbG9zZSgpO1xuICAgICAgICAgICAgICAgIC8vIHVzZSB2YWxcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgICRwZWVyLnZhbHVlID0gXCJcIjtcbiAgICAgICAgICAgIGRvY3VtZW50LmxvY2F0aW9uLnJlbG9hZCgpO1xuICAgICAgICB9KVxuICAgICAgICB0aGlzLiRjb25uZWN0ID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI2Nvbm5lY3QnKTtcbiAgICAgICAgdGhpcy5zYW1wbGVzID0gW107XG4gICAgICAgICRjcmVhdGUuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLmNyZWF0ZSgkcGVlci52YWx1ZSlcbiAgICAgICAgfSwgZmFsc2UpXG4gICAgICAgICRqb2luLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5qb2luKCRwZWVyLnZhbHVlKVxuICAgICAgICB9LCBmYWxzZSlcbiAgICAgICAgdGhpcy5jdXJyZW50U291cmNlID0gdW5kZWZpbmVkO1xuICAgICAgICB0aGlzLnN5bmMgPSB1bmRlZmluZWRcbiAgICAgICAgdGhpcy5zaGFyZWQgPSB7XG4gICAgICAgICAgICAncGVlcic6IHVuZGVmaW5lZCxcbiAgICAgICAgICAgICdjb25uZWN0ZWRQZWVycyc6IHt9XG4gICAgICAgIH1cbiAgICB9XG4gICAgbG9hZCgpIHtcbiAgICAgICAgY29uc29sZS5sb2coJ0xvYWQgc2FtcGxlcycpO1xuICAgICAgICBsb2FkU2FtcGxlcyhzYW1wbGVVUkxTKS50aGVuKChzYW1wbGVzKSA9PiB7XG4gICAgICAgICAgICAvLyBidWlsZCBwbGF5IGludGVyZmFjZVxuICAgICAgICAgICAgdGhpcy5zYW1wbGVzID0gc2FtcGxlcztcbiAgICAgICAgICAgIHRoaXMuYnVpbGRQYWRzKClcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIGNyZWF0ZShwZWVySUQpIHtcbiAgICAgICAgdGhpcy5wZWVyID0gbmV3IFBlZXIocGVlcklELCB7XG4gICAgICAgICAgICBrZXk6ICd1YmdqZTNzbTVwMGV2Y3hyJyxcbiAgICAgICAgICAgIGRlYnVnOiAzLFxuICAgICAgICAgICAgbG9nRnVuY3Rpb246IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIHZhciBjb3B5ID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKS5qb2luKCcgJyk7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coY29weSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLnBlZXIub24oJ29wZW4nLCAoaWQpID0+IHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiY3JlYXRlZFwiKVxuICAgICAgICAgICAgdGhpcy4kcGxheS5zdHlsZS5kaXNwbGF5ID0gXCJibG9ja1wiO1xuICAgICAgICAgICAgdGhpcy4kY29ubmVjdC5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XG4gICAgICAgICAgICB0aGlzLnN5bmMgPSBcIm1hc3RlclwiO1xuICAgICAgICAgICAgdGhpcy5zaGFyZWRbJ3BlZXInXSA9IGlkO1xuICAgICAgICAgICAgdGhpcy5wZWVyTWFzdGVyU3luYygpO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBNQVNURVIgU1lOQyBQUk9DRVNTXG5cbiAgICBwZWVyTWFzdGVyU3luYygpIHtcbiAgICAgICAgLy8gRnVuY3Rpb24gdG8gZ2V0IHRoZSBsb2NhbCB0aW1lXG4gICAgICAgIGxldCBnZXRUaW1lRnVuY3Rpb24gPSAoKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gYXVkaW9Db250ZXh0LmN1cnJlbnRUaW1lO1xuICAgICAgICB9O1xuICAgICAgICAvLyBJbml0aWFsaXplIHN5bmMgbW9kdWxlXG4gICAgICAgIHRoaXMuc3luY01hc3RlciA9IG5ldyBTeW5jU2VydmVyKGdldFRpbWVGdW5jdGlvbik7XG4gICAgICAgIC8vIHNoYXJlZFsnc3luYyddID0gc3luY01hc3RlclxuICAgICAgICAvL3ZhciBwZWVyID0gdGhpcy5zaGFyZWRbJ3BlZXInXTtcbiAgICAgICAgdGhpcy5wZWVyLm9uKCdjb25uZWN0aW9uJywgdGhpcy5zbGF2ZUNvbm5lY3QuYmluZCh0aGlzKSk7XG4gICAgICAgIC8vIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgICAgLy8gICAgIHJlc29sdmUoJ3BsYXknKTtcbiAgICAgICAgLy8gfSlcbiAgICAgICAgdGhpcy5wbGF5KDEyKTtcbiAgICB9XG5cbiAgICBzbGF2ZUNvbm5lY3QoY29ubikge1xuICAgICAgICBjb25zb2xlLmxvZygnQ09OTkVDVElPTiAhJylcbiAgICAgICAgdGhpcy5zaGFyZWRbJ2Nvbm5lY3RlZFBlZXJzJ10gPSB0aGlzLnNoYXJlZFsnY29ubmVjdGVkUGVlcnMnXSB8fCB7fTtcbiAgICAgICAgbGV0IGNvbm5lY3RlZFBlZXJzID0gdGhpcy5zaGFyZWRbJ2Nvbm5lY3RlZFBlZXJzJ107XG4gICAgICAgIGNvbm5lY3RlZFBlZXJzW2Nvbm4ucGVlcl0gPSBjb25uO1xuXG4gICAgICAgIGxldCBzZW5kRnVuY3Rpb24gPSBjb25uLnNlbmQuYmluZChjb25uKVxuICAgICAgICBsZXQgcmVjZWl2ZUZ1bmN0aW9uID0gY29ubi5vbi5iaW5kKGNvbm4pXG5cbiAgICAgICAgbGV0IHN5bmNUaW1lQmVnaW4gPSB0aGlzLnNoYXJlZFsnc3luY1RpbWVCZWdpbiddO1xuICAgICAgICBzZW5kRnVuY3Rpb24oe1xuICAgICAgICAgICAgJ21zZyc6ICdzeW5jOnN5bmNUaW1lQmVnaW4nLFxuICAgICAgICAgICAgYXJnczogW3N5bmNUaW1lQmVnaW5dXG4gICAgICAgIH0pXG5cbiAgICAgICAgdGhpcy5zeW5jTWFzdGVyLnN0YXJ0KHNlbmRGdW5jdGlvbiwgcmVjZWl2ZUZ1bmN0aW9uKTtcblxuICAgICAgICBjb25uLm9uKCdkYXRhJywgdGhpcy5wZWVyTWFzdGVyRGF0YUxpc3RlbmVyLmJpbmQodGhpcykoY29ubiwgdGhpcykpXG5cbiAgICAgICAgY29ubi5vbignY2xvc2UnLCAoKT0+IHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdDTE9TRScpXG4gICAgICAgICAgICAkcGVlci52YWx1ZSA9IFwiXCI7XG4gICAgICAgICAgICBkb2N1bWVudC5sb2NhdGlvbi5yZWxvYWQoKTtcbiAgICAgICAgfSlcbiAgICB9XG5cbiAgICBwZWVyTWFzdGVyRGF0YUxpc3RlbmVyKGNvbm4sIHRoYXQpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgICAgICAgIGlmIChkYXRhLm1zZyA9PSAnc3luYzpuZXdQZWVyJykge1xuXG4gICAgICAgICAgICAgICAgdGhhdC5zaGFyZWRbJ2Nvbm5lY3RlZFBlZXJzJ11bZGF0YS5hcmdzWzBdXSA9IGNvbm47XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJuZXcgcGVlcjpcIiwgdGhhdC5zaGFyZWRbJ2Nvbm5lY3RlZFBlZXJzJ10pXG4gICAgICAgICAgICAgICAgLy8gbGV0IHN5bmNUaW1lQmVnaW4gPSB0aGF0LnNoYXJlZFsnc3luY1RpbWVCZWdpbiddO1xuICAgICAgICAgICAgICAgIGxldCBzeW5jVGltZUJlZ2luID0gdGhhdC5zeW5jVGltZUJlZ2luO1xuICAgICAgICAgICAgICAgIC8vXG4gICAgICAgICAgICAgICAgY29ubi5zZW5kKHtcbiAgICAgICAgICAgICAgICAgICAgJ21zZyc6ICdzeW5jOnN5bmNUaW1lQmVnaW4nLFxuICAgICAgICAgICAgICAgICAgICBhcmdzOiBbc3luY1RpbWVCZWdpbl1cbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIC8vIGlmICh0aGF0LnNoYXJlZFsncGVlciddKSB7XG4gICAgICAgICAgICAgICAgLy8gICAgIGNvbm4uc2VuZCh7XG4gICAgICAgICAgICAgICAgLy8gICAgICAgICAnbXNnJzogJ3NhbXBsZTpjaGFuZ2UnLFxuICAgICAgICAgICAgICAgIC8vICAgICAgICAgYXJnczogW3RoYXQuc2hhcmVkWydjdXJyZW50SWQnXSwgdGhhdC5zaGFyZWRbJ3BlZXInXS5pZF1cbiAgICAgICAgICAgICAgICAvLyAgICAgfSlcbiAgICAgICAgICAgICAgICAvLyB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBpZiAoZGF0YS5tc2cgPT0gJ3NhbXBsZTpjaGFuZ2UnKSB7XG4gICAgICAgICAgICAvLyAgICAgdGhhdC5zYW1wbGVDaGFuZ2UoZGF0YSk7XG4gICAgICAgICAgICAvLyB9XG4gICAgICAgIH1cblxuICAgIH1cblxuXG4gICAgc2FtcGxlQ2hhbmdlKGRhdGEpIHtcbiAgICAgICAgY29uc29sZS5sb2coJ0NIQU5HRScsIGRhdGEpO1xuICAgICAgICBsZXQgc2FtcGxlSWQgPSBkYXRhLmFyZ3NbMF07XG4gICAgICAgIGxldCBwSWQgPSBkYXRhLmFyZ3NbMV07XG4gICAgICAgIGxldCBjID0gJ3BlZXItcGxheWVkLScgKyBwSWQ7XG4gICAgICAgIGxldCB0ZyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5zYW1wbGUtJytzYW1wbGVJZCk7XG4gICAgICAgIHRnLnN0eWxlW1wiYm9yZGVyLWNvbG9yXCJdID0gXCJncmVlblwiO1xuXG4gICAgICAgIC8vJCgnLnNhbXBsZXMnKS5maW5kKFwiYVwiKS5yZW1vdmVDbGFzcyhjKTtcbiAgICAgICAgLy8kKCcuc2FtcGxlW2RhdGEtaWQ9JytzYW1wbGVJZCsnXScpLmFkZENsYXNzKGMpO1xuICAgIH1cblxuICAgIGpvaW4ocGVlcklEKSB7XG4gICAgICAgIGxldCBwZWVyID0gbmV3IFBlZXIoe1xuICAgICAgICAgICAga2V5OiAndWJnamUzc201cDBldmN4cicsXG4gICAgICAgICAgICBkZWJ1ZzogMyxcbiAgICAgICAgICAgIGxvZ0Z1bmN0aW9uOiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICB2YXIgY29weSA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cykuam9pbignICcpO1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGNvcHkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgdmFyIGNvbm4gPSBwZWVyLmNvbm5lY3QocGVlcklEKTtcbiAgICAgICAgdGhpcy5zaGFyZWRbJ2Nvbm4nXSA9IGNvbm47XG4gICAgICAgIHBlZXIub24oJ2Vycm9yJywgZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhlcnIpO1xuICAgICAgICB9KVxuICAgICAgICBjb25uLm9uKCdvcGVuJywgKCkgPT4ge1xuICAgICAgICAgICAgY29uc29sZS5sb2coXCJqb2luXCIpXG4gICAgICAgICAgICB0aGlzLiRwbGF5LnN0eWxlLmRpc3BsYXkgPSBcImJsb2NrXCI7XG4gICAgICAgICAgICB0aGlzLiRjb25uZWN0LnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIjtcbiAgICAgICAgICAgIHRoaXMuc3luYyA9IFwic2xhdmVcIjtcbiAgICAgICAgICAgIHRoaXMucGVlclNsYXZlU3luYygpXG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIFNMQVZFIFNZTkMgUFJPQ0VTU1xuXG5cbiAgICBwZWVyU2xhdmVTeW5jKCkge1xuICAgICAgICBsZXQgY29ubiA9IHRoaXMuc2hhcmVkWydjb25uJ107XG4gICAgICAgIHRoaXMuc2hhcmVkWydjb25uZWN0ZWRQZWVycyddID0gdGhpcy5zaGFyZWRbJ2Nvbm5lY3RlZFBlZXJzJ10gfHwge307XG4gICAgICAgIGxldCBjb25uZWN0ZWRQZWVycyA9IHRoaXMuc2hhcmVkWydjb25uZWN0ZWRQZWVycyddO1xuICAgICAgICBjb25uZWN0ZWRQZWVyc1tjb25uLnBlZXJdID0gMTtcblxuICAgICAgICBjb25uLnNlbmQoe1xuICAgICAgICAgICAgJ21zZyc6ICdzeW5jOm5ld1BlZXInLFxuICAgICAgICAgICAgJ2FyZ3MnOiBbY29ubi5wZWVyXVxuICAgICAgICB9KTtcbiAgICAgICAgLy9cbiAgICAgICAgbGV0IGdldFRpbWVGdW5jdGlvbiA9ICgpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBhdWRpb0NvbnRleHQuY3VycmVudFRpbWU7XG4gICAgICAgIH07XG4gICAgICAgIC8vIEZ1bmN0aW9uIHRvIHNlbmQgYSBtZXNzYWdlIHRvIHRoZSBtYXN0ZXIgcGVlclxuICAgICAgICB2YXIgc2VuZEZ1bmN0aW9uID0gY29ubi5zZW5kLmJpbmQoY29ubik7XG4gICAgICAgIC8vIEZ1bmN0aW9uIHRvIHJlY2VpdmUgYSBtZXNzYWdlIGZyb20gdGhlIG1hc3RlciBwZWVyXG4gICAgICAgIHZhciByZWNlaXZlRnVuY3Rpb24gPSBjb25uLm9uLmJpbmQoY29ubik7XG5cbiAgICAgICAgY29uc29sZS5sb2coXCIhISEhIHRoaXMuc3luY1NsYXZlXCIsIHRoaXMuc3luY1NsYXZlKVxuICAgICAgICB2YXIgcmVwb3J0RnVuY3Rpb24gPSB0aGlzLnN5bmNTbGF2ZS5iaW5kKHRoaXMpOyAvLyBjb25zb2xlLmxvZzsgLy8gRkFLRVxuXG4gICAgICAgIHRoaXMuc3luY1NsYXZlID0gbmV3IFN5bmNDbGllbnQoZ2V0VGltZUZ1bmN0aW9uKTtcbiAgICAgICAgdGhpcy5zeW5jU2xhdmUuc3RhcnQoc2VuZEZ1bmN0aW9uLCByZWNlaXZlRnVuY3Rpb24sIHJlcG9ydEZ1bmN0aW9uKTtcbiAgICAgICAgdGhpcy5zaGFyZWRbJ3N5bmMnXSA9IHRoaXMuc3luY1NsYXZlO1xuXG4gICAgICAgIGNvbm4ub24oJ2RhdGEnLCB0aGlzLnBlZXJTbGF2ZURhdGFMaXN0ZW5lci5iaW5kKHRoaXMpKVxuXG4gICAgICAgIGNvbm4ub24oJ2Nsb3NlJywgKCk9PiB7XG4gICAgICAgICAgICAkcGVlci52YWx1ZSA9IFwiXCI7XG4gICAgICAgICAgICBkb2N1bWVudC5sb2NhdGlvbi5yZWxvYWQoKTtcbiAgICAgICAgfSlcblxuICAgIH1cblxuICAgIHN5bmNTbGF2ZShvYmopIHtcbiAgICAgICAgLy9jb25zb2xlLmxvZygnSEVSRSBJbSBTeW5jcmhvbml6ZWQnLCBvYmoudGltZU9mZnNldCk7XG4gICAgICAgIHRoaXMuc3luY1RpbWUgPSBvYmoudGltZU9mZnNldDtcbiAgICB9XG5cbiAgICBwZWVyU2xhdmVEYXRhTGlzdGVuZXIoZGF0YSkge1xuICAgICAgICBpZiAoZGF0YS5tc2cgPT0gJ3N5bmM6c3luY1RpbWVCZWdpbicpIHtcbiAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKFwic3luYzpzeW5jVGltZUJlZ2luXCIsIGRhdGEuYXJnc1swXSk7XG4gICAgICAgICAgICB2YXIgc3luY1RpbWVCZWdpbkZyb21NYXN0ZXIgPSBkYXRhLmFyZ3NbMF07XG4gICAgICAgICAgICB0aGlzLnNoYXJlZFsnc3luY1RpbWVCZWdpbkZyb21NYXN0ZXInXSA9IHN5bmNUaW1lQmVnaW5Gcm9tTWFzdGVyO1xuICAgICAgICB9XG4gICAgICAgIGlmIChkYXRhLm1zZyA9PSAnc2FtcGxlOmNoYW5nZScpIHtcbiAgICAgICAgICAgIHRoaXMuc2FtcGxlQ2hhbmdlKGRhdGEpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgYnVpbGRQYWRzKCkge1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuc2FtcGxlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgbGV0ICRwYWQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKTtcbiAgICAgICAgICAgIGxldCBzYW1wbGVOYW1lID0gc2FtcGxlVVJMU1tpXS5zcGxpdCgnLicpWzFdLnNwbGl0KFwiL1wiKVsyXVxuICAgICAgICAgICAgJHBhZC5jbGFzc0xpc3QuYWRkKHNhbXBsZU5hbWUpXG4gICAgICAgICAgICAkcGFkLmNsYXNzTGlzdC5hZGQoXCJzYW1wbGUtXCIraSk7XG4gICAgICAgICAgICAkcGFkLmNsYXNzTGlzdC5hZGQoXCJzYW1wbGVcIik7XG4gICAgICAgICAgICAkcGFkLnRleHRDb250ZW50ID0gc2FtcGxlTmFtZTtcbiAgICAgICAgICAgICRwYWQuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5wbGF5KGkpO1xuICAgICAgICAgICAgfSwgZmFsc2UpO1xuICAgICAgICAgICAgdGhpcy4kcGxheS5pbnNlcnRCZWZvcmUoJHBhZCwgdGhpcy4kcmVzZXQpXG4gICAgICAgIH1cbiAgICB9XG4gICAgcGxheShwYWRJRCkge1xuICAgICAgICBpZiAodGhpcy5jdXJyZW50U291cmNlKSB7XG4gICAgICAgICAgICB0aGlzLmN1cnJlbnRTb3VyY2Uuc3RvcCgpXG4gICAgICAgIH1cbiAgICAgICAgbGV0IHNvdXJjZSA9IGF1ZGlvQ29udGV4dC5jcmVhdGVCdWZmZXJTb3VyY2UoKVxuICAgICAgICB0aGlzLmN1cnJlbnRTb3VyY2UgPSBzb3VyY2U7XG4gICAgICAgIGxldCBhdWRpb0J1ZmZlciA9IHRoaXMuc2FtcGxlc1twYWRJRF07XG4gICAgICAgIHNvdXJjZS5sb29wID0gdHJ1ZTtcbiAgICAgICAgc291cmNlLmNvbm5lY3QoYXVkaW9Db250ZXh0LmRlc3RpbmF0aW9uKTtcbiAgICAgICAgc291cmNlLmJ1ZmZlciA9IGF1ZGlvQnVmZmVyO1xuICAgICAgICBsZXQgc2VlayA9IDA7XG4gICAgICAgIGlmICh0aGlzLnN5bmNNYXN0ZXIpIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5zeW5jVGltZUJlZ2luKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zeW5jVGltZUJlZ2luID0gYXVkaW9Db250ZXh0LmN1cnJlbnRUaW1lO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbGV0IHN5bmNUaW1lID0gYXVkaW9Db250ZXh0LmN1cnJlbnRUaW1lO1xuICAgICAgICAgICAgbGV0IG5iTG9vcCA9IHBhcnNlSW50KChzeW5jVGltZSAtIHRoaXMuc3luY1RpbWVCZWdpbikgLyBhdWRpb0J1ZmZlci5kdXJhdGlvbik7XG4gICAgICAgICAgICBsZXQgbGFzdEJlZ2luVGltZSA9IHRoaXMuc3luY1RpbWVCZWdpbiArIG5iTG9vcCAqIGF1ZGlvQnVmZmVyLmR1cmF0aW9uO1xuICAgICAgICAgICAgc2VlayA9IHN5bmNUaW1lIC0gbGFzdEJlZ2luVGltZTtcbiAgICAgICAgICAgIC8vXG4gICAgICAgICAgICAvLyBsZXQgY1AgPSBPYmplY3Qua2V5cyh0aGlzLnNoYXJlZC5jb25uZWN0ZWRQZWVycyk7XG4gICAgICAgICAgICAvLyBmb3IgKHZhciBpID0gMDsgaSA8IGNQLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAvLyAgICAgY1Auc2VuZChbcGFkSUQsIHRoaXMuc2hhcmVkWydwZWVyJ11dKVxuXG4gICAgICAgICAgICAvLyB9XG5cblxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vbGV0IHN5bmNTbGF2ZSA9IHRoaXMuc2hhcmVkWydzeW5jJ107XG4gICAgICAgICAgICAgICAgbGV0IHN5bmNUaW1lQmVnaW5Gcm9tTWFzdGVyID0gdGhpcy5zaGFyZWRbJ3N5bmNUaW1lQmVnaW5Gcm9tTWFzdGVyJ107XG4gICAgICAgICAgICAgICAgbGV0IHN5bmNUaW1lID0gdGhpcy5zeW5jU2xhdmUuZ2V0U3luY1RpbWUoKTtcbiAgICAgICAgICAgICAgICBsZXQgbmJMb29wID0gcGFyc2VJbnQoKHN5bmNUaW1lIC0gc3luY1RpbWVCZWdpbkZyb21NYXN0ZXIpL2F1ZGlvQnVmZmVyLmR1cmF0aW9uKTtcbiAgICAgICAgICAgICAgICBsZXQgbGFzdEJlZ2luVGltZSA9IHN5bmNUaW1lQmVnaW5Gcm9tTWFzdGVyICsgbmJMb29wICogYXVkaW9CdWZmZXIuZHVyYXRpb247XG4gICAgICAgICAgICAgICAgc2VlayA9IHN5bmNUaW1lLWxhc3RCZWdpblRpbWU7XG5cbiAgICAgICAgICAgICAgICAvLyBsZXQgY29ubiA9IHRoaXMuc2hhcmVkWydjb25uJ107XG4gICAgICAgICAgICAgICAgLy8gY29uc29sZS5sb2coW3BhZElELCBjb25uLmlkXSlcbiAgICAgICAgICAgICAgICAvLyBjb25uLnNlbmQoe1xuICAgICAgICAgICAgICAgIC8vICAgICAnbXNnJzogJ3NhbXBsZTpjaGFuZ2UnLFxuICAgICAgICAgICAgICAgIC8vICAgICAnYXJncyc6IFtwYWRJRCwgY29ubi5pZF1cbiAgICAgICAgICAgICAgICAvLyB9KTtcblxuICAgICAgICB9XG4gICAgICAgIHNvdXJjZS5zdGFydCgwLCBzZWVrKTtcbiAgICAgICAgLy8gcHJldHR5IGRpc3BsYXlcbiAgICAgICAgbGV0ICRhbGxTYW1wbGVzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnLnNhbXBsZScpO1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8ICRhbGxTYW1wbGVzLmxlbmd0aDsgKytpKSB7XG4gICAgICAgICAgJGFsbFNhbXBsZXNbaV0uc3R5bGVbXCJiYWNrZ3JvdW5kLWNvbG9yXCJdID0gXCJ3aGl0ZVwiO1xuICAgICAgICB9XG4gICAgICAgIGxldCAkdGFyZ2V0ID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLnNhbXBsZS0nK3BhZElEKTtcbiAgICAgICAgJHRhcmdldC5zdHlsZVtcImJhY2tncm91bmQtY29sb3JcIl0gPSBcInJlZFwiO1xuXG4gICAgfVxufVxuXG5sZXQgYXBwID0gbmV3IEFwcCgpO1xuIl19