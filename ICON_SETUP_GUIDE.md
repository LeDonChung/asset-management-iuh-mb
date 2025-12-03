# Hướng dẫn cài đặt icon cho app Asset IUH

## Tên app đã được cập nhật
✅ Tên app đã được đổi thành "Asset IUH" trong:
- `app.json`
- `android/app/src/main/res/values/strings.xml`
- `ios/AssetRFIDDemo/Info.plist`

## Cập nhật icon app

### Phương án 1: Sử dụng online icon generator (Khuyến nghị)

1. Truy cập: https://www.appicon.co/ hoặc https://icon.kitchen/
2. Upload file `assets/bg/logo_iuh_main.png`
3. Tải về bộ icon đã được generate cho cả Android và iOS
4. Thay thế các file icon trong:
   - **Android**: `android/app/src/main/res/mipmap-*/ic_launcher.png` và `ic_launcher_round.png`
   - **iOS**: `ios/AssetRFIDDemo/Images.xcassets/AppIcon.appiconset/`

### Phương án 2: Sử dụng react-native-make

1. Cài đặt package:
```bash
npm install -g @bam.tech/react-native-make
```

2. Generate icon từ logo_iuh_main.png:
```bash
react-native set-icon --path ./assets/bg/logo_iuh_main.png
```

### Phương án 3: Thủ công (dành cho Android)

Tạo các kích thước icon từ logo_iuh_main.png:
- **mipmap-mdpi**: 48x48px
- **mipmap-hdpi**: 72x72px
- **mipmap-xhdpi**: 96x96px
- **mipmap-xxhdpi**: 144x144px
- **mipmap-xxxhdpi**: 192x192px

Sau đó copy vào thư mục tương ứng với tên `ic_launcher.png` và `ic_launcher_round.png`

### Build lại app sau khi thay đổi icon

**Android:**
```bash
cd android
./gradlew clean
cd ..
npx react-native run-android
```

**iOS:**
```bash
cd ios
pod install
cd ..
npx react-native run-ios
```

hoặc build release:
```bash
cd android
./gradlew assembleRelease
```

## Kiểm tra kết quả

Sau khi build lại, app sẽ có:
- Tên: **Asset IUH**
- Icon: Logo từ `logo_iuh_main.png`
