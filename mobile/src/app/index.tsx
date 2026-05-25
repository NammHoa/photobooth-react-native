import { useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, Image, TouchableOpacity, Alert, TextInput, KeyboardAvoidingView, Platform, ScrollView, Animated, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import ViewShot from 'react-native-view-shot';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { uploadPhoto } from '../../services/api';

export default function IndexScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [mediaPermission, requestMediaPermission] = MediaLibrary.usePermissions({ writeOnly: true });
  const [photos, setPhotos] = useState([]);
  const [isShooting, setIsShooting] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [frameColor, setFrameColor] = useState('#FFFFFF');
  const [watermarkText, setWatermarkText] = useState('My Photobooth');
  const [facing, setFacing] = useState('front');
  
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  
  const cameraRef = useRef(null);
  const viewShotRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.5)).current;

  const FRAME_COLORS = ['#FFFFFF', '#121212', '#FFE5EC', '#E0F4FF', '#EBE0FF'];

  useEffect(() => {
    if (countdown !== null) {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.5);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 4,
          useNativeDriver: true,
        })
      ]).start();
    }
  }, [countdown]);

  if (!permission) return <View style={styles.container} />;

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={{ textAlign: 'center', marginBottom: 20 }}>Vui lòng cấp quyền Camera</Text>
        <Button onPress={requestPermission} title="Cấp quyền" />
      </View>
    );
  }

  const toggleCameraFacing = () => {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  };

  const startShooting = async () => {
    setPhotos([]);
    setIsShooting(true);

    let capturedPhotos = [];
    
    for (let i = 0; i < 4; i++) {
      for (let c = 3; c > 0; c--) {
        setCountdown(c);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      setCountdown(null);

      if (cameraRef.current) {
        try {
          const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
          capturedPhotos.push(photo.uri);
          setPhotos([...capturedPhotos]);
        } catch (error) {
          console.error('Lỗi khi chụp ảnh', error);
        }
      }
      
      if (i < 3) await new Promise(resolve => setTimeout(resolve, 500));
    }

    setIsShooting(false);
  };

  const handleSaveAndUpload = async () => {
    if (photos.length !== 4) return;
    setIsUploading(true);
    try {
      const stripUri = await viewShotRef.current.capture();
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
      await uploadPhoto(stripUri);

      // Lưu thêm 1 bản copy vào Album nội bộ của app (để xem trong màn hình Album mà không cần xin quyền)
      const albumPath = FileSystem.documentDirectory + 'my-album/';
      const dirInfo = await FileSystem.getInfoAsync(albumPath);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(albumPath, { intermediates: true });
      }
      const fileName = `strip_${Date.now()}.jpg`;
      await FileSystem.copyAsync({ from: stripUri, to: albumPath + fileName });

      Alert.alert('Thành công!', savedToPhone ? 'Đã lưu máy & Tải lên!' : 'Đã tải lên!');
      setPhotos([]); 
    } catch (error) {
      Alert.alert('Lỗi', 'Lỗi mạng.');
    } finally {
      setIsUploading(false);
    }
  };

  // Tính toán kích thước Responsive cho khung Polaroid
  let polaroidWidth = screenWidth * 0.9;
  let polaroidInnerHeight = polaroidWidth * (4/3);
  let polaroidTotalHeight = polaroidInnerHeight + 60; // 60px cho phần viền dưới chứa nút bấm

  // Nếu khung quá cao so với màn hình (bị lẹm vào nút bấm ở các máy màn hình ngắn)
  // Tính toán chính xác khoảng trống còn lại sau khi trừ đi top bar, bottom bar và safe area (tai thỏ/lỗ đục)
  const maxAvailableHeight = screenHeight - insets.top - insets.bottom - 180; 
  if (polaroidTotalHeight > maxAvailableHeight) {
    polaroidTotalHeight = maxAvailableHeight;
    polaroidInnerHeight = polaroidTotalHeight - 60;
    polaroidWidth = polaroidInnerHeight * (3/4);
  }

  // Kích thước dải ảnh (Preview)
  const stripWidth = screenWidth * 0.65;
  const stripImageHeight = stripWidth * (4/3);

  return (
    <SafeAreaView style={styles.container}>
      {photos.length < 4 ? (
        // --- NEW MODERN CAMERA SCREEN ---
        <View style={styles.cameraLayout}>
          
          {/* Top Bar */}
          <View style={styles.topBar}>
            <TouchableOpacity style={styles.iconButton}>
              <Ionicons name="chevron-back" size={28} color="#555" />
            </TouchableOpacity>
            
            <View style={styles.autoBurstBadge}>
              <Text style={styles.autoBurstText}>Auto burst</Text>
            </View>
            
            <View style={styles.topRightIcons}>
              <TouchableOpacity style={styles.iconButton}>
                <Ionicons name="flash-outline" size={24} color="#555" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconButton} onPress={toggleCameraFacing}>
                <Ionicons name="sync-outline" size={24} color="#555" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Polaroid Camera Viewport */}
          <View style={[styles.middleSection]}>
            <View style={[
              styles.polaroidWrapper, 
              { width: polaroidWidth, height: polaroidTotalHeight }
            ]}>
              <View style={[styles.polaroidInner, { height: polaroidInnerHeight }]}>
                <CameraView style={styles.camera} facing={facing} ref={cameraRef} />
                
                {/* Countdown Overlay */}
                {countdown !== null && (
                  <View style={styles.countdownOverlay}>
                    <Animated.Text style={[
                      styles.countdownText, 
                      { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }
                    ]}>
                      {countdown}
                    </Animated.Text>
                  </View>
                )}
              </View>
              
              {/* Inner Floating Buttons */}
              <View style={styles.innerFloatingControls}>
                <LinearGradient colors={['#9BF8DB', '#46E4BA']} style={styles.floatingPill}>
                  <TouchableOpacity style={styles.floatingPillInner}>
                    <Ionicons name="person" size={16} color="#000" />
                    <Text style={styles.floatingPillText}>Pose ON</Text>
                  </TouchableOpacity>
                </LinearGradient>

                <LinearGradient colors={['#9BF8DB', '#46E4BA']} style={styles.floatingPill}>
                  <TouchableOpacity style={styles.floatingPillInner}>
                    <MaterialCommunityIcons name="cards-playing-outline" size={18} color="#000" />
                    <Text style={styles.floatingPillText}>Templates</Text>
                  </TouchableOpacity>
                </LinearGradient>
              </View>
            </View>
          </View>

          {/* Bottom Controls */}
          <View style={styles.bottomControls}>
            <View style={styles.controlRow}>
              {/* Album Button */}
              <TouchableOpacity style={styles.sideControl} onPress={() => router.push('/album')}>
                <View style={styles.circleIconDark}>
                  <Ionicons name="images" size={20} color="#FFF" />
                </View>
                <Text style={styles.sideControlText}>Album</Text>
              </TouchableOpacity>
              
              {/* Main Shutter Button */}
              <TouchableOpacity 
                style={[styles.captureSquare, isShooting && { opacity: 0.5 }]} 
                onPress={startShooting}
                disabled={isShooting}
              >
                {/* Crosshairs */}
                <View style={[styles.crosshair, styles.tl]} />
                <View style={[styles.crosshair, styles.tr]} />
                <View style={[styles.crosshair, styles.bl]} />
                <View style={[styles.crosshair, styles.br]} />
                
                {/* Inner glowing circle */}
                <View style={styles.captureGlow}>
                  <View style={styles.captureWhiteCenter} />
                </View>
              </TouchableOpacity>
              
              {/* Retouch Button */}
              <TouchableOpacity style={styles.sideControl}>
                <View style={styles.circleIconDark}>
                  <MaterialCommunityIcons name="auto-fix" size={20} color="#FFF" />
                </View>
                <Text style={styles.sideControlText}>Retouch</Text>
              </TouchableOpacity>
            </View>
            
            <Text style={styles.helpText}>Tap to start countdown</Text>
          </View>

        </View>
      ) : (
        // --- PREVIEW SCREEN (Keep existing for now, will upgrade later if needed) ---
        <KeyboardAvoidingView style={{flex: 1, backgroundColor: '#EEF0F4'}} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView contentContainerStyle={{flexGrow: 1, alignItems: 'center', paddingVertical: 40}} showsVerticalScrollIndicator={false}>
            <ViewShot ref={viewShotRef} options={{ format: "jpg", quality: 1.0 }} style={[{padding: 12, paddingBottom: 24, borderRadius: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 10}, { backgroundColor: frameColor }]}>
              <View style={{width: stripWidth, alignItems: 'center'}}>
                {photos.map((uri, index) => (
                  <Image key={index} source={{ uri }} style={{width: stripWidth, height: stripImageHeight, marginBottom: 12, borderRadius: 4, backgroundColor: '#333'}} />
                ))}
                <TextInput style={{marginTop: 8, fontSize: stripWidth * 0.08, fontWeight: '900', color: '#121212', letterSpacing: 2, textAlign: 'center', width: '100%'}} value={watermarkText} onChangeText={setWatermarkText} maxLength={22} selectTextOnFocus />
              </View>
            </ViewShot>
            
            <View style={{marginTop: 30, alignItems: 'center', width: '85%'}}>
              <Text style={{color: '#666', marginBottom: 12, fontSize: 12, fontWeight: '600', textTransform: 'uppercase'}}>Màu khung ảnh</Text>
              <View style={{flexDirection: 'row', justifyContent: 'center', gap: 16}}>
                {FRAME_COLORS.map(color => (
                  <TouchableOpacity key={color} style={[{width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: '#CCC', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 5}, { backgroundColor: color }, frameColor === color && {borderColor: '#46E4BA', borderWidth: 3, transform: [{ scale: 1.15 }]}]} onPress={() => setFrameColor(color)} />
                ))}
              </View>
            </View>

            <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '85%', marginTop: 30}}>
              <TouchableOpacity onPress={() => setPhotos([])} disabled={isUploading} style={{paddingVertical: 15, paddingHorizontal: 20}}>
                <Text style={{color: '#666', fontSize: 16, fontWeight: '600'}}>Chụp lại</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSaveAndUpload} disabled={isUploading}>
                <LinearGradient colors={['#9BF8DB', '#46E4BA']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{paddingVertical: 15, paddingHorizontal: 30, borderRadius: 30, shadowColor: '#46E4BA', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 8}}>
                  <Text style={{color: '#000', fontSize: 16, fontWeight: 'bold'}}>{isUploading ? "Đang lưu..." : "Lưu & Tải lên"}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EEF0F4', // Light silver/gray background
  },
  cameraLayout: {
    flex: 1,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingTop: 5,
    paddingBottom: 15,
  },
  iconButton: {
    padding: 8,
  },
  topRightIcons: {
    flexDirection: 'row',
    gap: 15,
  },
  autoBurstBadge: {
    backgroundColor: '#0F2620', // Dark green/black
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  autoBurstText: {
    color: '#4AF2C1', // Neon green text
    fontWeight: '700',
    fontSize: 12,
  },
  middleSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  polaroidWrapper: {
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    padding: 6,
    paddingBottom: 60, // Space for inner floating buttons
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  polaroidInner: {
    width: '100%',
    backgroundColor: '#000',
    borderRadius: 8,
    overflow: 'hidden',
  },
  camera: {
    flex: 1,
  },
  countdownOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  countdownText: {
    fontSize: 140,
    fontWeight: '900',
    color: '#FFF',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 10,
  },
  innerFloatingControls: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  floatingPill: {
    borderRadius: 8,
    padding: 2, // Gradient border width
    shadowColor: '#46E4BA',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
  floatingPillInner: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    gap: 6,
  },
  floatingPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111',
  },
  bottomControls: {
    paddingHorizontal: 20,
    paddingBottom: 30,
    alignItems: 'center',
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 20,
  },
  sideControl: {
    alignItems: 'center',
    gap: 8,
  },
  circleIconDark: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#1C2120',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
  },
  sideControlText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#555',
  },
  captureSquare: {
    width: 90,
    height: 90,
    backgroundColor: '#182924',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  captureGlow: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#4AF2C1',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4AF2C1',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 15,
  },
  captureWhiteCenter: {
    width: 20,
    height: 20,
    backgroundColor: '#FFF',
    borderRadius: 10,
  },
  crosshair: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderColor: '#4AF2C1',
    opacity: 0.6,
  },
  tl: { top: 8, left: 8, borderTopWidth: 2, borderLeftWidth: 2 },
  tr: { top: 8, right: 8, borderTopWidth: 2, borderRightWidth: 2 },
  bl: { bottom: 8, left: 8, borderBottomWidth: 2, borderLeftWidth: 2 },
  br: { bottom: 8, right: 8, borderBottomWidth: 2, borderRightWidth: 2 },
  helpText: {
    color: '#999',
    fontSize: 14,
    fontWeight: '500',
  }
});
