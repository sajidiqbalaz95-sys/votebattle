// ======================
// SUPABASE CONFIGURATION
// ======================
const SUPABASE_URL = 'https://qkqzgvsvxwsegzxzwwmv.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable__9Tnl82aqFcFs6YluVIqYw_le8InAI0';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ======================
// COPY LINK FUNCTION
// ======================
function copyLink() {
  const input = document.getElementById("shareLink");
  if (!input) return;
  input.select();
  document.execCommand("copy");
  
  const btn = document.querySelector(".btn-copy");
  if (btn) {
    btn.innerText = "Copied!";
    btn.style.background = "#22c55e";
    setTimeout(() => {
      btn.innerText = "Copy Link";
      btn.style.background = "";
    }, 2000);
  }
}

// ======================
// TIMER
// ======================
function startTimer() {
  const timerElement = document.getElementById("timeLeft");
  if (!timerElement) return;

  let totalSeconds = 24 * 3600;
  setInterval(() => {
    let h = Math.floor(totalSeconds / 3600);
    let m = Math.floor((totalSeconds % 3600) / 60);
    let s = totalSeconds % 60;
    timerElement.innerText = `${h < 10 ? "0"+h : h}:${m < 10 ? "0"+m : m}:${s < 10 ? "0"+s : s}`;
    if (totalSeconds > 0) totalSeconds--;
  }, 1000);
}

// ======================
// CREATE ROOM
// ======================
function setupCreateRoomForm() {
  const form = document.getElementById("createRoomForm");
  if (!form) return;

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    const p1Name = document.getElementById("player1Name").value.trim();
    const p2Name = document.getElementById("player2Name").value.trim();
    const p1File = document.getElementById("player1Photo").files[0];
    const p2File = document.getElementById("player2Photo").files[0];

    if (!p1Name || !p2Name || !p1File || !p2File) {
      alert("Please fill all fields!");
      return;
    }

    const btn = document.querySelector(".btn-create");
    btn.innerText = "Creating Room...";
    btn.disabled = true;

    try {
      const roomId = "VB-" + Math.floor(1000 + Math.random() * 9000);
      
      const f1Name = `${roomId}_p1.${p1File.name.split('.').pop()}`;
      await supabaseClient.storage.from('player-photos').upload(f1Name, p1File);
      const { data: { publicUrl: p1Url } } = supabaseClient.storage.from('player-photos').getPublicUrl(f1Name);

      const f2Name = `${roomId}_p2.${p2File.name.split('.').pop()}`;
      await supabaseClient.storage.from('player-photos').upload(f2Name, p2File);
      const { data: { publicUrl: p2Url } } = supabaseClient.storage.from('player-photos').getPublicUrl(f2Name);

      const { error } = await supabaseClient.from('rooms').insert([{
        id: roomId,
        player1_name: p1Name,
        player1_photo: p1Url,
        player1_votes: 0,
        player2_name: p2Name,
        player2_photo: p2Url,
        player2_votes: 0
      }]);

      if (error) throw error;
      window.location.href = `room.html?id=${roomId}`;
    } catch (err) {
      alert("Error: " + err.message);
      btn.innerText = "Create Room";
      btn.disabled = false;
    }
  });
}

// ======================
// LOAD ROOM DATA
// ======================
async function loadRoomData() {
  const urlParams = new URLSearchParams(window.location.search);
  const roomId = urlParams.get("id");
  if (!roomId) return;

  const roomSpan = document.querySelector(".room-id span");
  if (roomSpan) roomSpan.innerText = `#${roomId}`;

  const shareInput = document.getElementById("shareLink");
  if (shareInput) shareInput.value = window.location.href;

  const { data, error } = await supabaseClient.from('rooms').select('*').eq('id', roomId).single();
  if (error || !data) {
    alert("Room not found!");
    window.location.href = "index.html";
    return;
  }

  const names = document.querySelectorAll(".candidate-name");
  const photos = document.querySelectorAll(".candidate-photo");
  const votes = document.querySelectorAll(".vote-count span");

  if (names.length >= 2) {
    names[0].innerText = data.player1_name;
    names[1].innerText = data.player2_name;
  }
  if (photos.length >= 2) {
    photos[0].src = data.player1_photo;
    photos[1].src = data.player2_photo;
  }
  if (votes.length >= 2) {
    votes[0].id = "votes1";
    votes[0].innerText = data.player1_votes;
    votes[1].id = "votes2";
    votes[1].innerText = data.player2_votes;
  }

  setupVoting(roomId, data);
}

// ======================
// VOTING LOGIC
// ======================
function setupVoting(roomId, roomData) {
  const buttons = document.querySelectorAll(".btn-vote");
  if (localStorage.getItem(`voted_${roomId}`) === "true") {
    lockVotes();
    return;
  }

  buttons.forEach(btn => {
    btn.addEventListener("click", async function () {
      if (localStorage.getItem(`voted_${roomId}`) === "true") return;

      const num = this.getAttribute("data-candidate");
      const field = num === "1" ? "player1_votes" : "player2_votes";
      const current = num === "1" ? roomData.player1_votes : roomData.player2_votes;

      const { error } = await supabaseClient.from('rooms').update({ [field]: current + 1 }).eq('id', roomId);
      if (error) {
        alert("Failed to vote!");
        return;
      }

      localStorage.setItem(`voted_${roomId}`, "true");
      lockVotes();
      
      const span = document.getElementById("votes" + num);
      if (span) span.innerText = current + 1;
      alert("Vote submitted successfully!");
    });
  });
}

function lockVotes() {
  document.querySelectorAll(".btn-vote").forEach(b => {
    b.disabled = true;
    b.innerText = "Voted";
    b.style.background = "#64748b";
  });
}

// ======================
// PAGE LOAD
// ======================
document.addEventListener("DOMContentLoaded", () => {
  startTimer();
  setupCreateRoomForm();
  loadRoomData();
});
