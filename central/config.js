require('dotenv').config();

const clientIterations = 4,
      edgeIterations = 4,
      centralIterations = 4;

const config = {
    port: process.env.PORT || 3000,
    host: process.env.HOST || "127.0.0.1",
    dataSize: 400, // number less than true size (60,000)
    iterations: [edgeIterations, clientIterations],
    centralIterations: centralIterations,
    centralAccuracy: 0.90,
    centralUseIterations: false // Uses accuracy metric if false
}

module.exports = config;