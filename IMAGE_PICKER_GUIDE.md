# Hướng dẫn sử dụng Image Picker trong ActionModal

## Tổng quan
ActionModal đã được cập nhật để hỗ trợ chọn hình ảnh từ camera và thư viện ảnh với xử lý permissions tốt hơn.

## Các tính năng đã cải thiện

### 1. Permissions Handling
- Sử dụng `react-native-permissions` để xử lý permissions một cách chính xác
- Kiểm tra permissions trước khi request để tránh spam dialog
- Hỗ trợ mở settings app khi user từ chối permissions

### 2. Image Selection
- **Camera**: Chụp ảnh trực tiếp từ camera
- **Thư viện ảnh**: Chọn ảnh từ thư viện (iOS: tối đa 5 ảnh, Android: 1 ảnh)
- **Multi-selection**: Hỗ trợ chọn nhiều ảnh trên iOS

### 3. Error Handling
- Xử lý lỗi permissions một cách graceful
- Hiển thị thông báo lỗi rõ ràng cho user
- Log chi tiết để debug

## Cách sử dụng

### 1. Khi bấm "Chọn hình ảnh"
1. App sẽ kiểm tra permissions hiện tại
2. Nếu chưa có permissions, sẽ hiển thị dialog yêu cầu
3. Nếu user từ chối, sẽ hiển thị dialog hướng dẫn mở settings
4. Nếu có permissions, sẽ hiển thị menu chọn camera/thư viện

### 2. Chọn từ Camera
- Mở camera app
- Chụp ảnh
- Ảnh sẽ được upload tự động sau khi chụp

### 3. Chọn từ Thư viện
- Mở thư viện ảnh
- Chọn ảnh (iOS: có thể chọn nhiều)
- Ảnh sẽ được upload tự động sau khi chọn

## Permissions cần thiết

### Android (AndroidManifest.xml)
```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
```

### iOS (Info.plist)
```xml
<key>NSCameraUsageDescription</key>
<string>App cần quyền truy cập camera để chụp ảnh</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>App cần quyền truy cập thư viện ảnh để chọn ảnh</string>
```

## Troubleshooting

### 1. Lỗi "Tried to use permissions API while not attached to an Activity"
- **Nguyên nhân**: Request permissions khi component chưa mount
- **Giải pháp**: Đã thêm check permissions trước khi request

### 2. Không thể mở camera/thư viện
- **Kiểm tra**: Permissions đã được cấp chưa
- **Giải pháp**: Mở settings app và cấp quyền thủ công

### 3. Upload ảnh thất bại
- **Kiểm tra**: Kết nối mạng và API endpoint
- **Log**: Xem console để debug chi tiết

## Code Examples

### Kiểm tra permissions
```typescript
const checkPermissions = async () => {
  const permissions = Platform.select({
    ios: [PERMISSIONS.IOS.CAMERA, PERMISSIONS.IOS.PHOTO_LIBRARY],
    android: [PERMISSIONS.ANDROID.CAMERA, PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE],
  });
  
  const { check } = await import('react-native-permissions');
  const results = await Promise.all(
    permissions.map((permission) => check(permission))
  );
  
  return results.every((result) => result === RESULTS.GRANTED);
};
```

### Request permissions
```typescript
const requestPermissions = async () => {
  const permissions = Platform.select({
    ios: [PERMISSIONS.IOS.CAMERA, PERMISSIONS.IOS.PHOTO_LIBRARY],
    android: [PERMISSIONS.ANDROID.CAMERA, PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE],
  });
  
  const results = await Promise.all(
    permissions.map((permission) => request(permission))
  );
  
  return results.every((result) => result === RESULTS.GRANTED);
};
```

## Lưu ý quan trọng

1. **Android**: Chỉ hỗ trợ chọn 1 ảnh từ thư viện
2. **iOS**: Hỗ trợ chọn tối đa 5 ảnh từ thư viện
3. **Permissions**: Luôn kiểm tra permissions trước khi request
4. **Error Handling**: Luôn có fallback khi permissions bị từ chối
5. **User Experience**: Hiển thị thông báo rõ ràng và hướng dẫn user

## Testing

Để test image picker:
1. Mở ActionModal
2. Bấm "Chọn hình ảnh"
3. Kiểm tra permissions dialog
4. Test camera và thư viện
5. Kiểm tra upload ảnh
6. Xem console logs để debug
