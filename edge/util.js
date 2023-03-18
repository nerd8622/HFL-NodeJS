// Copyright (c) 2023 David Canaday

const axios = require('axios');
const BodyFormData = require('form-data');
const tf = require('@tensorflow/tfjs-node');
const path = require('path');

const sendDownstream = async (clients) => {
    for (let c in clients){
        const client = clients[c];
        const cmodel = {...client.data};
        const response = await client.sock.emit('download', cmodel);
    }
}

const apiPost = async (url, data) => {
    const opt = {
        url: url,
        method: "POST",
        data: data,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer token'
        },
        validateStatus: (status) => {return true}
    };
    return await axios(opt)
}

const sendUpstream = async (server) => {
    const umodel = await tf.loadLayersModel("file://" + path.join(__dirname, "model","model.json"));
    let weights = [];
    let shape = [];
    for (let i = 0; i < umodel.getWeights().length; i++) {
        weights.push(await umodel.getWeights()[i].data());
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
    const shapeBlob = new Blob([new Uint8Array(shapeT.buffer)]);
    const form = new FormData();
    form.append('weights', weightBlob);
    form.append('shape', shapeBlob);
    form.append('url', server.callback);
    const opt = {
        url: `${server.url}/upload`,
        method: "POST",
        data: form
    };
    const response = await axios(opt);
}

//Sends data upstream if all clients have sent a model
const aggregate = async (clients) => {
    let numClients = 0;
    for (let c in clients) {
        if (!clients[c].model) return false;
        numClients += 1;
    } 
    //do learning
    ckeys = Object.keys(clients);
    aggregatedModel = Object.assign({},clients[ckeys[0]].model);
    clients[ckeys[0]].model = false;
    for (let c = 1; c < ckeys.length; c+=1){
        const cmodel = clients[ckeys[c]].model;
        for (let i = 0; i < cmodel.length; i+=1){
            for (let j = 0; j < cmodel[i].length; j+=1){
                if (c == 1) aggregatedModel[i][j] /= numClients;
                aggregatedModel[i][j] += cmodel[i][j]/numClients;
            }
        }
        clients[ckeys[c]].model = false;
    }
    const amodel = await tf.loadLayersModel("file://" + path.join(__dirname, "model","model.json"));
    const layers = amodel.layers;
    for (let i = 0; i < layers.length; i+=1) {
        layers[i].setWeights([tf.tensor(aggregatedModel[i*2], layers[i].kernel.shape), tf.tensor(aggregatedModel[i*2+1], layers[i].bias.shape)]);
    }
    await amodel.save("file://" + path.join(__dirname, "model"));
    return true;
}

const errorMiddleware = (err, req, res, next) => {
    if (err.status) {
        res.status(err.status);
    } else {
        res.status(500);
    }
    res.json({
        message: "Something Failed!"
    });
}
  
const authMiddleware = (req, res, next) => {
    const auth = req.header("Authorization");
    if (auth != `Bearer token`) {
        res.status(403).send("Authentication Failed");
    }
    else next();
}

module.exports = { errorMiddleware, authMiddleware, sendDownstream, sendUpstream, aggregate, apiPost};