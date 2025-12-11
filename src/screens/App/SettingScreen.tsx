/* eslint-disable react-native/no-inline-styles */
import { Picker } from '@react-native-picker/picker';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  TextInput,
} from 'react-native';
import { Text, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../redux/store';
import { useAuth } from '../../contexts/AuthContext';
import { MODES } from '../../utils/Mode';
import { DBMS } from '../../utils/Dbm';
import { 
  scanDevices, 
  connectToDevice, 
  disconnectDevice,
  addLog,
  clearLogs
} from '../../redux/slices/BluetoothSlice';
import { deviceCommandManager } from '../../utils/DeviceCommands';
import { patchAssetByRfids, setTags } from '../../redux/slices/AssetSlice';
import { fetchDeviceInformation, processResponse, setDeviceMode, setDevicePower, startInventory, stopInventory, addScannedTag, batchAddScannedTags, resetScannedTagsMap, setInventoryRunning, startAlert, stopAlert, sendCommand } from '../../redux/slices/DeviceSlice';
import { setDevice } from '../../redux/slices/DeviceSlice';
import { COMMANDS } from '../../utils/Command';

const { width } = Dimensions.get('window');

export const SettingScreen = () => {
  const { logout, user } = useAuth();
  const dispatch = useDispatch<AppDispatch>();
  
  // Redux state
  const deviceInfo = useSelector((state: RootState) => state.device.deviceInfo);
  const device = useSelector((state: RootState) => state.device.device);
  const tags = useSelector((state: RootState) => state.assets.tags);
  const bluetoothState = useSelector((state: RootState) => state.bluetooth);
  const isInventoryRunning = useSelector((state: RootState) => state.device.isInventoryRunning);
  const scannedTagsCount = useSelector((state: RootState) => state.device.scannedTagsCount);
  const scannedTagsMap = useSelector((state: RootState) => state.device.scannedTagsMap);
  const [isFetching, setIsFetching] = useState(false);
  
  // Alert mode configuration states
  const [alertSettings, setAlertSettings] = useState({
    wifiName: 'Ruby tu C13 den C25',
    wifiPassword: 'VietnhatC136868',
    host: '192.168.1.10',
    port: '3001',
  });
  const [isAlertMode, setIsAlertMode] = useState(false);
  const [isSettingAlert, setIsSettingAlert] = useState(false);
  
  // Memoized stats để tránh re-render không cần thiết
  const memoizedStats = useMemo(() => ({
    totalCount: scannedTagsCount,
    uniqueCount: Object.keys(scannedTagsMap).length,
    allTags: Object.entries(scannedTagsMap)
      .sort(([,a], [,b]) => b - a) // Sort by count descending
  }), [scannedTagsCount, scannedTagsMap]);
  
  // Section collapse states
  const [sections, setSections] = useState({
    bluetooth: false,
    logs: false,
    deviceInfo: false,
    config: false,
    inventory: true,
    alert: false,
  });

  // Smart queue system để tối ưu performance
  const processTagsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingTagsRef = useRef<string[]>([]);
  const lastUIUpdateRef = useRef<number>(0);

  // Smart processing function - tách biệt UI update và data processing
  const processTagsWithSmartQueue = useCallback((newTags: string[]) => {
    // 1. Thêm vào queue ngay lập tức
    pendingTagsRef.current = [...new Set([...pendingTagsRef.current, ...newTags])];
    
    // 2. Cập nhật UI counter ngay lập tức (không lag)
    dispatch(batchAddScannedTags(newTags));
    
    // 3. Smart batching: Process ngay nếu queue đủ lớn
    if (pendingTagsRef.current.length >= 5) {
      processBatchImmediately();
    } else {
      // Debounce ngắn cho small batches
      scheduleBatchProcessing(100); // 100ms thay vì 500ms
    }
  }, [dispatch]);

  // Process batch ngay lập tức
  const processBatchImmediately = useCallback(() => {
    const tagsToProcess = [...pendingTagsRef.current];
    pendingTagsRef.current = [];
    
    if (tagsToProcess.length > 0) {
      // Process trong background (không block UI)
      setTimeout(() => {
        const validTags = deviceCommandManager.processInventoryTags(tagsToProcess, tags);
        if (validTags.length > 0) {
          dispatch(setTags(validTags));
          dispatch(patchAssetByRfids(validTags) as any);
        }
      }, 0); // Non-blocking
    }
  }, [dispatch, tags]);

  // Schedule batch processing với delay
  const scheduleBatchProcessing = useCallback((delay: number) => {
    if (processTagsTimeoutRef.current) {
      clearTimeout(processTagsTimeoutRef.current);
    }
    
    processTagsTimeoutRef.current = setTimeout(() => {
      processBatchImmediately();
    }, delay);
  }, [processBatchImmediately]);

  // Setup device monitoring when device is connected
  useEffect(() => {
    if (device && bluetoothState.isConnected) {
      deviceCommandManager.setupMonitoring(
        device,
        (response) => {
          dispatch(processResponse(response));
          
          // Handle inventory tags với smart queue
          if (response.cmd === 'cmd_customized_session_target_inventory_start' && response.tags) {
            processTagsWithSmartQueue(response.tags);
          } else if (response.cmd === 'cmd_customized_session_target_inventory_stop') {
            dispatch(setInventoryRunning(false));
            // Clear pending tags khi stop
            if (processTagsTimeoutRef.current) {
              clearTimeout(processTagsTimeoutRef.current);
            }
            pendingTagsRef.current = [];
          }
        },
        (error) => {
          dispatch(addLog({
            message: `Device monitoring error: ${error?.message || 'Unknown error'}`,
            timestamp: new Date().toLocaleTimeString(),
          }));
        }
      );
    }
    
    // Cleanup timeout khi component unmount
    return () => {
      if (processTagsTimeoutRef.current) {
        clearTimeout(processTagsTimeoutRef.current);
      }
    };
  }, [device, bluetoothState.isConnected, dispatch, processTagsWithSmartQueue]);

  const handlerScanDevice = async () => {
    dispatch(scanDevices());
  };

  const handlerSelectDevice = async (selectedDevice: any) => {
    dispatch(setDevice(selectedDevice));
    dispatch(connectToDevice(selectedDevice));
  };
  const handlerFetchInformationDevice = async () => {
    if (!device) {
      dispatch(addLog({
        message: 'Please select a device first.',
        timestamp: new Date().toLocaleTimeString(),
      }));
      return;
    }
    setIsFetching(true);
    await dispatch(fetchDeviceInformation(device));
    setIsFetching(false);
  };

  const handlerSelectedPower = (power: number) => {
    if (power !== deviceInfo.power && device) {
      setIsFetching(true);
      dispatch(setDevicePower({ device, power }));
    }
    setIsFetching(false);
  };

  const handlerSelectedMode = (mode: any) => {
    if (mode.id !== deviceInfo.currentMode?.id && device) {
      setIsFetching(true);
      dispatch(setDeviceMode({ device, modeCode: mode.code }));
    }
    setIsFetching(false);
  };

  const handlerStartInventory = async () => {
    if (!device) {
      dispatch(addLog({
        message: 'Please select a device first.',
        timestamp: new Date().toLocaleTimeString(),
      }));
      return;
    }
    dispatch(resetScannedTagsMap());
    await dispatch(startInventory(device));
  };

  const handlerStopInventory = async () => {
    if (!device) {
      dispatch(addLog({
        message: 'Please select a device first.',
        timestamp: new Date().toLocaleTimeString(),
      }));
      return;
    }

    try {
      dispatch(addLog({
        message: '🛑 Stopping inventory with double stop command...',
        timestamp: new Date().toLocaleTimeString(),
      }));

      // Gửi double stop command
      await dispatch(stopInventory(device));

      dispatch(addLog({
        message: '✅ Inventory stopped successfully',
        timestamp: new Date().toLocaleTimeString(),
      }));
    } catch (error: any) {
      dispatch(addLog({
        message: `❌ Failed to stop inventory: ${error.message}`,
        timestamp: new Date().toLocaleTimeString(),
      }));
    }
  };

  const toggleSection = (sectionName: keyof typeof sections) => {
    setSections(prev => ({
      ...prev,
      [sectionName]: !prev[sectionName]
    }));
  };

  // Alert mode handlers
  const handlerStartAlert = async () => {
    if (!device) {
      dispatch(addLog({
        message: 'Please connect to a device first.',
        timestamp: new Date().toLocaleTimeString(),
      }));
      return;
    }
    
    try {
      setIsAlertMode(true);
      await dispatch(sendCommand({
        device, 
        command: COMMANDS.cmdSendAlertStart
      }) as any);
      
      dispatch(addLog({
        message: '🚨 Chế độ cảnh báo đã khởi động thành công',
        timestamp: new Date().toLocaleTimeString(),
      }));
    } catch (error: any) {
      setIsAlertMode(false);
      dispatch(addLog({
        message: `❌ Không thể khởi động chế độ cảnh báo: ${error?.message || 'Lỗi không xác định'}`,
        timestamp: new Date().toLocaleTimeString(),
      }));
    }
  };

  const handlerStopAlert = async () => {
    if (!device) {
      dispatch(addLog({
        message: 'Please connect to a device first.',
        timestamp: new Date().toLocaleTimeString(),
      }));
      return;
    }
    
    try {
      setIsAlertMode(false);
      await dispatch(sendCommand({
        device, 
        command: COMMANDS.cmdSendAlertStop
      }) as any);
      
      dispatch(addLog({
        message: '🛑 Chế độ cảnh báo đã dừng thành công',
        timestamp: new Date().toLocaleTimeString(),
      }));
    } catch (error: any) {
      dispatch(addLog({
        message: `❌ Không thể dừng chế độ cảnh báo: ${error?.message || 'Lỗi không xác định'}`,
        timestamp: new Date().toLocaleTimeString(),
      }));
    }
  };

  const handlerSaveAlertSettings = async () => {
    if (!device) {
      dispatch(addLog({
        message: 'Please connect to a device first.',
        timestamp: new Date().toLocaleTimeString(),
      }));
      return;
    }
    setIsSettingAlert(true);
    const { wifiName, wifiPassword, host, port } = alertSettings;
    const settings = {
      wifiName,
      wifiPassword,
      host,
      port,
    };

    try {
      await dispatch(sendCommand({
        device, 
        command: COMMANDS.cmdSendSettingAlert, 
        value: settings
      }) as any);
      
      dispatch(addLog({
        message: 'Cài đặt cảnh báo đã được lưu thành công',
        timestamp: new Date().toLocaleTimeString(),
      }));
    } catch (error: any) {
      dispatch(addLog({
        message: `Không thể lưu cài đặt cảnh báo: ${error?.message || 'Lỗi không xác định'}`,
        timestamp: new Date().toLocaleTimeString(),
      }));
    } finally {
      setIsSettingAlert(false);
    }
  };
  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />
      
      {/* Alert Mode Status Banner */}
      {isAlertMode && (
        <View style={{
          backgroundColor: '#dc2626',
          paddingVertical: 8,
          paddingHorizontal: 16,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Ionicons name="warning" size={16} color="white" style={{ marginRight: 8 }} />
          <Text style={{
            color: 'white',
            fontWeight: '600',
            fontSize: 14,
          }}>
            🚨 CHẾ ĐỘ CẢNH BÁO ĐANG HOẠT ĐỘNG
          </Text>
          <View style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: 'white',
            marginLeft: 8,
            opacity: 0.8,
          }} />
        </View>
      )}
      <ScrollView 
        style={{ flex: 1 }} 
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled={true}
      >
        {/* Bluetooth Connection Section */}
        <View style={{
          margin: 20,
          backgroundColor: '#fff',
          borderRadius: 16,
          padding: 20,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          elevation: 4,
        }}>
          <TouchableOpacity
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: 20,
            }}
            onPress={() => toggleSection('bluetooth')}
            activeOpacity={0.7}
          >
            <View style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: bluetoothState.isConnected ? '#10b981' : '#6b7280',
              justifyContent: 'center',
              alignItems: 'center',
              marginRight: 12,
            }}>
              <Ionicons 
                name="bluetooth" 
                size={20} 
                color="white" 
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{
                fontSize: 18,
                fontWeight: '600',
                color: '#1e293b',
              }}>
                Kết nối Bluetooth
              </Text>
              <Text style={{
                fontSize: 14,
                color: bluetoothState.isConnected ? '#10b981' : '#6b7280',
                marginTop: 2,
              }}>
                {bluetoothState.isConnected ? 'Đã kết nối' : 'Chưa kết nối'}
              </Text>
            </View>
            <Ionicons 
              name={sections.bluetooth ? 'chevron-up' : 'chevron-down'} 
              size={24} 
              color="#64748b" 
            />
          </TouchableOpacity>

          {sections.bluetooth && (
            <>
              <TouchableOpacity
                onPress={handlerScanDevice}
                style={{
                  backgroundColor: bluetoothState.isScanning ? '#6b7280' : '#3b82f6',
                  padding: 16,
                  borderRadius: 12,
                  flexDirection: 'row',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginBottom: 16,
                  shadowColor: '#3b82f6',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.2,
                  shadowRadius: 4,
                  elevation: 3,
                }}
                disabled={bluetoothState.isScanning}
              >
                {bluetoothState.isScanning ? (
                  <>
                    <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
                    <Text style={{ color: 'white', fontSize: 16, fontWeight: '500' }}>
                      Đang quét...
                    </Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="search" size={20} color="white" style={{ marginRight: 8 }} />
                    <Text style={{ color: 'white', fontSize: 16, fontWeight: '500' }}>
                      Quét thiết bị
                    </Text>
                  </>
                )}
              </TouchableOpacity>

          {bluetoothState.devices.length > 0 && (
            <View>
              <Text style={{
                fontSize: 16,
                fontWeight: '600',
                color: '#1e293b',
                marginBottom: 12,
              }}>
                Thiết bị tìm thấy ({bluetoothState.devices.length})
              </Text>
              <FlatList
                style={{ maxHeight: 200 }}
                nestedScrollEnabled={true}
                scrollEnabled={false}
                data={bluetoothState.devices}
                keyExtractor={item => item?.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    onPress={() => handlerSelectDevice(item)}
                    style={{
                      backgroundColor: '#f8fafc',
                      padding: 16,
                      borderRadius: 12,
                      marginBottom: 8,
                      borderWidth: 1,
                      borderColor: '#e2e8f0',
                      flexDirection: 'row',
                      alignItems: 'center',
                    }}
                  >
                    <View style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: '#3b82f6',
                      justifyContent: 'center',
                      alignItems: 'center',
                      marginRight: 12,
                    }}>
                      <Ionicons name="hardware-chip" size={16} color="white" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{
                        fontSize: 16,
                        fontWeight: '500',
                        color: '#1e293b',
                      }}>
                        {item?.name ?? 'Thiết bị RFID'}
                      </Text>
                      <Text style={{
                        fontSize: 12,
                        color: '#64748b',
                        marginTop: 2,
                      }}>
                        {item?.id}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
                  </TouchableOpacity>
                )}
              />
            </View>
          )}

              {bluetoothState.devices.length === 0 && !bluetoothState.isScanning && (
                <View style={{
                  alignItems: 'center',
                  padding: 20,
                }}>
                  <Ionicons name="bluetooth-outline" size={48} color="#94a3b8" />
                  <Text style={{
                    fontSize: 16,
                    color: '#64748b',
                    textAlign: 'center',
                    marginTop: 12,
                  }}>
                    Chưa tìm thấy thiết bị nào.{'\n'}Nhấn "Quét thiết bị" để tìm kiếm.
                  </Text>
                </View>
              )}
            </>
          )}
        </View>

        {/* Connection Logs Section */}
        <View style={{
          marginHorizontal: 20,
          marginBottom: 20,
          backgroundColor: '#fff',
          borderRadius: 16,
          padding: 20,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          elevation: 4,
        }}>
          <TouchableOpacity
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: 16,
            }}
            onPress={() => toggleSection('logs')}
            activeOpacity={0.7}
          >
            <View style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: '#8b5cf6',
              justifyContent: 'center',
              alignItems: 'center',
              marginRight: 12,
            }}>
              <Ionicons name="list" size={20} color="white" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{
                fontSize: 18,
                fontWeight: '600',
                color: '#1e293b',
              }}>
                Nhật ký kết nối
              </Text>
              <Text style={{
                fontSize: 14,
                color: '#64748b',
                marginTop: 2,
              }}>
                {bluetoothState.logs.length} mục
              </Text>
            </View>
            <Ionicons 
              name={sections.logs ? 'chevron-up' : 'chevron-down'} 
              size={24} 
              color="#64748b" 
            />
          </TouchableOpacity>

          {sections.logs && (
            <>
              {/* Action Buttons */}
              <View style={{
                flexDirection: 'row',
                justifyContent: 'flex-end',
                marginBottom: 12,
              }}>
                <TouchableOpacity
                  onPress={() => dispatch(clearLogs())}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: '#fef2f2',
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: '#fecaca',
                  }}
                >
                  <Ionicons name="trash-outline" size={16} color="#dc2626" />
                  <Text style={{
                    color: '#dc2626',
                    fontSize: 14,
                    fontWeight: '500',
                    marginLeft: 6,
                  }}>
                    Xóa logs
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={{ height: 300 }}>
                {bluetoothState.logs.length === 0 ? (
                <View style={{
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: 200,
                }}>
                  <Ionicons name="document-text-outline" size={48} color="#94a3b8" />
                  <Text style={{
                    fontSize: 16,
                    color: '#64748b',
                    textAlign: 'center',
                    marginTop: 12,
                  }}>
                    Chưa có nhật ký nào.{'\n'}Kết nối thiết bị để xem nhật ký.
                  </Text>
                </View>
              ) : (
                <ScrollView 
                  style={{ flex: 1 }}
                  showsVerticalScrollIndicator={true}
                  nestedScrollEnabled={true}
                >
                  {bluetoothState.logs.map((item) => (
                    <View key={item.id} style={{
                      backgroundColor: '#f8fafc',
                      padding: 12,
                      borderRadius: 8,
                      marginBottom: 8,
                      borderLeftWidth: 3,
                      borderLeftColor: '#3b82f6',
                    }}>
                      <View style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 4,
                      }}>
                        <Text style={{
                          fontSize: 12,
                          color: '#3b82f6',
                          fontWeight: '500',
                        }}>
                          {item?.timestamp}
                        </Text>
                        <View style={{
                          width: 6,
                          height: 6,
                          borderRadius: 3,
                          backgroundColor: '#10b981',
                        }} />
                      </View>
                      <Text style={{
                        fontSize: 14,
                        color: '#1e293b',
                        lineHeight: 20,
                      }}>
                        {item?.message}
                      </Text>
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>
            </>
          )}
        </View>

        {/* Device Information Section */}
        <View style={{
          marginHorizontal: 20,
          marginBottom: 20,
          backgroundColor: '#fff',
          borderRadius: 16,
          padding: 20,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          elevation: 4,
        }}>
          <TouchableOpacity
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: 20,
            }}
            onPress={() => toggleSection('deviceInfo')}
            activeOpacity={0.7}
          >
            <View style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: '#f59e0b',
              justifyContent: 'center',
              alignItems: 'center',
              marginRight: 12,
            }}>
              <Ionicons name="information-circle" size={20} color="white" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{
                fontSize: 18,
                fontWeight: '600',
                color: '#1e293b',
              }}>
                Thông tin thiết bị
              </Text>
              <Text style={{
                fontSize: 14,
                color: '#64748b',
                marginTop: 2,
              }}>
                Chi tiết cấu hình
              </Text>
            </View>
            <Ionicons 
              name={sections.deviceInfo ? 'chevron-up' : 'chevron-down'} 
              size={24} 
              color="#64748b" 
            />
          </TouchableOpacity>

          {sections.deviceInfo && (
            <>
              {/* Action Buttons */}
              <View style={{
                flexDirection: 'row',
                justifyContent: 'flex-end',
                marginBottom: 16,
              }}>
                <TouchableOpacity
                  onPress={handlerFetchInformationDevice}
                  style={{
                    backgroundColor: isFetching ? '#6b7280' : '#3b82f6',
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 10,
                    flexDirection: 'row',
                    alignItems: 'center',
                    shadowColor: '#3b82f6',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.2,
                    shadowRadius: 4,
                    elevation: 3,
                  }}
                  disabled={isFetching}
                >
                  {isFetching ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="refresh" size={16} color="white" style={{ marginRight: 6 }} />
                      <Text style={{ color: 'white', fontSize: 14, fontWeight: '500' }}>
                        Làm mới thông tin
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              <View style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
              }}>
            {/* Device ID */}
            <View style={{
              width: '48%',
              backgroundColor: '#f8fafc',
              padding: 16,
              borderRadius: 12,
              marginBottom: 12,
              borderWidth: 1,
              borderColor: '#e2e8f0',
            }}>
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginBottom: 8,
              }}>
                <Ionicons name="finger-print" size={16} color="#3b82f6" style={{ marginRight: 6 }} />
                <Text style={{
                  fontSize: 14,
                  fontWeight: '500',
                  color: '#64748b',
                }}>
                  ID Thiết bị
                </Text>
              </View>
              <Text style={{
                fontSize: 16,
                fontWeight: '600',
                color: '#1e293b',
              }}>
                {deviceInfo.id}
              </Text>
            </View>

            {/* Temperature */}
            <View style={{
              width: '48%',
              backgroundColor: '#f8fafc',
              padding: 16,
              borderRadius: 12,
              marginBottom: 12,
              borderWidth: 1,
              borderColor: '#e2e8f0',
            }}>
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginBottom: 8,
              }}>
                <Ionicons name="thermometer" size={16} color="#ef4444" style={{ marginRight: 6 }} />
                <Text style={{
                  fontSize: 14,
                  fontWeight: '500',
                  color: '#64748b',
                }}>
                  Nhiệt độ
                </Text>
              </View>
              <Text style={{
                fontSize: 16,
                fontWeight: '600',
                color: '#1e293b',
              }}>
                {deviceInfo.temperature}°C
              </Text>
            </View>

            {/* Firmware */}
            <View style={{
              width: '48%',
              backgroundColor: '#f8fafc',
              padding: 16,
              borderRadius: 12,
              marginBottom: 12,
              borderWidth: 1,
              borderColor: '#e2e8f0',
            }}>
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginBottom: 8,
              }}>
                <Ionicons name="code-slash" size={16} color="#10b981" style={{ marginRight: 6 }} />
                <Text style={{
                  fontSize: 14,
                  fontWeight: '500',
                  color: '#64748b',
                }}>
                  Firmware
                </Text>
              </View>
              <Text style={{
                fontSize: 16,
                fontWeight: '600',
                color: '#1e293b',
              }}>
                {deviceInfo.firmware}
              </Text>
            </View>

            {/* Power */}
            <View style={{
              width: '48%',
              backgroundColor: '#f8fafc',
              padding: 16,
              borderRadius: 12,
              marginBottom: 12,
              borderWidth: 1,
              borderColor: '#e2e8f0',
            }}>
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginBottom: 8,
              }}>
                <Ionicons name="flash" size={16} color="#f59e0b" style={{ marginRight: 6 }} />
                <Text style={{
                  fontSize: 14,
                  fontWeight: '500',
                  color: '#64748b',
                }}>
                  Công suất
                </Text>
              </View>
              <Text style={{
                fontSize: 16,
                fontWeight: '600',
                color: '#1e293b',
              }}>
                {deviceInfo.power} dBm
              </Text>
            </View>

            {/* Current Mode */}
            <View style={{
              width: '100%',
              backgroundColor: '#f8fafc',
              padding: 16,
              borderRadius: 12,
              marginBottom: 12,
              borderWidth: 1,
              borderColor: '#e2e8f0',
            }}>
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginBottom: 8,
              }}>
                <Ionicons name="settings" size={16} color="#8b5cf6" style={{ marginRight: 6 }} />
                <Text style={{
                  fontSize: 14,
                  fontWeight: '500',
                  color: '#64748b',
                }}>
                  Chế độ hiện tại
                </Text>
              </View>
              <Text style={{
                fontSize: 16,
                fontWeight: '600',
                color: '#1e293b',
              }}>
                {deviceInfo.currentMode?.name || 'Chưa xác định'}
              </Text>
            </View>
            </View>
            </>
          )}
        </View>
        {/* Configuration Settings Section */}
        <View style={{
          marginHorizontal: 20,
          marginBottom: 30,
          backgroundColor: '#fff',
          borderRadius: 16,
          padding: 20,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          elevation: 4,
        }}>
          <TouchableOpacity
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: 20,
            }}
            onPress={() => toggleSection('config')}
            activeOpacity={0.7}
          >
            <View style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: '#10b981',
              justifyContent: 'center',
              alignItems: 'center',
              marginRight: 12,
            }}>
              <Ionicons name="cog" size={20} color="white" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{
                fontSize: 18,
                fontWeight: '600',
                color: '#1e293b',
              }}>
                Cài đặt cấu hình
              </Text>
              <Text style={{
                fontSize: 14,
                color: '#64748b',
                marginTop: 2,
              }}>
                Điều chỉnh thông số
              </Text>
            </View>
            <Ionicons 
              name={sections.config ? 'chevron-up' : 'chevron-down'} 
              size={24} 
              color="#64748b" 
            />
          </TouchableOpacity>

          {sections.config && (
            <>
              {/* Power Setting */}
              <View style={{ marginBottom: 20 }}>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: 12,
            }}>
              <Ionicons name="flash" size={18} color="#f59e0b" style={{ marginRight: 8 }} />
              <Text style={{
                fontSize: 16,
                fontWeight: '500',
                color: '#1e293b',
              }}>
                Công suất (dBm)
              </Text>
            </View>
            <View style={{
              backgroundColor: '#f8fafc',
              borderRadius: 12,
              borderWidth: 1,
              borderColor: '#e2e8f0',
              overflow: 'hidden',
            }}>
              <Picker
                style={{
                  backgroundColor: 'transparent',
                }}
                selectedValue={deviceInfo.power}
                onValueChange={(itemValue) => {
                  handlerSelectedPower(itemValue);
                }}
              >
                {DBMS.map(dbm => (
                  <Picker.Item key={dbm} label={`${dbm} dBm`} value={dbm} />
                ))}
              </Picker>
            </View>
          </View>

          {/* Mode Setting */}
          <View>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: 12,
            }}>
              <Ionicons name="settings" size={18} color="#8b5cf6" style={{ marginRight: 8 }} />
              <Text style={{
                fontSize: 16,
                fontWeight: '500',
                color: '#1e293b',
              }}>
                Chế độ hoạt động
              </Text>
            </View>
            <View style={{
              backgroundColor: '#f8fafc',
              borderRadius: 12,
              borderWidth: 1,
              borderColor: '#e2e8f0',
              overflow: 'hidden',
            }}>
              <Picker
                style={{
                  backgroundColor: 'transparent',
                }}
                selectedValue={deviceInfo.currentMode?.id}
                onValueChange={(itemValue) => {
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
            </>
          )}
        </View>

        {/* Alert Configuration Section */}
        <View style={{
          marginHorizontal: 20,
          marginBottom: 20,
          backgroundColor: '#fff',
          borderRadius: 16,
          padding: 20,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          elevation: 4,
        }}>
          <TouchableOpacity
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: 20,
            }}
            onPress={() => toggleSection('alert')}
            activeOpacity={0.7}
          >
            <View style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: '#dc2626',
              justifyContent: 'center',
              alignItems: 'center',
              marginRight: 12,
            }}>
              <Ionicons name="warning" size={20} color="white" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{
                fontSize: 18,
                fontWeight: '600',
                color: '#1f2937',
                marginBottom: 2,
              }}>
                Chế Độ Cảnh Báo
              </Text>
              <Text style={{
                fontSize: 14,
                color: '#6b7280',
              }}>
                {isAlertMode 
                  ? `Cảnh báo đang hoạt động • ${alertSettings.host}:${alertSettings.port}` 
                  : 'Cấu hình WiFi và cài đặt cảnh báo'
                }
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              
              <Ionicons 
                name={sections.alert ? 'chevron-up' : 'chevron-down'} 
                size={24} 
                color="#64748b" 
              />
            </View>
          </TouchableOpacity>

          {sections.alert && (
            <>
              {/* WiFi Configuration */}
              <View style={{
                backgroundColor: '#f9fafb',
                borderRadius: 12,
                padding: 16,
                marginBottom: 16,
              }}>
                <Text style={{
                  fontSize: 16,
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: 12,
                }}>
                  Cấu Hình WiFi
                </Text>

                <View style={{ marginBottom: 12 }}>
                  <Text style={{ 
                    fontSize: 14,
                    color: '#6b7280',
                    marginBottom: 6,
                  }}>
                    Tên WiFi
                  </Text>
                  <TextInput
                    style={{
                      borderWidth: 1,
                      borderColor: '#d1d5db',
                      borderRadius: 8,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      backgroundColor: '#fff',
                      fontSize: 14,
                    }}
                    placeholder="Nhập tên WiFi"
                    value={alertSettings.wifiName}
                    onChangeText={text =>
                      setAlertSettings({ ...alertSettings, wifiName: text })
                    }
                    placeholderTextColor="#9ca3af"
                  />
                </View>

                <View style={{ marginBottom: 12 }}>
                  <Text style={{ 
                    fontSize: 14,
                    color: '#6b7280',
                    marginBottom: 6,
                  }}>
                    Mật Khẩu WiFi
                  </Text>
                  <TextInput
                    style={{
                      borderWidth: 1,
                      borderColor: '#d1d5db',
                      borderRadius: 8,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      backgroundColor: '#fff',
                      fontSize: 14,
                    }}
                    placeholder="Nhập mật khẩu WiFi"
                    value={alertSettings.wifiPassword}
                    onChangeText={text =>
                      setAlertSettings({ ...alertSettings, wifiPassword: text })
                    }
                    placeholderTextColor="#9ca3af"
                    secureTextEntry
                  />
                </View>

                <View style={{ marginBottom: 12 }}>
                  <Text style={{ 
                    fontSize: 14,
                    color: '#6b7280',
                    marginBottom: 6,
                  }}>
                    Địa Chỉ Host
                  </Text>
                  <TextInput
                    style={{
                      borderWidth: 1,
                      borderColor: '#d1d5db',
                      borderRadius: 8,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      backgroundColor: '#fff',
                      fontSize: 14,
                    }}
                    placeholder="Nhập địa chỉ host"
                    value={alertSettings.host}
                    onChangeText={text =>
                      setAlertSettings({ ...alertSettings, host: text })
                    }
                    placeholderTextColor="#9ca3af"
                  />
                </View>

                <View style={{ marginBottom: 16 }}>
                  <Text style={{ 
                    fontSize: 14,
                    color: '#6b7280',
                    marginBottom: 6,
                  }}>
                    Port
                  </Text>
                  <TextInput
                    style={{
                      borderWidth: 1,
                      borderColor: '#d1d5db',
                      borderRadius: 8,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      backgroundColor: '#fff',
                      fontSize: 14,
                    }}
                    placeholder="Nhập cổng"
                    value={alertSettings.port}
                    onChangeText={text =>
                      setAlertSettings({ ...alertSettings, port: text })
                    }
                    placeholderTextColor="#9ca3af"
                    keyboardType="numeric"
                  />
                </View>

                <TouchableOpacity
                  style={{
                    backgroundColor: '#10b981',
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    borderRadius: 8,
                    flexDirection: 'row',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                  onPress={handlerSaveAlertSettings}
                  disabled={isSettingAlert}
                >
                  {isSettingAlert ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="save" size={16} color="white" style={{ marginRight: 8 }} />
                      <Text style={{ color: '#fff', fontWeight: '600' }}>
                        Lưu Cài Đặt
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {/* Alert Control */}
              <View style={{
                backgroundColor: '#fef2f2',
                borderRadius: 12,
                padding: 16,
                borderWidth: 1,
                borderColor: '#fecaca',
              }}>
                <Text style={{
                  fontSize: 16,
                  fontWeight: '600',
                  color: '#dc2626',
                  marginBottom: 8,
                }}>
                  Alert Control
                </Text>
                
                <Text style={{
                  fontSize: 14,
                  color: '#7f1d1d',
                  marginBottom: 16,
                  lineHeight: 20,
                }}>
                  {isAlertMode 
                    ? 'Alert mode is currently active. The device will scan and alert for unauthorized RFID tags.'
                    : 'Start alert mode to enable continuous scanning and alerting for unauthorized RFID tags.'
                  }
                </Text>

                <TouchableOpacity
                  style={{
                    backgroundColor: isAlertMode ? '#dc2626' : '#16a34a',
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    borderRadius: 8,
                    flexDirection: 'row',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                  onPress={isAlertMode ? handlerStopAlert : handlerStartAlert}
                  disabled={!bluetoothState.isConnected}
                >
                  <Ionicons 
                    name={isAlertMode ? "stop" : "play"} 
                    size={16} 
                    color="white" 
                    style={{ marginRight: 8 }} 
                  />
                  <Text style={{ 
                    color: '#fff', 
                    fontWeight: '600',
                    fontSize: 16,
                  }}>
                    {isAlertMode ? 'Stop Alert' : 'Start Alert'}
                  </Text>
                </TouchableOpacity>

                {!bluetoothState.isConnected && (
                  <Text style={{
                    fontSize: 12,
                    color: '#9ca3af',
                    textAlign: 'center',
                    marginTop: 8,
                  }}>
                    Connect to a device to enable alert mode
                  </Text>
                )}
              </View>
            </>
          )}
        </View>

        {/* Inventory Control Section */}
        <View style={{
          marginHorizontal: 20,
          marginBottom: 30,
          backgroundColor: '#fff',
          borderRadius: 16,
          padding: 20,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          elevation: 4,
        }}>
          <TouchableOpacity
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: 20,
            }}
            onPress={() => toggleSection('inventory')}
            activeOpacity={0.7}
          >
            <View style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: isInventoryRunning ? '#ef4444' : '#3b82f6',
              justifyContent: 'center',
              alignItems: 'center',
              marginRight: 12,
            }}>
              <Ionicons 
                name={isInventoryRunning ? "stop" : "play"} 
                size={20} 
                color="white" 
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{
                fontSize: 18,
                fontWeight: '600',
                color: '#1e293b',
              }}>
                Điều khiển Inventory
              </Text>
              <Text style={{
                fontSize: 14,
                color: isInventoryRunning ? '#ef4444' : '#64748b',
                marginTop: 2,
              }}>
                {isInventoryRunning ? 'Đang chạy' : 'Đã dừng'}
              </Text>
            </View>
            <Ionicons 
              name={sections.inventory ? 'chevron-up' : 'chevron-down'} 
              size={24} 
              color="#64748b" 
            />
          </TouchableOpacity>

          {sections.inventory && (
            <>
              {/* Control Buttons */}
              <View style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                marginBottom: 20,
              }}>
                <TouchableOpacity
                  onPress={handlerStartInventory}
                  disabled={isInventoryRunning || !bluetoothState.isConnected}
                  style={{
                    flex: 1,
                    backgroundColor: isInventoryRunning || !bluetoothState.isConnected ? '#6b7280' : '#10b981',
                    padding: 16,
                    borderRadius: 12,
                    marginRight: 8,
                    flexDirection: 'row',
                    justifyContent: 'center',
                    alignItems: 'center',
                    shadowColor: '#10b981',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.2,
                    shadowRadius: 4,
                    elevation: 3,
                  }}
                >
                  <Ionicons name="play" size={20} color="white" style={{ marginRight: 8 }} />
                  <Text style={{ color: 'white', fontSize: 16, fontWeight: '500' }}>
                    Bắt đầu
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handlerStopInventory}
                  disabled={!isInventoryRunning || !bluetoothState.isConnected}
                  style={{
                    flex: 1,
                    backgroundColor: !isInventoryRunning || !bluetoothState.isConnected ? '#6b7280' : '#ef4444',
                    padding: 16,
                    borderRadius: 12,
                    marginLeft: 8,
                    flexDirection: 'row',
                    justifyContent: 'center',
                    alignItems: 'center',
                    shadowColor: '#ef4444',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.2,
                    shadowRadius: 4,
                    elevation: 3,
                  }}
                >
                  <Ionicons name="stop" size={20} color="white" style={{ marginRight: 8 }} />
                  <Text style={{ color: 'white', fontSize: 16, fontWeight: '500' }}>
                    Dừng lại
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Statistics */}
              <View style={{
                backgroundColor: '#f8fafc',
                borderRadius: 12,
                padding: 16,
                borderWidth: 1,
                borderColor: '#e2e8f0',
              }}>
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginBottom: 12,
                }}>
                  <Ionicons name="stats-chart" size={18} color="#3b82f6" style={{ marginRight: 8 }} />
                  <Text style={{
                    fontSize: 16,
                    fontWeight: '500',
                    color: '#1e293b',
                  }}>
                    Thống kê quét
                  </Text>
                </View>

                <View style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <View>
                    <Text style={{
                      fontSize: 14,
                      color: '#64748b',
                      marginBottom: 4,
                    }}>
                      RFID Tags đã quét
                    </Text>
                    <Text style={{
                      fontSize: 24,
                      fontWeight: '700',
                      color: '#1e293b',
                    }}>
                      {memoizedStats.totalCount}
                    </Text>
                  </View>
                  
                  <View style={{
                    alignItems: 'center',
                  }}>
                    <View style={{
                      width: 60,
                      height: 60,
                      borderRadius: 30,
                      backgroundColor: isInventoryRunning ? '#10b981' : '#6b7280',
                      justifyContent: 'center',
                      alignItems: 'center',
                      marginBottom: 8,
                    }}>
                      <Ionicons 
                        name="radio" 
                        size={24} 
                        color="white" 
                      />
                    </View>
                    <Text style={{
                      fontSize: 12,
                      color: '#64748b',
                      textAlign: 'center',
                    }}>
                      {isInventoryRunning ? 'Đang quét' : 'Đã dừng'}
                    </Text>
                  </View>
                </View>

                {/* Tags List - hiển thị full RFID đã quét */}
                {memoizedStats.uniqueCount > 0 && (
                  <View style={{ marginTop: 16 }}>
                    <View style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 8,
                    }}>
                      <Text style={{
                        fontSize: 14,
                        fontWeight: '500',
                        color: '#64748b',
                      }}>
                        Danh sách thẻ RFID đã quét ({memoizedStats.uniqueCount})
                      </Text>
                    </View>
                    <ScrollView 
                      style={{ maxHeight: 400 }}
                      showsVerticalScrollIndicator={true}
                      nestedScrollEnabled={true}
                      removeClippedSubviews={true}
                    >
                      {memoizedStats.allTags.map(([tag, count], index) => (
                        <View key={tag} style={{
                          backgroundColor: '#fff',
                          padding: 12,
                          borderRadius: 8,
                          marginBottom: 6,
                          borderWidth: 1,
                          borderColor: '#e2e8f0',
                          flexDirection: 'row',
                          alignItems: 'center',
                        }}>
                          <View style={{
                            width: 24,
                            height: 24,
                            borderRadius: 12,
                            backgroundColor: '#3b82f6',
                            justifyContent: 'center',
                            alignItems: 'center',
                            marginRight: 12,
                          }}>
                            <Text style={{
                              color: 'white',
                              fontSize: 12,
                              fontWeight: '600',
                            }}>
                              {index + 1}
                            </Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{
                              fontSize: 14,
                              color: '#1e293b',
                              fontFamily: 'monospace',
                            }}>
                              {tag}
                            </Text>
                            <Text style={{
                              fontSize: 12,
                              color: '#64748b',
                              marginTop: 2,
                            }}>
                              Số lần quét: {count}
                            </Text>
                          </View>
                          <View style={{
                            backgroundColor: '#10b981',
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                            borderRadius: 12,
                          }}>
                            <Text style={{
                              color: 'white',
                              fontSize: 12,
                              fontWeight: '600',
                            }}>
                              {count}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
};
