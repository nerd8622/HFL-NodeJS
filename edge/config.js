require('dotenv').config();

const config = {
    port: process.env.PORT || 3001,
    host: process.env.HOST || "127.0.0.1",
    central_server: `http://${process.env.CENTRAL_SERVER}` || "http://127.0.0.1:3000",
    server: {url: this.central_server, callback: `http://${this.host}:${this.port}`},
    client: {model: `http://${this.host}:${this.port}/model/model.json`, callback: `http://${this.host}:${this.port}/upload`}
}

module.exports = config;