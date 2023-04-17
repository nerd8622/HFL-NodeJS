// Copyright (c) 2023 David Canaday

const express = require('express');
const multer  = require('multer');
const path = require('path');
const { errorMiddleware, authMiddleware, sendDownstream, aggregate, generateTrainPartitions, convertTypedArray } = require('./util.js');
const { model } = require('./model.js');
const genTestData = require('./gentest.js');
const config = require('./config.js');

const app = express();
app.use(express.json());
app.use("/model", authMiddleware, express.static(path.join(__dirname, "model")));
app.use(errorMiddleware);
const upload = multer();

const edge_servers = {};
let training_in_progress = false;
let curIterations = config.centralIterations;

app.get('/', async (req, res) => {
    //Replace with control panel or information...
    res.json({message: 'Hello World!'});
});

app.get('/start', async (req, res) => {
    // Call this endpoint to start the learning!
    training_in_progress = true;
    await genTestData();
    res.json({message: 'Starting!'});
    const curModel = {};
    curModel.data = generateTrainPartitions(edge_servers, config.dataSize);
    console.info(`Prepped data for ${curModel.data.length} edge servers. There are ${curModel.data.reduce((a, b) => a + b.length, 0)} total clients.`);
    await model.save("file://" + path.join(__dirname, "model"));
    curModel.model = `http://${config.host}:${config.port}/model/model.json`;
    curModel.iterations = config.iterations;
    let i = 0;
    for (let e in edge_servers){
        const emodel = Object.assign({}, curModel);
        emodel.data = emodel.data[i];
        edge_servers[e].data = emodel;
        i+=1;
    }
    await sendDownstream(edge_servers);
    console.log("Sending model to edge servers!");
});

app.use(authMiddleware);

app.post('/register', async (req, res) => {
    if (training_in_progress) {
        res.json({message: 'failed to register - training in progress!'});
        return false;
    }
    res.json({message: 'successfully registered!'});
    //maybe have central generate the id itself based on request address (hash)
    edge_servers[req.body.url] = {url: req.body.url};
    console.log(`Edge server connected from ${req.body.url}!`);
});

app.post('/upload', upload.fields([{ name: 'weights', maxCount: 1 }, { name: 'shape', maxCount: 1 }]), async (req, res) => {
    const eurl = req.body.url;
    res.json({message: 'received model!'});
    console.log("Received averaged model from edge server!");
    console.info(`Training Time Metric for Edge:\n${JSON.parse(req.body.metric)}`);
    let decoded = [];
    let ind = 0;
    // Maybe label these with multer...
    let wBuff = convertTypedArray(req.files['weights'][0].buffer, Float32Array);
    let shape = convertTypedArray(req.files['shape'][0].buffer, Uint32Array);
    for (let i = 0; i < shape.length; i += 1){
        decoded.push(wBuff.slice(ind, ind+shape[i]));
        ind += shape[i];
    }
    edge_servers[eurl].model = decoded;
    const agg = await aggregate(edge_servers);
    if (agg){
        let threshold = false;
        console.log("Central Server iteration complete!");
        console.info(`Model accuracy: ${agg*100}%! (Target: ${config.centralAccuracy*100}%)`);
        if (config.centralUseIterations){
            curIterations -= 1;
            threshold = curIterations <= 0;
        } else{
            threshold = curAccuracy >= config.centralAccuracy;
        }
        if (threshold){
            curIterations = config.centralIterations;
            await sendDownstream(edge_servers);
        } else{
            console.log("ALL DONE!!!");
            training_in_progress = false;
        }
    }
});

app.post('/status', async (req, res) => {
    res.json({message: 'acknowledged!'});
    edge_servers[req.body.url].numClients = req.body.numClients;
    console.log(`Edge ${req.body.url} has ${req.body.numClients} client(s)!`)
});

app.get('*', async (req, res) => {
    res.send("Page Not Found!");
});

app.listen(config.port, config.host, async () => {
    console.log(`Central Server running on ${config.host}:${config.port}!`);
});