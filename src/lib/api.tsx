import axios from 'axios'
import { Alert } from 'react-native'
import { tokenStorage, clearAuthData } from './storage'
import { API_TIMEOUT, API_URL } from '@env'

// Create axios instance
export const axiosInstance = axios.create({
  baseURL: 'http://192.168.1.24:3000',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
})

// Request interceptor to add auth token
axiosInstance.interceptors.request.use(
  async (config) => {
    try {
      // Get token from storage
      const token = await tokenStorage.getToken()
      
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
    } catch (error) {
      console.error('Error getting token from storage:', error)
    }
    
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor to handle auth errors and network errors
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Network error
    if (!error.response) {
      Alert.alert(
        'Lỗi kết nối',
        'Không thể kết nối đến server. Vui lòng kiểm tra kết nối mạng.',
        [{ text: 'OK' }]
      )
      return Promise.reject(new Error('Network error'))
    }

    // Handle different error status codes
    switch (error.response.status) {
      case 401:
        // Unauthorized - clear auth data
        try {
          await clearAuthData()
          
          // Navigate to login screen (you'll need to implement navigation)
          // navigationRef.current?.reset({
          //   index: 0,
          //   routes: [{ name: 'Login' }],
          // })
        } catch (storageError) {
          console.error('Error clearing storage:', storageError)
        }
        break
        
      case 403:
        Alert.alert(
          'Không có quyền',
          'Bạn không có quyền truy cập tính năng này.',
          [{ text: 'OK' }]
        )
        break
        
      case 404:
        Alert.alert(
          'Không tìm thấy',
          'Không tìm thấy dữ liệu yêu cầu.',
          [{ text: 'OK' }]
        )
        break
        
      case 422:
        // Validation errors - don't show alert, let component handle
        break
        
      case 500:
        Alert.alert(
          'Lỗi server',
          'Lỗi server nội bộ. Vui lòng thử lại sau.',
          [{ text: 'OK' }]
        )
        break
        
      default:
        if (error.response.status >= 500) {
          Alert.alert(
            'Lỗi server',
            'Có lỗi xảy ra từ phía server. Vui lòng thử lại sau.',
            [{ text: 'OK' }]
          )
        }
    }

    return Promise.reject(error)
  }
)

export default axiosInstance