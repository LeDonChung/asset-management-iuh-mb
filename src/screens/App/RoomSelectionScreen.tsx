import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Modal,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../types/navigation';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import {
  getUnitRooms,
  getRoomsInventoryStatus,
} from '../../redux/slices/InventorySlice';
import { Room, Unit, InventorySession } from '../../types';

type RoomSelectionScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'RoomSelectionScreen'
>;
type RoomSelectionScreenRouteProp = RouteProp<
  RootStackParamList,
  'RoomSelectionScreen'
>;

export const RoomSelectionScreen = () => {
  const navigation = useNavigation<RoomSelectionScreenNavigationProp>();
  const route = useRoute<RoomSelectionScreenRouteProp>();
  const selectedUnit = route.params.selectedUnit as Unit;
  const selectedPeriod = route.params.selectedPeriod as InventorySession;
  const assignmentId = route.params.assignmentId as string;

  const dispatch = useAppDispatch();
  const { unitRooms, roomsInventoryStatus, loading } = useAppSelector(
    state => state.inventory,
  );
  const [floorFilter, setFloorFilter] = useState<string>('all');
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [showFloorModal, setShowFloorModal] = useState(false);

  // Fetch rooms when selectedUnit changes
  useEffect(() => {
    if (selectedUnit?.id) {
      dispatch(getUnitRooms(selectedUnit.id));
    }
  }, [dispatch, selectedUnit?.id]);

  // Fetch room inventory status when assignmentId is available
  useEffect(() => {
    if (assignmentId) {
      console.log(
        'Fetching rooms inventory status for assignmentId:',
        assignmentId,
      );
      dispatch(getRoomsInventoryStatus(assignmentId));
    } else {
      console.log(
        'No assignmentId provided, skipping rooms inventory status fetch',
      );
    }
  }, [dispatch, assignmentId]);

  const rooms = Array.isArray(unitRooms) ? unitRooms : [];

  // Get unique floors for filter
  const uniqueFloors = Array.from(new Set(rooms.map(room => room.floor))).sort(
    (a, b) => parseInt(a) - parseInt(b),
  );

  // Handle room click
  const handleRoomClick = async (room: Room) => {
    const roomStatus = roomsInventoryStatus.find(
      status => status.roomId === room.id,
    );
    const isInventoried = roomStatus?.status || false;

    // Always allow navigation, but pass isInventoried flag
    if (assignmentId) {
      setSelectedRoom(room);
      navigation.navigate('InventoryScreen', {
        roomId: room.id,
        unitId: selectedUnit.id,
        assignmentId: assignmentId,
        sessionId: selectedPeriod.id,
        room: room,
        unit: selectedUnit,
        session: selectedPeriod,
        isInventoried: isInventoried,
      });
    }
  };

  // Filter rooms based on floor
  const filteredRooms =
    floorFilter === 'all'
      ? rooms
      : rooms.filter(room => room.floor === floorFilter);

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <Icon name="location-on" size={32} color="#9ca3af" />
      </View>
      <Text style={styles.emptyTitle}>Không có phòng nào</Text>
      <Text style={styles.emptyDescription}>
        Đơn vị này chưa có phòng được thiết lập
      </Text>
    </View>
  );

  const renderNoRoomsOnFloor = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <Icon name="location-on" size={32} color="#9ca3af" />
      </View>
      <Text style={styles.emptyTitle}>Không có phòng ở tầng này</Text>
      <Text style={styles.emptyDescription}>Thử chọn tầng khác</Text>
    </View>
  );

  const renderLoadingState = () => (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#2563eb" />
      <Text style={styles.loadingText}>Đang tải danh sách phòng...</Text>
    </View>
  );

  const renderRoomCard = (room: Room) => {
    const roomStatus = roomsInventoryStatus.find(
      status => status.roomId === room.id,
    );
    const isInventoried = roomStatus?.status || false;
    const isSelected = selectedRoom?.id === room.id;

    return (
      <TouchableOpacity
        key={room.id}
        style={[
          styles.roomCard,
          isInventoried && styles.inventoriedCard,
          isSelected && styles.selectedCard,
        ]}
        onPress={() => handleRoomClick(room)}
        activeOpacity={0.7}
      >
        <View style={styles.roomIconContainer}>
          <View
            style={[
              styles.roomIcon,
              isInventoried ? styles.inventoriedIcon : styles.normalIcon,
            ]}
          >
            {isInventoried ? (
              <Icon name="check-circle" size={16} color="#16a34a" />
            ) : (
              <Icon name="location-on" size={16} color="#6b7280" />
            )}
          </View>
        </View>
        <Text style={styles.roomName}>{room.name || room.roomCode}</Text>
        <Text style={styles.roomFloor}>Tầng {room.floor}</Text>
        {room.building && (
          <Text style={styles.roomBuilding}>Tòa {room.building}</Text>
        )}
        {isInventoried && (
          <Text style={styles.inventoriedStatus}>Đã kiểm kê</Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Icon name="arrow-back" size={16} color="#374151" />
          <Text style={styles.backButtonText}>Quay lại</Text>
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Chọn phòng kiểm kê</Text>
          <Text style={styles.headerSubtitle}>{selectedUnit?.name}</Text>
        </View>
        {loading && (
          <ActivityIndicator
            size="small"
            color="#2563eb"
            style={styles.headerLoader}
          />
        )}
      </View>

      {/* Floor Filter */}
      <View style={styles.filterContainer}>
        <Text style={styles.filterLabel}>Lọc theo tầng:</Text>
        <TouchableOpacity
          style={styles.pickerContainer}
          onPress={() => setShowFloorModal(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.pickerText}>
            {floorFilter === 'all' ? 'Tất cả tầng' : `Tầng ${floorFilter}`}
          </Text>
          <Icon name="keyboard-arrow-down" size={20} color="#6b7280" />
        </TouchableOpacity>
        <Text style={styles.roomCount}>({filteredRooms.length} phòng)</Text>
      </View>

      {/* Floor Selection Modal */}
      <Modal
        visible={showFloorModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowFloorModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chọn tầng</Text>
              <TouchableOpacity
                onPress={() => setShowFloorModal(false)}
                style={styles.modalCloseButton}
              >
                <Icon name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalList}>
              <TouchableOpacity
                style={[
                  styles.modalItem,
                  floorFilter === 'all' && styles.modalItemSelected,
                ]}
                onPress={() => {
                  setFloorFilter('all');
                  setShowFloorModal(false);
                }}
              >
                <Text
                  style={[
                    styles.modalItemText,
                    floorFilter === 'all' && styles.modalItemTextSelected,
                  ]}
                >
                  Tất cả tầng
                </Text>
                {floorFilter === 'all' && (
                  <Icon name="check" size={20} color="#2563eb" />
                )}
              </TouchableOpacity>
              {uniqueFloors.map(floor => (
                <TouchableOpacity
                  key={floor}
                  style={[
                    styles.modalItem,
                    floorFilter === floor && styles.modalItemSelected,
                  ]}
                  onPress={() => {
                    setFloorFilter(floor);
                    setShowFloorModal(false);
                  }}
                >
                  <Text
                    style={[
                      styles.modalItemText,
                      floorFilter === floor && styles.modalItemTextSelected,
                    ]}
                  >
                    Tầng {floor}
                  </Text>
                  {floorFilter === floor && (
                    <Icon name="check" size={20} color="#2563eb" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          renderLoadingState()
        ) : rooms.length === 0 ? (
          renderEmptyState()
        ) : filteredRooms.length === 0 ? (
          renderNoRoomsOnFloor()
        ) : (
          <View style={styles.roomsGrid}>
            {filteredRooms.map(renderRoomCard)}
          </View>
        )}
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
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 12,
  },
  backButtonText: {
    marginLeft: 4,
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  headerLoader: {
    marginLeft: 8,
  },
  filterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginRight: 12,
  },
  pickerContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  pickerText: {
    fontSize: 16,
    color: '#374151',
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalList: {
    maxHeight: 300,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  modalItemSelected: {
    backgroundColor: '#eff6ff',
  },
  modalItemText: {
    fontSize: 16,
    color: '#374151',
    flex: 1,
  },
  modalItemTextSelected: {
    color: '#2563eb',
    fontWeight: '500',
  },
  roomCount: {
    fontSize: 14,
    color: '#6b7280',
    marginLeft: 12,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyIconContainer: {
    backgroundColor: '#f3f4f6',
    borderRadius: 32,
    width: 64,
    height: 64,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  roomsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  roomCard: {
    width: '48%',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  inventoriedCard: {
    borderColor: '#16a34a',
    backgroundColor: '#f0fdf4',
  },
  selectedCard: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
    borderWidth: 2,
  },
  roomIconContainer: {
    marginBottom: 8,
  },
  roomIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  normalIcon: {
    backgroundColor: '#f3f4f6',
  },
  inventoriedIcon: {
    backgroundColor: '#dcfce7',
  },
  roomName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 4,
  },
  roomFloor: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
  },
  roomBuilding: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 2,
  },
  inventoriedStatus: {
    fontSize: 10,
    color: '#16a34a',
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 4,
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
});
