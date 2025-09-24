import React, { useState, useEffect } from 'react';
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
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';
import { RootState } from '../../redux/store';
import { useAppDispatch } from '../../redux/hooks';
import IconFeather from 'react-native-vector-icons/Feather';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AntDesign from 'react-native-vector-icons/AntDesign';
import { 
  setSelectedDevice,
  setRfidConnected,
  setScanning,
  updateDeviceStatus,
  saveTempInventoryResults,
  getTempInventoryResults,
  deleteTempInventoryResults,
  submitInventoryResult,
  classifyRfids,
  clearClassifyRfidsResult,
  setClassifyRfidsLoading,
  getRoomInventoryResults,
  AssetActionStatus,
  ScanMethod,
  SaveTempInventoryRequest,
} from '../../redux/slices/InventorySlice';
import { 
  scanDevices, 
  connectToDevice, 
  disconnectDevice,
  addLog,
  clearLogs
} from '../../redux/slices/BluetoothSlice';
import { 
  fetchDeviceInformation, 
  processResponse, 
  setDeviceMode, 
  setDevicePower, 
  startInventory, 
  stopInventory, 
  addScannedTag, 
  batchAddScannedTags, 
  resetScannedTagsMap, 
  setInventoryRunning,
  setDevice
} from '../../redux/slices/DeviceSlice';
import { deviceCommandManager } from '../../utils/DeviceCommands';
import { patchAssetByRfids, setTags } from '../../redux/slices/AssetSlice';
import { getAssetBookInventoryFromUnitIdAndRoomId } from '../../redux/slices/AssetBookSlice';
import { RootStackParamList } from '../../types/navigation';
import { AssetType } from '../../types';
import { ActionModal, ActionModalData } from '../../components/ActionModal';

const { width, height } = Dimensions.get('window');

// Define asset action status constants as fallback
const ASSET_ACTION_STATUS = {
  MATCHED: 'MATCHED',
  MISSING: 'MISSING',
  EXCESS: 'EXCESS',
  BROKEN: 'BROKEN',
  NEEDS_REPAIR: 'NEEDS_REPAIR',
  LIQUIDATION_PROPOSED: 'LIQUIDATION_PROPOSED'
} as const;

// Create a safe reference to AssetActionStatus
const SafeAssetActionStatus = AssetActionStatus || ASSET_ACTION_STATUS;

type InventoryScreenRouteProp = RouteProp<RootStackParamList, 'InventoryScreen'>;

export const InventoryScreen = () => {
  const dispatch = useAppDispatch();
  const navigation = useNavigation();
  const route = useRoute<InventoryScreenRouteProp>();
  
  // Get params from navigation
  const { roomId, unitId, assignmentId, sessionId, room, unit, session } = route.params;
  
  // Redux state
  const {
    selectedDevice,
    availableDevices,
    rfidConnected,
    scanning,
    tempResults,
    tempResultsLoading,
    saveTempResultsLoading,
    submitResultLoading,
    lastSubmittedResult,
    classifyRfidsResult,
    classifyRfidsLoading,
    roomInventoryResults,
    roomInventoryResultsLoading,
  } = useSelector((state: RootState) => state.inventory);

  // Bluetooth and Device state
  const bluetoothState = useSelector((state: RootState) => state.bluetooth);
  const device = useSelector((state: RootState) => state.device.device);
  const deviceInfo = useSelector((state: RootState) => state.device.deviceInfo);
  const scannedTagsCount = useSelector((state: RootState) => state.device.scannedTagsCount);
  const scannedTagsMap = useSelector((state: RootState) => state.device.scannedTagsMap);
  const tags = useSelector((state: RootState) => state.assets.tags);

  // Asset book state
  const { assetBookInventory, loading: assetBookLoading, error: assetBookError } = useSelector((state: RootState) => state.assetBook);

  // Local state
  const [showDeviceList, setShowDeviceList] = useState(false);
  const [inventoryResults, setInventoryResults] = useState<{[assetId: string]: any}>({});
  const [selectedAssetType, setSelectedAssetType] = useState<AssetType>(AssetType.FIXED_ASSET);
  const [showRoomInfo, setShowRoomInfo] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [isInventoryRunning, setIsInventoryRunning] = useState(false);
  
  // Action modal state
  const [showActionModal, setShowActionModal] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<any>(null);
  const [actionType, setActionType] = useState<'LIQUIDATION' | 'REPAIR' | 'VIEW_RESULT' | null>(null);
  
  // RFID classification state
  const [classifiedRfids, setClassifiedRfids] = useState<Set<string>>(new Set());
  
  // Tab state for classification results
  const [activeClassificationTab, setActiveClassificationTab] = useState<'neighbors' | 'otherRooms'>('neighbors');
  
  // State for managing removed assets
  const [removedOtherAssets, setRemovedOtherAssets] = useState<Set<string>>(new Set());
  const [checkedOtherAssets, setCheckedOtherAssets] = useState<Set<string>>(new Set());
  
  // State for tracking if room has submitted results
  const [hasSubmittedResults, setHasSubmittedResults] = useState(false);
  const [submittedResults, setSubmittedResults] = useState<{[assetId: string]: any}>({});

  // Setup device monitoring when device is connected
  useEffect(() => {
    if (device && bluetoothState.isConnected) {
      deviceCommandManager.setupMonitoring(
        device,
        (response) => {
          dispatch(processResponse(response));
          
          // Handle inventory tags
          if (response.cmd === 'cmd_customized_session_target_inventory_start' && response.tags) {
            handleRfidTagsDetected(response.tags);
          } else if (response.cmd === 'cmd_customized_session_target_inventory_stop') {
            setIsInventoryRunning(false);
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

  // Handle RFID tags detected from device
  const handleRfidTagsDetected = async (rfidTags: string[]) => {
    const unknownRfids: string[] = [];
    
    rfidTags.forEach(rfidId => {
      // Find asset with matching RFID tag
      const matchedAsset = findAssetByRfidId(rfidId);
      
      if (matchedAsset) {
        // Update inventory result for matched asset
        updateInventoryResultForRfidMatch(matchedAsset);
      } else {
        // Check if RFID has already been classified
        if (!classifiedRfids.has(rfidId)) {
          unknownRfids.push(rfidId);
        }
      }
    });
    
    // If there are unknown RFID tags that haven't been classified, classify them
    if (unknownRfids.length > 0) {
      await handleClassifyRfids(unknownRfids);
    }
  };

  const findAssetByRfidId = (rfidId: string) => {
    // Search through all asset types in current asset book
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

  const updateInventoryResultForRfidMatch = (asset: any) => {
    const assetId = asset.assetId;
    const systemQuantity = asset.quantity;
    
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
          scanMethod: ScanMethod.RFID, // Mark as scanned by RFID
        },
      };
    });
  };

  const showScanFeedback = (type: 'success' | 'warning' | 'error', message: string) => {
    if (type === 'warning' || type === 'error') {
      Alert.alert('RFID Scan', message);
    }
  };

  // Function to classify RFID tags
  const handleClassifyRfids = async (rfids: string[]) => {
    if (rfids.length === 0) return;

    dispatch(setClassifyRfidsLoading(true));
    try {
      const result = await dispatch(classifyRfids({
        rfids,
        currentRoomId: roomId,
        currentUnitId: unitId
      })).unwrap();


      // Initialize inventory results with default quantity 1 for neighbors and other rooms
      const newInventoryResults: {[key: string]: any} = {};
      
      // Set default quantity 1 for neighbors
      result.neighbors.forEach((asset: any) => {
        const key = asset.id; // Use pure asset ID without prefix
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
      
      // Set default quantity 1 for other rooms
      result.otherRooms.forEach((asset: any) => {
        const key = asset.id; // Use pure asset ID without prefix
        if (!inventoryResults[key]) {
          newInventoryResults[key] = {
            quantity: 1,
            systemQuantity: 1,
            status: SafeAssetActionStatus.MATCHED,
            updatedAt: new Date().toISOString(),
            scanMethod: ScanMethod.RFID,
            assetType: 'other', // Add type to distinguish
          };
        }
      });
      
      // Update inventory results if there are new assets
      if (Object.keys(newInventoryResults).length > 0) {
        setInventoryResults(prev => ({
          ...prev,
          ...newInventoryResults
        }));
      }
      
      // Mark these RFIDs as classified
      setClassifiedRfids(prev => {
        const newSet = new Set(prev);
        rfids.forEach(rfid => newSet.add(rfid));
        return newSet;
      });
    } catch (error) {
      console.error('Failed to classify RFID tags:', error);
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
        // Check if room has submitted results first
        try {
          const submittedResults = await dispatch(getRoomInventoryResults({
            roomId,
            assignmentId,
          })).unwrap();
          
          if (submittedResults && submittedResults.length > 0) {
            // Room has submitted results - show them in read-only mode
            setHasSubmittedResults(true);
            const submittedResultsMap: { [key: string]: any } = {};
            submittedResults.forEach((result: any) => {
              submittedResultsMap[result.assetId] = {
                quantity: result.countedQuantity,
                systemQuantity: result.systemQuantity,
                status: result.status,
                note: result.note || '',
                imageUrls: result.imageUrls || [],
                updatedAt: result.createdAt,
                scanMethod: result.scanMethod,
                isSubmitted: true,
              };
            });
            setSubmittedResults(submittedResultsMap);
            return; // Don't load temp results if already submitted
          }
        } catch (error) {
          // No submitted results found, continue with temp results
          console.log('No submitted results found, loading temp results');
        }
        console.log('hi  ', unitId, roomId);
        // Load asset book data
        const assetBookResult = await dispatch(getAssetBookInventoryFromUnitIdAndRoomId({
          unitId,
          roomId,
        })).unwrap();
        
        
        
        // Initialize inventory results when asset book data is loaded
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
        
        // Load temp results if available
        if (roomId) {
          try {
            const tempResults = await dispatch(getTempInventoryResults(roomId)).unwrap();
            if (tempResults?.inventoryResults) {
              setInventoryResults(tempResults.inventoryResults);
            }
          } catch (error) {
            // Silent fail for temp results
          }
        }
      } catch (error: any) {
        const errorMessage = error?.message || 'Không thể tải dữ liệu sổ tài sản';
        Alert.alert('Lỗi', errorMessage);
      }
    };

    loadAllData();
  }, [dispatch, unitId, roomId, assignmentId]);

  // Handle asset book error
  useEffect(() => {
    if (assetBookError) {
      Alert.alert('Lỗi', assetBookError);
    }
  }, [assetBookError]);

  // Get assets by type from asset book
  const getAssetsByType = (type: AssetType) => {
    if (!assetBookInventory?.assetTypes) return [];
    
    const assetTypeData = assetBookInventory.assetTypes.find(
      (at: any) => at.type === type
    );
    return assetTypeData?.items || [];
  };

  // Get current assets based on selected type
  const currentAssets = getAssetsByType(selectedAssetType);
  
  // Use submitted results if available, otherwise use temp results
  const displayResults = hasSubmittedResults ? submittedResults : inventoryResults;

  // Get asset IDs that are already in the asset book to avoid duplicates
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

  const assetBookAssetIds = getAssetBookAssetIds();

  // Filter out assets that are already in asset book from classification results
  const getFilteredNeighbors = () => {
    if (!classifyRfidsResult?.neighbors) return [];
    return classifyRfidsResult.neighbors.filter((asset: any) => !assetBookAssetIds.has(asset.id));
  };

  const getFilteredOtherRooms = () => {
    if (!classifyRfidsResult?.otherRooms) return [];
    return classifyRfidsResult.otherRooms.filter((asset: any) => !assetBookAssetIds.has(asset.id));
  };

  // Device control handlers
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
      // Clear previous classification results when starting new scan
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
    if (!device) {
      return;
    }
    
    try {
      await dispatch(stopInventory(device));
      setIsInventoryRunning(false);
      dispatch(setScanning(false));
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể dừng quét RFID');
    }
  };

  // Inventory management handlers
  const handleSaveTempResults = async () => {
    if (Object.keys(inventoryResults).length === 0) {
      Alert.alert('Thông báo', 'Không có dữ liệu kiểm kê để lưu');
      return;
    }

    if (!roomId || !unitId || !sessionId) {
      Alert.alert('Lỗi', 'Thiếu thông tin cần thiết để lưu tạm');
      return;
    }

    const saveData: SaveTempInventoryRequest = {
      roomId,
      unitId,
      sessionId,
      inventoryResults,
      note: `Lưu tạm kết quả kiểm kê phòng ${room?.roomCode || roomId}`,
      ttlSeconds: 86400, // 24 hours
    };

    try {
      await dispatch(saveTempInventoryResults(saveData)).unwrap();
      Alert.alert('Thành công', 'Đã lưu tạm kết quả kiểm kê');
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể lưu tạm kết quả kiểm kê');
    }
  };

  const handleDeleteTempResults = async () => {
    if (!roomId) {
      Alert.alert('Lỗi', 'Thiếu thông tin phòng');
      return;
    }

    try {
      await dispatch(deleteTempInventoryResults(roomId)).unwrap();
      setInventoryResults({});
      Alert.alert('Thành công', 'Đã xóa kết quả tạm thời');
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể xóa kết quả tạm thời');
    }
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
      Alert.alert('Lỗi', 'Không thể gửi kết quả kiểm kê');
    }
  };

  const handleQuantityChange = (assetId: string, quantity: number) => {
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
  };

  // Handler for neighbor assets quantity change
  const handleNeighborQuantityChange = (assetId: string, quantity: number) => {
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
  };

  // Handler for other room assets quantity change
  const handleOtherRoomQuantityChange = (assetId: string, quantity: number) => {
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
  };

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

  // Handler for saving neighbors temp results
  const handleSaveNeighborsTemp = () => {
    const neighborAssets = classifyRfidsResult?.neighbors || [];
    const neighborResults: { [key: string]: any } = {};
    
    neighborAssets.forEach((asset: any) => {
      const key = `neighbor-${asset.id}`;
      if (inventoryResults[key]) {
        neighborResults[key] = inventoryResults[key];
      }
    });

    console.log('Saving neighbors temp results:', {
      count: Object.keys(neighborResults).length,
      results: neighborResults
    });
    
    Alert.alert('Thành công', `Đã lưu tạm ${Object.keys(neighborResults).length} tài sản hàng xóm`);
  };

  // Calculate statistics
  const getStatistics = () => {
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
        
        // Count scan methods
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
  };

  const stats = getStatistics();


  const getSelectedDeviceInfo = () => {
    return availableDevices.find(device => device.id === selectedDevice);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return '#10B981';
      case 'busy': return '#F59E0B';
      case 'offline': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'online': return 'Sẵn sàng';
      case 'busy': return 'Đang sử dụng';
      case 'offline': return 'Ngoại tuyến';
      default: return 'Không xác định';
    }
  };

  // Action modal handlers
  const handleLiquidationAction = (asset: any) => {
    setSelectedAsset(asset);
    setActionType('LIQUIDATION');
    setShowActionModal(true);
  };

  const handleRepairAction = (asset: any) => {
    setSelectedAsset(asset);
    setActionType('REPAIR');
    setShowActionModal(true);
  };

  const handleViewResult = (asset: any) => {
    setSelectedAsset(asset);
    setActionType('VIEW_RESULT');
    setShowActionModal(true);
  };

  const handleActionConfirm = async (data: ActionModalData) => {
    if (!selectedAsset) return;

    try {
      // Update inventory result with action data
      setInventoryResults(prev => ({
        ...prev,
        [selectedAsset.assetId]: {
          ...prev[selectedAsset.assetId],
          status: data.status,
          note: data.reason || prev[selectedAsset.assetId]?.note || '',
          imageUrls: [...(prev[selectedAsset.assetId]?.imageUrls || []), ...data.images],
          updatedAt: new Date().toISOString(),
        },
      }));

      setShowActionModal(false);
      setSelectedAsset(null);
      setActionType(null);
    } catch (error) {
      console.error('Error updating asset action:', error);
      Alert.alert('Lỗi', 'Không thể cập nhật hành động cho tài sản');
    }
  };

  const handleCloseActionModal = () => {
    setShowActionModal(false);
    setSelectedAsset(null);
    setActionType(null);
  };

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
      {/* Header */}
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

      {/* Room Information & Statistics - Collapsible */}
      {showRoomInfo && (
        <View style={styles.roomInfoSection}>
          <View style={styles.roomInfoHeader}>
            <View style={styles.roomInfoIconContainer}>
              <Ionicons name="home" size={20} color="#3B82F6" />
            </View>
            <Text style={styles.roomInfoTitle}>Thông tin phòng & Thống kê</Text>
          </View>

          {/* Room Details */}
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

          {/* Statistics */}
          <View style={styles.statisticsGrid}>
            <View style={[styles.statCard, styles.statCardGreen]}>
              <Text style={[styles.statNumberCompact, { color: '#10B981' }]}>{stats.matched}</Text>
              <Text style={styles.statLabelCompact}>Khớp</Text>
            </View>
            <View style={[styles.statCard, styles.statCardOrange]}>
              <Text style={[styles.statNumberCompact, { color: '#F59E0B' }]}>{stats.missing}</Text>
              <Text style={styles.statLabelCompact}>Thiếu</Text>
            </View>
            <View style={[styles.statCard, styles.statCardYellow]}>
              <Text style={[styles.statNumberCompact, { color: '#F59E0B' }]}>{stats.excess}</Text>
              <Text style={styles.statLabelCompact}>Thừa</Text>
            </View>
            <View style={[styles.statCard, styles.statCardPurple]}>
              <Text style={[styles.statNumberCompact, { color: '#8B5CF6' }]}>0</Text>
              <Text style={styles.statLabelCompact}>Đề xuất thanh lý</Text>
            </View>
            <View style={[styles.statCard, styles.statCardYellow]}>
              <Text style={[styles.statNumberCompact, { color: '#F59E0B' }]}>0</Text>
              <Text style={styles.statLabelCompact}>Cần sửa chữa</Text>
            </View>
            <View style={[styles.statCard, styles.statCardBlue]}>
              <Text style={[styles.statNumberCompact, { color: '#3B82F6' }]}>{stats.counted}</Text>
              <Text style={styles.statLabelCompact}>Đã kiểm</Text>
            </View>
            <View style={[styles.statCard, styles.statCardGray, styles.statCardWide]}>
              <Text style={[styles.statNumberCompact, { color: '#6B7280' }]}>{stats.total}</Text>
              <Text style={styles.statLabelCompact}>Tổng</Text>
            </View>
          </View>
        </View>
      )}

      {/* Asset Type Selector */}
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

      {/* Device Control Section - Only show for TOOLS_EQUIPMENT and not submitted */}
      {!hasSubmittedResults && selectedAssetType === AssetType.FIXED_ASSET && (
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
              
              {isInventoryRunning ? (
                <TouchableOpacity
                  onPress={handleStopScan}
                  style={[styles.controlButton, styles.stopButton]}
                >
                  <ActivityIndicator size="small" color="white" />
                  <Text style={styles.controlButtonText}>Dừng quét</Text>
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
          <Text style={styles.sectionTitle}>Danh sách tài sản ({currentAssets.length})</Text>
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
            renderItem={({ item: asset, index }) => {
              const result = displayResults[asset.assetId];
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

              return (
                <View style={styles.assetCardRedesigned}>
                  <View style={styles.assetHeaderRedesigned}>
                    <View style={styles.assetInfoRedesigned}>
                      <Text style={styles.assetCodeRedesigned}>{asset.asset?.ktCode || 'Mã tài sản'}</Text>
                      <Text style={styles.assetNameRedesigned} numberOfLines={1}>
                        {asset.asset?.name || 'Tên tài sản'}
                      </Text>
                    </View>
                    <View style={[styles.statusBadgeRedesigned, { backgroundColor: statusInfo.bgColor }]}>
                      <Text style={[styles.statusBadgeTextRedesigned, { color: statusInfo.color }]}>
                        {statusInfo.text}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.quantitySectionRedesigned}>
                    <View style={styles.quantityItemRedesigned}>
                      <Text style={styles.quantityLabelRedesigned}>Sổ tài sản</Text>
                      <View style={styles.quantityValueRedesigned}>
                        <Text style={styles.quantityTextRedesigned}>{systemQuantity}</Text>
                      </View>
                    </View>
                    
                    <View style={styles.quantityItemRedesigned}>
                      <Text style={styles.quantityLabelRedesigned}>Kiểm kê</Text>
                      <View style={styles.quantityInputContainerRedesigned}>
                        <TouchableOpacity 
                          style={[styles.quantityButtonRedesigned, hasSubmittedResults && styles.disabledButton]}
                          onPress={() => !hasSubmittedResults && handleQuantityChange(asset.assetId, Math.max(0, countedQuantity - 1))}
                          disabled={hasSubmittedResults}
                        >
                          <Ionicons name="remove" size={18} color={hasSubmittedResults ? "#9CA3AF" : "#6B7280"} />
                        </TouchableOpacity>
                        <TextInput
                          style={[styles.quantityInputRedesigned, hasSubmittedResults && styles.disabledInput]}
                          value={countedQuantity.toString()}
                          onChangeText={(text) => !hasSubmittedResults && handleQuantityChange(asset.assetId, parseInt(text) || 0)}
                          keyboardType="numeric"
                          placeholder="0"
                          textAlign="center"
                          editable={!hasSubmittedResults}
                        />
                        <TouchableOpacity 
                          style={[styles.quantityButtonRedesigned, hasSubmittedResults && styles.disabledButton]}
                          onPress={() => !hasSubmittedResults && handleQuantityChange(asset.assetId, countedQuantity + 1)}
                          disabled={hasSubmittedResults}
                        >
                          <Ionicons name="add" size={18} color={hasSubmittedResults ? "#9CA3AF" : "#6B7280"} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>

                  {!hasSubmittedResults && (
                    <View style={styles.assetActionsRedesigned}>
                      <TouchableOpacity 
                        style={[styles.actionButtonRedesigned, styles.liquidationButtonRedesigned]}
                        onPress={() => handleLiquidationAction(asset)}
                      >
                        <Ionicons name="trash-outline" size={16} color="#3B82F6" />
                        <Text style={styles.actionButtonTextRedesigned}>Thanh lý</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.actionButtonRedesigned, styles.repairButtonRedesigned]}
                        onPress={() => handleRepairAction(asset)}
                      >
                        <Ionicons name="build-outline" size={16} color="#F59E0B" />
                        <Text style={styles.actionButtonTextRedesigned}>Sửa chữa</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  
                  {hasSubmittedResults && (
                    <View style={styles.submittedInfoContainer}>
                      <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                      <Text style={styles.submittedInfoText}>Đã gửi kết quả</Text>
                    </View>
                  )}
                </View>
              );
            }}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews={true}
            maxToRenderPerBatch={10}
            updateCellsBatchingPeriod={50}
            initialNumToRender={10}
            windowSize={10}
            getItemLayout={(data, index) => ({
              length: 200, // Approximate height of each item
              offset: 200 * index,
              index,
            })}
          />
        )}
      </View>

      {/* RFID Classification Results Section - Only show if not submitted */}
      {!hasSubmittedResults && classifyRfidsResult && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Kết quả phân loại RFID</Text>
            <View style={styles.sectionHeaderRight}>
              {classifyRfidsLoading && (
                <ActivityIndicator size="small" color="#3B82F6" style={{ marginRight: 8 }} />
              )}
              <TouchableOpacity
                onPress={() => {
                  dispatch(clearClassifyRfidsResult());
                  setClassifiedRfids(new Set());
                }}
                style={styles.clearButton}
              >
                <Ionicons name="close-circle-outline" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Tab Navigation */}
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
                Hàng xóm ({getFilteredNeighbors().length})
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
                Phòng khác ({getFilteredOtherRooms().length})
              </Text>
            </TouchableOpacity>

          {/* Tab Content */}
          <View style={styles.tabContent}>
            {activeClassificationTab === 'neighbors' && (
              <View>
                {classifyRfidsResult.neighbors?.length > 0 ? (
                  <View>
                    <View style={styles.tabActionHeader}>
                      <Text style={styles.tabActionText}>
                        Tài sản hàng xóm ({classifyRfidsResult.neighbors.length})
                      </Text>
                      <TouchableOpacity
                        onPress={handleSaveNeighborsTemp}
                        style={styles.saveNeighborsButton}
                      >
                        <Ionicons name="save-outline" size={16} color="white" />
                        <Text style={styles.saveNeighborsButtonText}>Lưu tạm tất cả</Text>
                      </TouchableOpacity>
                    </View>
                    
                    <FlatList
                      data={getFilteredNeighbors()}
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
                          <View style={styles.assetCardRedesigned}>
                            <View style={styles.assetHeaderRedesigned}>
                              <View style={styles.assetInfoRedesigned}>
                                <Text style={styles.assetCodeRedesigned}>{asset.ktCode || 'Mã tài sản'}</Text>
                                <Text style={styles.assetNameRedesigned} numberOfLines={1}>
                                  {asset.name || 'Tên tài sản'}
                                </Text>
                                <Text style={styles.roomCodeText}>Phòng: {asset.currentRoomId || 'N/A'}</Text>
                              </View>
                              <View style={[styles.statusBadgeRedesigned, { backgroundColor: statusInfo.bgColor }]}>
                                <Text style={[styles.statusBadgeTextRedesigned, { color: statusInfo.color }]}>
                                  {statusInfo.text}
                                </Text>
                              </View>
                            </View>

                            <View style={styles.quantitySectionRedesigned}>
                              <View style={styles.quantityItemRedesigned}>
                                <Text style={styles.quantityLabelRedesigned}>Sổ tài sản</Text>
                                <View style={styles.quantityValueRedesigned}>
                                  <Text style={styles.quantityTextRedesigned}>{systemQuantity}</Text>
                                </View>
                              </View>
                              
                              <View style={styles.quantityItemRedesigned}>
                                <Text style={styles.quantityLabelRedesigned}>Kiểm kê</Text>
                                <View style={styles.quantityInputContainerRedesigned}>
                                  <TouchableOpacity 
                                    style={styles.quantityButtonRedesigned}
                                    onPress={() => handleNeighborQuantityChange(asset.id, Math.max(0, countedQuantity - 1))}
                                  >
                                    <Ionicons name="remove" size={18} color="#6B7280" />
                                  </TouchableOpacity>
                                  <TextInput
                                    style={styles.quantityInputRedesigned}
                                    value={countedQuantity.toString()}
                                    onChangeText={(text) => handleNeighborQuantityChange(asset.id, parseInt(text) || 0)}
                                    keyboardType="numeric"
                                    placeholder="0"
                                    textAlign="center"
                                  />
                                  <TouchableOpacity 
                                    style={styles.quantityButtonRedesigned}
                                    onPress={() => handleNeighborQuantityChange(asset.id, countedQuantity + 1)}
                                  >
                                    <Ionicons name="add" size={18} color="#6B7280" />
                                  </TouchableOpacity>
                                </View>
                              </View>
                            </View>
                          </View>
                        );
                      }}
                      showsVerticalScrollIndicator={false}
                      removeClippedSubviews={true}
                      maxToRenderPerBatch={5}
                      updateCellsBatchingPeriod={50}
                      initialNumToRender={5}
                      windowSize={5}
                      getItemLayout={(data, index) => ({
                        length: 200,
                        offset: 200 * index,
                        index,
                      })}
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
                {getFilteredOtherRooms().length > 0 ? (
                  <FlatList
                    data={getFilteredOtherRooms().filter((asset: any) => !removedOtherAssets.has(asset.id))}
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
                        <View style={styles.assetCardRedesigned}>
                          <View style={styles.assetHeaderRedesigned}>
                            <View style={styles.assetInfoRedesigned}>
                              <Text style={styles.assetCodeRedesigned}>{asset.ktCode || 'Mã tài sản'}</Text>
                              <Text style={styles.assetNameRedesigned} numberOfLines={1}>
                                {asset.name || 'Tên tài sản'}
                              </Text>
                              <Text style={styles.roomCodeText}>Phòng: {asset.currentRoom?.roomCode || 'N/A'}</Text>
                            </View>
                            <View style={[styles.statusBadgeRedesigned, { backgroundColor: statusInfo.bgColor }]}>
                              <Text style={[styles.statusBadgeTextRedesigned, { color: statusInfo.color }]}>
                                {statusInfo.text}
                              </Text>
                            </View>
                          </View>

                          <View style={styles.quantitySectionRedesigned}>
                            <View style={styles.quantityItemRedesigned}>
                              <Text style={styles.quantityLabelRedesigned}>Sổ tài sản</Text>
                              <View style={styles.quantityValueRedesigned}>
                                <Text style={styles.quantityTextRedesigned}>{systemQuantity}</Text>
                              </View>
                            </View>
                            
                            <View style={styles.quantityItemRedesigned}>
                              <Text style={styles.quantityLabelRedesigned}>Kiểm kê</Text>
                              <View style={styles.quantityInputContainerRedesigned}>
                                <TouchableOpacity 
                                  style={styles.quantityButtonRedesigned}
                                  onPress={() => handleOtherRoomQuantityChange(asset.id, Math.max(0, countedQuantity - 1))}
                                >
                                  <Ionicons name="remove" size={18} color="#6B7280" />
                                </TouchableOpacity>
                                <TextInput
                                  style={styles.quantityInputRedesigned}
                                  value={countedQuantity.toString()}
                                  onChangeText={(text) => handleOtherRoomQuantityChange(asset.id, parseInt(text) || 0)}
                                  keyboardType="numeric"
                                  placeholder="0"
                                  textAlign="center"
                                />
                                <TouchableOpacity 
                                  style={styles.quantityButtonRedesigned}
                                  onPress={() => handleOtherRoomQuantityChange(asset.id, countedQuantity + 1)}
                                >
                                  <Ionicons name="add" size={18} color="#6B7280" />
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
                    removeClippedSubviews={true}
                    maxToRenderPerBatch={5}
                    updateCellsBatchingPeriod={50}
                    initialNumToRender={5}
                    windowSize={5}
                    getItemLayout={(data, index) => ({
                      length: 200,
                      offset: 200 * index,
                      index,
                    })}
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

      {/* Action Buttons Section - Only show if not submitted */}
      {!hasSubmittedResults && (
        <View style={styles.section}>
          <View style={styles.actionButtonsContainer}>
            <TouchableOpacity
              onPress={handleSaveTempResults}
              disabled={saveTempResultsLoading}
              style={[styles.actionButtonLarge, styles.saveTempButton]}
            >
              {saveTempResultsLoading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Ionicons name="save-outline" size={20} color="white" />
              )}
              <Text style={styles.actionButtonLargeText}>
                {saveTempResultsLoading ? 'Đang lưu...' : 'Lưu tạm'}
              </Text>
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
      )}

      {/* Submitted Results Info - Only show if submitted */}
      {hasSubmittedResults && (
        <View style={styles.section}>
          <View style={styles.submittedResultsInfo}>
            <Ionicons name="checkmark-circle" size={24} color="#10B981" />
            <Text style={styles.submittedResultsTitle}>Phòng đã hoàn thành kiểm kê</Text>
            <Text style={styles.submittedResultsSubtitle}>
              Kết quả đã được gửi và không thể chỉnh sửa
            </Text>
          </View>
        </View>
      )}
      </ScrollView>
      
      {/* Action Modal - Outside ScrollView */}
      <ActionModal
        visible={showActionModal}
        onClose={handleCloseActionModal}
        asset={selectedAsset}
        actionType={actionType}
        onConfirm={handleActionConfirm}
      />
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
  assetCard: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  assetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  assetInfo: {
    flex: 1,
  },
  assetName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  assetSpecs: {
    fontSize: 14,
    color: '#6B7280',
  },
  assetStatus: {
    marginLeft: 12,
  },
  quantitySection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  quantityItem: {
    flex: 1,
    marginHorizontal: 4,
  },
  quantityLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  quantityValue: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  quantityText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
  },
  quantityInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    textAlign: 'center',
  },
  assetActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  liquidationButton: {
    borderColor: '#3B82F6',
    backgroundColor: '#EBF8FF',
  },
  repairButton: {
    borderColor: '#F59E0B',
    backgroundColor: '#FFFBEB',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
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
    backgroundColor: '#6B7280',
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
  // Compact styles
  assetCardCompact: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  assetHeaderCompact: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  assetInfoCompact: {
    flex: 1,
    marginRight: 8,
  },
  assetCodeCompact: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 1,
  },
  assetNameCompact: {
    fontSize: 11,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 1,
    lineHeight: 14,
  },
  assetSpecsCompact: {
    fontSize: 10,
    color: '#6B7280',
    lineHeight: 12,
  },
  statusBadgeCompact: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  statusBadgeTextCompact: {
    fontSize: 9,
    fontWeight: '600',
  },
  quantitySectionCompact: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  quantityItemCompact: {
    flex: 1,
    marginHorizontal: 2,
  },
  quantityLabelCompact: {
    fontSize: 9,
    color: '#6B7280',
    marginBottom: 3,
    textAlign: 'center',
  },
  quantityValueCompact: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 4,
    alignItems: 'center',
  },
  quantityTextCompact: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
  },
  quantityInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 4,
    backgroundColor: 'white',
    minHeight: 28,
  },
  quantityButton: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 24,
  },
  quantityInputCompact: {
    flex: 1,
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: '500',
    color: '#111827',
    textAlign: 'center',
    minWidth: 30,
  },
  assetActionsCompact: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 4,
  },
  actionButtonCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 3,
    borderWidth: 1,
  },
  liquidationButtonCompact: {
    borderColor: '#3B82F6',
    backgroundColor: '#EBF8FF',
  },
  repairButtonCompact: {
    borderColor: '#F59E0B',
    backgroundColor: '#FFFBEB',
  },
  actionButtonTextCompact: {
    fontSize: 9,
    fontWeight: '500',
    marginLeft: 2,
  },
  rfidInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  rfidInfoText: {
    fontSize: 9,
    color: '#10B981',
    marginLeft: 4,
    fontWeight: '500',
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
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  assetNameRedesigned: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    lineHeight: 20,
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 40,
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
  assetActionsRedesigned: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  actionButtonRedesigned: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 100,
    justifyContent: 'center',
  },
  liquidationButtonRedesigned: {
    borderColor: '#3B82F6',
    backgroundColor: '#EBF8FF',
  },
  repairButtonRedesigned: {
    borderColor: '#F59E0B',
    backgroundColor: '#FFFBEB',
  },
  actionButtonTextRedesigned: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
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
    width: '30%',
    padding: 12,
    borderRadius: 8,
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
    maxHeight: 800, // Set maximum height for FlatList
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
  // Disabled styles
  disabledButton: {
    opacity: 0.5,
  },
  disabledInput: {
    backgroundColor: '#F3F4F6',
    color: '#9CA3AF',
  },
  // Submitted results styles
  submittedInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  submittedInfoText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#10B981',
    marginLeft: 6,
  },
  submittedResultsInfo: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  submittedResultsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10B981',
    marginTop: 8,
    marginBottom: 4,
  },
  submittedResultsSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
});
