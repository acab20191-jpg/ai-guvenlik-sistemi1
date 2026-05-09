class AlertSystem {
      constructor(dashboard) {
                this.dashboard = dashboard;
                this.statusOverlay = document.getElementById('status_overlay');
                this.statusText = document.getElementById('status_text');
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                this.isAlarming = false;
                this.oscillator = null;
                this.lastNotificationTime = 0;
                this.notificationCooldown = 30000;
                this.lastStatus = '';
      }
      setSafe() {
                if (this.isAlarming) this.stopAlarm();
                this.statusOverlay.className = 'status-overlay safe';
                this.statusText.innerText = 'GUVENLI: HAREKET ALGILANDI';
                if (this.lastStatus !== 'safe') { this.dashboard?.addLog('safe', 'Durum normale dondu.'); this.lastStatus = 'safe'; }
      }
      setWarning(message) {
                if (this.isAlarming) this.stopAlarm();
                this.statusOverlay.className = 'status-overlay warning';
                this.statusText.innerText = 'UYARI: ' + message;
                if (this.lastStatus !== 'warning-' + message) { this.dashboard?.addLog('warning', message); this.lastStatus = 'warning-' + message; }
      }
      setDanger(message) {
                this.statusOverlay.className = 'status-overlay danger';
                this.statusText.innerText = 'TEHLIKE: ' + message;
                this.startAlarm();
                if (this.lastStatus !== 'danger') { this.dashboard?.addLog('danger', 'TEHLIKE: ' + message); this.lastStatus = 'danger'; }
                this.sendTelegramMessage('ACIL DURUM: ' + message);
      }
      startAlarm() {
                if (this.isAlarming) return;
                this.isAlarming = true;
                const playBeep = () => {
                              if (!this.isAlarming) return;
                              this.oscillator = this.audioContext.createOscillator();
                              const gainNode = this.audioContext.createGain();
                              this.oscillator.type = 'square';
                              this.oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);
                              gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
                              this.oscillator.connect(gainNode);
                              gainNode.connect(this.audioContext.destination);
                              this.oscillator.start();
                              setTimeout(() => { if (this.oscillator) { this.oscillator.stop(); this.oscillator.disconnect(); } }, 200);
                };
                playBeep();
                this.alarmInterval = setInterval(playBeep, 500);
      }
      stopAlarm() {
                this.isAlarming = false;
                if (this.alarmInterval) { clearInterval(this.alarmInterval); }
                if (this.oscillator) { try { this.oscillator.stop(); } catch (e) {} }
      }
      async sendTelegramMessage(message) {
                const token = document.getElementById('tg_token').value.trim();
                const chatId = document.getElementById('tg_chatid').value.trim();
                if (!token || !chatId) return;
                const now = Date.now();
                if (now - this.lastNotificationTime < this.notificationCooldown) return;
                try {
                              const url = 'https://api.telegram.org/bot' + token + '/sendMessage';
                              const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, text: message }) });
                              if (response.ok) { this.lastNotificationTime = now; }
                } catch (error) { console.error('Telegram hatasi:', error); }
      }
}
