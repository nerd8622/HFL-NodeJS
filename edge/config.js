require('dotenv').config();

const config = {
    port: process.env.PORT || 3001,
    host: process.env.HOST || "127.0.0.1",
    central_server: `http://${process.env.CENTRAL_SERVER}` || "http://127.0.0.1:3000",
    server: {url: central_server, callback: `http://${host}:${port}`},
    client: {model: `http://${host}:${port}/model/model.json`, callback: `http://${host}:${port}/upload`}
}

module.exports = config;