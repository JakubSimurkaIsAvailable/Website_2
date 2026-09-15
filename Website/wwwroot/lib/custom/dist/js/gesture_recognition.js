import {
    FilesetResolver,
    GestureRecognizer
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest";

let gestureRecognizer = null;
let video = null;
let canvas = null;
let ctx = null;
let lastVideoTime = -1;

let dotNetHelper = null;

export async function startCamera(videoElement, dotNetReference) {

    video = videoElement;
    dotNetHelper = dotNetReference;

    canvas = document.getElementById("overlay");
    ctx = canvas.getContext("2d");

    console.log("Starting camera...");

    const stream = await navigator.mediaDevices.getUserMedia({
        video: true
    });

    video.srcObject = stream;

    await video.play();

    console.log("Camera started.");
    console.log("Loading MediaPipe...");

    const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
    );

    gestureRecognizer =
        await GestureRecognizer.createFromOptions(
            vision,
            {
                baseOptions: {
                    modelAssetPath:
                        "/lib/custom/dist/models/sign_language_model.task"
                },

                runningMode: "VIDEO",

                numHands: 1
            }
        );

    console.log("MediaPipe started.");

    renderLoop();
}


function renderLoop() {

    if (!video || !gestureRecognizer) {
        requestAnimationFrame(renderLoop);
        return;
    }

    if (
        video.readyState >= 2 &&
        video.currentTime !== lastVideoTime
    ) {

        const result =
            gestureRecognizer.recognizeForVideo(
                video,
                performance.now()
            );

        processResult(result);

        lastVideoTime = video.currentTime;
    }

    requestAnimationFrame(renderLoop);
}


function processResult(result) {

    if (!canvas || !ctx || !video) {
        return;
    }

    if (video.videoWidth === 0 || video.videoHeight === 0) {
        return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    if (!result.landmarks) {
        return;
    }

    for (const landmarks of result.landmarks) {

        for (const landmark of landmarks) {

            const x = landmark.x * canvas.width;
            const y = landmark.y * canvas.height;

            ctx.beginPath();
            ctx.arc(x, y, 5, 0, 2 * Math.PI);

            ctx.fillStyle = "red";
            ctx.fill();
        }
    }
}


// Test function
export function testCanvas() {

    console.log("testCanvas started");

    const canvas =
        document.getElementById("overlay");

    if (!canvas) {
        console.error("overlay canvas not found!");
        return;
    }

    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "red";
    ctx.fillRect(50, 50, 100, 100);

    console.log("Red square drawn!");
}