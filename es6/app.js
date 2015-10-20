import {
    loadSamples
}
from './loadSamples';

import {
    SyncServer
}
from './SyncServer.js';
import {
    SyncClient
}
from './SyncClient.js';

const wavesAudio = require('waves-audio');
const audioContext = wavesAudio.audioContext;

const $peer = document.querySelector('#peer');
const $create = document.querySelector('#create');
const $join = document.querySelector('#join');

const sampleURLS = ['./media/bass-1.mp3', './media/bass-2.mp3', './media/bass-3.mp3', './media/drums1-1.mp3', './media/drums1-2.mp3', './media/drums1-3.mp3', './media/drums2-1.mp3', './media/drums2-2.mp3', './media/drums3-1.mp3', './media/drums3-2.mp3', './media/drums3-3.mp3', './media/fx-1.mp3', './media/guitar-1.mp3', './media/guitar-2.mp3', './media/synths-1.mp3', './media/synths-10.mp3', './media/synths-11.mp3', './media/synths-2.mp3', './media/synths-3.mp3', './media/synths-4.mp3', './media/synths-5.mp3', './media/synths-6.mp3', './media/synths-7.mp3', './media/synths-8.mp3', './media/synths-9.mp3', './media/voice-1.mp3', './media/voice-2.mp3', './media/voice-3.mp3', './media/voice-4.mp3', './media/voice-5.mp3'];

class App {
    constructor() {
        this.load();
        this.$play = document.querySelector('#play');
        this.$play.style.display = "none";
        this.$reset = document.querySelector('#reset')
        this.$reset.addEventListener('click', () => {
            this.$play.style.display = "none";
            this.$connect.style.display = "block";
            //console.log(this.shared.connectedPeers);
            var cP = Object.keys(this.shared.connectedPeers);
            for (var i = 0; i < cP.length; i++) {
                var val = this.shared.connectedPeers[cP[i]];
                console.log(val)
                val.dataChannel.close();
                // use val
            }
            $peer.value = "";
            document.location.reload();
        })
        this.$connect = document.querySelector('#connect');
        this.samples = [];
        $create.addEventListener('click', () => {
            this.create($peer.value)
        }, false)
        $join.addEventListener('click', () => {
            this.join($peer.value)
        }, false)
        this.currentSource = undefined;
        this.sync = undefined
        this.shared = {
            'peer': undefined,
            'connectedPeers': {}
        }
    }
    load() {
        console.log('Load samples');
        loadSamples(sampleURLS).then((samples) => {
            // build play interface
            this.samples = samples;
            this.buildPads()
        });
    }
    create(peerID) {
        this.peer = new Peer(peerID, {
            key: 'ubgje3sm5p0evcxr',
            debug: 3,
            logFunction: function() {
                var copy = Array.prototype.slice.call(arguments).join(' ');
                console.log(copy);
            }
        });
        this.peer.on('open', (id) => {
            console.log("created")
            this.$play.style.display = "block";
            this.$connect.style.display = "none";
            this.sync = "master";
            this.shared['peer'] = id;
            this.peerMasterSync();
        });
    }

    // MASTER SYNC PROCESS

    peerMasterSync() {
        // Function to get the local time
        let getTimeFunction = () => {
            return audioContext.currentTime;
        };
        // Initialize sync module
        this.syncMaster = new SyncServer(getTimeFunction);
        // shared['sync'] = syncMaster
        //var peer = this.shared['peer'];
        this.peer.on('connection', this.slaveConnect.bind(this));
        // return new Promise(function(resolve, reject) {
        //     resolve('play');
        // })
        this.play(12);
    }

    slaveConnect(conn) {
        console.log('CONNECTION !')
        this.shared['connectedPeers'] = this.shared['connectedPeers'] || {};
        let connectedPeers = this.shared['connectedPeers'];
        connectedPeers[conn.peer] = conn;

        let sendFunction = conn.send.bind(conn)
        let receiveFunction = conn.on.bind(conn)

        let syncTimeBegin = this.shared['syncTimeBegin'];
        sendFunction({
            'msg': 'sync:syncTimeBegin',
            args: [syncTimeBegin]
        })

        this.syncMaster.start(sendFunction, receiveFunction);

        conn.on('data', this.peerMasterDataListener.bind(this)(conn, this))

        // conn.on('close', ()=> {
        //     console.log('CLOSE')
        //     $peer.value = "";
        //     document.location.reload();
        // })
    }

    peerMasterDataListener(conn, that) {
        return function(data) {
            if (data.msg == 'sync:newPeer') {

                that.shared['connectedPeers'][data.args[0]] = conn;
                console.log("new peer:", that.shared['connectedPeers'])
                // let syncTimeBegin = that.shared['syncTimeBegin'];
                let syncTimeBegin = that.syncTimeBegin;
                //
                conn.send({
                    'msg': 'sync:syncTimeBegin',
                    args: [syncTimeBegin]
                })
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
        }

    }


    sampleChange(data) {
        console.log('CHANGE', data);
        let sampleId = data.args[0];
        let pId = data.args[1];
        let c = 'peer-played-' + pId;
        let tg = document.querySelector('.sample-'+sampleId);
        tg.style["border-color"] = "green";

        //$('.samples').find("a").removeClass(c);
        //$('.sample[data-id='+sampleId+']').addClass(c);
    }

    join(peerID) {
        let peer = new Peer({
            key: 'ubgje3sm5p0evcxr',
            debug: 3,
            logFunction: function() {
                var copy = Array.prototype.slice.call(arguments).join(' ');
                console.log(copy);
            }
        });
        var conn = peer.connect(peerID);
        this.shared['conn'] = conn;
        peer.on('error', function(err) {
            console.log(err);
        })
        conn.on('open', () => {
            console.log("join")
            this.$play.style.display = "block";
            this.$connect.style.display = "none";
            this.sync = "slave";
            this.peerSlaveSync()
        });
    }

    // SLAVE SYNC PROCESS


    peerSlaveSync() {
        let conn = this.shared['conn'];
        this.shared['connectedPeers'] = this.shared['connectedPeers'] || {};
        let connectedPeers = this.shared['connectedPeers'];
        connectedPeers[conn.peer] = 1;

        conn.send({
            'msg': 'sync:newPeer',
            'args': [conn.peer]
        });
        //
        let getTimeFunction = () => {
            return audioContext.currentTime;
        };
        // Function to send a message to the master peer
        var sendFunction = conn.send.bind(conn);
        // Function to receive a message from the master peer
        var receiveFunction = conn.on.bind(conn);

        console.log("!!!! this.syncSlave", this.syncSlave)
        var reportFunction = this.syncSlave.bind(this); // console.log; // FAKE

        this.syncSlave = new SyncClient(getTimeFunction);
        this.syncSlave.start(sendFunction, receiveFunction, reportFunction);
        this.shared['sync'] = this.syncSlave;

        conn.on('data', this.peerSlaveDataListener.bind(this))

        conn.on('close', ()=> {
            $peer.value = "";
            document.location.reload();
        })

    }

    syncSlave(obj) {
        //console.log('HERE Im Syncrhonized', obj.timeOffset);
        this.syncTime = obj.timeOffset;
    }

    peerSlaveDataListener(data) {
        if (data.msg == 'sync:syncTimeBegin') {
            // console.log("sync:syncTimeBegin", data.args[0]);
            var syncTimeBeginFromMaster = data.args[0];
            this.shared['syncTimeBeginFromMaster'] = syncTimeBeginFromMaster;
        }
        if (data.msg == 'sample:change') {
            this.sampleChange(data);
        }
    }

    buildPads() {
        for (let i = 0; i < this.samples.length; i++) {
            let $pad = document.createElement('button');
            let sampleName = sampleURLS[i].split('.')[1].split("/")[2]
            $pad.classList.add(sampleName)
            $pad.classList.add("sample-"+i);
            $pad.classList.add("sample");
            $pad.textContent = sampleName;
            $pad.addEventListener('click', () => {
                this.play(i);
            }, false);
            this.$play.insertBefore($pad, this.$reset)
        }
    }
    play(padID) {
        if (this.currentSource) {
            this.currentSource.stop()
        }
        let source = audioContext.createBufferSource()
        this.currentSource = source;
        let audioBuffer = this.samples[padID];
        source.loop = true;
        source.connect(audioContext.destination);
        source.buffer = audioBuffer;
        let seek = 0;
        if (this.syncMaster) {
            if (!this.syncTimeBegin) {
                this.syncTimeBegin = audioContext.currentTime;
            }
            let syncTime = audioContext.currentTime;
            let nbLoop = parseInt((syncTime - this.syncTimeBegin) / audioBuffer.duration);
            let lastBeginTime = this.syncTimeBegin + nbLoop * audioBuffer.duration;
            seek = syncTime - lastBeginTime;
            //
            // let cP = Object.keys(this.shared.connectedPeers);
            // for (var i = 0; i < cP.length; i++) {
            //     cP.send([padID, this.shared['peer']])

            // }


        } else {
                //let syncSlave = this.shared['sync'];
                let syncTimeBeginFromMaster = this.shared['syncTimeBeginFromMaster'];
                let syncTime = this.syncSlave.getSyncTime();
                let nbLoop = parseInt((syncTime - syncTimeBeginFromMaster)/audioBuffer.duration);
                let lastBeginTime = syncTimeBeginFromMaster + nbLoop * audioBuffer.duration;
                seek = syncTime-lastBeginTime;

                // let conn = this.shared['conn'];
                // console.log([padID, conn.id])
                // conn.send({
                //     'msg': 'sample:change',
                //     'args': [padID, conn.id]
                // });

        }
        source.start(0, seek);
        // pretty display
        let $allSamples = document.querySelectorAll('.sample');
        for (var i = 0; i < $allSamples.length; ++i) {
          $allSamples[i].style["background-color"] = "white";
        }
        let $target = document.querySelector('.sample-'+padID);
        $target.style["background-color"] = "red";

    }
}

let app = new App();
