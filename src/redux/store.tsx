import { configureStore } from '@reduxjs/toolkit';
import { CounterSlice } from './slices/CouterSlice';
import DeviceSlice from './slices/DeviceSlice';
import BluetoothSlice from './slices/BluetoothSlice';
import { AssetSlice } from './slices/AssetSlice';
import AuthSlice from './slices/AuthSlice';
import InventorySlice from './slices/InventorySlice';
import AssetBookSlice from './slices/AssetBookSlice';
import FileSlice from './slices/FileSlice';
export const store = configureStore({
  reducer: {
    auth: AuthSlice,
    assets: AssetSlice.reducer,
    couter: CounterSlice.reducer,
    device: DeviceSlice,
    bluetooth: BluetoothSlice,
    inventory: InventorySlice,
    assetBook: AssetBookSlice,
    file: FileSlice
  },
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
