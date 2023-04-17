// Copyright (c) 2023 David Canaday

const express = require('express');
const multer  = require('multer');
const { createServer } = require("http");
const { Server } = require("socket.io");
const path = require('path');
var cors = require('cors')
const tf = require('@tensorflow/tfjs-node');
const { errorMiddleware, authMiddleware, sendDownstream, sendUpstream, aggregate, apiPost, TFRequest } = require('./util.js');
const genTrainData = require('./genbin.js');
const config = require('./config.js');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {cors: {origin: '*'}});
app.use(express.json());
app.use(cors());
app.use(errorMiddleware);
app.use(authMiddleware);
app.use("/model", cors({origin: "*"}), express.static(path.join(__dirname, "model")));
const upload = multer();

const clients = {};
let edge_iterations;
let training_in_progress = false;

const setup = async () => {
    await genTrainData();
    let connected = false;
    while (!connected){
        const reponse = await apiPost(`${config.server.url}/register`, {url: config.server.callback});
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
    training_in_progress = true;
    res.json({message: 'model received'});
    const model = req.body;
    const fmodel = await tf.loadLayersModel(model.model, TFRequest);
    await fmodel.save("file://" + path.join(__dirname, "model"));
    model.model = config.client.model;
    model.callback = config.client.callback;
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
            await sendUpstream(config.server, agg);
            training_in_progress = false;
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
    const timeMetric = JSON.parse(req.body.time);
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
    clients[sid].time = timeMetric;
    await checkUpload();
});

io.on('connection', async (sock) => {
    if (training_in_progress) {
        sock.emit('message', 'failed to register - training in progress!');
        return false;
    }
    console.log("Client connected!");
    clients[sock.id] = {sock: sock};
    await apiPost(`${config.server.url}/status`, {url: config.server.callback, numClients: Object.keys(clients).length});
    sock.on('disconnect', async () => {
        console.log(`Client disconnect: ${sock.handshake.address}!`);
        delete clients[sock.id];
        await apiPost(`${config.server.url}/status`, {url: config.server.callback, numClients: Object.keys(clients).length});
        await checkUpload();
    });
    //Maybe delete from dict when disconnect...
});

app.get('*', async (req, res) => {
    res.send("Page Not Found!");
});

httpServer.listen(config.port, config.host, async () => {
    console.log(`Edge Server running on ${config.host}:${config.port}!`);
});