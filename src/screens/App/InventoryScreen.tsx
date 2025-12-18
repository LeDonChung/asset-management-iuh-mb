import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  Dimensions,
  FlatList,
} from 'react-native';
import { useSelector } from 'react-redux';
import { useRoute, RouteProp, useNavigation, useFocusEffect } from '@react-navigation/native';
import { RootState } from '../../redux/store';
import { useAppDispatch } from '../../redux/hooks';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { 
  setRfidConnected,
  setScanning,
  saveTempInventoryResults,
  getTempInventoryResults,
  deleteTempInventoryResults,
  submitInventoryResult,
  classifyRfids,
  clearClassifyRfidsResult,
  setClassifyRfidsLoading,
  saveTempAdjacentInventoryResults,
  getTempAdjacentInventoryResults,
  deleteTempAdjacentInventoryResults,
  AssetActionStatus,
  ScanMethod,
  SaveTempInventoryRequest,
  SaveTempAdjacentInventoryRequest,
  AdjacentAssetInventoryDetail,
  RoomAdjacentResult,
  TempAdjacentInventoryResponse,
} from '../../redux/slices/InventorySlice';
import { 
  scanDevices, 
  connectToDevice, 
  disconnectDevice,
  addLog
} from '../../redux/slices/BluetoothSlice';
import { 
  processResponse, 
  startInventory, 
  stopInventory, 
  resetScannedTagsMap, 
  setDevice
} from '../../redux/slices/DeviceSlice';
import { deviceCommandManager } from '../../utils/DeviceCommands';

import { getAssetBookInventoryFromUnitIdAndRoomId } from '../../redux/slices/AssetBookSlice';
import { RootStackParamList } from '../../types/navigation';
import { AssetType } from '../../types';

const ASSET_ACTION_STATUS = {
  MATCHED: 'MATCHED',
  MISSING: 'MISSING',
  EXCESS: 'EXCESS',
  BROKEN: 'BROKEN'
} as const;

const SafeAssetActionStatus = AssetActionStatus || ASSET_ACTION_STATUS;
const AssetItem = ({ 
  asset, 
  result, 
  onQuantityChange,
  assetType
}: {
  asset: any;
  result: any;
  onQuantityChange: (assetId: string, quantity: number) => void;
  assetType: AssetType;
}) => {
  const countedQuantity = result?.quantity || 0;
  const systemQuantity = asset.quantity;
  const status = result?.status || SafeAssetActionStatus.MISSING;
  
  const getStatusInfo = (status: string) => {
    switch (status) {
      case SafeAssetActionStatus.MATCHED:
        return { text: 'Khớp', color: '#10B981', bgColor: '#10B98120' };
      case SafeAssetActionStatus.MISSING:
        return { text: 'Thiếu', color: '#EF4444', bgColor: '#EF444420' };
      case SafeAssetActionStatus.EXCESS:
        return { text: 'Thừa', color: '#F59E0B', bgColor: '#F59E0B20' };
      default:
        return { text: 'Chưa kiểm', color: '#6B7280', bgColor: '#6B728020' };
    }
  };

  const statusInfo = getStatusInfo(status);

  const isUnscanned = countedQuantity === 0;
  const showUnscannedStyle = isUnscanned && assetType === AssetType.FIXED_ASSET;

  return (
    <View style={[
      styles.tempAdjacentAssetCardSimple,
      showUnscannedStyle && styles.unscannedAssetCard,
      assetType === AssetType.TOOLS_EQUIPMENT && styles.toolsEquipmentCard
    ]}>
      <View style={styles.tempAdjacentHeader}>
        <View style={styles.tempAdjacentInfo}>
          {showUnscannedStyle && (
            <View style={styles.unscannedIndicator}>
              <Ionicons name="alert-circle-outline" size={12} color="#F59E0B" />
              <Text style={styles.unscannedText}>Chưa quét</Text>
            </View>
          )}
          <Text style={styles.tempAdjacentAssetId}>{asset.asset?.ktCode || 'Mã tài sản'}</Text>
          <Text style={styles.tempAdjacentAssetName} numberOfLines={1}>
            {asset.asset?.name || 'Tên tài sản'}
          </Text>
          {asset.asset?.locationInRoom && (
            <Text style={styles.tempAdjacentLocationText}>
              Vị trí: {asset.asset.locationInRoom}
            </Text>
          )}
        </View>
        <View style={[styles.statusBadgeSimple, { backgroundColor: statusInfo.bgColor }]}>
          <Text style={[styles.statusBadgeTextSimple, { color: statusInfo.color }]}>
            {statusInfo.text}
          </Text>
        </View>
      </View>

      {/* Hiển thị khác nhau cho tài sản cố định và công cụ dụng cụ */}
      {assetType === AssetType.FIXED_ASSET ? (
        // Tài sản cố định: chỉ hiển thị nút xác nhận nếu chưa quét
        status === SafeAssetActionStatus.MISSING ? (
          <View style={styles.fixedAssetConfirmSection}>
            <TouchableOpacity 
              style={styles.confirmButton}
              onPress={() => onQuantityChange(asset.assetId, 1)}
            >
              <Ionicons name="checkmark-circle-outline" size={20} color="#10B981" />
              <Text style={styles.confirmButtonText}>Xác nhận có mặt</Text>
            </TouchableOpacity>
          </View>
        ) : null
      ) : (
        // Công cụ dụng cụ: hiển thị như cũ
        <View style={styles.tempAdjacentQuantitySection}>
          <View style={styles.tempAdjacentQuantityItem}>
            <Text style={styles.tempAdjacentQuantityLabel}>Sổ tài sản</Text>
            <View style={styles.tempAdjacentQuantityValue}>
              <Text style={styles.tempAdjacentQuantityText}>{systemQuantity}</Text>
            </View>
          </View>
          
          <View style={styles.tempAdjacentQuantityItem}>
            <Text style={styles.tempAdjacentQuantityLabel}>Kiểm kê</Text>
            <View style={styles.tempAdjacentQuantityInputContainer}>
              <TouchableOpacity 
                style={styles.tempAdjacentQuantityButton}
                onPress={() => onQuantityChange(asset.assetId, Math.max(0, countedQuantity - 1))}
              >
                <Ionicons name="remove" size={20} color="#6B7280" />
              </TouchableOpacity>
              <TextInput
                style={styles.tempAdjacentQuantityInput}
                value={countedQuantity.toString()}
                onChangeText={(text) => onQuantityChange(asset.assetId, parseInt(text) || 0)}
                keyboardType="numeric"
                placeholder="0"
                textAlign="center"
              />
              <TouchableOpacity 
                style={styles.tempAdjacentQuantityButton}
                onPress={() => onQuantityChange(asset.assetId, countedQuantity + 1)}
              >
                <Ionicons name="add" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

    </View>
  );
};

type InventoryScreenRouteProp = RouteProp<RootStackParamList, 'InventoryScreen'>;

export const InventoryScreen = () => {
  const dispatch = useAppDispatch();
  const navigation = useNavigation();
  const route = useRoute<InventoryScreenRouteProp>();
  
  const { roomId, unitId, assignmentId, sessionId, room, unit, session } = route.params;
  const {
    saveTempResultsLoading,
    submitResultLoading,
    classifyRfidsResult,
    classifyRfidsLoading,
    saveAdjacentTempResultsLoading,
    adjacentTempResults,
    adjacentTempResultsLoading,
    deleteAdjacentTempResultsLoading,
  } = useSelector((state: RootState) => state.inventory);

  const bluetoothState = useSelector((state: RootState) => state.bluetooth);
  const device = useSelector((state: RootState) => state.device.device);

  const { assetBookInventory, loading: assetBookLoading, error: assetBookError } = useSelector((state: RootState) => state.assetBook);
  const [showDeviceList, setShowDeviceList] = useState(false);
  const [inventoryResults, setInventoryResults] = useState<{[assetId: string]: any}>({});
  const [selectedAssetType, setSelectedAssetType] = useState<AssetType>(AssetType.FIXED_ASSET);
  const [showRoomInfo, setShowRoomInfo] = useState(true);
  const [isInventoryRunning, setIsInventoryRunning] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [hasDeletedTemp, setHasDeletedTemp] = useState(false);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  
  
  const [classifiedRfids, setClassifiedRfids] = useState<Set<string>>(new Set());
  
  const [activeClassificationTab, setActiveClassificationTab] = useState<'neighbors' | 'otherRooms'>('neighbors');
  const [restoredClassificationResults, setRestoredClassificationResults] = useState<{
    neighbors: any[];
    otherRooms: any[];
  } | null>(null);
  
  const [removedOtherAssets, setRemovedOtherAssets] = useState<Set<string>>(new Set());
  const [checkedOtherAssets, setCheckedOtherAssets] = useState<Set<string>>(new Set());
  
  const [tempAdjacentAssets, setTempAdjacentAssets] = useState<{[assetId: string]: any}>({});
  const [showTempAdjacentAssets, setShowTempAdjacentAssets] = useState(false);

  useEffect(() => {
    if (device && bluetoothState.isConnected) {
      deviceCommandManager.setupMonitoring(
        device,
        (response) => {
          dispatch(processResponse(response));
          
          if (response.cmd === 'cmd_customized_session_target_inventory_start' && response.tags) {
            handleRfidTagsDetected(response.tags);
          } else if (response.cmd === 'cmd_customized_session_target_inventory_stop') {
            setIsInventoryRunning(false);
            setIsStopping(false);
            dispatch(setScanning(false));
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
  }, [device, bluetoothState.isConnected, dispatch]);
  const handleRfidTagsDetected = async (rfidTags: string[]) => {
    const unknownRfids: string[] = [];
    
    rfidTags.forEach(rfidId => {
      const matchedAsset = findAssetByRfidId(rfidId);
      
      if (matchedAsset) {
        updateInventoryResultForRfidMatch(matchedAsset);
      } else {
        const tempAdjacentAsset = Object.entries(tempAdjacentAssets).find(([_, asset]) => 
          asset.rfidTag === rfidId || asset.assetId === rfidId || asset.ktCode === rfidId
        );
        
        if (tempAdjacentAsset) {
          const [assetId, asset] = tempAdjacentAsset;
          const currentRecheckQuantity = asset.recheckQuantity || 0;
          handleTempAdjacentRecheck(assetId, currentRecheckQuantity + 1);
        } else {
          if (!classifiedRfids.has(rfidId)) {
            unknownRfids.push(rfidId);
          }
        }
      }
    });
    if (unknownRfids.length > 0) {
      await handleClassifyRfids(unknownRfids);
    }
  };

  const findAssetByRfidId = (rfidId: string) => {
    if (!assetBookInventory?.assetTypes) return null;
    
    for (const assetType of assetBookInventory.assetTypes) {
      for (const item of assetType.items) {
        if (item.asset?.rfidTag?.rfidId === rfidId) {
          return item;
        }
      }
    }
    return null;
  };
  const updateTempAdjacentAssetFromInventory = (asset: any) => {
    const assetId = asset.assetId;
    
    setTempAdjacentAssets(prev => {
      if (prev[assetId]) {
        return {
          ...prev,
          [assetId]: {
            ...prev[assetId],
            quantity: 1,
            recheckQuantity: 1,
            status: SafeAssetActionStatus.MATCHED,
            updatedAt: new Date().toISOString(),
            scanMethod: ScanMethod.RFID,
          }
        };
      }
      return prev;
    });
  };

  const updateInventoryResultForRfidMatch = (asset: any) => {
    const assetId = asset.assetId;
    const systemQuantity = asset.quantity;
    
    // Reset hasDeletedTemp when RFID scan creates new data
    setHasDeletedTemp(false);
    
    setInventoryResults(prev => {
      const currentResult = prev[assetId];
      const currentQuantity = currentResult?.quantity || 0;
      
      if (currentQuantity > 0) {
        return prev;
      }
      
      return {
        ...prev,
        [assetId]: {
          ...prev[assetId],
          quantity: 1, 
          systemQuantity,
          status: SafeAssetActionStatus.MATCHED,
          updatedAt: new Date().toISOString(),
          scanMethod: ScanMethod.RFID,
        },
      };
    });
    updateTempAdjacentAssetFromInventory(asset);
  };
  const handleClassifyRfids = async (rfids: string[]) => {
    if (rfids.length === 0) return;

    dispatch(setClassifyRfidsLoading(true));
    try {
      const result = await dispatch(classifyRfids({
        rfids,
        currentRoomId: roomId,
        currentUnitId: unitId
      })).unwrap();

      const newInventoryResults: {[key: string]: any} = {};
      result.neighbors.forEach((asset: any) => {
        const key = asset.id;
        if (!inventoryResults[key]) {
          newInventoryResults[key] = {
            quantity: 1,
            systemQuantity: 1,
            status: SafeAssetActionStatus.MATCHED,
            updatedAt: new Date().toISOString(),
            scanMethod: ScanMethod.RFID,
            assetType: 'neighbor',
          };
        }
      });
      result.otherRooms.forEach((asset: any) => {
        const key = asset.id;
        if (!inventoryResults[key]) {
          newInventoryResults[key] = {
            quantity: 1,
            systemQuantity: 1,
            status: SafeAssetActionStatus.MATCHED,
            updatedAt: new Date().toISOString(),
            scanMethod: ScanMethod.RFID,
            assetType: 'other',
          };
        }
      });
      if (Object.keys(newInventoryResults).length > 0) {
        setInventoryResults(prev => ({
          ...prev,
          ...newInventoryResults
        }));
      }
      setClassifiedRfids(prev => {
        const newSet = new Set(prev);
        rfids.forEach(rfid => newSet.add(rfid));
        return newSet;
      });
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể phân loại RFID tags');
    } finally {
      dispatch(setClassifyRfidsLoading(false));
    }
  };

  useEffect(() => {
    const loadAllData = async () => {
      if (!unitId || !roomId || !assignmentId) {
        return;
      }

      try {
        const assetBookResult = await dispatch(getAssetBookInventoryFromUnitIdAndRoomId({
          unitId,
          roomId,
        })).unwrap();
        if (assetBookResult?.assetTypes) {
          const initialResults: { [key: string]: any } = {};
          assetBookResult.assetTypes.forEach((assetType: any) => {
            assetType.items.forEach((item: any) => {
              initialResults[item.assetId] = {
                quantity: 0,
                systemQuantity: item.quantity,
                status: SafeAssetActionStatus.MISSING,
                note: '',
                imageUrls: [],
                updatedAt: new Date().toISOString(),
              };
            });
          });
          setInventoryResults(initialResults);
        }
        if (roomId) {
          try {
            const tempAdjacentResults = await dispatch(getTempAdjacentInventoryResults(roomId)).unwrap();
            if (tempAdjacentResults?.result && tempAdjacentResults.result.length > 0) {
              const adjacentAssets: {[assetId: string]: any} = {};
              tempAdjacentResults.result.forEach((asset: any) => {
                adjacentAssets[asset.assetId] = {
                  ...asset,
                  roomCode: asset.roomCode || asset.roomId || roomId,
                  originalRoomId: asset.roomId || roomId,
                  isTempAdjacent: true,
                  createdAt: tempAdjacentResults.createdAt,
                  expiresAt: tempAdjacentResults.expiresAt,
                  // Preserve metadata from backend
                  ktCode: asset.ktCode,
                  name: asset.name,
                  rfidTag: asset.rfidTag,
                };
              });
              
              if (Object.keys(adjacentAssets).length > 0) {
                setTempAdjacentAssets(adjacentAssets);
                setShowTempAdjacentAssets(true);
              }
            }
          } catch (error) {
          }
        }
        if (roomId) {
          try {
            const tempResults = await dispatch(getTempInventoryResults(roomId)).unwrap();
            if (tempResults?.inventoryResults) {
              setInventoryResults(tempResults.inventoryResults);
              
              const neighborAssets: any[] = [];
              const otherRoomAssets: any[] = [];
              
              Object.entries(tempResults.inventoryResults).forEach(([assetId, result]: [string, any]) => {
                if (result.assetType === 'neighbor') {
                  const existsInAssetBook = assetBookAssetIds.has(assetId);
                  if (!existsInAssetBook) {
                    neighborAssets.push({
                      id: assetId,
                      ktCode: result.ktCode || assetId,
                      name: result.name || 'Tài sản hàng xóm',
                      currentRoom: {
                        id: result.roomId || roomId,
                        roomCode: result.roomCode || 'N/A'
                      }
                    });
                  }
                } else if (result.assetType === 'other') {
                  const existsInAssetBook = assetBookAssetIds.has(assetId);
                  if (!existsInAssetBook) {
                    otherRoomAssets.push({
                      id: assetId,
                      ktCode: result.ktCode || assetId,
                      name: result.name || 'Tài sản phòng khác',
                      currentRoom: {
                        id: result.roomId || roomId,
                        roomCode: result.roomCode || 'N/A'
                      }
                    });
                    if (result.quantity > 0) {
                      setCheckedOtherAssets(prev => new Set([...prev, assetId]));
                    }
                  }
                }
              });
              if (neighborAssets.length > 0 || otherRoomAssets.length > 0) {
                const tempRfidTags = new Set<string>();
                Object.entries(tempResults.inventoryResults).forEach(([assetId, result]: [string, any]) => {
                  if (result.assetType === 'neighbor' || result.assetType === 'other') {
                    tempRfidTags.add(result.rfidTag || assetId);
                  }
                });
                setClassifiedRfids(tempRfidTags);
                setRestoredClassificationResults({
                  neighbors: neighborAssets,
                  otherRooms: otherRoomAssets
                });
              }
            }
          } catch (error) {
          }
        }
      } catch (error: any) {
        const errorMessage = error?.message || 'Không thể tải dữ liệu sổ tài sản';
        Alert.alert('Lỗi', errorMessage);
      }
    };

    loadAllData();
  }, [dispatch, unitId, roomId, assignmentId]);
  useEffect(() => {
    if (assetBookError) {
      Alert.alert('Lỗi', assetBookError);
    }
  }, [assetBookError]);


  const getAssetsByType = (type: AssetType) => {
    if (!assetBookInventory?.assetTypes) return [];
    
    const assetTypeData = assetBookInventory.assetTypes.find(
      (at: any) => at.type === type
    );
    return assetTypeData?.items || [];
  };

  const currentAssets = useMemo(() => {
    const assets = getAssetsByType(selectedAssetType);
    
    // Create a shallow copy to avoid mutating the original array
    const assetsCopy = [...assets];
    
    // Sort assets: unscanned first, then by location
    return assetsCopy.sort((a, b) => {
      const aResult = inventoryResults[a.assetId];
      const bResult = inventoryResults[b.assetId];
      
      const aScanned = aResult?.quantity > 0;
      const bScanned = bResult?.quantity > 0;
      
      // Priority 1: Unscanned items first
      if (aScanned !== bScanned) {
        return aScanned ? 1 : -1; // Unscanned (false) comes first
      }
      
      // Priority 2: Sort by location in room
      const aLocation = (a.asset as any)?.locationInRoom || '';
      const bLocation = (b.asset as any)?.locationInRoom || '';
      
      if (aLocation !== bLocation) {
        return aLocation.localeCompare(bLocation);
      }
      
      // Priority 3: Sort by asset code as fallback
      const aCode = a.asset?.ktCode || '';
      const bCode = b.asset?.ktCode || '';
      return aCode.localeCompare(bCode);
    });
  }, [selectedAssetType, assetBookInventory, inventoryResults]);
  
  const displayResults = inventoryResults;

  const getAssetBookAssetIds = () => {
    if (!assetBookInventory?.assetTypes) return new Set();
    const assetIds = new Set<string>();
    assetBookInventory.assetTypes.forEach((assetType: any) => {
      assetType.items.forEach((item: any) => {
        assetIds.add(item.assetId);
      });
    });
    return assetIds;
  };

  const assetBookAssetIds = useMemo(() => getAssetBookAssetIds(), [assetBookInventory]);
  const getFilteredNeighbors = useMemo(() => {
    const reduxNeighbors = classifyRfidsResult?.neighbors || [];
    const restoredNeighbors = restoredClassificationResults?.neighbors || [];
    const allNeighbors = [...reduxNeighbors];
    restoredNeighbors.forEach(restored => {
      if (!allNeighbors.find(existing => existing.id === restored.id)) {
        allNeighbors.push(restored);
      }
    });
    
    return allNeighbors.filter((asset: any) => !assetBookAssetIds.has(asset.id));
  }, [classifyRfidsResult, restoredClassificationResults, assetBookAssetIds]);

  const getFilteredOtherRooms = useMemo(() => {
    const reduxOtherRooms = classifyRfidsResult?.otherRooms || [];
    const restoredOtherRooms = restoredClassificationResults?.otherRooms || [];
    const allOtherRooms = [...reduxOtherRooms];
    restoredOtherRooms.forEach(restored => {
      if (!allOtherRooms.find(existing => existing.id === restored.id)) {
        allOtherRooms.push(restored);
      }
    });
    
    return allOtherRooms.filter((asset: any) => !assetBookAssetIds.has(asset.id));
  }, [classifyRfidsResult, restoredClassificationResults, assetBookAssetIds]);
  const handleSaveTempResults = useCallback(async () => {
    if (Object.keys(inventoryResults).length === 0) {
      Alert.alert('Thông báo', 'Không có dữ liệu để lưu tạm');
      return;
    }

    if (!roomId || !unitId || !sessionId) {
      Alert.alert('Lỗi', 'Thiếu thông tin phòng hoặc đơn vị');
      return;
    }

    const enhancedInventoryResults = { ...inventoryResults };
    const neighbors = getFilteredNeighbors;
    neighbors.forEach(asset => {
      if (enhancedInventoryResults[asset.id]) {
        enhancedInventoryResults[asset.id] = {
          ...enhancedInventoryResults[asset.id],
          ktCode: asset.ktCode,
          name: asset.name,
          roomId: asset.currentRoom?.id,
          roomCode: asset.currentRoom?.roomCode,
          assetType: 'neighbor'
        };
      }
    });
    const otherRooms = getFilteredOtherRooms;
    otherRooms.forEach(asset => {
      if (enhancedInventoryResults[asset.id]) {
        enhancedInventoryResults[asset.id] = {
          ...enhancedInventoryResults[asset.id],
          ktCode: asset.ktCode,
          name: asset.name,
          roomId: asset.currentRoom?.id,
          roomCode: asset.currentRoom?.roomCode,
          assetType: 'other'
        };
      }
    });

    const saveData: SaveTempInventoryRequest = {
      roomId,
      unitId,
      sessionId,
      inventoryResults: enhancedInventoryResults,
      note: `Lưu tạm kết quả kiểm kê phòng ${room?.roomCode || roomId}`,
      ttlSeconds: 86400,
    };

    try {
      await dispatch(saveTempInventoryResults(saveData)).unwrap();
      Alert.alert('Thành công', 'Đã lưu tạm kết quả kiểm kê');
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể lưu tạm kết quả kiểm kê');
    }
  }, [inventoryResults, roomId, unitId, sessionId, room?.roomCode, dispatch, getFilteredNeighbors, getFilteredOtherRooms]);

  const handleScanDevices = async () => {
    dispatch(scanDevices());
  };

  const handleSelectDevice = async (selectedDevice: any) => {
    dispatch(setDevice(selectedDevice));
    dispatch(connectToDevice(selectedDevice));
    setShowDeviceList(false);
  };

  const handleConnectRfid = async () => {
    if (!device) {
      Alert.alert('Lỗi', 'Vui lòng chọn thiết bị RFID trước khi kết nối');
      setShowDeviceList(true);
      return;
    }
    
    try {
      await dispatch(connectToDevice(device));
      dispatch(setRfidConnected(true));
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể kết nối thiết bị RFID');
    }
  };

  const handleDisconnectRfid = async () => {
    try {
      await dispatch(disconnectDevice());
      dispatch(setRfidConnected(false));
      dispatch(setScanning(false));
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể ngắt kết nối thiết bị');
    }
  };

  const handleStartScan = async () => {
    if (!device || !bluetoothState.isConnected) {
      Alert.alert('Lỗi', 'Vui lòng kết nối thiết bị RFID trước');
      return;
    }
    
    try {
      dispatch(resetScannedTagsMap());
      dispatch(clearClassifyRfidsResult());
      setClassifiedRfids(new Set());
      await dispatch(startInventory(device));
      setIsInventoryRunning(true);
      dispatch(setScanning(true));
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể bắt đầu quét RFID');
    }
  };

  const handleStopScan = async () => {
    if (!device || isStopping) {
      return;
    }
    
    setIsStopping(true);
    
    // Update UI immediately for better responsiveness
    setIsInventoryRunning(false);
    dispatch(setScanning(false));
    
    try {
      // Stop inventory in background
      await dispatch(stopInventory(device));
    } catch (error) {
      // If stop fails, revert the UI state
      setIsInventoryRunning(true);
      dispatch(setScanning(true));
      Alert.alert('Lỗi', 'Không thể dừng quét RFID');
    } finally {
      setIsStopping(false);
    }
  };

  const handleDeleteTempResults = async () => {
    if (!roomId) {
      Alert.alert('Lỗi', 'Thiếu thông tin phòng');
      return;
    }

    const totalResults = Object.keys(inventoryResults).length;
    if (totalResults === 0) {
      Alert.alert('Thông báo', 'Không có dữ liệu tạm để xóa');
      return;
    }

    Alert.alert(
      'Xác nhận xóa',
      `Bạn có chắc muốn xóa ${totalResults} kết quả kiểm kê tạm thời không?\n\nHành động này không thể hoàn tác.`,
      [
        {
          text: 'Hủy',
          style: 'cancel'
        },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            try {
              setAutoSaveEnabled(false);
              await dispatch(deleteTempInventoryResults(roomId)).unwrap();
              setInventoryResults({});
              setHasDeletedTemp(true);
              Alert.alert('Thành công', 'Đã xóa kết quả tạm thời');
            } catch (error) {
              Alert.alert('Lỗi', 'Không thể xóa kết quả tạm thời');
            }
          }
        }
      ]
    );
  };

  const handleSubmitResults = async () => {
    if (Object.keys(inventoryResults).length === 0) {
      Alert.alert('Thông báo', 'Không có dữ liệu kiểm kê để gửi');
      return;
    }

    if (!assignmentId) {
      Alert.alert(
        'Lỗi', 
        'Thiếu thông tin phân công kiểm kê. Vui lòng quay lại màn hình chọn đơn vị và thử lại.',
        [
          {
            text: 'Quay lại',
            onPress: () => navigation.goBack()
          }
        ]
      );
      return;
    }

    const filteredResults = Object.entries(inventoryResults).filter(([assetId, result]) => {
      if (!result.assetType || (result.assetType !== 'neighbor' && result.assetType !== 'other')) {
        return true;
      }
      if (result.assetType === 'other') {
        return checkedOtherAssets.has(assetId);
      }
      return false;
    });

    const submitData: any = {
      assignmentId,
      results: filteredResults.map(([assetId, result]) => ({
        assetId, // Use pure asset ID without prefix
        roomId, // Add roomId to each result item
        systemQuantity: result.systemQuantity || result.quantity,
        countedQuantity: result.quantity,
        scanMethod: ScanMethod.MANUAL,
        status: result.status || SafeAssetActionStatus.MATCHED,
        note: result.note || '',
        imageUrls: result.imageUrls || [],
      })),
      note: `Kết quả kiểm kê phòng ${roomId}`,
    };

    try {
      await dispatch(submitInventoryResult(submitData)).unwrap();
      Alert.alert('Thành công', 'Đã gửi kết quả kiểm kê thành công');
    } catch (error) {
        console.error('❌ Submit Error:', error);
      Alert.alert('Lỗi', 'Không thể gửi kết quả kiểm kê');
    }
  };

  const handleQuantityChange = useCallback((assetId: string, quantity: number) => {
    // Find the asset to get system quantity
    const asset = currentAssets.find(a => a.assetId === assetId);
    const systemQuantity = asset?.quantity || 0;
    
    let status = SafeAssetActionStatus.MATCHED;
    if (quantity === 0) {
      status = SafeAssetActionStatus.MISSING;
    } else if (quantity > systemQuantity) {
      status = SafeAssetActionStatus.EXCESS;
    } else if (quantity < systemQuantity) {
      status = SafeAssetActionStatus.MISSING;
    }

    // ✅ Re-enable auto-save when user makes changes
    setAutoSaveEnabled(true);
    setHasDeletedTemp(false);

    setInventoryResults(prev => ({
      ...prev,
      [assetId]: {
        ...prev[assetId],
        quantity,
        systemQuantity,
        status,
        updatedAt: new Date().toISOString(),
      },
    }));
  }, [currentAssets]);

  // Handler for neighbor assets quantity change
  const handleNeighborQuantityChange = useCallback((assetId: string, quantity: number) => {
    const systemQuantity = 1; // Neighbor assets are typically 1 each
    
    let status = SafeAssetActionStatus.MATCHED;
    if (quantity === 0) {
      status = SafeAssetActionStatus.MISSING;
    } else if (quantity > systemQuantity) {
      status = SafeAssetActionStatus.EXCESS;
    } else if (quantity < systemQuantity) {
      status = SafeAssetActionStatus.MISSING;
    }

    setInventoryResults(prev => ({
      ...prev,
      [assetId]: {
        ...prev[assetId],
        quantity,
        systemQuantity,
        status,
        updatedAt: new Date().toISOString(),
        scanMethod: ScanMethod.RFID,
        assetType: 'neighbor',
      },
    }));
  }, []);

  // Handler for other room assets quantity change
  const handleOtherRoomQuantityChange = useCallback((assetId: string, quantity: number) => {
    const systemQuantity = 1; // Other room assets are typically 1 each
    
    let status = SafeAssetActionStatus.MATCHED;
    if (quantity === 0) {
      status = SafeAssetActionStatus.MISSING;
    } else if (quantity > systemQuantity) {
      status = SafeAssetActionStatus.EXCESS;
    } else if (quantity < systemQuantity) {
      status = SafeAssetActionStatus.MISSING;
    }

    setInventoryResults(prev => ({
      ...prev,
      [assetId]: {
        ...prev[assetId],
        quantity,
        systemQuantity,
        status,
        updatedAt: new Date().toISOString(),
        scanMethod: ScanMethod.RFID,
        assetType: 'other',
      },
    }));
  }, []);

  // Handler for removing other room asset from list
  const handleRemoveOtherAsset = (assetId: string) => {
    setRemovedOtherAssets(prev => new Set([...prev, assetId]));
    // Remove from inventory results
    setInventoryResults(prev => {
      const newResults = { ...prev };
      delete newResults[assetId];
      return newResults;
    });
  };

  // Handler for checking other room asset (save to inventory result)
  const handleCheckOtherAsset = (assetId: string) => {
    setCheckedOtherAssets(prev => new Set([...prev, assetId]));
    // Ensure the asset is in inventory results with proper status and default quantity 1
    setInventoryResults(prev => ({
      ...prev,
      [assetId]: {
        quantity: 1,
        systemQuantity: 1,
        status: SafeAssetActionStatus.MATCHED,
        updatedAt: new Date().toISOString(),
        scanMethod: ScanMethod.RFID,
        assetType: 'other',
      },
    }));
  };

  // Handler for temp adjacent assets quantity change
  const handleTempAdjacentQuantityChange = useCallback((assetId: string, quantity: number) => {
    setTempAdjacentAssets(prev => {
      const asset = prev[assetId];
      if (!asset) return prev;
      
      const systemQuantity = asset.systemQuantity || 1;
      
      let status = SafeAssetActionStatus.MATCHED;
      if (quantity === 0) {
        status = SafeAssetActionStatus.MISSING;
      } else if (quantity > systemQuantity) {
        status = SafeAssetActionStatus.EXCESS;
      } else if (quantity < systemQuantity) {
        status = SafeAssetActionStatus.MISSING;
      }

      return {
        ...prev,
        [assetId]: {
          ...asset,
          countedQuantity: quantity,
          status,
          updatedAt: new Date().toISOString(),
        },
      };
    });
  }, []);

  // Handler for temp adjacent assets recheck quantity
  const handleTempAdjacentRecheck = useCallback((assetId: string, quantity: number) => {
    setTempAdjacentAssets(prev => {
      const asset = prev[assetId];
      if (!asset) return prev;
      
      const systemQuantity = asset.systemQuantity || 1;
      
      let status = SafeAssetActionStatus.MATCHED;
      if (quantity === 0) {
        status = SafeAssetActionStatus.MISSING;
      } else if (quantity > systemQuantity) {
        status = SafeAssetActionStatus.EXCESS;
      } else if (quantity < systemQuantity) {
        status = SafeAssetActionStatus.MISSING;
      }

      return {
        ...prev,
        [assetId]: {
          ...asset,
          recheckQuantity: quantity,
          status,
          updatedAt: new Date().toISOString(),
        },
      };
    });
  }, []);

  // Handler for saving neighbors temp results
  const handleSaveNeighborsTemp = async () => {
    // Get both filtered neighbors and temp adjacent assets
    const neighborAssets = getFilteredNeighbors;
    const tempAdjacentEntries = Object.entries(tempAdjacentAssets);
    
    if (neighborAssets.length === 0 && tempAdjacentEntries.length === 0) {
      Alert.alert('Thông báo', 'Không có tài sản hàng xóm để lưu');
      return;
    }

    // Group assets by room
    const assetsByRoom: { [roomId: string]: AdjacentAssetInventoryDetail[] } = {};
    
    // Process regular neighbor assets from classification
    neighborAssets.forEach((asset: any) => {
      const assetRoomId = asset.currentRoom?.id || asset.roomId;
      if (!assetRoomId) return;
      
      const result = inventoryResults[asset.id];
      // Only include assets that have been inventoried (quantity > 0)
      if (result && result.quantity > 0) {
        if (!assetsByRoom[assetRoomId]) {
          assetsByRoom[assetRoomId] = [];
        }
        
        assetsByRoom[assetRoomId].push({
          assetId: asset.id,
          roomId: assetRoomId,
          systemQuantity: result.systemQuantity || 1,
          countedQuantity: result.quantity,
          scanMethod: result.scanMethod || ScanMethod.RFID,
          status: result.status || SafeAssetActionStatus.MATCHED,
          note: result.note || '',
          imageUrls: result.imageUrls || [],
          assetType: 'neighbor',
          // Additional metadata for restoration
          ktCode: asset.ktCode || asset.id,
          name: asset.name || 'Tài sản hàng xóm',
          roomCode: asset.currentRoom?.roomCode,
          rfidTag: result.rfidTag || asset.id,
        });
      }
    });
    
    // Process temp adjacent assets that have been rechecked
    tempAdjacentEntries.forEach(([assetId, asset]) => {
      const assetRoomId = asset.originalRoomId || asset.roomId || roomId;
      const recheckQuantity = asset.recheckQuantity;
      const originalQuantity = asset.countedQuantity || 0;
      
      // Include if there's a recheck quantity or original quantity > 0
      if (recheckQuantity > 0 || originalQuantity > 0) {
        if (!assetsByRoom[assetRoomId]) {
          assetsByRoom[assetRoomId] = [];
        }
        
        assetsByRoom[assetRoomId].push({
          assetId: assetId,
          roomId: assetRoomId,
          systemQuantity: asset.systemQuantity || 1,
          countedQuantity: recheckQuantity !== undefined ? recheckQuantity : originalQuantity,
          scanMethod: asset.scanMethod || ScanMethod.RFID,
          status: asset.status || SafeAssetActionStatus.MATCHED,
          note: asset.note || '',
          imageUrls: asset.imageUrls || [],
          assetType: 'neighbor',
          // Additional metadata for restoration
          ktCode: asset.ktCode || assetId,
          name: asset.name || 'Tài sản hàng xóm',
          roomCode: asset.roomCode,
          rfidTag: asset.rfidTag,
        });
      }
    });

    // Convert to API format: [{roomId: , result: []}]
    const roomResults: RoomAdjacentResult[] = Object.entries(assetsByRoom).map(([roomId, result]) => ({
      roomId,
      result,
    }));

    if (roomResults.length === 0) {
      const totalNeighborAssets = neighborAssets.length;
      const inventoriedCount = neighborAssets.filter(asset => {
        const result = inventoryResults[asset.id];
        return result && result.quantity > 0;
      }).length;
      
      Alert.alert(
        'Thông báo', 
        `Không có tài sản hàng xóm nào được kiểm để lưu.\n\nTổng số tài sản hàng xóm: ${totalNeighborAssets}\nĐã kiểm kê: ${inventoriedCount}`,
        [
          {
            text: 'OK',
            onPress: () => {
              if (totalNeighborAssets > 0) {
                setActiveClassificationTab('neighbors');
              }
            }
          }
        ]
      );
      return;
    }

    const totalAssets = roomResults.reduce((sum, room) => sum + room.result.length, 0);
    const totalRooms = roomResults.length;

    // Show confirmation dialog
    Alert.alert(
      'Xác nhận lưu tạm',
      `Bạn có muốn lưu tạm ${totalAssets} tài sản hàng xóm từ ${totalRooms} phòng không?\n\nDữ liệu sẽ được lưu trong 24 giờ.`,
      [
        {
          text: 'Hủy',
          style: 'cancel'
        },
        {
          text: 'Lưu tạm',
          onPress: async () => {
            const saveData: SaveTempAdjacentInventoryRequest = {
              roomResults,
              note: `Lưu tạm ${totalAssets} tài sản hàng xóm từ ${totalRooms} phòng (được kiểm từ phòng ${room?.roomCode || roomId})`,
              ttlSeconds: 86400, // 24 hours
            };

            await performSaveNeighborsTemp(saveData, totalAssets, totalRooms, roomResults);
          }
        }
      ]
    );
  };

  // Separate function to perform the actual save operation
  const performSaveNeighborsTemp = async (
    saveData: SaveTempAdjacentInventoryRequest, 
    totalAssets: number, 
    totalRooms: number, 
    roomResults: RoomAdjacentResult[]
  ) => {

    try {
      const response = await dispatch(saveTempAdjacentInventoryResults(saveData)).unwrap();
      
      Alert.alert(
        'Thành công', 
        `Đã lưu tạm ${totalAssets} tài sản hàng xóm từ ${totalRooms} phòng khác nhau`,
        [
          {
            text: 'OK'
          }
        ]
      );
    } catch (error: any) {
      const errorMessage = error?.message || 'Không thể lưu tạm kết quả tài sản hàng xóm';
      Alert.alert(
        'Lỗi', 
        errorMessage,
        [
          {
            text: 'Thử lại',
            onPress: () => handleSaveNeighborsTemp()
          },
          {
            text: 'Đóng',
            style: 'cancel'
          }
        ]
      );
    }
  };
  const stats = useMemo(() => {
    const total = currentAssets.length;
    let matched = 0;
    let missing = 0;
    let excess = 0;
    let counted = 0;
    let rfidScanned = 0;
    let manualScanned = 0;

    currentAssets.forEach((asset) => {
      const result = displayResults[asset.assetId];
      const countedQuantity = result?.quantity || 0;

      if (countedQuantity > 0) {
        counted++;
        
        if (result?.scanMethod === ScanMethod.RFID) {
          rfidScanned++;
        } else if (result?.scanMethod === ScanMethod.MANUAL) {
          manualScanned++;
        }
        
        if (result?.status === SafeAssetActionStatus.MATCHED) {
          matched++;
        } else if (result?.status === SafeAssetActionStatus.EXCESS) {
          excess++;
        } else {
          missing++;
        }
      } else {
        missing++;
      }
    });

    return { total, counted, matched, missing, excess, rfidScanned, manualScanned };
  }, [currentAssets, displayResults]);








  if (assetBookLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Đang tải dữ liệu sổ tài sản...</Text>
        <Text style={styles.loadingSubtext}>
          {unitId && roomId ? `Phòng ${room?.roomCode || roomId}` : 'Đang khởi tạo...'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#374151" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Kiểm kê tài sản</Text>
            <Text style={styles.headerSubtitle}>
              {unit?.name || assetBookInventory?.unit?.name || 'Đang tải...'}
            </Text>
            <Text style={styles.headerBreadcrumb}>
              Năm {session?.year || assetBookInventory?.year || new Date().getFullYear()} {'>'} {room?.roomCode || roomId}
            </Text>
          </View>
          <TouchableOpacity 
            style={styles.toggleButton}
            onPress={() => setShowRoomInfo(!showRoomInfo)}
          >
            <Ionicons 
              name={showRoomInfo ? "chevron-up" : "chevron-down"} 
              size={20} 
              color="#6B7280"
            />
          </TouchableOpacity>
        </View>
      </View>

      {showRoomInfo && (
        <View style={styles.roomInfoSection}>
          <View style={styles.roomInfoHeader}>
            <View style={styles.roomInfoIconContainer}>
              <Ionicons name="home" size={20} color="#3B82F6" />
            </View>
            <Text style={styles.roomInfoTitle}>Thông tin phòng & Thống kê</Text>
          </View>

          <View style={styles.roomDetailsGrid}>
            <View style={styles.roomDetailItem}>
              <Text style={styles.roomDetailLabel}>Mã phòng</Text>
              <View style={styles.roomDetailValue}>
                <Text style={styles.roomDetailText}>{room?.roomCode || roomId}</Text>
              </View>
            </View>
            <View style={styles.roomDetailItem}>
              <Text style={styles.roomDetailLabel}>Tầng</Text>
              <View style={styles.roomDetailValue}>
                <Text style={styles.roomDetailText}>{room?.floor || 'N/A'}</Text>
              </View>
            </View>
            <View style={styles.roomDetailItem}>
              <Text style={styles.roomDetailLabel}>Tòa nhà</Text>
              <View style={styles.roomDetailValue}>
                <Text style={styles.roomDetailText}>{room?.building || 'N/A'}</Text>
              </View>
            </View>
            <View style={styles.roomDetailItem}>
              <Text style={styles.roomDetailLabel}>Trạng thái</Text>
              <View style={styles.roomDetailValue}>
                <Text style={[styles.roomDetailText, { color: '#10B981' }]}>Đang kiểm kê</Text>
              </View>
            </View>
          </View>

          <View style={styles.statisticsGrid}>
            <View style={[styles.statCard, styles.statCardGreen]}>
              <Text style={[styles.statNumberCompact, { color: '#10B981' }]}>{stats.matched}</Text>
              <Text style={styles.statLabelCompact}>Khớp</Text>
            </View>
            <View style={[styles.statCard, styles.statCardOrange]}>
              <Text style={[styles.statNumberCompact, { color: '#F59E0B' }]}>{stats.missing}</Text>
              <Text style={styles.statLabelCompact}>Thiếu</Text>
            </View>
            <View style={[styles.statCard, styles.statCardGray, styles.statCardWide]}>
              <Text style={[styles.statNumberCompact, { color: '#6B7280' }]}>{stats.total}</Text>
              <Text style={styles.statLabelCompact}>Tổng</Text>
            </View>
          </View>
        </View>
      )}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Loại tài sản</Text>
        </View>
        <View style={styles.assetTypeContainer}>
          <TouchableOpacity
            onPress={() => setSelectedAssetType(AssetType.FIXED_ASSET)}
            style={[
              styles.assetTypeButton,
              selectedAssetType === AssetType.FIXED_ASSET && styles.assetTypeButtonSelected
            ]}
          >
            <Text style={[
              styles.assetTypeText,
              selectedAssetType === AssetType.FIXED_ASSET && styles.assetTypeTextSelected
            ]}>
              Tài sản cố định
            </Text>
            <Text style={styles.assetTypeCount}>
              {getAssetsByType(AssetType.FIXED_ASSET).length}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setSelectedAssetType(AssetType.TOOLS_EQUIPMENT)}
            style={[
              styles.assetTypeButton,
              selectedAssetType === AssetType.TOOLS_EQUIPMENT && styles.assetTypeButtonSelected
            ]}
          >
            <Text style={[
              styles.assetTypeText,
              selectedAssetType === AssetType.TOOLS_EQUIPMENT && styles.assetTypeTextSelected
            ]}>
              Công cụ dụng cụ
            </Text>
            <Text style={styles.assetTypeCount}>
              {getAssetsByType(AssetType.TOOLS_EQUIPMENT).length}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Device Control Section - Only show for FIXED_ASSET */}
      {selectedAssetType === AssetType.FIXED_ASSET && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleContainer}>
              <Ionicons name="radio-outline" size={20} color="#3B82F6" />
              <Text style={styles.sectionTitle}>Thiết bị</Text>
            </View>
            <TouchableOpacity
              onPress={() => setShowDeviceList(!showDeviceList)}
              style={styles.settingsButton}
            >
              <Ionicons name="settings-outline" size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

        {/* Device List */}
        {showDeviceList && (
          <View style={styles.deviceList}>
            <TouchableOpacity
              onPress={handleScanDevices}
              style={[styles.controlButton, styles.scanButton, { marginBottom: 16 }]}
              disabled={bluetoothState.isScanning}
            >
              {bluetoothState.isScanning ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Ionicons name="search-outline" size={20} color="white" />
              )}
              <Text style={styles.controlButtonText}>
                {bluetoothState.isScanning ? 'Đang quét...' : 'Quét thiết bị'}
              </Text>
            </TouchableOpacity>

            {bluetoothState.devices.map((deviceItem) => (
              <TouchableOpacity
                key={deviceItem.id}
                onPress={() => handleSelectDevice(deviceItem)}
                style={[
                  styles.deviceItem,
                  device?.id === deviceItem.id && styles.selectedDeviceItem
                ]}
              >
                <View style={styles.deviceInfo}>
                  <View style={styles.deviceStatusContainer}>
                    <View style={[
                      styles.statusDot,
                      { backgroundColor: bluetoothState.isConnected ? '#10B981' : '#6B7280' }
                    ]} />
                    <Text style={styles.deviceName}>{deviceItem.name || 'Thiết bị RFID'}</Text>
                  </View>
                  <Text style={styles.deviceType}>{deviceItem.id}</Text>
                </View>
                <Text style={[
                  styles.deviceStatus,
                  { color: bluetoothState.isConnected ? '#10B981' : '#6B7280' }
                ]}>
                  {bluetoothState.isConnected ? 'Đã kết nối' : 'Chưa kết nối'}
                </Text>
              </TouchableOpacity>
            ))}

            {bluetoothState.devices.length === 0 && !bluetoothState.isScanning && (
              <View style={styles.emptyState}>
                <Ionicons name="bluetooth-outline" size={48} color="#9CA3AF" />
                <Text style={styles.emptyStateText}>Chưa tìm thấy thiết bị nào</Text>
                <Text style={styles.emptyStateSubtext}>Nhấn "Quét thiết bị" để tìm kiếm</Text>
              </View>
            )}
          </View>
        )}

        {/* Selected Device Info */}
        {device && (
          <View style={styles.selectedDeviceInfo}>
            <View style={styles.deviceInfoRow}>
              <Text style={styles.deviceInfoText}>
                {device.name || 'Thiết bị RFID'}
              </Text>
              <View style={[
                styles.statusBadge,
                { backgroundColor: bluetoothState.isConnected ? '#10B98120' : '#6B728020' }
              ]}>
                <Text style={[
                  styles.statusBadgeText,
                  { color: bluetoothState.isConnected ? '#10B981' : '#6B7280' }
                ]}>
                  {bluetoothState.isConnected ? 'Đã kết nối' : 'Chưa kết nối'}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Control Buttons */}
        <View style={styles.controlButtons}>
          {!device ? (
            <TouchableOpacity
              onPress={() => setShowDeviceList(true)}
              style={[styles.controlButton, styles.selectDeviceButton]}
            >
              <Ionicons name="settings-outline" size={20} color="white" />
              <Text style={styles.controlButtonText}>Chọn thiết bị</Text>
            </TouchableOpacity>
          ) : !bluetoothState.isConnected ? (
            <TouchableOpacity
              onPress={handleConnectRfid}
              style={[styles.controlButton, styles.connectButton]}
            >
              <Ionicons name="link-outline" size={20} color="white" />
              <Text style={styles.controlButtonText}>Kết nối</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.connectedButtons}>
              <TouchableOpacity
                onPress={handleDisconnectRfid}
                style={[styles.controlButton, styles.disconnectButton]}
              >
                <Ionicons name="close-outline" size={20} color="white" />
                <Text style={styles.controlButtonText}>Ngắt kết nối</Text>
              </TouchableOpacity>
              
              {isInventoryRunning || isStopping ? (
                <TouchableOpacity
                  onPress={handleStopScan}
                  disabled={isStopping}
                  style={[
                    styles.controlButton, 
                    styles.stopButton,
                    isStopping && { opacity: 0.6 }
                  ]}
                >
                  <ActivityIndicator size="small" color="white" />
                  <Text style={styles.controlButtonText}>
                    {isStopping ? 'Đang dừng...' : 'Dừng quét'}
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={handleStartScan}
                  style={[styles.controlButton, styles.scanButton]}
                >
                  <Ionicons name="scan-outline" size={20} color="white" />
                  <Text style={styles.controlButtonText}>Bắt đầu quét</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
        </View>
      )}

      {/* Asset List Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Danh sách tài sản ({currentAssets.length})
          </Text>
          <View style={styles.unscannedCounter}>
            <Ionicons name="alert-circle-outline" size={16} color="#F59E0B" />
            <Text style={styles.unscannedCounterText}>
              {stats.total - stats.counted} chưa quét
            </Text>
          </View>
        </View>

        {currentAssets.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="cube-outline" size={48} color="#9CA3AF" />
            <Text style={styles.emptyStateText}>Không có tài sản nào</Text>
            <Text style={styles.emptyStateSubtext}>Chọn loại tài sản khác để xem</Text>
          </View>
        ) : (
          <FlatList
            data={currentAssets}
            keyExtractor={(item) => `asset-book-${item.assetId}`}
            style={styles.flatListContainer}
            nestedScrollEnabled={true}
            contentContainerStyle={styles.flatListContent}
            renderItem={({ item: asset, index }) => (
              <AssetItem
                asset={asset}
                result={displayResults[asset.assetId]}
                onQuantityChange={handleQuantityChange}
                assetType={selectedAssetType}
              />
            )}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews={false}
            maxToRenderPerBatch={10}
            updateCellsBatchingPeriod={50}
            initialNumToRender={10}
            windowSize={10}
            legacyImplementation={false}
            disableVirtualization={false}
          />
        )}
      </View>

      {/* Temp Adjacent Assets Section - Show saved assets from neighbor rooms */}
      {showTempAdjacentAssets && Object.keys(tempAdjacentAssets).length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleContainer}>
              <Ionicons name="file-tray-full-outline" size={20} color="#F59E0B" />
              <Text style={styles.sectionTitle}>Tài sản đã tạm lưu ({Object.keys(tempAdjacentAssets).length})</Text>
            </View>
            <View style={styles.sectionHeaderRight}>
              {adjacentTempResultsLoading && (
                <ActivityIndicator size="small" color="#F59E0B" style={{ marginRight: 8 }} />
              )}
              <TouchableOpacity
                onPress={async () => {
                  try {
                    await dispatch(deleteTempAdjacentInventoryResults(roomId)).unwrap();
                    setTempAdjacentAssets({});
                    setShowTempAdjacentAssets(false);
                    Alert.alert('Thành công', 'Đã xóa tài sản tạm lưu');
                  } catch (error) {
                    Alert.alert('Lỗi', 'Không thể xóa tài sản tạm lưu');
                  }
                }}
                disabled={deleteAdjacentTempResultsLoading}
                style={styles.deleteButtonSmall}
              >
                <Ionicons name="trash-outline" size={18} color="#EF4444" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setShowTempAdjacentAssets(!showTempAdjacentAssets)}
                style={styles.toggleButton}
              >
                <Ionicons 
                  name={showTempAdjacentAssets ? "chevron-up" : "chevron-down"} 
                  size={20} 
                  color="#6B7280"
                />
              </TouchableOpacity>
            </View>
          </View>

          {showTempAdjacentAssets && (
            <View>
              {/* Simple Info Banner */}
              <View style={styles.tempAdjacentInfoBannerSimple}>
                <Ionicons name="bookmark-outline" size={16} color="#6B7280" />
                <Text style={styles.tempAdjacentInfoTextSimple}>
                  Tài sản đã lưu tạm từ phòng hàng xóm • Có thể kiểm kê lại
                </Text>
              </View>

              {/* Asset List */}
              <FlatList
                data={Object.entries(tempAdjacentAssets)}
                keyExtractor={([assetId]) => `temp-adjacent-${assetId}`}
                style={styles.flatListContainer}
                nestedScrollEnabled={true}
                contentContainerStyle={styles.flatListContent}
                renderItem={({ item: [assetId, asset], index }) => {
                  const countedQuantity = asset.countedQuantity || 0;
                  const systemQuantity = asset.systemQuantity || 1;
                  const status = asset.status || AssetActionStatus.MATCHED;
                  
                  const getStatusInfo = (status: string) => {
                    switch (status) {
                      case AssetActionStatus.MATCHED:
                        return { text: 'Khớp', color: '#10B981', bgColor: '#10B98120' };
                      case AssetActionStatus.MISSING:
                        return { text: 'Thiếu', color: '#EF4444', bgColor: '#EF444420' };
                      case AssetActionStatus.EXCESS:
                        return { text: 'Thừa', color: '#F59E0B', bgColor: '#F59E0B20' };
                      default:
                        return { text: 'Đã lưu', color: '#6B7280', bgColor: '#6B728020' };
                    }
                  };

                  const statusInfo = getStatusInfo(status);

                  return (
                    <View style={styles.tempAdjacentAssetCardSimple}>
                      <View style={styles.tempAdjacentHeader}>
                        <View style={styles.tempAdjacentInfo}>
                          <View style={styles.tempAdjacentLabelContainer}>
                            <Text style={styles.tempAdjacentLabelSimple}>TẠM LƯU</Text>
                          </View>
                          <Text style={styles.tempAdjacentAssetId}>
                            {asset.ktCode || asset.assetId}
                          </Text>
                          <Text style={styles.tempAdjacentRoomInfo}>
                            Phòng: {asset.roomCode || asset.originalRoomId}
                          </Text>
                          {asset.name && (
                            <Text style={styles.tempAdjacentAssetName} numberOfLines={1}>
                              {asset.name}
                            </Text>
                          )}
                        </View>
                        <View style={[styles.statusBadgeSimple, { backgroundColor: statusInfo.bgColor }]}>
                          <Text style={[styles.statusBadgeTextSimple, { color: statusInfo.color }]}>
                            {statusInfo.text}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.tempAdjacentQuantitySection}>
                        <View style={styles.tempAdjacentQuantityItem}>
                          <Text style={styles.tempAdjacentQuantityLabel}>Đã lưu</Text>
                          <View style={styles.tempAdjacentQuantityValue}>
                            <Text style={styles.tempAdjacentQuantityText}>{countedQuantity}</Text>
                          </View>
                        </View>
                        
                        <View style={styles.tempAdjacentQuantityItem}>
                          <Text style={styles.tempAdjacentQuantityLabel}>Kiểm kê lại</Text>
                          <View style={styles.tempAdjacentQuantityInputContainer}>
                            <TouchableOpacity 
                              style={styles.tempAdjacentQuantityButton}
                              onPress={() => handleTempAdjacentRecheck(assetId, Math.max(0, (asset.recheckQuantity || 0) - 1))}
                            >
                              <Ionicons name="remove" size={20} color="#6B7280" />
                            </TouchableOpacity>
                            <TextInput
                              style={styles.tempAdjacentQuantityInput}
                              value={(asset.recheckQuantity || 0).toString()}
                              onChangeText={(text) => handleTempAdjacentRecheck(assetId, parseInt(text) || 0)}
                              keyboardType="numeric"
                              placeholder="0"
                              textAlign="center"
                            />
                            <TouchableOpacity 
                              style={styles.tempAdjacentQuantityButton}
                              onPress={() => handleTempAdjacentRecheck(assetId, (asset.recheckQuantity || 0) + 1)}
                            >
                              <Ionicons name="add" size={20} color="#6B7280" />
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>

                      {asset.recheckQuantity !== undefined && asset.recheckQuantity !== countedQuantity && (
                        <View style={styles.tempAdjacentUpdateNote}>
                          <Ionicons name="alert-circle-outline" size={14} color="#F59E0B" />
                          <Text style={styles.tempAdjacentUpdateText}>
                            Số lượng thay đổi: {countedQuantity} → {asset.recheckQuantity}
                          </Text>
                        </View>
                      )}
                    </View>
                  );
                }}
                showsVerticalScrollIndicator={false}
                removeClippedSubviews={false}
                maxToRenderPerBatch={10}
                updateCellsBatchingPeriod={50}
                initialNumToRender={10}
                windowSize={10}
              />
            </View>
          )}
        </View>
      )}

      {/* RFID Classification Results Section - Only show for FIXED_ASSET */}
      {selectedAssetType === AssetType.FIXED_ASSET && (classifyRfidsResult || restoredClassificationResults) && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Tài sản khác</Text>
            <View style={styles.sectionHeaderRight}>
              {classifyRfidsLoading && (
                <ActivityIndicator size="small" color="#3B82F6" style={{ marginRight: 8 }} />
              )}
              <TouchableOpacity
                onPress={() => {
                  dispatch(clearClassifyRfidsResult());
                  setClassifiedRfids(new Set());
                  setRestoredClassificationResults(null);
                }}
                style={styles.clearButton}
              >
                <Ionicons name="close-circle-outline" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Tab Navigation */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[
                styles.tabButton,
                activeClassificationTab === 'neighbors' && styles.tabButtonActive
              ]}
              onPress={() => setActiveClassificationTab('neighbors')}
            >
              <Text style={[
                styles.tabButtonText,
                activeClassificationTab === 'neighbors' && styles.tabButtonTextActive
              ]}>
                Hàng xóm ({getFilteredNeighbors.length})
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.tabButton,
                activeClassificationTab === 'otherRooms' && styles.tabButtonActive
              ]}
              onPress={() => setActiveClassificationTab('otherRooms')}
            >
              <Text style={[
                styles.tabButtonText,
                activeClassificationTab === 'otherRooms' && styles.tabButtonTextActive
              ]}>
                Phòng khác ({getFilteredOtherRooms.length})
              </Text>
            </TouchableOpacity>
          </View>

          {/* Tab Content */}
          <View style={styles.tabContent}>
            {activeClassificationTab === 'neighbors' && (
              <View>
                {getFilteredNeighbors.length > 0 ? (
                  <View>
                    <View style={styles.tabActionHeader}>
                      <Text style={styles.tabActionText}>
                        Tài sản hàng xóm ({getFilteredNeighbors.length})
                      </Text>
                      <TouchableOpacity
                        onPress={handleSaveNeighborsTemp}
                        disabled={saveAdjacentTempResultsLoading}
                        style={[styles.saveNeighborsButton, saveAdjacentTempResultsLoading && { opacity: 0.6 }]}
                      >
                        {saveAdjacentTempResultsLoading ? (
                          <ActivityIndicator size="small" color="white" />
                        ) : (
                          <Ionicons name="save-outline" size={16} color="white" />
                        )}
                        <Text style={styles.saveNeighborsButtonText}>
                          {saveAdjacentTempResultsLoading ? 'Đang lưu...' : 'Lưu tạm tất cả'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    
                    <FlatList
                      data={getFilteredNeighbors}
                      keyExtractor={(item) => `neighbor-${item.id}`}
                      nestedScrollEnabled={true}
                      style={styles.flatListContainer}
                      contentContainerStyle={styles.flatListContent}
                    renderItem={({ item: asset, index }) => {
                      const neighborResult = inventoryResults[asset.id];
                      const countedQuantity = neighborResult?.quantity || 0;
                      const systemQuantity = 1;
                      const status = neighborResult?.status || SafeAssetActionStatus.MISSING;
                        
                        const getStatusInfo = (status: string) => {
                          switch (status) {
                            case SafeAssetActionStatus.MATCHED:
                              return { text: 'Khớp', color: '#10B981', bgColor: '#10B98120' };
                            case SafeAssetActionStatus.MISSING:
                              return { text: 'Thiếu', color: '#EF4444', bgColor: '#EF444420' };
                            case SafeAssetActionStatus.EXCESS:
                              return { text: 'Thừa', color: '#F59E0B', bgColor: '#F59E0B20' };
                            default:
                              return { text: 'Chưa kiểm', color: '#6B7280', bgColor: '#6B728020' };
                          }
                        };

                        const statusInfo = getStatusInfo(status);

                        return (
                          <View style={styles.tempAdjacentAssetCardSimple}>
                            <View style={styles.tempAdjacentHeader}>
                              <View style={styles.tempAdjacentInfo}>
                                <Text style={styles.tempAdjacentAssetId}>{asset.ktCode || 'Mã tài sản'}</Text>
                                <Text style={styles.tempAdjacentRoomInfo}>Phòng: {asset.currentRoom?.roomCode || 'N/A'}</Text>
                                <Text style={styles.tempAdjacentAssetName} numberOfLines={1}>
                                  {asset.name || 'Tên tài sản'}
                                </Text>
                              </View>
                              <View style={[styles.statusBadgeSimple, { backgroundColor: statusInfo.bgColor }]}>
                                <Text style={[styles.statusBadgeTextSimple, { color: statusInfo.color }]}>
                                  {statusInfo.text}
                                </Text>
                              </View>
                            </View>

                            <View style={styles.tempAdjacentQuantitySection}>
                              <View style={styles.tempAdjacentQuantityItem}>
                                <Text style={styles.tempAdjacentQuantityLabel}>Sổ tài sản</Text>
                                <View style={styles.tempAdjacentQuantityValue}>
                                  <Text style={styles.tempAdjacentQuantityText}>{systemQuantity}</Text>
                                </View>
                              </View>
                              
                              <View style={styles.tempAdjacentQuantityItem}>
                                <Text style={styles.tempAdjacentQuantityLabel}>Kiểm kê</Text>
                                <View style={styles.tempAdjacentQuantityInputContainer}>
                                  <TouchableOpacity 
                                    style={styles.tempAdjacentQuantityButton}
                                    onPress={() => handleNeighborQuantityChange(asset.id, Math.max(0, countedQuantity - 1))}
                                  >
                                    <Ionicons name="remove" size={20} color="#6B7280" />
                                  </TouchableOpacity>
                                  <TextInput
                                    style={styles.tempAdjacentQuantityInput}
                                    value={countedQuantity.toString()}
                                    onChangeText={(text) => handleNeighborQuantityChange(asset.id, parseInt(text) || 0)}
                                    keyboardType="numeric"
                                    placeholder="0"
                                    textAlign="center"
                                  />
                                  <TouchableOpacity 
                                    style={styles.tempAdjacentQuantityButton}
                                    onPress={() => handleNeighborQuantityChange(asset.id, countedQuantity + 1)}
                                  >
                                    <Ionicons name="add" size={20} color="#6B7280" />
                                  </TouchableOpacity>
                                </View>
                              </View>
                            </View>
                          </View>
                        );
                      }}
                      showsVerticalScrollIndicator={false}
                      removeClippedSubviews={false}
                      maxToRenderPerBatch={10}
                      updateCellsBatchingPeriod={50}
                      initialNumToRender={10}
                      windowSize={10}
                    />
                  </View>
                ) : (
                  <View style={styles.emptyTabState}>
                    <Ionicons name="home-outline" size={48} color="#9CA3AF" />
                    <Text style={styles.emptyTabText}>Không có tài sản hàng xóm</Text>
                  </View>
                )}
              </View>
            )}

            {activeClassificationTab === 'otherRooms' && (
              <View>
                {getFilteredOtherRooms.length > 0 ? (
                  <FlatList
                    data={getFilteredOtherRooms.filter((asset: any) => !removedOtherAssets.has(asset.id))}
                    keyExtractor={(item) => `other-${item.id}`}
                    style={styles.flatListContainer}
                    nestedScrollEnabled={true}
                    contentContainerStyle={styles.flatListContent}
                    renderItem={({ item: asset, index }) => {
                      const otherRoomResult = inventoryResults[asset.id];
                      const countedQuantity = otherRoomResult?.quantity || 0;
                      const systemQuantity = 1;
                      const status = otherRoomResult?.status || SafeAssetActionStatus.MISSING;
                      
                      const getStatusInfo = (status: string) => {
                        switch (status) {
                          case SafeAssetActionStatus.MATCHED:
                            return { text: 'Khớp', color: '#10B981', bgColor: '#10B98120' };
                          case SafeAssetActionStatus.MISSING:
                            return { text: 'Thiếu', color: '#EF4444', bgColor: '#EF444420' };
                          case SafeAssetActionStatus.EXCESS:
                            return { text: 'Thừa', color: '#F59E0B', bgColor: '#F59E0B20' };
                          default:
                            return { text: 'Chưa kiểm', color: '#6B7280', bgColor: '#6B728020' };
                        }
                      };

                      const statusInfo = getStatusInfo(status);

                      return (
                        <View style={styles.tempAdjacentAssetCardSimple}>
                          <View style={styles.tempAdjacentHeader}>
                            <View style={styles.tempAdjacentInfo}>
                              <Text style={styles.tempAdjacentAssetId}>{asset.ktCode || 'Mã tài sản'}</Text>
                              <Text style={styles.tempAdjacentRoomInfo}>Phòng: {asset.currentRoom?.roomCode || 'N/A'}</Text>
                              <Text style={styles.tempAdjacentAssetName} numberOfLines={1}>
                                {asset.name || 'Tên tài sản'}
                              </Text>
                            </View>
                            <View style={[styles.statusBadgeSimple, { backgroundColor: statusInfo.bgColor }]}>
                              <Text style={[styles.statusBadgeTextSimple, { color: statusInfo.color }]}>
                                {statusInfo.text}
                              </Text>
                            </View>
                          </View>

                          <View style={styles.tempAdjacentQuantitySection}>
                            <View style={styles.tempAdjacentQuantityItem}>
                              <Text style={styles.tempAdjacentQuantityLabel}>Sổ tài sản</Text>
                              <View style={styles.tempAdjacentQuantityValue}>
                                <Text style={styles.tempAdjacentQuantityText}>{systemQuantity}</Text>
                              </View>
                            </View>
                            
                            <View style={styles.tempAdjacentQuantityItem}>
                              <Text style={styles.tempAdjacentQuantityLabel}>Kiểm kê</Text>
                              <View style={styles.tempAdjacentQuantityInputContainer}>
                                <TouchableOpacity 
                                  style={styles.tempAdjacentQuantityButton}
                                  onPress={() => handleOtherRoomQuantityChange(asset.id, Math.max(0, countedQuantity - 1))}
                                >
                                  <Ionicons name="remove" size={20} color="#6B7280" />
                                </TouchableOpacity>
                                <TextInput
                                  style={styles.tempAdjacentQuantityInput}
                                  value={countedQuantity.toString()}
                                  onChangeText={(text) => handleOtherRoomQuantityChange(asset.id, parseInt(text) || 0)}
                                  keyboardType="numeric"
                                  placeholder="0"
                                  textAlign="center"
                                />
                                <TouchableOpacity 
                                  style={styles.tempAdjacentQuantityButton}
                                  onPress={() => handleOtherRoomQuantityChange(asset.id, countedQuantity + 1)}
                                >
                                  <Ionicons name="add" size={20} color="#6B7280" />
                                </TouchableOpacity>
                              </View>
                            </View>
                          </View>

                          {/* Action buttons for other room assets */}
                          <View style={styles.otherAssetActionsContainer}>
                            <TouchableOpacity
                              style={[styles.otherAssetActionButton, styles.checkButton]}
                              onPress={() => handleCheckOtherAsset(asset.id)}
                            >
                              <Ionicons 
                                name={checkedOtherAssets.has(asset.id) ? "checkmark-circle" : "checkmark-circle-outline"} 
                                size={20} 
                                color={checkedOtherAssets.has(asset.id) ? "#10B981" : "#6B7280"} 
                              />
                              <Text style={[
                                styles.otherAssetActionText,
                                { color: checkedOtherAssets.has(asset.id) ? "#10B981" : "#6B7280" }
                              ]}>
                                {checkedOtherAssets.has(asset.id) ? "Đã lưu" : "Lưu"}
                              </Text>
                            </TouchableOpacity>
                            
                            <TouchableOpacity
                              style={[styles.otherAssetActionButton, styles.deleteButton]}
                              onPress={() => handleRemoveOtherAsset(asset.id)}
                            >
                              <Ionicons name="trash-outline" size={20} color="#EF4444" />
                              <Text style={[styles.otherAssetActionText, { color: "#EF4444" }]}>
                                Xóa
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    }}
                    showsVerticalScrollIndicator={false}
                    removeClippedSubviews={false}
                    maxToRenderPerBatch={10}
                    updateCellsBatchingPeriod={50}
                    initialNumToRender={10}
                    windowSize={10}
                  />
                ) : (
                  <View style={styles.emptyTabState}>
                    <Ionicons name="business-outline" size={48} color="#9CA3AF" />
                    <Text style={styles.emptyTabText}>Không có tài sản phòng khác</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>
      )}

      {/* Action Buttons Section */}
      <View style={styles.section}>
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity
            onPress={handleSaveTempResults}
            style={[styles.actionButtonLarge, styles.saveTempButton]}
          >
            <Ionicons name="save-outline" size={20} color="white" />
            <Text style={styles.actionButtonLargeText}>Lưu tạm</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleDeleteTempResults}
            style={[styles.actionButtonLarge, styles.deleteTempButton]}
          >
            <Ionicons name="trash-outline" size={20} color="white" />
            <Text style={styles.actionButtonLargeText}>Xóa tạm</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleSubmitResults}
            disabled={submitResultLoading}
            style={[styles.actionButtonLarge, styles.submitButton]}
          >
            {submitResultLoading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Ionicons name="checkmark-circle-outline" size={20} color="white" />
            )}
            <Text style={styles.actionButtonLargeText}>
              {submitResultLoading ? 'Đang gửi...' : 'Lưu kết quả'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>


      </ScrollView>
      
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 2,
  },
  headerBreadcrumb: {
    fontSize: 12,
    color: '#6B7280',
  },
  toggleButton: {
    padding: 8,
    marginLeft: 8,
  },
  section: {
    backgroundColor: 'white',
    margin: 16,
    borderRadius: 12,
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clearButton: {
    padding: 4,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginLeft: 8,
  },
  settingsButton: {
    padding: 8,
  },
  deviceList: {
    marginBottom: 16,
  },
  deviceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    marginBottom: 8,
  },
  selectedDeviceItem: {
    borderColor: '#3B82F6',
    backgroundColor: '#EBF8FF',
  },
  deviceInfo: {
    flex: 1,
  },
  deviceStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
  },
  deviceType: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  deviceStatus: {
    fontSize: 12,
    fontWeight: '500',
  },
  selectedDeviceInfo: {
    backgroundColor: '#EBF8FF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  deviceInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deviceInfoText: {
    fontSize: 14,
    color: '#111827',
    marginLeft: 8,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  controlButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  connectedButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  controlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 120,
    justifyContent: 'center',
  },
  connectButton: {
    backgroundColor: '#10B981',
  },
  disconnectButton: {
    backgroundColor: '#EF4444',
  },
  scanButton: {
    backgroundColor: '#3B82F6',
  },
  stopButton: {
    backgroundColor: '#F59E0B',
  },
  controlButtonText: {
    color: 'white',
    fontWeight: '500',
    marginLeft: 8,
  },
  selectDeviceButton: {
    backgroundColor: '#6B7280',
  },

  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  actionButtonLarge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  saveTempButton: {
    backgroundColor: '#3B82F6', // Blue color for save temp
  },
  deleteTempButton: {
    backgroundColor: '#F59E0B',
  },
  submitButton: {
    backgroundColor: '#10B981',
  },
  actionButtonLargeText: {
    color: 'white',
    fontWeight: '500',
    marginLeft: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  loadingSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#9CA3AF',
  },
  assetTypeContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  assetTypeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  assetTypeButtonSelected: {
    borderColor: '#3B82F6',
    backgroundColor: '#EBF8FF',
  },
  assetTypeText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
    marginLeft: 8,
    flex: 1,
  },
  assetTypeTextSelected: {
    color: '#3B82F6',
  },
  assetTypeCount: {
    fontSize: 12,
    color: '#6B7280',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#10B981',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6B7280',
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
  },
  assetCode: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },

  // Redesigned Asset Card Styles
  assetCardRedesigned: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  assetHeaderRedesigned: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  assetInfoRedesigned: {
    flex: 1,
    marginRight: 12,
  },
  assetCodeRedesigned: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  assetNameRedesigned: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    lineHeight: 22,
  },
  rfidInfoContainerRedesigned: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rfidInfoTextRedesigned: {
    fontSize: 12,
    color: '#10B981',
    marginLeft: 6,
    fontWeight: '500',
  },
  statusBadgeRedesigned: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  statusBadgeTextRedesigned: {
    fontSize: 12,
    fontWeight: '600',
  },
  quantitySectionRedesigned: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 16,
  },
  quantityItemRedesigned: {
    flex: 1,
  },
  quantityLabelRedesigned: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
    fontWeight: '500',
  },
  quantityValueRedesigned: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  quantityTextRedesigned: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  quantityInputContainerRedesigned: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    backgroundColor: 'white',
    minHeight: 40,
  },
  quantityButtonRedesigned: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 48,
    minHeight: 48,
  },
  quantityInputRedesigned: {
    flex: 1,
    paddingVertical: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
    minWidth: 50,
  },
  // Room Info & Statistics styles
  roomInfoSection: {
    backgroundColor: 'white',
    margin: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  roomInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  roomInfoIconContainer: {
    backgroundColor: '#EBF8FF',
    padding: 8,
    borderRadius: 8,
    marginRight: 12,
  },
  roomInfoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  roomDetailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  roomDetailItem: {
    width: '50%',
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  roomDetailLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 4,
  },
  roomDetailValue: {
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
  },
  roomDetailText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  statisticsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    padding: 12,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  statCardWide: {
    width: '100%',
  },
  statCardGreen: {
    backgroundColor: '#ECFDF5',
  },
  statCardOrange: {
    backgroundColor: '#FEF3C7',
  },
  statCardYellow: {
    backgroundColor: '#FEF3C7',
  },
  statCardPurple: {
    backgroundColor: '#F3E8FF',
  },
  statCardBlue: {
    backgroundColor: '#EBF8FF',
  },
  statCardGray: {
    backgroundColor: '#F9FAFB',
  },
  statNumberCompact: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabelCompact: {
    fontSize: 10,
    color: '#6B7280',
    textAlign: 'center',
  },
   // Classification Table Styles
  classificationTable: {
    marginBottom: 16,
  },
  classificationTableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  classificationTableTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    paddingHorizontal: 4,
  },
  saveNeighborsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3B82F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  saveNeighborsButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  roomCodeText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  // FlatList Styles
  flatListContainer: {
    maxHeight: 600, // Set maximum height for FlatList
  },
  flatListContent: {
    paddingBottom: 16, // Add padding at bottom
  },
  // Tab Styles
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 4,
    marginBottom: 16,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
    textAlign: 'center',
  },
  tabButtonTextActive: {
    color: '#3B82F6',
    fontWeight: '600',
  },
  tabContent: {
    minHeight: 200,
  },
  tabActionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  tabActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  emptyTabState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyTabText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 12,
    textAlign: 'center',
  },
  tableContainer: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tableHeaderText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  tableCellText: {
    flex: 1,
    fontSize: 12,
    color: '#111827',
  },
  // Other Asset Action Styles
  otherAssetActionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  otherAssetActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    flex: 1,
    marginHorizontal: 4,
    justifyContent: 'center',
  },
  checkButton: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  deleteButton: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  otherAssetActionText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },

  // Temp Adjacent Assets Styles - Simple Version
  tempAdjacentInfoBannerSimple: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 6,
    padding: 8,
    marginBottom: 12,
  },
  tempAdjacentInfoTextSimple: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 6,
  },
  tempAdjacentAssetCardSimple: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    backgroundColor: 'white',
  },
  tempAdjacentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  tempAdjacentInfo: {
    flex: 1,
    marginRight: 8,
  },
  tempAdjacentLabelContainer: {
    marginBottom: 4,
  },
  tempAdjacentLabelSimple: {
    fontSize: 9,
    fontWeight: '600',
    color: '#6B7280',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    alignSelf: 'flex-start',
  },
  tempAdjacentAssetId: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  tempAdjacentRoomInfo: {
    fontSize: 12,
    color: '#6B7280',
  },
  tempAdjacentAssetName: {
    fontSize: 14,
    color: '#374151',
    marginTop: 2,
    fontWeight: '500',
  },
  tempAdjacentLocationText: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
    fontWeight: '500',
  },
  statusBadgeSimple: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusBadgeTextSimple: {
    fontSize: 11,
    fontWeight: '500',
  },
  tempAdjacentQuantitySection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  fixedAssetConfirmSection: {
    marginTop: 12,
    alignItems: 'center',
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderColor: '#10B981',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  confirmButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
  },
  tempAdjacentQuantityItem: {
    flex: 1,
  },
  tempAdjacentQuantityLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 6,
    fontWeight: '500',
  },
  tempAdjacentQuantityValue: {
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 4,
    alignItems: 'center',
  },
  tempAdjacentQuantityText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  tempAdjacentQuantityInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 4,
    backgroundColor: 'white',
  },
  tempAdjacentQuantityButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
    minHeight: 44,
  },
  tempAdjacentQuantityInput: {
    flex: 1,
    paddingVertical: 6,
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
    minWidth: 40,
  },
  tempAdjacentUpdateNote: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  tempAdjacentUpdateText: {
    fontSize: 11,
    color: '#F59E0B',
    marginLeft: 4,
    fontWeight: '500',
  },
  deleteButtonSmall: {
    padding: 8,
    marginRight: 8,
  },
  
  // Unscanned Asset Styles
  unscannedAssetCard: {
    borderColor: '#F59E0B',
    borderWidth: 2,
    backgroundColor: '#FFFBEB',
  },
  unscannedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  unscannedText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#F59E0B',
    marginLeft: 4,
  },
  unscannedCounter: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  unscannedCounterText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F59E0B',
    marginLeft: 4,
  },
  
  // Tools Equipment Card Style
  toolsEquipmentCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    borderWidth: 1,
  },

});
