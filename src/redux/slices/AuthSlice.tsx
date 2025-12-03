import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import { tokenStorage, userStorage } from "../../lib/storage";
import axiosInstance from "../../lib/api";

export interface UserLoginResponse {
  id: string;
  username: string;
  email?: string;
  phoneNumber?: string;
  birthDate?: string;
  fullName: string;
  roles: string[];
  permissions: string[];
}

export interface UserLogin {
  user: UserLoginResponse;
  token: string;
}

interface AuthState {
  userLogin: UserLogin | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  loginSuccess: boolean;
}

// Helper functions for React Native storage
const saveUserToStorage = async (user: UserLoginResponse) => {
  await userStorage.setUser(user)
}

const saveTokenToStorage = async (token: string) => {
  await tokenStorage.setToken(token)
}

const getTokenFromStorage = async (): Promise<string | null> => {
  return await tokenStorage.getToken()
}

const getUserFromStorage = async (): Promise<UserLoginResponse | null> => {
  return await userStorage.getUser()
}

const clearAuthStorage = async () => {
  await tokenStorage.removeToken()
  await userStorage.removeUser()
}

// Initial state (will be updated when storage is loaded)
const initialState: AuthState = {
  userLogin: null,
  token: null,
  loading: false,
  error: null,
  isAuthenticated: false,
  loginSuccess: false,
}
interface UserLoginPayload {
  username: string;
  password: string;
}

export const login = createAsyncThunk(
  'auth/login', 
  async (loginData: UserLoginPayload, { rejectWithValue }) => {
    try {
      console.log(axiosInstance.defaults.baseURL)
      const response = await axiosInstance.post('/api/v1/auth/login', loginData)
      console.log("hi")
      return response.data;
    } catch (error: any) {
      console.log(error)
        return rejectWithValue(error.response?.data || { message: 'Login failed' })
    }
  }
)

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null
    },
    clearLoginSuccess: (state) => {
      state.loginSuccess = false
    },
    logout: (state) => {
      state.userLogin = null
      state.token = null
      state.isAuthenticated = false
      state.loginSuccess = false
      state.error = null
      // Xóa khỏi storage
      clearAuthStorage()
    },
    setCredentials: (state, action: PayloadAction<UserLogin>) => {
      state.userLogin = action.payload
      state.token = action.payload.token
      state.isAuthenticated = true
      state.loginSuccess = true
      // Lưu vào storage
      saveTokenToStorage(action.payload.token)
      saveUserToStorage(action.payload.user)
    }
  },
  extraReducers: (builder) => {
    builder.addCase(login.pending, (state) => {
      state.loading = true
      state.error = null
      state.loginSuccess = false
    })
    builder.addCase(login.fulfilled, (state, action) => {
      state.loading = false
      state.userLogin = action.payload
      state.token = action.payload.token
      state.isAuthenticated = true
      state.loginSuccess = true
      state.error = null
      // Lưu vào storage
      saveTokenToStorage(action.payload.token)
      saveUserToStorage(action.payload.user)
    })
    builder.addCase(login.rejected, (state, action) => {
      console.log(action.payload)
      state.loading = false
      state.error = (action.payload as any)?.message || 'Login failed'
      state.isAuthenticated = false
      state.loginSuccess = false
      // Xóa storage khi login thất bại
      clearAuthStorage()
    })
  }
})

export const { clearError, clearLoginSuccess, logout, setCredentials } = authSlice.actions
export default authSlice.reducer
