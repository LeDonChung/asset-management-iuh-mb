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
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../types/navigation';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import { getAssignedInventories } from '../../redux/slices/InventorySlice';
import { InventorySession, InventorySessionStatus } from '../../types';

type HomeScreenNavigationProp = StackNavigationProp<RootStackParamList, 'HomeScreen'>;

export const HomeScreen = () => {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const dispatch = useAppDispatch();
  const { assignedInventories, loading } = useAppSelector(state => state.inventory);
  const [selectedPeriod, setSelectedPeriod] = useState<InventorySession | null>(null);

  // Fetch assigned inventories on component mount
  useEffect(() => {
    dispatch(getAssignedInventories());
  }, [dispatch]);

  const getStatusColor = (status: InventorySessionStatus) => {
    switch (status) {
      case InventorySessionStatus.IN_PROGRESS:
        return { backgroundColor: '#dcfce7', color: '#166534' }; // green
      case InventorySessionStatus.COMPLETED:
        return { backgroundColor: '#f3f4f6', color: '#374151' }; // gray
      case InventorySessionStatus.PLANNED:
        return { backgroundColor: '#dbeafe', color: '#1e40af' }; // blue
      case InventorySessionStatus.CLOSED:
        return { backgroundColor: '#fee2e2', color: '#dc2626' }; // red
      default:
        return { backgroundColor: '#f3f4f6', color: '#374151' };
    }
  };

  const getStatusText = (status: InventorySessionStatus) => {
    switch (status) {
      case InventorySessionStatus.IN_PROGRESS:
        return 'Đang thực hiện';
      case InventorySessionStatus.COMPLETED:
        return 'Đã hoàn thành';
      case InventorySessionStatus.PLANNED:
        return 'Đã lập kế hoạch';
      case InventorySessionStatus.CLOSED:
        return 'Đã đóng';
      default:
        return 'Không xác định';
    }
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN');
  };

  // Check if session can be selected
  const canSelectSession = (session: InventorySession) => {
    return session.status === InventorySessionStatus.IN_PROGRESS || 
           session.status === InventorySessionStatus.PLANNED;
  };

  const handlePeriodSelect = (session: InventorySession) => {
    if (canSelectSession(session)) {
      setSelectedPeriod(session);
      // Navigate to UnitSelectionScreen
      navigation.navigate('UnitSelectionScreen', { selectedPeriod: session });
    }
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <Icon name="event" size={32} color="#9ca3af" />
      </View>
      <Text style={styles.emptyTitle}>
        Không có kỳ kiểm kê nào được phân công
      </Text>
      <Text style={styles.emptyDescription}>
        Hiện tại bạn chưa được phân công tham gia kỳ kiểm kê nào.
      </Text>
    </View>
  );

  const renderLoadingState = () => (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#2563eb" />
      <Text style={styles.loadingText}>Đang tải danh sách kỳ kiểm kê...</Text>
    </View>
  );

  const renderInventoryCard = (session: InventorySession) => {
    const statusStyle = getStatusColor(session.status);
    const isSelected = selectedPeriod?.id === session.id;
    const canSelect = canSelectSession(session);

    return (
      <TouchableOpacity
        key={session.id}
        style={[
          styles.inventoryCard,
          isSelected && styles.selectedCard,
          !canSelect && styles.disabledCard,
        ]}
        onPress={() => handlePeriodSelect(session)}
        disabled={!canSelect}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>{session.name}</Text>
            <View style={styles.cardInfo}>
              <View style={styles.infoRow}>
                <Icon name="event" size={12} color="#6b7280" />
                <Text style={styles.infoText}>
                  {formatDate(session.startDate)} - {formatDate(session.endDate)}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Icon name="access-time" size={12} color="#6b7280" />
                <Text style={styles.infoText}>Năm {session.year}</Text>
              </View>
            </View>
          </View>
          <View style={styles.cardActions}>
            <View style={[styles.statusBadge, statusStyle]}>
              <Text style={[styles.statusText, { color: statusStyle.color }]}>
                {getStatusText(session.status)}
              </Text>
            </View>
            {isSelected && (
              <View style={styles.selectedIndicator}>
                <Icon name="chevron-right" size={16} color="#2563eb" />
              </View>
            )}
          </View>
        </View>

        {session.status === InventorySessionStatus.COMPLETED && (
          <Text style={styles.completedText}>
            Kỳ kiểm kê này đã hoàn thành
          </Text>
        )}
        
        {session.status === InventorySessionStatus.PLANNED && (
          <Text style={styles.plannedText}>
            Kỳ kiểm kê đã được lập kế hoạch
          </Text>
        )}
        
        {session.status === InventorySessionStatus.CLOSED && (
          <Text style={styles.closedText}>
            Kỳ kiểm kê đã đóng
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Icon name="event" size={20} color="#2563eb" />
        </View>
        <Text style={styles.headerTitle}>Chọn kỳ kiểm kê</Text>
        {loading && (
          <ActivityIndicator size="small" color="#2563eb" style={styles.headerLoader} />
        )}
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          renderLoadingState()
        ) : assignedInventories.length === 0 ? (
          renderEmptyState()
        ) : (
          <View style={styles.inventoryGrid}>
            {assignedInventories.map(renderInventoryCard)}
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
  headerIcon: {
    backgroundColor: '#dbeafe',
    borderRadius: 8,
    padding: 8,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
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
  inventoryGrid: {
    gap: 12,
  },
  inventoryCard: {
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
  disabledCard: {
    opacity: 0.75,
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
  infoText: {
    fontSize: 12,
    color: '#6b7280',
  },
  cardActions: {
    alignItems: 'flex-end',
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  selectedIndicator: {
    backgroundColor: '#dbeafe',
    borderRadius: 6,
    padding: 4,
  },
  completedText: {
    fontSize: 12,
    color: '#6b7280',
    fontStyle: 'italic',
    marginTop: 8,
  },
  plannedText: {
    fontSize: 12,
    color: '#2563eb',
    marginTop: 8,
  },
  closedText: {
    fontSize: 12,
    color: '#dc2626',
    marginTop: 8,
  },
});
