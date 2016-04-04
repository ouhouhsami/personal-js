'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _loadSamples = require('./loadSamples');

var _SyncServer = require('./SyncServer.js');

var _SyncClient = require('./SyncClient.js');

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var StateMachine = require('fsm-as-promised');

var wavesAudio = require('waves-audio');
var audioContext = wavesAudio.audioContext;

// overall output
var gainNode = audioContext.createGain();
gainNode.connect(audioContext.destination);

Object.values = function (obj) {
    return Object.keys(obj).map(function (key) {
        return obj[key];
    });
};

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
var $muteBtn = document.querySelector('#mute');

var samplePlayer = void 0;
var peerContext = void 0;

// Sample URLs
var sampleURLS = ['./media/bass-1.mp3', './media/bass-2.mp3', './media/bass-3.mp3', './media/drums1-1.mp3', './media/drums1-2.mp3', './media/drums1-3.mp3', './media/drums2-1.mp3', './media/drums2-2.mp3', './media/drums3-1.mp3', './media/drums3-2.mp3', './media/drums3-3.mp3', './media/fx-1.mp3', './media/guitar-1.mp3', './media/guitar-2.mp3', './media/synths-1.mp3', './media/synths-10.mp3', './media/synths-11.mp3', './media/synths-2.mp3', './media/synths-3.mp3', './media/synths-4.mp3', './media/synths-5.mp3', './media/synths-6.mp3', './media/synths-7.mp3', './media/synths-8.mp3', './media/synths-9.mp3', './media/voice-1.mp3', './media/voice-2.mp3', './media/voice-3.mp3', './media/voice-4.mp3', './media/voice-5.mp3'];

// StateMachine
var fsm = StateMachine({
    initial: 'init',
    events: [{ name: 'Init', from: 'init', to: 'initialized' }, { name: 'CreatePeer', from: 'initialized', to: 'peerCreated' }, { name: 'JoinPeer', from: 'initialized', to: 'peerJoined' }, { name: 'Play', from: ['peerJoined', 'peerCreated'], to: 'play' }, { name: 'Reset', from: 'play', to: 'init' }],
    callbacks: {
        onInit: function onInit(options) {
            return new Promise(function (resolve, reject) {
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

$muteBtn.addEventListener('click', function () {
    console.log($muteBtn.checked);
    if ($muteBtn.checked) {
        gainNode.gain.value = 0;
    } else {
        gainNode.gain.value = 1;
    }
});

var SamplePlayer = function () {
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

            var _loop = function _loop(i) {
                var $pad = document.createElement('button');
                var sampleName = sampleURLS[i].split('.')[1].split("/")[2];
                $pad.classList.add(sampleName);
                $pad.classList.add("sample-" + i);
                $pad.classList.add("sample");
                $pad.textContent = sampleName;
                $pad.addEventListener('click', function () {
                    _this.play(i);
                }, false);
                $playScreen.insertBefore($pad, $muteBtn);
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
            // source.connect(audioContext.destination);
            source.connect(gainNode);
            source.buffer = this.currentAudioBuffer;
            source.start(0, this.offset);
            // pretty display
            var $allSamples = document.querySelectorAll('.sample');
            for (var i = 0; i < $allSamples.length; ++i) {
                $allSamples[i].style["background-color"] = "white";
            }
            var $target = document.querySelector('.sample-' + padID);
            $target.style["background-color"] = "red";
            // TODO Send message to connected peers
            this.peerContext.sendMessage('sample-' + padID);
        }
    }, {
        key: 'played',
        value: function played(id, peerID) {
            // to show peer played samples
            // get all elements with "played-"+peedID class
            var $previousPad = document.getElementsByClassName("played-" + peerID);
            if ($previousPad.length > 0) {
                // remove class played and "played-"+peerID
                $previousPad[0].classList.remove("played");
                $previousPad[0].classList.remove("played-" + peerID);
            }
            var $pad = document.getElementsByClassName(id)[0];
            $pad.classList.add("played");
            $pad.classList.add("played-" + peerID);
        }
    }, {
        key: 'offset',
        get: function get() {
            var offset = 0;
            var latency = parseInt($latency.value) / 1000;
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
                var _syncTime = this.peerContext.syncSlave.getSyncTime();
                var _nbLoop = parseInt((_syncTime - syncTimeBeginFromMaster) / this.currentAudioBuffer.duration);
                var _lastBeginTime = syncTimeBeginFromMaster + _nbLoop * this.currentAudioBuffer.duration;
                offset = _syncTime - _lastBeginTime;
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
}();

var PeerMasterContext = function () {
    function PeerMasterContext(peerID) {
        var _this2 = this;

        _classCallCheck(this, PeerMasterContext);

        this.shared = {};
        this.shared['connectedPeers'] = {};
        this.peerID = peerID;
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
            this.syncMaster = new _SyncServer.SyncServer(getTimeFunction);
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
                if (data.msg == 'sample:change') {
                    samplePlayer.played(data.args[0], data.args[1]);
                    // send update to other peer
                    Object.keys(that.shared['connectedPeers']).forEach(function (key, index) {
                        if (key !== data.args[1] && key !== that.peerID) {
                            that.shared['connectedPeers'][key].send({
                                'msg': 'sample:change',
                                args: [data.args[0], data.args[1]]
                            });
                        }
                    });
                }
            };
        }
    }, {
        key: 'sendMessage',
        value: function sendMessage(msg) {
            var _iteratorNormalCompletion = true;
            var _didIteratorError = false;
            var _iteratorError = undefined;

            try {
                for (var _iterator = Object.values(this.shared['connectedPeers'])[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                    var conn = _step.value;

                    conn.send({
                        'msg': 'sample:change',
                        args: [msg, this.peerID]
                    });
                }
            } catch (err) {
                _didIteratorError = true;
                _iteratorError = err;
            } finally {
                try {
                    if (!_iteratorNormalCompletion && _iterator.return) {
                        _iterator.return();
                    }
                } finally {
                    if (_didIteratorError) {
                        throw _iteratorError;
                    }
                }
            }
        }
    }]);

    return PeerMasterContext;
}();

var PeerSlaveContext = function () {
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
        peer.on('open', function (id) {
            _this3.peerID = id;
        });
        conn.on('open', function (id) {
            _this3.sync = "slave";
            _this3.peerSlaveSync(conn);
        });

        this.type = "slave";
    }

    _createClass(PeerSlaveContext, [{
        key: 'peerSlaveSync',
        value: function peerSlaveSync(remoteConn) {
            var conn = this.shared['conn'];
            var connectedPeers = this.shared['connectedPeers'];
            connectedPeers[conn.peer] = remoteConn;

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

            this.syncSlave = new _SyncClient.SyncClient(getTimeFunction);
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
                samplePlayer.played(data.args[0], data.args[1]);
            }
        }
    }, {
        key: 'sendMessage',
        value: function sendMessage(msg) {
            var _iteratorNormalCompletion2 = true;
            var _didIteratorError2 = false;
            var _iteratorError2 = undefined;

            try {
                for (var _iterator2 = Object.values(this.shared['connectedPeers'])[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
                    var conn = _step2.value;

                    conn.send({
                        'msg': 'sample:change',
                        args: [msg, this.peerID]
                    });
                }
            } catch (err) {
                _didIteratorError2 = true;
                _iteratorError2 = err;
            } finally {
                try {
                    if (!_iteratorNormalCompletion2 && _iterator2.return) {
                        _iterator2.return();
                    }
                } finally {
                    if (_didIteratorError2) {
                        throw _iteratorError2;
                    }
                }
            }
        }
    }]);

    return PeerSlaveContext;
}();