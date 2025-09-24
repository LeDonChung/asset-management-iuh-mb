import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axiosInstance from "../../lib/api";

interface FileState {
  files: any[];
  loading: boolean;
  error: string | null;
  inventoryImages: any[]; // Store uploaded images for inventory
}

const initialState: FileState = {
  files: [],
  loading: false,
  error: null,
  inventoryImages: [], // Store uploaded images for inventory
};

export const uploadInventoryImage = createAsyncThunk(
  "files/upload/inventory-image",
  async (file: any, { rejectWithValue }) => {
    try {
      if (!file) {
        throw new Error('No file provided');
      }

      const formData = new FormData();

      if (file.uri) {
        // Handle React Native file format
        formData.append('file', {
          uri: Platform.OS === 'android' && !file.uri.startsWith('file://') ? `file://${file.uri}` : file.uri,
          type: file.type || 'image/jpeg',
          name: file.name || `image_${Date.now()}.jpg`,
        });
      } else {
        // Handle web File format
        if (!(file instanceof File)) {
          throw new Error('Invalid file format for web');
        }
        formData.append('file', file);
      }

      console.log('Uploading inventory image:', {
        uri: file.uri,
        type: file.type,
        name: file.name,
        size: file.size,
      });

      const response = await axiosInstance.post(
        '/api/v1/files/upload/image',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          timeout: 30000, // 30 seconds
        }
      );

      if (!response.data?.url) {
        throw new Error('Invalid response format: missing URL');
      }

      return response.data;
    } catch (error: any) {
      console.error('Upload inventory image error:', error);
      
      // More detailed error logging
      if (error.code) {
        console.error('Error code:', error.code);
      }
      if (error.message) {
        console.error('Error message:', error.message);
      }
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
      if (error.request) {
        console.error('Request details:', error.request);
      }
      
      // Return more specific error information
      const errorInfo = {
        message: error.message || 'Upload failed',
        code: error.code,
        status: error.response?.status,
        data: error.response?.data,
        isNetworkError: !error.response && error.message === 'Network Error'
      };
      
      return rejectWithValue(errorInfo);
    }
  }
);

const fileSlice = createSlice({
  name: "files",
  initialState,
  reducers: {
    addInventoryImage: (state, action) => {
      state.inventoryImages.push(action.payload);
    },
    removeInventoryImage: (state, action) => {
      state.inventoryImages = state.inventoryImages.filter(
        (img, index) => index !== action.payload
      );
    },
    clearInventoryImages: (state) => {
      state.inventoryImages = [];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(uploadInventoryImage.pending, (state) => {
        state.loading = true;
      })
      .addCase(uploadInventoryImage.fulfilled, (state, action) => {
        state.loading = false;
        // Check if image already exists to avoid duplicates
        const existingImage = state.inventoryImages.find((img: any) => img.url === action.payload.url);
        if (!existingImage) {
          state.inventoryImages.push(action.payload);
        }
      })
      .addCase(uploadInventoryImage.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as any).message;
      });
  },
});

export const { addInventoryImage, removeInventoryImage, clearInventoryImages } = fileSlice.actions;

export default fileSlice.reducer;
