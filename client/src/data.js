/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */

// Modified to allow the splitting of dataset so that each client 
// can train on a different piece. -David

import * as tf from '@tensorflow/tfjs';
import pako from 'pako';
import {Buffer} from 'buffer';

// MNIST data constants:
const BASE_URL = 'https://storage.googleapis.com/cvdf-datasets/mnist/';
const TRAIN_IMAGES_FILE = 'train-images-idx3-ubyte';
const TRAIN_LABELS_FILE = 'train-labels-idx1-ubyte';
const IMAGE_HEADER_BYTES = 16;
const IMAGE_HEIGHT = 28;
const IMAGE_WIDTH = 28;
const IMAGE_FLAT_SIZE = IMAGE_HEIGHT * IMAGE_WIDTH;
const LABEL_HEADER_BYTES = 8;
const LABEL_RECORD_BYTE = 1;
const LABEL_FLAT_SIZE = 10;

// Downloads a test file only once and returns the buffer for the file.

async function loadImages(filename) {
  const res = await fetch(`${BASE_URL}${filename}.gz`);
  const data = await res.arrayBuffer();
  const unzip = pako.inflate(data);
  const buffer = Buffer.from(unzip);

  const headerBytes = IMAGE_HEADER_BYTES;
  const recordBytes = IMAGE_HEIGHT * IMAGE_WIDTH;

  const images = [];
  let index = headerBytes;
  while (index < buffer.byteLength) {
    const array = new Float32Array(recordBytes);
    for (let i = 0; i < recordBytes; i++) {
      // Normalize the pixel values into the 0-1 interval, from
      // the original 0-255 interval.
      array[i] = buffer.readUInt8(index++) / 255;
    }
    images.push(array);
  }

  return images;
}

async function loadLabels(filename) {
  const res = await fetch(`${BASE_URL}${filename}.gz`);
  const data = await res.arrayBuffer();
  const unzip = pako.inflate(data);
  const buffer = Buffer.from(unzip);

  const headerBytes = LABEL_HEADER_BYTES;
  const recordBytes = LABEL_RECORD_BYTE;

  const labels = [];
  let index = headerBytes;
  while (index < buffer.byteLength) {
    const array = new Int32Array(recordBytes);
    for (let i = 0; i < recordBytes; i++) {
      array[i] = buffer.readUInt8(index++);
    }
    labels.push(array);
  }

  return labels;
}

/** Helper class to handle loading training and test data. */
class MnistData {
  constructor() {
    this.dataset = null;
    this.trainSize = 0;
    this.testSize = 0;
    this.trainBatchIndex = 0;
    this.testBatchIndex = 0;
  }

  /** Loads training and test data. */
  async load() {
    this.dataset = await Promise.all([
      loadImages(TRAIN_IMAGES_FILE), loadLabels(TRAIN_LABELS_FILE)
    ]);
    this.trainSize = this.dataset[0].length;
  }

  getTrainData(beginInd, sampleSize) {
    const imagesIndex = 0;
    const labelsIndex = 1;

    const size = this.dataset[imagesIndex].length;
    tf.util.assert(
        this.dataset[labelsIndex].length === size,
        `Mismatch in the number of images (${size}) and ` +
            `the number of labels (${this.dataset[labelsIndex].length})`);

    // Only create one big array to hold batch of images.
    const imagesShape = [sampleSize, IMAGE_HEIGHT*IMAGE_WIDTH];
    const images = new Float32Array(tf.util.sizeFromShape(imagesShape));
    const labels = new Float32Array(tf.util.sizeFromShape([sampleSize, LABEL_FLAT_SIZE]));

    let imageOffset = 0;
    let labelOffset = 0;
    for (let i = beginInd; i < sampleSize+beginInd; i++) {
      images.set(this.dataset[imagesIndex][i], imageOffset);
      let tmp = this.dataset[labelsIndex][i];
      for (let j = 0; j < 10; j++){
        labels.set(tmp[0]==j?new Float32Array([1.0]) : new Float32Array([0.0]), labelOffset);
        labelOffset += 1;
      }
      imageOffset += IMAGE_FLAT_SIZE;
    }
    //tf.oneHot(tf.tensor1d(labels, 'float32'), LABEL_FLAT_SIZE).print();
    return {
      trImages: tf.tensor2d(images, imagesShape),
      trLabels: tf.tensor2d(labels, [sampleSize, LABEL_FLAT_SIZE])
    };
  }
}

export default MnistData;