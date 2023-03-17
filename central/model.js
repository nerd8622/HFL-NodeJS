// Copyright (c) 2023 David Canaday

const tf = require('@tensorflow/tfjs-node');

const model = tf.sequential();

const mparams = {
    input: [784],
    hidden: 64,
    output: 10
};

model.add(tf.layers.dense({inputShape: mparams.input, units: mparams.hidden, activation: 'relu'}));
model.add(tf.layers.dense({units: mparams.hidden, activation: 'relu'}));
model.add(tf.layers.dense({units: mparams.output, activation: 'softmax'}));

//console.log(model.summary());

/*model.compile({
  optimizer: 'adam',
  loss: 'categoricalCrossentropy',
  metrics: ['accuracy'],
});*/

module.exports = { model };