import {
    FilesetResolver,
    GestureRecognizer
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest";

const HAND_CONNECTIONS = [
    [0, 1], [1, 2], [2, 3], [3, 4],
    [0, 5], [5, 6], [6, 7], [7, 8],
    [5, 9], [9, 10], [10, 11], [11, 12],
    [9, 13], [13, 14], [14, 15], [15, 16],
    [13, 17], [17, 18], [18, 19], [19, 20],
    [0, 17]
];

let gestureRecognizer = null;

let video = null;
let canvas = null;
let ctx = null;

let lastVideoTime = -1;

let dotNetHelper = null;
let lastRecognizedSign = null;

export async function startCamera(videoElement, dotNetReference) {
    video = videoElement;
    dotNetHelper = dotNetReference;

    canvas = document.getElementById("overlay");

    if (!canvas) {
        console.error("Overlay canvas not found!");
        return;
    }

    ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "user" }
        });

        video.srcObject = stream;
        await video.play();

        const stage = canvas.parentElement;
        if (stage && video.videoWidth && video.videoHeight) {
            stage.style.aspectRatio = `${video.videoWidth} / ${video.videoHeight}`;
        }
    } catch (error) {
        console.error("Could not start camera:", error);
        return;
    }

    try {
        const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );

        gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: "/lib/custom/dist/models/sign_language_model.task"
            },
            runningMode: "VIDEO",
            numHands: 2
        });

        renderLoop();
    } catch (error) {
        console.error("Failed to initialize MediaPipe:", error);
    }
}

function syncCanvasSize() {
    if (!video || !canvas) {
        return;
    }

    const width = video.videoWidth;
    const height = video.videoHeight;

    if (width === 0 || height === 0) {
        return;
    }

    if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        ctx.imageSmoothingEnabled = false;
    }
}

function toPoint(landmark) {
    return {
        x: landmark.x * canvas.width,
        y: landmark.y * canvas.height
    };
}

function drawPixelLine(from, to, color, thickness) {
    ctx.strokeStyle = color;
    ctx.lineWidth = thickness;
    ctx.lineCap = "square";
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
}

function drawPixelDot(point, size, fill, stroke) {
    const half = size / 2;
    ctx.fillStyle = fill;
    ctx.fillRect(point.x - half, point.y - half, size, size);
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.strokeRect(point.x - half, point.y - half, size, size);
}

function drawHand(landmarks) {
    const points = landmarks.map(toPoint);
    const scale = Math.max(canvas.width, canvas.height);
    const boneWidth = Math.max(3, Math.round(scale * 0.004));
    const jointSize = Math.max(6, Math.round(scale * 0.012));

    for (const [start, end] of HAND_CONNECTIONS) {
        drawPixelLine(points[start], points[end], "#00fff2", boneWidth);
    }

    for (let i = 0; i < points.length; i++) {
        const isTip = i === 4 || i === 8 || i === 12 || i === 16 || i === 20;
        drawPixelDot(
            points[i],
            isTip ? jointSize + 2 : jointSize,
            isTip ? "#ffe600" : "#ff2bd6",
            "#12081f"
        );
    }
}

function renderLoop() {
    if (!video || !gestureRecognizer) {
        requestAnimationFrame(renderLoop);
        return;
    }

    if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
        try {
            const result = gestureRecognizer.recognizeForVideo(
                video,
                performance.now()
            );

            processResult(result);
            lastVideoTime = video.currentTime;
        } catch (error) {
            console.error("Gesture recognition error:", error);
        }
    }

    requestAnimationFrame(renderLoop);
}

async function processResult(result) {
    if (!canvas || !ctx || !video) {
        return;
    }

    if (video.videoWidth === 0 || video.videoHeight === 0) {
        return;
    }

    syncCanvasSize();

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (result.landmarks) {
        for (const landmarks of result.landmarks) {
            drawHand(landmarks);
        }
    }

    if (!result.gestures || result.gestures.length === 0) {
        return;
    }

    const gesturesForHand = result.gestures[0];

    if (!gesturesForHand || gesturesForHand.length === 0) {
        return;
    }

    const topGesture = gesturesForHand[0];
    const sign = topGesture.categoryName;
    const confidence = topGesture.score;

    if (
        dotNetHelper &&
        confidence >= 0.5 &&
        sign &&
        sign !== lastRecognizedSign
    ) {
        lastRecognizedSign = sign;

        try {
            await dotNetHelper.invokeMethodAsync("SetRecognizedSign", sign);
        } catch (error) {
            console.error("Could not send sign to Blazor:", error);
        }
    }
}
