import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../types/navigation';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import { getAssignedMembersInSession, getUnitRooms } from '../../redux/slices/InventorySlice';
import { InventorySession, Unit, InventoryGroupAssignment } from '../../types';

type UnitSelectionScreenNavigationProp = StackNavigationProp<RootStackParamList, 'UnitSelectionScreen'>;
type UnitSelectionScreenRouteProp = RouteProp<RootStackParamList, 'UnitSelectionScreen'>;

export const UnitSelectionScreen = () => {
  const navigation = useNavigation<UnitSelectionScreenNavigationProp>();
  const route = useRoute<UnitSelectionScreenRouteProp>();
  const selectedPeriod = route.params.selectedPeriod;
  const dispatch = useAppDispatch();
  const { assignedGroups, loading } = useAppSelector(state => state.inventory);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);

  // Fetch assigned groups on component mount
  useEffect(() => {
    if (selectedPeriod?.id && selectedPeriod?.inventorySessionUnits?.[0]?.subInventory?.groups?.[0]?.id) {
      dispatch(getAssignedMembersInSession({ 
        sessionId: selectedPeriod.id, 
        groupId: selectedPeriod.inventorySessionUnits[0].subInventory.groups[0].id 
      }));
    }
  }, [dispatch, selectedPeriod]);

  // Utility function to format date
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  // Utility function to get assignment status
  const getAssignmentStatus = (startDate: string, endDate: string) => {
    const now = new Date();
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (now < start) {
      return { 
        status: 'upcoming', 
        label: 'Sắp tới', 
        color: { backgroundColor: '#fef3c7', color: '#d97706' } // yellow
      };
    } else if (now >= start && now <= end) {
      return { 
        status: 'active', 
        label: 'Đang diễn ra', 
        color: { backgroundColor: '#dcfce7', color: '#166534' } // green
      };
    } else {
      return { 
        status: 'completed', 
        label: 'Đã hoàn thành', 
        color: { backgroundColor: '#f3f4f6', color: '#374151' } // gray
      };
    }
  };

  // Handle unit selection with room pre-loading
  const handleUnitSelect = (unit: Unit) => {
    setSelectedUnit(unit);
    // Pre-load rooms for the selected unit
    dispatch(getUnitRooms(unit.id));
    
    // Find assignmentId for the selected unit
    const assignment = assignedGroups.find(group => group.unitId === unit.id);
    const assignmentId = assignment?.id;
    
    // Navigate to RoomSelectionScreen
    navigation.navigate('RoomSelectionScreen', { 
      selectedUnit: unit,
      selectedPeriod: selectedPeriod,
      assignmentId: assignmentId
    });
  };

  // Handle back button
  const handleBackToPeriod = () => {
    navigation.goBack();
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <Icon name="business" size={32} color="#9ca3af" />
      </View>
      <Text style={styles.emptyTitle}>
        Không có đơn vị nào được phân công
      </Text>
      <Text style={styles.emptyDescription}>
        Không có đơn vị nào được phân công cho bạn trong kỳ kiểm kê này.
      </Text>
    </View>
  );

  const renderLoadingState = () => (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#2563eb" />
      <Text style={styles.loadingText}>Đang tải danh sách đơn vị...</Text>
    </View>
  );

  const renderUnitCard = (assignment: InventoryGroupAssignment) => {
    const assignmentStatus = getAssignmentStatus(assignment.startDate, assignment.endDate);
    const isSelected = selectedUnit?.id === assignment.unit?.id;

    return (
      <TouchableOpacity
        key={assignment.id}
        style={[
          styles.unitCard,
          isSelected && styles.selectedCard,
        ]}
        onPress={() => assignment.unit && handleUnitSelect(assignment.unit)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>
              {assignment.unit?.name ?? 'Không có tên đơn vị'}
            </Text>
            <View style={styles.cardInfo}>
              <View style={styles.infoRow}>
                <View style={styles.iconContainer}>
                  <Icon name="event" size={12} color="#6b7280" />
                </View>
                <Text style={styles.infoText}>
                  {formatDate(assignment.startDate)} - {formatDate(assignment.endDate)}
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.cardActions}>
            <View style={[styles.statusBadge, assignmentStatus.color]}>
              <Text style={[styles.statusText, { color: assignmentStatus.color.color }]}>
                {assignmentStatus.label}
              </Text>
            </View>
            <View style={styles.chevronContainer}>
              <Icon name="chevron-right" size={16} color="#9ca3af" />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBackToPeriod}
          activeOpacity={0.7}
        >
          <Icon name="arrow-back" size={16} color="#374151" />
          <Text style={styles.backButtonText}>Quay lại</Text>
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Chọn đơn vị kiểm kê</Text>
          <Text style={styles.headerSubtitle}>{selectedPeriod?.name}</Text>
        </View>
        {loading && (
          <ActivityIndicator size="small" color="#2563eb" style={styles.headerLoader} />
        )}
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          renderLoadingState()
        ) : assignedGroups.length === 0 ? (
          renderEmptyState()
        ) : (
          <View style={styles.unitsGrid}>
            {assignedGroups.map(renderUnitCard)}
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
  unitsGrid: {
    gap: 12,
  },
  unitCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  selectedCard: {
    borderColor: '#93c5fd',
    backgroundColor: '#eff6ff',
    borderWidth: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardContent: {
    flex: 1,
    marginRight: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  cardInfo: {
    gap: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconContainer: {
    backgroundColor: '#f3f4f6',
    borderRadius: 4,
    padding: 2,
  },
  infoText: {
    fontSize: 12,
    color: '#6b7280',
  },
  cardActions: {
    alignItems: 'flex-end',
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  chevronContainer: {
    backgroundColor: '#f3f4f6',
    borderRadius: 6,
    padding: 4,
  },
});
