// Copyright (c) 2023 David Canaday

const axios = require('axios');
const BodyFormData = require('form-data');

const sendDownstream = async (clients, model) => {
    let i = 0;
    for (let c in clients){
        const client = clients[c];
        const cmodel = {model: model, data: model.data[i], iterations: model.iterations};
        const response = await client.sock.emit('download', cmodel);
        i+=1;
    }
}

const apiPost = async (url, data) => {
    const opt = {
        url: url,
        method: "POST",
        data: data,
        headers: {
            'Content-Type': 'application/json',
        }
    };
    return await axios(opt);
}

const sendUpstream = async (server, model) => {
    const response = await apiPost(`${server.url}/upload`, model);
}

//Sends data upstream if all clients have sent a model
const aggregate = async (server, clients, edge_iterations) => {
    let allData = true;
    let numClients = 0;
    for (let c in clients) {
        if (!c.model) allData = false;
        numClients += 1;
    } 
    if (allData){
        //do learning
        edge_iterations -= 1;
        ckeys = Object.keys(clients);
        aggregatedModel = clients[ckeys[0]];
        for (let c = 1; c < ckeys.length; c+=1){
            const cmodel = clients[ckeys[c]].model;
            for (let i = 0; i < cmodel.length; i+=1){
                for (let j = 0; j < cmodel[i].length; c+=1){
                    if (c = 1) aggregatedModel[i][j] /= numClients;
                    aggregatedModel[i][j] += cmodel[i][j]/numClients;
                }
            }
        }
        const amodel = await tf.loadLayersModel("file://" + path.join(__dirname, "model","model.json"));
        for (let i = 0; i < amodel.getWeights().length; i++) {
            amodel.getWeights()[i].setWeights(aggregatedModel[i]);
        }
        await amodel.save("file://" + path.join(__dirname, "model"));
        if (edge_iterations > 0){
            return true;
        }else{
            await sendUpstream(server, "nothing yet, still need to implement iterations");
        }
    }
    return false;
}

const errorMiddleware = (err, req, res, next) => {
    if (err.status) {
        res.status(err.status);
    } else {
        res.status(500);
    }
    res.json({
        message: "Something Failed!"
    });
  }
  
const authMiddleware = (req, res, next) => {
    const dest = req.originalUrl;
    const tUrl = dest ? `/auth?dest=${encodeURIComponent(dest)}` : '/auth';
    if (!req.session.authed){
        res.redirect(tUrl);
    }else{
        next();
    }
}

module.exports = { errorMiddleware, authMiddleware, sendDownstream, aggregate, apiPost};