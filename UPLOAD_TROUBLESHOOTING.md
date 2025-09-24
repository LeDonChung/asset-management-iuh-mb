# Hướng dẫn xử lý lỗi Upload hình ảnh

## Lỗi thường gặp và cách khắc phục

### 1. "Upload failed for file 0: Network error"

**Nguyên nhân:**
- Mất kết nối internet
- Server không phản hồi
- Timeout kết nối
- Cấu hình API không đúng

**Cách khắc phục:**
1. **Kiểm tra kết nối mạng:**
   - Đảm bảo thiết bị có kết nối internet ổn định
   - Thử mở trình duyệt và truy cập web

2. **Kiểm tra API endpoint:**
   - Xem file `src/lib/env.tsx` để kiểm tra `API_URL`
   - Đảm bảo server đang chạy và có thể truy cập

3. **Kiểm tra logs:**
   - Mở Developer Console để xem chi tiết lỗi
   - Tìm dòng "Upload attempt X failed" để xem lý do cụ thể

### 2. "Permission results: ['granted', 'blocked']"

**Nguyên nhân:**
- Android 13+ cần permissions mới
- Permissions cũ đã deprecated
- User từ chối permissions

**Cách khắc phục:**
1. **Cập nhật AndroidManifest.xml:**
   ```xml
   <!-- Android 13+ (API 33+) media permissions -->
   <uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
   <uses-permission android:name="android.permission.READ_MEDIA_VIDEO" />
   ```

2. **Cấp quyền thủ công:**
   - Mở Settings > Apps > AssetRFIDDemo > Permissions
   - Bật Camera và Storage permissions

3. **Rebuild app:**
   ```bash
   cd android
   ./gradlew clean
   cd ..
   npx react-native run-android
   ```

### 3. "Không thể mở camera/thư viện"

**Nguyên nhân:**
- Permissions chưa được cấp
- Camera app bị lỗi
- Image picker library không tương thích

**Cách khắc phục:**
1. **Kiểm tra permissions:**
   - Xem console logs để biết permission nào bị từ chối
   - Cấp quyền trong Settings

2. **Test image picker:**
   - Sử dụng component `ImagePickerDebug` để test
   - Kiểm tra logs để debug

### 4. "Upload successful nhưng không hiển thị ảnh"

**Nguyên nhân:**
- URL ảnh không hợp lệ
- Server trả về URL sai format
- Caching issue

**Cách khắc phục:**
1. **Kiểm tra response từ server:**
   ```javascript
   console.log('Upload response:', result.value);
   ```

2. **Kiểm tra URL format:**
   - URL phải bắt đầu bằng http:// hoặc https://
   - Không có ký tự đặc biệt

3. **Clear cache:**
   - Restart app
   - Clear app data

## Các cải thiện đã thực hiện

### 1. Retry Mechanism
- Tự động retry upload 3 lần
- Exponential backoff (1s, 2s, 4s)
- Log chi tiết từng attempt

### 2. Network Check
- Kiểm tra kết nối internet trước khi upload
- Hiển thị thông báo rõ ràng khi mất kết nối

### 3. Error Handling
- Log chi tiết lỗi (code, message, status, data)
- Phân biệt network error vs server error
- Hiển thị thông báo phù hợp cho từng loại lỗi

### 4. User Experience
- Nút "Thử lại" khi upload thất bại
- Loading state rõ ràng
- Thông báo progress chi tiết

## Debug Commands

### 1. Kiểm tra permissions
```javascript
// Trong console
console.log('Android version:', Platform.Version);
console.log('Permission results:', results);
```

### 2. Test network
```javascript
// Test API endpoint
fetch('YOUR_API_URL/api/v1/files/upload/image', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN'
  }
})
.then(response => console.log('API accessible:', response.status))
.catch(error => console.error('API error:', error));
```

### 3. Test image picker
```javascript
// Sử dụng ImagePickerDebug component
import { ImagePickerDebug } from './src/components/ImagePickerDebug';
```

## Checklist khi gặp lỗi

- [ ] Kiểm tra kết nối internet
- [ ] Kiểm tra API endpoint có hoạt động
- [ ] Kiểm tra permissions đã được cấp
- [ ] Kiểm tra logs trong console
- [ ] Thử restart app
- [ ] Thử rebuild app
- [ ] Kiểm tra server logs
- [ ] Test với ảnh khác
- [ ] Test với thiết bị khác

## Liên hệ hỗ trợ

Nếu vẫn gặp lỗi sau khi thử các cách trên:
1. Gửi logs từ console
2. Mô tả chi tiết lỗi
3. Kèm thông tin thiết bị (Android version, app version)
4. Screenshot lỗi nếu có
