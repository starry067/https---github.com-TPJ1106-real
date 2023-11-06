import torch
from PIL import Image
from torchvision.transforms import Compose, ToTensor, Resize
from depth_decoder import DepthDecoder
from resnet_encoder import ResnetEncoder
import requests
import cv2  # OpenCV 라이브러리 추가
from websocket import create_connection

# 웹소켓 서버 URL
ws_url = "ws://172.30.1.41:3000"

# 웹소켓 클라이언트 생성
ws = create_connection(ws_url)

def load_model():
    # load pre-trained model weights
    model_path = "../mono+stereo_640x192.pth"  # TODO: 모델 경로로 교체

    # Initialize encoder and decoder
    encoder = ResnetEncoder(18, False)
    depth_decoder = DepthDecoder(num_ch_enc=encoder.num_ch_enc, scales=range(4))

    # 모델 파라미터 로드
    loaded_dict_enc = torch.load(model_path, map_location='cpu')

    # 모델 학습에 사용된 이미지의 높이와 너비 추출
    feed_height = loaded_dict_enc['height']
    feed_width = loaded_dict_enc['width']
    filtered_dict_enc = {k: v for k, v in loaded_dict_enc.items() if k in encoder.state_dict()}
    encoder.load_state_dict(filtered_dict_enc)
    depth_decoder.load_state_dict(torch.load(model_path, map_location='cpu'))

    encoder.eval()
    depth_decoder.eval()
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    return encoder, depth_decoder, feed_height, feed_width, device

encoder, depth_decoder, feed_height, feed_width = load_model()

def preprocess_image(image):
    original_width, original_height = image.size

    preprocess = Compose([
        Resize((feed_height, feed_width)),
        ToTensor()
    ])
    return preprocess(image).unsqueeze(0), original_width, original_height

def postprocess_disparity(disp, original_height, original_width):
    disp_resized = torch.nn.functional.interpolate(disp, (original_height, original_width), mode="bilinear", align_corners=False)
    return disp_resized.squeeze().cpu().detach().numpy()

def estimate_depth(image_path, x, y):
    # 이미지 로드 및 전처리
    image = Image.open(image_path).convert('RGB')
    input_image, original_width, original_height = preprocess_image(image)

    # 모델 및 장치 로드
    encoder, depth_decoder, feed_height, feed_width, device = load_model()
    input_image = input_image.to(device)

    # 깊이 예측
    with torch.no_grad():
        features = encoder(input_image)
        outputs = depth_decoder(features)
  
    disp = outputs[("disp", 0)]
  
    # 이산도를 후처리
    disp_resized_np = postprocess_disparity(disp, original_height, original_width)

    # 십자선 위치에서 깊이 추출
    depth_at_crosshair = disp_resized_np[y][x]   # 해당 위치의 깊이 추출
    # 거리 결과를 텍스트 파일에 저장
    with open(f"{image_path.split('.')[0]}_distance.txt", "w") as file:
        file.write(str(disp_resized_np))

    # 거리를 서버로 전송
    server_url = "http://172.30.1.41:3000/distance"  # /distance 엔드포인트로 변경
    payload = {"depth": depth_at_crosshair}
    response = requests.post(server_url, json=payload)
    if response.status_code == 200:
        print("깊이 값 전송 성공")
    else:
        print("깊이 값 전송 실패")
    ws.send(str(depth_at_crosshair))    # 웹소켓으로 거리 정보 전송

    # 십자선 위치의 깊이 반환
    return depth_at_crosshair   # 깊이 반환

if __name__ == "__main__":
   import sys
   image_path = sys.argv[1]
   x = int(sys.argv[2])
   y = int(sys.argv[3])
   depth = estimate_depth(image_path, x, y)
   print(depth)