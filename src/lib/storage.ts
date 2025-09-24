import AsyncStorage from '@react-native-async-storage/async-storage'
import { UserLoginResponse } from '../redux/slices/AuthSlice'

// Storage keys
const STORAGE_KEYS = {
  TOKEN: 'token',
  USER: 'user',
  REFRESH_TOKEN: 'refreshToken',
  SETTINGS: 'settings',
} as const

// Token management
export const tokenStorage = {
  async getToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.TOKEN)
    } catch (error) {
      console.error('Error getting token:', error)
      return null
    }
  },

  async setToken(token: string): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.TOKEN, token)
    } catch (error) {
      console.error('Error setting token:', error)
    }
  },

  async removeToken(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.TOKEN)
    } catch (error) {
      console.error('Error removing token:', error)
    }
  },
}

// User management
export const userStorage = {
  async getUser(): Promise<UserLoginResponse | null> {
    try {
      const userString = await AsyncStorage.getItem(STORAGE_KEYS.USER)
      return userString ? JSON.parse(userString) : null
    } catch (error) {
      console.error('Error getting user:', error)
      return null
    }
  },

  async setUser(user: UserLoginResponse): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user))
    } catch (error) {
      console.error('Error setting user:', error)
    }
  },

  async removeUser(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.USER)
    } catch (error) {
      console.error('Error removing user:', error)
    }
  },
}

// Refresh token management
export const refreshTokenStorage = {
  async getRefreshToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN)
    } catch (error) {
      console.error('Error getting refresh token:', error)
      return null
    }
  },

  async setRefreshToken(token: string): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, token)
    } catch (error) {
      console.error('Error setting refresh token:', error)
    }
  },

  async removeRefreshToken(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN)
    } catch (error) {
      console.error('Error removing refresh token:', error)
    }
  },
}

// Settings management
export const settingsStorage = {
  async getSettings(): Promise<any | null> {
    try {
      const settingsString = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS)
      return settingsString ? JSON.parse(settingsString) : null
    } catch (error) {
      console.error('Error getting settings:', error)
      return null
    }
  },

  async setSettings(settings: any): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings))
    } catch (error) {
      console.error('Error setting settings:', error)
    }
  },

  async removeSettings(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.SETTINGS)
    } catch (error) {
      console.error('Error removing settings:', error)
    }
  },
}

// Clear all auth data
export const clearAuthData = async (): Promise<void> => {
  try {
    await Promise.all([
      tokenStorage.removeToken(),
      userStorage.removeUser(),
      refreshTokenStorage.removeRefreshToken(),
    ])
  } catch (error) {
    console.error('Error clearing auth data:', error)
  }
}

// Clear all data
export const clearAllData = async (): Promise<void> => {
  try {
    await AsyncStorage.clear()
  } catch (error) {
    console.error('Error clearing all data:', error)
  }
}
