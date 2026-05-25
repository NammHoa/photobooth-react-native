import { useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, Image, TouchableOpacity, Alert, TextInput, KeyboardAvoidingView, Platform, ScrollView, Animated, useWindowDimensions, Modal, FlatList } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import ViewShot from 'react-native-view-shot';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { uploadPhoto } from '../../services/api';

const TEMPLATE_CATEGORIES = ['Selfbooth', 'HOT', 'Duo Booth', 'K-Style Booth!'];
const MOCK_TEMPLATES = [
  { id: '1', title: 'Wedding 🕊', category: 'Selfbooth', frameColor: '#C4E1C5', borderColor: '#FFFFFF', borderWidth: 10, previewImage: 'https://picsum.photos/id/1014/300/400', photoCount: 2 },
  { id: '2', title: 'Text Emotions-4', category: 'Selfbooth', frameColor: '#000000', borderColor: '#333333', borderWidth: 15, previewImage: 'https://picsum.photos/id/338/300/400', photoCount: 4 },
  { id: '3', title: 'Today', category: 'Selfbooth', frameColor: '#FFFFFF', borderColor: '#DDDDDD', borderWidth: 8, previewImage: 'https://picsum.photos/id/1025/300/400', photoCount: 4 },
  { id: '4', title: 'Summer Vibes', category: 'HOT', frameColor: '#FFD700', borderColor: '#FF4500', borderWidth: 20, previewImage: 'https://picsum.photos/id/1043/300/400', photoCount: 4 },
  { id: '5', title: 'Neon Night', category: 'HOT', frameColor: '#FF00FF', borderColor: '#00FFFF', borderWidth: 12, previewImage: 'https://picsum.photos/id/1051/300/400', photoCount: 8 },
];

export default function IndexScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [mediaPermission, requestMediaPermission] = MediaLibrary.usePermissions({ writeOnly: true });
  const [photos, setPhotos] = useState([]);
  const [isShooting, setIsShooting] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(MOCK_TEMPLATES[0]);
  const [watermarkText, setWatermarkText] = useState('My Photobooth');
  const [facing, setFacing] = useState('front');
  const [templateModalVisible, setTemplateModalVisible] = useState(false);
  const [activeCategory, setActiveCategory] = useState('Selfbooth');
  
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
    if (cameraRef.current && !isShooting && photos.length < selectedTemplate.photoCount) {
      setIsShooting(true);
      
      for (let i = 3; i > 0; i--) {
        setCountdown(i);
        await new Promise(r => setTimeout(r, 1000));
      }
      setCountdown(0); 
      
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7, skipProcessing: true });
      setCountdown(null);
      
      setPhotos(prev => [...prev, photo.uri]);
      setIsShooting(false);
    }
  };

  const handleSaveAndUpload = async () => {
    if (photos.length !== selectedTemplate.photoCount) return;
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
      {photos.length < selectedTemplate.photoCount ? (
        // --- CAMERA SCREEN ---
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
                
                {/* Camera Viewport (Letterboxed) */}
                <CameraView style={styles.camera} facing={facing} ref={cameraRef} />
                
                {/* Progress Indicator (Visual Boxes) inside the black bar */}
                <View style={{ position: 'absolute', top: 15, alignSelf: 'center', zIndex: 100 }}>
                  <View style={{ 
                    width: selectedTemplate.photoCount > 4 ? 30 : 20, 
                    height: Math.ceil(selectedTemplate.photoCount / (selectedTemplate.photoCount > 4 ? 2 : 1)) * 12, 
                    borderWidth: 1.5, 
                    borderColor: '#FFF', 
                    borderRadius: 6, 
                    overflow: 'hidden',
                    flexDirection: 'row',
                    flexWrap: 'wrap'
                  }}>
                    {Array.from({ length: selectedTemplate.photoCount }).map((_, index) => {
                      const cols = selectedTemplate.photoCount > 4 ? 2 : 1;
                      const rows = Math.ceil(selectedTemplate.photoCount / cols);
                      const isFilled = index < photos.length;
                      return (
                        <View 
                          key={index} 
                          style={{ 
                            width: cols === 1 ? '100%' : '50%', 
                            height: `${100 / rows}%`, 
                            backgroundColor: isFilled ? '#9BF8DB' : 'transparent',
                            borderBottomWidth: Math.floor(index / cols) < rows - 1 ? 1 : 0,
                            borderRightWidth: cols > 1 && index % 2 === 0 ? 1 : 0,
                            borderColor: 'rgba(255,255,255,0.4)'
                          }} 
                        />
                      );
                    })}
                  </View>
                </View>

                {/* Lớp phủ Template (Giả lập bằng CSS Border) */}
                <View 
                  pointerEvents="none" 
                  style={[
                    StyleSheet.absoluteFillObject, 
                    { 
                      borderWidth: selectedTemplate.borderWidth, 
                      borderColor: selectedTemplate.borderColor,
                      borderRadius: 8
                    }
                  ]} 
                />
                
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
                  <TouchableOpacity style={styles.floatingPillInner} onPress={() => setTemplateModalVisible(true)}>
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
        // --- PREVIEW SCREEN (Máy in ảnh UI) ---
        <KeyboardAvoidingView style={{flex: 1, backgroundColor: '#EEF0F4'}} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView contentContainerStyle={{flexGrow: 1, alignItems: 'center', paddingBottom: 60}} showsVerticalScrollIndicator={false}>
            
            {/* Header Mũi tên */}
            <View style={{ width: '100%', paddingHorizontal: 20, paddingTop: 10 }}>
              <TouchableOpacity onPress={() => setPhotos([])}>
                <Ionicons name="chevron-back" size={28} color="#999" />
              </TouchableOpacity>
            </View>

            {/* Máy In Nhả Ảnh (Metal Dispenser) */}
            <View style={{ width: stripWidth + 80, height: 75, borderRadius: 16, overflow: 'hidden', alignSelf: 'center', marginTop: 10, zIndex: 10, elevation: 20, shadowColor: '#000', shadowOffset: {width: 0, height: 15}, shadowOpacity: 0.3, shadowRadius: 15, borderWidth: 1, borderColor: '#FFF' }}>
              <LinearGradient colors={['#8A8D96', '#E2E4EA', '#8A8D96']} start={{x:0, y:0}} end={{x:0, y:1}} style={{flex: 1, justifyContent: 'center', paddingVertical: 10}}>
                {/* Ốc vít */}
                <View style={{ position: 'absolute', top: 12, left: 15, width: 8, height: 8, borderRadius: 4, backgroundColor: '#444' }} />
                <View style={{ position: 'absolute', top: 12, right: 15, width: 8, height: 8, borderRadius: 4, backgroundColor: '#444' }} />
                
                <Text style={{ textAlign: 'center', fontSize: 11, fontWeight: '900', letterSpacing: 4, color: '#666', textShadowColor: '#FFF', textShadowOffset: {width: 0, height: 1}, textShadowRadius: 1, marginBottom: 8 }}>PHOTO BOOTH</Text>
                
                {/* Khe đen (Slot) */}
                <View style={{ height: 18, backgroundColor: '#111', borderRadius: 9, marginHorizontal: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 4 }} />
              </LinearGradient>
            </View>

            {/* Dải ảnh đang nhả ra (Paper Strip) */}
            <View style={{ marginTop: -35, zIndex: 1, elevation: 1, shadowColor: '#000', shadowOffset: {width: 0, height: 15}, shadowOpacity: 0.2, shadowRadius: 20 }}>
              
              {/* Vùng ViewShot sẽ được lưu thành ảnh */}
              <ViewShot ref={viewShotRef} options={{ format: "jpg", quality: 1.0 }} style={{ backgroundColor: selectedTemplate.frameColor, padding: 12, paddingTop: 45, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}>
                {/* Lớp phủ Template (Giả lập bằng CSS Border) đè lên dải ảnh */}
                <View 
                  pointerEvents="none" 
                  style={[
                    StyleSheet.absoluteFillObject, 
                    { 
                      borderWidth: selectedTemplate.borderWidth, 
                      borderColor: selectedTemplate.borderColor,
                      zIndex: 10
                    }
                  ]} 
                />

                <View style={{width: stripWidth, alignItems: 'center'}}>
                  {photos.map((uri, index) => (
                    <TouchableOpacity key={index} activeOpacity={0.9} onPress={() => Alert.alert('Chụp lại', 'Tính năng chọn ảnh chụp lại sẽ được phát triển sau.')}>
                      <Image source={{ uri }} style={{width: stripWidth, height: stripImageHeight, marginBottom: 12, backgroundColor: '#333'}} />
                    </TouchableOpacity>
                  ))}
                  <TextInput 
                    style={{
                      marginTop: 8, 
                      fontSize: stripWidth * 0.08, 
                      fontWeight: '900', 
                      color: (selectedTemplate.frameColor === '#000000' || selectedTemplate.frameColor === '#333333') ? '#FFFFFF' : '#121212', 
                      letterSpacing: 2, 
                      textAlign: 'center', 
                      width: '100%'
                    }} 
                    value={watermarkText} 
                    onChangeText={setWatermarkText} 
                    maxLength={22} 
                    selectTextOnFocus 
                  />
                </View>
              </ViewShot>

              {/* Đuôi tờ giấy (Doodle Pen & Scalloped edge) KHÔNG bị lưu vào ảnh */}
              <View style={{ backgroundColor: selectedTemplate.frameColor, alignItems: 'center', paddingBottom: 15, paddingTop: 5 }}>
                <TouchableOpacity style={{ backgroundColor: '#FFF', paddingVertical: 8, paddingHorizontal: 25, borderRadius: 20, borderWidth: 1, borderColor: '#000', flexDirection: 'row', alignItems: 'center' }}>
                  <MaterialCommunityIcons name="draw-pen" size={16} color="#000" style={{marginRight: 6}} />
                  <Text style={{ color: '#000', fontWeight: 'bold', fontSize: 13 }}>Doodle pen</Text>
                </TouchableOpacity>
              </View>

              {/* Răng cưa (Scalloped Edge) */}
              <View style={{ flexDirection: 'row', width: stripWidth + 24, height: 10, overflow: 'hidden', backgroundColor: selectedTemplate.frameColor }}>
                {Array.from({ length: Math.ceil((stripWidth + 24) / 12) + 1 }).map((_, i) => (
                  <View key={i} style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: '#EEF0F4', marginTop: 3, marginLeft: -2 }} />
                ))}
              </View>

            </View>

            {/* Các nút điều khiển bên dưới */}
            <Text style={{ marginTop: 30, color: '#999', fontSize: 13, fontWeight: '500' }}>Tap on the photo that needs to be retaken</Text>
            
            <TouchableOpacity onPress={handleSaveAndUpload} disabled={isUploading} style={{ marginTop: 25 }}>
              <LinearGradient colors={['#0F251C', '#000000']} style={{ paddingVertical: 16, paddingHorizontal: 60, borderRadius: 8, borderWidth: 1, borderColor: '#1F4D3A', shadowColor: '#46E4BA', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 15, elevation: 10 }}>
                <Text style={{ color: '#46E4BA', fontSize: 18, fontWeight: 'bold', letterSpacing: 1, textShadowColor: '#46E4BA', textShadowOffset: {width: 0, height: 0}, textShadowRadius: 8 }}>{isUploading ? "SAVING..." : "Save"}</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity style={{ marginTop: 35, backgroundColor: '#E0E3EB', paddingVertical: 15, paddingHorizontal: 40, borderRadius: 30 }}>
              <Text style={{ color: '#666', fontWeight: '700', fontSize: 14 }}>Behind-the-scenes footage</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      {/* Templates Bottom Sheet Modal */}
      <Modal
        visible={templateModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setTemplateModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.bottomSheet}>
            {/* Drag Handle */}
            <TouchableOpacity style={styles.modalHandleContainer} onPress={() => setTemplateModalVisible(false)}>
              <Ionicons name="chevron-down" size={30} color="#666" />
            </TouchableOpacity>

            {/* Categories */}
            <View style={{ height: 60 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
                {TEMPLATE_CATEGORIES.map(cat => (
                  <TouchableOpacity 
                    key={cat} 
                    style={[styles.categoryChip, activeCategory === cat && styles.categoryChipActive]}
                    onPress={() => setActiveCategory(cat)}
                  >
                    <Text style={[styles.categoryText, activeCategory === cat && styles.categoryTextActive]}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Templates Grid */}
            <FlatList
              data={MOCK_TEMPLATES.filter(t => t.category === activeCategory)}
              keyExtractor={item => item.id}
              numColumns={2}
              contentContainerStyle={{ paddingBottom: 40 }}
              columnWrapperStyle={{ justifyContent: 'space-between', paddingHorizontal: 15, marginBottom: 15 }}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={styles.templateItem} 
                  onPress={() => {
                    setSelectedTemplate(item);
                    setPhotos([]); // Xóa ảnh cũ khi đổi Template để tránh lỗi logic số lượng
                    setTemplateModalVisible(false);
                  }}
                  activeOpacity={0.8}
                >
                  <Image source={{ uri: item.previewImage }} style={styles.templateImage} />
                  <Text style={styles.templateTitle}>{item.title}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
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
    justifyContent: 'center', // Centers the camera to create top/bottom black bars
  },
  camera: {
    width: '100%',
    height: '75%', // Leaves 12.5% black bar at top and bottom
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
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    backgroundColor: '#121212', // Dark background for bottom sheet
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '75%', // Takes up 75% of screen
  },
  modalHandleContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  categoryScroll: {
    paddingHorizontal: 15,
    alignItems: 'center',
    gap: 10,
  },
  categoryChip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#333',
    backgroundColor: 'transparent',
  },
  categoryChipActive: {
    backgroundColor: '#9BF8DB', // Neon green
    borderColor: '#9BF8DB',
  },
  categoryText: {
    color: '#CCC',
    fontSize: 14,
    fontWeight: '600',
  },
  categoryTextActive: {
    color: '#000',
    fontWeight: 'bold',
  },
  templateItem: {
    width: '48%', // 2 columns
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#333',
  },
  templateImage: {
    width: '100%',
    aspectRatio: 3/4,
    backgroundColor: '#333',
  },
  templateTitle: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
    padding: 10,
    textAlign: 'center',
  }
});
