import { forwardRef, useState } from 'react';
import { View, TextInput, Text, TouchableOpacity, StyleSheet, Keyboard } from 'react-native'

const AddrForm = ({ setAddr: setAddr, submit: submit }) => {

    return (
        <View style={styles.container}>
            <Text style={styles.text}>Enter Address of Edge Server:</Text>
            <TextInput style={styles.input} onChangeText={setAddr} placeholder='127.0.0.1:3001' keyboardType='numeric'/>
            <TouchableOpacity style={styles.button} onPress={submit}>
                <Text style={styles.btext}>Submit!</Text>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: 300,
        height: 280,
        borderWidth: 1,
        borderColor: "black",
        shadowColor: "black",
        shadowRadius: 7,
        paddingHorizontal: 10,
        paddingTop: 30,
        textAlign: "center",
        alignItems: "center",
        borderRadius: 10,
        marginTop: 40

    },
    text: {
        fontSize: 30,
        fontWeight: "bold",
        textAlign: "center"
    },
    input: {
        width: 230,
        textAlign: "center",
        borderWidth: 1,
        borderColor: "black",
        borderRadius: 7,
        fontSize: 20,
        margin: 30
    },
    button: {
        width: 200,
        borderWidth: 1,
        borderColor: "black",
        backgroundColor: "blue",
        borderRadius: 30,
        height: 50,

    },
    btext: {
        color: "white",
        fontSize: 30,
        textAlign: "center",
    }
});

export default AddrForm;