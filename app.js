document.addEventListener('DOMContentLoaded', () => {
    // PWA Service Worker Kaydı
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js')
                .then((registration) => {
                    console.log('ServiceWorker başarıyla kaydedildi: ', registration.scope);
                })
                .catch((error) => {
                    console.log('ServiceWorker kaydı başarısız oldu: ', error);
                });
        });
    }

    const videoElement = document.getElementById('input_video');
    const canvasElement = document.getElementById('output_canvas');
    
    const btnStart = document.getElementById('btn_start');
    const btnStop = document.getElementById('btn_stop');
    const btnTestAlarm = document.getElementById('btn_test_alarm');
    const btnSaveSettings = document.getElementById('btn_save_settings');
    const cameraStatusText = document.getElementById('camera_status');

    // Sistem Bileşenlerini Başlat
    const dashboard = new Dashboard();
    const alertSystem = new AlertSystem(dashboard);
    const aiAnalyzer = new AIAnalyzer(videoElement, canvasElement, alertSystem, dashboard);
    const cameraManager = new CameraManager(videoElement);
    const voiceRecognition = new VoiceRecognition(alertSystem);

    let isRunning = false;

    // Butonları başlangıçta aktif et (AI yüklendikten sonra normalde olmalı ama basitlik için direkt aktif ediyoruz)
    setTimeout(() => {
        btnStart.disabled = false;
    }, 1500);

    btnStart.addEventListener('click', async () => {
        if (isRunning) return;
        
        cameraStatusText.innerText = 'Başlatılıyor...';
        
        const cameraStarted = await cameraManager.startCamera();
        
        if (cameraStarted) {
            cameraStatusText.innerText = 'Aktif';
            cameraStatusText.className = 'value text-safe';
            
            // MediaPipe Camera Loop'u başlat
            cameraManager.startMediaPipeCamera(async (videoEl) => {
                await aiAnalyzer.analyzeFrame(videoEl);
            });

            // AI Analyzer arkaplan görevlerini başlat
            aiAnalyzer.start();

            // Ses dinlemeyi başlat (eğer checkbox açıksa)
            const voiceToggle = document.getElementById('toggle_voice_sos');
            if (!voiceToggle || voiceToggle.checked) {
                voiceRecognition.start();
            }

            isRunning = true;
            btnStart.disabled = true;
            btnStop.disabled = false;
            
            alertSystem.setSafe();
        } else {
            cameraStatusText.innerText = 'Hata';
            cameraStatusText.className = 'value text-danger';
        }
    });

    btnStop.addEventListener('click', () => {
        if (!isRunning) return;
        
        cameraManager.stopCamera();
        aiAnalyzer.stop();
        voiceRecognition.stop();
        isRunning = false;
        
        btnStart.disabled = false;
        btnStop.disabled = true;
        
        cameraStatusText.innerText = 'Durduruldu';
        cameraStatusText.className = 'value text-warning';
        
        alertSystem.stopAlarm();
        document.getElementById('status_overlay').className = 'status-overlay';
        document.getElementById('status_text').innerText = 'SİSTEM DURDURULDU';
        
        // Canvas'ı temizle
        const ctx = canvasElement.getContext('2d');
        ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    });

    btnTestAlarm.addEventListener('click', () => {
        alertSystem.setDanger('TEST ALARMI');
        setTimeout(() => {
            if(isRunning) {
                alertSystem.setSafe();
            } else {
                alertSystem.stopAlarm();
                document.getElementById('status_overlay').className = 'status-overlay';
                document.getElementById('status_text').innerText = 'SİSTEM DURDURULDU';
            }
        }, 3000); // 3 saniye sonra test alarmını kapat
    });

    btnSaveSettings.addEventListener('click', () => {
        const token = document.getElementById('tg_token').value.trim();
        const chatId = document.getElementById('tg_chatid').value.trim();
        
        // AI Süre Ayarları
        const inactivitySec = parseInt(document.getElementById('setting_inactivity').value) || 10;
        const sosSec = parseInt(document.getElementById('setting_sos').value) || 2;
        
        // SOS Toggle Ayarları
        const enableHand = document.getElementById('toggle_hand_sos').checked;
        const enableHead = document.getElementById('toggle_head_sos').checked;
        const enableVoice = document.getElementById('toggle_voice_sos').checked;
        const enableBoundary = document.getElementById('toggle_boundary').checked;
        const boundaryDurationSec = parseInt(document.getElementById('setting_boundary_duration').value) || 3;
        const boundaryMarginH = parseInt(document.getElementById('setting_boundary_h').value) || 20;
        const boundaryMarginV = parseInt(document.getElementById('setting_boundary_v').value) || 10;
        
        // AI motoruna gönder
        aiAnalyzer.updateSettings(inactivitySec, sosSec, enableHand, enableHead, enableBoundary, boundaryDurationSec, boundaryMarginH, boundaryMarginV);
        
        // Ses Dinleme: sistem çalışırken canlı olarak açıp kapayabiliriz
        if (isRunning) {
            if (enableVoice) {
                voiceRecognition.start();
            } else {
                voiceRecognition.stop();
            }
        }
        
        if (token && chatId) {
            alert(`Ayarlar kaydedildi!\nEl SOS: ${enableHand ? 'Açık' : 'Kapalı'} | Kafa SOS: ${enableHead ? 'Açık' : 'Kapalı'} | Ses: ${enableVoice ? 'Açık' : 'Kapalı'}`);
        } else {
            alert(`AI Ayarları kaydedildi!\nEl SOS: ${enableHand ? 'Açık' : 'Kapalı'} | Kafa SOS: ${enableHead ? 'Açık' : 'Kapalı'} | Ses: ${enableVoice ? 'Açık' : 'Kapalı'}`);
        }
    });
});
