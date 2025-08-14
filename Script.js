function getSimulationCount(cardsRemaining, totalCards) {
  const progress = 1 - cardsRemaining / totalCards; // 0 at start, 1 at end
  const minSim = 500;  // fast early in the shoe
  const maxSim = 5000; // super accurate near the end
  return Math.round(minSim + (maxSim - minSim) * Math.pow(progress, 2));
}/ ------------------------------
// Baccarat Predictor (Qumera-style)
// ------------------------------

const cardsTotalEl   = document.getElementById("cardsTotal");
const simRoundsEl    = document.getElementById("simRounds");
const simRoundsValEl = document.getElementById("simRoundsVal");
const cardsInputEl   = document.getElementById("cardsInput");
const applyCardsBtn  = document.getElementById("applyCards");
const undoCardBtn    = document.getElementById("undoCard");
const remainingEl    = document.getElementById("remaining");
const playNumEl      = document.getElementById("playNum");
const oddBEl         = document.getElementById("oddBanker");
const oddPEl         = document.getElementById("oddPlayer");
const oddTEl         = document.getElementById("oddTie");
const bestBetEl      = document.getElementById("bestBet");
const confEl         = document.getElementById("confidence");
const beadEl         = document.getElementById("bead");
const historyTextEl  = document.getElementById("historyText");

// Quick keypad
document.querySelectorAll(".keypad button[data-val]").forEach(btn=>{
  btn.addEventListener("click",()=>{
    cardsInputEl.value += (cardsInputEl.value.trim() ? " " : "") + btn.dataset.val;
  });
});
document.getElementById("keyClear").onclick = ()=> cardsInputEl.value = "";
document.getElementById("keyBack").onclick  = ()=>{
  let t = cardsInputEl.value.trim().split(/\s+/);
  t.pop(); cardsInputEl.value = t.join(" ").trim();
};

// History of results (P/B/T)
let history = [];

// Shoe card-value counts: index 0..9
let counts = Array(10).fill(0);
let totalCards = parseInt(cardsTotalEl.value, 10);

// initialize counts for given shoe size
function resetCounts() {
  const decks = totalCards / 52;
  // per deck: values 1..9 → 4 each; value 0 (10,J,Q,K) → 16
  counts = Array(10).fill(0);
  for (let v=1; v<=9; v++) counts[v] = 4 * decks;
  counts[0] = 16 * decks;
  // apply already-entered cards if any
  appliedCards = [];
  updateStats();
}

let appliedCards = []; // list of values 0..9 applied to shoe

// parse textarea into array of 0..9
function parseInputToValues() {
  const raw = cardsInputEl.value.trim();
  if (!raw) return [];
  return raw.split(/\s*/).join("")       // allow people to paste 03670...
           .split("")                    // each char
           .filter(ch => /[0-9]/.test(ch))
           .map(ch => parseInt(ch,10));
}

// apply input values to counts (decrement), ignoring impossible subtractions
function applyInput() {
  const vals = parseInputToValues();
  for (const v of vals) {
    if (counts[v] > 0) {
      counts[v]--;
      appliedCards.push(v);
    }
  }
  cardsInputEl.value = ""; // clear box after applying
  updateStats();
  simulateAndUpdate();
}

function undoLastCard() {
  const v = appliedCards.pop();
  if (v !== undefined) counts[v]++; // put it back
  updateStats();
  simulateAndUpdate();
}

applyCardsBtn.addEventListener("click", applyInput);
undoCardBtn.addEventListener("click", undoLastCard);

cardsTotalEl.addEventListener("change", ()=>{
  totalCards = parseInt(cardsTotalEl.value,10);
  resetCounts();
  simulateAndUpdate();
});

simRoundsEl.addEventListener("input", ()=>{
  simRoundsValEl.textContent = Number(simRoundsEl.value).toLocaleString();
});
simRoundsEl.addEventListener("change", simulateAndUpdate);

// Result history buttons
document.querySelectorAll(".btn.hist").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    history.push(btn.dataset.res); // 'P' | 'B' | 'T'
    renderHistory();
    simulateAndUpdate(); // update "AI-style" prediction weighting
  });
});
document.getElementById("undoRes").addEventListener("click", ()=>{
  history.pop();
  renderHistory();
  simulateAndUpdate();
});

function renderHistory() {
  historyTextEl.textContent = history.length ? history.join(" ") : "—";
  // draw bead
  beadEl.innerHTML = "";
  history.forEach(h=>{
    const dot = document.createElement("div");
    dot.className = `dot ${h}`;
    beadEl.appendChild(dot);
  });
}

function updateStats() {
  const rem = counts.reduce((a,b)=>a+b,0);
  remainingEl.textContent = rem;
  // approx play number: every round uses 4–6+ cards; show “entered cards / 4”
  const played = appliedCards.length;
  playNumEl.textContent = Math.max(0, Math.floor(played / 4));
}

// ------------------------------
// Baccarat rules helpers
// ------------------------------
function drawOne(rng, cts){
  // Draw a value respecting remaining counts; returns value and decrements
  const total = cts.reduce((a,b)=>a+b,0);
  const r = rng()*total;
  let acc=0;
  for (let v=0; v<=9; v++){
    acc += cts[v];
    if (r < acc) { cts[v]--; return v; }
  }
  // should not happen
  return 0;
}
function handTotal(vals){ return vals.reduce((s,v)=> (s+v)%10, 0); }

// Banker/Player third-card rules per standard baccarat
function shouldPlayerDraw(pTotal){ return pTotal<=5; }
function bankerDraws(bTotal, pThird){
  if (pThird===null){ return bTotal<=5; } // if player stood
  // banker table
  if (bTotal<=2) return true;
  if (bTotal===3) return pThird!==8;
  if (bTotal===4) return (pThird>=2 && pThird<=7);
  if (bTotal===5) return (pThird>=4 && pThird<=7);
  if (bTotal===6) return (pThird===6 || pThird===7);
  return false; // 7 stands; 8–9 natural handled earlier
}

// ------------------------------
// Monte-Carlo simulation using current shoe composition
// ------------------------------
function simulate(rounds){
  // clone counts
  const base = counts.slice();
  let b=0,p=0,t=0;

  // simple seeded RNG for consistency per run
  let seed = 1234567 ^ base.reduce((a,x)=>a+(x<<1),0);
  const rng = ()=> (seed = (seed*1664525 + 1013904223) >>> 0, (seed & 0xffffffff) / 2**32);

  for (let r=0;r<rounds;r++){
    // copy counts for the round so we don't mutate the shoe permanently
    const cts = base.slice();
    // If the shoe is almost empty, break
    if (cts.reduce((a,b)=>a+b,0) < 6) break;

    const p1 = drawOne(rng, cts), p2 = drawOne(rng, cts);
    const b1 = drawOne(rng, cts), b2 = drawOne(rng, cts);

    let pt = handTotal([p1,p2]);
    let bt = handTotal([b1,b2]);

    // natural
    if (pt>=8 || bt>=8){
      if (pt>bt) p++; else if (bt>pt) b++; else t++;
      continue;
    }

    // player third card
    let p3 = null;
    if (shouldPlayerDraw(pt)){
      p3 = drawOne(rng, cts);
      pt = handTotal([p1,p2,p3]);
    }

    // banker third card
    let b3 = null;
    if (bankerDraws(bt, p3)){
      b3 = drawOne(rng, cts);
      bt = handTotal([b1,b2,b3]);
    }

    if (pt>bt) p++; else if (bt>pt) b++; else t++;
  }

  const total = b+p+t || 1;
  return {banker:b/total, player:p/total, tie:t/total};
}

// ------------------------------
// AI-style next prediction
// (pattern match last 3 + probability weighting)
// ------------------------------
function aiNextSuggestion(prob, hist){
  // base scores from shoe probabilities
  const base = { B: prob.banker, P: prob.player, T: prob.tie };

  // pattern boost: look at last 3 and see what followed before
  const boost = { B:0, P:0, T:0 };
  if (hist.length >= 4){
    const last3 = hist.slice(-3).join("");
    for (let i=0;i<=hist.length-4;i++){
      if (hist.slice(i,i+3).join("") === last3){
        const nxt = hist[i+3];
        boost[nxt] += 1;
      }
    }
  }

  // normalize boosts and blend (70% shoe, 30% pattern)
  const sumBoost = boost.B + boost.P + boost.T || 1;
  const blended = {
    B: 0.7*base.B + 0.3*(boost.B/sumBoost),
    P: 0.7*base.P + 0.3*(boost.P/sumBoost),
    T: 0.7*base.T + 0.3*(boost.T/sumBoost)
  };

  // pick best + confidence
  const entries = Object.entries(blended).sort((a,b)=>b[1]-a[1]);
  const [bestKey,bestVal] = entries[0];
  const secondVal = entries[1][1];
  const conf = Math.max(0, bestVal - secondVal); // margin as confidence
  const map = {B:"Banker", P:"Player", T:"Tie"};
  return { best: map[bestKey], conf: conf };
}

// ------------------------------
// Wiring everything together
// ------------------------------
function simulateAndUpdate(){
  const rounds = parseInt(simRoundsEl.value,10);
  const prob = simulate(rounds);

  // show odds (as decimals/probabilities with 3 decimals)
  oddBEl.textContent = prob.banker.toFixed(3);
  oddPEl.textContent = prob.player.toFixed(3);
  oddTEl.textContent = prob.tie.toFixed(3);

  const sugg = aiNextSuggestion(prob, history);
  bestBetEl.textContent = sugg.best || "—";
  // confidence as percentage from 0..100 (margin * 100)
  confEl.textContent = `confidence: ${(sugg.conf*100).toFixed(1)}%`;
}

// initial
resetCounts();
renderHistory();
simulateAndUpdate();
