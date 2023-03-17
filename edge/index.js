// Copyright (c) 2023 David Canaday

const express = require('express');
const multer  = require('multer');
const { createServer } = require("http");
const { Server } = require("socket.io");
const axios = require('axios');
const path = require('path');
var cors = require('cors')
const tf = require('@tensorflow/tfjs-node');
const { errorMiddleware, sendDownstream, sendUpstream, aggregate, apiPost } = require('./util.js');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: '*',
    }
});
app.use(express.json());
app.use(cors());
app.use("/model", cors({origin: "*"}), express.static(path.join(__dirname, "model")));
const upload = multer();
//app.use(authMiddleware);

if (process.argv.length === 2) port = 3001;
else port = parseInt(process.argv[2]);
const host = "127.0.0.1";
const central_server = "http://127.0.0.1:3000"

const server = {url: central_server, callback: `http://${host}:${port}`};
const clients = {};
let edge_iterations;
let cData;

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
    cData = model.data;
    const fmodel = await tf.loadLayersModel(model.model);
    await fmodel.save("file://" + path.join(__dirname, "model"));
    model.model = `http://${host}:${port}/model/model.json`;
    model.callback = `http://${host}:${port}/upload`;
    edge_iterations = model.iterations;
    model.iterations = model.iterations[1];
    await sendDownstream(clients, model);
    console.log("Recieved model from Central Server");
});

app.post('/upload', cors({origin: "*"}), upload.any(), async (req, res) => {
    function convertTypedArray(src, type) {
        const buffer = new ArrayBuffer(src.byteLength);
        src.constructor.from(buffer).set(src);
        return new type(buffer);
    }
    res.json({message: 'received trained model'});
    console.log("Received trained model from client");
    const sid = req.headers["sid"];
    let decoded = [];
    let ind = 0;
    // Maybe label these with multer...
    let wBuff = convertTypedArray(req.files[0].buffer, Float32Array);
    let shape = convertTypedArray(req.files[1].buffer, Uint32Array);
    for (let i = 0; i < shape.length; i += 1){
        decoded.push(wBuff.slice(ind, ind+shape[i]));
        ind += shape[i];
    }
    clients[sid].model = decoded;
    const agg = await aggregate(server, clients, edge_iterations);
    if (agg){
        edge_iterations[0] -= 1;
        if (edge_iterations[0] > 0){
            const model = {};
            model.data = cData;
            model.model = `http://${host}:${port}/model/model.json`;
            model.callback = `http://${host}:${port}/upload`;
            model.iterations = edge_iterations[1];
            await sendDownstream(clients, model);
        } else{
            sendUpstream(server);
        }
    }
    console.log(edge_iterations);
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