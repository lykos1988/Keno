let currentDrawId = null;
let selected = new Set();

function el(id){return document.getElementById(id);}
async function updateBalance() {
  const id = el('userId').value;
  const res = await fetch('/api/user/' + encodeURIComponent(id));
  const data = await res.json();
  el('balance').textContent = 'Balance: ' + data.balance;
  renderHistory(data.history || []);
}

function renderBoard(){
  const board = el('board');
  board.innerHTML = '';
  for(let i=1;i<=80;i++){
    const d = document.createElement('div');
    d.className='cell';
    d.textContent = i;
    d.dataset.val = i;
    d.addEventListener('click', ()=> {
      const v = Number(d.dataset.val);
      if (selected.has(v)) { selected.delete(v); d.classList.remove('selected'); }
      else { selected.add(v); d.classList.add('selected'); }
    });
    board.appendChild(d);
  }
}

function renderHistory(history){
  const h = el('history');
  h.innerHTML = '';
  history.slice().reverse().forEach(r=>{
    const div = document.createElement('div');
    div.textContent = `${new Date(r.timestamp).toLocaleString()}: Bet ${r.bet}, Picks ${r.picks.join(',')}, Hits ${r.hits}, Payout ${r.payout}`;
    h.appendChild(div);
  });
}

async function startNewDraw(){
  const res = await fetch('/api/commit');
  const data = await res.json();
  currentDrawId = data.drawId;
  el('commitHash').textContent = 'Commit: ' + data.commitHash + ' (drawId: ' + data.drawId + ')';
}

async function play() {
  if (!currentDrawId) { alert('Start a new draw first.'); return; }
  const userId = el('userId').value;
  const bet = Number(el('bet').value);
  const picks = Array.from(selected).sort((a,b)=>a-b);
  if (picks.length === 0) { alert('Επίλεξε τουλάχιστον 1 αριθμό.'); return; }
  const res = await fetch('/api/play', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ userId, drawId: currentDrawId, picks, bet })
  });
  const result = await res.json();
  if (result.error) { alert(result.error); return; }
  el('result').textContent = `Κλήρωση: ${result.record.numbers.join(', ')}  — Hits: ${result.record.hits}  — Payout: ${result.record.payout}`;
  el('commitHash').textContent += '  | seed: ' + result.record.seed;
  selected.clear();
  document.querySelectorAll('.cell.selected').forEach(c=>c.classList.remove('selected'));
  updateBalance();
  currentDrawId = null;
}

document.addEventListener('DOMContentLoaded', ()=>{
  renderBoard();
  el('newDraw').addEventListener('click', startNewDraw);
  el('playBtn').addEventListener('click', play);
  updateBalance();
});