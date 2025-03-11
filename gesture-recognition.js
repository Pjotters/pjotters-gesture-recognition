// Gebruik TensorFlow.js en HandPose model
class GestureRecognition {
    constructor() {
        this.isDetecting = false;
        this.webcam = document.getElementById('webcam');
        this.canvas = document.getElementById('overlay');
        this.toggleBtn = document.getElementById('toggleBtn');
        this.resultsDiv = document.getElementById('gestureResults');
        this.model = null;
        
        this.setupCamera();
        this.setupEventListeners();
        this.loadModel();
    }

    async loadModel() {
        try {
            this.resultsDiv.innerHTML = 'Model wordt geladen...';
            this.model = await handpose.load();
            this.resultsDiv.innerHTML = 'Model geladen. Klik op Start Herkenning.';
        } catch (error) {
            console.error('Model laden mislukt:', error);
            this.resultsDiv.innerHTML = 'Model laden mislukt. Vernieuw de pagina.';
        }
    }

    async setupCamera() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { width: 640, height: 480 } 
            });
            this.webcam.srcObject = stream;
            this.canvas.width = 640;
            this.canvas.height = 480;
        } catch (error) {
            console.error('Camera toegang mislukt:', error);
            this.resultsDiv.innerHTML = 'Camera toegang is vereist voor gebarenherkenning';
        }
    }

    setupEventListeners() {
        this.toggleBtn.addEventListener('click', () => {
            this.isDetecting = !this.isDetecting;
            this.toggleBtn.textContent = this.isDetecting ? 'Stop Herkenning' : 'Start Herkenning';
            if (this.isDetecting) {
                this.detectGestures();
            }
        });
    }

    async detectGestures() {
        if (!this.isDetecting || !this.model) return;

        try {
            // Verhoog maxHands naar 2 voor betere meerdere-handen detectie
            const predictions = await this.model.estimateHands(this.webcam, {
                flipHorizontal: true, // Voor gespiegelde weergave
                maxHands: 2 // Sta maximaal 2 handen toe
            });
            
            const ctx = this.canvas.getContext('2d');
            ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            ctx.drawImage(this.webcam, 0, 0, this.canvas.width, this.canvas.height);

            if (predictions.length > 0) {
                const handGestures = predictions.map(hand => {
                    this.drawHand(hand, ctx);
                    return this.countFingers(hand);
                });
                
                this.displayResults(handGestures, predictions.length);
            } else {
                this.resultsDiv.innerHTML = '<p>Geen handen gedetecteerd</p>';
            }

            if (this.isDetecting) {
                requestAnimationFrame(() => this.detectGestures());
            }
        } catch (error) {
            console.error('Herkenning mislukt:', error);
            if (this.isDetecting) {
                setTimeout(() => this.detectGestures(), 1000);
            }
        }
    }

    countFingers(hand) {
        const fingerTips = [4, 8, 12, 16, 20];
        const fingerMids = [3, 7, 11, 15, 19];
        const fingerBases = [2, 6, 10, 14, 18];
        const palmBase = hand.landmarks[0];
        let count = 0;

        // Verbeterde vingerdetectie
        fingerTips.forEach((tipId, index) => {
            const tip = hand.landmarks[tipId];
            const mid = hand.landmarks[fingerMids[index]];
            const base = hand.landmarks[fingerBases[index]];
            
            if (index === 0) { // Duim
                const isExtended = Math.abs(tip[0] - base[0]) > 40 && 
                                 Math.abs(tip[1] - mid[1]) > 20;
                if (isExtended) count++;
            } else {
                // Voor andere vingers: check zowel y-positie als hoek
                const fingerAngle = Math.atan2(tip[1] - base[1], tip[0] - base[0]);
                const isExtended = tip[1] < base[1] - 30 && Math.abs(fingerAngle) > 0.3;
                if (isExtended) count++;
            }
        });

        // Check voor speciale gebaren als er geen vingers geteld zijn
        if (count === 0) {
            const specialGesture = this.detectSpecialGesture(hand);
            return specialGesture || "vuist";
        }

        return count;
    }

    detectSpecialGesture(hand) {
        const thumb = {
            tip: hand.landmarks[4],
            mid: hand.landmarks[3],
            base: hand.landmarks[2]
        };
        
        // Duim omhoog
        if (this.isThumbUp(thumb, hand.landmarks[0])) {
            return "duim_omhoog";
        }
        
        // Duim omlaag
        if (this.isThumbDown(thumb, hand.landmarks[0])) {
            return "duim_omlaag";
        }
        
        // Duim links
        if (this.isThumbLeft(thumb, hand.landmarks[0])) {
            return "duim_links";
        }
        
        // Duim rechts
        if (this.isThumbRight(thumb, hand.landmarks[0])) {
            return "duim_rechts";
        }
        
        return null;
    }

    isThumbUp(thumb, palm) {
        return thumb.tip[1] < palm[1] && thumb.tip[1] < thumb.base[1];
    }

    isThumbDown(thumb, palm) {
        return thumb.tip[1] > palm[1] && thumb.tip[1] > thumb.base[1];
    }

    isThumbLeft(thumb, palm) {
        // Gespiegelde logica
        return thumb.tip[0] > palm[0] + 30 && 
               Math.abs(thumb.tip[1] - palm[1]) < 50;
    }

    isThumbRight(thumb, palm) {
        // Gespiegelde logica
        return thumb.tip[0] < palm[0] - 30 && 
               Math.abs(thumb.tip[1] - palm[1]) < 50;
    }

    drawHand(hand, ctx) {
        const buttonColor = getComputedStyle(this.toggleBtn).backgroundColor;
        
        // Teken de verbindingen eerst (onder de punten)
        const fingers = [[0,1,2,3,4], [0,5,6,7,8], [0,9,10,11,12], [0,13,14,15,16], [0,17,18,19,20]];
        fingers.forEach(finger => {
            ctx.beginPath();
            ctx.moveTo(hand.landmarks[finger[0]][0], hand.landmarks[finger[0]][1]);
            for (let i = 1; i < finger.length; i++) {
                ctx.lineTo(hand.landmarks[finger[i]][0], hand.landmarks[finger[i]][1]);
            }
            ctx.strokeStyle = buttonColor;
            ctx.lineWidth = 3;
            ctx.stroke();
        });
        
        // Teken de handpunten bovenop de lijnen
        hand.landmarks.forEach(point => {
            ctx.beginPath();
            ctx.arc(point[0], point[1], 6, 0, 3 * Math.PI);
            ctx.fillStyle = buttonColor;
            ctx.fill();
        });
    }

    displayResults(handGestures, handCount) {
        this.resultsDiv.innerHTML = `
            <div class="prediction-item">
                <span class="prediction-label">Aantal handen</span>
                <div class="prediction-details">
                    <p>${handCount}</p>
                </div>
            </div>
        `;
        
        handGestures.forEach((gesture, index) => {
            const gestureText = this.getGestureText(gesture);
            this.resultsDiv.innerHTML += `
                <div class="prediction-item">
                    <span class="prediction-label">Hand ${index + 1}</span>
                    <div class="prediction-details">
                        <p>${gestureText}</p>
                    </div>
                </div>
            `;
        });
    }

    getGestureText(gesture) {
        switch(gesture) {
            case "duim_links": return "👉 Duim links"; // Gespiegeld
            case "duim_rechts": return "👈 Duim rechts"; // Gespiegeld
            case "duim_omhoog": return "👍 Duim omhoog";
            case "duim_omlaag": return "👎 Duim omlaag";
            case "vuist": return "✊ Vuist";
            default: return `${gesture} vingers`;
        }
    }
}

// Start de applicatie
document.addEventListener('DOMContentLoaded', () => {
    const gestureRecognition = new GestureRecognition();
}); 