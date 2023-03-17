// Copyright (c) 2023 David Canaday

const axios = require('axios');
const BodyFormData = require('form-data');

const sendDownstream = async (servers, model) => {
    let i = 0;
    for(let s in servers) {
        const server = servers[s];
        const opt = {
            url: `${server.url}/download`,
            method: "POST",
            data: {model: model.model, data: model.data[i]},
            headers: {
                'Content-Type': 'application/json',
            }
        };
        const response = await axios(opt);
        i+=1;
    }
}

const aggregate = async (edge_servers, model) => {
    const allData = true;
    for (let e in edge_servers) if (!edge_servers[e].model) allData = false;
    if (allData){
        //do learning
        aggregatedModel = {};
        model = aggregatedModel;
    }
}

const errorMiddleware = (err, req, res, next) => {
    if (err.status) res.status(err.status);
    else res.status(500);
    
    res.json({message: "Something Failed!"});
}
  
const authMiddleware = (req, res, next) => {
    const dest = req.originalUrl;
    const tUrl = dest ? `/auth?dest=${encodeURIComponent(dest)}` : '/auth';
    if (!req.session.authed) res.redirect(tUrl);
    else next();
}

module.exports = { errorMiddleware, authMiddleware, sendDownstream, aggregate };