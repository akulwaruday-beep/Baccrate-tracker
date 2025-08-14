let history = [];
let shoe = [];
let cardsPerDeck = 52;
let decks = 8;

function initShoe() {
    shoe = [];
    const suits = ['♠', '♥', '♦', '♣'];
    for (let d = 0; d < decks; d++) {
        for (let s of suits) {
            for (let v = 1; v <= 13; v++) {
                shoe.push(v);
            }
        }
    }
    updateCountInfo();
}

function recordResult(result) {
    history.push(result);
    updateRoadmaps();
    drawRandomCards();
}

function updateRoadmaps() {
    document.getElementById('big-road').innerHTML = history.join(' ');
    document.getElementById('bead-plate').innerHTML = history.map(r => `<div>${r}</div>`).join('');
}

function undo() {
    history.pop();
    updateRoadmaps();
}

function resetGame() {
    history = [];
    initShoe();
    updateRoadmaps();
}

function drawRandomCards() {
    // Baccarat draws 4 cards per round
    for (let i = 0; i < 4; i++) {
        let cardIndex = Math.floor(Math.random() * shoe.length);
        shoe.splice(cardIndex, 1);
    }
    updateCountInfo();
}

function updateCountInfo() {
    let remaining = shoe.length;
    document.getElementById('remaining-cards').innerText = remaining;

    // Simple odds estimation
    let playerOdds = (remaining / (decks * cardsPerDeck)) * 50;
    let bankerOdds = (remaining / (decks * cardsPerDeck)) * 50;
    let tieOdds = 100 - (playerOdds + bankerOdds);

    document.getElementById('player-percent').innerText = playerOdds.toFixed(1);
    document.getElementById('banker-percent').innerText = bankerOdds.toFixed(1);
    document.getElementById('tie-percent').innerText = tieOdds.toFixed(1);
}

initShoe();
