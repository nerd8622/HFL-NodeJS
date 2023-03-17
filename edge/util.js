// Copyright (c) 2023 David Canaday

const axios = require('axios');
const BodyFormData = require('form-data');

const sendDownstream = async (clients, model) => {
    let i = 0;
    for (let c in clients){
        const client = clients[c];
        const cmodel = {model: model.model, data: model.data[i]};
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
const aggregate = async (server, clients) => {
    const allData = true;
    for (let c in clients) if (!c.model) allData = false;
    if (allData){
        //do learning
        aggregatedModel = [];
        await sendUpstream(server, aggregatedModel);
    }
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