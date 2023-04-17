// Copyright (c) 2023 David Canaday

const axios = require('axios');
const BodyFormData = require('form-data');
const tf = require('@tensorflow/tfjs-node');
const path = require('path');
const zlib = require('zlib');
const util = require('util');
const fs = require('fs').promises;

const token = 'token';
var testLbl, testImg;

const testDataRead = async (filename, size) => {
    const fbuf = await fs.readFile(filename);
    const gunzip = util.promisify(zlib.gunzip);
    const buf = await gunzip(fbuf);
    const ubuf = new Uint8Array(buf);
    const arr = new Float32Array(ubuf.buffer);
    return tf.tensor2d(arr, [arr.length / size, size])
}

const validateModel = async (model) => {
    if (!testLbl || !testImg){
        testLbl = await testDataRead(path.join(__dirname, "model/lblval.bin"), 10);
        testImg = await testDataRead(path.join(__dirname, "model/imgval.bin"), 784);
    }
    await model.compile({
        optimizer: "adam",
        loss: "categoricalCrossentropy",
        metrics: ["accuracy"],
    });
    const eval = await model.evaluate(testImg, testLbl);
    const acc = await eval[1].array();
    return acc;
}

const sendDownstream = async (servers) => {
    for(let s in servers) {
        const server = servers[s];
        const opt = {
            url: `${server.url}/download`,
            method: "POST",
            data: server.data,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        };
        const response = await axios(opt).catch((err) => {
            delete servers[s];
        });
    }
}

const aggregate = async (edge_servers) => {
    let allData = true;
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
                    if (e == 1) aggregatedModel[i][j] /= numEdges;
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
        return await validateModel(amodel);
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
    const auth = req.header("Authorization");
    if (auth != `Bearer ${token}`) {
        res.status(403).send("Authentication Failed");
    }
    else next();
}

module.exports = { errorMiddleware, authMiddleware, sendDownstream, aggregate, generateTrainPartitions };