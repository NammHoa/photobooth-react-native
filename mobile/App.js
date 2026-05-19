import { useState, useRef } from 'react';
import { StyleSheet, Text, View, Button, Image, TouchableOpacity, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { uploadPhoto } from './services/api';

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [photoUri, setPhotoUri] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const cameraRef = useRef(null);

  if (!permission) {
    return <View />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={{ textAlign: 'center' }}>Chúng tôi cần quyền sử dụng Camera của bạn</Text>
        <Button onPress={requestPermission} title="Cấp quyền" />
      </View>
    );
  }

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
        });
        setPhotoUri(photo.uri);
      } catch (error) {
        console.error('Lỗi khi chụp ảnh', error);
      }
    }
  };

  const handleUpload = async () => {
    if (!photoUri) return;

    setIsUploading(true);
    try {
      const response = await uploadPhoto(photoUri);
      Alert.alert('Thành công!', 'Ảnh đã được tải lên máy chủ và lưu vào MongoDB.');
      setPhotoUri(null);
    } catch (error) {
      Alert.alert('Lỗi', 'Tải ảnh thất bại. Kiểm tra kết nối mạng và IP máy chủ.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      {!photoUri ? (
        // Màn hình Camera
        <CameraView style={styles.camera} facing="front" ref={cameraRef}>
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
              <View style={styles.captureInner} />
            </TouchableOpacity>
          </View>
        </CameraView>
      ) : (
        <View style={styles.previewContainer}>
          <Image source={{ uri: photoUri }} style={styles.previewImage} />
          <View style={styles.actionButtons}>
            <Button title="Chụp lại" onPress={() => setPhotoUri(null)} color="#ff4444" disabled={isUploading} />
            <Button
              title={isUploading ? "Đang tải lên..." : "Tải lên & Lưu"}
              onPress={handleUpload}
              disabled={isUploading}
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  buttonContainer: {
    flex: 1,
    backgroundColor: 'transparent',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    marginBottom: 40,
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'white',
  },
  previewContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
  },
  previewImage: {
    width: '100%',
    height: '80%',
    resizeMode: 'contain',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 20,
  },
});
