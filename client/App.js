import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Keyboard, View, SafeAreaView } from 'react-native';
import { WebView } from 'react-native-webview';
import AddrForm from './components/AddrForm.js';
import { io } from "socket.io-client";
import onDownload from "./src/util.js"
const connect = async (addr) => {
  addr = "138.67.222.214";
  console.log(`ip: ${addr}`);
  const socket = io(`http://${addr}:3001`, {
    extraHeaders: {
        'Authorization': `Bearer token`
    }
  });
  socket.on('download', onDownload);
}

export default function App() {
  const [addr, setAddr] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const submit = async () => {
    if (submitted) return;
    setSubmitted(true);
    Keyboard.dismiss();
    await connect(addr); 
  };
  return (
    <SafeAreaView style={styles.container}>
      {/*<AddrForm setAddr={setAddr} submit={submit}/>*/}
      <WebView style={styles.web} source={{ html: '<!-- Copyright (c) 2023 David Canaday -->\n<!DOCTYPE html>\n<head>\n    <title>HFL Client</title>\n</head>\n<body>\n    <div class="container">\n        <h1>HFL Client</h1>\n        <h id="console"><h>\n    </div>\n    <script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@2.0.0/dist/tf.min.js"></script>\n    <script>\n        window.addEventListener("load", function () {\n            ConsoleJS.init({selector: "pre.console"});\n            document.body.style.background = "#FF00FF";\n        });\n    </script>\n    <script type="module">\n        const token = "token";\n        var hash = window.location.hash.substring(1);\n        if (!hash) hash = 3001;\n        //console.log(`Attempting connection to: ws://127.0.0.1:${hash}!`);\n        import { io } from "https://cdn.socket.io/4.4.1/socket.io.esm.min.js";\n        const socket = io(`ws://138.67.222.214:${hash}`, {\n            extraHeaders: {\n                "Authorization": `Bearer ${token}`\n            }\n        });\n\n        let iteration = 0;\n        let numepochs = 0;\n        let curepoch = 0;\n        let loaded = false;\n\n        const statusStr = () => {document.getElementById("console").innerText = `Status: Epoch ${curepoch}/${numepochs} - Iteration ${iteration} (${loaded})`;}\n        statusStr();\n\n        const IMAGE_H = 28;\n        const IMAGE_W = 28;\n        const IMAGE_SIZE = IMAGE_H * IMAGE_W;\n        const NUM_CLASSES = 10;\n        let images = null;\n        let labels = null;\n        let trImages = null;\n        let trLabels = null;\n        const lblresp = await fetch("http://138.67.222.214:2999/lbl.bin");\n        const lblraw = await lblresp.arrayBuffer();\n        const ldata = new Float32Array(lblraw);\n        const imgresp = await fetch("http://138.67.222.214:2999/img.bin");\n        const imgraw = await imgresp.arrayBuffer();\n        const idata = new Float32Array(imgraw);\n\n        console.log("data loaded!");\n        loaded = true;\n        statusStr();\n\n        const dataprep = async (start, size) => {\n            images = idata.slice(start*IMAGE_SIZE, size*IMAGE_SIZE);\n            labels = ldata.slice(start*NUM_CLASSES, size*NUM_CLASSES);\n            trImages = tf.tensor2d(images, [images.length / IMAGE_SIZE, IMAGE_SIZE] );\n            trLabels = tf.tensor2d(labels, [labels.length / NUM_CLASSES, NUM_CLASSES]);\n        }\n\n        socket.on("download", async (message) =>{\n            iteration += 1;\n            curepoch = 0;\n            numepochs = message.iterations;\n            statusStr();\n            console.log("Received model from Edge Server!");\n            document.body.style.background = "#FFFFFF";\n            const TFRequest = {requestInit: {headers: {"Authorization": `Bearer ${token}`}}};\n            const model = await tf.loadLayersModel(message.model, TFRequest);\n            const trainEpochs = message.iterations;\n            if (!images || !labels){\n                await dataprep(message.data.start, message.data.size);\n            }\n\n            console.log("Begin client training!");\n            await model.compile({\n                optimizer: "adam",\n                loss: "categoricalCrossentropy",\n                metrics: ["accuracy"],\n            });\n            await model.fit(trImages, trLabels, {\n                epochs: trainEpochs,\n                callbacks: {\n                    onEpochEnd: async (epoch, logs) => {\n                        console.log(`  Epoch ${epoch+1}/${trainEpochs}`);\n                        curepoch += 1;\n                        statusStr();\n                    }\n                }\n            });\n            console.log("End client training!");\n            let weights = [];\n            let shape = [];\n            for (let i = 0; i < model.getWeights().length; i++) {\n                weights.push(await model.getWeights()[i].data());\n                shape.push(weights[i].length);\n            }\n            let weightsT = new Float32Array(shape.reduce((a, b) => a + b, 0));\n            let ind = 0;\n            for (let i = 0; i < shape.length; i++){\n                weightsT.set(weights[i], ind);\n                ind += shape[i];\n            }\n            const shapeT = new Uint32Array(shape);\n            const weightBlob = new Blob([new Uint8Array(weightsT.buffer)]);\n            const form = new FormData();\n            form.append("weights", weightBlob);\n            form.append("shape", new Blob([new Uint8Array(shapeT.buffer)]));\n            form.append("sid", socket.id);\n            let xhr = new XMLHttpRequest();\n            xhr.open("POST", message.callback, true);\n            xhr.setRequestHeader("Authorization", `Bearer ${token}`);\n            xhr.send(form);\n            console.log("Trained Model Uploaded to Edge Server!");\n        });\n    </script>\n</body>\n</html>\n'}}/>
      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  web: {
    width: 350,
    height: 500
  }
});
