import * as tf from '@tensorflow/tfjs';
import MnistData from "./data";
import { Buffer } from "buffer";

const token = 'token';

const custFetch = async (url) => {
    const res = await fetch(url, {
        headers: {'Authorization': `Bearer ${token}`}
    });
    return res;
}

const onDownload = async (message) => {
    console.log("Received model from Edge Server!");
    const TFRequest = {fetchFunc: custFetch};
    const model = await tf.loadLayersModel(message.model, TFRequest);
    const trainEpochs = message.iterations;

    const data = new MnistData();
    await data.load();
    const {trImages, trLabels} = data.getTrainData(message.data.start, message.data.size);

    console.log("Begin client training!");
    model.compile({
        optimizer: 'adam',
        loss: 'categoricalCrossentropy',
        metrics: ['accuracy'],
    });
    console.log("FIT!");
    //trLabels.print();
    //trImages.print(true);
    await model.fit(trImages, trLabels, {
        epochs: trainEpochs,
        callbacks: {
            onEpochEnd: async (epoch, logs) => {
                console.log(`  Epoch ${epoch+1}/${trainEpochs}`);
            }
        }
    });
    console.log("End client training!");
    let weights = [];
    let shape = [];
    for (let i = 0; i < model.getWeights().length; i++) {
        weights.push(await model.getWeights()[i].data());
        shape.push(weights[i].length);
    }
    let weightsT = new Float32Array(shape.reduce((a, b) => a + b, 0));
    let ind = 0;
    for (let i = 0; i < shape.length; i++){
        weightsT.set(weights[i], ind);
        ind += shape[i];
    }
    const shapeT = new Uint32Array(shape);
    const weightBlob = new Blob([new Uint8Array(weightsT.buffer)]);
    const form = new FormData();
    form.append('weights', weightBlob);
    form.append('shape', new Blob([new Uint8Array(shapeT.buffer)]));
    form.append('sid', socket.id);
    let xhr = new XMLHttpRequest();
    xhr.open("POST", message.callback, true);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.send(form);
    console.log("Trained Model Uploaded to Edge Server!");
};

export default onDownload;