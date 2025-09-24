import { Picker } from '@react-native-picker/picker';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Text, View } from 'react-native';
import IconFeather from 'react-native-vector-icons/Feather';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AntDesign from 'react-native-vector-icons/AntDesign';
import { DataTable } from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../redux/store';
import { DBMS } from '../utils/Dbm';
import { MODES } from '../utils/Mode';
import { setDeviceInfo } from '../redux/slices/DeviceSlice';
import { Device } from 'react-native-ble-plx';
import { CHARACTERISTIC_UUID, SERVICE_UUID } from '../utils/BLE';
import { COMMANDS } from '../utils/Command';
import { resetAssets, resetTags, setAssets } from '../redux/slices/AssetSlice';

export const InventoryScreen = () => {
  const tags = useSelector((state: RootState) => state.assets.tags);
  const assets = useSelector((state: RootState) => state.assets.assets);
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
      setLogs(prevLogs => [
        {
          id: `log-${prevLogs.length + 1}`,
          message: 'Please connect to a device first.',
          timestamp: new Date().toLocaleTimeString(),
        },
        ...prevLogs,
      ]);
      return;
    }
    setIsScanning(true);
    sendCommand(device, COMMANDS.cmdCustomizedSessionTargetInventoryStart);
  };
  const handlerStop = () => {
    if (!device) {
      setLogs(prevLogs => [
        {
          id: `log-${prevLogs.length + 1}`,
          message: 'Please connect to a device first.',
          timestamp: new Date().toLocaleTimeString(),
        },
        ...prevLogs,
      ]);
      return;
    }
    sendCommand(device, COMMANDS.cmdCustomizedSessionTargetInventoryStop);
    sendCommand(device, COMMANDS.cmdCustomizedSessionTargetInventoryStop);
    setIsScanning(false);
  };
  const handlerReset = () => {
    dispatch(resetTags());
    dispatch(resetAssets());
  };
  const handlerScanDevice = () => {
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
      setLogs(prevLogs => [
        {
          id: `log-${prevLogs.length + 1}`,
          message: 'Scan completed',
          timestamp: new Date().toLocaleTimeString(),
        },
        ...prevLogs,
      ]);
    }, 2000);
  };

  const sendCommand = async (
    device: Device,
    command: string,
    value: any = null,
  ) => {
    if (!device) {
      Alert.alert('Error', 'Device is not connected.');
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
      Alert.alert('Failed', 'Please check if the device is connected.');

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

  const handlerSelectedPower = (power: number) => {
    if (power !== deviceInfo.power) {
      if (!device) {
        setLogs(prevLogs => [
          {
            id: `log-${prevLogs.length + 1}`,
            message: 'Please select a device first.',
            timestamp: new Date().toLocaleTimeString(),
          },
          ...prevLogs,
        ]);
        return;
      }
      sendCommand(device, COMMANDS.cmdSetOutputPower, power);
    }
  };

  const handlerSelectedMode = (mode: any) => {
    if (mode.id !== deviceInfo.currentMode?.id) {
      if (!device) {
        setLogs(prevLogs => [
          {
            id: `log-${prevLogs.length + 1}`,
            message: 'Please select a device first.',
            timestamp: new Date().toLocaleTimeString(),
          },
          ...prevLogs,
        ]);
        return;
      }
      sendCommand(device, COMMANDS.cmdSetRfLinkProfile, mode.code);
    }
  };

  return (
    <FlatList
      data={[]}
      renderItem={() => <></>}
      ListEmptyComponent={
        <View
          style={{
            justifyContent: 'center',
            paddingHorizontal: 10,
            flex: 1,
            backgroundColor: '#fff',
          }}
        >
          <Text
            style={{
              fontSize: 20,
              fontWeight: 'bold',
              textAlign: 'center',
              marginVertical: 10,
            }}
          >
            Inventory
          </Text>
          <View
            style={{
              flex: 1,
              width: '100%',
              alignSelf: 'center',
              marginTop: 20,
              alignItems: 'center',
              backgroundColor: '#f9fafb',
              paddingHorizontal: 10,
              paddingVertical: 20,
              borderRadius: 10,
            }}
          >
            <Text
              style={{
                fontWeight: 'bold',
                fontSize: 16,
                marginBottom: 15,
                marginRight: 'auto',
              }}
            >
              Configuration Settings
            </Text>

            <View style={{ width: '100%' }}>
              <View>
                <Text style={{ marginBottom: 10 }}>Power(dbm)</Text>
                <Picker
                  style={{
                    width: '100%',
                    backgroundColor: '#fff',
                    elevation: 1,
                    shadowOffset: {
                      width: 0,
                      height: 1,
                    },
                    shadowOpacity: 0.2,
                    shadowRadius: 4,
                  }}
                  selectedValue={deviceInfo.power}
                  onValueChange={handlerSelectedPower}
                >
                  {DBMS.map(dbm => (
                    <Picker.Item key={dbm} label={`${dbm} dBm`} value={dbm} />
                  ))}
                </Picker>
              </View>

              <View style={{ marginVertical: 10 }}>
                <Text style={{ marginBottom: 10 }}>Mode</Text>
                <Picker
                  style={{
                    width: '100%',
                    backgroundColor: '#fff',
                    elevation: 1,
                    shadowOffset: {
                      width: 0,
                      height: 1,
                    },
                    shadowOpacity: 0.2,
                    shadowRadius: 4,
                  }}
                  selectedValue={deviceInfo.currentMode?.id}
                  onValueChange={(itemValue, itemIndex) => {
                    const selectedMode = MODES.find(
                      mode => mode.id === itemValue,
                    );
                    if (selectedMode) {
                      handlerSelectedMode(selectedMode);
                    }
                  }}
                >
                  {MODES.map(mode => (
                    <Picker.Item
                      key={mode.id}
                      label={mode.name}
                      value={mode.id}
                    />
                  ))}
                </Picker>
              </View>
            </View>
          </View>
          <View
            style={{
              flex: 1,
              width: '100%',
              alignSelf: 'center',
              marginTop: 20,
              alignItems: 'center',
              backgroundColor: '#f9fafb',
              paddingHorizontal: 10,
              paddingVertical: 20,
              borderRadius: 10,
            }}
          >
            <View style={{ flexDirection: 'row' }}>
              <TouchableOpacity
                onPress={handlerScan}
                style={{
                  flex: 1,
                  marginRight: 5,
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 20,
                  paddingVertical: 10,
                  borderRadius: 10,
                  backgroundColor: '#16a34a',
                  justifyContent: 'center',
                }}
              >
                {isScanning ? (
                  <>
                    <ActivityIndicator size="small" color="#fff" />
                  </>
                ) : (
                  <>
                    <IconFeather
                      style={{ color: '#fff', marginRight: 10 }}
                      name="play-circle"
                    />
                    <Text style={{ color: '#fff' }}>Start</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handlerStop}
                style={{
                  flex: 1,
                  marginLeft: 5,
                  flexDirection: 'row',
                  paddingHorizontal: 20,
                  justifyContent: 'center',
                  borderRadius: 10,
                  alignItems: 'center',
                  paddingVertical: 10,
                  backgroundColor: '#dc2626',
                }}
              >
                <IconFeather
                  style={{ color: '#fff', marginRight: 10 }}
                  name="minus-circle"
                />
                <Text style={{ color: '#fff' }}>Stop</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handlerReset}
                style={{
                  flex: 1,
                  marginLeft: 5,
                  flexDirection: 'row',
                  paddingHorizontal: 20,
                  justifyContent: 'center',
                  borderRadius: 10,
                  alignItems: 'center',
                  paddingVertical: 10,
                  backgroundColor: '#dc2626',
                }}
              >
                <IconFeather
                  style={{ color: '#fff', marginRight: 10 }}
                  name="minus-circle"
                />
                <Text style={{ color: '#fff' }}>Reset</Text>
              </TouchableOpacity>
            </View>
            <View
              style={{
                marginVertical: 10,
                flex: 1,
                width: '100%',
                backgroundColor: '#fff',
                padding: 10,
                borderRadius: 10,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontWeight: 'bold' }}>Scan Status</Text>
                {isScanning ? (
                  <Text
                    style={{
                      padding: 5,
                      textAlign: 'center',
                      borderRadius: 5,
                      backgroundColor: '#bbf7d0',
                    }}
                  >
                    Scanning
                  </Text>
                ) : (
                  <Text
                    style={{
                      padding: 5,
                      textAlign: 'center',
                      borderRadius: 5,
                      backgroundColor: '#fef3c7',
                    }}
                  >
                    Idle
                  </Text>
                )}
              </View>
              <Text style={{ marginTop: 10 }}>
                RFID Tag Detected: {tags.length}
              </Text>
            </View>
          </View>

          <View
            style={{
              flex: 1,
              width: '100%',
              alignSelf: 'center',
              marginTop: 20,
              alignItems: 'center',
              backgroundColor: '#f9fafb',
              paddingHorizontal: 10,
              paddingVertical: 20,
              borderRadius: 10,
            }}
          >
            <Text
              style={{
                fontWeight: 'bold',
                fontSize: 16,
                marginBottom: 15,
                marginRight: 'auto',
              }}
            >
              Detected Asset ({assets.length})
            </Text>

            <View style={{ width: '100%', backgroundColor: '#fff' }}>
              <DataTable>
                {assets.map(asset => (
                  <DataTable.Row key={asset.id}>
                    <DataTable.Cell>{asset.rfid}</DataTable.Cell>
                    <DataTable.Cell>{asset.name}</DataTable.Cell>
                  </DataTable.Row>
                ))}
              </DataTable>
            </View>
          </View>
        </View>
      }
    />
  );
};
