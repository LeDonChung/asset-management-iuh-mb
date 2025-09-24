import { Platform } from 'react-native'
import axios from 'axios'

// Network test utility
export const testNetworkConnection = async () => {
  const urls = [
    'http://192.168.1.9:3000/api', // Android emulator
    'http://localhost:3000/api', // iOS simulator
    'http://192.168.1.9:3000/api', // Your actual IP
    'http://172.27.240.1:3000/api', // WSL IP
  ]

  console.log(`[Network Test] Testing connections for platform: ${Platform.OS}`)
  
  for (const url of urls) {
    try {
      console.log(`[Network Test] Testing: ${url}`)
      const response = await axios.get(`${url}/health`, { timeout: 5000 })
      console.log(`[Network Test] ✅ Success: ${url} - Status: ${response.status}`)
      return { success: true, url, status: response.status }
    } catch (error: any) {
      console.log(`[Network Test] ❌ Failed: ${url} - ${error.message}`)
    }
  }
  
  console.log('[Network Test] ❌ All connections failed')
  return { success: false, url: null, status: null }
}

// Test specific URL
export const testSpecificUrl = async (url: string) => {
  try {
    console.log(`[Network Test] Testing specific URL: ${url}`)
    const response = await axios.get(`${url}/health`, { timeout: 5000 })
    console.log(`[Network Test] ✅ Success: ${url} - Status: ${response.status}`)
    return { success: true, url, status: response.status }
  } catch (error: any) {
    console.log(`[Network Test] ❌ Failed: ${url} - ${error.message}`)
    return { success: false, url, error: error.message }
  }
}
