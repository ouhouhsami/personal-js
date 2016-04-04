let StateMachine = require('fsm-as-promised');
import { loadSamples } from './loadSamples';
import { SyncServer } from './SyncServer.js';
import { SyncClient } from './SyncClient.js';
const wavesAudio = require('waves-audio');
const audioContext = wavesAudio.audioContext;

// overall output
let gainNode = audioContext.createGain();
gainNode.connect(audioContext.destination);

Object.values = obj => Object.keys(obj).map(key => obj[key]);

// Screens
const $connectScreen = document.querySelector('#connect');
const $playScreen = document.querySelector('#play');
const $latency = document.querySelector('#latency');
$connectScreen.style.display = "none";
$playScreen.style.display = "none";



// Peer Form fields
const $peer = document.querySelector('#peer');
const $createPeerBtn = document.querySelector('#create');
const $joinPeerBtn = document.querySelector('#join');
const $resetBtn = document.querySelector('#reset');
const $muteBtn = document.querySelector('#mute');

let samplePlayer;
let peerContext;

// Sample URLs
const sampleURLS = ['./media/bass-1.mp3', './media/bass-2.mp3', './media/bass-3.mp3', './media/drums1-1.mp3', './media/drums1-2.mp3', './media/drums1-3.mp3', './media/drums2-1.mp3', './media/drums2-2.mp3', './media/drums3-1.mp3', './media/drums3-2.mp3', './media/drums3-3.mp3', './media/fx-1.mp3', './media/guitar-1.mp3', './media/guitar-2.mp3', './media/synths-1.mp3', './media/synths-10.mp3', './media/synths-11.mp3', './media/synths-2.mp3', './media/synths-3.mp3', './media/synths-4.mp3', './media/synths-5.mp3', './media/synths-6.mp3', './media/synths-7.mp3', './media/synths-8.mp3', './media/synths-9.mp3', './media/voice-1.mp3', './media/voice-2.mp3', './media/voice-3.mp3', './media/voice-4.mp3', './media/voice-5.mp3'];

// StateMachine
let fsm = StateMachine({
    initial: 'init',
    events: [
        { name: 'Init', from: 'init', to: 'initialized' },
        { name: 'CreatePeer', from: 'initialized', to: 'peerCreated' },
        { name: 'JoinPeer', from: 'initialized', to: 'peerJoined' },
        { name: 'Play', from: ['peerJoined', 'peerCreated'], to: 'play'},
        { name: 'Reset', from: 'play', to: 'init' },
    ],
    callbacks: {
        onInit: function(options){
            return new Promise(function (resolve, reject) {
                // load samples
                loadSamples(sampleURLS).then(function(samples){
                // build pads
                samplePlayer = new SamplePlayer(samples);
                // show UI for create or join peer
                $connectScreen.style.display = "block";
                // resolve
                resolve(options)
              })
            });
        },
        onCreatePeer: function(options) {
            // hide UI for create or join peer
            $connectScreen.style.display = "none";
            let peerID = options.args[0];
            peerContext = new PeerMasterContext(peerID);
            return options;
        },
        onJoinPeer: function(options) {
            // hide UI for create or join peer
            $connectScreen.style.display = "none";
            let peerID = options.args[0];
            peerContext = new PeerSlaveContext(peerID);
            return options;
        },
        onPlay: function(options){
            samplePlayer.peerContext = peerContext;
            $playScreen.style.display = "block";
            //samplePlayer.play(0);
            return options;
        }
    }
});

fsm.Init()

$createPeerBtn.addEventListener('click', ()=>{
    fsm.CreatePeer($peer.value);
})
$joinPeerBtn.addEventListener('click', ()=>{
    fsm.JoinPeer($peer.value);
})
$resetBtn.addEventListener('click', ()=>{
    document.location.reload();
})

$muteBtn.addEventListener('click', ()=>{
    console.log($muteBtn.checked)
    if($muteBtn.checked){
        gainNode.gain.value = 0;
    }
    else{
        gainNode.gain.value = 1;
    }
})

class SamplePlayer {
    constructor(samples){
        this.samples = samples;
        this.currentSource = undefined;
        this.buildPads();
    }
    buildPads(){
        for (let i = 0; i < this.samples.length; i++) {
            let $pad = document.createElement('button');
            let sampleName = sampleURLS[i].split('.')[1].split("/")[2]
            $pad.classList.add(sampleName)
            $pad.classList.add("sample-" + i);
            $pad.classList.add("sample");
            $pad.textContent = sampleName;
            $pad.addEventListener('click', () => {
                this.play(i);
            }, false);
            $playScreen.insertBefore($pad, $muteBtn)
        }
    }
    play(padID){
        if(this.currentSource){
            this.currentSource.stop();
        }
        let source = audioContext.createBufferSource();
        this.currentSource = source;
        this.currentAudioBuffer = this.samples[padID];
        source.loop = true;
        // source.connect(audioContext.destination);
        source.connect(gainNode);
        source.buffer = this.currentAudioBuffer;
        source.start(0, this.offset);
        // pretty display
        let $allSamples = document.querySelectorAll('.sample');
        for (var i = 0; i < $allSamples.length; ++i) {
          $allSamples[i].style["background-color"] = "white";
        }
        let $target = document.querySelector('.sample-'+padID);
        $target.style["background-color"] = "red";
        // TODO Send message to connected peers
        this.peerContext.sendMessage('sample-'+padID);
    }
    get offset(){
        let offset = 0;
        let latency = parseInt($latency.value)/1000;
        if(this.peerContext.type == 'master'){
            if (!this.syncTimeBegin) {
                this.syncTimeBegin = audioContext.currentTime;
                // set this on the master peer
                this.peerContext.shared['syncTimeBegin'] = this.syncTimeBegin;
            }
            let syncTime = audioContext.currentTime;
            let nbLoop = parseInt((syncTime - this.syncTimeBegin) / this.currentAudioBuffer.duration);
            let lastBeginTime = this.syncTimeBegin + nbLoop * this.currentAudioBuffer.duration;
            offset = syncTime - lastBeginTime;
        }else {
            //let syncTimeBeginFromMaster = this.shared['syncTimeBeginFromMaster'];
            let syncTimeBeginFromMaster = this.peerContext.shared['syncTimeBeginFromMaster'];
            //let syncTime = this.syncSlave.getSyncTime();
            let syncTime = this.peerContext.syncSlave.getSyncTime();
            let nbLoop = parseInt((syncTime - syncTimeBeginFromMaster)/ this.currentAudioBuffer.duration);
            let lastBeginTime = syncTimeBeginFromMaster + nbLoop *  this.currentAudioBuffer.duration;
            offset = syncTime-lastBeginTime;
        }
        offset = offset+latency
        while(offset < 0){
            offset = offset+this.currentAudioBuffer.duration
        }
        return offset;
    }
    set peerContext(pC){
        this._peerContext = pC
    }
    get peerContext(){
        return this._peerContext;
    }
    played(id, peerID){
        // to show peer played samples
        // get all elements with "played-"+peedID class
        let $previousPad = document.getElementsByClassName("played-"+peerID);
        if($previousPad.length > 0){
            // remove class played and "played-"+peerID
            $previousPad[0].classList.remove("played");
            $previousPad[0].classList.remove("played-"+peerID);
        }
        let $pad = document.getElementsByClassName(id)[0];
        $pad.classList.add("played");
        $pad.classList.add("played-"+peerID);
    }
}

class PeerMasterContext {
    constructor(peerID){
        this.shared = {}
        this.shared['connectedPeers'] = {}
        this.peerID = peerID;
        this.peer = new Peer(peerID, {
            key: 'ubgje3sm5p0evcxr',
            debug: 3,
            logFunction: function() {
                var copy = Array.prototype.slice.call(arguments).join(' ');
                console.log(copy);
            }
        });
        this.peer.on('open', (id) => {
            // we can play!
            fsm.Play();
            this.peerMasterSync();
        });
        this.type = 'master';
    }
    peerMasterSync() {
        // Function to get the local time
        let getTimeFunction = () => {
            return audioContext.currentTime;
        };
        // Initialize sync module
        this.syncMaster = new SyncServer(getTimeFunction);
        this.peer.on('connection', this.slaveConnect.bind(this));
    }
    slaveConnect(conn) {
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

    }
    peerMasterDataListener(conn, that) {
        return function(data) {
            if (data.msg == 'sync:newPeer') {

                that.shared['connectedPeers'][data.args[0]] = conn;
                let syncTimeBegin = that.shared['syncTimeBegin'];
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
            if (data.msg == 'sample:change') {
                samplePlayer.played(data.args[0], data.args[1])
                // send update to other peer
                Object.keys(that.shared['connectedPeers']).forEach(function(key, index) {
                    if(key !== data.args[1] && key !== that.peerID){
                        that.shared['connectedPeers'][key].send({
                            'msg': 'sample:change',
                            args: [data.args[0], data.args[1]]
                        })
                    }
                });
            }
        }

    }

    sendMessage(msg){
        for(let conn of Object.values(this.shared['connectedPeers'])){
            conn.send({
                'msg': 'sample:change',
                args: [msg, this.peerID]
            });
        }
    }
}


class PeerSlaveContext {
    constructor(peerID) {
        this.shared = {}
        this.shared['connectedPeers'] = {}
        let peer = new Peer({
            key: 'ubgje3sm5p0evcxr',
            debug: 3,
            logFunction: function() {
                var copy = Array.prototype.slice.call(arguments).join(' ');
                console.log(copy);
            }
        });
        let conn = peer.connect(peerID);
        this.shared['conn'] = conn;
        peer.on('error', function(err) {
            console.log(err);
        })
        peer.on('open', (id) => {
            this.peerID = id;
        })
        conn.on('open', (id) => {
            this.sync = "slave";
            this.peerSlaveSync(conn);
        });

        this.type = "slave";
    }

    peerSlaveSync(remoteConn) {
        let conn = this.shared['conn'];
        let connectedPeers = this.shared['connectedPeers'];
        connectedPeers[conn.peer] = remoteConn;

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

        var reportFunction = this.syncSlave.bind(this); // console.log; // FAKE

        this.syncSlave = new SyncClient(getTimeFunction);
        this.syncSlave.start(sendFunction, receiveFunction, reportFunction);
        this.shared['sync'] = this.syncSlave;

        conn.on('data', this.peerSlaveDataListener.bind(this))

        conn.on('close', () => {
            $peer.value = "";
            document.location.reload();
        })

    }

    syncSlave(obj) {
        fsm.Play();
        this.syncTime = obj.timeOffset;
    }

    peerSlaveDataListener(data) {
        if (data.msg == 'sync:syncTimeBegin') {
            var syncTimeBeginFromMaster = data.args[0];
            this.shared['syncTimeBeginFromMaster'] = syncTimeBeginFromMaster;
        }
        if (data.msg == 'sample:change') {
            samplePlayer.played(data.args[0], data.args[1])
        }
    }

    sendMessage(msg){
        for(let conn of Object.values(this.shared['connectedPeers'])){
            conn.send({
                'msg': 'sample:change',
                args: [msg, this.peerID]
            });
        }
    }
}
