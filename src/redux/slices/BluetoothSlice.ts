import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { BleManager, Device } from 'react-native-ble-plx';
import { Platform, PermissionsAndroid } from 'react-native';

export interface BluetoothState {
  isScanning: boolean;
  isConnected: boolean;
  devices: Device[];
  selectedDevice: Device | null;
  logs: LogEntry[];
  error: string | null;
}

export interface LogEntry {
  id: string;
  message: string;
  timestamp: string;
}

const initialState: BluetoothState = {
  isScanning: false,
  isConnected: false,
  devices: [],
  selectedDevice: null,
  logs: [
    {
      id: 'log-1',
      message: 'Bluetooth manager initialized',
      timestamp: new Date().toLocaleTimeString(),
    },
  ],
  error: null,
};

const manager = new BleManager();

// Async thunks
export const requestBluetoothPermissions = createAsyncThunk(
  'bluetooth/requestPermissions',
  async (): Promise<void> => {
    if (Platform.OS === 'android') {
      await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      ]);
    }
  }
);

export const scanDevices = createAsyncThunk(
  'bluetooth/scanDevices',
  async (_, { dispatch, getState }) => {
    const state = getState() as { bluetooth: BluetoothState };
    
    dispatch(addLog({
      message: 'Scanning for devices...',
      timestamp: new Date().toLocaleTimeString(),
    }));

    return new Promise<Device[]>((resolve, reject) => {
      const devices: Device[] = [];
      
      manager.startDeviceScan(null, null, (error, device) => {
        if (error) {
          dispatch(addLog({
            message: `Error scanning devices: ${error.message}`,
            timestamp: new Date().toLocaleTimeString(),
          }));
          reject(error);
          return;
        }

        if (device && device.name?.includes('RFID')) {
          if (!devices.some(d => d.id === device.id)) {
            devices.push(device);
          }
        }
      });

      // Stop scanning after 5 seconds
      setTimeout(() => {
        manager.stopDeviceScan();
        dispatch(addLog({
          message: `Scan completed. Found ${devices.length} devices.`,
          timestamp: new Date().toLocaleTimeString(),
        }));
        resolve(devices);
      }, 5000);
    });
  }
);

export const connectToDevice = createAsyncThunk(
  'bluetooth/connectToDevice',
  async (device: Device, { dispatch, rejectWithValue }) => {
    try {
      dispatch(addLog({
        message: `Connecting to ${device.name ?? 'Unknown Device'}`,
        timestamp: new Date().toLocaleTimeString(),
      }));

      const connected = await device.connect();
      const updated = await connected.requestMTU(517);
      await updated.discoverAllServicesAndCharacteristics();

      dispatch(addLog({
        message: `Connected to ${device.name ?? 'Unknown Device'}`,
        timestamp: new Date().toLocaleTimeString(),
      }));

      return connected;
    } catch (error: any) {
      dispatch(addLog({
        message: `Failed to connect to device: ${error?.message || 'Unknown error'}`,
        timestamp: new Date().toLocaleTimeString(),
      }));
      return rejectWithValue(error.message);
    }
  }
);

export const disconnectDevice = createAsyncThunk(
  'bluetooth/disconnectDevice',
  async (_, { dispatch, getState }) => {
    const state = getState() as { bluetooth: BluetoothState };
    const device = state.bluetooth.selectedDevice;
    
    if (device) {
      try {
        await device.cancelConnection();
        dispatch(addLog({
          message: `Disconnected from ${device.name ?? 'Unknown Device'}`,
          timestamp: new Date().toLocaleTimeString(),
        }));
      } catch (error: any) {
        dispatch(addLog({
          message: `Error disconnecting: ${error?.message || 'Unknown error'}`,
          timestamp: new Date().toLocaleTimeString(),
        }));
      }
    }
  }
);

const bluetoothSlice = createSlice({
  name: 'bluetooth',
  initialState,
  reducers: {
    addLog: (state, action: PayloadAction<Omit<LogEntry, 'id'>>) => {
      const newLog: LogEntry = {
        id: `log-${state.logs.length + 1}`,
        ...action.payload,
      };
      state.logs.unshift(newLog);
    },
    clearLogs: (state) => {
      state.logs = [
        {
          id: 'log-1',
          message: 'Logs cleared',
          timestamp: new Date().toLocaleTimeString(),
        },
      ];
    },
    clearDevices: (state) => {
      state.devices = [];
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // Scan devices
      .addCase(scanDevices.pending, (state) => {
        state.isScanning = true;
        state.devices = [];
        state.error = null;
      })
      .addCase(scanDevices.fulfilled, (state, action) => {
        state.isScanning = false;
        state.devices = action.payload;
      })
      .addCase(scanDevices.rejected, (state, action) => {
        state.isScanning = false;
        state.error = action.error.message || 'Scan failed';
      })
      // Connect to device
      .addCase(connectToDevice.pending, (state) => {
        state.isConnected = false;
        state.error = null;
      })
      .addCase(connectToDevice.fulfilled, (state, action) => {
        state.isConnected = true;
        state.selectedDevice = action.payload;
      })
      .addCase(connectToDevice.rejected, (state, action) => {
        state.isConnected = false;
        state.error = action.payload as string;
      })
      // Disconnect device
      .addCase(disconnectDevice.fulfilled, (state) => {
        state.isConnected = false;
        state.selectedDevice = null;
      });
  },
});

export const { addLog, clearLogs, clearDevices, setError } = bluetoothSlice.actions;
export default bluetoothSlice.reducer;
