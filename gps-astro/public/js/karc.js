/**
 * KARC Module — Kolmogorov-Arnold Reservoir Computing for GPS chalui
 * Ported/Inspired by Plan 308 of katgpt-rs (Zero-allocation client-side time-series forecasting)
 * 
 * Features:
 * - Delay Ring Buffer of last-K observations
 * - Chebyshev and Fourier basis expansions
 * - Client-side closed-form Ridge Regression solver
 * - Prediction of future speeds / delays at construction zones
 */

class KarcForecaster {
  constructor(k = 4, m = 4, lambda = 1e-4) {
    this.K = k; // Number of delay observations
    this.M = m; // Number of basis functions
    this.lambda = lambda; // Regularization parameter
    this.featureDim = this.K * this.M;
    
    // State per zone
    this.zonesState = {}; // { zoneId: { buffer: [], trainingData: [] } }
    this.Wout = {}; // { zoneId: Float32Array of weights }
  }

  // 1. Evaluate basis functions (Chebyshev and Fourier)
  evaluateBasis(x, basisType = 'chebyshev') {
    const basis = new Float32Array(this.M);
    // Normalize x to [-1, 1] approximately for stability
    let val = Math.max(-1, Math.min(1, x / 100)); // assumes max speed/delay around 100

    if (basisType === 'chebyshev') {
      if (this.M > 0) basis[0] = 1.0;
      if (this.M > 1) basis[1] = val;
      for (let i = 2; i < this.M; i++) {
        basis[i] = 2.0 * val * basis[i - 1] - basis[i - 2];
      }
    } else { // Fourier
      for (let i = 0; i < this.M; i++) {
        const freq = i + 1;
        basis[i] = i % 2 === 0 ? Math.cos(freq * val) : Math.sin(freq * val);
      }
    }
    return basis;
  }

  // 2. Expand delay state of last-K observations into feature space
  expandFeatures(delayState, basisType = 'chebyshev') {
    const features = new Float32Array(this.featureDim);
    for (let k = 0; k < this.K; k++) {
      const x = delayState[k] || 0;
      const b = this.evaluateBasis(x, basisType);
      for (let m = 0; m < this.M; m++) {
        features[k * this.M + m] = b[m];
      }
    }
    return features;
  }

  // 3. Observe speed at a zone and update state
  observe(zoneId, currentSpeed) {
    if (!this.zonesState[zoneId]) {
      this.zonesState[zoneId] = {
        buffer: [], // ring buffer of last K
        history: [] // pairs of (delayState, nextObservation)
      };
    }

    const state = this.zonesState[zoneId];
    
    // If the buffer is full, we can create a training pair:
    // last_K_delay_state -> currentSpeed
    if (state.buffer.length === this.K) {
      const delayCopy = [...state.buffer];
      state.history.push({ delayState: delayCopy, target: currentSpeed });
      
      // Limit history size to prevent memory growth (sliding window of 100 samples)
      if (state.history.length > 100) {
        state.history.shift();
      }
    }

    // Push to ring buffer
    state.buffer.push(currentSpeed);
    if (state.buffer.length > this.K) {
      state.buffer.shift();
    }
  }

  // 4. Solve Ridge Regression using Gaussian Elimination with partial pivoting
  solveRidge(H, Y) {
    const F = this.featureDim;
    const N = H.length; // Number of samples

    // Compute H^T * H + lambda * I
    const A = Array.from({ length: F }, () => new Float64Array(F));
    const B = new Float64Array(F);

    // Accumulate Gram matrix H^T * H and Covariance H^T * Y
    for (let n = 0; n < N; n++) {
      const hn = H[n];
      const yn = Y[n];
      for (let i = 0; i < F; i++) {
        for (let j = 0; j < F; j++) {
          A[i][j] += hn[i] * hn[j];
        }
        B[i] += hn[i] * yn;
      }
    }

    // Add regularization lambda * I
    for (let i = 0; i < F; i++) {
      A[i][i] += this.lambda;
    }

    // Solve A * Wout = B using Gaussian Elimination
    for (let p = 0; p < F; p++) {
      // Find pivot
      let maxRow = p;
      for (let r = p + 1; r < F; r++) {
        if (Math.abs(A[r][p]) > Math.abs(A[maxRow][p])) {
          maxRow = r;
        }
      }

      // Swap rows
      if (maxRow !== p) {
        const tempA = A[p]; A[p] = A[maxRow]; A[maxRow] = tempA;
        const tempB = B[p]; B[p] = B[maxRow]; B[maxRow] = tempB;
      }

      // Check singularity
      if (Math.abs(A[p][p]) < 1e-12) {
        // Singular system, return null or fallback
        return null;
      }

      // Eliminate columns
      for (let r = p + 1; r < F; r++) {
        const factor = A[r][p] / A[p][p];
        B[r] -= factor * B[p];
        for (let c = p; c < F; c++) {
          A[r][c] -= factor * A[p][c];
        }
      }
    }

    // Back substitution
    const Wout = new Float32Array(F);
    for (let i = F - 1; i >= 0; i--) {
      let sum = 0;
      for (let j = i + 1; j < F; j++) {
        sum += A[i][j] * Wout[j];
      }
      Wout[i] = (B[i] - sum) / A[i][i];
    }

    return Wout;
  }

  // 5. Fit the forecaster for a specific zone
  fit(zoneId) {
    const state = this.zonesState[zoneId];
    if (!state || state.history.length < 5) {
      // Not enough data to fit, use default (null or identity)
      return false;
    }

    const H = [];
    const Y = [];
    for (const pair of state.history) {
      const feat = this.expandFeatures(pair.delayState);
      H.push(feat);
      Y.push(pair.target);
    }

    const W = this.solveRidge(H, Y);
    if (W) {
      this.Wout[zoneId] = W;
      return true;
    }
    return false;
  }

  // 6. Forecast speed for the next step at a zone
  forecast(zoneId) {
    const state = this.zonesState[zoneId];
    if (!state || state.buffer.length < this.K) {
      return null; // Buffer not full yet
    }

    const W = this.Wout[zoneId];
    if (!W) {
      // If we haven't fitted weights yet, return the last observed speed (Naive Forecast)
      return state.buffer[state.buffer.length - 1];
    }

    // Expand current delay state to features
    const features = this.expandFeatures(state.buffer);
    
    // Compute Wout * features (zero-alloc dot product)
    let predictedSpeed = 0;
    for (let i = 0; i < this.featureDim; i++) {
      predictedSpeed += W[i] * features[i];
    }

    // Clamp predicted speed between 10 km/h and 120 km/h for safety logic
    return Math.max(10, Math.min(120, predictedSpeed));
  }
}

// Global single instance for web pages
window.karcForecaster = new KarcForecaster(4, 4, 1e-4);
