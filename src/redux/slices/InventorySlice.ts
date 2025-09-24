import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { Asset, InventoryGroupAssignment, InventorySession, Room } from "../../types";
import axiosInstance from "../../lib/api";

// Inventory API DTOs and Enums
export enum AssetActionStatus {
  MATCHED = 'MATCHED',
  MISSING = 'MISSING',
  EXCESS = 'EXCESS',
  BROKEN = 'BROKEN',
  NEEDS_REPAIR = 'NEEDS_REPAIR',
  LIQUIDATION_PROPOSED = 'LIQUIDATION_PROPOSED'
}

export enum ScanMethod {
  RFID = 'RFID',
  MANUAL = 'MANUAL'
}

export interface AssetInventoryDetail {
  quantity: number;
  status: AssetActionStatus;
  note?: string;
  imageUrls?: string[];
  updatedAt: string;
}

export interface SaveTempInventoryRequest {
  roomId: string;
  unitId: string;
  sessionId: string;
  inventoryResults: { [assetId: string]: AssetInventoryDetail };
  note?: string;
  ttlSeconds?: number;
}

export interface TempInventoryResponse {
  roomId: string;
  unitId: string;
  sessionId: string;
  inventoryResults: { [assetId: string]: AssetInventoryDetail };
  note?: string;
  createdAt: string;
  expiresAt: string;
  ttl: number;
  totalAssets: number;
  matchedAssets: number;
  missingAssets: number;
  excessAssets: number;
  brokenAssets: number;
  needsRepairAssets: number;
  liquidationProposedAssets: number;
}

// Submit Inventory Result Types
export interface SubmitInventoryResultItem {
  assetId: string;
  roomId: string;
  systemQuantity: number;
  countedQuantity: number;
  scanMethod: ScanMethod;
  status: AssetActionStatus;
  note?: string;
  imageUrls?: string[];
}

export interface SubmitInventoryResultRequest {
  assignmentId: string;
  results: SubmitInventoryResultItem[];
  note?: string;
}

export interface SubmittedInventoryResultItem {
  id: string;
  assetId: string;
  roomId: string;
  systemQuantity: number;
  countedQuantity: number;
  scanMethod: ScanMethod;
  status: AssetActionStatus;
  note: string;
  imageUrls: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface SubmitInventoryResultResponse {
  assignmentId: string;
  results: SubmittedInventoryResultItem[];
  note: string;
  totalResults: number;
  statistics: {
    totalAssets: number;
    matchedAssets: number;
    missingAssets: number;
    excessAssets: number;
    brokenAssets: number;
    needsRepairAssets: number;
    liquidationProposedAssets: number;
  };
  submittedAt: string;
}

export interface RoomInventoryStatus {
  roomId: string;
  status: boolean;
}
export interface ClassifyRfidsRequest {
  rfids: string[];
  currentRoomId: string;
  currentUnitId: string;
}

export interface ClassifyRfidsResponse {
  matched: Asset[]; 
  neighbors: Asset[];
  otherRooms: Asset[];
  unknowns: string[];
}
interface InventoryState {
  // Inventory perform states
  assignedInventories: InventorySession[];
  assignedGroups: InventoryGroupAssignment[];
  roomsInventoryStatus: RoomInventoryStatus[];
  unitRooms: Room[];
  loading: boolean;
  error: string | null;

  // Temporary inventory results state
  tempResults: TempInventoryResponse | null;
  tempResultsLoading: boolean;
  tempResultsError: string | null;
  saveTempResultsLoading: boolean;
  deleteTempResultsLoading: boolean;

  // Room inventory results state
  roomInventoryResults: TempInventoryResponse[];
  roomInventoryResultsLoading: boolean;
  roomInventoryResultsError: string | null;

  // Submit result states
  submitResultLoading: boolean;
  submitResultError: string | null;
  lastSubmittedResult: SubmitInventoryResultResponse | null;

  // Device control state
  selectedDevice: string | null;
  availableDevices: Array<{
    id: string;
    name: string;
    type: string;
    status: "online" | "offline" | "busy";
    signal: number;
    lastSeen: Date;
  }>;
  rfidConnected: boolean;
  scanning: boolean;

  // RFID classification state
  classifyRfidsResult: ClassifyRfidsResponse | null;
  classifyRfidsLoading: boolean;
  classifyRfidsError: string | null;
}

const initialState: InventoryState = {
  // Inventory perform states
  assignedInventories: [],
  assignedGroups: [],
  roomsInventoryStatus: [],
  unitRooms: [],
  loading: false,
  error: null,

  // Temporary inventory results state
  tempResults: null,
  tempResultsLoading: false,
  tempResultsError: null,
  saveTempResultsLoading: false,
  deleteTempResultsLoading: false,

  // Room inventory results state
  roomInventoryResults: [],
  roomInventoryResultsLoading: false,
  roomInventoryResultsError: null,

  // Submit result states
  submitResultLoading: false,
  submitResultError: null,
  lastSubmittedResult: null,

  // Device control state
  selectedDevice: null,
  availableDevices: [
    {
      id: "rfid-001",
      name: "RFID Reader #001",
      type: "Handheld",
      status: "online",
      signal: 85,
      lastSeen: new Date(),
    },
    {
      id: "rfid-002",
      name: "RFID Reader #002",
      type: "Desktop",
      status: "offline",
      signal: 0,
      lastSeen: new Date(Date.now() - 300000),
    },
  ],
  rfidConnected: false,
  scanning: false,

  // RFID classification state
  classifyRfidsResult: null,
  classifyRfidsLoading: false,
  classifyRfidsError: null,
};

export const getAssignedMembersInSession = createAsyncThunk(
  "inventory-session/getAssignedMembersInSession",
  async (
    { sessionId, groupId }: { sessionId: string; groupId: string },
    { rejectWithValue }
  ) => {
    try {
      const response = await axiosInstance.get(
        `/api/v1/inventories/${sessionId}/assigned-members/${groupId}`
      );
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const getAssignedInventories = createAsyncThunk(
  "inventory-session/getAssignedInventories",
  async (_, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get("/api/v1/inventories/assigned");
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const getUnitRooms = createAsyncThunk(
  "inventory-session/getUnitRooms",
  async (unitId: string, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get(`/api/v1/units/${unitId}`);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const getRoomsInventoryStatus = createAsyncThunk(
  "inventory-session/getRoomsInventoryStatus",
  async (assignmentId: string, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get(`/api/v1/inventories/rooms-inventory-status/${assignmentId}`);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Temporary inventory results API calls
export const saveTempInventoryResults = createAsyncThunk(
  "inventory/saveTempInventoryResults",
  async (data: SaveTempInventoryRequest, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.post('/api/v1/inventories/temp-results', data);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const getTempInventoryResults = createAsyncThunk(
  "inventory/getTempResults",
  async (roomId: string, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get(`/api/v1/inventories/temp-results/${roomId}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const deleteTempInventoryResults = createAsyncThunk(
  "inventory/deleteTempResults",
  async (roomId: string, { rejectWithValue }) => {
    try {
      await axiosInstance.delete(`/api/v1/inventories/temp-results/${roomId}`);
      return roomId;
    } catch (error: any) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const getAllTempInventoryResults = createAsyncThunk(
  "inventory/getAllTempResults",
  async (_, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get('/api/v1/inventories/temp-results');
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Room inventory results API calls
export const getRoomInventoryResults = createAsyncThunk(
  "inventory/getRoomInventoryResults",
  async ({ roomId, assignmentId }: { roomId: string; assignmentId: string }, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get(`/api/v1/inventories/room-inventory-results/${roomId}/${assignmentId}`);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Submit inventory result
export const submitInventoryResult = createAsyncThunk(
  "inventory/submitResult",
  async (data: SubmitInventoryResultRequest, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.post('/api/v1/inventories/submit-result', data);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const classifyRfids = createAsyncThunk(
  "inventory/classifyRfids",
  async (data: ClassifyRfidsRequest, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.post('/assets/rfid/classify', data);
      return response.data as ClassifyRfidsResponse;
    } catch (error: any) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

const inventorySlice = createSlice({
  name: "inventory",
  initialState,
  reducers: {
    // Device control actions
    setSelectedDevice: (state, action) => {
      state.selectedDevice = action.payload;
    },
    setRfidConnected: (state, action) => {
      state.rfidConnected = action.payload;
    },
    setScanning: (state, action) => {
      state.scanning = action.payload;
    },
    
    // RFID classification actions
    setClassifyRfidsResult: (state, action) => {
      state.classifyRfidsResult = action.payload;
    },
    clearClassifyRfidsResult: (state) => {
      state.classifyRfidsResult = null;
    },
    setClassifyRfidsLoading: (state, action) => {
      state.classifyRfidsLoading = action.payload;
    },
    clearClassifyRfidsError: (state) => {
      state.classifyRfidsError = null;
    },
    updateDeviceStatus: (state, action) => {
      const { deviceId, status } = action.payload;
      const device = state.availableDevices.find(d => d.id === deviceId);
      if (device) {
        device.status = status;
        device.lastSeen = new Date();
      }
    },
    addAvailableDevice: (state, action) => {
      state.availableDevices.push(action.payload);
    },
    removeAvailableDevice: (state, action) => {
      state.availableDevices = state.availableDevices.filter(d => d.id !== action.payload);
    },

    // Inventory results actions
    setTempResults: (state, action) => {
      state.tempResults = action.payload;
    },
    clearTempResults: (state) => {
      state.tempResults = null;
    },
    setRoomInventoryResults: (state, action) => {
      state.roomInventoryResults = action.payload;
    },
    clearRoomInventoryResults: (state) => {
      state.roomInventoryResults = [];
    },
    clearTempResultsError: (state) => {
      state.tempResultsError = null;
    },
    clearRoomInventoryResultsError: (state) => {
      state.roomInventoryResultsError = null;
    },
    clearSubmitResultError: (state) => {
      state.submitResultError = null;
    },
    clearLastSubmittedResult: (state) => {
      state.lastSubmittedResult = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Inventory perform actions
      .addCase(getAssignedInventories.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getAssignedInventories.fulfilled, (state, action) => {
        state.loading = false;
        state.assignedInventories = action.payload;
        state.error = null;
      })
      .addCase(getAssignedInventories.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string || 'Có lỗi xảy ra khi tải danh sách kỳ kiểm kê';
      })
      .addCase(getAssignedMembersInSession.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getAssignedMembersInSession.fulfilled, (state, action) => {
        state.loading = false;
        state.assignedGroups = action.payload;
        state.error = null;
      })
      .addCase(getAssignedMembersInSession.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string || 'Có lỗi xảy ra khi tải danh sách nhóm';
      })
      .addCase(getUnitRooms.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getUnitRooms.fulfilled, (state, action) => {
        state.loading = false;
        state.unitRooms = action.payload?.rooms || [];
        state.error = null;
      })
      .addCase(getUnitRooms.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string || 'Có lỗi xảy ra khi tải danh sách phòng';
      })
      .addCase(getRoomsInventoryStatus.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getRoomsInventoryStatus.fulfilled, (state, action) => {
        state.loading = false;
        state.roomsInventoryStatus = action.payload;
        state.error = null;
      })
      .addCase(getRoomsInventoryStatus.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string || 'Có lỗi xảy ra khi tải trạng thái kiểm kê của các phòng';
      })

      // Temporary inventory results actions
      .addCase(saveTempInventoryResults.pending, (state) => {
        state.saveTempResultsLoading = true;
        state.tempResultsError = null;
      })
      .addCase(saveTempInventoryResults.fulfilled, (state, action) => {
        state.saveTempResultsLoading = false;
        state.tempResultsError = null;
        state.tempResults = action.payload;
      })
      .addCase(saveTempInventoryResults.rejected, (state, action) => {
        state.saveTempResultsLoading = false;
        state.tempResultsError = action.payload as string || 'Lưu kết quả tạm thời thất bại';
      })

      .addCase(getTempInventoryResults.pending, (state) => {
        state.tempResultsLoading = true;
        state.tempResultsError = null;
      })
      .addCase(getTempInventoryResults.fulfilled, (state, action) => {
        state.tempResultsLoading = false;
        state.tempResultsError = null;
        state.tempResults = action.payload;
      })
      .addCase(getTempInventoryResults.rejected, (state, action) => {
        state.tempResultsLoading = false;
        state.tempResultsError = action.payload as string || 'Lấy kết quả tạm thời thất bại';
      })

      .addCase(deleteTempInventoryResults.pending, (state) => {
        state.deleteTempResultsLoading = true;
        state.tempResultsError = null;
      })
      .addCase(deleteTempInventoryResults.fulfilled, (state, action) => {
        state.deleteTempResultsLoading = false;
        state.tempResultsError = null;
        state.tempResults = null;
      })
      .addCase(deleteTempInventoryResults.rejected, (state, action) => {
        state.deleteTempResultsLoading = false;
        state.tempResultsError = action.payload as string || 'Xóa kết quả tạm thời thất bại';
      })

      .addCase(getAllTempInventoryResults.pending, (state) => {
        state.tempResultsLoading = true;
        state.tempResultsError = null;
      })
      .addCase(getAllTempInventoryResults.fulfilled, (state, action) => {
        state.tempResultsLoading = false;
        state.tempResultsError = null;
        // This would typically be stored in a different state for all temp results
      })
      .addCase(getAllTempInventoryResults.rejected, (state, action) => {
        state.tempResultsLoading = false;
        state.tempResultsError = action.payload as string || 'Lấy tất cả kết quả tạm thời thất bại';
      })

      // Room inventory results actions
      .addCase(getRoomInventoryResults.pending, (state) => {
        state.roomInventoryResultsLoading = true;
        state.roomInventoryResultsError = null;
      })
      .addCase(getRoomInventoryResults.fulfilled, (state, action) => {
        state.roomInventoryResultsLoading = false;
        state.roomInventoryResultsError = null;
        state.roomInventoryResults = action.payload;
      })
      .addCase(getRoomInventoryResults.rejected, (state, action) => {
        state.roomInventoryResultsLoading = false;
        state.roomInventoryResultsError = action.payload as string || 'Lấy kết quả kiểm kê phòng thất bại';
      })

      // Submit inventory result actions
      .addCase(submitInventoryResult.pending, (state) => {
        state.submitResultLoading = true;
        state.submitResultError = null;
      })
      .addCase(submitInventoryResult.fulfilled, (state, action) => {
        state.submitResultLoading = false;
        state.submitResultError = null;
        state.lastSubmittedResult = action.payload;
      })
      .addCase(submitInventoryResult.rejected, (state, action) => {
        state.submitResultLoading = false;
        state.submitResultError = action.payload as string || 'Gửi kết quả kiểm kê thất bại';
      })

      // RFID classification actions
      .addCase(classifyRfids.pending, (state) => {
        state.classifyRfidsLoading = true;
        state.classifyRfidsError = null;
      })
      .addCase(classifyRfids.fulfilled, (state, action) => {
        state.classifyRfidsLoading = false;
        // Sử dụng pushClassifyRfidsResult để merge data thay vì ghi đè
        const newResult = action.payload;
        
        if (!state.classifyRfidsResult) {
          state.classifyRfidsResult = newResult;
        } else {
          // Map hiện tại để tránh trùng
          const existingMatched = new Set(state.classifyRfidsResult.matched.map((item: any) => item.id));
          const existingNeighbors = new Set(state.classifyRfidsResult.neighbors.map((item: any) => item.id));
          const existingOtherRooms = new Set(state.classifyRfidsResult.otherRooms.map((item: any) => item.id));
          const existingUnknowns = new Set(state.classifyRfidsResult.unknowns);
        
          // Push từng item mới vào mảng (không trùng)
          newResult.matched.forEach((item: any) => {
            if (!existingMatched.has(item.id)) {
              state.classifyRfidsResult?.matched.push(item);
              existingMatched.add(item.id);
            }
          });
        
          newResult.neighbors.forEach((item: any) => {
            if (!existingNeighbors.has(item.id)) {
              state.classifyRfidsResult?.neighbors.push(item);
              existingNeighbors.add(item.id);
            }
          });
        
          newResult.otherRooms.forEach((item: any) => {
            if (!existingOtherRooms.has(item.id)) {
              state.classifyRfidsResult?.otherRooms.push(item);
              existingOtherRooms.add(item.id);
            }
          });
        
          newResult.unknowns.forEach((item: any) => {
            if (!existingUnknowns.has(item)) {
              state.classifyRfidsResult?.unknowns.push(item);
              existingUnknowns.add(item);
            }
          });
        }
        state.classifyRfidsError = null;
      })
      .addCase(classifyRfids.rejected, (state, action) => {
        state.classifyRfidsLoading = false;
        state.classifyRfidsError = action.payload as string;
      })
  },
});

export const {
  // Device control actions
  setSelectedDevice,
  setRfidConnected,
  setScanning,
  updateDeviceStatus,
  addAvailableDevice,
  removeAvailableDevice,
  
  // Inventory results actions
  setTempResults,
  clearTempResults,
  setRoomInventoryResults,
  clearRoomInventoryResults,
  clearTempResultsError,
  clearRoomInventoryResultsError,
  clearSubmitResultError,
  clearLastSubmittedResult,
  
  // RFID classification actions
  setClassifyRfidsResult,
  clearClassifyRfidsResult,
  setClassifyRfidsLoading,
  clearClassifyRfidsError,
} = inventorySlice.actions;
export default inventorySlice.reducer
