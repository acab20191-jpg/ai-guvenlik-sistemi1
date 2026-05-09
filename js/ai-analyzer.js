class AIAnalyzer {
      constructor(videoElement, canvasElement, alertSystem, dashboard) {
                this.videoElement = videoElement;
                this.canvasElement = canvasElement;
                this.canvasCtx = canvasElement.getContext('2d');
                this.alertSystem = alertSystem;
                this.dashboard = dashboard;
                this.pose = null;
                this.lastMoveTime = Date.now();
                this.lastFrameTime = Date.now();
                this.lastShoulderY = 0;
                this.isPersonDetected = false;
                this.movementScore = 0;
                this.inactivityThreshold = 10000;
                this.fallVelocityThreshold = 0.0005;
                this.fallHorizontalThreshold = 0.15;
                this.sosDurationThreshold = 2000;
                this.sosStartTime = 0;
                this.isSosActive = false;
                this.enableHandSOS = true;
                this.enableHeadSOS = true;
                this.enableBoundary = true;
                this.boundaryDurationThreshold = 3000;
                this.boundaryExitStartTime = 0;
                this.noseHistory = [];
                this.boundary = { minX: 0.2, maxX: 0.8, minY: 0.1, maxY: 0.9 };
                this.intervalId = null;
                this.initMediaPipe();
      }
      start() {
                if (this.intervalId) return;
                this.intervalId = setInterval(() => {
                              if (this.dashboard && this.isPersonDetected) {
                                                this.dashboard.updateChart(this.movementScore);
                                                this.movementScore = Math.max(0, this.movementScore - 20);
                              }
                              this.checkLightLevel();
                }, 1000);
      }
      stop() {
                if (this.intervalId) { clearInterval(this.intervalId); this.intervalId = null; }
      }
      updateSettings(inactivitySec, sosSec, enableHand, enableHead, enableBoundary, boundaryDurationSec, boundaryMarginH, boundaryMarginV) {
                this.inactivityThreshold = inactivitySec * 1000;
                this.sosDurationThreshold = sosSec * 1000;
                this.enableHandSOS = enableHand !== undefined ? enableHand : true;
                this.enableHeadSOS = enableHead !== undefined ? enableHead : true;
                this.enableBoundary = enableBoundary !== undefined ? enableBoundary : true;
                this.boundaryDurationThreshold = (boundaryDurationSec || 3) * 1000;
                const mH = Math.min(49, Math.max(0, boundaryMarginH || 20)) / 100;
                const mV = Math.min(49, Math.max(0, boundaryMarginV || 10)) / 100;
                this.boundary = { minX: mH, maxX: 1 - mH, minY: mV, maxY: 1 - mV };
                if (this.dashboard) { this.dashboard.addLog('info', 'AI Ayarlari Guncellendi.'); }
      }
      initMediaPipe() {
                this.pose = new Pose({ locateFile: (file) => 'https://cdn.jsdelivr.net/npm/@mediapipe/pose/' + file });
                this.pose.setOptions({ modelComplexity: 1, smoothLandmarks: true, enableSegmentation: false, smoothSegmentation: false, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
                this.pose.onResults(this.onResults.bind(this));
                const statusEl = document.getElementById('ai_status');
                if (statusEl) { statusEl.innerText = 'Hazir'; statusEl.className = 'value text-safe'; }
      }
      async analyzeFrame(videoElement) {
                this.canvasCtx.drawImage(videoElement, 0, 0, this.canvasElement.width, this.canvasElement.height);
                await this.pose.send({ image: videoElement });
      }
      checkLightLevel() {
                if (!this.canvasCtx) return;
                try {
                              const imgData = this.canvasCtx.getImageData(0, 0, this.canvasElement.width, this.canvasElement.height);
                              const data = imgData.data;
                              let sum = 0, count = 0;
                              for (let i = 0; i < data.length; i += 40) { sum += (data[i] + data[i+1] + data[i+2]) / 3; count++; }
                              const avgBrightness = sum / count;
                              if (avgBrightness < 30) { this.alertSystem.setWarning('Ortam cok karanlik! Kamera goruntusunu kontrol edin.'); }
                } catch (e) {}
      }
      onResults(results) {
                this.canvasCtx.save();
                this.canvasCtx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);
                if (results.poseLandmarks) {
                              drawConnectors(this.canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, { color: '#00FF00', lineWidth: 2 });
                              drawLandmarks(this.canvasCtx, results.poseLandmarks, { color: '#FF0000', lineWidth: 1, radius: 3 });
                              this.isPersonDetected = true;
                              const now = Date.now();
                              const landmarks = results.poseLandmarks;
                              const leftShoulder = landmarks[11];
                              const rightShoulder = landmarks[12];
                              const leftHip = landmarks[23];
                              const rightHip = landmarks[24];
                              if (leftShoulder && rightShoulder && leftHip && rightHip) {
                                                this.checkMovementAndFall(landmarks, now);
                                                this.checkSOSAndBoundary(landmarks, now);
                              }
                              this.drawBoundaryBox();
                } else {
                              this.isPersonDetected = false;
                              const statusEl = document.getElementById('person_status');
                              if (statusEl) { statusEl.innerText = 'Tespit Edilemedi'; statusEl.className = 'value text-warning'; }
                }
                this.canvasCtx.restore();
      }
      drawBoundaryBox() {
                const b = this.boundary;
                const w = this.canvasElement.width;
                const h = this.canvasElement.height;
                this.canvasCtx.strokeStyle = 'rgba(255, 220, 0, 0.8)';
                this.canvasCtx.lineWidth = 2;
                this.canvasCtx.setLineDash([8, 4]);
                this.canvasCtx.strokeRect(b.minX * w, b.minY * h, (b.maxX - b.minX) * w, (b.maxY - b.minY) * h);
                this.canvasCtx.setLineDash([]);
      }
      checkMovementAndFall(landmarks, now) {
                const leftShoulder = landmarks[11];
                const rightShoulder = landmarks[12];
                const leftHip = landmarks[23];
                const rightHip = landmarks[24];
                const currentShoulderY = (leftShoulder.y + rightShoulder.y) / 2;
                const deltaTime = now - this.lastFrameTime;
                this.lastFrameTime = now;
                if (deltaTime > 0 && this.lastShoulderY !== 0) {
                              const velocity = (currentShoulderY - this.lastShoulderY) / deltaTime;
                              const shoulderHipDiff = Math.abs((leftShoulder.y + rightShoulder.y) / 2 - (leftHip.y + rightHip.y) / 2);
                              if (velocity > this.fallVelocityThreshold && shoulderHipDiff < this.fallHorizontalThreshold) {
                                                this.alertSystem.setDanger('DUSME ALGILANDI! Hasta yere dustu olabilir!');
                                                this.movementScore = 100;
                              }
                }
                const moveDelta = Math.abs(currentShoulderY - this.lastShoulderY);
                if (moveDelta > 0.01) {
                              this.lastMoveTime = now;
                              this.alertSystem.setSafe();
                              this.movementScore = Math.min(100, this.movementScore + (moveDelta * 1000));
                } else {
                              if (now - this.lastMoveTime > this.inactivityThreshold) {
                                                this.alertSystem.setWarning('UZUN SURE HAREKETSIZLIK!');
                                                this.movementScore = 0;
                              } else { if (!this.alertSystem.isAlarming) { this.alertSystem.setSafe(); } }
                }
                this.lastShoulderY = currentShoulderY;
      }
      checkSOSAndBoundary(landmarks, now) {
                const nose = landmarks[0];
                const leftShoulder = landmarks[11];
                const rightShoulder = landmarks[12];
                const leftWrist = landmarks[15];
                const rightWrist = landmarks[16];
                const leftHip = landmarks[23];
                const rightHip = landmarks[24];
                if (this.enableHandSOS) {
                              const isLeftHandUp = leftWrist.y < leftShoulder.y - 0.1;
                              const isRightHandUp = rightWrist.y < rightShoulder.y - 0.1;
                              if (isLeftHandUp || isRightHandUp) {
                                                if (this.sosStartTime === 0) { this.sosStartTime = now; }
                                                else if (now - this.sosStartTime > this.sosDurationThreshold) { this.alertSystem.setDanger('S.O.S - HASTA YARDIM ISTIYOR! (El Kaldirma)'); this.isSosActive = true; this.movementScore = 100; }
                              } else { this.sosStartTime = 0; this.isSosActive = false; }
                } else { this.sosStartTime = 0; this.isSosActive = false; }
                if (this.enableHeadSOS && nose) {
                              this.noseHistory.push({ x: nose.x, time: now });
                              this.noseHistory = this.noseHistory.filter(item => now - item.time < 2000);
                              if (this.noseHistory.length > 10 && !this.isSosActive) {
                                                let directionChanges = 0, lastDirection = 0;
                                                let minX = this.noseHistory[0].x, maxX = this.noseHistory[0].x;
                                                for (let i = 1; i < this.noseHistory.length; i++) {
                                                                      const prev = this.noseHistory[i-1], curr = this.noseHistory[i];
                                                                      if (curr.x < minX) minX = curr.x;
                                                                      if (curr.x > maxX) maxX = curr.x;
                                                                      const deltaX = curr.x - prev.x;
                                                                      if (Math.abs(deltaX) > 0.005) {
                                                                                                const currentDirection = Math.sign(deltaX);
                                                                                                if (lastDirection !== 0 && currentDirection !== lastDirection) { directionChanges++; }
                                                                                                lastDirection = currentDirection;
                                                                      }
                                                }
                                                if ((maxX - minX) > 0.04 && directionChanges >= 4) {
                                                                      this.alertSystem.setDanger('S.O.S - HASTA YARDIM ISTIYOR! (Kafa Sallama)');
                                                                      this.isSosActive = true; this.movementScore = 100; this.noseHistory = [];
                                                }
                              }
                } else if (!this.enableHeadSOS) { this.noseHistory = []; }
                if (this.enableBoundary) {
                              const checkPointOut = (p) => p.x < this.boundary.minX || p.x > this.boundary.maxX || p.y < this.boundary.minY || p.y > this.boundary.maxY;
                  
                              const isOutside = checkPointOut(leftShoulder) || checkPointOut(rightShoulder) || checkPointOut(leftHip) || checkPointOut(rightHip);
                              if (isOutside) {
                                                if (this.boundaryExitStartTime === 0) { this.boundaryExitStartTime = now; }
                                                else if (now - this.boundaryExitStartTime > this.boundaryDurationThreshold) {
                                                                      if (!this.alertSystem.isAlarming && !this.isSosActive) { this.alertSystem.setDanger('SINIR IHLALI: Hasta yataktan cikti!'); this.movementScore = 100; }
                                                }
                              } else { this.boundaryExitStartTime = 0; }
                } else { this.boundaryExitStartTime = 0; }
      }
}
