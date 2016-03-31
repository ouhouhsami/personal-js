'use strict';

var _createClass = require('babel-runtime/helpers/create-class')['default'];

var _classCallCheck = require('babel-runtime/helpers/class-call-check')['default'];

var _Promise = require('babel-runtime/core-js/promise')['default'];

var _loadSamples = require('./loadSamples');

var _SyncServerJs = require('./SyncServer.js');

var _SyncClientJs = require('./SyncClient.js');

var StateMachine = require('fsm-as-promised');

var wavesAudio = require('waves-audio');
var audioContext = wavesAudio.audioContext;

// Screens
var $connectScreen = document.querySelector('#connect');
var $playScreen = document.querySelector('#play');
var $latency = document.querySelector('#latency');
$connectScreen.style.display = "none";
$playScreen.style.display = "none";

// Peer Form fields
var $peer = document.querySelector('#peer');
var $createPeerBtn = document.querySelector('#create');
var $joinPeerBtn = document.querySelector('#join');
var $resetBtn = document.querySelector('#reset');

var samplePlayer = undefined;
var peerContext = undefined;

// Sample URLs
var sampleURLS = ['./media/bass-1.mp3', './media/bass-2.mp3', './media/bass-3.mp3', './media/drums1-1.mp3', './media/drums1-2.mp3', './media/drums1-3.mp3', './media/drums2-1.mp3', './media/drums2-2.mp3', './media/drums3-1.mp3', './media/drums3-2.mp3', './media/drums3-3.mp3', './media/fx-1.mp3', './media/guitar-1.mp3', './media/guitar-2.mp3', './media/synths-1.mp3', './media/synths-10.mp3', './media/synths-11.mp3', './media/synths-2.mp3', './media/synths-3.mp3', './media/synths-4.mp3', './media/synths-5.mp3', './media/synths-6.mp3', './media/synths-7.mp3', './media/synths-8.mp3', './media/synths-9.mp3', './media/voice-1.mp3', './media/voice-2.mp3', './media/voice-3.mp3', './media/voice-4.mp3', './media/voice-5.mp3'];

// StateMachine
var fsm = StateMachine({
    initial: 'init',
    events: [{ name: 'Init', from: 'init', to: 'initialized' }, { name: 'CreatePeer', from: 'initialized', to: 'peerCreated' }, { name: 'JoinPeer', from: 'initialized', to: 'peerJoined' }, { name: 'Play', from: ['peerJoined', 'peerCreated'], to: 'play' }, { name: 'Reset', from: 'play', to: 'init' }],
    callbacks: {
        onInit: function onInit(options) {
            return new _Promise(function (resolve, reject) {
                // load samples
                (0, _loadSamples.loadSamples)(sampleURLS).then(function (samples) {
                    // build pads
                    samplePlayer = new SamplePlayer(samples);
                    // show UI for create or join peer
                    $connectScreen.style.display = "block";
                    // resolve
                    resolve(options);
                });
            });
        },
        onCreatePeer: function onCreatePeer(options) {
            // hide UI for create or join peer
            $connectScreen.style.display = "none";
            var peerID = options.args[0];
            peerContext = new PeerMasterContext(peerID);
            return options;
        },
        onJoinPeer: function onJoinPeer(options) {
            // hide UI for create or join peer
            $connectScreen.style.display = "none";
            var peerID = options.args[0];
            peerContext = new PeerSlaveContext(peerID);
            return options;
        },
        onPlay: function onPlay(options) {
            samplePlayer.peerContext = peerContext;
            $playScreen.style.display = "block";
            return options;
        }
    }
});

fsm.Init();

$createPeerBtn.addEventListener('click', function () {
    fsm.CreatePeer($peer.value);
});
$joinPeerBtn.addEventListener('click', function () {
    fsm.JoinPeer($peer.value);
});
$resetBtn.addEventListener('click', function () {
    document.location.reload();
});

var SamplePlayer = (function () {
    function SamplePlayer(samples) {
        _classCallCheck(this, SamplePlayer);

        this.samples = samples;
        this.currentSource = undefined;
        this.buildPads();
    }

    _createClass(SamplePlayer, [{
        key: 'buildPads',
        value: function buildPads() {
            var _this = this;

            var _loop = function (i) {
                var $pad = document.createElement('button');
                var sampleName = sampleURLS[i].split('.')[1].split("/")[2];
                $pad.classList.add(sampleName);
                $pad.classList.add("sample-" + i);
                $pad.classList.add("sample");
                $pad.textContent = sampleName;
                $pad.addEventListener('click', function () {
                    _this.play(i);
                }, false);
                $playScreen.insertBefore($pad, $resetBtn);
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
            this.currentAudioBuffer = this.samples[padID];
            source.loop = true;
            source.connect(audioContext.destination);
            source.buffer = this.currentAudioBuffer;
            console.log("this.offset and latency", this.offset);
            source.start(0, this.offset);
            // pretty display
            var $allSamples = document.querySelectorAll('.sample');
            for (var i = 0; i < $allSamples.length; ++i) {
                $allSamples[i].style["background-color"] = "white";
            }
            var $target = document.querySelector('.sample-' + padID);
            $target.style["background-color"] = "red";
        }
    }, {
        key: 'offset',
        get: function get() {
            var offset = 0;
            var latency = parseInt($latency.value) / 1000;
            console.log(latency);
            if (this.peerContext.type == 'master') {
                if (!this.syncTimeBegin) {
                    this.syncTimeBegin = audioContext.currentTime;
                    // set this on the master peer
                    this.peerContext.shared['syncTimeBegin'] = this.syncTimeBegin;
                }
                var syncTime = audioContext.currentTime;
                var nbLoop = parseInt((syncTime - this.syncTimeBegin) / this.currentAudioBuffer.duration);
                var lastBeginTime = this.syncTimeBegin + nbLoop * this.currentAudioBuffer.duration;
                offset = syncTime - lastBeginTime;
            } else {
                //let syncTimeBeginFromMaster = this.shared['syncTimeBeginFromMaster'];
                var syncTimeBeginFromMaster = this.peerContext.shared['syncTimeBeginFromMaster'];
                //let syncTime = this.syncSlave.getSyncTime();
                var syncTime = this.peerContext.syncSlave.getSyncTime();
                var nbLoop = parseInt((syncTime - syncTimeBeginFromMaster) / this.currentAudioBuffer.duration);
                var lastBeginTime = syncTimeBeginFromMaster + nbLoop * this.currentAudioBuffer.duration;
                offset = syncTime - lastBeginTime;
            }
            offset = offset + latency;
            while (offset < 0) {
                offset = offset + this.currentAudioBuffer.duration;
            }
            return offset;
        }
    }, {
        key: 'peerContext',
        set: function set(pC) {
            this._peerContext = pC;
        },
        get: function get() {
            return this._peerContext;
        }
    }]);

    return SamplePlayer;
})();

var PeerMasterContext = (function () {
    function PeerMasterContext(peerID) {
        var _this2 = this;

        _classCallCheck(this, PeerMasterContext);

        this.shared = {};
        this.shared['connectedPeers'] = {};
        this.peer = new Peer(peerID, {
            key: 'ubgje3sm5p0evcxr',
            debug: 3,
            logFunction: function logFunction() {
                var copy = Array.prototype.slice.call(arguments).join(' ');
                console.log(copy);
            }
        });
        this.peer.on('open', function (id) {
            // we can play!
            fsm.Play();
            _this2.peerMasterSync();
        });
        this.type = 'master';
    }

    _createClass(PeerMasterContext, [{
        key: 'peerMasterSync',
        value: function peerMasterSync() {
            // Function to get the local time
            var getTimeFunction = function getTimeFunction() {
                return audioContext.currentTime;
            };
            // Initialize sync module
            this.syncMaster = new _SyncServerJs.SyncServer(getTimeFunction);
            this.peer.on('connection', this.slaveConnect.bind(this));
        }
    }, {
        key: 'slaveConnect',
        value: function slaveConnect(conn) {
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
        }
    }, {
        key: 'peerMasterDataListener',
        value: function peerMasterDataListener(conn, that) {
            return function (data) {
                if (data.msg == 'sync:newPeer') {

                    that.shared['connectedPeers'][data.args[0]] = conn;
                    var syncTimeBegin = that.shared['syncTimeBegin'];
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
    }]);

    return PeerMasterContext;
})();

var PeerSlaveContext = (function () {
    function PeerSlaveContext(peerID) {
        var _this3 = this;

        _classCallCheck(this, PeerSlaveContext);

        this.shared = {};
        this.shared['connectedPeers'] = {};
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
            _this3.sync = "slave";
            _this3.peerSlaveSync();
        });
        this.type = "slave";
    }

    _createClass(PeerSlaveContext, [{
        key: 'peerSlaveSync',
        value: function peerSlaveSync() {
            var conn = this.shared['conn'];
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
            fsm.Play();
            this.syncTime = obj.timeOffset;
        }
    }, {
        key: 'peerSlaveDataListener',
        value: function peerSlaveDataListener(data) {
            if (data.msg == 'sync:syncTimeBegin') {
                var syncTimeBeginFromMaster = data.args[0];
                this.shared['syncTimeBeginFromMaster'] = syncTimeBeginFromMaster;
            }
            if (data.msg == 'sample:change') {
                this.sampleChange(data);
            }
        }
    }]);

    return PeerSlaveContext;
})();
//# sourceMappingURL=data:application/json;base64,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LENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxDQUFDO2FBQzNCO1NBQ0o7OztXQXRFQyxnQkFBZ0IiLCJmaWxlIjoiZXM2L1N5bmNTZXJ2ZXIuanMiLCJzb3VyY2VzQ29udGVudCI6WyJsZXQgU3RhdGVNYWNoaW5lID0gcmVxdWlyZSgnZnNtLWFzLXByb21pc2VkJyk7XG5pbXBvcnQgeyBsb2FkU2FtcGxlcyB9IGZyb20gJy4vbG9hZFNhbXBsZXMnO1xuaW1wb3J0IHsgU3luY1NlcnZlciB9IGZyb20gJy4vU3luY1NlcnZlci5qcyc7XG5pbXBvcnQgeyBTeW5jQ2xpZW50IH0gZnJvbSAnLi9TeW5jQ2xpZW50LmpzJztcbmNvbnN0IHdhdmVzQXVkaW8gPSByZXF1aXJlKCd3YXZlcy1hdWRpbycpO1xuY29uc3QgYXVkaW9Db250ZXh0ID0gd2F2ZXNBdWRpby5hdWRpb0NvbnRleHQ7XG5cbi8vIFNjcmVlbnNcbmNvbnN0ICRjb25uZWN0U2NyZWVuID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI2Nvbm5lY3QnKTtcbmNvbnN0ICRwbGF5U2NyZWVuID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI3BsYXknKTtcbmNvbnN0ICRsYXRlbmN5ID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI2xhdGVuY3knKTtcbiRjb25uZWN0U2NyZWVuLnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIjtcbiRwbGF5U2NyZWVuLnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIjtcblxuLy8gUGVlciBGb3JtIGZpZWxkc1xuY29uc3QgJHBlZXIgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjcGVlcicpO1xuY29uc3QgJGNyZWF0ZVBlZXJCdG4gPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjY3JlYXRlJyk7XG5jb25zdCAkam9pblBlZXJCdG4gPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjam9pbicpO1xuY29uc3QgJHJlc2V0QnRuID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI3Jlc2V0Jyk7XG5cbmxldCBzYW1wbGVQbGF5ZXI7XG5sZXQgcGVlckNvbnRleHQ7XG5cbi8vIFNhbXBsZSBVUkxzXG5jb25zdCBzYW1wbGVVUkxTID0gWycuL21lZGlhL2Jhc3MtMS5tcDMnLCAnLi9tZWRpYS9iYXNzLTIubXAzJywgJy4vbWVkaWEvYmFzcy0zLm1wMycsICcuL21lZGlhL2RydW1zMS0xLm1wMycsICcuL21lZGlhL2RydW1zMS0yLm1wMycsICcuL21lZGlhL2RydW1zMS0zLm1wMycsICcuL21lZGlhL2RydW1zMi0xLm1wMycsICcuL21lZGlhL2RydW1zMi0yLm1wMycsICcuL21lZGlhL2RydW1zMy0xLm1wMycsICcuL21lZGlhL2RydW1zMy0yLm1wMycsICcuL21lZGlhL2RydW1zMy0zLm1wMycsICcuL21lZGlhL2Z4LTEubXAzJywgJy4vbWVkaWEvZ3VpdGFyLTEubXAzJywgJy4vbWVkaWEvZ3VpdGFyLTIubXAzJywgJy4vbWVkaWEvc3ludGhzLTEubXAzJywgJy4vbWVkaWEvc3ludGhzLTEwLm1wMycsICcuL21lZGlhL3N5bnRocy0xMS5tcDMnLCAnLi9tZWRpYS9zeW50aHMtMi5tcDMnLCAnLi9tZWRpYS9zeW50aHMtMy5tcDMnLCAnLi9tZWRpYS9zeW50aHMtNC5tcDMnLCAnLi9tZWRpYS9zeW50aHMtNS5tcDMnLCAnLi9tZWRpYS9zeW50aHMtNi5tcDMnLCAnLi9tZWRpYS9zeW50aHMtNy5tcDMnLCAnLi9tZWRpYS9zeW50aHMtOC5tcDMnLCAnLi9tZWRpYS9zeW50aHMtOS5tcDMnLCAnLi9tZWRpYS92b2ljZS0xLm1wMycsICcuL21lZGlhL3ZvaWNlLTIubXAzJywgJy4vbWVkaWEvdm9pY2UtMy5tcDMnLCAnLi9tZWRpYS92b2ljZS00Lm1wMycsICcuL21lZGlhL3ZvaWNlLTUubXAzJ107XG5cbi8vIFN0YXRlTWFjaGluZVxubGV0IGZzbSA9IFN0YXRlTWFjaGluZSh7XG4gICAgaW5pdGlhbDogJ2luaXQnLFxuICAgIGV2ZW50czogW1xuICAgICAgICB7IG5hbWU6ICdJbml0JywgZnJvbTogJ2luaXQnLCB0bzogJ2luaXRpYWxpemVkJyB9LFxuICAgICAgICB7IG5hbWU6ICdDcmVhdGVQZWVyJywgZnJvbTogJ2luaXRpYWxpemVkJywgdG86ICdwZWVyQ3JlYXRlZCcgfSxcbiAgICAgICAgeyBuYW1lOiAnSm9pblBlZXInLCBmcm9tOiAnaW5pdGlhbGl6ZWQnLCB0bzogJ3BlZXJKb2luZWQnIH0sXG4gICAgICAgIHsgbmFtZTogJ1BsYXknLCBmcm9tOiBbJ3BlZXJKb2luZWQnLCAncGVlckNyZWF0ZWQnXSwgdG86ICdwbGF5J30sXG4gICAgICAgIHsgbmFtZTogJ1Jlc2V0JywgZnJvbTogJ3BsYXknLCB0bzogJ2luaXQnIH0sXG4gICAgXSxcbiAgICBjYWxsYmFja3M6IHtcbiAgICAgICAgb25Jbml0OiBmdW5jdGlvbihvcHRpb25zKXtcbiAgICAgICAgICAgIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgICAgICAgICAgLy8gbG9hZCBzYW1wbGVzXG4gICAgICAgICAgICAgICAgbG9hZFNhbXBsZXMoc2FtcGxlVVJMUykudGhlbihmdW5jdGlvbihzYW1wbGVzKXtcbiAgICAgICAgICAgICAgICAvLyBidWlsZCBwYWRzXG4gICAgICAgICAgICAgICAgc2FtcGxlUGxheWVyID0gbmV3IFNhbXBsZVBsYXllcihzYW1wbGVzKTtcbiAgICAgICAgICAgICAgICAvLyBzaG93IFVJIGZvciBjcmVhdGUgb3Igam9pbiBwZWVyXG4gICAgICAgICAgICAgICAgJGNvbm5lY3RTY3JlZW4uc3R5bGUuZGlzcGxheSA9IFwiYmxvY2tcIjtcbiAgICAgICAgICAgICAgICAvLyByZXNvbHZlXG4gICAgICAgICAgICAgICAgcmVzb2x2ZShvcHRpb25zKVxuICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0sXG4gICAgICAgIG9uQ3JlYXRlUGVlcjogZnVuY3Rpb24ob3B0aW9ucykge1xuICAgICAgICAgICAgLy8gaGlkZSBVSSBmb3IgY3JlYXRlIG9yIGpvaW4gcGVlclxuICAgICAgICAgICAgJGNvbm5lY3RTY3JlZW4uc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiO1xuICAgICAgICAgICAgbGV0IHBlZXJJRCA9IG9wdGlvbnMuYXJnc1swXTtcbiAgICAgICAgICAgIHBlZXJDb250ZXh0ID0gbmV3IFBlZXJNYXN0ZXJDb250ZXh0KHBlZXJJRCk7XG4gICAgICAgICAgICByZXR1cm4gb3B0aW9ucztcbiAgICAgICAgfSxcbiAgICAgICAgb25Kb2luUGVlcjogZnVuY3Rpb24ob3B0aW9ucykge1xuICAgICAgICAgICAgLy8gaGlkZSBVSSBmb3IgY3JlYXRlIG9yIGpvaW4gcGVlclxuICAgICAgICAgICAgJGNvbm5lY3RTY3JlZW4uc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiO1xuICAgICAgICAgICAgbGV0IHBlZXJJRCA9IG9wdGlvbnMuYXJnc1swXTtcbiAgICAgICAgICAgIHBlZXJDb250ZXh0ID0gbmV3IFBlZXJTbGF2ZUNvbnRleHQocGVlcklEKTtcbiAgICAgICAgICAgIHJldHVybiBvcHRpb25zO1xuICAgICAgICB9LFxuICAgICAgICBvblBsYXk6IGZ1bmN0aW9uKG9wdGlvbnMpe1xuICAgICAgICAgICAgc2FtcGxlUGxheWVyLnBlZXJDb250ZXh0ID0gcGVlckNvbnRleHQ7XG4gICAgICAgICAgICAkcGxheVNjcmVlbi5zdHlsZS5kaXNwbGF5ID0gXCJibG9ja1wiO1xuICAgICAgICAgICAgcmV0dXJuIG9wdGlvbnM7XG4gICAgICAgIH1cbiAgICB9XG59KTtcblxuZnNtLkluaXQoKVxuXG4kY3JlYXRlUGVlckJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpPT57XG4gICAgZnNtLkNyZWF0ZVBlZXIoJHBlZXIudmFsdWUpO1xufSlcbiRqb2luUGVlckJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpPT57XG4gICAgZnNtLkpvaW5QZWVyKCRwZWVyLnZhbHVlKTtcbn0pXG4kcmVzZXRCdG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKT0+e1xuICAgIGRvY3VtZW50LmxvY2F0aW9uLnJlbG9hZCgpO1xufSlcblxuY2xhc3MgU2FtcGxlUGxheWVyIHtcbiAgICBjb25zdHJ1Y3RvcihzYW1wbGVzKXtcbiAgICAgICAgdGhpcy5zYW1wbGVzID0gc2FtcGxlcztcbiAgICAgICAgdGhpcy5jdXJyZW50U291cmNlID0gdW5kZWZpbmVkO1xuICAgICAgICB0aGlzLmJ1aWxkUGFkcygpO1xuICAgIH1cbiAgICBidWlsZFBhZHMoKXtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLnNhbXBsZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGxldCAkcGFkID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYnV0dG9uJyk7XG4gICAgICAgICAgICBsZXQgc2FtcGxlTmFtZSA9IHNhbXBsZVVSTFNbaV0uc3BsaXQoJy4nKVsxXS5zcGxpdChcIi9cIilbMl1cbiAgICAgICAgICAgICRwYWQuY2xhc3NMaXN0LmFkZChzYW1wbGVOYW1lKVxuICAgICAgICAgICAgJHBhZC5jbGFzc0xpc3QuYWRkKFwic2FtcGxlLVwiICsgaSk7XG4gICAgICAgICAgICAkcGFkLmNsYXNzTGlzdC5hZGQoXCJzYW1wbGVcIik7XG4gICAgICAgICAgICAkcGFkLnRleHRDb250ZW50ID0gc2FtcGxlTmFtZTtcbiAgICAgICAgICAgICRwYWQuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5wbGF5KGkpO1xuICAgICAgICAgICAgfSwgZmFsc2UpO1xuICAgICAgICAgICAgJHBsYXlTY3JlZW4uaW5zZXJ0QmVmb3JlKCRwYWQsICRyZXNldEJ0bilcbiAgICAgICAgfVxuICAgIH1cbiAgICBwbGF5KHBhZElEKXtcbiAgICAgICAgaWYodGhpcy5jdXJyZW50U291cmNlKXtcbiAgICAgICAgICAgIHRoaXMuY3VycmVudFNvdXJjZS5zdG9wKCk7XG4gICAgICAgIH1cbiAgICAgICAgbGV0IHNvdXJjZSA9IGF1ZGlvQ29udGV4dC5jcmVhdGVCdWZmZXJTb3VyY2UoKVxuICAgICAgICB0aGlzLmN1cnJlbnRTb3VyY2UgPSBzb3VyY2U7XG4gICAgICAgIHRoaXMuY3VycmVudEF1ZGlvQnVmZmVyID0gdGhpcy5zYW1wbGVzW3BhZElEXTtcbiAgICAgICAgc291cmNlLmxvb3AgPSB0cnVlO1xuICAgICAgICBzb3VyY2UuY29ubmVjdChhdWRpb0NvbnRleHQuZGVzdGluYXRpb24pO1xuICAgICAgICBzb3VyY2UuYnVmZmVyID0gdGhpcy5jdXJyZW50QXVkaW9CdWZmZXI7XG4gICAgICAgIGNvbnNvbGUubG9nKFwidGhpcy5vZmZzZXQgYW5kIGxhdGVuY3lcIiwgdGhpcy5vZmZzZXQpXG4gICAgICAgIHNvdXJjZS5zdGFydCgwLCB0aGlzLm9mZnNldCk7XG4gICAgICAgIC8vIHByZXR0eSBkaXNwbGF5XG4gICAgICAgIGxldCAkYWxsU2FtcGxlcyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJy5zYW1wbGUnKTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCAkYWxsU2FtcGxlcy5sZW5ndGg7ICsraSkge1xuICAgICAgICAgICRhbGxTYW1wbGVzW2ldLnN0eWxlW1wiYmFja2dyb3VuZC1jb2xvclwiXSA9IFwid2hpdGVcIjtcbiAgICAgICAgfVxuICAgICAgICBsZXQgJHRhcmdldCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5zYW1wbGUtJytwYWRJRCk7XG4gICAgICAgICR0YXJnZXQuc3R5bGVbXCJiYWNrZ3JvdW5kLWNvbG9yXCJdID0gXCJyZWRcIjtcbiAgICB9XG4gICAgZ2V0IG9mZnNldCgpe1xuICAgICAgICBsZXQgb2Zmc2V0ID0gMDtcbiAgICAgICAgbGV0IGxhdGVuY3kgPSBwYXJzZUludCgkbGF0ZW5jeS52YWx1ZSkvMTAwMDtcbiAgICAgICAgY29uc29sZS5sb2cobGF0ZW5jeSk7XG4gICAgICAgIGlmKHRoaXMucGVlckNvbnRleHQudHlwZSA9PSAnbWFzdGVyJyl7XG4gICAgICAgICAgICBpZiAoIXRoaXMuc3luY1RpbWVCZWdpbikge1xuICAgICAgICAgICAgICAgIHRoaXMuc3luY1RpbWVCZWdpbiA9IGF1ZGlvQ29udGV4dC5jdXJyZW50VGltZTtcbiAgICAgICAgICAgICAgICAvLyBzZXQgdGhpcyBvbiB0aGUgbWFzdGVyIHBlZXJcbiAgICAgICAgICAgICAgICB0aGlzLnBlZXJDb250ZXh0LnNoYXJlZFsnc3luY1RpbWVCZWdpbiddID0gdGhpcy5zeW5jVGltZUJlZ2luO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbGV0IHN5bmNUaW1lID0gYXVkaW9Db250ZXh0LmN1cnJlbnRUaW1lO1xuICAgICAgICAgICAgbGV0IG5iTG9vcCA9IHBhcnNlSW50KChzeW5jVGltZSAtIHRoaXMuc3luY1RpbWVCZWdpbikgLyB0aGlzLmN1cnJlbnRBdWRpb0J1ZmZlci5kdXJhdGlvbik7XG4gICAgICAgICAgICBsZXQgbGFzdEJlZ2luVGltZSA9IHRoaXMuc3luY1RpbWVCZWdpbiArIG5iTG9vcCAqIHRoaXMuY3VycmVudEF1ZGlvQnVmZmVyLmR1cmF0aW9uO1xuICAgICAgICAgICAgb2Zmc2V0ID0gc3luY1RpbWUgLSBsYXN0QmVnaW5UaW1lO1xuICAgICAgICB9ZWxzZSB7XG4gICAgICAgICAgICAvL2xldCBzeW5jVGltZUJlZ2luRnJvbU1hc3RlciA9IHRoaXMuc2hhcmVkWydzeW5jVGltZUJlZ2luRnJvbU1hc3RlciddO1xuICAgICAgICAgICAgbGV0IHN5bmNUaW1lQmVnaW5Gcm9tTWFzdGVyID0gdGhpcy5wZWVyQ29udGV4dC5zaGFyZWRbJ3N5bmNUaW1lQmVnaW5Gcm9tTWFzdGVyJ107XG4gICAgICAgICAgICAvL2xldCBzeW5jVGltZSA9IHRoaXMuc3luY1NsYXZlLmdldFN5bmNUaW1lKCk7XG4gICAgICAgICAgICBsZXQgc3luY1RpbWUgPSB0aGlzLnBlZXJDb250ZXh0LnN5bmNTbGF2ZS5nZXRTeW5jVGltZSgpO1xuICAgICAgICAgICAgbGV0IG5iTG9vcCA9IHBhcnNlSW50KChzeW5jVGltZSAtIHN5bmNUaW1lQmVnaW5Gcm9tTWFzdGVyKS8gdGhpcy5jdXJyZW50QXVkaW9CdWZmZXIuZHVyYXRpb24pO1xuICAgICAgICAgICAgbGV0IGxhc3RCZWdpblRpbWUgPSBzeW5jVGltZUJlZ2luRnJvbU1hc3RlciArIG5iTG9vcCAqICB0aGlzLmN1cnJlbnRBdWRpb0J1ZmZlci5kdXJhdGlvbjtcbiAgICAgICAgICAgIG9mZnNldCA9IHN5bmNUaW1lLWxhc3RCZWdpblRpbWU7XG4gICAgICAgIH1cbiAgICAgICAgb2Zmc2V0ID0gb2Zmc2V0K2xhdGVuY3lcbiAgICAgICAgd2hpbGUob2Zmc2V0IDwgMCl7XG4gICAgICAgICAgICBvZmZzZXQgPSBvZmZzZXQrdGhpcy5jdXJyZW50QXVkaW9CdWZmZXIuZHVyYXRpb25cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gb2Zmc2V0O1xuICAgIH1cbiAgICBzZXQgcGVlckNvbnRleHQocEMpe1xuICAgICAgICB0aGlzLl9wZWVyQ29udGV4dCA9IHBDXG4gICAgfVxuICAgIGdldCBwZWVyQ29udGV4dCgpe1xuICAgICAgICByZXR1cm4gdGhpcy5fcGVlckNvbnRleHQ7XG4gICAgfVxufVxuXG5jbGFzcyBQZWVyTWFzdGVyQ29udGV4dCB7XG4gICAgY29uc3RydWN0b3IocGVlcklEKXtcbiAgICAgICAgdGhpcy5zaGFyZWQgPSB7fVxuICAgICAgICB0aGlzLnNoYXJlZFsnY29ubmVjdGVkUGVlcnMnXSA9IHt9XG4gICAgICAgIHRoaXMucGVlciA9IG5ldyBQZWVyKHBlZXJJRCwge1xuICAgICAgICAgICAga2V5OiAndWJnamUzc201cDBldmN4cicsXG4gICAgICAgICAgICBkZWJ1ZzogMyxcbiAgICAgICAgICAgIGxvZ0Z1bmN0aW9uOiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICB2YXIgY29weSA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cykuam9pbignICcpO1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGNvcHkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5wZWVyLm9uKCdvcGVuJywgKGlkKSA9PiB7XG4gICAgICAgICAgICAvLyB3ZSBjYW4gcGxheSFcbiAgICAgICAgICAgIGZzbS5QbGF5KCk7XG4gICAgICAgICAgICB0aGlzLnBlZXJNYXN0ZXJTeW5jKCk7XG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLnR5cGUgPSAnbWFzdGVyJztcbiAgICB9XG4gICAgcGVlck1hc3RlclN5bmMoKSB7XG4gICAgICAgIC8vIEZ1bmN0aW9uIHRvIGdldCB0aGUgbG9jYWwgdGltZVxuICAgICAgICBsZXQgZ2V0VGltZUZ1bmN0aW9uID0gKCkgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIGF1ZGlvQ29udGV4dC5jdXJyZW50VGltZTtcbiAgICAgICAgfTtcbiAgICAgICAgLy8gSW5pdGlhbGl6ZSBzeW5jIG1vZHVsZVxuICAgICAgICB0aGlzLnN5bmNNYXN0ZXIgPSBuZXcgU3luY1NlcnZlcihnZXRUaW1lRnVuY3Rpb24pO1xuICAgICAgICB0aGlzLnBlZXIub24oJ2Nvbm5lY3Rpb24nLCB0aGlzLnNsYXZlQ29ubmVjdC5iaW5kKHRoaXMpKTtcbiAgICB9XG4gICAgc2xhdmVDb25uZWN0KGNvbm4pIHtcbiAgICAgICAgbGV0IGNvbm5lY3RlZFBlZXJzID0gdGhpcy5zaGFyZWRbJ2Nvbm5lY3RlZFBlZXJzJ107XG4gICAgICAgIGNvbm5lY3RlZFBlZXJzW2Nvbm4ucGVlcl0gPSBjb25uO1xuXG4gICAgICAgIGxldCBzZW5kRnVuY3Rpb24gPSBjb25uLnNlbmQuYmluZChjb25uKVxuICAgICAgICBsZXQgcmVjZWl2ZUZ1bmN0aW9uID0gY29ubi5vbi5iaW5kKGNvbm4pXG5cbiAgICAgICAgbGV0IHN5bmNUaW1lQmVnaW4gPSB0aGlzLnNoYXJlZFsnc3luY1RpbWVCZWdpbiddO1xuICAgICAgICBzZW5kRnVuY3Rpb24oe1xuICAgICAgICAgICAgJ21zZyc6ICdzeW5jOnN5bmNUaW1lQmVnaW4nLFxuICAgICAgICAgICAgYXJnczogW3N5bmNUaW1lQmVnaW5dXG4gICAgICAgIH0pXG4gICAgICAgIHRoaXMuc3luY01hc3Rlci5zdGFydChzZW5kRnVuY3Rpb24sIHJlY2VpdmVGdW5jdGlvbik7XG5cbiAgICAgICAgY29ubi5vbignZGF0YScsIHRoaXMucGVlck1hc3RlckRhdGFMaXN0ZW5lci5iaW5kKHRoaXMpKGNvbm4sIHRoaXMpKVxuXG4gICAgfVxuICAgIHBlZXJNYXN0ZXJEYXRhTGlzdGVuZXIoY29ubiwgdGhhdCkge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24oZGF0YSkge1xuICAgICAgICAgICAgaWYgKGRhdGEubXNnID09ICdzeW5jOm5ld1BlZXInKSB7XG5cbiAgICAgICAgICAgICAgICB0aGF0LnNoYXJlZFsnY29ubmVjdGVkUGVlcnMnXVtkYXRhLmFyZ3NbMF1dID0gY29ubjtcbiAgICAgICAgICAgICAgICBsZXQgc3luY1RpbWVCZWdpbiA9IHRoYXQuc2hhcmVkWydzeW5jVGltZUJlZ2luJ107XG4gICAgICAgICAgICAgICAgLy9cbiAgICAgICAgICAgICAgICBjb25uLnNlbmQoe1xuICAgICAgICAgICAgICAgICAgICAnbXNnJzogJ3N5bmM6c3luY1RpbWVCZWdpbicsXG4gICAgICAgICAgICAgICAgICAgIGFyZ3M6IFtzeW5jVGltZUJlZ2luXVxuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgLy8gaWYgKHRoYXQuc2hhcmVkWydwZWVyJ10pIHtcbiAgICAgICAgICAgICAgICAvLyAgICAgY29ubi5zZW5kKHtcbiAgICAgICAgICAgICAgICAvLyAgICAgICAgICdtc2cnOiAnc2FtcGxlOmNoYW5nZScsXG4gICAgICAgICAgICAgICAgLy8gICAgICAgICBhcmdzOiBbdGhhdC5zaGFyZWRbJ2N1cnJlbnRJZCddLCB0aGF0LnNoYXJlZFsncGVlciddLmlkXVxuICAgICAgICAgICAgICAgIC8vICAgICB9KVxuICAgICAgICAgICAgICAgIC8vIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIGlmIChkYXRhLm1zZyA9PSAnc2FtcGxlOmNoYW5nZScpIHtcbiAgICAgICAgICAgIC8vICAgICB0aGF0LnNhbXBsZUNoYW5nZShkYXRhKTtcbiAgICAgICAgICAgIC8vIH1cbiAgICAgICAgfVxuXG4gICAgfVxufVxuXG5cbmNsYXNzIFBlZXJTbGF2ZUNvbnRleHQge1xuICAgIGNvbnN0cnVjdG9yKHBlZXJJRCkge1xuICAgICAgICB0aGlzLnNoYXJlZCA9IHt9XG4gICAgICAgIHRoaXMuc2hhcmVkWydjb25uZWN0ZWRQZWVycyddID0ge31cbiAgICAgICAgbGV0IHBlZXIgPSBuZXcgUGVlcih7XG4gICAgICAgICAgICBrZXk6ICd1YmdqZTNzbTVwMGV2Y3hyJyxcbiAgICAgICAgICAgIGRlYnVnOiAzLFxuICAgICAgICAgICAgbG9nRnVuY3Rpb246IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIHZhciBjb3B5ID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKS5qb2luKCcgJyk7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coY29weSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICBsZXQgY29ubiA9IHBlZXIuY29ubmVjdChwZWVySUQpO1xuICAgICAgICB0aGlzLnNoYXJlZFsnY29ubiddID0gY29ubjtcbiAgICAgICAgcGVlci5vbignZXJyb3InLCBmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGVycik7XG4gICAgICAgIH0pXG4gICAgICAgIGNvbm4ub24oJ29wZW4nLCAoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnN5bmMgPSBcInNsYXZlXCI7XG4gICAgICAgICAgICB0aGlzLnBlZXJTbGF2ZVN5bmMoKVxuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy50eXBlID0gXCJzbGF2ZVwiO1xuICAgIH1cblxuICAgIHBlZXJTbGF2ZVN5bmMoKSB7XG4gICAgICAgIGxldCBjb25uID0gdGhpcy5zaGFyZWRbJ2Nvbm4nXTtcbiAgICAgICAgbGV0IGNvbm5lY3RlZFBlZXJzID0gdGhpcy5zaGFyZWRbJ2Nvbm5lY3RlZFBlZXJzJ107XG4gICAgICAgIGNvbm5lY3RlZFBlZXJzW2Nvbm4ucGVlcl0gPSAxO1xuXG4gICAgICAgIGNvbm4uc2VuZCh7XG4gICAgICAgICAgICAnbXNnJzogJ3N5bmM6bmV3UGVlcicsXG4gICAgICAgICAgICAnYXJncyc6IFtjb25uLnBlZXJdXG4gICAgICAgIH0pO1xuICAgICAgICAvL1xuICAgICAgICBsZXQgZ2V0VGltZUZ1bmN0aW9uID0gKCkgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIGF1ZGlvQ29udGV4dC5jdXJyZW50VGltZTtcbiAgICAgICAgfTtcbiAgICAgICAgLy8gRnVuY3Rpb24gdG8gc2VuZCBhIG1lc3NhZ2UgdG8gdGhlIG1hc3RlciBwZWVyXG4gICAgICAgIHZhciBzZW5kRnVuY3Rpb24gPSBjb25uLnNlbmQuYmluZChjb25uKTtcbiAgICAgICAgLy8gRnVuY3Rpb24gdG8gcmVjZWl2ZSBhIG1lc3NhZ2UgZnJvbSB0aGUgbWFzdGVyIHBlZXJcbiAgICAgICAgdmFyIHJlY2VpdmVGdW5jdGlvbiA9IGNvbm4ub24uYmluZChjb25uKTtcblxuICAgICAgICB2YXIgcmVwb3J0RnVuY3Rpb24gPSB0aGlzLnN5bmNTbGF2ZS5iaW5kKHRoaXMpOyAvLyBjb25zb2xlLmxvZzsgLy8gRkFLRVxuXG4gICAgICAgIHRoaXMuc3luY1NsYXZlID0gbmV3IFN5bmNDbGllbnQoZ2V0VGltZUZ1bmN0aW9uKTtcbiAgICAgICAgdGhpcy5zeW5jU2xhdmUuc3RhcnQoc2VuZEZ1bmN0aW9uLCByZWNlaXZlRnVuY3Rpb24sIHJlcG9ydEZ1bmN0aW9uKTtcbiAgICAgICAgdGhpcy5zaGFyZWRbJ3N5bmMnXSA9IHRoaXMuc3luY1NsYXZlO1xuXG4gICAgICAgIGNvbm4ub24oJ2RhdGEnLCB0aGlzLnBlZXJTbGF2ZURhdGFMaXN0ZW5lci5iaW5kKHRoaXMpKVxuXG4gICAgICAgIGNvbm4ub24oJ2Nsb3NlJywgKCkgPT4ge1xuICAgICAgICAgICAgJHBlZXIudmFsdWUgPSBcIlwiO1xuICAgICAgICAgICAgZG9jdW1lbnQubG9jYXRpb24ucmVsb2FkKCk7XG4gICAgICAgIH0pXG5cbiAgICB9XG5cbiAgICBzeW5jU2xhdmUob2JqKSB7XG4gICAgICAgIGZzbS5QbGF5KCk7XG4gICAgICAgIHRoaXMuc3luY1RpbWUgPSBvYmoudGltZU9mZnNldDtcbiAgICB9XG5cbiAgICBwZWVyU2xhdmVEYXRhTGlzdGVuZXIoZGF0YSkge1xuICAgICAgICBpZiAoZGF0YS5tc2cgPT0gJ3N5bmM6c3luY1RpbWVCZWdpbicpIHtcbiAgICAgICAgICAgIHZhciBzeW5jVGltZUJlZ2luRnJvbU1hc3RlciA9IGRhdGEuYXJnc1swXTtcbiAgICAgICAgICAgIHRoaXMuc2hhcmVkWydzeW5jVGltZUJlZ2luRnJvbU1hc3RlciddID0gc3luY1RpbWVCZWdpbkZyb21NYXN0ZXI7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGRhdGEubXNnID09ICdzYW1wbGU6Y2hhbmdlJykge1xuICAgICAgICAgICAgdGhpcy5zYW1wbGVDaGFuZ2UoZGF0YSk7XG4gICAgICAgIH1cbiAgICB9XG59XG4iXX0=