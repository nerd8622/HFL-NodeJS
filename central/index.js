// Copyright (c) 2023 David Canaday

const express = require('express');
const path = require('path');
const { errorMiddleware, sendDownstream, aggregate, generateTrainPartitions } = require('./util.js');
const { model } = require('./model.js');

const app = express();
app.use(express.json());
app.use("/model", express.static(path.join(__dirname, "model")));
//app.use(authMiddleware);

const port = 3000;
const host = "127.0.0.1";
const edge_servers = {};
const curModel = {};
const dataSize = 400;

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

app.post('/upload', async (req, res) => {
    res.json({message: 'received model!'});
    edge_servers[req.body.url].model = req.body.model;
    console.log("Received averaged model from edge server!");
    aggregate(edge_servers, curModel);
});

app.post('/status', async (req, res) => {
    res.json({message: 'acknowledged!'});
    edge_servers[req.body.url].numClients = req.body.numClients;
    console.log(`Edge ${req.body.url} has ${req.body.numClients} client(s)!`)
});

app.get('/model', async (req, res) => {
    res.sendFile(path.join(__dirname, "model", "model.json"));
});

app.get('*', async (req, res) => {
    res.send("Page Not Found!");
});

app.listen(port, host, async () => {
    console.log(`Central Server running on port ${port}!`);
});