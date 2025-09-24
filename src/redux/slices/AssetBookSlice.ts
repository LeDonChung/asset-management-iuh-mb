import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { AssetBook, AssetBookItem, AssetBookStatus, AssetType } from "../../types";
import axiosInstance from "../../lib/api";

interface AssetBookInventory extends AssetBook {
  assetTypes: [
    {   
      type: AssetType;
      items: AssetBookItem[];
    }
  ];
}
interface AssetState {
  assetBookInventory: AssetBookInventory | null;
  loading: boolean;
  error: string | null;
}

const initialState: AssetState = {
  assetBookInventory: null,
  loading: false,
  error: null,
};

export const getAssetBookInventoryFromUnitIdAndRoomId = createAsyncThunk(
  "assetBook/getAssetBookInventoryFromUnitIdAndRoomId",
  async (params: { unitId: string; roomId: string }) => {
    const response = await axiosInstance.get(
      `/api/v1/asset-books/unit/${params.unitId}/room/${params.roomId}`
    );
    return response.data;
  }
);

const assetBookSlice = createSlice({
  name: "assetBook",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(getAssetBookInventoryFromUnitIdAndRoomId.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getAssetBookInventoryFromUnitIdAndRoomId.fulfilled, (state, action) => {
        state.loading = false;
        state.assetBookInventory = action.payload;
        state.error = null;
      })
      .addCase(getAssetBookInventoryFromUnitIdAndRoomId.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to load asset book inventory';
      });
  },
});

export const {} = assetBookSlice.actions;

export default assetBookSlice.reducer;
