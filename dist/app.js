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

    // import { loadSamples } from './loadSamples';

    // import { SyncServer }
    // from './SyncServer.js';
    // import { SyncClient }
    // from './SyncClient.js';

    // const wavesAudio = require('waves-audio');
    // const audioContext = wavesAudio.audioContext;

    // const $peer = document.querySelector('#peer');
    // const $create = document.querySelector('#create');
    // const $join = document.querySelector('#join');

    // const sampleURLS = ['./media/bass-1.mp3', './media/bass-2.mp3', './media/bass-3.mp3', './media/drums1-1.mp3', './media/drums1-2.mp3', './media/drums1-3.mp3', './media/drums2-1.mp3', './media/drums2-2.mp3', './media/drums3-1.mp3', './media/drums3-2.mp3', './media/drums3-3.mp3', './media/fx-1.mp3', './media/guitar-1.mp3', './media/guitar-2.mp3', './media/synths-1.mp3', './media/synths-10.mp3', './media/synths-11.mp3', './media/synths-2.mp3', './media/synths-3.mp3', './media/synths-4.mp3', './media/synths-5.mp3', './media/synths-6.mp3', './media/synths-7.mp3', './media/synths-8.mp3', './media/synths-9.mp3', './media/voice-1.mp3', './media/voice-2.mp3', './media/voice-3.mp3', './media/voice-4.mp3', './media/voice-5.mp3'];

    // class App {
    //     constructor() {
    //         this.load();
    //         this.$play = document.querySelector('#play');
    //         this.$play.style.display = "none";
    //         this.$reset = document.querySelector('#reset')
    //         this.$reset.addEventListener('click', () => {
    //             // this.currentSource.stop();
    //             this.$play.style.display = "none";
    //             this.$connect.style.display = "block";
    //             //console.log(this.shared.connectedPeers);
    //             var cP = Object.keys(this.shared.connectedPeers);
    //             for (var i = 0; i < cP.length; i++) {
    //                 var val = this.shared.connectedPeers[cP[i]];
    //                 console.log(val)
    //                 val.dataChannel.close();
    //                 // use val
    //             }
    //             $peer.value = "";
    //             document.location.reload();
    //         })
    //         this.$connect = document.querySelector('#connect');
    //         this.samples = [];
    //         $create.addEventListener('click', () => {
    //             this.create($peer.value)
    //         }, false)
    //         $join.addEventListener('click', () => {
    //             this.join($peer.value)
    //         }, false)
    //         this.currentSource = undefined;
    //         this.sync = undefined
    //         this.shared = {
    //             'peer': undefined,
    //             'connectedPeers': {}
    //         }
    //     }
    //     load() {
    //         console.log('Load samples');
    //         loadSamples(sampleURLS).then((samples) => {
    //             // build play interface
    //             this.samples = samples;
    //             this.buildPads()
    //         });
    //     }
    //     create(peerID) {
    //         this.peer = new Peer(peerID, {
    //             key: 'ubgje3sm5p0evcxr',
    //             debug: 3,
    //             logFunction: function() {
    //                 var copy = Array.prototype.slice.call(arguments).join(' ');
    //                 console.log(copy);
    //             }
    //         });
    //         this.peer.on('open', (id) => {
    //             console.log("created")
    //             this.$play.style.display = "block";
    //             this.$connect.style.display = "none";
    //             this.sync = "master";
    //             this.shared['peer'] = id;
    //             this.peerMasterSync();
    //         });
    //     }

    //     // MASTER SYNC PROCESS

    //     peerMasterSync() {
    //         // Function to get the local time
    //         let getTimeFunction = () => {
    //             return audioContext.currentTime;
    //         };
    //         // Initialize sync module
    //         this.syncMaster = new SyncServer(getTimeFunction);
    //         // shared['sync'] = syncMaster
    //         //var peer = this.shared['peer'];
    //         this.peer.on('connection', this.slaveConnect.bind(this));
    //         // return new Promise(function(resolve, reject) {
    //         //     resolve('play');
    //         // })
    //         this.play(12);
    //     }

    //     slaveConnect(conn) {
    //         console.log('CONNECTION !')
    //         this.shared['connectedPeers'] = this.shared['connectedPeers'] || {};
    //         let connectedPeers = this.shared['connectedPeers'];
    //         connectedPeers[conn.peer] = conn;

    //         let sendFunction = conn.send.bind(conn)
    //         let receiveFunction = conn.on.bind(conn)

    //         let syncTimeBegin = this.shared['syncTimeBegin'];
    //         sendFunction({
    //             'msg': 'sync:syncTimeBegin',
    //             args: [syncTimeBegin]
    //         })

    //         this.syncMaster.start(sendFunction, receiveFunction);

    //         conn.on('data', this.peerMasterDataListener.bind(this)(conn, this))
    //     }

    //     peerMasterDataListener(conn, that) {
    //         return function(data) {
    //             if (data.msg == 'sync:newPeer') {

    //                 that.shared['connectedPeers'][data.args[0]] = conn;
    //                 console.log("new peer:", that.shared['connectedPeers'])
    //                 // let syncTimeBegin = that.shared['syncTimeBegin'];
    //                 let syncTimeBegin = that.syncTimeBegin;
    //                 //
    //                 conn.send({
    //                     'msg': 'sync:syncTimeBegin',
    //                     args: [syncTimeBegin]
    //                 })
    //                 // if (that.shared['peer']) {
    //                 //     conn.send({
    //                 //         'msg': 'sample:change',
    //                 //         args: [that.shared['currentId'], that.shared['peer'].id]
    //                 //     })
    //                 // }
    //             }
    //             // if (data.msg == 'sample:change') {
    //             //     that.sampleChange(data);
    //             // }
    //         }

    //     }

    //     sampleChange(data) {
    //         console.log('CHANGE', data);
    //         let sampleId = data.args[0];
    //         let pId = data.args[1];
    //         let c = 'peer-played-' + pId;
    //         let tg = document.querySelector('.sample-'+sampleId);
    //         tg.style["border-color"] = "green";

    //         //$('.samples').find("a").removeClass(c);
    //         //$('.sample[data-id='+sampleId+']').addClass(c);
    //     }

    //     join(peerID) {
    //         let peer = new Peer({
    //             key: 'ubgje3sm5p0evcxr',
    //             debug: 3,
    //             logFunction: function() {
    //                 var copy = Array.prototype.slice.call(arguments).join(' ');
    //                 console.log(copy);
    //             }
    //         });
    //         var conn = peer.connect(peerID);
    //         this.shared['conn'] = conn;
    //         peer.on('error', function(err) {
    //             console.log(err);
    //         })
    //         conn.on('open', () => {
    //             console.log("join")
    //             // this.$play.style.display = "block";
    //             // this.$connect.style.display = "none";
    //             this.sync = "slave";
    //             this.peerSlaveSync()
    //         });
    //     }

    //     // SLAVE SYNC PROCESS

    //     peerSlaveSync() {
    //         let conn = this.shared['conn'];
    //         this.shared['connectedPeers'] = this.shared['connectedPeers'] || {};
    //         let connectedPeers = this.shared['connectedPeers'];
    //         connectedPeers[conn.peer] = 1;

    //         conn.send({
    //             'msg': 'sync:newPeer',
    //             'args': [conn.peer]
    //         });
    //         //
    //         let getTimeFunction = () => {
    //             return audioContext.currentTime;
    //         };
    //         // Function to send a message to the master peer
    //         var sendFunction = conn.send.bind(conn);
    //         // Function to receive a message from the master peer
    //         var receiveFunction = conn.on.bind(conn);

    //         var reportFunction = this.syncSlave.bind(this); // console.log; // FAKE

    //         this.syncSlave = new SyncClient(getTimeFunction);
    //         this.syncSlave.start(sendFunction, receiveFunction, reportFunction);
    //         this.shared['sync'] = this.syncSlave;

    //         conn.on('data', this.peerSlaveDataListener.bind(this))

    //         conn.on('close', () => {
    //             $peer.value = "";
    //             document.location.reload();
    //         })

    //     }

    //     syncSlave(obj) {
    //         //
    //         this.$play.style.display = "block";
    //         this.$connect.style.display = "none";
    //         this.syncTime = obj.timeOffset;
    //     }

    //     peerSlaveDataListener(data) {
    //         if (data.msg == 'sync:syncTimeBegin') {
    //             // console.log("sync:syncTimeBegin", data.args[0]);
    //             var syncTimeBeginFromMaster = data.args[0];
    //             this.shared['syncTimeBeginFromMaster'] = syncTimeBeginFromMaster;
    //         }
    //         if (data.msg == 'sample:change') {
    //             this.sampleChange(data);
    //         }
    //     }

    //     buildPads() {
    //         for (let i = 0; i < this.samples.length; i++) {
    //             let $pad = document.createElement('button');
    //             let sampleName = sampleURLS[i].split('.')[1].split("/")[2]
    //             $pad.classList.add(sampleName)
    //             $pad.classList.add("sample-"+i);
    //             $pad.classList.add("sample");
    //             $pad.textContent = sampleName;
    //             $pad.addEventListener('click', () => {
    //                 this.play(i);
    //             }, false);
    //             this.$play.insertBefore($pad, this.$reset)
    //         }
    //     }
    //     play(padID) {
    //         if (this.currentSource) {
    //             this.currentSource.stop()
    //         }
    //         let source = audioContext.createBufferSource()
    //         this.currentSource = source;
    //         let audioBuffer = this.samples[padID];
    //         source.loop = true;
    //         source.connect(audioContext.destination);
    //         source.buffer = audioBuffer;
    //         let seek = 0;
    //         if (this.syncMaster) {
    //             if (!this.syncTimeBegin) {
    //                 this.syncTimeBegin = audioContext.currentTime;
    //             }
    //             let syncTime = audioContext.currentTime;
    //             let nbLoop = parseInt((syncTime - this.syncTimeBegin) / audioBuffer.duration);
    //             let lastBeginTime = this.syncTimeBegin + nbLoop * audioBuffer.duration;
    //             seek = syncTime - lastBeginTime;
    //             //
    //             // let cP = Object.keys(this.shared.connectedPeers);
    //             // for (var i = 0; i < cP.length; i++) {
    //             //     cP.send([padID, this.shared['peer']])

    //             // }

    //         } else {
    //                 //let syncSlave = this.shared['sync'];
    //                 let syncTimeBeginFromMaster = this.shared['syncTimeBeginFromMaster'];
    //                 let syncTime = this.syncSlave.getSyncTime();
    //                 let nbLoop = parseInt((syncTime - syncTimeBeginFromMaster)/audioBuffer.duration);
    //                 let lastBeginTime = syncTimeBeginFromMaster + nbLoop * audioBuffer.duration;
    //                 seek = syncTime-lastBeginTime;

    //                 // let conn = this.shared['conn'];
    //                 // console.log([padID, conn.id])
    //                 // conn.send({
    //                 //     'msg': 'sample:change',
    //                 //     'args': [padID, conn.id]
    //                 // });

    //         }
    //         source.start(0, seek);
    //         // pretty display
    //         let $allSamples = document.querySelectorAll('.sample');
    //         for (var i = 0; i < $allSamples.length; ++i) {
    //           $allSamples[i].style["background-color"] = "white";
    //         }
    //         let $target = document.querySelector('.sample-'+padID);
    //         $target.style["background-color"] = "red";

    //     }
    // }

    // let app = new App();

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
//# sourceMappingURL=data:application/json;base64,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LCJmaWxlIjoiZXM2L1N5bmNTZXJ2ZXIuanMiLCJzb3VyY2VzQ29udGVudCI6WyJsZXQgU3RhdGVNYWNoaW5lID0gcmVxdWlyZSgnZnNtLWFzLXByb21pc2VkJyk7XG5pbXBvcnQgeyBsb2FkU2FtcGxlcyB9IGZyb20gJy4vbG9hZFNhbXBsZXMnO1xuaW1wb3J0IHsgU3luY1NlcnZlciB9IGZyb20gJy4vU3luY1NlcnZlci5qcyc7XG5pbXBvcnQgeyBTeW5jQ2xpZW50IH0gZnJvbSAnLi9TeW5jQ2xpZW50LmpzJztcbmNvbnN0IHdhdmVzQXVkaW8gPSByZXF1aXJlKCd3YXZlcy1hdWRpbycpO1xuY29uc3QgYXVkaW9Db250ZXh0ID0gd2F2ZXNBdWRpby5hdWRpb0NvbnRleHQ7XG5cbi8vIFNjcmVlbnNcbmNvbnN0ICRjb25uZWN0U2NyZWVuID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI2Nvbm5lY3QnKTtcbmNvbnN0ICRwbGF5U2NyZWVuID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI3BsYXknKTtcbiRjb25uZWN0U2NyZWVuLnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIjtcbiRwbGF5U2NyZWVuLnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIjtcblxuLy8gUGVlciBGb3JtIGZpZWxkc1xuY29uc3QgJHBlZXIgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjcGVlcicpO1xuY29uc3QgJGNyZWF0ZVBlZXJCdG4gPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjY3JlYXRlJyk7XG5jb25zdCAkam9pblBlZXJCdG4gPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjam9pbicpO1xuY29uc3QgJHJlc2V0QnRuID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI3Jlc2V0Jyk7XG5cbmxldCBzYW1wbGVQbGF5ZXI7XG5sZXQgcGVlckNvbnRleHQ7XG5cbi8vIFNhbXBsZSBVUkxzXG5jb25zdCBzYW1wbGVVUkxTID0gWycuL21lZGlhL2Jhc3MtMS5tcDMnLCAnLi9tZWRpYS9iYXNzLTIubXAzJywgJy4vbWVkaWEvYmFzcy0zLm1wMycsICcuL21lZGlhL2RydW1zMS0xLm1wMycsICcuL21lZGlhL2RydW1zMS0yLm1wMycsICcuL21lZGlhL2RydW1zMS0zLm1wMycsICcuL21lZGlhL2RydW1zMi0xLm1wMycsICcuL21lZGlhL2RydW1zMi0yLm1wMycsICcuL21lZGlhL2RydW1zMy0xLm1wMycsICcuL21lZGlhL2RydW1zMy0yLm1wMycsICcuL21lZGlhL2RydW1zMy0zLm1wMycsICcuL21lZGlhL2Z4LTEubXAzJywgJy4vbWVkaWEvZ3VpdGFyLTEubXAzJywgJy4vbWVkaWEvZ3VpdGFyLTIubXAzJywgJy4vbWVkaWEvc3ludGhzLTEubXAzJywgJy4vbWVkaWEvc3ludGhzLTEwLm1wMycsICcuL21lZGlhL3N5bnRocy0xMS5tcDMnLCAnLi9tZWRpYS9zeW50aHMtMi5tcDMnLCAnLi9tZWRpYS9zeW50aHMtMy5tcDMnLCAnLi9tZWRpYS9zeW50aHMtNC5tcDMnLCAnLi9tZWRpYS9zeW50aHMtNS5tcDMnLCAnLi9tZWRpYS9zeW50aHMtNi5tcDMnLCAnLi9tZWRpYS9zeW50aHMtNy5tcDMnLCAnLi9tZWRpYS9zeW50aHMtOC5tcDMnLCAnLi9tZWRpYS9zeW50aHMtOS5tcDMnLCAnLi9tZWRpYS92b2ljZS0xLm1wMycsICcuL21lZGlhL3ZvaWNlLTIubXAzJywgJy4vbWVkaWEvdm9pY2UtMy5tcDMnLCAnLi9tZWRpYS92b2ljZS00Lm1wMycsICcuL21lZGlhL3ZvaWNlLTUubXAzJ107XG5cbi8vIFN0YXRlTWFjaGluZVxubGV0IGZzbSA9IFN0YXRlTWFjaGluZSh7XG4gICAgaW5pdGlhbDogJ2luaXQnLFxuICAgIGV2ZW50czogW1xuICAgICAgICB7IG5hbWU6ICdJbml0JywgZnJvbTogJ2luaXQnLCB0bzogJ2luaXRpYWxpemVkJyB9LFxuICAgICAgICB7IG5hbWU6ICdDcmVhdGVQZWVyJywgZnJvbTogJ2luaXRpYWxpemVkJywgdG86ICdwZWVyQ3JlYXRlZCcgfSxcbiAgICAgICAgeyBuYW1lOiAnSm9pblBlZXInLCBmcm9tOiAnaW5pdGlhbGl6ZWQnLCB0bzogJ3BlZXJKb2luZWQnIH0sXG4gICAgICAgIHsgbmFtZTogJ1BsYXknLCBmcm9tOiBbJ3BlZXJKb2luZWQnLCAncGVlckNyZWF0ZWQnXSwgdG86ICdwbGF5J30sXG4gICAgICAgIHsgbmFtZTogJ1Jlc2V0JywgZnJvbTogJ3BsYXknLCB0bzogJ2luaXQnIH0sXG4gICAgXSxcbiAgICBjYWxsYmFja3M6IHtcbiAgICAgICAgb25Jbml0OiBmdW5jdGlvbihvcHRpb25zKXtcbiAgICAgICAgICAgIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgICAgICAgICAgLy8gbG9hZCBzYW1wbGVzXG4gICAgICAgICAgICAgICAgbG9hZFNhbXBsZXMoc2FtcGxlVVJMUykudGhlbihmdW5jdGlvbihzYW1wbGVzKXtcbiAgICAgICAgICAgICAgICAvLyBidWlsZCBwYWRzXG4gICAgICAgICAgICAgICAgc2FtcGxlUGxheWVyID0gbmV3IFNhbXBsZVBsYXllcihzYW1wbGVzKTtcbiAgICAgICAgICAgICAgICAvLyBzaG93IFVJIGZvciBjcmVhdGUgb3Igam9pbiBwZWVyXG4gICAgICAgICAgICAgICAgJGNvbm5lY3RTY3JlZW4uc3R5bGUuZGlzcGxheSA9IFwiYmxvY2tcIjtcbiAgICAgICAgICAgICAgICAvLyByZXNvbHZlXG4gICAgICAgICAgICAgICAgcmVzb2x2ZShvcHRpb25zKVxuICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0sXG4gICAgICAgIG9uQ3JlYXRlUGVlcjogZnVuY3Rpb24ob3B0aW9ucykge1xuICAgICAgICAgICAgLy8gaGlkZSBVSSBmb3IgY3JlYXRlIG9yIGpvaW4gcGVlclxuICAgICAgICAgICAgJGNvbm5lY3RTY3JlZW4uc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiO1xuICAgICAgICAgICAgbGV0IHBlZXJJRCA9IG9wdGlvbnMuYXJnc1swXTtcbiAgICAgICAgICAgIHBlZXJDb250ZXh0ID0gbmV3IFBlZXJNYXN0ZXJDb250ZXh0KHBlZXJJRCk7XG4gICAgICAgICAgICByZXR1cm4gb3B0aW9ucztcbiAgICAgICAgfSxcbiAgICAgICAgb25Kb2luUGVlcjogZnVuY3Rpb24ob3B0aW9ucykge1xuICAgICAgICAgICAgLy8gaGlkZSBVSSBmb3IgY3JlYXRlIG9yIGpvaW4gcGVlclxuICAgICAgICAgICAgJGNvbm5lY3RTY3JlZW4uc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiO1xuICAgICAgICAgICAgbGV0IHBlZXJJRCA9IG9wdGlvbnMuYXJnc1swXTtcbiAgICAgICAgICAgIHBlZXJDb250ZXh0ID0gbmV3IFBlZXJTbGF2ZUNvbnRleHQocGVlcklEKTtcbiAgICAgICAgICAgIHJldHVybiBvcHRpb25zO1xuICAgICAgICB9LFxuICAgICAgICBvblBsYXk6IGZ1bmN0aW9uKG9wdGlvbnMpe1xuICAgICAgICAgICAgc2FtcGxlUGxheWVyLnBlZXJDb250ZXh0ID0gcGVlckNvbnRleHQ7XG4gICAgICAgICAgICAkcGxheVNjcmVlbi5zdHlsZS5kaXNwbGF5ID0gXCJibG9ja1wiO1xuICAgICAgICAgICAgcmV0dXJuIG9wdGlvbnM7XG4gICAgICAgIH1cbiAgICB9XG59KTtcblxuZnNtLkluaXQoKVxuXG4kY3JlYXRlUGVlckJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpPT57XG4gICAgZnNtLkNyZWF0ZVBlZXIoJHBlZXIudmFsdWUpO1xufSlcbiRqb2luUGVlckJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpPT57XG4gICAgZnNtLkpvaW5QZWVyKCRwZWVyLnZhbHVlKTtcbn0pXG4kcmVzZXRCdG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKT0+e1xuICAgIGRvY3VtZW50LmxvY2F0aW9uLnJlbG9hZCgpO1xufSlcblxuY2xhc3MgU2FtcGxlUGxheWVyIHtcbiAgICBjb25zdHJ1Y3RvcihzYW1wbGVzKXtcbiAgICAgICAgdGhpcy5zYW1wbGVzID0gc2FtcGxlcztcbiAgICAgICAgdGhpcy5jdXJyZW50U291cmNlID0gdW5kZWZpbmVkO1xuICAgICAgICB0aGlzLmJ1aWxkUGFkcygpO1xuICAgIH1cbiAgICBidWlsZFBhZHMoKXtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLnNhbXBsZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGxldCAkcGFkID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYnV0dG9uJyk7XG4gICAgICAgICAgICBsZXQgc2FtcGxlTmFtZSA9IHNhbXBsZVVSTFNbaV0uc3BsaXQoJy4nKVsxXS5zcGxpdChcIi9cIilbMl1cbiAgICAgICAgICAgICRwYWQuY2xhc3NMaXN0LmFkZChzYW1wbGVOYW1lKVxuICAgICAgICAgICAgJHBhZC5jbGFzc0xpc3QuYWRkKFwic2FtcGxlLVwiICsgaSk7XG4gICAgICAgICAgICAkcGFkLmNsYXNzTGlzdC5hZGQoXCJzYW1wbGVcIik7XG4gICAgICAgICAgICAkcGFkLnRleHRDb250ZW50ID0gc2FtcGxlTmFtZTtcbiAgICAgICAgICAgICRwYWQuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5wbGF5KGkpO1xuICAgICAgICAgICAgfSwgZmFsc2UpO1xuICAgICAgICAgICAgJHBsYXlTY3JlZW4uaW5zZXJ0QmVmb3JlKCRwYWQsICRyZXNldEJ0bilcbiAgICAgICAgfVxuICAgIH1cbiAgICBwbGF5KHBhZElEKXtcbiAgICAgICAgaWYodGhpcy5jdXJyZW50U291cmNlKXtcbiAgICAgICAgICAgIHRoaXMuY3VycmVudFNvdXJjZS5zdG9wKCk7XG4gICAgICAgIH1cbiAgICAgICAgbGV0IHNvdXJjZSA9IGF1ZGlvQ29udGV4dC5jcmVhdGVCdWZmZXJTb3VyY2UoKVxuICAgICAgICB0aGlzLmN1cnJlbnRTb3VyY2UgPSBzb3VyY2U7XG4gICAgICAgIHRoaXMuY3VycmVudEF1ZGlvQnVmZmVyID0gdGhpcy5zYW1wbGVzW3BhZElEXTtcbiAgICAgICAgc291cmNlLmxvb3AgPSB0cnVlO1xuICAgICAgICBzb3VyY2UuY29ubmVjdChhdWRpb0NvbnRleHQuZGVzdGluYXRpb24pO1xuICAgICAgICBzb3VyY2UuYnVmZmVyID0gdGhpcy5jdXJyZW50QXVkaW9CdWZmZXI7XG5cbiAgICAgICAgc291cmNlLnN0YXJ0KDAsIHRoaXMub2Zmc2V0KTtcbiAgICAgICAgLy8gcHJldHR5IGRpc3BsYXlcbiAgICAgICAgbGV0ICRhbGxTYW1wbGVzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnLnNhbXBsZScpO1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8ICRhbGxTYW1wbGVzLmxlbmd0aDsgKytpKSB7XG4gICAgICAgICAgJGFsbFNhbXBsZXNbaV0uc3R5bGVbXCJiYWNrZ3JvdW5kLWNvbG9yXCJdID0gXCJ3aGl0ZVwiO1xuICAgICAgICB9XG4gICAgICAgIGxldCAkdGFyZ2V0ID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLnNhbXBsZS0nK3BhZElEKTtcbiAgICAgICAgJHRhcmdldC5zdHlsZVtcImJhY2tncm91bmQtY29sb3JcIl0gPSBcInJlZFwiO1xuICAgIH1cbiAgICBnZXQgb2Zmc2V0KCl7XG4gICAgICAgIGxldCBvZmZzZXQgPSAwO1xuICAgICAgICBpZih0aGlzLnBlZXJDb250ZXh0LnR5cGUgPT0gJ21hc3Rlcicpe1xuICAgICAgICAgICAgaWYgKCF0aGlzLnN5bmNUaW1lQmVnaW4pIHtcbiAgICAgICAgICAgICAgICB0aGlzLnN5bmNUaW1lQmVnaW4gPSBhdWRpb0NvbnRleHQuY3VycmVudFRpbWU7XG4gICAgICAgICAgICAgICAgLy8gc2V0IHRoaXMgb24gdGhlIG1hc3RlciBwZWVyXG4gICAgICAgICAgICAgICAgdGhpcy5wZWVyQ29udGV4dC5zaGFyZWRbJ3N5bmNUaW1lQmVnaW4nXSA9IHRoaXMuc3luY1RpbWVCZWdpbjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGxldCBzeW5jVGltZSA9IGF1ZGlvQ29udGV4dC5jdXJyZW50VGltZTtcbiAgICAgICAgICAgIGxldCBuYkxvb3AgPSBwYXJzZUludCgoc3luY1RpbWUgLSB0aGlzLnN5bmNUaW1lQmVnaW4pIC8gdGhpcy5jdXJyZW50QXVkaW9CdWZmZXIuZHVyYXRpb24pO1xuICAgICAgICAgICAgbGV0IGxhc3RCZWdpblRpbWUgPSB0aGlzLnN5bmNUaW1lQmVnaW4gKyBuYkxvb3AgKiB0aGlzLmN1cnJlbnRBdWRpb0J1ZmZlci5kdXJhdGlvbjtcbiAgICAgICAgICAgIG9mZnNldCA9IHN5bmNUaW1lIC0gbGFzdEJlZ2luVGltZTtcbiAgICAgICAgfWVsc2Uge1xuICAgICAgICAgICAgLy9sZXQgc3luY1RpbWVCZWdpbkZyb21NYXN0ZXIgPSB0aGlzLnNoYXJlZFsnc3luY1RpbWVCZWdpbkZyb21NYXN0ZXInXTtcbiAgICAgICAgICAgIGxldCBzeW5jVGltZUJlZ2luRnJvbU1hc3RlciA9IHRoaXMucGVlckNvbnRleHQuc2hhcmVkWydzeW5jVGltZUJlZ2luRnJvbU1hc3RlciddO1xuICAgICAgICAgICAgLy9sZXQgc3luY1RpbWUgPSB0aGlzLnN5bmNTbGF2ZS5nZXRTeW5jVGltZSgpO1xuICAgICAgICAgICAgbGV0IHN5bmNUaW1lID0gdGhpcy5wZWVyQ29udGV4dC5zeW5jU2xhdmUuZ2V0U3luY1RpbWUoKTtcbiAgICAgICAgICAgIGxldCBuYkxvb3AgPSBwYXJzZUludCgoc3luY1RpbWUgLSBzeW5jVGltZUJlZ2luRnJvbU1hc3RlcikvIHRoaXMuY3VycmVudEF1ZGlvQnVmZmVyLmR1cmF0aW9uKTtcbiAgICAgICAgICAgIGxldCBsYXN0QmVnaW5UaW1lID0gc3luY1RpbWVCZWdpbkZyb21NYXN0ZXIgKyBuYkxvb3AgKiAgdGhpcy5jdXJyZW50QXVkaW9CdWZmZXIuZHVyYXRpb247XG4gICAgICAgICAgICBvZmZzZXQgPSBzeW5jVGltZS1sYXN0QmVnaW5UaW1lO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBvZmZzZXRcbiAgICB9XG4gICAgc2V0IHBlZXJDb250ZXh0KHBDKXtcbiAgICAgICAgdGhpcy5fcGVlckNvbnRleHQgPSBwQ1xuICAgIH1cbiAgICBnZXQgcGVlckNvbnRleHQoKXtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3BlZXJDb250ZXh0O1xuICAgIH1cbn1cblxuY2xhc3MgUGVlck1hc3RlckNvbnRleHQge1xuICAgIGNvbnN0cnVjdG9yKHBlZXJJRCl7XG4gICAgICAgIHRoaXMuc2hhcmVkID0ge31cbiAgICAgICAgdGhpcy5zaGFyZWRbJ2Nvbm5lY3RlZFBlZXJzJ10gPSB7fVxuICAgICAgICB0aGlzLnBlZXIgPSBuZXcgUGVlcihwZWVySUQsIHtcbiAgICAgICAgICAgIGtleTogJ3ViZ2plM3NtNXAwZXZjeHInLFxuICAgICAgICAgICAgZGVidWc6IDMsXG4gICAgICAgICAgICBsb2dGdW5jdGlvbjogZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgdmFyIGNvcHkgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpLmpvaW4oJyAnKTtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhjb3B5KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMucGVlci5vbignb3BlbicsIChpZCkgPT4ge1xuICAgICAgICAgICAgLy8gd2UgY2FuIHBsYXkhXG4gICAgICAgICAgICBmc20uUGxheSgpO1xuICAgICAgICAgICAgdGhpcy5wZWVyTWFzdGVyU3luYygpO1xuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy50eXBlID0gJ21hc3Rlcic7XG4gICAgfVxuICAgIHBlZXJNYXN0ZXJTeW5jKCkge1xuICAgICAgICAvLyBGdW5jdGlvbiB0byBnZXQgdGhlIGxvY2FsIHRpbWVcbiAgICAgICAgbGV0IGdldFRpbWVGdW5jdGlvbiA9ICgpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBhdWRpb0NvbnRleHQuY3VycmVudFRpbWU7XG4gICAgICAgIH07XG4gICAgICAgIC8vIEluaXRpYWxpemUgc3luYyBtb2R1bGVcbiAgICAgICAgdGhpcy5zeW5jTWFzdGVyID0gbmV3IFN5bmNTZXJ2ZXIoZ2V0VGltZUZ1bmN0aW9uKTtcbiAgICAgICAgdGhpcy5wZWVyLm9uKCdjb25uZWN0aW9uJywgdGhpcy5zbGF2ZUNvbm5lY3QuYmluZCh0aGlzKSk7XG4gICAgfVxuICAgIHNsYXZlQ29ubmVjdChjb25uKSB7XG4gICAgICAgIGxldCBjb25uZWN0ZWRQZWVycyA9IHRoaXMuc2hhcmVkWydjb25uZWN0ZWRQZWVycyddO1xuICAgICAgICBjb25uZWN0ZWRQZWVyc1tjb25uLnBlZXJdID0gY29ubjtcblxuICAgICAgICBsZXQgc2VuZEZ1bmN0aW9uID0gY29ubi5zZW5kLmJpbmQoY29ubilcbiAgICAgICAgbGV0IHJlY2VpdmVGdW5jdGlvbiA9IGNvbm4ub24uYmluZChjb25uKVxuXG4gICAgICAgIGxldCBzeW5jVGltZUJlZ2luID0gdGhpcy5zaGFyZWRbJ3N5bmNUaW1lQmVnaW4nXTtcbiAgICAgICAgc2VuZEZ1bmN0aW9uKHtcbiAgICAgICAgICAgICdtc2cnOiAnc3luYzpzeW5jVGltZUJlZ2luJyxcbiAgICAgICAgICAgIGFyZ3M6IFtzeW5jVGltZUJlZ2luXVxuICAgICAgICB9KVxuICAgICAgICB0aGlzLnN5bmNNYXN0ZXIuc3RhcnQoc2VuZEZ1bmN0aW9uLCByZWNlaXZlRnVuY3Rpb24pO1xuXG4gICAgICAgIGNvbm4ub24oJ2RhdGEnLCB0aGlzLnBlZXJNYXN0ZXJEYXRhTGlzdGVuZXIuYmluZCh0aGlzKShjb25uLCB0aGlzKSlcblxuICAgIH1cbiAgICBwZWVyTWFzdGVyRGF0YUxpc3RlbmVyKGNvbm4sIHRoYXQpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgICAgICAgIGlmIChkYXRhLm1zZyA9PSAnc3luYzpuZXdQZWVyJykge1xuXG4gICAgICAgICAgICAgICAgdGhhdC5zaGFyZWRbJ2Nvbm5lY3RlZFBlZXJzJ11bZGF0YS5hcmdzWzBdXSA9IGNvbm47XG4gICAgICAgICAgICAgICAgbGV0IHN5bmNUaW1lQmVnaW4gPSB0aGF0LnNoYXJlZFsnc3luY1RpbWVCZWdpbiddO1xuICAgICAgICAgICAgICAgIC8vXG4gICAgICAgICAgICAgICAgY29ubi5zZW5kKHtcbiAgICAgICAgICAgICAgICAgICAgJ21zZyc6ICdzeW5jOnN5bmNUaW1lQmVnaW4nLFxuICAgICAgICAgICAgICAgICAgICBhcmdzOiBbc3luY1RpbWVCZWdpbl1cbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIC8vIGlmICh0aGF0LnNoYXJlZFsncGVlciddKSB7XG4gICAgICAgICAgICAgICAgLy8gICAgIGNvbm4uc2VuZCh7XG4gICAgICAgICAgICAgICAgLy8gICAgICAgICAnbXNnJzogJ3NhbXBsZTpjaGFuZ2UnLFxuICAgICAgICAgICAgICAgIC8vICAgICAgICAgYXJnczogW3RoYXQuc2hhcmVkWydjdXJyZW50SWQnXSwgdGhhdC5zaGFyZWRbJ3BlZXInXS5pZF1cbiAgICAgICAgICAgICAgICAvLyAgICAgfSlcbiAgICAgICAgICAgICAgICAvLyB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBpZiAoZGF0YS5tc2cgPT0gJ3NhbXBsZTpjaGFuZ2UnKSB7XG4gICAgICAgICAgICAvLyAgICAgdGhhdC5zYW1wbGVDaGFuZ2UoZGF0YSk7XG4gICAgICAgICAgICAvLyB9XG4gICAgICAgIH1cblxuICAgIH1cbn1cblxuXG5jbGFzcyBQZWVyU2xhdmVDb250ZXh0IHtcbiAgICBjb25zdHJ1Y3RvcihwZWVySUQpIHtcbiAgICAgICAgdGhpcy5zaGFyZWQgPSB7fVxuICAgICAgICB0aGlzLnNoYXJlZFsnY29ubmVjdGVkUGVlcnMnXSA9IHt9XG4gICAgICAgIGxldCBwZWVyID0gbmV3IFBlZXIoe1xuICAgICAgICAgICAga2V5OiAndWJnamUzc201cDBldmN4cicsXG4gICAgICAgICAgICBkZWJ1ZzogMyxcbiAgICAgICAgICAgIGxvZ0Z1bmN0aW9uOiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICB2YXIgY29weSA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cykuam9pbignICcpO1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGNvcHkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgbGV0IGNvbm4gPSBwZWVyLmNvbm5lY3QocGVlcklEKTtcbiAgICAgICAgdGhpcy5zaGFyZWRbJ2Nvbm4nXSA9IGNvbm47XG4gICAgICAgIHBlZXIub24oJ2Vycm9yJywgZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhlcnIpO1xuICAgICAgICB9KVxuICAgICAgICBjb25uLm9uKCdvcGVuJywgKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5zeW5jID0gXCJzbGF2ZVwiO1xuICAgICAgICAgICAgdGhpcy5wZWVyU2xhdmVTeW5jKClcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMudHlwZSA9IFwic2xhdmVcIjtcbiAgICB9XG5cbiAgICBwZWVyU2xhdmVTeW5jKCkge1xuICAgICAgICBsZXQgY29ubiA9IHRoaXMuc2hhcmVkWydjb25uJ107XG4gICAgICAgIGxldCBjb25uZWN0ZWRQZWVycyA9IHRoaXMuc2hhcmVkWydjb25uZWN0ZWRQZWVycyddO1xuICAgICAgICBjb25uZWN0ZWRQZWVyc1tjb25uLnBlZXJdID0gMTtcblxuICAgICAgICBjb25uLnNlbmQoe1xuICAgICAgICAgICAgJ21zZyc6ICdzeW5jOm5ld1BlZXInLFxuICAgICAgICAgICAgJ2FyZ3MnOiBbY29ubi5wZWVyXVxuICAgICAgICB9KTtcbiAgICAgICAgLy9cbiAgICAgICAgbGV0IGdldFRpbWVGdW5jdGlvbiA9ICgpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBhdWRpb0NvbnRleHQuY3VycmVudFRpbWU7XG4gICAgICAgIH07XG4gICAgICAgIC8vIEZ1bmN0aW9uIHRvIHNlbmQgYSBtZXNzYWdlIHRvIHRoZSBtYXN0ZXIgcGVlclxuICAgICAgICB2YXIgc2VuZEZ1bmN0aW9uID0gY29ubi5zZW5kLmJpbmQoY29ubik7XG4gICAgICAgIC8vIEZ1bmN0aW9uIHRvIHJlY2VpdmUgYSBtZXNzYWdlIGZyb20gdGhlIG1hc3RlciBwZWVyXG4gICAgICAgIHZhciByZWNlaXZlRnVuY3Rpb24gPSBjb25uLm9uLmJpbmQoY29ubik7XG5cbiAgICAgICAgdmFyIHJlcG9ydEZ1bmN0aW9uID0gdGhpcy5zeW5jU2xhdmUuYmluZCh0aGlzKTsgLy8gY29uc29sZS5sb2c7IC8vIEZBS0VcblxuICAgICAgICB0aGlzLnN5bmNTbGF2ZSA9IG5ldyBTeW5jQ2xpZW50KGdldFRpbWVGdW5jdGlvbik7XG4gICAgICAgIHRoaXMuc3luY1NsYXZlLnN0YXJ0KHNlbmRGdW5jdGlvbiwgcmVjZWl2ZUZ1bmN0aW9uLCByZXBvcnRGdW5jdGlvbik7XG4gICAgICAgIHRoaXMuc2hhcmVkWydzeW5jJ10gPSB0aGlzLnN5bmNTbGF2ZTtcblxuICAgICAgICBjb25uLm9uKCdkYXRhJywgdGhpcy5wZWVyU2xhdmVEYXRhTGlzdGVuZXIuYmluZCh0aGlzKSlcblxuICAgICAgICBjb25uLm9uKCdjbG9zZScsICgpID0+IHtcbiAgICAgICAgICAgICRwZWVyLnZhbHVlID0gXCJcIjtcbiAgICAgICAgICAgIGRvY3VtZW50LmxvY2F0aW9uLnJlbG9hZCgpO1xuICAgICAgICB9KVxuXG4gICAgfVxuXG4gICAgc3luY1NsYXZlKG9iaikge1xuICAgICAgICBmc20uUGxheSgpO1xuICAgICAgICB0aGlzLnN5bmNUaW1lID0gb2JqLnRpbWVPZmZzZXQ7XG4gICAgfVxuXG4gICAgcGVlclNsYXZlRGF0YUxpc3RlbmVyKGRhdGEpIHtcbiAgICAgICAgaWYgKGRhdGEubXNnID09ICdzeW5jOnN5bmNUaW1lQmVnaW4nKSB7XG4gICAgICAgICAgICB2YXIgc3luY1RpbWVCZWdpbkZyb21NYXN0ZXIgPSBkYXRhLmFyZ3NbMF07XG4gICAgICAgICAgICB0aGlzLnNoYXJlZFsnc3luY1RpbWVCZWdpbkZyb21NYXN0ZXInXSA9IHN5bmNUaW1lQmVnaW5Gcm9tTWFzdGVyO1xuICAgICAgICB9XG4gICAgICAgIGlmIChkYXRhLm1zZyA9PSAnc2FtcGxlOmNoYW5nZScpIHtcbiAgICAgICAgICAgIHRoaXMuc2FtcGxlQ2hhbmdlKGRhdGEpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG4vLyBpbXBvcnQgeyBsb2FkU2FtcGxlcyB9IGZyb20gJy4vbG9hZFNhbXBsZXMnO1xuXG4vLyBpbXBvcnQgeyBTeW5jU2VydmVyIH1cbi8vIGZyb20gJy4vU3luY1NlcnZlci5qcyc7XG4vLyBpbXBvcnQgeyBTeW5jQ2xpZW50IH1cbi8vIGZyb20gJy4vU3luY0NsaWVudC5qcyc7XG5cbi8vIGNvbnN0IHdhdmVzQXVkaW8gPSByZXF1aXJlKCd3YXZlcy1hdWRpbycpO1xuLy8gY29uc3QgYXVkaW9Db250ZXh0ID0gd2F2ZXNBdWRpby5hdWRpb0NvbnRleHQ7XG5cbi8vIGNvbnN0ICRwZWVyID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI3BlZXInKTtcbi8vIGNvbnN0ICRjcmVhdGUgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjY3JlYXRlJyk7XG4vLyBjb25zdCAkam9pbiA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyNqb2luJyk7XG5cbi8vIGNvbnN0IHNhbXBsZVVSTFMgPSBbJy4vbWVkaWEvYmFzcy0xLm1wMycsICcuL21lZGlhL2Jhc3MtMi5tcDMnLCAnLi9tZWRpYS9iYXNzLTMubXAzJywgJy4vbWVkaWEvZHJ1bXMxLTEubXAzJywgJy4vbWVkaWEvZHJ1bXMxLTIubXAzJywgJy4vbWVkaWEvZHJ1bXMxLTMubXAzJywgJy4vbWVkaWEvZHJ1bXMyLTEubXAzJywgJy4vbWVkaWEvZHJ1bXMyLTIubXAzJywgJy4vbWVkaWEvZHJ1bXMzLTEubXAzJywgJy4vbWVkaWEvZHJ1bXMzLTIubXAzJywgJy4vbWVkaWEvZHJ1bXMzLTMubXAzJywgJy4vbWVkaWEvZngtMS5tcDMnLCAnLi9tZWRpYS9ndWl0YXItMS5tcDMnLCAnLi9tZWRpYS9ndWl0YXItMi5tcDMnLCAnLi9tZWRpYS9zeW50aHMtMS5tcDMnLCAnLi9tZWRpYS9zeW50aHMtMTAubXAzJywgJy4vbWVkaWEvc3ludGhzLTExLm1wMycsICcuL21lZGlhL3N5bnRocy0yLm1wMycsICcuL21lZGlhL3N5bnRocy0zLm1wMycsICcuL21lZGlhL3N5bnRocy00Lm1wMycsICcuL21lZGlhL3N5bnRocy01Lm1wMycsICcuL21lZGlhL3N5bnRocy02Lm1wMycsICcuL21lZGlhL3N5bnRocy03Lm1wMycsICcuL21lZGlhL3N5bnRocy04Lm1wMycsICcuL21lZGlhL3N5bnRocy05Lm1wMycsICcuL21lZGlhL3ZvaWNlLTEubXAzJywgJy4vbWVkaWEvdm9pY2UtMi5tcDMnLCAnLi9tZWRpYS92b2ljZS0zLm1wMycsICcuL21lZGlhL3ZvaWNlLTQubXAzJywgJy4vbWVkaWEvdm9pY2UtNS5tcDMnXTtcblxuLy8gY2xhc3MgQXBwIHtcbi8vICAgICBjb25zdHJ1Y3RvcigpIHtcbi8vICAgICAgICAgdGhpcy5sb2FkKCk7XG4vLyAgICAgICAgIHRoaXMuJHBsYXkgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjcGxheScpO1xuLy8gICAgICAgICB0aGlzLiRwbGF5LnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIjtcbi8vICAgICAgICAgdGhpcy4kcmVzZXQgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjcmVzZXQnKVxuLy8gICAgICAgICB0aGlzLiRyZXNldC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbi8vICAgICAgICAgICAgIC8vIHRoaXMuY3VycmVudFNvdXJjZS5zdG9wKCk7XG4vLyAgICAgICAgICAgICB0aGlzLiRwbGF5LnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIjtcbi8vICAgICAgICAgICAgIHRoaXMuJGNvbm5lY3Quc3R5bGUuZGlzcGxheSA9IFwiYmxvY2tcIjtcbi8vICAgICAgICAgICAgIC8vY29uc29sZS5sb2codGhpcy5zaGFyZWQuY29ubmVjdGVkUGVlcnMpO1xuLy8gICAgICAgICAgICAgdmFyIGNQID0gT2JqZWN0LmtleXModGhpcy5zaGFyZWQuY29ubmVjdGVkUGVlcnMpO1xuLy8gICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjUC5sZW5ndGg7IGkrKykge1xuLy8gICAgICAgICAgICAgICAgIHZhciB2YWwgPSB0aGlzLnNoYXJlZC5jb25uZWN0ZWRQZWVyc1tjUFtpXV07XG4vLyAgICAgICAgICAgICAgICAgY29uc29sZS5sb2codmFsKVxuLy8gICAgICAgICAgICAgICAgIHZhbC5kYXRhQ2hhbm5lbC5jbG9zZSgpO1xuLy8gICAgICAgICAgICAgICAgIC8vIHVzZSB2YWxcbi8vICAgICAgICAgICAgIH1cbi8vICAgICAgICAgICAgICRwZWVyLnZhbHVlID0gXCJcIjtcbi8vICAgICAgICAgICAgIGRvY3VtZW50LmxvY2F0aW9uLnJlbG9hZCgpO1xuLy8gICAgICAgICB9KVxuLy8gICAgICAgICB0aGlzLiRjb25uZWN0ID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI2Nvbm5lY3QnKTtcbi8vICAgICAgICAgdGhpcy5zYW1wbGVzID0gW107XG4vLyAgICAgICAgICRjcmVhdGUuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4vLyAgICAgICAgICAgICB0aGlzLmNyZWF0ZSgkcGVlci52YWx1ZSlcbi8vICAgICAgICAgfSwgZmFsc2UpXG4vLyAgICAgICAgICRqb2luLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuLy8gICAgICAgICAgICAgdGhpcy5qb2luKCRwZWVyLnZhbHVlKVxuLy8gICAgICAgICB9LCBmYWxzZSlcbi8vICAgICAgICAgdGhpcy5jdXJyZW50U291cmNlID0gdW5kZWZpbmVkO1xuLy8gICAgICAgICB0aGlzLnN5bmMgPSB1bmRlZmluZWRcbi8vICAgICAgICAgdGhpcy5zaGFyZWQgPSB7XG4vLyAgICAgICAgICAgICAncGVlcic6IHVuZGVmaW5lZCxcbi8vICAgICAgICAgICAgICdjb25uZWN0ZWRQZWVycyc6IHt9XG4vLyAgICAgICAgIH1cbi8vICAgICB9XG4vLyAgICAgbG9hZCgpIHtcbi8vICAgICAgICAgY29uc29sZS5sb2coJ0xvYWQgc2FtcGxlcycpO1xuLy8gICAgICAgICBsb2FkU2FtcGxlcyhzYW1wbGVVUkxTKS50aGVuKChzYW1wbGVzKSA9PiB7XG4vLyAgICAgICAgICAgICAvLyBidWlsZCBwbGF5IGludGVyZmFjZVxuLy8gICAgICAgICAgICAgdGhpcy5zYW1wbGVzID0gc2FtcGxlcztcbi8vICAgICAgICAgICAgIHRoaXMuYnVpbGRQYWRzKClcbi8vICAgICAgICAgfSk7XG4vLyAgICAgfVxuLy8gICAgIGNyZWF0ZShwZWVySUQpIHtcbi8vICAgICAgICAgdGhpcy5wZWVyID0gbmV3IFBlZXIocGVlcklELCB7XG4vLyAgICAgICAgICAgICBrZXk6ICd1YmdqZTNzbTVwMGV2Y3hyJyxcbi8vICAgICAgICAgICAgIGRlYnVnOiAzLFxuLy8gICAgICAgICAgICAgbG9nRnVuY3Rpb246IGZ1bmN0aW9uKCkge1xuLy8gICAgICAgICAgICAgICAgIHZhciBjb3B5ID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKS5qb2luKCcgJyk7XG4vLyAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coY29weSk7XG4vLyAgICAgICAgICAgICB9XG4vLyAgICAgICAgIH0pO1xuLy8gICAgICAgICB0aGlzLnBlZXIub24oJ29wZW4nLCAoaWQpID0+IHtcbi8vICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiY3JlYXRlZFwiKVxuLy8gICAgICAgICAgICAgdGhpcy4kcGxheS5zdHlsZS5kaXNwbGF5ID0gXCJibG9ja1wiO1xuLy8gICAgICAgICAgICAgdGhpcy4kY29ubmVjdC5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XG4vLyAgICAgICAgICAgICB0aGlzLnN5bmMgPSBcIm1hc3RlclwiO1xuLy8gICAgICAgICAgICAgdGhpcy5zaGFyZWRbJ3BlZXInXSA9IGlkO1xuLy8gICAgICAgICAgICAgdGhpcy5wZWVyTWFzdGVyU3luYygpO1xuLy8gICAgICAgICB9KTtcbi8vICAgICB9XG5cbi8vICAgICAvLyBNQVNURVIgU1lOQyBQUk9DRVNTXG5cbi8vICAgICBwZWVyTWFzdGVyU3luYygpIHtcbi8vICAgICAgICAgLy8gRnVuY3Rpb24gdG8gZ2V0IHRoZSBsb2NhbCB0aW1lXG4vLyAgICAgICAgIGxldCBnZXRUaW1lRnVuY3Rpb24gPSAoKSA9PiB7XG4vLyAgICAgICAgICAgICByZXR1cm4gYXVkaW9Db250ZXh0LmN1cnJlbnRUaW1lO1xuLy8gICAgICAgICB9O1xuLy8gICAgICAgICAvLyBJbml0aWFsaXplIHN5bmMgbW9kdWxlXG4vLyAgICAgICAgIHRoaXMuc3luY01hc3RlciA9IG5ldyBTeW5jU2VydmVyKGdldFRpbWVGdW5jdGlvbik7XG4vLyAgICAgICAgIC8vIHNoYXJlZFsnc3luYyddID0gc3luY01hc3RlclxuLy8gICAgICAgICAvL3ZhciBwZWVyID0gdGhpcy5zaGFyZWRbJ3BlZXInXTtcbi8vICAgICAgICAgdGhpcy5wZWVyLm9uKCdjb25uZWN0aW9uJywgdGhpcy5zbGF2ZUNvbm5lY3QuYmluZCh0aGlzKSk7XG4vLyAgICAgICAgIC8vIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbi8vICAgICAgICAgLy8gICAgIHJlc29sdmUoJ3BsYXknKTtcbi8vICAgICAgICAgLy8gfSlcbi8vICAgICAgICAgdGhpcy5wbGF5KDEyKTtcbi8vICAgICB9XG5cbi8vICAgICBzbGF2ZUNvbm5lY3QoY29ubikge1xuLy8gICAgICAgICBjb25zb2xlLmxvZygnQ09OTkVDVElPTiAhJylcbi8vICAgICAgICAgdGhpcy5zaGFyZWRbJ2Nvbm5lY3RlZFBlZXJzJ10gPSB0aGlzLnNoYXJlZFsnY29ubmVjdGVkUGVlcnMnXSB8fCB7fTtcbi8vICAgICAgICAgbGV0IGNvbm5lY3RlZFBlZXJzID0gdGhpcy5zaGFyZWRbJ2Nvbm5lY3RlZFBlZXJzJ107XG4vLyAgICAgICAgIGNvbm5lY3RlZFBlZXJzW2Nvbm4ucGVlcl0gPSBjb25uO1xuXG4vLyAgICAgICAgIGxldCBzZW5kRnVuY3Rpb24gPSBjb25uLnNlbmQuYmluZChjb25uKVxuLy8gICAgICAgICBsZXQgcmVjZWl2ZUZ1bmN0aW9uID0gY29ubi5vbi5iaW5kKGNvbm4pXG5cbi8vICAgICAgICAgbGV0IHN5bmNUaW1lQmVnaW4gPSB0aGlzLnNoYXJlZFsnc3luY1RpbWVCZWdpbiddO1xuLy8gICAgICAgICBzZW5kRnVuY3Rpb24oe1xuLy8gICAgICAgICAgICAgJ21zZyc6ICdzeW5jOnN5bmNUaW1lQmVnaW4nLFxuLy8gICAgICAgICAgICAgYXJnczogW3N5bmNUaW1lQmVnaW5dXG4vLyAgICAgICAgIH0pXG5cbi8vICAgICAgICAgdGhpcy5zeW5jTWFzdGVyLnN0YXJ0KHNlbmRGdW5jdGlvbiwgcmVjZWl2ZUZ1bmN0aW9uKTtcblxuLy8gICAgICAgICBjb25uLm9uKCdkYXRhJywgdGhpcy5wZWVyTWFzdGVyRGF0YUxpc3RlbmVyLmJpbmQodGhpcykoY29ubiwgdGhpcykpXG4vLyAgICAgfVxuXG4vLyAgICAgcGVlck1hc3RlckRhdGFMaXN0ZW5lcihjb25uLCB0aGF0KSB7XG4vLyAgICAgICAgIHJldHVybiBmdW5jdGlvbihkYXRhKSB7XG4vLyAgICAgICAgICAgICBpZiAoZGF0YS5tc2cgPT0gJ3N5bmM6bmV3UGVlcicpIHtcblxuLy8gICAgICAgICAgICAgICAgIHRoYXQuc2hhcmVkWydjb25uZWN0ZWRQZWVycyddW2RhdGEuYXJnc1swXV0gPSBjb25uO1xuLy8gICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwibmV3IHBlZXI6XCIsIHRoYXQuc2hhcmVkWydjb25uZWN0ZWRQZWVycyddKVxuLy8gICAgICAgICAgICAgICAgIC8vIGxldCBzeW5jVGltZUJlZ2luID0gdGhhdC5zaGFyZWRbJ3N5bmNUaW1lQmVnaW4nXTtcbi8vICAgICAgICAgICAgICAgICBsZXQgc3luY1RpbWVCZWdpbiA9IHRoYXQuc3luY1RpbWVCZWdpbjtcbi8vICAgICAgICAgICAgICAgICAvL1xuLy8gICAgICAgICAgICAgICAgIGNvbm4uc2VuZCh7XG4vLyAgICAgICAgICAgICAgICAgICAgICdtc2cnOiAnc3luYzpzeW5jVGltZUJlZ2luJyxcbi8vICAgICAgICAgICAgICAgICAgICAgYXJnczogW3N5bmNUaW1lQmVnaW5dXG4vLyAgICAgICAgICAgICAgICAgfSlcbi8vICAgICAgICAgICAgICAgICAvLyBpZiAodGhhdC5zaGFyZWRbJ3BlZXInXSkge1xuLy8gICAgICAgICAgICAgICAgIC8vICAgICBjb25uLnNlbmQoe1xuLy8gICAgICAgICAgICAgICAgIC8vICAgICAgICAgJ21zZyc6ICdzYW1wbGU6Y2hhbmdlJyxcbi8vICAgICAgICAgICAgICAgICAvLyAgICAgICAgIGFyZ3M6IFt0aGF0LnNoYXJlZFsnY3VycmVudElkJ10sIHRoYXQuc2hhcmVkWydwZWVyJ10uaWRdXG4vLyAgICAgICAgICAgICAgICAgLy8gICAgIH0pXG4vLyAgICAgICAgICAgICAgICAgLy8gfVxuLy8gICAgICAgICAgICAgfVxuLy8gICAgICAgICAgICAgLy8gaWYgKGRhdGEubXNnID09ICdzYW1wbGU6Y2hhbmdlJykge1xuLy8gICAgICAgICAgICAgLy8gICAgIHRoYXQuc2FtcGxlQ2hhbmdlKGRhdGEpO1xuLy8gICAgICAgICAgICAgLy8gfVxuLy8gICAgICAgICB9XG5cbi8vICAgICB9XG5cblxuLy8gICAgIHNhbXBsZUNoYW5nZShkYXRhKSB7XG4vLyAgICAgICAgIGNvbnNvbGUubG9nKCdDSEFOR0UnLCBkYXRhKTtcbi8vICAgICAgICAgbGV0IHNhbXBsZUlkID0gZGF0YS5hcmdzWzBdO1xuLy8gICAgICAgICBsZXQgcElkID0gZGF0YS5hcmdzWzFdO1xuLy8gICAgICAgICBsZXQgYyA9ICdwZWVyLXBsYXllZC0nICsgcElkO1xuLy8gICAgICAgICBsZXQgdGcgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcuc2FtcGxlLScrc2FtcGxlSWQpO1xuLy8gICAgICAgICB0Zy5zdHlsZVtcImJvcmRlci1jb2xvclwiXSA9IFwiZ3JlZW5cIjtcblxuLy8gICAgICAgICAvLyQoJy5zYW1wbGVzJykuZmluZChcImFcIikucmVtb3ZlQ2xhc3MoYyk7XG4vLyAgICAgICAgIC8vJCgnLnNhbXBsZVtkYXRhLWlkPScrc2FtcGxlSWQrJ10nKS5hZGRDbGFzcyhjKTtcbi8vICAgICB9XG5cbi8vICAgICBqb2luKHBlZXJJRCkge1xuLy8gICAgICAgICBsZXQgcGVlciA9IG5ldyBQZWVyKHtcbi8vICAgICAgICAgICAgIGtleTogJ3ViZ2plM3NtNXAwZXZjeHInLFxuLy8gICAgICAgICAgICAgZGVidWc6IDMsXG4vLyAgICAgICAgICAgICBsb2dGdW5jdGlvbjogZnVuY3Rpb24oKSB7XG4vLyAgICAgICAgICAgICAgICAgdmFyIGNvcHkgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpLmpvaW4oJyAnKTtcbi8vICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhjb3B5KTtcbi8vICAgICAgICAgICAgIH1cbi8vICAgICAgICAgfSk7XG4vLyAgICAgICAgIHZhciBjb25uID0gcGVlci5jb25uZWN0KHBlZXJJRCk7XG4vLyAgICAgICAgIHRoaXMuc2hhcmVkWydjb25uJ10gPSBjb25uO1xuLy8gICAgICAgICBwZWVyLm9uKCdlcnJvcicsIGZ1bmN0aW9uKGVycikge1xuLy8gICAgICAgICAgICAgY29uc29sZS5sb2coZXJyKTtcbi8vICAgICAgICAgfSlcbi8vICAgICAgICAgY29ubi5vbignb3BlbicsICgpID0+IHtcbi8vICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiam9pblwiKVxuLy8gICAgICAgICAgICAgLy8gdGhpcy4kcGxheS5zdHlsZS5kaXNwbGF5ID0gXCJibG9ja1wiO1xuLy8gICAgICAgICAgICAgLy8gdGhpcy4kY29ubmVjdC5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XG4vLyAgICAgICAgICAgICB0aGlzLnN5bmMgPSBcInNsYXZlXCI7XG4vLyAgICAgICAgICAgICB0aGlzLnBlZXJTbGF2ZVN5bmMoKVxuLy8gICAgICAgICB9KTtcbi8vICAgICB9XG5cbi8vICAgICAvLyBTTEFWRSBTWU5DIFBST0NFU1NcblxuXG4vLyAgICAgcGVlclNsYXZlU3luYygpIHtcbi8vICAgICAgICAgbGV0IGNvbm4gPSB0aGlzLnNoYXJlZFsnY29ubiddO1xuLy8gICAgICAgICB0aGlzLnNoYXJlZFsnY29ubmVjdGVkUGVlcnMnXSA9IHRoaXMuc2hhcmVkWydjb25uZWN0ZWRQZWVycyddIHx8IHt9O1xuLy8gICAgICAgICBsZXQgY29ubmVjdGVkUGVlcnMgPSB0aGlzLnNoYXJlZFsnY29ubmVjdGVkUGVlcnMnXTtcbi8vICAgICAgICAgY29ubmVjdGVkUGVlcnNbY29ubi5wZWVyXSA9IDE7XG5cbi8vICAgICAgICAgY29ubi5zZW5kKHtcbi8vICAgICAgICAgICAgICdtc2cnOiAnc3luYzpuZXdQZWVyJyxcbi8vICAgICAgICAgICAgICdhcmdzJzogW2Nvbm4ucGVlcl1cbi8vICAgICAgICAgfSk7XG4vLyAgICAgICAgIC8vXG4vLyAgICAgICAgIGxldCBnZXRUaW1lRnVuY3Rpb24gPSAoKSA9PiB7XG4vLyAgICAgICAgICAgICByZXR1cm4gYXVkaW9Db250ZXh0LmN1cnJlbnRUaW1lO1xuLy8gICAgICAgICB9O1xuLy8gICAgICAgICAvLyBGdW5jdGlvbiB0byBzZW5kIGEgbWVzc2FnZSB0byB0aGUgbWFzdGVyIHBlZXJcbi8vICAgICAgICAgdmFyIHNlbmRGdW5jdGlvbiA9IGNvbm4uc2VuZC5iaW5kKGNvbm4pO1xuLy8gICAgICAgICAvLyBGdW5jdGlvbiB0byByZWNlaXZlIGEgbWVzc2FnZSBmcm9tIHRoZSBtYXN0ZXIgcGVlclxuLy8gICAgICAgICB2YXIgcmVjZWl2ZUZ1bmN0aW9uID0gY29ubi5vbi5iaW5kKGNvbm4pO1xuXG4vLyAgICAgICAgIHZhciByZXBvcnRGdW5jdGlvbiA9IHRoaXMuc3luY1NsYXZlLmJpbmQodGhpcyk7IC8vIGNvbnNvbGUubG9nOyAvLyBGQUtFXG5cbi8vICAgICAgICAgdGhpcy5zeW5jU2xhdmUgPSBuZXcgU3luY0NsaWVudChnZXRUaW1lRnVuY3Rpb24pO1xuLy8gICAgICAgICB0aGlzLnN5bmNTbGF2ZS5zdGFydChzZW5kRnVuY3Rpb24sIHJlY2VpdmVGdW5jdGlvbiwgcmVwb3J0RnVuY3Rpb24pO1xuLy8gICAgICAgICB0aGlzLnNoYXJlZFsnc3luYyddID0gdGhpcy5zeW5jU2xhdmU7XG5cbi8vICAgICAgICAgY29ubi5vbignZGF0YScsIHRoaXMucGVlclNsYXZlRGF0YUxpc3RlbmVyLmJpbmQodGhpcykpXG5cbi8vICAgICAgICAgY29ubi5vbignY2xvc2UnLCAoKSA9PiB7XG4vLyAgICAgICAgICAgICAkcGVlci52YWx1ZSA9IFwiXCI7XG4vLyAgICAgICAgICAgICBkb2N1bWVudC5sb2NhdGlvbi5yZWxvYWQoKTtcbi8vICAgICAgICAgfSlcblxuLy8gICAgIH1cblxuLy8gICAgIHN5bmNTbGF2ZShvYmopIHtcbi8vICAgICAgICAgLy9cbi8vICAgICAgICAgdGhpcy4kcGxheS5zdHlsZS5kaXNwbGF5ID0gXCJibG9ja1wiO1xuLy8gICAgICAgICB0aGlzLiRjb25uZWN0LnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIjtcbi8vICAgICAgICAgdGhpcy5zeW5jVGltZSA9IG9iai50aW1lT2Zmc2V0O1xuLy8gICAgIH1cblxuLy8gICAgIHBlZXJTbGF2ZURhdGFMaXN0ZW5lcihkYXRhKSB7XG4vLyAgICAgICAgIGlmIChkYXRhLm1zZyA9PSAnc3luYzpzeW5jVGltZUJlZ2luJykge1xuLy8gICAgICAgICAgICAgLy8gY29uc29sZS5sb2coXCJzeW5jOnN5bmNUaW1lQmVnaW5cIiwgZGF0YS5hcmdzWzBdKTtcbi8vICAgICAgICAgICAgIHZhciBzeW5jVGltZUJlZ2luRnJvbU1hc3RlciA9IGRhdGEuYXJnc1swXTtcbi8vICAgICAgICAgICAgIHRoaXMuc2hhcmVkWydzeW5jVGltZUJlZ2luRnJvbU1hc3RlciddID0gc3luY1RpbWVCZWdpbkZyb21NYXN0ZXI7XG4vLyAgICAgICAgIH1cbi8vICAgICAgICAgaWYgKGRhdGEubXNnID09ICdzYW1wbGU6Y2hhbmdlJykge1xuLy8gICAgICAgICAgICAgdGhpcy5zYW1wbGVDaGFuZ2UoZGF0YSk7XG4vLyAgICAgICAgIH1cbi8vICAgICB9XG5cbi8vICAgICBidWlsZFBhZHMoKSB7XG4vLyAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5zYW1wbGVzLmxlbmd0aDsgaSsrKSB7XG4vLyAgICAgICAgICAgICBsZXQgJHBhZCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2J1dHRvbicpO1xuLy8gICAgICAgICAgICAgbGV0IHNhbXBsZU5hbWUgPSBzYW1wbGVVUkxTW2ldLnNwbGl0KCcuJylbMV0uc3BsaXQoXCIvXCIpWzJdXG4vLyAgICAgICAgICAgICAkcGFkLmNsYXNzTGlzdC5hZGQoc2FtcGxlTmFtZSlcbi8vICAgICAgICAgICAgICRwYWQuY2xhc3NMaXN0LmFkZChcInNhbXBsZS1cIitpKTtcbi8vICAgICAgICAgICAgICRwYWQuY2xhc3NMaXN0LmFkZChcInNhbXBsZVwiKTtcbi8vICAgICAgICAgICAgICRwYWQudGV4dENvbnRlbnQgPSBzYW1wbGVOYW1lO1xuLy8gICAgICAgICAgICAgJHBhZC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbi8vICAgICAgICAgICAgICAgICB0aGlzLnBsYXkoaSk7XG4vLyAgICAgICAgICAgICB9LCBmYWxzZSk7XG4vLyAgICAgICAgICAgICB0aGlzLiRwbGF5Lmluc2VydEJlZm9yZSgkcGFkLCB0aGlzLiRyZXNldClcbi8vICAgICAgICAgfVxuLy8gICAgIH1cbi8vICAgICBwbGF5KHBhZElEKSB7XG4vLyAgICAgICAgIGlmICh0aGlzLmN1cnJlbnRTb3VyY2UpIHtcbi8vICAgICAgICAgICAgIHRoaXMuY3VycmVudFNvdXJjZS5zdG9wKClcbi8vICAgICAgICAgfVxuLy8gICAgICAgICBsZXQgc291cmNlID0gYXVkaW9Db250ZXh0LmNyZWF0ZUJ1ZmZlclNvdXJjZSgpXG4vLyAgICAgICAgIHRoaXMuY3VycmVudFNvdXJjZSA9IHNvdXJjZTtcbi8vICAgICAgICAgbGV0IGF1ZGlvQnVmZmVyID0gdGhpcy5zYW1wbGVzW3BhZElEXTtcbi8vICAgICAgICAgc291cmNlLmxvb3AgPSB0cnVlO1xuLy8gICAgICAgICBzb3VyY2UuY29ubmVjdChhdWRpb0NvbnRleHQuZGVzdGluYXRpb24pO1xuLy8gICAgICAgICBzb3VyY2UuYnVmZmVyID0gYXVkaW9CdWZmZXI7XG4vLyAgICAgICAgIGxldCBzZWVrID0gMDtcbi8vICAgICAgICAgaWYgKHRoaXMuc3luY01hc3Rlcikge1xuLy8gICAgICAgICAgICAgaWYgKCF0aGlzLnN5bmNUaW1lQmVnaW4pIHtcbi8vICAgICAgICAgICAgICAgICB0aGlzLnN5bmNUaW1lQmVnaW4gPSBhdWRpb0NvbnRleHQuY3VycmVudFRpbWU7XG4vLyAgICAgICAgICAgICB9XG4vLyAgICAgICAgICAgICBsZXQgc3luY1RpbWUgPSBhdWRpb0NvbnRleHQuY3VycmVudFRpbWU7XG4vLyAgICAgICAgICAgICBsZXQgbmJMb29wID0gcGFyc2VJbnQoKHN5bmNUaW1lIC0gdGhpcy5zeW5jVGltZUJlZ2luKSAvIGF1ZGlvQnVmZmVyLmR1cmF0aW9uKTtcbi8vICAgICAgICAgICAgIGxldCBsYXN0QmVnaW5UaW1lID0gdGhpcy5zeW5jVGltZUJlZ2luICsgbmJMb29wICogYXVkaW9CdWZmZXIuZHVyYXRpb247XG4vLyAgICAgICAgICAgICBzZWVrID0gc3luY1RpbWUgLSBsYXN0QmVnaW5UaW1lO1xuLy8gICAgICAgICAgICAgLy9cbi8vICAgICAgICAgICAgIC8vIGxldCBjUCA9IE9iamVjdC5rZXlzKHRoaXMuc2hhcmVkLmNvbm5lY3RlZFBlZXJzKTtcbi8vICAgICAgICAgICAgIC8vIGZvciAodmFyIGkgPSAwOyBpIDwgY1AubGVuZ3RoOyBpKyspIHtcbi8vICAgICAgICAgICAgIC8vICAgICBjUC5zZW5kKFtwYWRJRCwgdGhpcy5zaGFyZWRbJ3BlZXInXV0pXG5cbi8vICAgICAgICAgICAgIC8vIH1cblxuXG4vLyAgICAgICAgIH0gZWxzZSB7XG4vLyAgICAgICAgICAgICAgICAgLy9sZXQgc3luY1NsYXZlID0gdGhpcy5zaGFyZWRbJ3N5bmMnXTtcbi8vICAgICAgICAgICAgICAgICBsZXQgc3luY1RpbWVCZWdpbkZyb21NYXN0ZXIgPSB0aGlzLnNoYXJlZFsnc3luY1RpbWVCZWdpbkZyb21NYXN0ZXInXTtcbi8vICAgICAgICAgICAgICAgICBsZXQgc3luY1RpbWUgPSB0aGlzLnN5bmNTbGF2ZS5nZXRTeW5jVGltZSgpO1xuLy8gICAgICAgICAgICAgICAgIGxldCBuYkxvb3AgPSBwYXJzZUludCgoc3luY1RpbWUgLSBzeW5jVGltZUJlZ2luRnJvbU1hc3RlcikvYXVkaW9CdWZmZXIuZHVyYXRpb24pO1xuLy8gICAgICAgICAgICAgICAgIGxldCBsYXN0QmVnaW5UaW1lID0gc3luY1RpbWVCZWdpbkZyb21NYXN0ZXIgKyBuYkxvb3AgKiBhdWRpb0J1ZmZlci5kdXJhdGlvbjtcbi8vICAgICAgICAgICAgICAgICBzZWVrID0gc3luY1RpbWUtbGFzdEJlZ2luVGltZTtcblxuLy8gICAgICAgICAgICAgICAgIC8vIGxldCBjb25uID0gdGhpcy5zaGFyZWRbJ2Nvbm4nXTtcbi8vICAgICAgICAgICAgICAgICAvLyBjb25zb2xlLmxvZyhbcGFkSUQsIGNvbm4uaWRdKVxuLy8gICAgICAgICAgICAgICAgIC8vIGNvbm4uc2VuZCh7XG4vLyAgICAgICAgICAgICAgICAgLy8gICAgICdtc2cnOiAnc2FtcGxlOmNoYW5nZScsXG4vLyAgICAgICAgICAgICAgICAgLy8gICAgICdhcmdzJzogW3BhZElELCBjb25uLmlkXVxuLy8gICAgICAgICAgICAgICAgIC8vIH0pO1xuXG4vLyAgICAgICAgIH1cbi8vICAgICAgICAgc291cmNlLnN0YXJ0KDAsIHNlZWspO1xuLy8gICAgICAgICAvLyBwcmV0dHkgZGlzcGxheVxuLy8gICAgICAgICBsZXQgJGFsbFNhbXBsZXMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCcuc2FtcGxlJyk7XG4vLyAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgJGFsbFNhbXBsZXMubGVuZ3RoOyArK2kpIHtcbi8vICAgICAgICAgICAkYWxsU2FtcGxlc1tpXS5zdHlsZVtcImJhY2tncm91bmQtY29sb3JcIl0gPSBcIndoaXRlXCI7XG4vLyAgICAgICAgIH1cbi8vICAgICAgICAgbGV0ICR0YXJnZXQgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcuc2FtcGxlLScrcGFkSUQpO1xuLy8gICAgICAgICAkdGFyZ2V0LnN0eWxlW1wiYmFja2dyb3VuZC1jb2xvclwiXSA9IFwicmVkXCI7XG5cbi8vICAgICB9XG4vLyB9XG5cbi8vIGxldCBhcHAgPSBuZXcgQXBwKCk7XG4iXX0=