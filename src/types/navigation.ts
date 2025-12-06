import { InventorySession, Room, Unit } from './index';

export type RootStackParamList = {
  HomeScreen: undefined;
  UnitSelectionScreen: {
    selectedPeriod: InventorySession;
  };
  RoomSelectionScreen: {
    selectedUnit: Unit;
    selectedPeriod: InventorySession;
    assignmentId?: string;
  };
  InventoryScreen: {
    roomId: string;
    unitId: string;
    assignmentId: string;
    sessionId: string;
    room: Room;
    unit: Unit;
    session: InventorySession;
    isInventoried?: boolean;
  };
};

export type HomeTabParamList = {
  home: undefined;
  identify: undefined;
  setting: undefined;
  profile: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
