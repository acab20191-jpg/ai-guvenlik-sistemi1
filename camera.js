class CameraManager {
    constructor(videoElement) {
        this.videoElement = videoElement;
        this.stream = null;
        this.cameraObj = null; // MediaPipe Camera
    }

    async startCamera() {
        // MediaPipe Camera kullanacağız, manuel getUserMedia'ya gerek yok.
        // Sadece video elementinin hazır olduğunu simüle ediyoruz.
        return true;
    }

    stopCamera() {
        if (this.cameraObj) {
            this.cameraObj.stop();
        }
        if (this.videoElement.srcObject) {
            this.videoElement.srcObject.getTracks().forEach(track => track.stop());
            this.videoElement.srcObject = null;
        }
    }

    // MediaPipe Camera utils entegrasyonu için (otomatik frame çekme)
    startMediaPipeCamera(onFrameCallback) {
        this.cameraObj = new Camera(this.videoElement, {
            onFrame: async () => {
                await onFrameCallback(this.videoElement);
            },
            width: 640,
            height: 480
        });
        this.cameraObj.start();
    }
}
