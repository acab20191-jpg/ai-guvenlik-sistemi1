document.addEventListener('DOMContentLoaded', () => {
      if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                              navigator.serviceWorker.register('./sw.js').then((r) => console.log('SW OK', r.scope)).catch((e) => console.log('SW hata', e));
                });
      }
      const videoElement = document.getElementById('input_video');
      const canvasElement = document.getElementById('output_canvas');
      const btnStart = document.getElementById('btn_start');
      const btnStop = document.getElementById('btn_stop');
      const btnTestAlarm = document.getElementById('btn_test_alarm');
      const btnSaveSettings = document.getElementById('btn_save_settings');
      const cameraStatusText = document.getElementById('camera_status');
      const dashboard = new Dashboard();
      const alertSystem = new AlertSystem(dashboard);
      const aiAnalyzer = new AIAnalyzer(videoElement, canvasElement, alertSystem, dashboard);
      const cameraManager = new CameraManager(videoElement);
      const voiceRecognition = new VoiceRecognition(alertSystem);
      let isRunning = false;
      setTimeout(() => { btnStart.disabled = false; }, 1500);
      btnStart.addEventListener('click', async () => {
                if (isRunning) return;
                cameraStatusText.innerText = 'Baslatiliyor...';
                const cameraStarted = await cameraManager.startCamera();
                if (cameraStarted) {
                              cameraStatusText.innerText = 'Aktif';
                              cameraStatusText.className = 'value text-safe';
                              cameraManager.startMediaPipeCamera(async (videoEl) => { await aiAnalyzer.analyzeFrame(videoEl); });
                              aiAnalyzer.start();
                              const voiceToggle = document.getElementById('toggle_voice_sos');
                              if (!voiceToggle || voiceToggle.checked) { voiceRecognition.start(); }
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
                document.getElementById('status_text').innerText = 'SISTEM DURDURULDU';
                const ctx = canvasElement.getContext('2d');
                ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
      });
      btnTestAlarm.addEventListener('click', () => {
                alertSystem.setDanger('TEST ALARMI');
                setTimeout(() => {
                              if(isRunning) { alertSystem.setSafe(); }
                              else { alertSystem.stopAlarm(); document.getElementById('status_overlay').className = 'status-overlay'; document.getElementById('status_text').innerText = 'SISTEM DURDURULDU'; }
                }, 3000);
      });
      btnSaveSettings.addEventListener('click', () => {
                const inactivitySec = parseInt(document.getElementById('setting_inactivity').value) || 10;
                const sosSec = parseInt(document.getElementById('setting_sos').value) || 2;
                const enableHand = document.getElementById('toggle_hand_sos').checked;
                const enableHead = document.getElementById('toggle_head_sos').checked;
                const enableVoice = document.getElementById('toggle_voice_sos').checked;
                const enableBoundary = document.getElementById('toggle_boundary').checked;
                const boundaryDurationSec = parseInt(document.getElementById('setting_boundary_duration').value) || 3;
                const boundaryMarginH = parseInt(document.getElementById('setting_boundary_h').value) || 20;
                const boundaryMarginV = parseInt(document.getElementById('setting_boundary_v').value) || 10;
                aiAnalyzer.updateSettings(inactivitySec, sosSec, enableHand, enableHead, enableBoundary, boundaryDurationSec, boundaryMarginH, boundaryMarginV);
                if (isRunning) { if (enableVoice) { voiceRecognition.start(); } else { voiceRecognition.stop(); } }
                alert('Ayarlar kaydedildi!');
      });
});
