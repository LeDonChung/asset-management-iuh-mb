import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { testImagePicker, testCamera } from '../utils/imagePickerTest';

export const ImagePickerDebug: React.FC = () => {
  const handleTestLibrary = async () => {
    console.log('Testing image library...');
    const success = await testImagePicker();
    Alert.alert(
      'Test Image Library',
      success ? 'Thành công!' : 'Thất bại!',
      [{ text: 'OK' }]
    );
  };

  const handleTestCamera = async () => {
    console.log('Testing camera...');
    const success = await testCamera();
    Alert.alert(
      'Test Camera',
      success ? 'Thành công!' : 'Thất bại!',
      [{ text: 'OK' }]
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Image Picker Debug</Text>
      
      <TouchableOpacity style={styles.button} onPress={handleTestLibrary}>
        <Text style={styles.buttonText}>Test Image Library</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.button} onPress={handleTestCamera}>
        <Text style={styles.buttonText}>Test Camera</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#f0f0f0',
    margin: 10,
    borderRadius: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  buttonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: '500',
  },
});
