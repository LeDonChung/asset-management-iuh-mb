import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Device } from 'react-native-ble-plx';
import { Buffer } from 'buffer';
import { MODES } from '../../utils/Mode';
import { CHARACTERISTIC_UUID, SERVICE_UUID } from '../../utils/BLE';
import { COMMANDS } from '../../utils/Command';

export interface DeviceInfo {
  id: string;
  firmware: string;
  power: number;
  temperature: number;
  currentMode: typeof MODES[0] | null;
}

export interface DeviceState {
  device: Device | null;
  deviceInfo: DeviceInfo;
  isFetching: boolean;
  buffer: string;
  regexTag: RegExp;
  isInventoryRunning: boolean;
  scannedTagsCount: number;
  scannedTagsMap: Record<string, number>;
}

const initialState: DeviceState = {
  device: null,
  deviceInfo: {
    id: 'Unknown',
    firmware: 'Unknown',
    power: 0,
    temperature: 0,
    currentMode: MODES[0],
  },
  isFetching: false,
  buffer: '',
  regexTag: /^E2[0-9A-F]{22}$/,
  isInventoryRunning: false,
  scannedTagsCount: 0,
  scannedTagsMap: {},
};

// Async thunks for device commands
export const sendCommand = createAsyncThunk(
  'device/sendCommand',
  async (
    { device, command, value }: { device: Device; command: string; value?: any },
    { dispatch, rejectWithValue }
  ) => {
    try {
      const jsonPayload = { command, value };
      const jsonString = JSON.stringify(jsonPayload);
      const base64Data = Buffer.from(jsonString, 'utf-8').toString('base64');

      const services = await device.services();
      const service = services.find(s => s.uuid.toLowerCase() === SERVICE_UUID);
      
      if (!service) {
        return rejectWithValue('Service UUID not found');
      }

      const characteristics = await service.characteristics();
      const characteristic = characteristics.find(
        c => c.uuid.toLowerCase() === CHARACTERISTIC_UUID,
      );
      
      if (!characteristic) {
        return rejectWithValue('Characteristic UUID not found');
      }

      await characteristic.writeWithResponse(base64Data);
      
      return {
        command,
        payload: jsonPayload,
        timestamp: new Date().toLocaleTimeString(),
      };
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchDeviceInformation = createAsyncThunk(
  'device/fetchDeviceInformation',
  async (device: Device, { dispatch }) => {
    const commands = [
      COMMANDS.getReaderIdentifier,
      COMMANDS.cmdGetFirmwareVersion,
      COMMANDS.cmdGetOutputPower,
      COMMANDS.cmdGetReaderTemperature,
      COMMANDS.cmdGetRfLinkProfile,
    ];

    const results = await Promise.all(
      commands.map(command => 
        dispatch(sendCommand({ device, command }))
      )
    );

    return results;
  }
);

export const setDevicePower = createAsyncThunk(
  'device/setDevicePower',
  async ({ device, power }: { device: Device; power: number }, { dispatch }) => {
    return dispatch(sendCommand({
      device,
      command: COMMANDS.cmdSetOutputPower,
      value: power,
    }));
  }
);

export const setDeviceMode = createAsyncThunk(
  'device/setDeviceMode',
  async ({ device, modeCode }: { device: Device; modeCode: string }, { dispatch }) => {
    return dispatch(sendCommand({
      device,
      command: COMMANDS.cmdSetRfLinkProfile,
      value: modeCode,
    }));
  }
);

export const startInventory = createAsyncThunk(
  'device/startInventory',
  async (device: Device, { dispatch }) => {
    return dispatch(sendCommand({
      device,
      command: COMMANDS.cmdCustomizedSessionTargetInventoryStart,
    }));
  }
);

export const stopInventory = createAsyncThunk(
  'device/stopInventory',
  async (device: Device, { dispatch }) => {
    return dispatch(sendCommand({
      device,
      command: COMMANDS.cmdCustomizedSessionTargetInventoryStop,
    }));
  }
);

export const startAlert = createAsyncThunk(
  'device/startAlert',
  async (device: Device, { dispatch }) => {
    return dispatch(sendCommand({
      device,
      command: COMMANDS.cmdSendAlertStart,
    }));
  }
);

export const stopAlert = createAsyncThunk(
  'device/stopAlert',
  async (device: Device, { dispatch }) => {
    return dispatch(sendCommand({
      device,
      command: COMMANDS.cmdSendAlertStop,
    }));
  }
);

export const setAlertSettings = createAsyncThunk(
  'device/setAlertSettings',
  async ({ device, settings }: { device: Device; settings: any }, { dispatch }) => {
    return dispatch(sendCommand({
      device,
      command: COMMANDS.cmdSendSettingAlert,
      value: settings,
    }));
  }
);

const deviceSlice = createSlice({
  name: 'device',
  initialState,
  reducers: {
    setDevice: (state, action: PayloadAction<Device>) => {
      state.device = action.payload;
    },
    setDeviceInfo: (state, action: PayloadAction<Partial<DeviceInfo>>) => {
      state.deviceInfo = { ...state.deviceInfo, ...action.payload };
    },
    updateBuffer: (state, action: PayloadAction<string>) => {
      state.buffer += action.payload;
    },
    clearBuffer: (state) => {
      state.buffer = '';
    },
    processResponse: (state, action: PayloadAction<any>) => {
      const json = action.payload;
      
      switch (json.cmd) {
        case COMMANDS.getReaderIdentifier:
          state.deviceInfo.id = json.value || 'Unknown';
          break;
        case COMMANDS.cmdGetFirmwareVersion:
          state.deviceInfo.firmware = json.value || 'Unknown';
          break;
        case COMMANDS.cmdGetOutputPower:
        case COMMANDS.cmdSetOutputPower:
          state.deviceInfo.power = json.value || 0;
          break;
        case COMMANDS.cmdGetReaderTemperature:
          state.deviceInfo.temperature = Number(json.value) || 0;
          break;
        case COMMANDS.cmdGetRfLinkProfile:
        case COMMANDS.cmdSetRfLinkProfile:
          const mode = MODES.find((m: any) => m.code === json.value?.toUpperCase());
          state.deviceInfo.currentMode = mode ?? state.deviceInfo.currentMode;
          break;
        case COMMANDS.cmdCustomizedSessionTargetInventoryStart:
          // Handle inventory tags from JSON response
          if (json.tags && Array.isArray(json.tags) && json.tags.length > 0) {
            json.tags.forEach((tag: string) => {
              if (state.scannedTagsMap[tag]) {
                state.scannedTagsMap[tag] += 1;
              } else {
                state.scannedTagsMap[tag] = 1;
              }
            });
            state.scannedTagsCount += json.tags.length;
          }
          break;
        case COMMANDS.cmdCustomizedSessionTargetInventoryStop:
          // Handle inventory stop
          break;
      }
    },
    resetDeviceInfo: (state) => {
      state.deviceInfo = {
        id: 'Unknown',
        firmware: 'Unknown',
        power: 0,
        temperature: 0,
        currentMode: MODES[0],
      };
    },
    setInventoryRunning: (state, action: PayloadAction<boolean>) => {
      state.isInventoryRunning = action.payload;
    },
    incrementScannedTagsCount: (state) => {
      state.scannedTagsCount += 1;
    },
    resetScannedTagsCount: (state) => {
      state.scannedTagsCount = 0;
    },
    addScannedTag: (state, action: PayloadAction<string>) => {
      const tag = action.payload;
      if (state.scannedTagsMap[tag]) {
        state.scannedTagsMap[tag] += 1;
      } else {
        state.scannedTagsMap[tag] = 1;
      }
      state.scannedTagsCount += 1;
    },
    batchAddScannedTags: (state, action: PayloadAction<string[]>) => {
      const tags = action.payload;
      tags.forEach(tag => {
        if (state.scannedTagsMap[tag]) {
          state.scannedTagsMap[tag] += 1;
        } else {
          state.scannedTagsMap[tag] = 1;
        }
      });
      state.scannedTagsCount += tags.length;
    },
    resetScannedTagsMap: (state) => {
      state.scannedTagsMap = {};
      state.scannedTagsCount = 0;
    },
  },
  extraReducers: (builder) => {
    builder
      // Send command
      .addCase(sendCommand.pending, (state) => {
        state.isFetching = true;
      })
      .addCase(sendCommand.fulfilled, (state, action) => {
        state.isFetching = false;
      })
      .addCase(sendCommand.rejected, (state, action) => {
        state.isFetching = false;
      })
      // Fetch device information
      .addCase(fetchDeviceInformation.pending, (state) => {
        state.isFetching = true;
      })
      .addCase(fetchDeviceInformation.fulfilled, (state) => {
        state.isFetching = false;
      })
      .addCase(fetchDeviceInformation.rejected, (state) => {
        state.isFetching = false;
      })
      // Set device power
      .addCase(setDevicePower.fulfilled, (state, action) => {
        // Power will be updated when response is received
      })
      // Set device mode
      .addCase(setDeviceMode.fulfilled, (state, action) => {
        // Mode will be updated when response is received
      })
      // Start inventory
      .addCase(startInventory.pending, (state) => {
        state.isInventoryRunning = true;
      })
      .addCase(startInventory.fulfilled, (state) => {
        // Inventory started successfully
      })
      .addCase(startInventory.rejected, (state) => {
        state.isInventoryRunning = false;
      })
      // Stop inventory
      .addCase(stopInventory.pending, (state) => {
        state.isInventoryRunning = false;
      })
      .addCase(stopInventory.fulfilled, (state) => {
        // Inventory stopped successfully
      });
  },
});

export const {
  setDevice,
  setDeviceInfo,
  updateBuffer,
  clearBuffer,
  processResponse,
  resetDeviceInfo,
  setInventoryRunning,
  incrementScannedTagsCount,
  resetScannedTagsCount,
  addScannedTag,
  batchAddScannedTags,
  resetScannedTagsMap,
} = deviceSlice.actions;

export default deviceSlice.reducer;
