// Asset Types and Interfaces

export enum AssetType {
    TSCD = "TSCD", // Tài sản cố định
    CCDC = "CCDC", // Công cụ dụng cụ
    FIXED_ASSET = 'FIXED_ASSET', // Tài sản cố định
    TOOLS_EQUIPMENT = 'TOOLS_EQUIPMENT', // Công cụ dụng cụ
  }
  
  export enum AssetStatus {
    CHO_CHUYEN_GIAO = "chờ_bàn_giao",
    CHO_TIEP_NHAN = "chờ_tiếp_nhận",
    CHO_PHAN_BO = "chờ_phân_bổ",
    DANG_SU_DUNG = "đang_sử_dụng", 
    HU_HONG = "hư_hỏng",
    DE_XUAT_THANH_LY = "đề_xuất_thanh_lý",
    DA_THANH_LY = "đã_thanh_lý"
  }
  
  // Asset Log Types
  export enum AssetLogStatus {
    PENDING = "PENDING",
    IN_PROGRESS = "IN_PROGRESS", 
    COMPLETED = "COMPLETED",
    CANCELLED = "CANCELLED"
  }
  
  export interface AssetLog {
    id: string;
    assetId: string;
    action: string;
    reason: string;
    status: AssetLogStatus;
    fromLocation?: string;
    toLocation?: string;
    createdAt: string;
    createdBy: string;
    asset?: Asset;
  }
  
  // Asset Transaction Types
  export enum TransactionType {
    ALLOCATE = "ALLOCATE", // Phân bổ
    HANDOVER = "HANDOVER", // Bàn giao
    RETURN = "RETURN", // Hoàn trả
    LIQUIDATE = "LIQUIDATE" // Thanh lý
  }
  
  export enum TransactionStatus {
    PENDING = "PENDING", // Chờ duyệt
    APPROVED = "APPROVED", // Đã duyệt
    REJECTED = "REJECTED", // Từ chối
  }
  
  export interface AssetTransactionItem {
    id: string;
    transactionId: string;
    assetId: string;
    note?: string;
    asset?: Asset;
  }
  
  export interface AssetTransaction {
    id: string;
    type: TransactionType;
    fromUnitId?: string;
    toUnitId?: string;
    fromRoomId?: string;
    toRoomId?: string;
    createdBy: string;
    createdAt: string;
    status: TransactionStatus;
    note?: string;
    approvedAt?: string;
    approvedBy?: string;
    rejectedAt?: string;
    rejectedBy?: string;
    rejectionReason?: string;
    fromUnit?: Unit;
    toUnit?: Unit;
    fromRoom?: Room;
    toRoom?: Room;
    items?: AssetTransactionItem[];
  }
  
  // User and Role Management
  export enum UserStatus {
    ACTIVE = "ACTIVE",
    INACTIVE = "INACTIVE",
  }
  
  export interface Role {
    id: string;
    name: string;
    code: string;
    permissions?: Permission[];
  }
  
  export interface ManagerPermission {
    id: string;
    name: string;
    permissions?: Permission[];
  }
  
  export interface Permission {
    id: string;
    name: string;
    code: string;
  }
  
  export interface User {
    id: string;
    username: string; // Tài khoản: Mã nhân viên
    password?: string; // Không hiển thị trong frontend
    fullName: string;
    email: string;
    unitId?: string; // Đơn vị
    phoneNumber?: string;
    birthDate?: string; // date
    status: UserStatus;
    createdAt: string;
    updatedAt: string;
    deletedAt?: string;
    roles?: Role[];
    unit?: Unit; // Relation to Unit
  }
  
  // Unit Management
  export enum UnitStatus {
    ACTIVE = "ACTIVE",
    INACTIVE = "INACTIVE"
  }
  
  export enum UnitType {
    CO_SO = "cơ_sở",
    PHONG_KE_HOACH_DAU_TU = "phòng_kế_hoạch_đầu_tư",
    PHONG_QUAN_TRI = "phòng_quản_trị", 
    DON_VI_SU_DUNG = "đơn_vị_sử_dụng"
  }
  
  export interface Unit {
    id: string;
    name: string; // Tên đơn vị sử dụng
    phone?: string; // Số điện thoại
    email?: string; // Email
    type: UnitType;
    representativeId: string; // Người đại diện
    status: UnitStatus;
    createdBy: string;
    createdAt: string; // date
    updatedAt: string; // date
    deletedAt?: string; // date
    representative?: User;
  }
  
  // Room Management
  export enum RoomStatus {
    ACTIVE = "ACTIVE", 
    INACTIVE = "INACTIVE"
  }
  
  export interface Room {
    id: string;
    name?: string;
    roomCode: string; // Mã phòng
    building?: string; // Tòa
    floor: string; // Tầng
    roomNumber?: string; // Số phòng / tên phòng
    adjacentRooms?: Room[]; // Danh sách ID các phòng cạnh bên
    status: RoomStatus;
    unitId: string; // Mã đơn vị sử dụng
    createdBy: string;
    createdAt: string;
    updatedAt: string;
    unit?: Unit;
  }
  
  export interface Asset {
    id: string;
    ktCode: string; // Mã kế toán: xx-yyyy/nn
    fixedCode: string; // Mã tài sản cố định xxxx.yyyy  
    name: string;
    specs?: string; // Thông số kỹ thuật
    entryDate: string; // Ngày nhập (date)
    currentRoomId?: string; // Vị trí hiện tại, null là đang nhập kho, chưa phân bổ
    currentRoom?: Room;
    unit: string; // Đơn vị tính
    quantity: number; // Số lượng (Với tài sản cố định = 1)
    origin?: string; // Xuất xứ
    purchasePackage: number; // Gói mua
    type: AssetType;
    isLocked: boolean; // Khi đã bàn giao thì không cho cập nhật lại
    isHandOver: boolean; // Đã bàn giao
    categoryId: string; // Danh mục - 4: máy tính, 3: thiết bị văn phòng, 5: máy in
    status: AssetStatus;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
    deletedAt?: string;
    
    // Thông tin bàn giao (cho sổ tài sản)
    assignedDate?: string; // Ngày bàn giao
    assignedTo?: string; // Người được bàn giao
    department?: string; // Phòng ban
    location?: string; // Vị trí cụ thể
    
    // Relations
    category?: Category;
    room?: Room;
    rfidTag?: RfidTag;
    logs?: AssetLog[];
    transactionItems?: AssetTransactionItem[];
  }
  
  export interface Category {
    id: string;
    name: string;
    code: string; // 4: máy tính, 3: thiết bị văn phòng, 5: máy in
    parentId?: string;
    parent?: Category;
    children?: Category[];
  }
  
  export interface RfidTag {
    rfidId: string; // E280F3362000F00005E66021 - primary key
    assetId: string; // Mã tài sản
    assignedDate: string; // Ngày định danh và đưa vào tài sản
    asset?: Asset;
  }
  
  
  
  // Asset Book Management
  export enum BookStatus {
    OPEN = "OPEN",
    CLOSE = "CLOSE"
  }
  
  export enum AssetBookStatus {
    OPEN = "OPEN",
    CLOSED = "CLOSED"
  }
  
  export interface AssetBook {
    id: string;
    unitId: string; // Đơn vị quản lý sổ
    year: number; // Năm
    lookedAt?: Date; // Ngày xem sổ
    status: AssetBookStatus;
    unit?: Unit;
    assetTypes?: AssetTypeResponse[];
  }
  
  export interface AssetTypeResponse {
    type: AssetType;
    items: AssetBookItem[];
  }
  
  export enum AssetBookItemStatus {
    IN_USE = "IN_USE", // Đang sử dụng
    TRANSFERRED = "TRANSFERRED", // Đã được di chuyển đi chỗ khác
    LIQUIDATED = "LIQUIDATED", // Đã được thanh lý
    MISSING = "MISSING" // Đã thất lạc
  }
  
  export interface AssetBookItem {
    id: string;
    roomId: string;
    assetId: string;
    assignedAt: Date; // datetime - Ngày được ghi nhận vào sổ
    quantity: number; // Số lượng thực tế trong sổ
    status: AssetBookItemStatus;
    note?: string;
    asset?: Asset;
    room?: Room;
  }
  
  
  
  
  
  // Alert Management
  export enum AlertStatus {
    PENDING = "PENDING",
    RESOLVED = "RESOLVED"
  }
  
  export enum AlertType {
    UNAUTHORIZED_MOVEMENT = "UNAUTHORIZED_MOVEMENT" // Di chuyển không hợp lệ
  }
  
  export interface Alert {
    id: string;
    assetId: string;
    detectedAt: string; // datetime - Thời gian phát hiện
    roomId: string;
    type: AlertType; // Di chuyển không hợp lệ
    status: AlertStatus;
    createdAt: string; // datetime
    asset?: Asset;
    room?: Room;
    resolution?: AlertResolution;
  }
  
  export enum AlertResolutionStatus {
    CONFIRMED = "CONFIRMED", // Đã xác minh
    FALSE_ALARM = "FALSE_ALARM", // Sai phạm
    SYSTEM_ERROR = "SYSTEM_ERROR" // Lỗi hệ thống
  }
  
  export interface AlertResolution {
    id: string;
    alertId: string;
    resolverId: string;
    resolution: AlertResolutionStatus;
    note?: string;
    resolvedAt: string; // datetime
    alert?: Alert;
    resolver?: User;
  }
  
  // Damage Report Management  
  export enum DamageReportStatus {
    REPORTED = "REPORTED",
    IN_REVIEW = "IN_REVIEW",
    APPROVED = "APPROVED",
    REJECTED = "REJECTED"
  }
  
  export interface DamageReport {
    id: string;
    assetId: string;
    reporter: string; // Tên người report
    roomId: string;
    description: string; // text - Mô tả
    mediaUrl?: string; // Ảnh / Video minh chứng
    status: DamageReportStatus;
    createdAt: string; // datetime
    updatedAt: string; // datetime
    asset?: Asset;
    room?: Room;
  }
  
  // Liquidation Management
  export enum LiquidationStatus {
    PROPOSED = "PROPOSED", // Đề xuất thanh lý
    APPROVED = "APPROVED", // Chấp nhận
    REJECTED = "REJECTED" // Từ chối
  }
  
  export interface LiquidationProposal {
    id: string;
    proposerId: string; // Người đề xuất
    unitId: string; // Đơn vị sử dụng
    typeAsset: AssetType; // Loại tài sản trong danh sách thanh lý
    reason: string; // text
    status: LiquidationStatus; // Trạng thái đề xuất
    createdAt: string; // datetime
    updatedAt: string; // datetime
    proposer?: User;
    unit?: Unit;
    items?: LiquidationProposalItem[];
  }
  
  export enum LiquidationProposalItemCondition {
    DAMAGED = "DAMAGED", // Hư hỏng
    UNUSABLE = "UNUSABLE" // Không thể sử dụng
  }
  
  export interface LiquidationProposalItem {
    id: string;
    proposalId: string;
    assetId: string;
    reason: string; // text
    condition: LiquidationProposalItemCondition; // Trạng thái tài sản hiện tại
    mediaUrl?: string;
    proposal?: LiquidationProposal;
    asset?: Asset;
  }
  
  export interface AssetFilter {
    search?: string;
    status?: AssetStatus;
    type?: AssetType;
    categoryId?: string;
    roomId?: string;
    unitId?: string;
    isLocked?: boolean;
    isHandOver?: boolean; // Thêm trường lọc theo trạng thái bàn giao
    hasRfid?: boolean;
    entryDateFrom?: string; // Thêm trường lọc theo ngày từ
    entryDateTo?: string;   // Thêm trường lọc theo ngày đến
  }
  
  export interface AssetFormData {
    name: string;
    specs?: string;
    entryDate: string;
    currentRoomId?: string; // ID phòng theo kế hoạch
    unit: string;
    quantity: number;
    origin?: string;
    purchasePackage: number;
    type: AssetType;
    categoryId: string;
  }
  
  // Additional interfaces for Asset Book Management with Role-based Access
  export interface AssetBookFilter {
    unitId?: string;
    year?: number;
    status?: BookStatus;
    search?: string;
  }
  
  export interface AssetBookItemFilter {
    bookId?: string;
    assetId?: string;
    roomId?: string;
    status?: AssetBookItemStatus;
    assignedDateFrom?: string;
    assignedDateTo?: string;
  }
  
  export interface UserPermissions {
    canViewAllUnits: boolean;
    canManageAssetBooks: boolean;
    canCreateAssetBooks: boolean;
    canLockAssetBooks: boolean;
    allowedUnits: string[]; // Array of unit IDs the user can access
  }
  
  // ============================================================
  // INVENTORY MANAGEMENT TYPES
  // ============================================================
  
  // Inventory Session Status
  export enum InventorySessionStatus {
    PLANNED = "PLANNED",
    IN_PROGRESS = "IN_PROGRESS", 
    COMPLETED = "COMPLETED",
    CLOSED = "CLOSED"
  }
  
  export interface FileUrl {
    id: string;
    url: string;
  }
  
  export interface InventorySessionMember {
    id: string;
    sessionId: string;
    userId: string;
    role: string;
    user?: User;
    session?: InventorySession;
  }
  
  // Inventory Session (Kỳ kiểm kê)
  export interface InventorySession {
    id: string;
    year: number; // Năm
    name: string; // Tên kỳ kiểm kê, ví dụ: Kiểm kê cuối năm
    period: number; // Đợt
    isGlobal: boolean; // true: Một kỳ cho toàn bộ các đơn vị sử dụng, false: Một kì cho một đơn vị sử dụng
    startDate: string; // date
    endDate: string; // date
    evidenceFiles?: FileUrl[]; // URLs của file minh chứng
    status: InventorySessionStatus;
    createdBy: string;
    createdAt: string; // datetime
    creator?: User;
    units?: InventorySessionUnit[]; // Đơn vị tham gia
    committees?: InventoryCommittee; // Ban kiểm kê
    inventorySessionUnits?: InventorySessionUnit[]; // Đơn vị tham gia
    members?: InventorySessionMember[]; // Thành viên ban kiểm kê
  }
  
  // Đơn vị tham gia kỳ kiểm kê
  export interface InventorySessionUnit {
    id: string;
    sessionId: string;
    subInventoryId?: string;
    subInventory?: InventorySubCommittee;
    unitId: string;
    unit?: Unit;
    session?: InventorySession;
  }
  
  // Ban kiểm kê chính
  export interface InventoryCommittee {
    id: string;
    sessionId: string;
    name: string; // Tên ban, ví dụ: Ban kiểm kê tài sản năm 2024
    createdAt: string; // datetime
    session?: InventorySession;
    members?: InventoryCommitteeMember[]; // Thành viên ban kiểm kê
    subCommittees?: InventorySubCommittee[]; // Tiểu ban
  }
  
  // Vai trò thành viên ban kiểm kê
  export enum InventoryCommitteeRole {
    // TIỂU BAN
    SUB_COMMITTEE_LEADER = "SUB_COMMITTEE_LEADER", // TRƯỞNG TIỂU BAN
    VICE_SUB_COMMITTEE_LEADER = "VICE_SUB_COMMITTEE_LEADER", // PHÓ TRƯỞNG TIỂU BAN
  
    // NHÓM
    LEADER = "LEADER", // TRƯỞNG NHÓM
    DEPUTY_LEADER = "DEPUTY_LEADER", // PHÓ TRƯỞNG NHÓM
  
    // BAN CHÍNH
    CHAIR = "CHAIR", // TRƯỞNG BAN
    VICE_CHAIR = "VICE_CHAIR", // PHÓ TRƯỞNG BAN
    CHIEF_SECRETARY = "CHIEF_SECRETARY", // THƯ KÝ TỔNG HỢP
    MEMBER = "MEMBER", // ỦY VIÊN
  
    // DÙNG CHUNG
    SECRETARY = "SECRETARY", // THƯ KÝ
  }
  
  // Thành viên ban kiểm kê
  export interface InventoryCommitteeMember {
    id: string;
    committeeId: string;
    userId?: string;
    role: InventoryCommitteeRole;
    responsibility?: string;
    committee?: InventoryCommittee;
    user?: User;
  }
  
  // Vai trò thành viên tiểu ban
  export enum InventorySubCommitteeRole {
    LEADER = "LEADER", // Trưởng tiểu ban
    SECRETARY = "SECRETARY", // Thư ký
    MEMBER = "MEMBER" // Thành viên
  }
  
  // Thành viên tiểu ban (Backend: SubInventoryMember)
  export interface InventorySubCommitteeMember {
    id: string;
    subInventoryId: string; // Backend uses subInventoryId instead of subCommitteeId
    userId: string;
    role: string; // Backend uses CommitteeRole enum as string
    notes?: string; // Ghi chú thêm
    createdAt: string;
    updatedAt: string;
    subCommittee?: InventorySubCommittee;
    user?: User;
  }
  
  // Tiểu ban (Backend: InventorySub)
  export interface InventorySubCommittee {
    id: string;
    name: string; // Tên tiểu ban
    inventorySessionUnitId: string; // ID của cơ sở tham gia
    status: string; // Trạng thái tiểu ban
    description?: string; // Mô tả tiểu ban
    createdAt: string; // datetime
    updatedAt: string; // datetime
    inventorySessionUnit?: InventorySessionUnit;
    members?: InventorySubCommitteeMember[]; // Thành viên tiểu ban
    groups?: InventoryGroup[]; // Nhóm trong tiểu ban
  }
  
  // Nhóm trong tiểu ban (Backend: InventoryGroup)
  export interface InventoryGroup {
    id: string;
    subInventoryId: string; // Backend uses subInventoryId instead of subCommitteeId
    name: string; // Tên nhóm
    description?: string; // Mô tả nhóm
    status: string; // Trạng thái nhóm
    createdAt: string; // datetime
    updatedAt: string; // datetime
    subInventory?: InventorySubCommittee; // Backend relation name
    members?: InventoryGroupMember[]; // Thành viên nhóm
    assignments?: InventoryGroupAssignment[]; // Phân công kiểm kê
  }
  
  // Vai trò thành viên nhóm
  export enum InventoryGroupRole {
    LEADER = "LEADER",
    SECRETARY = "SECRETARY",
    MEMBER = "MEMBER"
  }
  
  // Thành viên nhóm (Backend: InventoryGroupMember)
  export interface InventoryGroupMember {
    id: string;
    groupId: string;
    userId: string;
    role: string; // Backend uses CommitteeRole enum as string
    notes?: string; // Ghi chú thêm
    createdAt: string;
    updatedAt: string;
    group?: InventoryGroup;
    user?: User;
  }
  
  // Phân công nhóm kiểm kê cho đơn vị (Backend: InventoryGroupAssignment)
  export interface InventoryGroupAssignment {
    id: string;
    groupId: string;
    unitId: string;
    startDate: string; // date - Ngày bắt đầu kiểm kê tại đơn vị
    endDate: string; // date - Ngày kết thúc kiểm kê tại đơn vị
    note?: string;
    createdAt: string;
    group?: InventoryGroup;
    unit?: Unit;
    results?: InventoryResult[]; // Kết quả kiểm kê
  }
  
  // Phương thức quét
  export enum ScanMethod {
    RFID = "RFID", // Bằng RFID
    MANUAL = "MANUAL", // Bằng thủ công
  }
  
  // Trạng thái kết quả kiểm kê
  export enum InventoryResultStatus {
    MATCHED = "MATCHED", // Khớp
    MISSING = "MISSING", // Thiếu
    EXCESS = "EXCESS", // Thừa
    BROKEN = "BROKEN", // Hư hỏng
    NEEDS_REPAIR = "NEEDS_REPAIR", // Cần sửa chữa
    LIQUIDATION_PROPOSED = "LIQUIDATION_PROPOSED" // Đề xuất thanh lý
  }
  
  // Kết quả kiểm kê
  export interface InventoryResult {
    id: string;
    assignmentId: string; // Phân công kiểm kê
    assetId: string;
    roomId: string; // ID của phòng
    systemQuantity: number; // Số lượng trên hệ thống
    countedQuantity: number; // Số lượng thực tế kiểm kê
    scanMethod?: ScanMethod;
    status: InventoryResultStatus;
    imageUrls: string[];
    note?: string;
    createdAt: string; // datetime
    assignment?: InventoryGroupAssignment;
    asset?: Asset;
  }
  
  // Filter interfaces for inventory management
  export interface InventorySessionFilter {
    search?: string;
    year?: number;
    status?: InventorySessionStatus;
    isGlobal?: boolean;
    unitId?: string;
    startDateFrom?: string;
    startDateTo?: string;
  }
  
  export interface InventoryResultFilter {
    search?: string;
    assignmentId?: string;
    status?: InventoryResultStatus;
    scanMethod?: ScanMethod;
    assetId?: string;
    unitId?: string;
  }
  
  // Form data interfaces
  export interface InventorySessionFormData {
    year: number;
    name: string;
    period: number;
    isGlobal: boolean;
    startDate: string;
    endDate: string;
    status: InventorySessionStatus;
    fileUrls?: string[];
    unitIds?: string[];
  }
  
  export interface InventoryCommitteeFormData {
    sessionId: string;
    name: string;
    members: {
      userId: string;
      role: InventoryCommitteeRole;
    }[];
  }
  
  export interface InventorySubCommitteeFormData {
    committeeId: string;
    name: string;
    leaderId: string;
    secretaryId: string;
  }
  
  export interface InventoryGroupFormData {
    subCommitteeId: string;
    name: string;
    leaderId: string;
    secretaryId: string;
    members: {
      userId: string;
      role: InventoryGroupRole;
    }[];
  }
  
  export interface InventoryGroupAssignmentFormData {
    groupId: string;
    unitId: string;
    startDate: string;
    endDate: string;
    note?: string;
  }
  
  export interface InventoryResultFormData {
    assignmentId: string;
    assetId: string;
    roomId: string;
    systemQuantity: number;
    countedQuantity: number;
    scanMethod?: ScanMethod;
    status: InventoryResultStatus;
    note?: string;
  }

  // Filter Types
  export enum FilterOperator {
    EQUALS = 'equals',
    CONTAINS = 'contains',
    STARTS_WITH = 'startsWith',
    ENDS_WITH = 'endsWith',
    GREATER_THAN = 'gt',
    GREATER_THAN_OR_EQUAL = 'gte',
    LESS_THAN = 'lt',
    LESS_THAN_OR_EQUAL = 'lte',
    IN = 'in',
    NOT_IN = 'notIn',
    BETWEEN = 'between'
  }

  export enum FieldType {
    TEXT = 'text',
    NUMBER = 'number',
    DATE = 'date',
    SELECT = 'select',
    BOOLEAN = 'boolean'
  }
  