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
let lastRecognizedSign = null;


export async function startCamera(videoElement, dotNetReference) {

    console.log("startCamera() called");

    video = videoElement;
    dotNetHelper = dotNetReference;

    canvas = document.getElementById("overlay");

    if (!canvas) {
        console.error("Overlay canvas not found!");
        return;
    }

    ctx = canvas.getContext("2d");

    console.log("Starting camera...");

    try {

        const stream = await navigator.mediaDevices.getUserMedia({
            video: true
        });

        video.srcObject = stream;

        await video.play();

        console.log("Camera started.");

    } catch (error) {

        console.error("Could not start camera:", error);

        return;
    }


    console.log("Loading MediaPipe...");


    try {

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

                    numHands: 2
                }
            );


        console.log("MediaPipe started.");

        console.log(
            "Custom sign language model loaded successfully."
        );


        renderLoop();

    } catch (error) {

        console.error(
            "Failed to initialize MediaPipe:",
            error
        );
    }
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

        try {

            const result =
                gestureRecognizer.recognizeForVideo(
                    video,
                    performance.now()
                );


            processResult(result);

            lastVideoTime = video.currentTime;

        } catch (error) {

            console.error(
                "Gesture recognition error:",
                error
            );
        }
    }


    requestAnimationFrame(renderLoop);
}


async function processResult(result) {

    if (!canvas || !ctx || !video) {
        return;
    }


    if (
        video.videoWidth === 0 ||
        video.videoHeight === 0
    ) {
        return;
    }


    // Match canvas size to camera resolution

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;


    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );


    // Draw hand landmarks

    if (result.landmarks) {

        for (const landmarks of result.landmarks) {

            for (const landmark of landmarks) {

                const x =
                    landmark.x * canvas.width;

                const y =
                    landmark.y * canvas.height;


                ctx.beginPath();

                ctx.arc(
                    x,
                    y,
                    5,
                    0,
                    2 * Math.PI
                );


                ctx.fillStyle = "red";

                ctx.fill();
            }
        }
    }


    // No gestures detected

    if (
        !result.gestures ||
        result.gestures.length === 0
    ) {
        return;
    }


    // Get gestures for the first detected hand

    const gesturesForHand =
        result.gestures[0];


    if (
        !gesturesForHand ||
        gesturesForHand.length === 0
    ) {
        return;
    }


    // Highest scoring gesture

    const topGesture =
        gesturesForHand[0];


    const sign =
        topGesture.categoryName;

    const confidence =
        topGesture.score;


    console.log(
        "Recognized sign:",
        sign,
        "Confidence:",
        confidence
    );


    // Send result to Blazor

    if (
        dotNetHelper &&
        confidence >= 0.5 &&
        sign &&
        sign !== lastRecognizedSign
    ) {

        console.log(
            "Sending sign to Blazor:",
            sign
        );


        lastRecognizedSign = sign;


        try {

            await dotNetHelper.invokeMethodAsync(
                "SetRecognizedSign",
                sign
            );


        } catch (error) {

            console.error(
                "Could not send sign to Blazor:",
                error
            );
        }
    }
}


export function testCanvas() {

    console.log("testCanvas started");


    const canvas =
        document.getElementById("overlay");


    if (!canvas) {

        console.error(
            "overlay canvas not found!"
        );

        return;
    }


    const ctx =
        canvas.getContext("2d");


    ctx.fillStyle = "red";


    ctx.fillRect(
        50,
        50,
        100,
        100
    );


    console.log(
        "Red square drawn!"
    );
}