class Dashboard {
    constructor() {
        this.logList = document.getElementById('log_list');
        this.chartCanvas = document.getElementById('movement_chart');
        this.chart = null;
        
        // Grafik verileri (son 30 saniye/nokta)
        this.maxDataPoints = 30;
        this.chartData = {
            labels: Array(this.maxDataPoints).fill(''),
            datasets: [{
                label: 'Hareketlilik Skoru',
                data: Array(this.maxDataPoints).fill(0),
                borderColor: '#2563eb',
                backgroundColor: 'rgba(37, 99, 235, 0.2)',
                borderWidth: 2,
                fill: true,
                tension: 0.4 // Yumuşak çizgiler
            }]
        };

        this.initChart();
        this.logList.innerHTML = ''; // Temizle
        this.addLog('info', 'Sistem başlatıldı, modüller yükleniyor...');
        
        // Rapor İndir Butonu Bağlantısı
        const btnDownload = document.getElementById('btn_download_report');
        if (btnDownload) {
            btnDownload.addEventListener('click', () => this.downloadReport());
        }
    }

    initChart() {
        try {
            this.chart = new Chart(this.chartCanvas, {
                type: 'line',
                data: this.chartData,
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: {
                        duration: 0 // Canlı akış için animasyonları kapat
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 100, // Maksimum hareket skoru
                            title: { display: true, text: 'Aktivite Seviyesi (%)' }
                        },
                        x: {
                            display: false // X ekseni etiketlerini gizle
                        }
                    },
                    plugins: {
                        legend: { display: false }
                    }
                }
            });
        } catch (error) {
            console.error("Chart.js yüklenemedi (İnternet bağlantısı olmayabilir):", error);
            this.chart = null;
        }
    }

    /**
     * Grafiğe yeni veri noktası ekler.
     * @param {number} score 0-100 arası hareketlilik skoru
     */
    updateChart(score) {
        if (!this.chart) return;
        
        // Veriyi kaydır
        this.chart.data.datasets[0].data.shift();
        this.chart.data.datasets[0].data.push(score);
        
        this.chart.update();
    }

    /**
     * Olay geçmişine yeni bir kayıt ekler
     * @param {string} type 'info', 'safe', 'warning', 'danger'
     * @param {string} message 
     */
    addLog(type, message) {
        const li = document.createElement('li');
        
        // Saat bilgisini al
        const now = new Date();
        const timeStr = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        
        li.innerHTML = `
            <span class="log-time">[${timeStr}]</span>
            <span class="log-type-${type}">${message}</span>
        `;
        
        // Listeye en üste ekle
        this.logList.prepend(li);
        
        // Eğer 50'den fazla log olduysa en alttakini sil
        if (this.logList.children.length > 50) {
            this.logList.removeChild(this.logList.lastChild);
        }
    }

    /**
     * Olay geçmişini .txt dosyası olarak indirir
     */
    downloadReport() {
        let reportContent = "AI GÜVENLİK SİSTEMİ - OLAY GEÇMİŞİ RAPORU\n";
        reportContent += "Tarih: " + new Date().toLocaleDateString('tr-TR') + "\n";
        reportContent += "--------------------------------------------------\n\n";

        // Logları sondan başa (eskiden yeniye) almak için NodeList'i diziye çevirip ters çevirelim
        const logs = Array.from(this.logList.children).reverse();
        
        logs.forEach(li => {
            // Span'ların text içeriklerini birleştir (örn: [14:05:30] Uyarı mesajı)
            reportContent += li.innerText.replace(/\n/g, ' ') + "\n";
        });

        // Dosyayı oluştur ve indir
        const blob = new Blob([reportContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Guvenlik_Raporu_${new Date().toISOString().slice(0,10)}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}
