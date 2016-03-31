let wavesAudio = require('waves-audio');
let audioContext = wavesAudio.audioContext;

export function loadSample(url){
    return new Promise(function(resolve, reject){
        fetch(url)
        .then((response) => {
            return response.arrayBuffer()
        })
        .then((buffer) =>{
            audioContext.decodeAudioData(buffer, (decodedAudioData) => {
                resolve(decodedAudioData);
            })
        });
    })
};
