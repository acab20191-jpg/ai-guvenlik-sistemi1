class CameraManager {
    constructor(videoElement) {
        this.videoElement = videoElement;
        this.stream = null;
        this.camera = null;
    }
    async startCamera() {
              try {
            this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 }, audio: false });
            this.videoElement.srcObject = this.stream;
            return new Promise((resolve) => { this.videoElement.onloadedmetadata = () => { this.videoElement.play(); resolve(true); }; });
} catch (error) { console.error('Kamera baslatilamadi:', error); return false; }
}
    startMediaPipeCamera(onFrame) {
              this.camera = new Camera(this.videoElement, {
            onFrame: async () => { await onFrame(this.videoElement); },
            width: 640,
            height: 480
});
        this.camera.start();
    }
    stopCamera() {
        if (this.camera) { this.camera.stop(); }
        if (this.stream) { this.stream.getTracks().forEach(track => track.stop()); this.videoElement.srcObject = null; }
    }
}
