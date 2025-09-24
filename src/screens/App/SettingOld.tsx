/* eslint-disable react-native/no-inline-styles */
import { Picker } from '@react-native-picker/picker';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  PermissionsAndroid,
  Platform,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Text, View } from 'react-native';
import { BleManager, Device } from 'react-native-ble-plx';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Buffer } from 'buffer';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../redux/store';
import { increment } from '../redux/slices/CouterSlice';
import { useAuth } from '../contexts/AuthContext';
import { COMMANDS } from '../utils/Command';
import { MODES } from '../utils/Mode';
import { DBMS } from '../utils/Dbm';
import { setDevice, setDeviceInfo } from '../redux/slices/DeviceSlice';
import { CHARACTERISTIC_UUID, SERVICE_UUID } from '../utils/BLE';
import { patchAssetByRfids, setTags } from '../redux/slices/AssetSlice';
if (typeof global.Buffer === 'undefined') global.Buffer = Buffer;

const regexTag = /^E2[0-9A-F]{22}$/;

const manager = new BleManager();

export const SettingScreen = () => {
  const { logout, user } = useAuth();
  const deviceInfo = useSelector((state: RootState) => state.device.deviceInfo);
  const tags = useSelector((state: RootState) => state.assets.tags);
  const [isFetching, setIsFetching] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [logs, setLogs] = useState<any[]>([
    {
      id: 'log-1',
      message: 'Device initialized',
      timestamp: new Date().toLocaleTimeString(),
    },
  ]);
  const [devices, setDevices] = useState<Device[]>([]);
  const requestPermissions = async (): Promise<void> => {
    if (Platform.OS === 'android') {
      await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      ]);
    }
  };
  const handlerScanDevice = async () => {
    setDevices([]);
    setIsScanning(true);
    await requestPermissions();
    setLogs([
      {
        id: `log-${logs.length + 1}`,
        message: 'Scanning for devices...',
        timestamp: new Date().toLocaleTimeString(),
      },
      ...logs,
    ]);

    manager.startDeviceScan(null, null, (error, device) => {
      if (error) {
        setLogs([
          {
            id: `log-${logs.length + 1}`,
            message: `Error scanning devices: ${error.message}`,
            timestamp: new Date().toLocaleTimeString(),
          },
          ...logs,
        ]);
        setIsScanning(false);
        return;
      }

      if (device && device.name?.includes('RFID')) {
        setDevices(prev => {
          if (!prev.some(d => d.id === device.id)) {
            return [...prev, device];
          }
          return prev;
        });
      }
    });
    setIsScanning(false);

    setTimeout(() => {
      manager.stopDeviceScan();
      setLogs(prevLogs => [
        {
          id: `log-${prevLogs.length + 1}`,
          message: `Scan completed. Found ${devices.length} devices.`,
          timestamp: new Date().toLocaleTimeString(),
        },
        ...prevLogs,
      ]);
    }, 5000);
  };

  const device = useSelector((state: RootState) => state.device.device);

  const handlerSelectDevice = async (device: Device) => {
    try {
      dispatch(setDevice(device));
      setIsConnected(true);
      setLogs(prevLogs => [
        {
          id: `log-${prevLogs.length + 1}`,
          message: `Connected to ${device.name ?? 'Unknown Device'}`,
          timestamp: new Date().toLocaleTimeString(),
        },
        ...prevLogs,
      ]);

      const connected = await device.connect();
      const updated = await connected.requestMTU(517);
      await updated.discoverAllServicesAndCharacteristics();

      const services = await updated.services();
      const service = services.find(s => s.uuid.toLowerCase() === SERVICE_UUID);

      if (!service) {
        setLogs(prevLogs => [
          {
            id: `log-${prevLogs.length + 1}`,
            message: '❌ Không tìm thấy service UUID',
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
            message: '❌ Không tìm thấy characteristic UUID',
            timestamp: new Date().toLocaleTimeString(),
          },
          ...prevLogs,
        ]);
        return;
      }

      let buffer = '';

      characteristic.monitor((error, characteristic) => {
        if (error) {
          console.error('❌ Lỗi khi nhận phản hồi:', error?.message || 'Unknown error');
          return;
        }

        if (characteristic?.value) {
          const chunk = Buffer.from(characteristic.value, 'base64').toString();
          console.log('Nhận mảnh:', chunk);
          buffer += chunk;
          console.log('Tổng hợp:', buffer);
          if (buffer.trim().endsWith('}')) {
            try {
              const json = JSON.parse(buffer);
              console.log('JSON hợp lệ:', json);
              setLogs(prevLogs => [
                {
                  id: `log-${prevLogs.length + 1}`,
                  message: `Phản hồi: ${json.cmd} - ${JSON.stringify(json)}`,
                  timestamp: new Date().toLocaleTimeString(),
                },
                ...prevLogs,
              ]);
              buffer = '';
              if (json.cmd === 'get_reader_identifier') {
                dispatch(setDeviceInfo({ id: json.value || 'Unknown' }));
              } else if (json.cmd === 'cmd_get_firmware_version') {
                dispatch(setDeviceInfo({ firmware: json.value || 'Unknown' }));
              } else if (json.cmd === 'cmd_get_output_power') {
                dispatch(setDeviceInfo({ power: json.value || 0 }));
              } else if (json.cmd === 'cmd_set_output_power') {
                console.log('Lệnh thiết cmd_set_output_power:', json);
                dispatch(setDeviceInfo({ power: json.value || 0 }));
              } else if (json.cmd === 'cmd_get_reader_temperature') {
                dispatch(
                  setDeviceInfo({ temperature: Number(json.value) || 0 }),
                );
              } else if (json.cmd === 'cmd_get_rf_link_profile') {
                const mode = MODES.find(
                  m => m.code === json.value?.toUpperCase(),
                );
                dispatch(
                  setDeviceInfo({
                    currentMode: mode ?? deviceInfo.currentMode,
                  }),
                );
              } else if (json.cmd === 'cmd_set_rf_link_profile') {
                console.log('Lệnh thiết cmd_set_rf_link_profile chế độ:', json);
                const mode = MODES.find(
                  m => m.code === json.value?.toUpperCase(),
                );
                dispatch(setDeviceInfo({ currentMode: mode ?? MODES[0] }));
              } else if (
                json.cmd === 'cmd_customized_session_target_inventory_start'
              ) {
                if (json && Array.isArray(json.tags)) {
                  console.log('📦 Nhận tag:', json.tags);

                  if (json.tags.length > 0) {
                    const validTags: string[] = json.tags
                      .map((tag: string) => {
                        if (!regexTag.test(tag) || tags.includes(tag)) {
                          return null;
                        }
                        return tag;
                      })
                      .filter(
                        (tag: string | null): tag is string => tag !== null,
                      );
                    // Send Tag to Server
                    console.log('📦 Valid tags:', validTags);
                    dispatch(setTags(validTags));
                    dispatch(patchAssetByRfids(validTags) as any);
                  }
                }
              } else if (
                json.cmd === 'cmd_customized_session_target_inventory_stop'
              ) {
                console.log('📦 Lệnh tùy chỉnh dừng:', json);
              }
            } catch (err) {
              console.warn('⚠️ JSON lỗi, đang chờ thêm...');
            }
          }
        }
      });
    } catch (error: any) {
      setLogs(prevLogs => [
        {
          id: `log-${prevLogs.length + 1}`,
          message: `Failed to connect to device: ${error?.message || 'Unknown error'}`,
          timestamp: new Date().toLocaleTimeString(),
        },
        ...prevLogs,
      ]);
    }
  };
  console.log(deviceInfo);
  const handlerFetchInformationDevice = async () => {
    setIsFetching(true);
    if (!device) {
      setLogs(prevLogs => [
        {
          id: `log-${prevLogs.length + 1}`,
          message: 'Please select a device first.',
          timestamp: new Date().toLocaleTimeString(),
        },
        ...prevLogs,
      ]);
      setIsFetching(false);
      return;
    }

    await Promise.all([
      sendCommand(device, COMMANDS.getReaderIdentifier),
      sendCommand(device, COMMANDS.cmdGetFirmwareVersion),
      sendCommand(device, COMMANDS.cmdGetOutputPower),
      sendCommand(device, COMMANDS.cmdGetReaderTemperature),
      sendCommand(device, COMMANDS.cmdGetRfLinkProfile),
    ]);
    setIsFetching(false);
  };

  const sendCommand = async (
    device: Device,
    command: string,
    value: any = null,
  ) => {
    if (!device) {
      setLogs(prevLogs => [
        {
          id: `log-${prevLogs.length + 1}`,
          message: 'Device is not connected.',
          timestamp: new Date().toLocaleTimeString(),
        },
        ...prevLogs,
      ]);
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
  const count = useSelector((state: RootState) => state.couter.value);
  const dispatch = useDispatch<AppDispatch>();

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
    <ScrollView style={{ flex: 1, backgroundColor: '#fff' }}>
      <View
        style={{
          justifyContent: 'center',
          paddingHorizontal: 10,
          flex: 1,
          backgroundColor: '#fff',
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginVertical: 10,
          }}
        >
          <Text
            style={{
              fontSize: 20,
              fontWeight: 'bold',
              flex: 1,
              textAlign: 'center',
            }}
          >
            Setting Device
          </Text>
          <TouchableOpacity
            onPress={() => {
              Alert.alert(
                'Đăng xuất',
                'Bạn có chắc chắn muốn đăng xuất?',
                [
                  { text: 'Hủy', style: 'cancel' },
                  { text: 'Đăng xuất', onPress: logout },
                ]
              );
            }}
            style={{
              padding: 8,
              backgroundColor: '#ef4444',
              borderRadius: 6,
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            <Ionicons name="log-out-outline" size={16} color="white" />
            <Text style={{ color: 'white', marginLeft: 4, fontSize: 12 }}>
              Đăng xuất
            </Text>
          </TouchableOpacity>
        </View>
        
        {user && (
          <View
            style={{
              backgroundColor: '#f0f9ff',
              padding: 12,
              borderRadius: 8,
              marginBottom: 10,
              borderLeftWidth: 4,
              borderLeftColor: '#0ea5e9',
            }}
          >
            <Text style={{ color: '#0369a1', fontSize: 14, fontWeight: '500' }}>
              Xin chào, {user.name}!
            </Text>
            <Text style={{ color: '#64748b', fontSize: 12 }}>
              {user.email}
            </Text>
          </View>
        )}
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
          <TouchableOpacity
            onPress={handlerScanDevice}
            style={{
              width: 200,
              padding: 10,
              backgroundColor: '#4f46e5',
              marginBottom: 10,
              flexDirection: 'row',
              justifyContent: 'center',
              borderRadius: 10,
            }}
          >
            {isScanning ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="bluetooth" size={20} color="white" />
                <Text style={{ color: 'white', marginHorizontal: 5 }}>
                  Scan Device
                </Text>
              </>
            )}
          </TouchableOpacity>

          <FlatList
            style={{ width: '100%', maxHeight: 150, flex: 1 }}
            nestedScrollEnabled={true}
            ListEmptyComponent={
              <View style={{ alignItems: 'center' }}>
                <Text style={{ textAlign: 'center' }}>
                  No device found yet. Click Scan to discover devices.
                </Text>
              </View>
            }
            data={devices}
            keyExtractor={item => item?.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => handlerSelectDevice(item)}
                style={{
                  width: '100%',
                  padding: 10,
                  backgroundColor: '#fff',
                  marginBottom: 5,
                  borderRadius: 5,
                  paddingHorizontal: 10,
                  paddingVertical: 15,
                }}
              >
                <Text style={{ color: '#4f46e5' }}>
                  {item?.name ?? 'Unknown Device'} - {item?.id}
                </Text>
              </TouchableOpacity>
            )}
          />
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
            height: 200,
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
            Connection Logs
          </Text>

          <View style={{ flex: 1, width: '100%', height: '100%' }}>
            <FlatList
              nestedScrollEnabled={true}
              style={{ width: '100%', flex: 1, maxHeight: 350 }}
              ListEmptyComponent={
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ textAlign: 'left' }}>
                    No logs available. Select a device to view connection
                    history.
                  </Text>
                </View>
              }
              data={logs}
              keyExtractor={item => item?.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={{
                    width: '100%',
                    padding: 10,
                    backgroundColor: '#fff',
                    marginBottom: 5,
                    borderRadius: 5,
                    paddingHorizontal: 10,
                    paddingVertical: 15,
                    borderColor: '#e5e7eb',
                    borderLeftWidth: 2,
                    borderLeftColor: '#4f46e5',
                    marginVertical: 5,
                  }}
                >
                  <Text style={{ color: '#4f46e5' }}>{item?.timestamp}</Text>
                  <Text>{item?.message}</Text>
                </TouchableOpacity>
              )}
            />
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
          <View
            style={{
              flexDirection: 'row',
              width: '100%',
              justifyContent: 'space-between',
              alignItems: 'center',
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
              Device Information
            </Text>
            <TouchableOpacity
              onPress={handlerFetchInformationDevice}
              style={{
                padding: 10,
                backgroundColor: '#4f46e5',
                marginBottom: 10,
                flexDirection: 'row',
                justifyContent: 'center',
                borderRadius: 10,
              }}
            >
              {isFetching ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Text style={{ color: '#fff', textAlign: 'center' }}>
                    Fetch
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={{ width: '100%' }}>
            <View
              style={{
                marginVertical: 5,
                padding: 10,
                backgroundColor: '#fff',
                borderRadius: 5,
                elevation: 1,
                shadowOffset: {
                  width: 0,
                  height: 1,
                },
                shadowOpacity: 0.2,
                shadowRadius: 4,
              }}
            >
              <Text style={{ color: '#000' }}>Device ID</Text>
              <Text style={{ color: '#000', fontWeight: 'bold' }}>
                {deviceInfo.id}
              </Text>
            </View>

            <View
              style={{
                marginVertical: 5,
                padding: 10,
                backgroundColor: '#fff',
                borderRadius: 5,
                elevation: 1,
                shadowOffset: {
                  width: 0,
                  height: 1,
                },
                shadowOpacity: 0.2,
                shadowRadius: 4,
              }}
            >
              <Text style={{ color: '#000' }}>Device Temperature</Text>
              <Text style={{ color: '#000', fontWeight: 'bold' }}>
                {deviceInfo.temperature} °C
              </Text>
            </View>
            <View
              style={{
                marginVertical: 5,
                padding: 10,
                backgroundColor: '#fff',
                borderRadius: 5,
                elevation: 1,
                shadowOffset: {
                  width: 0,
                  height: 1,
                },
                shadowOpacity: 0.2,
                shadowRadius: 4,
              }}
            >
              <Text style={{ color: '#000' }}>Firmware Version</Text>
              <Text style={{ color: '#000', fontWeight: 'bold' }}>
                {deviceInfo.firmware}
              </Text>
            </View>
            <View
              style={{
                marginVertical: 5,
                padding: 10,
                backgroundColor: '#fff',
                borderRadius: 5,
                elevation: 1,
                shadowOffset: {
                  width: 0,
                  height: 1,
                },
                shadowOpacity: 0.2,
                shadowRadius: 4,
              }}
            >
              <Text style={{ color: '#000' }}>Current Mode</Text>
              <Text style={{ color: '#000', fontWeight: 'bold' }}>
                {deviceInfo.currentMode?.name}
              </Text>
            </View>
            <View
              style={{
                marginVertical: 5,
                padding: 10,
                backgroundColor: '#fff',
                borderRadius: 5,
                elevation: 1,
                shadowOffset: {
                  width: 0,
                  height: 1,
                },
                shadowOpacity: 0.2,
                shadowRadius: 4,
              }}
            >
              <Text style={{ color: '#000' }}>Power</Text>
              <Text style={{ color: '#000', fontWeight: 'bold' }}>
                {deviceInfo.power} dBm
              </Text>
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
                onValueChange={(itemValue, itemIndex) => {
                  handlerSelectedPower(itemValue);
                }}
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
                  handlerSelectedMode(selectedMode);
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
      </View>
    </ScrollView>
  );
};
