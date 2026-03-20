const camera = document.getElementById("camera");
const cameraCard = document.getElementById("cameraCard");
const placeholder = document.getElementById("cameraPlaceholder");
const focusBox = document.querySelector(".focus-box");
const copyLink = document.getElementById("copyLink");
const shareLink = document.getElementById("shareLink");
const fullScreen = document.getElementById("fullScreen");
const cameraFullscreen = document.getElementById("cameraFullscreen");
let faceDetector = null;
let taskVisionDetector = null;

async function startCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    placeholder.textContent = "Camera not supported in this browser.";
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
      audio: false,
    });
    camera.srcObject = stream;
    cameraCard.classList.add("is-live");
    await camera.play();
    await initTaskVision();
    if (!taskVisionDetector) {
      initFaceDetector();
    }
    trackFaces();
  } catch (error) {
    placeholder.textContent = "Camera access blocked. Allow permissions.";
  }
}

async function initTaskVision() {
  try {
    const visionModule = await import(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0"
    );
    const { FaceDetector, FilesetResolver } = visionModule;
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
    );
    taskVisionDetector = await FaceDetector.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite",
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      minDetectionConfidence: 0.5,
      minSuppressionThreshold: 0.3,
    });
  } catch (error) {
    taskVisionDetector = null;
  }
}

function initFaceDetector() {
  if ("FaceDetector" in window) {
    try {
      faceDetector = new window.FaceDetector({ fastMode: true });
    } catch (error) {
      faceDetector = null;
    }
  }
}

function mapBoundingBox(box) {
  const cardRect = cameraCard.getBoundingClientRect();
  const videoWidth = camera.videoWidth || cardRect.width;
  const videoHeight = camera.videoHeight || cardRect.height;
  const videoRatio = videoWidth / videoHeight;
  const cardRatio = cardRect.width / cardRect.height;

  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;

  if (videoRatio > cardRatio) {
    scale = cardRect.height / videoHeight;
    const renderedWidth = videoWidth * scale;
    offsetX = (cardRect.width - renderedWidth) / 2;
  } else {
    scale = cardRect.width / videoWidth;
    const renderedHeight = videoHeight * scale;
    offsetY = (cardRect.height - renderedHeight) / 2;
  }

  return {
    x: box.x * scale + offsetX,
    y: box.y * scale + offsetY,
    width: box.width * scale,
    height: box.height * scale,
  };
}

async function trackFaces() {
  if (camera.readyState >= 2) {
    try {
      if (taskVisionDetector) {
        const result = taskVisionDetector.detectForVideo(
          camera,
          performance.now()
        );
        const detection = result.detections?.[0];
        if (detection?.boundingBox) {
          const mapped = mapBoundingBox({
            x: detection.boundingBox.originX,
            y: detection.boundingBox.originY,
            width: detection.boundingBox.width,
            height: detection.boundingBox.height,
          });
          focusBox.style.display = "block";
          focusBox.style.transform = `translate(${mapped.x}px, ${mapped.y}px)`;
          focusBox.style.width = `${mapped.width}px`;
          focusBox.style.height = `${mapped.height}px`;
        } else {
          focusBox.style.display = "none";
        }
      } else if (faceDetector) {
        const faces = await faceDetector.detect(camera);
        if (faces.length > 0) {
          const mapped = mapBoundingBox(faces[0].boundingBox);
          focusBox.style.display = "block";
          focusBox.style.transform = `translate(${mapped.x}px, ${mapped.y}px)`;
          focusBox.style.width = `${mapped.width}px`;
          focusBox.style.height = `${mapped.height}px`;
        } else {
          focusBox.style.display = "none";
        }
      } else {
        focusBox.style.display = "block";
        centerFocusBox();
      }
    } catch (error) {
      focusBox.style.display = "none";
    }
  }

  requestAnimationFrame(trackFaces);
}

function centerFocusBox() {
  const cardRect = cameraCard.getBoundingClientRect();
  const size = Math.min(cardRect.width, cardRect.height) * 0.35;
  focusBox.style.width = `${size}px`;
  focusBox.style.height = `${size}px`;
  focusBox.style.transform = `translate(${(cardRect.width - size) / 2}px, ${(cardRect.height - size) / 2}px)`;
}

async function copyPageLink() {
  try {
    await navigator.clipboard.writeText(window.location.href);
  } catch (error) {
    // Fallback without disrupting the UI
    const input = document.createElement("input");
    input.value = window.location.href;
    document.body.appendChild(input);
    input.select();
    document.execCommand("copy");
    input.remove();
  }
}

async function sharePageLink() {
  if (navigator.share) {
    try {
      await navigator.share({
        title: "Emotion AI",
        url: window.location.href,
      });
    } catch (error) {
      // User cancelled share
    }
  } else {
    await copyPageLink();
  }
}

async function requestFullscreen(target) {
  if (!document.fullscreenElement && target.requestFullscreen) {
    await target.requestFullscreen();
  } else if (document.exitFullscreen) {
    await document.exitFullscreen();
  }
}

copyLink.addEventListener("click", copyPageLink);
shareLink.addEventListener("click", sharePageLink);
fullScreen.addEventListener("click", () => requestFullscreen(cameraCard));
cameraFullscreen.addEventListener("click", () => requestFullscreen(cameraCard));

startCamera();
