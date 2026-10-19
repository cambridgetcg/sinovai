// A literal browser program: bundlers must not inject module closures into it.
export const ROOM_CREATION_CLIENT = String.raw`
(function () {
  var button = $("rc"), nameInput = $("rn"), hostInput = $("rh"), message = $("rcmsg");
  var blocked = false, refused = null;
  function requestBody() {
    return JSON.stringify({ name: nameInput.value.trim(), host: hostInput.value.trim(), toy: "free" });
  }
  function boundedDetail(text) {
    var result = "", count = 0;
    for (var point of text) {
      if (count === 160) return result + "…";
      result += point;
      count++;
    }
    return result;
  }
  function inputChanged() {
    if (!blocked && refused !== null) {
      button.disabled = !nameInput.value.trim() || !hostInput.value.trim() || requestBody() === refused;
    }
  }
  nameInput.addEventListener("input", inputChanged);
  hostInput.addEventListener("input", inputChanged);
  button.addEventListener("click", async function () {
    if (blocked) return;
    var name = nameInput.value.trim(), host = hostInput.value.trim();
    if (!name || !host) {
      message.textContent = "Enter a room name and an existing host record name before submitting.";
      return;
    }
    var body = requestBody();
    if (body === refused) return;
    blocked = true;
    button.disabled = true;
    message.textContent = "Room creation request pending.";
    try {
      var response = await fetch("/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body
      });
      var data = await response.json();
      var ambiguous = data && ((Object.hasOwn(data, "stored") && data.stored !== true) || data.reconciliation_required === true ||
        Object.hasOwn(data, "candidate_id") || Object.hasOwn(data, "candidate_room_key"));
      var room = data && data.room;
      var validRoom = room && typeof room === "object" && !Array.isArray(room) &&
        typeof room.id === "string" && /^[a-f0-9]{8}$/.test(room.id) &&
        typeof room.host === "string" && Array.isArray(room.members) && Array.isArray(room.moves);
      if (!ambiguous && response.ok && data && data.ok === true && validRoom && !Object.hasOwn(data, "error")) {
        message.textContent = "Room creation write accepted. Room ID: " + data.room.id + ". This does not establish durable storage or global uniqueness.";
        nameInput.value = "";
        blocked = false;
        refused = null;
        button.disabled = false;
        try {
          await loadRooms();
        } catch (_) {
          // This separate read cannot revoke the creation acknowledgement.
        }
        return;
      }
      // These statuses with an error body are /rooms pre-write validation refusals.
      if (!ambiguous && [400, 404, 413].includes(response.status) && data && typeof data.error === "string" && data.error &&
          data.ok !== true && !Object.hasOwn(data, "stored") && !Object.hasOwn(data, "room")) {
        refused = body;
        blocked = false;
        message.textContent = "Room creation was refused before a write. Review and revise the input before submitting a changed request. Server detail: " + boundedDetail(data.error);
        inputChanged();
        return;
      }
    } catch (_) {
      // A lost response does not establish whether the write was accepted.
    }
    blocked = true;
    button.disabled = true;
    message.textContent = "Room creation is not confirmed. It may or may not have been stored. Further creation is paused on this page. Check /rooms (read-only) before any further action; an absent room does not prove the write failed.";
    if (data && typeof data.candidate_id === "string" && /^[a-f0-9]{8}$/.test(data.candidate_id)) {
      message.textContent += " Candidate ID (unconfirmed): " + data.candidate_id + ".";
    }
  });
})();
`;
