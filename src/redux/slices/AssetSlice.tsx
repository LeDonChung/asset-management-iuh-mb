import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';
import axiosInstance from '../../lib/api';

interface Asset {
  id: number;
  name: string;
  rfid: string;
}

interface UnidentifiedAssetFilter {
  pagination: {
    currentPage: number;
    itemsPerPage: number;
  };
  sorting: any[];
  conditions: any[];
}

interface UnidentifiedAssetResponse {
  data: Asset[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const initialState: { 
  assets: Asset[]; 
  tags: string[]; 
  unidentifiedAssets: UnidentifiedAssetResponse;
  loading: boolean;
} = {
  assets: [],
  tags: [],
  unidentifiedAssets: {
    data: [],
    pagination: {
      page: 1,
      limit: 10,
      total: 0,
      totalPages: 0,
    },
  },
  loading: false,
};

const patchAssetByRfids = createAsyncThunk<Asset[], string[]>(
  'assets/patchByRfids',
  async (rfids, thunkAPI) => {
    try {
      const response = await axiosInstance.patch<Asset[]>(
        '/api/v1/assets/rfid/batch',
        rfids,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
      return response.data;
    } catch (error: any) {
      return thunkAPI.rejectWithValue(error.response?.data || 'Unknown error');
    }
  },
);

const fetchUnidentifiedAssets = createAsyncThunk<UnidentifiedAssetResponse, UnidentifiedAssetFilter>(
  'assets/fetchUnidentifiedAssets',
  async (filter, thunkAPI) => {
    try {
      const response = await axiosInstance.post<UnidentifiedAssetResponse>(
        '/api/v1/assets/unidentified',
        filter,
      );
      return response.data;
    } catch (error: any) {
      return thunkAPI.rejectWithValue(error.response?.data || 'Unknown error');
    }
  },
);

export const AssetSlice = createSlice({
  name: 'assets',
  initialState,
  reducers: {
    addAsset: (state, action: PayloadAction<Asset>) => {
      state.assets.push(action.payload);
    },
    resetAssets: state => {
      state.assets = [];
    },
    removeAsset: (state, action: PayloadAction<number>) => {
      state.assets = state.assets.filter(asset => asset.id !== action.payload);
    },
    addTag: (state, action: PayloadAction<string>) => {
      state.tags.push(action.payload);
    },
    removeTag: (state, action: PayloadAction<string>) => {
      state.tags = state.tags.filter(tag => tag !== action.payload);
    },
    setAssets: (state, action: PayloadAction<Asset[]>) => {
      state.assets = action.payload;
    },
    setTags: (state, action: PayloadAction<string[]>) => {
      const newTags = action.payload.filter(tag => !state.tags.includes(tag));
      state.tags = [...state.tags, ...newTags];
    },
    resetTags: state => {
      state.tags = [];
    },
  },
  extraReducers: builder => {
    builder
      .addCase(patchAssetByRfids.fulfilled, (state, action) => {
        // Kiểm tra xem action.payload có trùng với bất kỳ asset nào trong state.assets không
        const updatedAssets = action.payload;
        updatedAssets.forEach(updatedAsset => {
          const existingAssetIndex = state.assets.findIndex(
            asset => asset.id === updatedAsset.id,
          );
          if (existingAssetIndex !== -1) {
            state.assets[existingAssetIndex] = updatedAsset;
          } else {
            state.assets.push(updatedAsset);
          }
        });
      })
      .addCase(fetchUnidentifiedAssets.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchUnidentifiedAssets.fulfilled, (state, action) => {
        state.loading = false;
        state.unidentifiedAssets = action.payload;
      })
      .addCase(fetchUnidentifiedAssets.rejected, (state) => {
        state.loading = false;
      });
  },
});

export const {
  addAsset,
  removeAsset,
  setAssets,
  addTag,
  removeTag,
  setTags,
  resetAssets,
  resetTags,
} = AssetSlice.actions;
export { patchAssetByRfids, fetchUnidentifiedAssets };
export default AssetSlice.reducer;
