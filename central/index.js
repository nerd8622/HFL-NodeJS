// Copyright (c) 2023 David Canaday

const express = require('express');
const multer  = require('multer');
const path = require('path');
const { errorMiddleware, authMiddleware, sendDownstream, aggregate, generateTrainPartitions } = require('./util.js');
const { model } = require('./model.js');

const app = express();
app.use(express.json());
app.use("/model", authMiddleware, express.static(path.join(__dirname, "model")));
app.use(errorMiddleware);
const upload = multer();


const port = 3000;
const host = "127.0.0.1";

const edge_servers = {};

// Size of dataset, split among clients
const dataSize = 500;
// iterations = [central, edge, client]
const iterations = [4, 4, 4];
let central_iterations = iterations[0];

app.get('/', async (req, res) => {
    //Replace with control panel or information...
    res.json({message: 'Hello World!'});
});

app.get('/start', async (req, res) => {
    // Call this endpoint to start the learning!
    res.json({message: 'Starting!'});
    const curModel = {};
    curModel.data = generateTrainPartitions(edge_servers, dataSize);
    console.log(`Prepped data for ${curModel.data.length} edge servers. There are ${curModel.data.reduce((a, b) => a + b.length, 0)} total clients.`);
    await model.save("file://" + path.join(__dirname, "model"));
    curModel.model = `http://${host}:${port}/model/model.json`;
    curModel.iterations = iterations.slice(1);
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
    res.json({message: 'successfully registered!'});
    //maybe have central generate the id itself based on request address (hash)
    edge_servers[req.body.url] = {url: req.body.url};
    console.log(`Edge server connected from ${req.body.url}!`);
});

app.post('/upload', upload.fields([{ name: 'weights', maxCount: 1 }, { name: 'shape', maxCount: 1 }]), async (req, res) => {
    function convertTypedArray(src, type) {
        const buffer = new ArrayBuffer(src.byteLength);
        src.constructor.from(buffer).set(src);
        return new type(buffer);
    }
    const eurl = req.body.url;
    res.json({message: 'received model!'});
    console.log("Received averaged model from edge server!");
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
        central_iterations -= 1;
        console.log("Central Server iteration complete!");
        if (central_iterations > 0){
            await sendDownstream(edge_servers);
        } else{
            console.log("ALL DONE!!!");
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

app.listen(port, host, async () => {
    console.log(`Central Server running on port ${port}!`);
});