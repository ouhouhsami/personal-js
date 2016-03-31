import {loadSample} from './loadSample';

export function loadSamples(urls){
    return Promise.all(urls.map(function(soundURL){return loadSample(soundURL)
    }));
}
