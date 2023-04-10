import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Keyboard, View, SafeAreaView } from 'react-native';
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
      <AddrForm setAddr={setAddr} submit={submit}/>
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
});
