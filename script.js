// ======================
// SUPABASE CONFIGURATION
// ======================
const SUPABASE_URL = 'https://qkqzgvsvxwsegzxzwwmv.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable__9Tnl82aqFCfs6YluVIqYw_le8InAI0';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ======================
// COPY LINK FUNCTION
// ======================
function copyLink() {
  const input = document.getElementById("shareLink");
  if (!input) return;

  input.select();
  input.setSelectionRange(0, 99999);
  document.execCommand("copy");

  const btn = document.querySelector(".btn-copy");
  if (btn) {
    const oldText = btn.innerText;
    btn.innerText = "Copied!";
    btn.style.background = "#22c55e";

    setTimeout(() => {
      btn.innerText = oldText;
      btn.style.background = "";
    }, 2000);
  }
}

// ======================
// SIMPLE TIMER
// ======================
function startTimer() {
  const timerElement = document.getElementById("timeLeft");
  if (!timerElement) return;

  let totalSeconds = 24 * 60 * 60; // 24 Hours

  const interval = setInterval(() => {
    let hours = Math.floor(totalSeconds / 3600);
    let minutes = Math.floor((totalSeconds % 3600) / 60);
    let seconds = totalSeconds % 60;

    hours = hours < 10 ? "0" + hours : hours;
    minutes = minutes < 10 ? "0" + minutes : minutes;
    seconds = seconds < 10 ? "0" + seconds : seconds;

    timerElement.innerText = `${hours}:${minutes}:${seconds}`;

    if (totalSeconds <= 0) {
      clearInterval(interval);
      timerElement.innerText = "00:00:00";
      alert("Voting time is over!");
      window.location.href = "result.html";
    }

    totalSeconds--;
  }, 1000);
}

// ======================
// CREATE ROOM FORM (Supabase Storage + Database)
// ======================
function setupCreateRoomForm() {
  const form = document.getElementById("createRoomForm");
  if (!form) return;

  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    const player1Name = document.getElementById("player1Name").value.trim();
    const player2Name = document.getElementById("player2Name").value.trim();
    const player1PhotoFile = document.getElementById("player1Photo").files[0];
    const player2PhotoFile = document.getElementById("player2Photo").files[0];

    if (!player1Name || !player2Name || !player1PhotoFile || !player2PhotoFile) {
      alert("Please enter both names and select both photos!");
      return;
    }

    const submitBtn = document.querySelector(".btn-create");
    submitBtn.innerText = "Creating Room...";
    submitBtn.disabled = true;

    try {
      // 1. Unique Room ID generate karein
      const roomId = "VB-" + Math.floor(1000 + Math.random() * 9000);

      // 2. Player 1 Photo Upload
      const fileExt1 = player1PhotoFile.name.split('.').pop();
      const fileName1 = `${roomId}_p1_${Date.now()}.${fileExt1}`;
      
      const { error: err1 } = await supabase.storage
        .from('player-photos')
        .upload(fileName1, player1PhotoFile);

      if (err1) throw err1;

      const { data: { publicUrl: player1PhotoUrl } } = supabase.storage
        .from('player-photos')
        .getPublicUrl(fileName1);

      // 3. Player 2 Photo Upload
      const fileExt2 = player2PhotoFile.name.split('.').pop();
      const fileName2 = `${roomId}_p2_${Date.now()}.${fileExt2}`;
      
      const { error: err2 } = await supabase.storage
        .from('player-photos')
        .upload(fileName2, player2PhotoFile);

      if (err2) throw err2;

      const { data: { publicUrl: player2PhotoUrl } } = supabase.storage
        .from('player-photos')
        .getPublicUrl(fileName2);

      // 4. Supabase Database mein Room Insert Karein
      const { error: dbError } = await supabase
        .from('rooms')
        .insert([
          {
            id: roomId,
            player1_name: player1Name,
            player1_photo: player1PhotoUrl,
            player1_votes: 0,
            player2_name: player2Name,
            player2_photo: player2PhotoUrl,
            player2_votes: 0
          }
        ]);

      if (dbError) throw dbError;

      // 5. Redirect to Room Page
      window.location.href = `room.html?id=${roomId}`;

    } catch (error) {
      console.error("Error creating room:", error.message);
      alert("Failed to create room: " + error.message);
      submitBtn.innerText = "Create Room";
      submitBtn.disabled = false;
    }
  });
}

// ======================
// LOAD ROOM DATA ON room.html
// ======================
async function loadRoomData() {
  const urlParams = new URLSearchParams(window.location.search);
  const roomId = urlParams.get("id");

  if (!roomId) return;

  // Room ID display karein
  const roomIdSpan = document.querySelector(".room-id span");
  if (roomIdSpan) roomIdSpan.innerText = `#${roomId}`;

  // Share link update karein
  const shareInput = document.getElementById("shareLink");
  if (shareInput) shareInput.value = window.location.href;

  // Database se room fetch karein
  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', roomId)
    .single();

  if (error || !data) {
    alert("Room not found!");
    window.location.href = "index.html";
    return;
  }

  // UI update karein names, photos aur votes ke sath
  const nameElements = document.querySelectorAll(".candidate-name");
  const photoElements = document.querySelectorAll(".candidate-photo");
  const voteSpans = document.querySelectorAll(".vote-count span");

  if (nameElements.length >= 2) {
    nameElements[0].innerText = data.player1_name;
    nameElements[1].innerText = data.player2_name;
  }

  if (photoElements.length >= 2) {
    photoElements[0].src = data.player1_photo;
    photoElements[1].src = data.player2_photo;
  }

  if (voteSpans.length >= 2) {
    voteSpans[0].id = "votes1";
    voteSpans[0].innerText = data.player1_votes;
    voteSpans[1].id = "votes2";
    voteSpans[1].innerText = data.player2_votes;
  }

  // Voting Logic Setup
  setupSupabaseVoting(roomId, data);
}

// ======================
// SUPABASE VOTE BUTTONS
// ======================
function setupSupabaseVoting(roomId, roomData) {
  const buttons = document.querySelectorAll(".byte-btn, .btn-vote");

  if (localStorage.getItem(`voted_${roomId}`) === "true") {
    disableVoteButtons("You have already voted!");
    return;
  }

  buttons.forEach((btn) => {
    btn.addEventListener("click", async function () {
      if (localStorage.getItem(`voted_${roomId}`) === "true") {
        alert("You have already voted!");
        return;
      }

      const candidateNum = this.getAttribute("data-candidate");
      const voteField = candidateNum === "1" ? "player1_votes" : "player2_votes";
      const currentVotes = candidateNum === "1" ? roomData.player1_votes : roomData.player2_votes;

      // Database mein vote update karein (+1)
      const { error } = await supabase
        .from('rooms')
        .update({ [voteField]: currentVotes + 1 })
        .eq('id', roomId);

      if (error) {
        alert("Failed to submit vote. Try again.");
        return;
      }

      localStorage.setItem(`voted_${roomId}`, "true");
      disableVoteButtons("Thank you for voting!");
      
      // UI update count
      const voteSpan = document.getElementById("votes" + candidateNum);
      if (voteSpan) voteSpan.innerText = currentVotes + 1;
    });
  });
}

function disableVoteButtons(message) {
  const buttons = document.querySelectorAll(".btn-vote");
  buttons.forEach((b) => {
    b.disabled = true;
    b.innerText = "Voted";
    b.style.background = "#64748b";
    b.style.cursor = "not-allowed";
  });
  if (message) alert(message);
}

// ======================
// DOWNLOAD WINNER IMAGE (Canvas API)
// ======================
function setupWinnerDownload() {
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
  input.setSelectionRange(0, 99999);
  document.execCommand("copy");

  const btn = document.querySelector(".btn-copy");
  if (btn) {
    const oldText = btn.innerText;
    btn.innerText = "Copied!";
    btn.style.background = "#22c55e";

    setTimeout(() => {
      btn.innerText = oldText;
      btn.style.background = "";
    }, 2000);
  }
}

// ======================
// SIMPLE TIMER
// ======================
function startTimer() {
  const timerElement = document.getElementById("timeLeft");
  if (!timerElement) return;

  let totalSeconds = 24 * 60 * 60; // 24 Hours

  const interval = setInterval(() => {
    let hours = Math.floor(totalSeconds / 3600);
    let minutes = Math.floor((totalSeconds % 3600) / 60);
    let seconds = totalSeconds % 60;

    hours = hours < 10 ? "0" + hours : hours;
    minutes = minutes < 10 ? "0" + minutes : minutes;
    seconds = seconds < 10 ? "0" + seconds : seconds;

    timerElement.innerText = `${hours}:${minutes}:${seconds}`;

    if (totalSeconds <= 0) {
      clearInterval(interval);
      timerElement.innerText = "00:00:00";
      alert("Voting time is over!");
      window.location.href = "result.html";
    }

    totalSeconds--;
  }, 1000);
}

// ======================
// CREATE ROOM FORM (Supabase Storage + Database)
// ======================
function setupCreateRoomForm() {
  const form = document.getElementById("createRoomForm");
  if (!form) return;

  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    const player1Name = document.getElementById("player1Name").value.trim();
    const player2Name = document.getElementById("player2Name").value.trim();
    const player1PhotoFile = document.getElementById("player1Photo").files[0];
    const player2PhotoFile = document.getElementById("player2Photo").files[0];

    if (!player1Name || !player2Name || !player1PhotoFile || !player2PhotoFile) {
      alert("Please enter both names and select both photos!");
      return;
    }

    const submitBtn = document.querySelector(".btn-create");
    submitBtn.innerText = "Creating Room...";
    submitBtn.disabled = true;

    try {
      // 1. Unique Room ID generate karein
      const roomId = "VB-" + Math.floor(1000 + Math.random() * 9000);

      // 2. Player 1 Photo Upload
      const fileExt1 = player1PhotoFile.name.split('.').pop();
      const fileName1 = `${roomId}_p1_${Date.now()}.${fileExt1}`;
      
      const { error: err1 } = await supabaseClient.storage
        .from('player-photos')
        .upload(fileName1, player1PhotoFile);

      if (err1) throw err1;

      const { data: { publicUrl: player1PhotoUrl } } = supabaseClient.storage
        .from('player-photos')
        .getPublicUrl(fileName1);

      // 3. Player 2 Photo Upload
      const fileExt2 = player2PhotoFile.name.split('.').pop();
      const fileName2 = `${roomId}_p2_${Date.now()}.${fileExt2}`;
      
      const { error: err2 } = await supabaseClient.storage
        .from('player-photos')
        .upload(fileName2, player2PhotoFile);

      if (err2) throw err2;

      const { data: { publicUrl: player2PhotoUrl } } = supabaseClient.storage
        .from('player-photos')
        .getPublicUrl(fileName2);

      // 4. Supabase Database mein Room Insert Karein
      const { error: dbError } = await supabaseClient
        .from('rooms')
        .insert([
          {
            id: roomId,
            player1_name: player1Name,
            player1_photo: player1PhotoUrl,
            player1_votes: 0,
            player2_name: player2Name,
            player2_photo: player2PhotoUrl,
            player2_votes: 0
          }
        ]);

      if (dbError) throw dbError;

      // 5. Redirect to Room Page
      window.location.href = `room.html?id=${roomId}`;

    } catch (error) {
      console.error("Error creating room:", error.message);
      alert("Failed to create room: " + error.message);
      submitBtn.innerText = "Create Room";
      submitBtn.disabled = false;
    }
  });
}

// ======================
// LOAD ROOM DATA ON room.html
// ======================
async function loadRoomData() {
  const urlParams = new URLSearchParams(window.location.search);
  const roomId = urlParams.get("id");

  if (!roomId) return;

  // Room ID display karein
  const roomIdSpan = document.querySelector(".room-id span");
  if (roomIdSpan) roomIdSpan.innerText = `#${roomId}`;

  // Share link update karein
  const shareInput = document.getElementById("shareLink");
  if (shareInput) shareInput.value = window.location.href;

  // Database se room fetch karein
  const { data, error } = await supabaseClient
    .from('rooms')
    .select('*')
    .eq('id', roomId)
    .single();

  if (error || !data) {
    alert("Room not found!");
    window.location.href = "index.html";
    return;
  }

  // UI update karein names, photos aur votes ke sath
  const nameElements = document.querySelectorAll(".candidate-name");
  const photoElements = document.querySelectorAll(".candidate-photo");
  const voteSpans = document.querySelectorAll(".vote-count span");

  if (nameElements.length >= 2) {
    nameElements[0].innerText = data.player1_name;
    nameElements[1].innerText = data.player2_name;
  }

  if (photoElements.length >= 2) {
    photoElements[0].src = data.player1_photo;
    photoElements[1].src = data.player2_photo;
  }

  if (voteSpans.length >= 2) {
    voteSpans[0].id = "votes1";
    voteSpans[0].innerText = data.player1_votes;
    voteSpans[1].id = "votes2";
    voteSpans[1].innerText = data.player2_votes;
  }

  // Voting Logic Setup
  setupSupabaseVoting(roomId, data);
}

// ======================
// SUPABASE VOTE BUTTONS
// ======================
function setupSupabaseVoting(roomId, roomData) {
  const buttons = document.querySelectorAll(".byte-btn, .btn-vote");

  if (localStorage.getItem(`voted_${roomId}`) === "true") {
    disableVoteButtons("You have already voted!");
    return;
  }

  buttons.forEach((btn) => {
    btn.addEventListener("click", async function () {
      if (localStorage.getItem(`voted_${roomId}`) === "true") {
        alert("You have already voted!");
        return;
      }

      const candidateNum = this.getAttribute("data-candidate");
      const voteField = candidateNum === "1" ? "player1_votes" : "player2_votes";
      const currentVotes = candidateNum === "1" ? roomData.player1_votes : roomData.player2_votes;

      // Database mein vote update karein (+1)
      const { error } = await supabaseClient
        .from('rooms')
        .update({ [voteField]: currentVotes + 1 })
        .eq('id', roomId);

      if (error) {
        alert("Failed to submit vote. Try again.");
        return;
      }

      localStorage.setItem(`voted_${roomId}`, "true");
      disableVoteButtons("Thank you for voting!");
      
      // UI update count
      const voteSpan = document.getElementById("votes" + candidateNum);
      if (voteSpan) voteSpan.innerText = currentVotes + 1;
    });
  });
}

function disableVoteButtons(message) {
  const buttons = document.querySelectorAll(".btn-vote");
  buttons.forEach((b) => {
    b.disabled = true;
    b.innerText = "Voted";
    b.style.background = "#64748b";
    b.style.cursor = "not-allowed";
  });
  if (message) alert(message);
}

// ======================
// DOWNLOAD WINNER IMAGE (Canvas API)
// ======================
function setupWinnerDownload() {
  const downloadBtn = document.querySelector(".btn-download");
  if (!downloadBtn) return;

  downloadBtn.addEventListener("click", function () {
    const canvas = document.createElement("canvas");
    canvas.width = 800;
    canvas.height = 800;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 8;
    ctx.strokeRect(30, 30, canvas.width - 60, canvas.height - 60);

    ctx.fillStyle = "#38bdf8";
    ctx.font = "bold 32px 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("VOTEBATTLE WINNER", canvas.width / 2, 90);

    const winnerName = document.getElementById("winnerName") ? document.getElementById("winnerName").innerText : "Winner";
    
    ctx.fillStyle = "#22c55e";
    ctx.beginPath();
    ctx.roundRect(canvas.width / 2 - 90, 120, 180, 40, 20);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 20px 'Segoe UI', sans-serif";
    ctx.fillText("WINNER 🏆", canvas.width / 2, 147);

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = "https://via.placeholder.com/300x300?text=Winner"; 

    img.onload = function () {
      ctx.save();
      ctx.beginPath();
      ctx.arc(canvas.width / 2, 320, 110, 0, Math.PI * 2, true);
      ctx.closePath();
      ctx.clip();
      
      ctx.drawImage(img, canvas.width / 2 - 110, 210, 220, 220);
      ctx.restore();

      ctx.strokeStyle = "#22c55e";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(canvas.width / 2, 320, 110, 0, Math.PI * 2, true);
      ctx.stroke();

      ctx.fillStyle = "#f8fafc";
      ctx.font = "bold 42px 'Segoe UI', sans-serif";
      ctx.fillText(winnerName, canvas.width / 2, 490);

      ctx.fillStyle = "#38bdf8";
      ctx.font = "bold 30px 'Segoe UI', sans-serif";
      ctx.fillText("Votes", canvas.width / 2, 545);

      ctx.fillStyle = "#64748b";
      ctx.font = "20px 'Segoe UI', sans-serif";
      ctx.fillText("Created on VoteBattle • Fair Voting Platform", canvas.width / 2, 700);

      const link = document.createElement("a");
      link.download = `${winnerName.replace(/\s+/g, '_')}_Winner.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    };
  });
}

// ======================
// PAGE LOAD
// ======================
document.addEventListener("DOMContentLoaded", function () {
  startTimer();
  setupCreateRoomForm();
  loadRoomData();
  setupWinnerDownload();
});
