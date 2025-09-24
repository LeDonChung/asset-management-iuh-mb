// Test utility for image picker functionality
import { launchImageLibrary, launchCamera, ImagePickerResponse, MediaType } from 'react-native-image-picker';
import { Platform, PermissionsAndroid, Alert } from 'react-native';

export const testImagePicker = async () => {
  console.log('Testing image picker functionality...');
  
  // Test permissions first
  if (Platform.OS === 'android') {
    try {
      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.CAMERA,
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
      ]);
      
      const allPermissionsGranted = Object.values(granted).every(
        permission => permission === PermissionsAndroid.RESULTS.GRANTED
      );
      
      if (!allPermissionsGranted) {
        console.log('Permissions not granted:', granted);
        return false;
      }
      console.log('All permissions granted');
    } catch (err) {
      console.error('Permission request error:', err);
      return false;
    }
  }
  
  // Test image library
  console.log('Testing image library...');
  const libraryOptions = {
    mediaType: 'photo' as MediaType,
    quality: 0.8 as any,
    maxWidth: 1280,
    maxHeight: 1280,
    selectionLimit: 1,
    includeBase64: false,
  };
  
  return new Promise<boolean>((resolve) => {
    launchImageLibrary(libraryOptions, (response: ImagePickerResponse) => {
      console.log('Image library test response:', response);
      
      if (response.didCancel) {
        console.log('User cancelled image library test');
        resolve(false);
        return;
      }
      
      if (response.errorMessage) {
        console.error('Image library test error:', response.errorMessage);
        resolve(false);
        return;
      }
      
      if (response.assets && response.assets.length > 0) {
        console.log('Image library test successful:', response.assets[0]);
        resolve(true);
      } else {
        console.log('No assets in image library test');
        resolve(false);
      }
    });
  });
};

export const testCamera = async () => {
  console.log('Testing camera functionality...');
  
  const cameraOptions = {
    mediaType: 'photo' as MediaType,
    quality: 0.8 as any,
    maxWidth: 1280,
    maxHeight: 1280,
    includeBase64: false,
  };
  
  return new Promise<boolean>((resolve) => {
    launchCamera(cameraOptions, (response: ImagePickerResponse) => {
      console.log('Camera test response:', response);
      
      if (response.didCancel) {
        console.log('User cancelled camera test');
        resolve(false);
        return;
      }
      
      if (response.errorMessage) {
        console.error('Camera test error:', response.errorMessage);
        resolve(false);
        return;
      }
      
      if (response.assets && response.assets.length > 0) {
        console.log('Camera test successful:', response.assets[0]);
        resolve(true);
      } else {
        console.log('No assets in camera test');
        resolve(false);
      }
    });
  });
};
