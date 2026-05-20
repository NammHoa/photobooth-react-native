import { useState, useRef } from 'react';
import { StyleSheet, Text, View, Button, Image, TouchableOpacity, Alert, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import ViewShot from 'react-native-view-shot';
import * as MediaLibrary from 'expo-media-library';
import { uploadPhoto } from '../../services/api';

export default function IndexScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [mediaPermission, requestMediaPermission] = MediaLibrary.usePermissions({ writeOnly: true });
  const [photos, setPhotos] = useState([]);
  const [isShooting, setIsShooting] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [frameColor, setFrameColor] = useState('#FFFFFF');
  const [watermarkText, setWatermarkText] = useState('My Photobooth');
  
  const cameraRef = useRef(null);
  const viewShotRef = useRef(null);

  const FRAME_COLORS = ['#FFFFFF', '#000000', '#FFC0CB', '#ADD8E6', '#E6E6FA'];

  if (!permission) {
    return <View />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={{ textAlign: 'center', marginBottom: 20, color: 'white' }}>Chúng tôi cần quyền sử dụng Camera của bạn</Text>
        <Button onPress={requestPermission} title="Cấp quyền Camera" />
      </View>
    );
  }

  const startShooting = async () => {
    setPhotos([]);
    setIsShooting(true);

    let capturedPhotos = [];
    
    for (let i = 0; i < 4; i++) {
      // Đếm ngược 3, 2, 1
      for (let c = 3; c > 0; c--) {
        setCountdown(c);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      setCountdown(null);

      // Chụp ảnh
      if (cameraRef.current) {
        try {
          const photo = await cameraRef.current.takePictureAsync({
            quality: 0.8,
          });
          capturedPhotos.push(photo.uri);
          setPhotos([...capturedPhotos]);
        } catch (error) {
          console.error('Lỗi khi chụp ảnh', error);
        }
      }
      
      // Nghỉ 1 chút trước tấm tiếp theo
      if (i < 3) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    setIsShooting(false);
  };

  const handleSaveAndUpload = async () => {
    if (photos.length !== 4) return;
    
    setIsUploading(true);
    try {
      // 1. Chụp lại dải ảnh thành 1 file
      const stripUri = await viewShotRef.current.capture();
      
      // 2. Yêu cầu quyền lưu ảnh nếu chưa có và Lưu vào máy
      let savedToPhone = false;
      if (!mediaPermission?.granted) {
        const permissionResult = await MediaLibrary.requestPermissionsAsync({ writeOnly: true });
        if (permissionResult.granted) {
          await MediaLibrary.saveToLibraryAsync(stripUri);
          savedToPhone = true;
        }
      } else {
        await MediaLibrary.saveToLibraryAsync(stripUri);
        savedToPhone = true;
      }
      
      // 3. Gửi file ảnh ghép lên server
      await uploadPhoto(stripUri);
      
      const message = savedToPhone 
        ? 'Dải ảnh đã được lưu vào máy và tải lên hệ thống thành công! 📸' 
        : 'Ảnh đã được tải lên hệ thống (nhưng chưa lưu vào máy vì thiếu quyền).';
        
      Alert.alert('Thành công!', message);
      setPhotos([]); // Tự động reset màn hình để khách tiếp theo chụp
    } catch (error) {
      console.error(error);
      Alert.alert('Lỗi', 'Không thể kết nối với máy chủ. Vui lòng kiểm tra mạng.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      {photos.length < 4 ? (
        <View style={styles.cameraContainer}>
          <CameraView style={styles.camera} facing="front" ref={cameraRef} />
          
          {/* Lớp hiển thị đếm ngược */}
          {countdown !== null && (
            <View style={styles.countdownOverlay}>
              <Text style={styles.countdownText}>{countdown}</Text>
            </View>
          )}

          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={[styles.captureButton, isShooting && styles.captureButtonDisabled]} 
              onPress={startShooting}
              disabled={isShooting}
            >
              <View style={styles.captureInner} />
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        // MÀN HÌNH PREVIEW (XEM LẠI 4 ẢNH GHÉP)
        <KeyboardAvoidingView 
          style={styles.previewContainer} 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView contentContainerStyle={styles.scrollContent}>
            {/* Thẻ ViewShot bọc cái khung ảnh để lát nữa "chụp" lại thành 1 file */}
            <ViewShot ref={viewShotRef} options={{ format: "jpg", quality: 1.0 }} style={[styles.stripWrapper, { backgroundColor: frameColor }]}>
              <View style={styles.photoStrip}>
                {photos.map((uri, index) => (
                  <Image key={index} source={{ uri }} style={styles.stripImage} />
                ))}
                <TextInput 
                  style={[styles.stripWatermark, frameColor === '#000000' && { color: '#FFFFFF' }]} 
                  value={watermarkText}
                  onChangeText={setWatermarkText}
                  maxLength={22}
                  selectTextOnFocus
                />
              </View>
            </ViewShot>

            <View style={styles.colorPickerContainer}>
              <Text style={styles.colorPickerLabel}>Chọn màu khung:</Text>
              <View style={styles.colorRow}>
                {FRAME_COLORS.map(color => (
                  <TouchableOpacity 
                    key={color} 
                    style={[
                      styles.colorCircle, 
                      { backgroundColor: color }, 
                      frameColor === color && styles.colorCircleSelected
                    ]}
                    onPress={() => setFrameColor(color)}
                  />
                ))}
              </View>
            </View>

            <View style={styles.actionButtons}>
              <Button title="🗑️ Chụp lại" onPress={() => setPhotos([])} color="#ff4444" disabled={isUploading} />
              <Button 
                title={isUploading ? "⏳ Đang xử lý..." : "📥 Lưu & Tải lên Server"} 
                onPress={handleSaveAndUpload} 
                disabled={isUploading} 
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraContainer: {
    flex: 1,
  },
  camera: {
    ...StyleSheet.absoluteFillObject,
  },
  countdownOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    zIndex: 10,
  },
  countdownText: {
    fontSize: 120,
    fontWeight: 'bold',
    color: 'white',
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonDisabled: {
    opacity: 0.5,
  },
  captureInner: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: 'white',
  },
  previewContainer: {
    flex: 1,
    backgroundColor: '#222',
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  stripWrapper: {
    padding: 10,
    paddingBottom: 20,
    borderRadius: 8,
    // Đổ bóng cho giống tấm ảnh thật
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  photoStrip: {
    width: 220, // Chiều rộng dải ảnh (tăng lên chút)
    alignItems: 'center',
  },
  stripImage: {
    width: 200,
    height: 130,
    marginBottom: 10,
    borderRadius: 4,
    backgroundColor: '#ddd',
  },
  stripWatermark: {
    marginTop: 5,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    letterSpacing: 1,
    textAlign: 'center',
    width: '100%',
  },
  colorPickerContainer: {
    marginTop: 30,
    alignItems: 'center',
    width: '100%',
  },
  colorPickerLabel: {
    color: 'white',
    marginBottom: 10,
    fontSize: 14,
    fontWeight: 'bold',
  },
  colorRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 15, // Khoảng cách giữa các nút tròn (React Native 0.71+)
  },
  colorCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#444',
  },
  colorCircleSelected: {
    borderColor: '#fff',
    borderWidth: 3,
    transform: [{ scale: 1.2 }],
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    width: '100%',
    paddingHorizontal: 10,
    marginTop: 20,
  },
});
