class VoiceRecognition {
    constructor(alertSystem) {
        this.alertSystem = alertSystem;
        this.statusElement = document.getElementById('voice_status');
        this.recognition = null;
        this.isRunning = false;
        
        this.init();
    }

    init() {
        window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        
        if (!window.SpeechRecognition) {
            console.warn("Bu tarayıcı Speech Recognition API desteklemiyor.");
            if(this.statusElement) this.statusElement.innerText = "Desteklenmiyor";
            return;
        }

        this.recognition = new window.SpeechRecognition();
        this.recognition.lang = 'tr-TR';
        this.recognition.continuous = true; // Sürekli dinle
        this.recognition.interimResults = false;

        this.recognition.onstart = () => {
            this.isRunning = true;
            if(this.statusElement) {
                this.statusElement.innerText = "Dinliyor...";
                this.statusElement.className = "value text-safe";
            }
        };

        this.recognition.onresult = (event) => {
            const current = event.resultIndex;
            const transcript = event.results[current][0].transcript.toLowerCase();
            
            console.log("Duyulan kelime: ", transcript);

            // "imdat", "yardım" kelimelerini arıyoruz
            if (transcript.includes("imdat") || transcript.includes("yardım")) {
                this.alertSystem.setDanger("SESLİ YARDIM (S.O.S) ÇAĞRISI DUYULDU!");
            }
        };

        this.recognition.onerror = (event) => {
            console.error("Ses tanıma hatası:", event.error);
            if(this.statusElement) {
                this.statusElement.innerText = "Hata (" + event.error + ")";
                this.statusElement.className = "value text-danger";
            }
        };

        this.recognition.onend = () => {
            // Eğer sistem hala çalışıyorsa (kapatılmadıysa), dinlemeyi yeniden başlat
            if (this.isRunning) {
                try {
                    this.recognition.start();
                } catch(e) {}
            }
        };
    }

    start() {
        if (!this.recognition || this.isRunning) return;
        try {
            this.recognition.start();
        } catch (e) {
            console.error(e);
        }
    }

    stop() {
        this.isRunning = false;
        if (!this.recognition) return;
        try {
            this.recognition.stop();
            if(this.statusElement) {
                this.statusElement.innerText = "Kapalı";
                this.statusElement.className = "value text-warning";
            }
        } catch (e) {}
    }
}
