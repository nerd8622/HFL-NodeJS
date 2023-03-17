// Copyright (c) 2023 David Canaday

const axios = require('axios');
const BodyFormData = require('form-data');
const tf = require('@tensorflow/tfjs-node');
const path = require('path');

const sendDownstream = async (servers, model) => {
    let i = 0;
    for(let s in servers) {
        const server = servers[s];
        const opt = {
            url: `${server.url}/download`,
            method: "POST",
            data: {model: model.model, data: model.data[i], iterations: model.iterations},
            headers: {
                'Content-Type': 'application/json',
            }
        };
        const response = await axios(opt);
        i+=1;
    }
}

const aggregate = async (edge_servers, iterations) => {
    const allData = true;
    let numEdges = 0;
    for (let e in edge_servers) {
        if (!edge_servers[e].model) allData = false;
        numEdges += 1;
    }
    if (allData){
        //do learning
        ekeys = Object.keys(edge_servers);
        aggregatedModel = edge_servers[ekeys[0]].model;
        for (let e = 1; e < ekeys.length; e+=1){
            const emodel = edge_servers[ekeys[e]].model;
            for (let i = 0; i < emodel.length; i+=1){
                for (let j = 0; j < emodel[i].length; c+=1){
                    if (e = 1) aggregatedModel[i][j] /= numEdges;
                    aggregatedModel[i][j] += emodel[i][j]/numEdges;
                }
            }
        }
        const amodel = await tf.loadLayersModel("file://" + path.join(__dirname, "model","model.json"));
        const layers = amodel.layers;
        for (let i = 0; i < layers.length; i+=1) {
            layers[i].setWeights([tf.tensor(aggregatedModel[i*2], layers[i].kernel.shape), tf.tensor(aggregatedModel[i*2+1], layers[i].bias.shape)]);
        }
        await amodel.save("file://" + path.join(__dirname, "model"));
        return true;
    }
    return false;
}

const generateTrainPartitions = (edge_servers, modelSize) => {
    let numClient = 0;
    for (let ed in edge_servers) numClient += edge_servers[ed].numClients;
    const perClient = Math.floor(modelSize/numClient);
    let out = [];
    let ind = 0;
    for (let ed in edge_servers) {
        const edge = edge_servers[ed];
        let temp = []
        for (let i = 0; i < edge.numClients; i++) {
            temp.push({
                start: ind,
                size: perClient
            });
            ind += perClient;
        }
        out.push(temp);
    }
    return out;
}

const errorMiddleware = (err, req, res, next) => {
    if (err.status) res.status(err.status);
    else res.status(500);
    
    res.json({message: "Something Failed!"});
}
  
const authMiddleware = (req, res, next) => {
    const dest = req.originalUrl;
    const tUrl = dest ? `/auth?dest=${encodeURIComponent(dest)}` : '/auth';
    if (!req.session.authed) res.redirect(tUrl);
    else next();
}

module.exports = { errorMiddleware, authMiddleware, sendDownstream, aggregate, generateTrainPartitions };