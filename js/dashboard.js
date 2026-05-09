class Dashboard {
      constructor() {
                this.logContainer = document.getElementById('log_container');
                this.inactivityCounter = document.getElementById('inactivity_counter');
                this.sosCounter = document.getElementById('sos_counter');
                this.statusText = document.getElementById('status_text');
      }
      updateInactivity(seconds) {
                if (this.inactivityCounter) this.inactivityCounter.innerText = seconds + 's';
      }
      updateSOS(seconds) {
                if (this.sosCounter) this.sosCounter.innerText = seconds + 's';
      }
      addLog(type, message) {
                const logEntry = document.createElement('div');
                logEntry.className = 'log-entry ' + type;
                const time = new Date().toLocaleTimeString();
                logEntry.innerHTML = `<span>[${time}]</span> <span>${message}</span>`;
                if (this.logContainer) {
                              this.logContainer.prepend(logEntry);
                              if (this.logContainer.children.length > 50) {
                                                this.logContainer.removeChild(this.logContainer.lastChild);
                              }
                }
      }
}
