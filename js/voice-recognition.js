class VoiceRecognition {
      constructor(alertSystem) {
                this.alertSystem = alertSystem;
                this.recognition = null;
                this.isStarted = false;class VoiceRecognition {
                      constructor(alertSystem) {
                                this.alertSystem = alertSystem;
                                this.recognition = null;
                                this.isStarted = false;
                                if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
                                              const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
                                              this.recognition = new SpeechRecognition();
                                              this.recognition.continuous = true;
                                              this.recognition.interimResults = true;
                                              this.recognition.lang = 'tr-TR';
                                              this.recognition.onresult = (event) => {
                                                                const transcript = Array.from(event.results).map(result => result[0].transcript).join('').toLowerCase();
                                                                if (transcript.includes('yardim et') || transcript.includes('acil durum') || transcript.includes('polis cagir') || transcript.includes('help me') || transcript.includes('sos')) {
                                                                                      this.alertSystem.setDanger('SESLI SOS ALGILANDI: ' + transcript);
                                                                }
                                              };
                                              this.recognition.onerror = (event) => { console.error('Ses tanima hatasi:', event.error); };
                                              this.recognition.onend = () => { if (this.isStarted) this.recognition.start(); };
                                }
                      }
                      start() {
                                if (this.recognition && !this.isStarted) {
                                              try { this.recognition.start(); this.isStarted = true; console.log('Ses tanima basladi'); }
                                              catch (e) { console.error('Ses tanima baslatma hatasi:', e); }
                                }
                      }
                      stop() {
                                if (this.recognition && this.isStarted) {
                                              this.recognition.stop();
                                              this.isStarted = false;
                                              console.log('Ses tanima durduruldu');
                                }
                      }
                }
                if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
                              const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
                              this.recognition = new SpeechRecognition();
                              this.recognition.continuous = true;
                              this.recognition.interimResults = true;
                              this.recognition.lang = 'tr-TR';
                              this.recognition.onresult = (event) => {
                                                const transcript = Array.from(event.results).map(result => result[0].transcript).join('').toLowerCase();
                                                if (transcript.includes('yard
