import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Alert,
  TextInput,
  ScrollView,
  Image,
  ActivityIndicator,
  Dimensions,
  Platform,
} from 'react-native';
import { useAppDispatch, useAppSelector } from '../redux/hooks';
import { uploadInventoryImage, clearInventoryImages } from '../redux/slices/FileSlice';
import { AssetActionStatus } from '../redux/slices/InventorySlice';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { launchImageLibrary, launchCamera, ImagePickerResponse, MediaType } from 'react-native-image-picker';
import { request, PERMISSIONS, RESULTS, openSettings } from 'react-native-permissions';

const { width } = Dimensions.get('window');

interface ActionModalProps {
  visible: boolean;
  onClose: () => void;
  asset: any;
  actionType: 'LIQUIDATION' | 'REPAIR' | 'VIEW_RESULT' | null;
  submittedResult?: any;
  onConfirm: (data: ActionModalData) => void;
}

export interface ActionModalData {
  reason: string;
  images: string[];
  status: string;
}

export const ActionModal: React.FC<ActionModalProps> = ({
  visible,
  onClose,
  asset,
  actionType,
  submittedResult,
  onConfirm,
}) => {
  const dispatch = useAppDispatch();
  const { inventoryImages, loading: uploadLoading } = useAppSelector((state) => state.file);
  const [reason, setReason] = useState('');
  const [localImages, setLocalImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  // Don't render if not visible
  if (!visible) {
    return null;
  }

  // Show loading if asset or actionType is not ready
  if (!asset || !actionType) {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent={true}>
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#374151" />
            </TouchableOpacity>
            <Text style={styles.title}>Đang tải...</Text>
            <View style={styles.placeholder} />
          </View>
          <View style={styles.content}>
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text style={{ textAlign: 'center', marginTop: 16 }}>Đang tải dữ liệu...</Text>
            <Text style={{ textAlign: 'center', marginTop: 8, fontSize: 12, color: '#666' }}>
              Asset: {JSON.stringify(asset)} | ActionType: {actionType}
            </Text>
          </View>
        </View>
      </Modal>
    );
  }

  // Check if permissions are already granted
  const checkPermissions = async () => {
    try {
      const permissions = Platform.select({
        ios: [PERMISSIONS.IOS.CAMERA, PERMISSIONS.IOS.PHOTO_LIBRARY],
        android: [
          PERMISSIONS.ANDROID.CAMERA,
          // Use appropriate storage permission based on Android version
          Platform.Version >= 33 
            ? PERMISSIONS.ANDROID.READ_MEDIA_IMAGES 
            : PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE
        ],
      });

      if (!permissions) {
        console.log('No permissions defined for this platform');
        return false;
      }

      const { check } = await import('react-native-permissions');
      const results = await Promise.all(
        permissions.map((permission) => check(permission))
      );

      const allGranted = results.every((result) => result === RESULTS.GRANTED);
      console.log('Permission check results:', results, 'All granted:', allGranted);
      console.log('Android version:', Platform.Version);
      return allGranted;
    } catch (error) {
      console.error('Error checking permissions:', error);
      return false;
    }
  };

  // Request permissions for camera and photo library
  const requestPermissions = async () => {
    try {
      const permissions = Platform.select({
        ios: [PERMISSIONS.IOS.CAMERA, PERMISSIONS.IOS.PHOTO_LIBRARY],
        android: [
          PERMISSIONS.ANDROID.CAMERA,
          // Use appropriate storage permission based on Android version
          Platform.Version >= 33 
            ? PERMISSIONS.ANDROID.READ_MEDIA_IMAGES 
            : PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE
        ],
      });

      if (!permissions) {
        console.log('No permissions defined for this platform');
        return false;
      }

      console.log('Requesting permissions:', permissions);
      console.log('Android version:', Platform.Version);

      const results = await Promise.all(
        permissions.map((permission) => request(permission))
      );

      console.log('Permission results:', results);
      console.log('Permission details:', permissions.map((permission, index) => ({
        permission,
        result: results[index],
        status: results[index] === RESULTS.GRANTED ? 'GRANTED' : 
                results[index] === RESULTS.DENIED ? 'DENIED' :
                results[index] === RESULTS.BLOCKED ? 'BLOCKED' :
                results[index] === RESULTS.UNAVAILABLE ? 'UNAVAILABLE' : 'UNKNOWN'
      })));

      const allGranted = results.every((result) => result === RESULTS.GRANTED);
      
      if (!allGranted) {
        const deniedPermissions = results.filter(result => result !== RESULTS.GRANTED);
        console.log('Some permissions denied:', deniedPermissions);
        
        Alert.alert(
          'Quyền truy cập cần thiết',
          'Ứng dụng cần quyền truy cập camera và thư viện ảnh để chọn hình ảnh. Vui lòng cấp quyền trong cài đặt thiết bị.',
          [
            { text: 'Hủy', style: 'cancel' },
            { 
              text: 'Mở cài đặt', 
              onPress: () => {
                console.log('Opening settings...');
                openSettings().catch((error) => {
                  console.error('Error opening settings:', error);
                  Alert.alert('Lỗi', 'Không thể mở cài đặt. Vui lòng mở thủ công.');
                });
              }
            }
          ]
        );
        return false;
      }
      
      console.log('All permissions granted');
      return true;
    } catch (error) {
      console.error('Permission request error:', error);
      Alert.alert('Lỗi', 'Không thể yêu cầu quyền: ' + (error as Error).message);
      return false;
    }
  };

  const handleImagePicker = () => {
    console.log('handleImagePicker called, uploading:', uploading);
    if (uploading) {
      Alert.alert('Thông báo', 'Đang tải lên hình ảnh, vui lòng đợi.');
      return;
    }
    Alert.alert(
      'Chọn hình ảnh',
      'Bạn muốn chọn hình ảnh từ đâu?',
      [
        { text: 'Hủy', style: 'cancel' },
        { text: 'Thư viện', onPress: () => openImageLibrary() },
        { text: 'Camera', onPress: () => openCamera() },
      ]
    );
  };

  const openImageLibrary = async () => {
    // Check permissions first
    const alreadyGranted = await checkPermissions();
    if (!alreadyGranted) {
      const hasPermission = await requestPermissions();
      if (!hasPermission) return;
    }

    const options = {
      mediaType: 'photo' as MediaType,
      quality: 0.8 as any,
      maxWidth: 1280,
      maxHeight: 1280,
      selectionLimit: Platform.OS === 'ios' ? 5 : 1, // Android may not support multi-selection
      includeBase64: false,
    };

    console.log('Opening image library with options:', options);

    try {
      launchImageLibrary(options, (response: ImagePickerResponse) => {
        console.log('Image library response:', response);
        if (response.didCancel) {
          console.log('User cancelled image selection');
          return;
        }
        if (response.errorCode || response.errorMessage) {
          console.error('Image picker error:', response.errorCode, response.errorMessage);
          Alert.alert('Lỗi', `Không thể mở thư viện ảnh: ${response.errorMessage || response.errorCode}`);
          return;
        }
        if (response.assets && response.assets.length > 0) {
          console.log('Selected assets:', response.assets);
          handleImageUpload(response.assets);
        } else {
          console.log('No assets selected');
          Alert.alert('Thông báo', 'Không có hình ảnh nào được chọn');
        }
      });
    } catch (error) {
      console.error('Unexpected error in openImageLibrary:', error);
      Alert.alert('Lỗi', 'Đã xảy ra lỗi: ' + (error as Error).message);
    }
  };

  const openCamera = async () => {
    // Check permissions first
    const alreadyGranted = await checkPermissions();
    if (!alreadyGranted) {
      const hasPermission = await requestPermissions();
      if (!hasPermission) return;
    }

    const options = {
      mediaType: 'photo' as MediaType,
      quality: 0.8 as any,
      maxWidth: 1280,
      maxHeight: 1280,
      includeBase64: false,
    };

    console.log('Opening camera with options:', options);

    try {
      launchCamera(options, (response: ImagePickerResponse) => {
        console.log('Camera response:', response);
        if (response.didCancel) {
          console.log('User cancelled camera');
          return;
        }
        if (response.errorCode || response.errorMessage) {
          console.error('Camera error:', response.errorCode, response.errorMessage);
          Alert.alert('Lỗi', `Không thể mở camera: ${response.errorMessage || response.errorCode}`);
          return;
        }
        if (response.assets && response.assets.length > 0) {
          console.log('Camera assets:', response.assets);
          handleImageUpload(response.assets);
        } else {
          console.log('No camera assets');
          Alert.alert('Thông báo', 'Không có hình ảnh nào được chọn');
        }
      });
    } catch (error) {
      console.error('Unexpected error in openCamera:', error);
      Alert.alert('Lỗi', 'Đã xảy ra lỗi: ' + (error as Error).message);
    }
  };

  const handleImageUpload = async (assets: any[]) => {
    if (assets.length === 0) {
      console.log('No assets to upload');
      Alert.alert('Thông báo', 'Không có hình ảnh nào để tải lên');
      return;
    }

    try {
      setUploading(true);

      // Validate assets
      const validAssets = assets.filter((asset) => {
        if (!asset.uri) {
          return false;
        }
        return true;
      });

      if (validAssets.length === 0) {
        Alert.alert('Lỗi', 'Không có hình ảnh hợp lệ để tải lên');
        return;
      }

      // Upload all files in parallel
      const uploadPromises = validAssets.map((asset, index) => {
        const file = {
          uri: asset.uri,
          type: asset.type || 'image/jpeg',
          name: asset.fileName || `image_${Date.now()}_${index}.jpg`,
        };
        return dispatch(uploadInventoryImage(file)).unwrap();
      });

      const results = await Promise.allSettled(uploadPromises);

      // Process results
      const successfulUploads: string[] = [];
      let successCount = 0;

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          successfulUploads.push(result.value.url);
          successCount++;
        } else {
        }
      });

      // Update local images
      if (successfulUploads.length > 0) {
        setLocalImages((prev) => [...prev, ...successfulUploads]);
        Alert.alert('Thành công', `Tải lên thành công ${successCount}/${validAssets.length} hình ảnh`);
      }

      if (successCount < validAssets.length) {
        Alert.alert('Cảnh báo', `Không thể tải lên ${validAssets.length - successCount} hình ảnh`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Lỗi', 'Không thể tải lên hình ảnh: ' + (error as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (index: number) => {
    setLocalImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleConfirm = async () => {
    if (!reason.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập lý do');
      return;
    }

    try {
      await onConfirm({
        reason,
        images: localImages,
        status:
          actionType === 'LIQUIDATION'
            ? AssetActionStatus.LIQUIDATION_PROPOSED
            : AssetActionStatus.NEEDS_REPAIR,
      });

      // Reset form
      setReason('');
      setLocalImages([]);
      dispatch(clearInventoryImages());
      onClose();
      Alert.alert(
        'Thành công',
        `${actionType === 'LIQUIDATION' ? 'Đề xuất thanh lý' : 'Đề xuất sửa chữa'} thành công`
      );
    } catch (error) {
      console.error('Error submitting action:', error);
      Alert.alert('Lỗi', 'Có lỗi xảy ra khi xử lý yêu cầu');
    }
  };

  const title =
    actionType === 'VIEW_RESULT'
      ? 'Kết quả kiểm kê'
      : actionType === 'LIQUIDATION'
      ? 'Đề xuất thanh lý'
      : 'Đề xuất sửa chữa';

  const description =
    actionType === 'VIEW_RESULT'
      ? 'Kết quả kiểm kê đã hoàn thành cho tài sản này.'
      : actionType === 'LIQUIDATION'
      ? 'Vui lòng cung cấp lý do và hình ảnh minh chứng cho việc đề xuất thanh lý tài sản này.'
      : 'Vui lòng cung cấp lý do và hình ảnh minh chứng cho việc đề xuất sửa chữa tài sản này.';


  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent={true}>
      <View style={styles.modalContainer}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#374151" />
            </TouchableOpacity>
            <Text style={styles.title}>{title}</Text>
            <View style={styles.placeholder} />
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Asset Info */}
            <View style={styles.assetInfo}>
              <Text style={styles.assetName}>{asset?.asset?.name || 'Tên tài sản'}</Text>
              <Text style={styles.assetCode}>Mã: {asset?.asset?.ktCode || 'N/A'}</Text>
            </View>

            {actionType === 'VIEW_RESULT' ? (
              /* View Submitted Result */
              <View style={styles.resultContainer}>
                <Text style={styles.sectionTitle}>Thông tin kiểm kê</Text>
                <View style={styles.resultGrid}>
                  <View style={styles.resultItem}>
                    <Text style={styles.resultLabel}>Số lượng hệ thống:</Text>
                    <Text style={styles.resultValue}>{submittedResult?.systemQuantity || 0}</Text>
                  </View>
                  <View style={styles.resultItem}>
                    <Text style={styles.resultLabel}>Số lượng thực tế:</Text>
                    <Text style={styles.resultValue}>{submittedResult?.countedQuantity || 0}</Text>
                  </View>
                  <View style={styles.resultItem}>
                    <Text style={styles.resultLabel}>Trạng thái:</Text>
                    <Text style={styles.resultValue}>
                      {submittedResult?.status === 'MATCHED'
                        ? 'Khớp'
                        : submittedResult?.status === 'MISSING'
                        ? 'Thiếu'
                        : submittedResult?.status === 'EXCESS'
                        ? 'Thừa'
                        : submittedResult?.status === 'BROKEN'
                        ? 'Hư hỏng'
                        : submittedResult?.status === 'NEEDS_REPAIR'
                        ? 'Cần sửa chữa'
                        : submittedResult?.status === 'LIQUIDATION_PROPOSED'
                        ? 'Đề xuất thanh lý'
                        : submittedResult?.status || 'Không xác định'}
                    </Text>
                  </View>
                  <View style={styles.resultItem}>
                    <Text style={styles.resultLabel}>Phương thức quét:</Text>
                    <Text style={styles.resultValue}>
                      {submittedResult?.scanMethod === 'RFID' ? 'RFID' : 'Thủ công'}
                    </Text>
                  </View>
                </View>

                {/* Note */}
                {submittedResult?.note && (
                  <View style={styles.noteContainer}>
                    <Text style={styles.sectionTitle}>Ghi chú</Text>
                    <Text style={styles.noteText}>{submittedResult.note}</Text>
                  </View>
                )}

                {/* Images */}
                {submittedResult?.imageUrls &&
                Array.isArray(submittedResult.imageUrls) &&
                submittedResult.imageUrls.length > 0 ? (
                  <View style={styles.imagesContainer}>
                    <Text style={styles.sectionTitle}>Hình ảnh minh chứng</Text>
                    <View style={styles.imageGrid}>
                      {submittedResult.imageUrls
                        .filter((url: string) => url && url.trim() !== '')
                        .map((url: string, index: number) => (
                          <View key={index} style={styles.imageItem}>
                            <Image source={{ uri: url }} style={styles.image} resizeMode="cover" />
                          </View>
                        ))}
                    </View>
                  </View>
                ) : (
                  <View style={styles.noImagesContainer}>
                    <Text style={styles.sectionTitle}>Hình ảnh minh chứng</Text>
                    <Text style={styles.noImagesText}>Không có hình ảnh minh chứng</Text>
                  </View>
                )}
              </View>
            ) : (
              /* Edit Mode */
              <View style={styles.editContainer}>
                {/* Reason */}
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>
                    Lý do {actionType === 'LIQUIDATION' ? 'thanh lý' : 'sửa chữa'} *
                  </Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder={`Nhập lý do ${
                      actionType === 'LIQUIDATION' ? 'thanh lý' : 'sửa chữa'
                    }...`}
                    value={reason}
                    onChangeText={setReason}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                </View>

                {/* Image Upload */}
                <View style={styles.uploadContainer}>
                  <Text style={styles.sectionTitle}>Hình ảnh minh chứng</Text>
                  <TouchableOpacity
                    style={[styles.uploadButton, uploading && styles.uploadButtonDisabled]}
                    onPress={() => {
                      console.log('Upload button pressed');
                      handleImagePicker();
                    }}
                    disabled={uploading}
                  >
                    <Ionicons name="camera" size={24} color="#3B82F6" />
                    <Text style={styles.uploadButtonText}>
                      {uploading ? 'Đang tải lên...' : 'Chọn hình ảnh'}
                    </Text>
                  </TouchableOpacity>

                  {/* Preview Images */}
                  {localImages.length > 0 && (
                    <View style={styles.imagePreviewContainer}>
                      <Text style={styles.previewTitle}>Hình ảnh đã chọn ({localImages.length})</Text>
                      <View style={styles.imageGrid}>
                        {localImages.map((url, index) => (
                          <View key={index} style={styles.imagePreviewItem}>
                            <Image
                              source={{ uri: url }}
                              style={styles.imagePreview}
                              resizeMode="cover"
                            />
                            <TouchableOpacity
                              style={styles.removeImageButton}
                              onPress={() => removeImage(index)}
                            >
                              <Ionicons name="close-circle" size={20} color="#EF4444" />
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                </View>
              </View>
            )}
          </ScrollView>

          {/* Footer */}
          {actionType !== 'VIEW_RESULT' && (
            <View style={styles.footer}>
              <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                <Text style={styles.cancelButtonText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.confirmButton,
                  actionType === 'LIQUIDATION' ? styles.liquidationButton : styles.repairButton,
                  (!reason.trim() || uploading) && styles.confirmButtonDisabled,
                ]}
                onPress={handleConfirm}
                disabled={!reason.trim() || uploading}
              >
                {uploading ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.confirmButtonText}>
                    {actionType === 'LIQUIDATION' ? 'Đề xuất thanh lý' : 'Đề xuất sửa chữa'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {actionType === 'VIEW_RESULT' && (
            <View style={styles.footer}>
              <TouchableOpacity style={styles.closeButtonFooter} onPress={onClose}>
                <Text style={styles.closeButtonText}>Đóng</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)', // Semi-transparent background
  },
  container: {
    width: width * 0.9,
    maxHeight: '80%',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  closeButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  placeholder: {
    width: 40,
  },
  content: {
    padding: 16,
  },
  assetInfo: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  assetName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  assetCode: {
    fontSize: 14,
    color: '#6B7280',
  },
  resultContainer: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  resultGrid: {
    gap: 12,
  },
  resultItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultLabel: {
    fontSize: 14,
    color: '#6B7280',
    flex: 1,
  },
  resultValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    flex: 1,
    textAlign: 'right',
  },
  noteContainer: {
    marginTop: 16,
  },
  noteText: {
    fontSize: 14,
    color: '#374151',
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 6,
  },
  imagesContainer: {
    marginTop: 16,
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  imageItem: {
    width: (width - 48) / 3,
    height: (width - 48) / 3,
    borderRadius: 8,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  noImagesContainer: {
    marginTop: 16,
  },
  noImagesText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    padding: 20,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  editContainer: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#111827',
    backgroundColor: 'white',
    minHeight: 80,
  },
  uploadContainer: {
    marginTop: 16,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    borderStyle: 'dashed',
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
  },
  uploadButtonDisabled: {
    opacity: 0.6,
  },
  uploadButtonText: {
    fontSize: 14,
    color: '#3B82F6',
    marginLeft: 8,
    fontWeight: '500',
  },
  imagePreviewContainer: {
    marginTop: 16,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  imagePreviewItem: {
    position: 'relative',
    width: (width - 48) / 3,
    height: (width - 48) / 3,
    borderRadius: 8,
    overflow: 'hidden',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  removeImageButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'white',
    borderRadius: 10,
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    opacity: 0.6,
  },
  liquidationButton: {
    backgroundColor: '#EF4444',
  },
  repairButton: {
    backgroundColor: '#F59E0B',
  },
  confirmButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: 'white',
  },
  closeButtonFooter: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: 'white',
  },
});