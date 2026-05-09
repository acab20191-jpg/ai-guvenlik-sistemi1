class AIAnalyzer {
    constructor(videoElement, canvasElement, alertSystem, dashboard) {
        this.videoElement = videoElement;
        this.canvasElement = canvasElement;
        this.canvasCtx = canvasElement.getContext('2d');
        this.alertSystem = alertSystem;
        this.dashboard = dashboard;
        this.pose = null;

        // Analiz değişkenleri
        this.lastMoveTime = Date.now();
        this.lastFrameTime = Date.now();
        this.lastShoulderY = 0;
        this.isPersonDetected = false;
        this.movementScore = 0;

        // Eşik değerleri
        this.inactivityThreshold = 10000; // 10 saniye hareketsizlik = Uyarı
        this.fallVelocityThreshold = 0.0005; // Birim zaman (ms) başına dikey hız
        this.fallHorizontalThreshold = 0.15; // Omuz-Kalça dikey farkı (Yataylık)
        
        // SOS ve Sınır Değişkenleri
        this.sosDurationThreshold = 2000; // Varsayılan 2 saniye
        this.sosStartTime = 0;
        this.isSosActive = false;
        
        // Aktif S.O.S özellikleri (Arayüzden güncellenir)
        this.enableHandSOS = true;
        this.enableHeadSOS = true;
        this.enableBoundary = true;
        this.boundaryDurationThreshold = 3000; // Varsayılan 3 saniye sınır dışı = alarm
        this.boundaryExitStartTime = 0; // Sınır ilk aşıldığında başlayan sayıç
        
        // Kafa Sallama (Head Shake) SOS için değişkenler
        this.noseHistory = [];
        
        // Sanal Sınır (Geofence) Kutusu (0-1 oranlı)
        this.boundary = {
            minX: 0.2, // Ekranın sol %20'sinden başlar
            maxX: 0.8, // Ekranın sağ %80'inde biter
            minY: 0.1,
            maxY: 0.9
        };

        this.intervalId = null;
        this.initMediaPipe();
    }

    start() {
        if (this.intervalId) return;
        // Grafiği ve Işığı periyodik güncellemek için
        this.intervalId = setInterval(() => {
            if (this.dashboard && this.isPersonDetected) {
                this.dashboard.updateChart(this.movementScore);
                this.movementScore = Math.max(0, this.movementScore - 20);
            }
            this.checkLightLevel();
        }, 1000); // 1 saniyede bir çalışır
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    // Arayüzden gelen dinamik ayarları uygular
    updateSettings(inactivitySec, sosSec, enableHand, enableHead, enableBoundary, boundaryDurationSec, boundaryMarginH, boundaryMarginV) {
        this.inactivityThreshold = inactivitySec * 1000;
        this.sosDurationThreshold = sosSec * 1000;
        this.enableHandSOS = enableHand !== undefined ? enableHand : true;
        this.enableHeadSOS = enableHead !== undefined ? enableHead : true;
        this.enableBoundary = enableBoundary !== undefined ? enableBoundary : true;
        this.boundaryDurationThreshold = (boundaryDurationSec || 3) * 1000;

        // Kenar paylarını 0-1 oranlı sınır kutusuna çevir
        const mH = Math.min(49, Math.max(0, boundaryMarginH || 20)) / 100;
        const mV = Math.min(49, Math.max(0, boundaryMarginV || 10)) / 100;
        this.boundary = { minX: mH, maxX: 1 - mH, minY: mV, maxY: 1 - mV };

        if (this.dashboard) {
            const handTxt = this.enableHandSOS ? 'Açık' : 'Kapalı';
            const headTxt = this.enableHeadSOS ? 'Açık' : 'Kapalı';
            const boundaryTxt = this.enableBoundary ? `Açık (${boundaryDurationSec || 3}sn, Y:%${boundaryMarginH||20} D:%${boundaryMarginV||10})` : 'Kapalı';
            this.dashboard.addLog('info', `AI Ayarları Güncellendi → El SOS: ${handTxt} | Kafa SOS: ${headTxt} | Sınır: ${boundaryTxt}`);
        }
    }

    initMediaPipe() {
        this.pose = new Pose({locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
        }});

        this.pose.setOptions({
            modelComplexity: 1,
            smoothLandmarks: true,
            enableSegmentation: false,
            smoothSegmentation: false,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });

        this.pose.onResults(this.onResults.bind(this));
        
        document.getElementById('ai_status').innerText = 'Hazır';
        document.getElementById('ai_status').className = 'value text-safe';
    }

    async analyzeFrame(videoElement) {
        // Görüntüyü canvas'a da çizelim ki hem MediaPipe kullansın hem de biz ışık analizine bakalım
        this.canvasCtx.drawImage(videoElement, 0, 0, this.canvasElement.width, this.canvasElement.height);
        await this.pose.send({image: videoElement});
    }

    checkLightLevel() {
        if (!this.canvasCtx) return;
        
        try {
            // Sadece küçük bir orta bölümden örneklem almak yeterlidir (performans için)
            const imgData = this.canvasCtx.getImageData(0, 0, this.canvasElement.width, this.canvasElement.height);
            const data = imgData.data;
            let sum = 0;
            let count = 0;
            
            // Piksellerin RGB değerlerinin ortalaması (Performans için i += 40 yapıyoruz, yani her 10 pikselden 1'ine bakıyoruz)
            for (let i = 0; i < data.length; i += 40) {
                sum += (data[i] + data[i+1] + data[i+2]) / 3;
                count++;
            }
            
            const avgBrightness = sum / count;
            
            // Eğer parlaklık çok düşükse (örn: 30'un altı)
            if (avgBrightness < 30) {
                this.alertSystem.setWarning('Düşük Işık: Kamera görüşü yetersiz olabilir.');
            }
        } catch(e) {
            // Cross-origin hatası olabilir local dosyadan test ederken.
        }
    }

    onResults(results) {
        this.canvasCtx.save();
        this.canvasCtx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);
        
        // Hata ayıklama için kamera görüntüsünü canvas'a da çizebiliriz (opsiyonel)
        // this.canvasCtx.drawImage(results.image, 0, 0, this.canvasElement.width, this.canvasElement.height);

        if (results.poseLandmarks) {
            this.isPersonDetected = true;
            document.getElementById('movement_status').innerText = 'Kişi Algılandı';
            
            // Sanal Sınırı Çiz
            this.canvasCtx.strokeStyle = 'rgba(255, 255, 0, 0.5)'; // Yarı şeffaf sarı
            this.canvasCtx.lineWidth = 2;
            this.canvasCtx.setLineDash([10, 10]); // Kesikli çizgi
            const bWidth = (this.boundary.maxX - this.boundary.minX) * this.canvasElement.width;
            const bHeight = (this.boundary.maxY - this.boundary.minY) * this.canvasElement.height;
            const bX = this.boundary.minX * this.canvasElement.width;
            const bY = this.boundary.minY * this.canvasElement.height;
            this.canvasCtx.strokeRect(bX, bY, bWidth, bHeight);
            this.canvasCtx.setLineDash([]); // Normale dön

            // Çizim
            drawConnectors(this.canvasCtx, results.poseLandmarks, POSE_CONNECTIONS,
                           {color: '#00FF00', lineWidth: 4});
            drawLandmarks(this.canvasCtx, results.poseLandmarks,
                          {color: '#FF0000', lineWidth: 2});

            this.checkMovementAndFall(results.poseLandmarks);
            this.checkSOSAndBoundary(results.poseLandmarks);
        } else {
            this.isPersonDetected = false;
            document.getElementById('movement_status').innerText = 'Kişi Yok';
            this.lastMoveTime = Date.now(); // Kişi yoksa hareketsizlik sayacı sıfırlanır
            this.alertSystem.setWarning('Kamera açısında kimse yok.');
        }
        
        this.canvasCtx.restore();
    }

    checkMovementAndFall(landmarks) {
        // İlgili eklem noktaları
        const leftShoulder = landmarks[11];
        const rightShoulder = landmarks[12];
        const leftHip = landmarks[23];
        const rightHip = landmarks[24];

        // Ortalama omuz yüksekliği (0 en üst, 1 en alt)
        const currentShoulderY = (leftShoulder.y + rightShoulder.y) / 2;
        const currentHipY = (leftHip.y + rightHip.y) / 2;

        const now = Date.now();
        const deltaTime = now - this.lastFrameTime || 1; // ms cinsinden süre farkı
        this.lastFrameTime = now;

        // Dikey hız (Velocity) = Mesafe / Zaman
        const distanceY = currentShoulderY - this.lastShoulderY;
        const velocityY = distanceY / deltaTime; 

        // 1. DÜŞME TESPİTİ (Yüksek Risk)
        // Omuzlar aniden çok hızlı aşağı indiyse VE (hemen ardından/şu an) yatay bir pozisyona geçildiyse
        const verticalDistance = Math.abs(currentShoulderY - currentHipY);
        const isHorizontal = verticalDistance < this.fallHorizontalThreshold; // Omuz ve kalça aynı hizada -> Yatıyor
        const isFallingFast = velocityY > this.fallVelocityThreshold; // Pozitif hız = aşağı doğru hareket
        
        if (isHorizontal && isFallingFast) {
            // Şiddetli Düşme!
            this.alertSystem.setDanger('ANİ DÜŞME ALGILANDI (Yüksek İvme)!');
            this.lastMoveTime = now;
            this.movementScore = 100; // Şiddetli hareket
            this.lastShoulderY = currentShoulderY;
            return;
        } else if (isHorizontal && !this.alertSystem.isAlarming) {
            // Yavaş uzanma veya yerde sabit kalma
            // Bunu sadece uzun süre hareketsizlik ile birleştirebiliriz veya orta risk verebiliriz
            // Yere uzanmak normalde her zaman tehlikeli kabul edilebilir, yatalak hastada yatmak normaldir.
            // O yüzden ivmesiz yataylığa anında alarm çalmıyoruz.
        }

        // 2. HAREKETSİZLİK TESPİTİ (Orta Risk)
        const moveDelta = Math.abs(currentShoulderY - this.lastShoulderY);
        
        if (moveDelta > 0.01) { // Yeterli hareket var
            this.lastMoveTime = now;
            this.alertSystem.setSafe();
            // Harekete bağlı skoru artır (Maks 100)
            this.movementScore = Math.min(100, this.movementScore + (moveDelta * 1000));
        } else {
            // Hareket yok, süreyi kontrol et
            if (now - this.lastMoveTime > this.inactivityThreshold) {
                this.alertSystem.setWarning('UZUN SÜRE HAREKETSİZLİK!');
                this.movementScore = 0;
            } else {
                if(!this.alertSystem.isAlarming) {
                   this.alertSystem.setSafe();
                }
            }
        }

        this.lastShoulderY = currentShoulderY;
    }

    checkSOSAndBoundary(landmarks) {
        const now = Date.now();
        
        const nose = landmarks[0]; // Burun noktası (Kafa sallama için)
        const leftShoulder = landmarks[11];
        const rightShoulder = landmarks[12];
        const leftWrist = landmarks[15];
        const rightWrist = landmarks[16];
        const leftHip = landmarks[23];
        const rightHip = landmarks[24];

        // 1. S.O.S (EL KALDIRMA) KONTROLÜ
        if (this.enableHandSOS) {
            // Bilekler omuzlardan belirgin derecede yüksekteyse (y değeri daha küçükse)
            const isLeftHandUp = leftWrist.y < leftShoulder.y - 0.1;
            const isRightHandUp = rightWrist.y < rightShoulder.y - 0.1;

            if (isLeftHandUp || isRightHandUp) {
                if (this.sosStartTime === 0) {
                    this.sosStartTime = now;
                } else if (now - this.sosStartTime > this.sosDurationThreshold) { 
                    this.alertSystem.setDanger('S.O.S - HASTA YARDIM İSTİYOR! (El Kaldırma)');
                    this.isSosActive = true;
                    this.movementScore = 100;
                }
            } else {
                this.sosStartTime = 0;
                this.isSosActive = false;
            }
        } else {
            this.sosStartTime = 0;
            this.isSosActive = false;
        }

        // 2. S.O.S (KAFA SALLAMA - FELÇLİ HASTALAR İÇİN)
        if (this.enableHeadSOS && nose) {
            // Burun koordinatını ve zamanı kaydet
            this.noseHistory.push({ x: nose.x, time: now });
            
            // Son 2 saniye (2000ms) dışındaki eski verileri sil
            this.noseHistory = this.noseHistory.filter(item => now - item.time < 2000);
            
            if (this.noseHistory.length > 10 && !this.isSosActive) {
                let directionChanges = 0;
                let lastDirection = 0; // 1 sağ, -1 sol
                let minX = this.noseHistory[0].x;
                let maxX = this.noseHistory[0].x;

                // Geçmişi tarayıp min, max ve yön değişimlerini hesapla
                for (let i = 1; i < this.noseHistory.length; i++) {
                    const prev = this.noseHistory[i-1];
                    const curr = this.noseHistory[i];
                    
                    if (curr.x < minX) minX = curr.x;
                    if (curr.x > maxX) maxX = curr.x;
                    
                    const deltaX = curr.x - prev.x;
                    // Çok küçük titremeleri yoksay (gürültü engelleme)
                    if (Math.abs(deltaX) > 0.005) {
                        const currentDirection = Math.sign(deltaX);
                        if (lastDirection !== 0 && currentDirection !== lastDirection) {
                            directionChanges++;
                        }
                        lastDirection = currentDirection;
                    }
                }

                // Eğer burun en az %4'lük bir genişlikte (maxX - minX > 0.04) hareket ettiyse
                // ve en az 4 kez (sağ-sol-sağ-sol) yön değiştirdiyse
                if ((maxX - minX) > 0.04 && directionChanges >= 4) {
                    this.alertSystem.setDanger('S.O.S - HASTA YARDIM İSTİYOR! (Kafa Sallama)');
                    this.isSosActive = true;
                    this.movementScore = 100;
                    this.noseHistory = []; // Tetiklendikten sonra geçmişi temizle
                }
            }
        } else if (!this.enableHeadSOS) {
             this.noseHistory = []; // Özellik kapalıysa hafızayı temiz tut
        }

        // 3. SANAL SINIR (YATAKTAN ÇIKIŞ) KONTROLÜ
        if (this.enableBoundary) {
            // Omuzlar veya kalça sınır kutusunun dışına çıktı mı?
            const checkPointOut = (point) => {
                return point.x < this.boundary.minX || point.x > this.boundary.maxX ||
                       point.y < this.boundary.minY || point.y > this.boundary.maxY;
            };

            const isOutsideBoundary = checkPointOut(leftShoulder) || checkPointOut(rightShoulder) ||
                                      checkPointOut(leftHip) || checkPointOut(rightHip);

            if (isOutsideBoundary) {
                // Sınır ilk aşılıyorsa sayıcıyı başlat
                if (this.boundaryExitStartTime === 0) {
                    this.boundaryExitStartTime = now;
                } else if (now - this.boundaryExitStartTime > this.boundaryDurationThreshold) {
                    // Belirlenen süre doldu, alarm ver
                    if (!this.alertSystem.isAlarming && !this.isSosActive) {
                        this.alertSystem.setDanger('SINIR İHLALİ: Hasta yataktan çıktı veya bölgeden ayrılıyor!');
                        this.movementScore = 100;
                    }
                }
            } else {
                // Geri döndü, sayıcıyı sıfırla
                this.boundaryExitStartTime = 0;
            }
        } else {
            this.boundaryExitStartTime = 0;
        }
    }
}
