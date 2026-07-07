/**
 * Hodge Module — Discrete Exterior Calculus (DEC) Hodge Flow Decomposition for GPS chalui
 * Ported/Inspired by Plan 261 and Plan 314 of katgpt-rs
 * 
 * Features:
 * - Simple 2D simplicial mesh representation of Bangkok road network
 * - Calculation of boundary operators (d_0 and d_1)
 * - Hodge Decomposition: Flow = Exact (Gradient/Bottleneck) + Coexact (Rotational/Loop) + Harmonic (Transit)
 * - Hodge-adjusted routing cost logic (steer users away from loop traffic)
 */

class HodgeDecomposition {
  constructor() {
    // 1. Define nodes (vertices) of the mock road network
    this.nodes = [
      { id: 0, name: "ห้าแยกลาดพร้าว", lat: 13.8125, lng: 100.5615 },
      { id: 1, name: "แยกรัชโยธิน", lat: 13.8268, lng: 100.5683 },
      { id: 2, name: "แยกสุทธิสาร", lat: 13.7889, lng: 100.5735 },
      { id: 3, name: "แยกสะพานควาย", lat: 13.7898, lng: 100.5492 },
      { id: 4, name: "แยกด่วนวิภาวดี-สุทธิสาร", lat: 13.7885, lng: 100.5605 },
      { id: 5, name: "แยกรัชดา-ลาดพร้าว", lat: 13.8055, lng: 100.5748 },
      { id: 6, name: "แยกเกษตร", lat: 13.8402, lng: 100.5723 },
      { id: 7, name: "อนุสาวรีย์ชัยสมรภูมิ", lat: 13.7649, lng: 100.5383 }
    ];

    // 2. Define directed roads (edges)
    this.edges = [
      { id: 0, from: 0, to: 1, name: "พหลโยธิน (ลาดพร้าว -> รัชโยธิน)" },
      { id: 1, from: 1, to: 6, name: "พหลโยธิน (รัชโยธิน -> เกษตร)" },
      { id: 2, from: 1, to: 5, name: "รัชดาภิเษก (รัชโยธิน -> รัชดา-ลาดพร้าว)" },
      { id: 3, from: 5, to: 2, name: "รัชดาภิเษก (รัชดา-ลาดพร้าว -> สุทธิสาร)" },
      { id: 4, from: 2, to: 4, name: "สุทธิสารวินิจฉัย (สุทธิสาร -> วิภาวดี)" },
      { id: 5, from: 4, to: 3, name: "สุทธิสารวินิจฉัย (วิภาวดี -> สะพานควาย)" },
      { id: 6, from: 3, to: 0, name: "พหลโยธิน (สะพานควาย -> ลาดพร้าว)" },
      { id: 7, from: 0, to: 5, name: "ลาดพร้าว (ห้าแยก -> รัชดา-ลาดพร้าว)" },
      { id: 8, from: 4, to: 0, name: "วิภาวดีรังสิต (สุทธิสาร -> ลาดพร้าว)" },
      { id: 9, from: 3, to: 7, name: "พหลโยธิน (สะพานควาย -> อนุสาวรีย์)" },
      { id: 10, from: 4, to: 7, name: "วิภาวดีรังสิต (สุทธิสาร -> ดินแดง/อนุสาวรีย์)" },
      { id: 11, from: 0, to: 4, name: "วิภาวดีรังสิต (ลาดพร้าว -> สุทธิสาร)" }
    ];

    // 3. Define loops/faces (cycles) for Coexact Flow (rotational loops)
    // A loop is represented as coefficients of edges (1 if in direction of loop, -1 if reverse)
    this.faces = [
      // Loop 1: Ratchada-Sutthisan Loop (0 -> 2 -> 3 -> 4 -> 0)
      // Edges: 2 (1->5), 3 (5->2), 4 (2->4), 8 (4->0), 0 (0->1)
      {
        id: 0,
        name: "ห่วงรัชดาภิเษก-สุทธิสาร-วิภาวดี",
        edgeCoefficients: { 0: 1, 2: 1, 3: 1, 4: 1, 8: 1 }
      },
      // Loop 2: Ladprao-Sutthisan Loop (0 -> 5 -> 2 -> 4 -> 0)
      // Edges: 7 (0->5), 3 (5->2), 4 (2->4), 8 (4->0)
      {
        id: 1,
        name: "ห่วงลาดพร้าว-รัชดาภิเษก-วิภาวดี",
        edgeCoefficients: { 7: 1, 3: 1, 4: 1, 8: 1 }
      }
    ];

    this.numV = this.nodes.length;
    this.numE = this.edges.length;
    this.numF = this.faces.length;
  }

  // Linear solver for A * X = B (using simple Jacobi iteration for simplicity/robustness)
  solveLinearSystem(A, B, maxIters = 100, tolerance = 1e-6) {
    const N = B.length;
    let X = new Float64Array(N);
    let nextX = new Float64Array(N);

    for (let iter = 0; iter < maxIters; iter++) {
      let maxDiff = 0;
      for (let i = 0; i < N; i++) {
        let sum = 0;
        for (let j = 0; j < N; j++) {
          if (i !== j) {
            sum += A[i][j] * X[j];
          }
        }
        if (Math.abs(A[i][i]) > 1e-12) {
          nextX[i] = (B[i] - sum) / A[i][i];
        } else {
          nextX[i] = 0;
        }
        maxDiff = Math.max(maxDiff, Math.abs(nextX[i] - X[i]));
      }
      
      X.set(nextX);
      if (maxDiff < tolerance) break;
    }
    return X;
  }

  // Decompose traffic flow on edges: Flow = Exact + Coexact + Harmonic
  decomposeFlow(edgeFlows) {
    const E = this.numE;
    const V = this.numV;
    const F = this.numF;

    // 1. Solve for Exact Potential phi (0-form) on nodes: d0^T * d0 * phi = d0^T * w
    // d0 is |E| x |V| matrix: row e from u to v has -1 at u, 1 at v
    const d0 = Array.from({ length: E }, () => new Float64Array(V));
    for (let e = 0; e < E; e++) {
      const edge = this.edges[e];
      d0[e][edge.from] = -1.0;
      d0[e][edge.to] = 1.0;
    }

    // Compute A_V = d0^T * d0 (Laplacian on nodes) and B_V = d0^T * w
    const A_V = Array.from({ length: V }, () => new Float64Array(V));
    const B_V = new Float64Array(V);
    for (let i = 0; i < V; i++) {
      for (let j = 0; j < V; j++) {
        for (let e = 0; e < E; e++) {
          A_V[i][j] += d0[e][i] * d0[e][j];
        }
      }
      for (let e = 0; e < E; e++) {
        B_V[i] += d0[e][i] * edgeFlows[e];
      }
    }

    // Regularize A_V (Laplacian is singular, fix node 0's potential to 0)
    for (let i = 0; i < V; i++) {
      A_V[0][i] = 0;
      A_V[i][0] = 0;
    }
    A_V[0][0] = 1.0;
    B_V[0] = 0.0;

    const phi = this.solveLinearSystem(A_V, B_V);

    // Compute Exact Flow: w_exact = d0 * phi
    const w_exact = new Float64Array(E);
    for (let e = 0; e < E; e++) {
      const edge = this.edges[e];
      w_exact[e] = phi[edge.to] - phi[edge.from];
    }

    // 2. Solve for Coexact Potential psi (2-form) on faces: d1 * d1^T * psi = d1 * w
    // d1^T is |E| x |F| matrix containing loop edge coefficients
    const d1T = Array.from({ length: E }, () => new Float64Array(F));
    for (let f = 0; f < F; f++) {
      const coefficients = this.faces[f].edgeCoefficients;
      for (const eStr in coefficients) {
        d1T[parseInt(eStr)][f] = coefficients[eStr];
      }
    }

    // Compute A_F = d1 * d1^T (Laplacian on faces) and B_F = d1 * w
    const A_F = Array.from({ length: F }, () => new Float64Array(F));
    const B_F = new Float64Array(F);
    for (let i = 0; i < F; i++) {
      for (let j = 0; j < F; j++) {
        for (let e = 0; e < E; e++) {
          A_F[i][j] += d1T[e][i] * d1T[e][j];
        }
      }
      for (let e = 0; e < E; e++) {
        B_F[i] += d1T[e][i] * edgeFlows[e];
      }
    }

    const psi = this.solveLinearSystem(A_F, B_F);

    // Compute Coexact Flow: w_coexact = d1^T * psi
    const w_coexact = new Float64Array(E);
    for (let e = 0; e < E; e++) {
      for (let f = 0; f < F; f++) {
        w_coexact[e] += d1T[e][f] * psi[f];
      }
    }

    // 3. Compute Harmonic Flow: w_harmonic = w - w_exact - w_coexact
    const w_harmonic = new Float64Array(E);
    for (let e = 0; e < E; e++) {
      w_harmonic[e] = edgeFlows[e] - w_exact[e] - w_coexact[e];
    }

    return {
      phi,
      psi,
      exact: w_exact,
      coexact: w_coexact,
      harmonic: w_harmonic
    };
  }

  // Adjust cost of route planning based on coexact (rotational loop) flow density
  getHodgeAdjustedCost(edgeId, baseCost, coexactFlow) {
    // If coexact flow is high, add a heavy penalty to discourage driving in loops.
    // Exact flow (gradient) represent standard bottleneck which is already factored in.
    // Harmonic flow (transit corridors) are encouraged (cost is minimized).
    const coexactFactor = Math.abs(coexactFlow);
    
    // Loops (coexact flow) represent unnecessary congestion. Penalty coefficient:
    let penalty = 0;
    if (coexactFactor > 10) {
      penalty = coexactFactor * 1.5; // heavy penalty
    }

    return Math.max(1, baseCost + penalty);
  }
}

// Global single instance
window.hodgeDecomposition = new HodgeDecomposition();
