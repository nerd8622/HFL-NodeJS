// Copyright (c) 2023 David Canaday

const express = require('express');
const multer  = require('multer');
const { createServer } = require("http");
const { Server } = require("socket.io");
const axios = require('axios');
const path = require('path');
var cors = require('cors')
const tf = require('@tensorflow/tfjs-node');
const { errorMiddleware, authMiddleware, sendDownstream, sendUpstream, aggregate, apiPost, TFRequest } = require('./util.js');
require('dotenv').config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {cors: {origin: '*'}});
app.use(express.json());
app.use(cors());
app.use(errorMiddleware);
app.use(authMiddleware);
app.use("/model", cors({origin: "*"}), express.static(path.join(__dirname, "model")));
const upload = multer();

const port = process.env.PORT || 3001;
const host = process.env.HOST || "127.0.0.1";
const central_server = process.env.CENTRAL_SERVER || "http://127.0.0.1:3000";

const server = {url: central_server, callback: `http://${host}:${port}`};
const clients = {};
let edge_iterations;

const setup = async () => {
    let connected = false;
    while (!connected){
        const reponse = await apiPost(`${server.url}/register`, {url: server.callback});
        if (reponse.status == 200){
            connected = true;
        }
    }
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
    const fmodel = await tf.loadLayersModel(model.model, TFRequest);
    await fmodel.save("file://" + path.join(__dirname, "model"));
    model.model = `http://${host}:${port}/model/model.json`;
    model.callback = `http://${host}:${port}/upload`;
    edge_iterations = model.iterations;
    model.iterations = model.iterations[1];
    let i = 0;
    for (let c in clients){
        const cmodel = Object.assign({}, model);
        cmodel.data = cmodel.data[i];
        clients[c].data = cmodel;
        i+=1;
    }
    await sendDownstream(clients);
    console.log("Recieved model from Central Server");
});

const checkUpload = async () => {
    const agg = await aggregate(clients);
    if (agg){
        edge_iterations[0] -= 1;
        console.log("Edge server iteration complete!");
        if (edge_iterations[0] > 0){
            await sendDownstream(clients);
        } else{
            await sendUpstream(server);
        }
    }
}

app.post('/upload', cors({origin: "*"}), upload.fields([{ name: 'weights', maxCount: 1 }, { name: 'shape', maxCount: 1 }]), async (req, res) => {
    function convertTypedArray(src, type) {
        const buffer = new ArrayBuffer(src.byteLength);
        src.constructor.from(buffer).set(src);
        return new type(buffer);
    }
    res.json({message: 'received trained model'});
    console.log("Received trained model from client");
    const sid = req.body.sid;
    let decoded = [];
    let ind = 0;
    // Maybe label these with multer...
    let wBuff = convertTypedArray(req.files['weights'][0].buffer, Float32Array);
    let shape = convertTypedArray(req.files['shape'][0].buffer, Uint32Array);
    for (let i = 0; i < shape.length; i += 1){
        decoded.push(wBuff.slice(ind, ind+shape[i]));
        ind += shape[i];
    }
    clients[sid].model = decoded;
    await checkUpload();
});

io.on('connection', async (sock) => {
    console.log("Client connected!");
    clients[sock.id] = {sock: sock};
    await apiPost(`${server.url}/status`, {url: server.callback, numClients: Object.keys(clients).length});
    sock.on('disconnect', async () => {
        console.log(`Client disconnect: ${sock.handshake.address}!`);
        delete clients[sock.id];
        await apiPost(`${server.url}/status`, {url: server.callback, numClients: Object.keys(clients).length});
        await checkUpload();
    });
    //Maybe delete from dict when disconnect...
});

app.get('*', async (req, res) => {
    res.send("Page Not Found!");
});

httpServer.listen(port, host, async () => {
    console.log(`Edge Server running on port ${port}!`);
});