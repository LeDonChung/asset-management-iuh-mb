import { Picker } from '@react-native-picker/picker';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Text, View } from 'react-native';
import IconFeather from 'react-native-vector-icons/Feather';
import { DataTable } from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../redux/store';
import { DBMS } from '../utils/Dbm';
import { MODES } from '../utils/Mode';
import { Device } from 'react-native-ble-plx';
import { CHARACTERISTIC_UUID, SERVICE_UUID } from '../utils/BLE';
import { COMMANDS } from '../utils/Command';
import { resetAssets, resetTags, setAssets } from '../redux/slices/AssetSlice';

export const DemoScreen = () => {
  const deviceInfo = useSelector((state: RootState) => state.device.deviceInfo);
  const device = useSelector((state: RootState) => state.device.device);
  const [isScanning, setIsScanning] = useState(false);
  const [logs, setLogs] = useState<any[]>([
    {
      id: 'log-1',
      message: 'Device initialized',
      timestamp: new Date().toLocaleTimeString(),
    },
  ]);
  const dispatch = useDispatch();
  const handlerScan = () => {
    if (!device) {
      console.error('Device is not connected.');
      return;
    }
    setIsScanning(true);
    sendCommand(device, COMMANDS.cmdCustomizedSessionTargetInventoryStart);
  };
  const handlerStop = () => {
    if (!device) {
      console.error('Device is not connected.');
      return;
    }
    sendCommand(device, COMMANDS.cmdCustomizedSessionTargetInventoryStop);
    setIsScanning(false);
  };
  const handlerReset = () => {
    dispatch(resetTags());
    dispatch(resetAssets());
  };

  const sendCommand = async (
    device: Device,
    command: string,
    value: any = null,
  ) => {
    if (!device) {
      console.error('Device is not connected.');
      return;
    }

    try {
      const jsonPayload = { command, value };
      const jsonString = JSON.stringify(jsonPayload);
      const base64Data = Buffer.from(jsonString, 'utf-8').toString('base64');

      const services = await device.services();
      const service = services.find(s => s.uuid.toLowerCase() === SERVICE_UUID);
      if (!service) {
        setLogs(prevLogs => [
          {
            id: `log-${prevLogs.length + 1}`,
            message: 'Not found service UUID',
            timestamp: new Date().toLocaleTimeString(),
          },
          ...prevLogs,
        ]);
        return;
      }

      const characteristics = await service.characteristics();
      const characteristic = characteristics.find(
        c => c.uuid.toLowerCase() === CHARACTERISTIC_UUID,
      );
      if (!characteristic) {
        setLogs(prevLogs => [
          {
            id: `log-${prevLogs.length + 1}`,
            message: 'Not found characteristic UUID',
            timestamp: new Date().toLocaleTimeString(),
          },
          ...prevLogs,
        ]);
        return;
      }

      await characteristic.writeWithResponse(base64Data);
      setLogs(prevLogs => [
        {
          id: `log-${prevLogs.length + 1}`,
          message: `Command sent successfully: ${command} - ${JSON.stringify(
            jsonPayload,
          )}`,
          timestamp: new Date().toLocaleTimeString(),
        },
        ...prevLogs,
      ]);
    } catch (err: any) {
      console.error('❌ Gửi thất bại:', err?.message || 'Unknown error');
      setLogs(prevLogs => [
        {
          id: `log-${prevLogs.length + 1}`,
          message: `Failed to send command: ${err?.message || 'Unknown error'}`,
          timestamp: new Date().toLocaleTimeString(),
        },
        ...prevLogs,
      ]);
    }
  };

  const handlerStartAlert = () => {
    if (!device) {
      console.error('Device is not connected.');
      return;
    }
    sendCommand(device, COMMANDS.cmdSendAlertStart);
  };
  const handlerStopAlert = () => {
    if (!device) {
      console.error('Device is not connected.');
      return;
    }
    sendCommand(device, COMMANDS.cmdSendAlertStop);
  };
  return (
    <View>
      <TouchableOpacity
        style={{ padding: 10, backgroundColor: 'blue' }}
        onPress={handlerStartAlert}
      >
        <Text style={{ color: 'white' }}>Start Alert</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={{ padding: 10, backgroundColor: 'blue' }}
        onPress={handlerStopAlert}
      >
        <Text style={{ color: 'white' }}>Stop Alert</Text>
      </TouchableOpacity>
    </View>
  );
};
