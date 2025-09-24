/* eslint-disable react/self-closing-comp */
/* eslint-disable react-native/no-inline-styles */
import { Picker } from '@react-native-picker/picker';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { DBMS } from '../utils/Dbm';
import { COMMANDS } from '../utils/Command';
import { CHARACTERISTIC_UUID, SERVICE_UUID } from '../utils/BLE';
import { Device } from 'react-native-ble-plx';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../redux/store';

export const AlertModeScreen = () => {
  const [settings, setSettings] = useState<any>({
    wifiName: 'ThahhTuyenn',
    wifiPassword: 'luilui cute',
    host: '172.20.10.12',
    port: '3001',
  });
  const [isWarningMode, setIsWarningMode] = useState(false);
  const [isSettingConnect, setIsSettingConnect] = useState(false);
  const device = useSelector((state: RootState) => state.device.device);
  const [logs, setLogs] = useState<any[]>([
    {
      id: 'log-1',
      message: 'Device initialized',
      timestamp: new Date().toLocaleTimeString(),
    },
  ]);
  const dispatch = useDispatch();

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

  const handlerStartAlert = () => {
    if (!device) {
      Alert.alert('Error', 'Please connect to a device first.');
      return;
    }
    setIsWarningMode(true);
    sendCommand(device, COMMANDS.cmdSendAlertStart);
  };
  const handlerStopAlert = () => {
    if (!device) {
      Alert.alert('Error', 'Please connect to a device first.');
      return;
    }
    setIsWarningMode(false);
    sendCommand(device, COMMANDS.cmdSendAlertStop);
  };
  const handlerSaveSettings = () => {
    if (!device) {
      Alert.alert('Error', 'Please connect to a device first.');
      return;
    }
    setIsSettingConnect(true);
    const { wifiName, wifiPassword, host, port } = settings;
    const value = {
      wifiName,
      wifiPassword,
      host,
      port,
    };

    sendCommand(device, COMMANDS.cmdSendSettingAlert, value);
    setIsSettingConnect(false);
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
        <Text
          style={{
            fontSize: 20,
            fontWeight: 'bold',
            textAlign: 'center',
            marginVertical: 10,
          }}
        >
          Warning Mode
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
          <Image
            source={require('../../assets/img/warning-mode.png')}
            style={{
              width: '100%',
              height: 350,
              marginBottom: 10,
              borderRadius: 10,
            }}
          />

          <View style={{ width: '100%' }}>
            <Text
              style={{
                fontSize: 20,
                textAlign: 'center',
                color: '#333',
                fontWeight: 'bold',
                marginBottom: 15,
              }}
            >
              Enable Warning Mode
            </Text>

            <Text
              style={{
                fontSize: 16,
                textAlign: 'center',
                color: '#333',
                marginBottom: 15,
              }}
            >
              This mode will activate continuous scanning and alerting for
              unauthorized RFID tags.
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
            Connection
          </Text>

          <View style={{ width: '100%' }}>
            <View style={{ marginBottom: 20 }}>
              <Text style={{ marginBottom: 10 }}>Wifi name</Text>
              <View
                style={{
                  flexDirection: 'row',
                  borderWidth: 1,
                  borderColor: '#ccc',
                  borderRadius: 10,
                  overflow: 'hidden',
                  backgroundColor: '#fff',
                }}
              >
                <TextInput
                  placeholder="Enter wifi name"
                  value={settings.wifiName}
                  onChangeText={text =>
                    setSettings({ ...settings, wifiName: text })
                  }
                  placeholderTextColor="#999"
                  style={{
                    flex: 1,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                  }}
                />
              </View>
            </View>

            <View style={{ marginBottom: 20 }}>
              <Text style={{ marginBottom: 10 }}>Password</Text>
              <View
                style={{
                  flexDirection: 'row',
                  borderWidth: 1,
                  borderColor: '#ccc',
                  borderRadius: 10,
                  overflow: 'hidden',
                  backgroundColor: '#fff',
                }}
              >
                <TextInput
                  placeholder="Enter wifi password"
                  placeholderTextColor="#999"
                  value={settings.wifiPassword}
                  onChangeText={text =>
                    setSettings({ ...settings, wifiPassword: text })
                  }
                  style={{
                    flex: 1,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                  }}
                />
              </View>
            </View>

            <View style={{ marginBottom: 20 }}>
              <Text style={{ marginBottom: 10 }}>Host</Text>
              <View
                style={{
                  flexDirection: 'row',
                  borderWidth: 1,
                  borderColor: '#ccc',
                  borderRadius: 10,
                  overflow: 'hidden',
                  backgroundColor: '#fff',
                }}
              >
                <TextInput
                  placeholder="Enter host address"
                  placeholderTextColor="#999"
                  value={settings.host}
                  onChangeText={text =>
                    setSettings({ ...settings, host: text })
                  }
                  style={{
                    flex: 1,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                  }}
                />
              </View>
            </View>

            <View style={{ marginBottom: 20 }}>
              <Text style={{ marginBottom: 10 }}>Port</Text>
              <View
                style={{
                  flexDirection: 'row',
                  borderWidth: 1,
                  borderColor: '#ccc',
                  borderRadius: 10,
                  overflow: 'hidden',
                  backgroundColor: '#fff',
                }}
              >
                <TextInput
                  placeholder="Enter port"
                  placeholderTextColor="#999"
                  value={settings.port}
                  onChangeText={text =>
                    setSettings({ ...settings, port: text })
                  }
                  style={{
                    flex: 1,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                  }}
                />
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={{
              width: '100%',
              padding: 10,
              backgroundColor: '#16a34a',
              marginTop: 20,
              flexDirection: 'row',
              justifyContent: 'center',
              borderRadius: 10,
            }}
            onPress={handlerSaveSettings}
          >
            {isSettingConnect ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Text style={{ color: '#fff', textAlign: 'center' }}>Save</Text>
              </>
            )}
          </TouchableOpacity>
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
                selectedValue={DBMS[0]}
              >
                {DBMS.map((dbm, index) => (
                  <Picker.Item
                    key={index}
                    value={dbm}
                    label={dbm.toString() + ' dBm'}
                  />
                ))}
              </Picker>
            </View>

            <TouchableOpacity
              style={{
                width: '100%',
                padding: 10,
                backgroundColor: '#dc2626',
                marginTop: 20,
                flexDirection: 'row',
                justifyContent: 'center',
                borderRadius: 10,
              }}
              onPress={() => {
                if (isWarningMode) {
                  handlerStopAlert();
                } else {
                  handlerStartAlert();
                }
              }}
            >
              {isWarningMode ? (
                <>
                  <Ionicons
                    name="warning"
                    size={20}
                    color="white"
                    style={{ marginRight: 5 }}
                  />
                  <Text style={{ color: '#fff', textAlign: 'center' }}>
                    Stop
                  </Text>
                </>
              ) : (
                <>
                  <Ionicons
                    name="warning"
                    size={20}
                    color="white"
                    style={{ marginRight: 5 }}
                  />
                  <Text style={{ color: '#fff', textAlign: 'center' }}>
                    Start
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </ScrollView>
  );
};
