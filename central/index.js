// Copyright (c) 2023 David Canaday

const express = require('express');
const multer  = require('multer');
const path = require('path');
const { errorMiddleware, sendDownstream, aggregate, generateTrainPartitions } = require('./util.js');
const { model } = require('./model.js');

const app = express();
app.use(express.json());
app.use("/model", express.static(path.join(__dirname, "model")));
const upload = multer();
//app.use(authMiddleware);

const port = 3000;
const host = "127.0.0.1";
const edge_servers = {};
const curModel = {};
const dataSize = 400;
// iterations = [central, edge, client]
const iterations = [4, 4, 4];
let central_iterations = iterations[0];

app.get('/', async (req, res) => {
    //Replace with control panel or information...
    res.json({message: 'Hello World!'});
});

app.get('/start', async (req, res) => {
    res.json({message: 'Starting!'});
    curModel.data = generateTrainPartitions(edge_servers, dataSize);
    console.log(curModel.data);
    await model.save("file://" + path.join(__dirname, "model"));
    curModel.model = `http://${host}:${port}/model/model.json`;
    curModel.iterations = iterations.slice(1);
    await sendDownstream(edge_servers, curModel);
    console.log("Sending model to edge servers!");
});

app.post('/register', async (req, res) => {
    res.json({message: 'successfully registered!'});
    //maybe have central generate the id itself based on request address (hash)
    edge_servers[req.body.url] = {url: req.body.url};
    console.log("Edge server connected!");
    console.log(req.body);
});

app.post('/upload', upload.any(), async (req, res) => {
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
    let wBuff = convertTypedArray(req.files[0].buffer, Float32Array);
    let shape = convertTypedArray(req.files[1].buffer, Uint32Array);
    for (let i = 0; i < shape.length; i += 1){
        decoded.push(wBuff.slice(ind, ind+shape[i]));
        ind += shape[i];
    }
    edge_servers[eurl].model = decoded;
    const agg = await aggregate(edge_servers, iterations);
    if (agg){
        central_iterations -= 1;
        if (central_iterations[0] > 0){
            model.model = `http://${host}:${port}/model/model.json`;
            model.callback = `http://${host}:${port}/upload`;
            model.iterations = iterations.slice(1);
            await sendDownstream(edge_servers, model);
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