// Copyright (c) 2023 David Canaday

const express = require('express');
const { createServer } = require("http");
const { Server } = require("socket.io");
const axios = require('axios');
const path = require('path');
var cors = require('cors')
const tf = require('@tensorflow/tfjs-node');
const { errorMiddleware, sendDownstream, aggregate, apiPost } = require('./util.js');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: '*',
    }
});
app.use(express.json({limit: '500mb'}));
app.use("/model", cors({origin: "*"}), express.static(path.join(__dirname, "model")));
//app.use(authMiddleware);

if (process.argv.length === 2) port = 3001;
else port = parseInt(process.argv[2]);
const host = "127.0.0.1";
const central_server = "http://127.0.0.1:3000"

const server = {url: central_server, callback: `http://${host}:${port}`};
const clients = {};

const setup = async () => {
    await apiPost(`${server.url}/register`, {url: server.callback});
    console.log("Registering with central server!");
};
setup();

app.get('/', async (req, res) => {
    //Replace with control panel or information...
    res.json({message: 'Hello World!'});
});

app.post('/download', async (req, res) => {
    res.json({message: 'model received'});
    const model = req.body;
    const fmodel = await tf.loadLayersModel(model.model);
    await fmodel.save("file://" + path.join(__dirname, "model"));
    model.model = `http://${host}:${port}/model/model.json`;
    model.callback = `http://${host}:${port}/upload`;
    await sendDownstream(clients, model);
    console.log("Recieved model from Central Server");
});

app.post('/upload', async (req, res) => {
    res.json({message: 'received trained model'});
    const sid = req.headers["sid"];
    clients[sid].model = req.files[0].filename;
    console.log("Received trained model from client");
    await aggregate(server, clients);
});

io.on('connection', async (sock) => {
    console.log("Client connected!");
    clients[sock.id] = {sock: sock};
    await apiPost(`${server.url}/status`, {url: server.callback, numClients: Object.keys(clients).length});
    //Maybe delete from dict when disconnect...
});

app.get('*', async (req, res) => {
    res.send("Page Not Found!");
});

httpServer.listen(port, host, async () => {
    console.log(`Edge Server running on port ${port}!`);
});