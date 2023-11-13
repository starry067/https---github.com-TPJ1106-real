import React, { useRef, useState, useEffect } from 'react';
import { View, Text,TouchableOpacity, StyleSheet, StatusBar, TouchableWithoutFeedback,} from 'react-native';
import { Camera } from 'expo-camera';
import * as Speech from 'expo-speech';
import { MaterialIcons } from '@expo/vector-icons';
import { w3cwebsocket as W3CWebSocket } from 'websocket';

export default function App() {
  const cameraRef = useRef(null);
  const [cameraPermission, setCameraPermission] = useState(null);
  const [serverResponse, setServerResponse] = useState('');
  const [isOverlayVisible, setIsOverlayVisible] = useState(false);
  const [speechIndex, setSpeechIndex] = useState(0);
  const [isButtonsDisabled, setIsButtonsDisabled] = useState(false);
  const [hasPlayedFirstTime, setHasPlayedFirstTime] = useState(false);
  const [speechText, setSpeechText] = useState('');
  const captureInterval = 300;  //0.3초
  let captureTimer = null;
  let isSpeaking = false;
 
  const uploadEndpoint = '/uploadImage'; // 이미지 업로드 엔드포인트 설정
  const [distanceResult, setDistanceResult] = useState('0m'); // 거리 정보 상태 변수

  const SERVER_ADDRESS = `http://192.168.1.36:3000`;  
  const wsClient = new W3CWebSocket('ws://192.168.1.36:3001'); // 실시간을 위한 웹소켓 연결

  // 어플 첫 실행 시 가이드 메시지
  const firstText = [
    '어플의 사용법을 알려드리겠습니다.\n다음 설명을 듣고싶으시면 화면을 터치해주세요.',
    '어플의 첫 실행 화면은 카메라 화면입니다.',
    '휴대폰을 사용자가 가려고 하는 방향으로 비추면 어플이 장애물과의 거리를 인식하여 음성으로 알려줍니다.',
    '화면 중앙 하단에는 카메라 촬영 버튼이 있습니다.\n이 버튼은 식품을 촬영하는 버튼으로, 과자나 라면을 촬영하면 어떤 식품인지 알려줍니다.',
    '식품을 촬영하면 촬영한 식품을 인식하여 어떤 식품인지 텍스트와 음성으로 알려준 뒤 3초 후에 이전 화면으로 돌아갑니다.',
    '촬영 시 휴대폰을 30도 가량 아래를 향하게 해주세요.',
    '화면 우측 상단에는 도움말 버튼이 있습니다. 어플의 사용법을 듣고싶으시면 우측 상단의 버튼을 눌러주세요.',
    '어플 사용법 설명이 다 끝났습니다.\n어플의 사용법을 다시 듣고싶으시다면 우측 상단의 도움말 버튼을 눌러주세요.',
    '카메라 화면으로 돌아갑니다.'
  ];

  // 도움말 메시지
  const helpText = [
    '도움말 버튼을 누르셨습니다.\n다음 설명을 듣고싶으시면 화면을 터치해주세요.',
    '어플의 첫 실행 화면은 카메라 화면입니다.',
    '휴대폰을 사용자가 가려고 하는 방향으로 비추면 어플이 장애물과의 거리를 인식하여 음성으로 알려줍니다.',
    '화면 중앙 하단에는 카메라 촬영 버튼이 있습니다.\n이 버튼은 식품을 촬영하는 버튼으로, 과자나 라면을 촬영하면 어떤 식품인지 알려줍니다.',
    '식품을 촬영하면 촬영한 식품을 인식하여 어떤 식품인지 텍스트와 음성으로 알려준 뒤 3초 후에 이전 화면으로 돌아갑니다.',
    '촬영 시 휴대폰을 30도 가량 아래를 향하게 해주세요.',
    '화면 우측 상단에는 도움말 버튼이 있습니다. 어플의 사용법을 듣고싶으시면 우측 상단의 버튼을 눌러주세요.',
    '어플 사용법 설명이 다 끝났습니다.\n어플의 사용법을 다시 듣고싶으시다면 다시 우측 상단의 도움말 버튼을 눌러주세요.',
    '카메라 화면으로 돌아갑니다.'
  ];

  // 어플 첫 실행 시 가이드 메시지 음성 재생
  const speakTextAndDisplayOverlay = async (text) => {
    setIsButtonsDisabled(true);

    try {
      await Speech.stop();
      setSpeechText(text);
      await Speech.speak(text);
    } catch (error) {
      console.error(error);
    } finally {
      setIsButtonsDisabled(false);
    }
    setIsOverlayVisible(true);
  };

  //터치 시 다음 음성으로 넘어가기
  const handleOverlayPress = async () => {
    if (isOverlayVisible) {
      if (!hasPlayedFirstTime) {
        setHasPlayedFirstTime(true);
        setSpeechIndex(speechIndex + 1);
        return;
      }

      if (speechIndex < firstText.length - 1) {
        const textToSpeak = firstText[speechIndex + 1];
        setSpeechText(textToSpeak);
      
        try {
          await Speech.stop();
          await Speech.speak(textToSpeak);
        } catch (error) {
          console.error(error);
        }
      
        setIsOverlayVisible(true);
      
        if (textToSpeak.includes('카메라 화면으로 돌아갑니다.')) {
          setTimeout(() => setIsOverlayVisible(false), 3000);
        }
        
        setSpeechIndex(speechIndex + 1);
      } else {
        setIsOverlayVisible(false);
        setSpeechIndex(0);
      }
    }
  };

  //도움말 음성 재생
  const speakHelpTextAndDisplayOverlay = async (index) => {
    setIsButtonsDisabled(true);

    try {
      await Speech.stop();
      await Speech.speak(helpText[index]);
    } catch (error) {
      console.error(error);
    } finally {
      setIsButtonsDisabled(false);
    }

    setIsOverlayVisible(true);
    setSpeechText(helpText[index]);
  };

  //도움말 선택 시 항상 처음 음성부터 재생하도록 설정
  const handleHelpButtonPress = async () => {
    if (!isOverlayVisible) {
      setIsOverlayVisible(true);
      setSpeechIndex(0);
      speakHelpTextAndDisplayOverlay(0);
    }
  };

  //카메라 액세스 권한 요청 및 어플 처음 실행 확인
  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setCameraPermission(status === 'granted');

      if (!hasPlayedFirstTime) {
        setIsOverlayVisible(true);
        setIsButtonsDisabled(true);
        try {
          await Speech.stop();
          speakTextAndDisplayOverlay(firstText[0]);
        } catch (error) {
          console.error(error);
        } finally {
          setIsButtonsDisabled(false);
          setHasPlayedFirstTime(true);
        }
      }
    })();
  }, [hasPlayedFirstTime]);
/*
  //자동 촬영
  const startAutoCapture = () => {
    captureTimer = setInterval(() => {
      if (!isOverlayVisible && !isSpeaking) {
        captureAndProcessImage();
      }
    }, captureInterval);
  };

  const stopAutoCapture = () => {
    clearInterval(captureTimer);
  };
 */ 
  // 서버에서 실시간 거리 정보를 받아 상태 업데이트
  // 실시간 거리 정보를 받아 상태 업데이트
  useEffect(() => {
    wsClient.onmessage = (message) => {
      const distanceData = JSON.parse(message.data);
      setDistanceResult(`깊이: ${distanceData.depth}m`);
    };

    wsClient.onclose = (e) => {
      console.log('웹소켓 연결 해제', e);
    };

    wsClient.onerror = (err) => {
      console.log('웹소켓 에러 발생', err);
    };

    return () => {
      wsClient.close();
    };
  }, [wsClient]);

  // 거리 정보 갱신 시 서버로 전송
  useEffect(() => {
    sendDistance(distanceResult);
  }, [distanceResult]);

  // 거리 정보 서버로 전송
  const sendDistance = async (depth) => {
    if (wsClient.readyState === WebSocket.OPEN) {
      wsClient.send(JSON.stringify({ depth }));
    }
  };

  //자동 촬영 후 서버 전송 결과 음성 출력
  const captureAndProcessImage = async () => {
    wsClient.send(JSON.stringify({ depth }));
  };

  //팝업창 열기
  const openServerResponsePopup = () => {
    if (serverResponse) {
      playPopupMessage();
    }
  };

  //팝업 텍스트를 음성으로 재생
  const playPopupMessage = async () => {
    try {
      await Speech.stop();
      await Speech.speak(serverResponse);
    } catch (error) {
      console.error('음성 재생 오류:', error);
    }
  
    // 3초 후 팝업창 닫기
    setTimeout(() => {
      setServerResponse('');
    }, 3000);
  };

/*
  //어플 실행 시 항상 자동 촬영 시작
  useEffect(() => {
    startAutoCapture();
  }, []);

  //음성 재생 중 또는 카메라 버튼 누를 때만 자동 촬영 중지
  useEffect(() => {
    if (isSpeaking || isButtonsDisabled) {
      stopAutoCapture();
    } else {
      startAutoCapture();
    }
  }, [isSpeaking, isButtonsDisabled]);
*/
  //서버
  useEffect(() => {
    openServerResponsePopup();
  }, [serverResponse]);

  //카메라 버튼으로 촬영한 이미지를 서버로 전송
  const uploadImageToServer = async () => {
    if (!cameraPermission || isButtonsDisabled) {
      console.log('카메라 액세스 권한이 필요하거나 버튼이 비활성화되었습니다.');
      return;
    }

    if (cameraRef.current) {
      const photo = await cameraRef.current.takePictureAsync();

      try {
        const formData = new FormData();
        formData.append('image', {
          uri: photo.uri,
          type: 'image/jpeg',
          name: 'photo.jpg',
        });

        const response = await fetch(`${SERVER_ADDRESS}/saveCameraImage`, {
          method: 'POST',
          body: formData,
          headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

        if (response.status === 200) {
          const data = await response.text();
          await Speech.stop();
          await Speech.speak(data.testResultText);
          setServerResponse(data);
        } else {
          console.error('서버 오류:', response.statusText);
          setServerResponse('서버로 이미지를 업로드하지 못했습니다.');
        }
      } catch (error) {
        console.error('이미지 업로드 오류:', error);
        setServerResponse('식품을 인식할 수 없습니다.\n다시 촬영해 주세요.');
      }
    }
  };
  // 거리 정보 갱신 시 서버로 전송
  useEffect(() => {
    sendDistance(distanceResult);
  }, [distanceResult]);

  //어플 화면
  return (
    <View style={styles.container}>
      <StatusBar hidden={true} />
      {cameraPermission === null ? (
        <Text>카메라 액세스 권한 요청 중...</Text>
      ) : cameraPermission === false ? (
        <Text>카메라 액세스 권한이 거부되었습니다. 권한을 부여해 주세요.</Text>
      ) : (
        <TouchableWithoutFeedback onPress={handleOverlayPress}>
          <View style={styles.cameraContainer}>
            {/* 도움말 버튼 */}
            <TouchableOpacity
              style={styles.helpButton}
              onPress={handleHelpButtonPress}
              disabled={isButtonsDisabled}
            >
              <MaterialIcons name="help" size={70} color="#AE7FFF" />
            </TouchableOpacity>
            {isOverlayVisible && (
              <View style={styles.overlay}>
                <Text style={styles.overlayText}>{speechText}</Text>
              </View>
            )}

            <Camera style={styles.camera} ref={cameraRef} />
            
            {/* 실시간 거리 정보 표기 */}
            <View style={styles.distanceContainer}>
              <Text style={styles.distanceText}>{distanceResult}</Text>
            </View>
            {/* 카메라 버튼 */}
            <TouchableOpacity
              style={[styles.circularButton]}
              onPress={uploadImageToServer}
              disabled={isButtonsDisabled}
            >
              <MaterialIcons name="photo-camera" size={70} color="white" />
            </TouchableOpacity>

            {/* 팝업창 */}
            {serverResponse !== '' && (
              <View style={styles.serverResponsePopup}>
                <Text style={styles.serverResponseText}>{serverResponse}</Text>
              </View>
            )}
          </View>
        </TouchableWithoutFeedback>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraContainer: {
    flex: 1,
    width: '100%',
  },
  camera: {
    flex: 1,
  },
  //도움말 버튼
  helpButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: 'yellow',
    padding: 15,
    borderRadius: 30,
    zIndex: 2,
  },
  //카메라 버튼
  circularButton: {
    position: 'absolute',
    bottom: 30,
    alignSelf: 'center',
    paddingVertical: 20,
    paddingHorizontal: 130,
    backgroundColor: 'blue',
    padding: 45,
    borderRadius: 30,
    zIndex: 1,
  },
  //가이드 메시지 출력 시 배경
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 3,
  },
  //가이드 메시지
  overlayText: {
    color: 'white',
    fontSize: 18,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  distanceContainer: {
    position: "absolute",
    bottom: 0,  // 중앙으로 위치 조정
    left: 0,    // 중앙으로 위치 조정
    right: 0,   // 컨테이너의 가로 중앙
    top: 0,     // 컨테이너의 세로 중앙
    backgroundColor: "rgba(0, 0, 0, 0)",
    padding: 0,
    borderRadius: 5,
    alignItems: "center",  // 수평 중앙 정렬
    justifyContent: "center",  // 수직 중앙 정렬
  },
  distanceText: {
    color: "white",
    fontSize: 25,
  },
  // 서버 응답 팝업창
  serverResponsePopup: {
    position: 'absolute',
    top: '40%',
    left: 20,
    right: 20,
    backgroundColor: 'white',
    padding: 35,
    borderRadius: 10,
    zIndex: 4,
    elevation: 5,
  },
  //팝업창 텍스트
  serverResponseText: {
    fontSize: 25,
    textAlign: 'center',
  },
});