// Environment configuration for React Native
import { Platform } from 'react-native'

// Environment configurations
const environments = {
  development: {
    API_URL: Platform.OS === 'android' 
      ? 'http://10.0.2.2:3000/api'  // Android emulator
      : 'http://localhost:3000/api', // iOS simulator
    API_TIMEOUT: 10000,
    DEBUG: true,
  },
  staging: {
    API_URL: 'https://staging-api.yourapp.com/api',
    API_TIMEOUT: 15000,
    DEBUG: true,
  },
  production: {
    API_URL: 'https://api.yourapp.com/api',
    API_TIMEOUT: 20000,
    DEBUG: false,
  },
}

// Get current environment
const getEnvironment = (): keyof typeof environments => {
  if (__DEV__) {
    return 'development'
  }
  // You can add logic here to detect staging vs production
  // For example, based on build configuration or remote config
  return 'production'
}

// Get current configuration
const currentEnv = getEnvironment()
export const config = environments[currentEnv]

// Export individual config values for convenience
export const {
  API_URL,
  API_TIMEOUT,
  DEBUG,
} = config

// Helper function to get API URL for different environments
export const getApiUrl = () => {
  return API_URL
}

// Network configuration for different environments
export const networkConfig = {
  // For Android emulator
  android: {
    baseURL: 'http://10.0.2.2:3000/api',
  },
  // For iOS simulator
  ios: {
    baseURL: 'http://localhost:3000/api',
  },
  // For physical device (replace with your computer's IP)
  device: {
    baseURL: 'http://192.168.1.100:3000/api', // Replace with your actual IP
  },
}

// Get current network configuration
export const getCurrentNetworkConfig = () => {
  if (__DEV__) {
    return Platform.OS === 'android' ? networkConfig.android : networkConfig.ios
  }
  return networkConfig.device
}

// Environment info
export const envInfo = {
  current: currentEnv,
  isDevelopment: __DEV__,
  isProduction: !__DEV__,
  platform: Platform.OS,
}
