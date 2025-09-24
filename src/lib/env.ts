// Environment configuration for React Native
import { Platform } from 'react-native'
import { API_URL, API_TIMEOUT, DEBUG } from '@env'

// Default configuration
const defaultConfig = {
  API_URL: Platform.OS === 'android' 
    ? 'http://192.168.1.9:3000'  // Android emulator
    : 'http://localhost:3000', // iOS simulator
  API_TIMEOUT: 10000,
  DEBUG: __DEV__,
}

// Get configuration from environment or use defaults
export const env = {
  API_URL: API_URL || defaultConfig.API_URL,
  API_TIMEOUT: parseInt(API_TIMEOUT || defaultConfig.API_TIMEOUT.toString()),
  DEBUG: DEBUG === 'true' || defaultConfig.DEBUG,
}

// Helper function to get API URL for different environments
export const getApiUrl = () => {
  if (__DEV__) {
    // In development, use appropriate URL based on platform
    const url = Platform.OS === 'android' 
      ? 'http://192.168.1.9:3000'  // Android emulator
      : 'http://localhost:3000'  // iOS simulator
    
    console.log(`[API Config] Using URL: ${url} for platform: ${Platform.OS}`)
    return url
  }
  return env.API_URL
}

// Network configuration for different environments
export const networkConfig = {
  // For Android emulator
  android: {
    baseURL: 'http://192.168.1.9:3000',
  },
  // For iOS simulator
  ios: {
    baseURL: 'http://localhost:3000',
  },
  // For physical device (using your actual IP)
  device: {
    baseURL: 'http://192.168.1.9:3000', // Your actual IP address
  },
  // For WSL (if needed)
  wsl: {
    baseURL: 'http://172.27.240.1:3000',
  },
}

// Get current network configuration
export const getCurrentNetworkConfig = () => {
  if (__DEV__) {
    return Platform.OS === 'android' ? networkConfig.android : networkConfig.ios
  }
  return networkConfig.device
}
