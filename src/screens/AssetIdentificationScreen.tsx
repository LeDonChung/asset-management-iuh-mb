/* eslint-disable react-native/no-inline-styles */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useAppDispatch, useAppSelector } from '../redux/hooks';
import { Device } from 'react-native-ble-plx';
import axiosInstance from '../lib/api';
import { deviceCommandManager } from '../utils/DeviceCommands';
import { AssetType, FieldType, FilterOperator } from '../types';

interface UnidentifiedAsset {
  id: string;
  ktCode: string;
  fixedCode: string;
  name: string;
  specs?: string;
  unit: string;
  quantity: number;
  origin?: string;
  entrydate: string;
  category?: {
    id: string;
    name: string;
  };
  currentRoom?: {
    id: string;
    name: string;
  };
  rfidTag?: {
    rfidId: string;
  };
}

interface UnidentifiedAssetFilter {
  pagination: {
    currentPage: number;
    itemsPerPage: number;
  };
  sorting: any[];
  conditions: Array<{
    field: string;
    fieldType: string;
    operator: string;
    value: any[];
  }>;
}

interface AssetListResponse {
  data: UnidentifiedAsset[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const AssetIdentificationScreen = () => {
  const dispatch = useAppDispatch();
  const { device } = useAppSelector((state) => state.device);
  const { devices, selectedDevice } = useAppSelector((state) => state.bluetooth);

  const [assets, setAssets] = useState<UnidentifiedAsset[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<UnidentifiedAsset | null>(null);
  const [selectedBleDevice, setSelectedBleDevice] = useState<Device | null>(null);
  const [scannedRfid, setScannedRfid] = useState<string>('');

  const [isLoadingAssets, setIsLoadingAssets] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasStoppedRef = useRef<boolean>(false);

  useEffect(() => {
    loadUnidentifiedAssets();
  }, []);

  useEffect(() => {
    const targetDevice = (selectedBleDevice || device) as Device | null;
    if (!targetDevice) return;

    deviceCommandManager.setupMonitoring(
      targetDevice,
      (response) => {
        const cmdStr = String(response?.cmd || '').toLowerCase().replace(/_/g, '');
        const isInventoryCmd = cmdStr.includes('inventory') && cmdStr.includes('start');
        
        if (isInventoryCmd && response?.tags) {
          let tagsArray: string[] = [];
          if (Array.isArray(response.tags)) {
            tagsArray = response.tags;
          } else if (typeof response.tags === 'string') {
            tagsArray = [response.tags];
          } else if (response.tags) {
            try {
              tagsArray = Object.values(response.tags);
            } catch (e) {}
          }

          if (tagsArray.length > 0 && !hasStoppedRef.current) {
            const regexTag = /^E2[0-9A-F]{22}$/;
            const firstTag = tagsArray.find((tag: any) => {
              const tagStr = String(tag).trim().toUpperCase();
              return regexTag.test(tagStr);
            });

            if (firstTag) {
              const tagValue = String(firstTag).trim().toUpperCase();
              hasStoppedRef.current = true;
              setScannedRfid(tagValue);
              setIsScanning(false);

              if (scanTimeoutRef.current) {
                clearTimeout(scanTimeoutRef.current);
                scanTimeoutRef.current = null;
              }

              deviceCommandManager.stopInventory(targetDevice).catch(() => {});
            }
          }
        }
      },
      () => {
        setIsScanning(false);
      }
    );

    return () => {
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }
    };
  }, [selectedBleDevice, device]);

  const loadUnidentifiedAssets = useCallback(async (page: number = 1, search: string = '') => {
    try {
      setIsLoadingAssets(true);

      const filter: UnidentifiedAssetFilter = {
        pagination: {
          currentPage: page,
          itemsPerPage: 20,
        },
        sorting: [],
        conditions: [
          {
            field: 'type',
            fieldType: FieldType.SELECT,
            operator: FilterOperator.EQUALS,
            value: [AssetType.FIXED_ASSET],
          },
          ...(search
            ? [
                {
                  field: 'name',
                  fieldType: FieldType.TEXT,
                  operator: FilterOperator.CONTAINS,
                  value: [search],
                },
              ]
            : []),
        ],
      };

      const response = await axiosInstance.post<AssetListResponse>(
        'api/v1/assets/unidentified',
        filter
      );

      setAssets(response.data.data);
      setCurrentPage(response.data.pagination.page);
      setTotalPages(response.data.pagination.totalPages);
    } catch (error: any) {
      Alert.alert('Lỗi', error.response?.data?.message || 'Không thể tải danh sách tài sản');
    } finally {
      setIsLoadingAssets(false);
      setIsRefreshing(false);
    }
  }, []);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    setCurrentPage(1);
    loadUnidentifiedAssets(1, searchTerm);
  }, [searchTerm, loadUnidentifiedAssets]);

  const handleSearch = useCallback(() => {
    setCurrentPage(1);
    loadUnidentifiedAssets(1, searchTerm);
  }, [searchTerm, loadUnidentifiedAssets]);

  const handleSelectAsset = (asset: UnidentifiedAsset) => {
    setSelectedAsset(asset);
    setScannedRfid('');
  };

  const handleSelectDevice = (deviceId: string) => {
    const selected = devices.find((d) => d.id === deviceId);
    if (selected) {
      setSelectedBleDevice(selected);
    }
  };

  const handleStartScan = async () => {
    if (!selectedBleDevice && !device) {
      Alert.alert('Lỗi', 'Vui lòng chọn thiết bị Bluetooth');
      return;
    }

    if (!selectedAsset) {
      Alert.alert('Lỗi', 'Vui lòng chọn tài sản cần định danh');
      return;
    }

    try {
      hasStoppedRef.current = false;
      setIsScanning(true);
      setScannedRfid('');

      const targetDevice = (selectedBleDevice || device) as Device;

      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }

      scanTimeoutRef.current = setTimeout(async () => {
        if (!hasStoppedRef.current) {
          hasStoppedRef.current = true;
          setIsScanning(false);
          await deviceCommandManager.stopInventory(targetDevice);
        }
      }, 30000);

      const result = await deviceCommandManager.startInventory(targetDevice);

      if (!result.success) {
        setIsScanning(false);
        hasStoppedRef.current = true;
        if (scanTimeoutRef.current) {
          clearTimeout(scanTimeoutRef.current);
          scanTimeoutRef.current = null;
        }
      }
    } catch (error: any) {
      setIsScanning(false);
      hasStoppedRef.current = true;
      Alert.alert('Lỗi', error.message || 'Không thể bắt đầu quét');
    }
  };

  const handleStopScan = async () => {
    if (!selectedBleDevice && !device) return;

    try {
      const targetDevice = (selectedBleDevice || device) as Device;
      hasStoppedRef.current = true;
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
        scanTimeoutRef.current = null;
      }
      await deviceCommandManager.stopInventory(targetDevice);
      setIsScanning(false);
    } catch (error: any) {}
  };

  const handleSubmit = async () => {
    if (!selectedAsset) {
      Alert.alert('Lỗi', 'Vui lòng chọn tài sản');
      return;
    }

    if (!scannedRfid.trim()) {
      Alert.alert('Lỗi', 'Vui lòng quét mã RFID');
      return;
    }

    Alert.alert(
      'Xác nhận',
      `Bạn có chắc muốn định danh tài sản "${selectedAsset.name}" với mã RFID "${scannedRfid}"?`,
      [
        {
          text: 'Hủy',
          style: 'cancel',
        },
        {
          text: 'Xác nhận',
          onPress: async () => {
            try {
              setIsSubmitting(true);

              await axiosInstance.patch(`api/v1/assets/${selectedAsset.id}`, {
                rfid: scannedRfid.trim(),
              });

              Alert.alert('Thành công', 'Đã định danh tài sản thành công!', [
                {
                  text: 'OK',
                  onPress: () => {
                    setSelectedAsset(null);
                    setScannedRfid('');
                    handleRefresh();
                  },
                },
              ]);
            } catch (error: any) {
              Alert.alert(
                'Lỗi',
                error.response?.data?.message || 'Không thể định danh tài sản'
              );
            } finally {
              setIsSubmitting(false);
            }
          },
        },
      ]
    );
  };

  const renderAssetItem = ({ item }: { item: UnidentifiedAsset }) => (
    <TouchableOpacity
      style={[
        styles.assetCard,
        selectedAsset?.id === item.id && styles.assetCardSelected,
      ]}
      onPress={() => handleSelectAsset(item)}
      activeOpacity={0.7}
    >
      <View style={styles.assetCardContent}>
        <View style={styles.assetHeader}>
          <View style={styles.assetIconContainer}>
            <Ionicons
              name="cube-outline"
              size={24}
              color={selectedAsset?.id === item.id ? '#4f46e5' : '#6b7280'}
            />
          </View>
          <View style={styles.assetInfo}>
            <Text style={styles.assetName}>{item.name}</Text>
            <View style={styles.assetCodeRow}>
              <Text style={styles.assetCode}>{item.ktCode}</Text>
              <Text style={styles.assetCodeSeparator}>•</Text>
              <Text style={styles.assetCode}>{item.fixedCode}</Text>
            </View>
          </View>
          {selectedAsset?.id === item.id && (
            <View style={styles.checkIconContainer}>
              <Ionicons name="checkmark-circle" size={28} color="#4f46e5" />
            </View>
          )}
        </View>
        {item.category && (
          <View style={styles.assetCategoryRow}>
            <Ionicons name="pricetag-outline" size={14} color="#9ca3af" />
            <Text style={styles.assetCategory}>{item.category.name}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerIconContainer}>
            <Ionicons name="qr-code" size={28} color="#4f46e5" />
          </View>
          <View>
            <Text style={styles.headerTitle}>Định danh tài sản</Text>
            <Text style={styles.headerSubtitle}>Quét RFID và gán cho tài sản</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.stepCard}>
          <View style={styles.stepHeader}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>1</Text>
            </View>
            <Text style={styles.stepTitle}>Chọn tài sản</Text>
          </View>

          <View style={styles.searchWrapper}>
            <View style={styles.searchContainer}>
              <Ionicons name="search-outline" size={20} color="#9ca3af" style={styles.searchIcon} />
              <TextInput
                placeholder="Tìm kiếm tài sản..."
                placeholderTextColor="#9ca3af"
                style={styles.searchInput}
                value={searchTerm}
                onChangeText={setSearchTerm}
                onSubmitEditing={handleSearch}
                returnKeyType="search"
              />
              {searchTerm.length > 0 && (
                <TouchableOpacity onPress={() => setSearchTerm('')} style={styles.clearButton}>
                  <Ionicons name="close-circle" size={20} color="#9ca3af" />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
              <Text style={styles.searchButtonText}>Tìm</Text>
            </TouchableOpacity>
          </View>

          {isLoadingAssets ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color="#4f46e5" />
              <Text style={styles.loadingText}>Đang tải...</Text>
            </View>
          ) : assets.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="folder-open-outline" size={64} color="#d1d5db" />
              <Text style={styles.emptyTitle}>Không có tài sản nào</Text>
              <Text style={styles.emptySubtitle}>
                Tất cả tài sản đã được định danh hoặc không tìm thấy kết quả
              </Text>
            </View>
          ) : (
            <View>
              <FlatList
                style={{ maxHeight: 400 }}
                data={assets}
                renderItem={renderAssetItem}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                refreshControl={
                  <RefreshControl
                    refreshing={isRefreshing}
                    onRefresh={handleRefresh}
                    colors={['#4f46e5']}
                    tintColor="#4f46e5"
                  />
                }
              />

              {totalPages > 1 && (
                <View style={styles.pagination}>
                  <TouchableOpacity
                    style={[
                      styles.paginationButton,
                      currentPage === 1 && styles.paginationButtonDisabled,
                    ]}
                    onPress={() => {
                      if (currentPage > 1) {
                        loadUnidentifiedAssets(currentPage - 1, searchTerm);
                      }
                    }}
                    disabled={currentPage === 1}
                  >
                    <Ionicons
                      name="chevron-back"
                      size={20}
                      color={currentPage === 1 ? '#d1d5db' : '#4f46e5'}
                    />
                  </TouchableOpacity>

                  <Text style={styles.paginationText}>
                    Trang {currentPage} / {totalPages}
                  </Text>

                  <TouchableOpacity
                    style={[
                      styles.paginationButton,
                      currentPage === totalPages && styles.paginationButtonDisabled,
                    ]}
                    onPress={() => {
                      if (currentPage < totalPages) {
                        loadUnidentifiedAssets(currentPage + 1, searchTerm);
                      }
                    }}
                    disabled={currentPage === totalPages}
                  >
                    <Ionicons
                      name="chevron-forward"
                      size={20}
                      color={currentPage === totalPages ? '#d1d5db' : '#4f46e5'}
                    />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </View>

        <View style={styles.stepCard}>
          <View style={styles.stepHeader}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>2</Text>
            </View>
            <Text style={styles.stepTitle}>Chọn thiết bị</Text>
          </View>

          {devices.length === 0 ? (
            <View style={styles.warningBox}>
              <Ionicons name="warning-outline" size={24} color="#f59e0b" />
              <View style={styles.warningContent}>
                <Text style={styles.warningTitle}>Chưa có thiết bị</Text>
                <Text style={styles.warningText}>
                  Vui lòng quét và kết nối thiết bị RFID trong phần Cài đặt
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.pickerWrapper}>
              <Picker
                selectedValue={selectedBleDevice?.id || selectedDevice?.id || ''}
                onValueChange={(value) => handleSelectDevice(value)}
                style={styles.picker}
              >
                <Picker.Item label="-- Chọn thiết bị --" value="" />
                {devices.map((dev) => (
                  <Picker.Item key={dev.id} label={dev.name || dev.id} value={dev.id} />
                ))}
              </Picker>
            </View>
          )}

          {selectedBleDevice && (
            <View style={styles.deviceInfo}>
              <Ionicons name="bluetooth" size={16} color="#4f46e5" />
              <Text style={styles.deviceInfoText}>
                {selectedBleDevice.name || selectedBleDevice.id}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.stepCard}>
          <View style={styles.stepHeader}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>3</Text>
            </View>
            <Text style={styles.stepTitle}>Quét mã RFID</Text>
          </View>

          <View style={styles.rfidSection}>
            <View
              style={[
                styles.rfidInputWrapper,
                scannedRfid && { borderColor: '#16a34a' },
              ]}
            >
              <Ionicons name="radio-outline" size={20} color="#9ca3af" style={styles.rfidIcon} />
              <TextInput
                placeholder="Mã RFID sẽ hiện sau khi quét"
                placeholderTextColor="#9ca3af"
                style={[styles.rfidInput, scannedRfid && { fontWeight: '600' }]}
                value={scannedRfid}
                editable={false}
              />
              {scannedRfid && (
                <View style={styles.rfidSuccess}>
                  <Ionicons name="checkmark-circle" size={20} color="#16a34a" />
                </View>
              )}
            </View>

            {isScanning ? (
              <TouchableOpacity style={styles.scanButtonStop} onPress={handleStopScan}>
                <ActivityIndicator size="small" color="#fff" style={styles.scanButtonLoader} />
                <Text style={styles.scanButtonText}>Dừng quét</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[
                  styles.scanButton,
                  (!selectedAsset || !selectedBleDevice) && styles.scanButtonDisabled,
                ]}
                onPress={handleStartScan}
                disabled={!selectedAsset || !selectedBleDevice}
              >
                <Ionicons name="scan-outline" size={20} color="#fff" />
                <Text style={styles.scanButtonText}>Bắt đầu quét</Text>
              </TouchableOpacity>
            )}
          </View>

          {isScanning && (
            <View style={styles.scanningIndicator}>
              <ActivityIndicator size="small" color="#4f46e5" />
              <Text style={styles.scanningText}>
                Đang quét... Vui lòng đưa thẻ RFID gần thiết bị
              </Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[
            styles.submitButton,
            (!selectedAsset || !scannedRfid || isSubmitting) && styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={!selectedAsset || !scannedRfid || isSubmitting}
          activeOpacity={0.8}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-done-circle" size={24} color="#fff" />
              <Text style={styles.submitButtonText}>Định danh tài sản</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    backgroundColor: '#ffffff',
    paddingTop: 16,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#eef2ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  stepCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#eef2ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepNumberText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4f46e5',
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  searchWrapper: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
    paddingVertical: 12,
  },
  clearButton: {
    padding: 4,
  },
  searchButton: {
    backgroundColor: '#4f46e5',
    borderRadius: 12,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  centerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6b7280',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  assetCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  assetCardSelected: {
    borderColor: '#4f46e5',
    backgroundColor: '#eef2ff',
  },
  assetCardContent: {
    flex: 1,
  },
  assetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  assetIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
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
  assetCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  assetCode: {
    fontSize: 13,
    color: '#6b7280',
  },
  assetCodeSeparator: {
    fontSize: 13,
    color: '#d1d5db',
    marginHorizontal: 6,
  },
  checkIconContainer: {
    marginLeft: 8,
  },
  assetCategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  assetCategory: {
    fontSize: 12,
    color: '#9ca3af',
    marginLeft: 6,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    gap: 16,
  },
  paginationButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#4f46e5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  paginationButtonDisabled: {
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  paginationText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  selectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d1fae5',
    padding: 12,
    borderRadius: 10,
    marginTop: 12,
  },
  selectedBadgeText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#065f46',
    fontWeight: '500',
  },
  selectedBadgeAsset: {
    fontWeight: '700',
  },
  pickerWrapper: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  picker: {
    height: 50,
  },
  deviceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    padding: 12,
    backgroundColor: '#eef2ff',
    borderRadius: 10,
  },
  deviceInfoText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#4f46e5',
    fontWeight: '500',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fef3c7',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  warningContent: {
    flex: 1,
    marginLeft: 12,
  },
  warningTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#92400e',
    marginBottom: 4,
  },
  warningText: {
    fontSize: 13,
    color: '#78350f',
    lineHeight: 18,
  },
  rfidSection: {
    gap: 12,
  },
  rfidInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 12,
  },
  rfidIcon: {
    marginRight: 8,
  },
  rfidInput: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
    paddingVertical: 14,
    fontWeight: '400',
  },
  rfidSuccess: {
    marginLeft: 8,
  },
  scanButton: {
    backgroundColor: '#4f46e5',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  scanButtonDisabled: {
    backgroundColor: '#d1d5db',
  },
  scanButtonStop: {
    backgroundColor: '#ef4444',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  scanButtonLoader: {
    marginRight: 0,
  },
  scanButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  scanningIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dbeafe',
    padding: 12,
    borderRadius: 10,
    marginTop: 8,
  },
  scanningText: {
    marginLeft: 8,
    fontSize: 13,
    color: '#1e40af',
    flex: 1,
  },
  submitButton: {
    backgroundColor: '#16a34a',
    borderRadius: 12,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 8,
    shadowColor: '#16a34a',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  submitButtonDisabled: {
    backgroundColor: '#d1d5db',
    shadowOpacity: 0,
    elevation: 0,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },
});
