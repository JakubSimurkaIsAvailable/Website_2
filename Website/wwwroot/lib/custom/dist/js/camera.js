window.cameraInterop = {
    startCamera: async (videoElement) => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            video.srcObject = stream;
        } catch (error) {
            console.error("Error accessing the camera: ", error);
        }
    }
};